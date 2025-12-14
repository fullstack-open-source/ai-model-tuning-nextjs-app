"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@context/AuthContext"
import { useToast } from "@hooks/useToast"
import { mediaService } from "@services/media.service"
import { SidePanel } from "@components/ui/side-panel"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Card, CardContent } from "@components/ui/card"
import {
  Upload, Link2, Image, File, Video, Music, FileText, Archive,
  Search, Grid, List, Check, Loader2, X, Globe, HardDrive,
  FolderOpen, ExternalLink, AlertCircle, RefreshCw
} from "lucide-react"
import type { Media } from "@models/media.model"
import { getMediaDisplayUrl, getMediaThumbnailUrl, getCachedThumbnailUrl } from "@models/media.model"
import { FolderManager } from "./FolderManager"
import { CachedImage } from "./CachedImage"
import { mediaCache } from "@lib/cache/mediaCache"

// Helper to format file size
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Get icon for file type
function getFileIcon(fileType: string, className: string = "h-5 w-5") {
  const iconProps = { className }
  switch (fileType) {
    case 'image': return <Image {...iconProps} className={`${className} text-green-500`} />
    case 'video': return <Video {...iconProps} className={`${className} text-purple-500`} />
    case 'audio': return <Music {...iconProps} className={`${className} text-pink-500`} />
    case 'document': return <FileText {...iconProps} className={`${className} text-blue-500`} />
    case 'archive': return <Archive {...iconProps} className={`${className} text-orange-500`} />
    default: return <File {...iconProps} className={`${className} text-gray-500`} />
  }
}

export type MediaPickerMode = 'all' | 'image' | 'video' | 'audio' | 'document'

interface MediaPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (media: Media | string) => void
  mode?: MediaPickerMode
  multiple?: boolean
  title?: string
  description?: string
  allowUrl?: boolean
  allowUpload?: boolean
  storageType?: 'all' | 'local' | 'cloud'
}

type TabType = 'library' | 'upload' | 'url'

export function MediaPicker({
  open,
  onClose,
  onSelect,
  mode = 'all',
  multiple = false,
  title = "Select Media",
  description = "Choose from your library or upload new files",
  allowUrl = true,
  allowUpload = true,
  storageType = 'all',
}: MediaPickerProps) {
  const { apiService } = useAuth()
  const { showSuccess, showError } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [activeTab, setActiveTab] = useState<TabType>('library')
  const [mediaFiles, setMediaFiles] = useState<Media[]>([])
  const [selectedMedia, setSelectedMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [storageFilter, setStorageFilter] = useState<'all' | 'local' | 'cloud'>(storageType)
  const [selectedStorageType, setSelectedStorageType] = useState<'local' | 'cloud'>('local')
  const [selectedFolder, setSelectedFolder] = useState<string>('uploads')
  const [availableFolders, setAvailableFolders] = useState<string[]>(['uploads'])
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false)

  // Set auth API
  useEffect(() => {
    if (apiService) {
      mediaService.setAuthApi(apiService)
    }
  }, [apiService])

  // Load media files
  const loadMedia = useCallback(async (forceRefresh = false) => {
    if (!open) return
    setLoading(true)
    try {
      const filters: any = {
        limit: 50,
        status: 'active',
        is_trashed: false,
      }
      
      // Filter by file type based on mode
      if (mode !== 'all') {
        filters.file_type = mode
      }

      // Filter by storage provider
      if (storageFilter !== 'all') {
        filters.storage_provider = storageFilter === 'local' ? 'local' : undefined
      }

      if (search) {
        filters.search = search
      }

      // Use refresh to bypass cache and get latest data
      const response = forceRefresh 
        ? await mediaService.refreshMedia(filters)
        : await mediaService.getMedia(filters)
      
      if (response?.success && response.data) {
        const data = response.data as any
        setMediaFiles(data.media || [])
      }
    } catch (error) {
      console.error('Error loading media:', error)
    } finally {
      setLoading(false)
    }
  }, [open, mode, search, storageFilter])

  // Extract folders from loaded media
  useEffect(() => {
    if (mediaFiles.length > 0) {
      // Map null/undefined folders to 'uploads' and get unique folders
      const folders = Array.from(new Set(
        mediaFiles
          .map(m => m.folder || 'uploads')
          .filter(Boolean) as string[]
      )).sort()
      setAvailableFolders(folders)
    }
  }, [mediaFiles])

  useEffect(() => {
    // Force refresh when picker opens to get latest media
    if (open) {
      loadMedia(true) // Force refresh to bypass cache
    }
  }, [open, loadMedia])

  // Reset state when picker opens/closes
  useEffect(() => {
    if (open) {
      // Reset upload state when picker opens
      setSelectedFiles([])
      setUploadProgress({})
      setUploading(false)
      setActiveTab('library')
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } else {
      // Cleanup when picker closes
      setSelectedFiles([])
      setUploadProgress({})
      setUploading(false)
      previewUrls.forEach(url => URL.revokeObjectURL(url))
      setPreviewUrls(new Map())
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open])

  // Handle file selection from library
  const handleMediaSelect = (media: Media) => {
    if (multiple) {
      setSelectedMedia(prev => {
        const exists = prev.find(m => m.media_id === media.media_id)
        if (exists) {
          return prev.filter(m => m.media_id !== media.media_id)
        }
        return [...prev, media]
      })
    } else {
      setSelectedMedia([media])
    }
  }

  // Handle confirm selection
  const handleConfirm = () => {
    if (selectedMedia.length === 0) return
    
    if (multiple) {
      selectedMedia.forEach(media => onSelect(media))
    } else {
      onSelect(selectedMedia[0])
    }
    
    handleClose()
  }

  // Handle URL submission
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return
    
    setUrlLoading(true)
    try {
      // Validate URL
      new URL(urlInput)
      onSelect(urlInput)
      handleClose()
    } catch {
      showError('Invalid URL format')
    } finally {
      setUrlLoading(false)
    }
  }

  // Handle file selection for upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      // Filter based on mode
      const filteredFiles = mode === 'all' ? files : files.filter(f => {
        if (mode === 'image') return f.type.startsWith('image/')
        if (mode === 'video') return f.type.startsWith('video/')
        if (mode === 'audio') return f.type.startsWith('audio/')
        if (mode === 'document') return f.type.startsWith('application/') || f.type.startsWith('text/')
        return true
      })
      setSelectedFiles(prev => [...prev, ...filteredFiles])
      
      // Reset file input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle file upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0 || uploading) return // Prevent double upload
    
    setUploading(true)

    // Create a copy of selected files to upload
    const filesToUpload = [...selectedFiles]
    const uploadedMedia: Media[] = []

    try {
      for (const file of filesToUpload) {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
        
        try {
          const response = await mediaService.uploadMedia(file, {
            folder: selectedFolder || 'uploads',
            visibility: 'private',
            storage_type: selectedStorageType,
          })
          
          if (response?.success && response.data) {
            const data = response.data as any
            if (data.media) {
              uploadedMedia.push(data.media)
            }
          }
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
        } catch (error) {
          showError(`Failed to upload ${file.name}`)
          setUploadProgress(prev => ({ ...prev, [file.name]: -1 }))
        }
      }

      if (uploadedMedia.length > 0) {
        showSuccess(`${uploadedMedia.length} file(s) uploaded successfully`)
        
        // Auto-select uploaded files
        if (multiple) {
          setSelectedMedia(prev => [...prev, ...uploadedMedia])
        } else if (uploadedMedia.length === 1) {
          // Select the uploaded file but don't close - switch to library to show it
          setSelectedMedia([uploadedMedia[0]])
        }
        
        // Refresh library with force refresh to bypass cache and show new uploads
        await loadMedia(true)
        setActiveTab('library')
      }

      // Clear selected files and progress only after successful upload
      setSelectedFiles([])
      setUploadProgress({})
    } catch (error) {
      showError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Store preview URLs for cleanup
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map())
  
  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])
  
  // Generate preview URLs when files are selected
  useEffect(() => {
    // Cleanup old URLs first
    previewUrls.forEach(url => URL.revokeObjectURL(url))
    
    const newUrls = new Map<string, string>()
    selectedFiles.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        newUrls.set(`${index}-${file.name}`, url)
      }
    })
    setPreviewUrls(newUrls)
    
    // Cleanup function
    return () => {
      newUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])
  
  // Handle close - cleanup object URLs
  const handleClose = () => {
    // Clean up all preview URLs
    previewUrls.forEach(url => URL.revokeObjectURL(url))
    setPreviewUrls(new Map())
    
    setSelectedMedia([])
    setSelectedFiles([])
    setUploadProgress({})
    setSearch('')
    setUrlInput('')
    setActiveTab('library')
    onClose()
  }

  // Get accept string for file input
  const getAcceptString = () => {
    switch (mode) {
      case 'image': return 'image/*'
      case 'video': return 'video/*'
      case 'audio': return 'audio/*'
      case 'document': return '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx'
      default: return '*/*'
    }
  }

  return (
    <SidePanel
      open={open}
      title={title}
      description={description}
      width="xl"
      onClose={handleClose}
      actions={
        activeTab === 'library' && selectedMedia.length > 0 ? (
          <Button onClick={handleConfirm}>
            <Check className="h-4 w-4 mr-2" />
            Select {selectedMedia.length > 1 ? `(${selectedMedia.length})` : ''}
          </Button>
        ) : activeTab === 'upload' && selectedFiles.length > 0 ? (
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Upload {selectedFiles.length} file(s)</>
            )}
          </Button>
        ) : activeTab === 'url' ? (
          <Button onClick={handleUrlSubmit} disabled={!urlInput.trim() || urlLoading}>
            {urlLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" /> Use URL</>
            )}
          </Button>
        ) : null
      }
    >
      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'library'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('library')}
        >
          <FolderOpen className="h-4 w-4 inline mr-2" />
          Library
        </button>
        {allowUpload && (
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Upload
          </button>
        )}
        {allowUrl && (
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('url')}
          >
            <Link2 className="h-4 w-4 inline mr-2" />
            URL
          </button>
        )}
      </div>

      {/* Library Tab */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value as any)}
            >
              <option value="all">All Storage</option>
              <option value="local">Local</option>
              <option value="cloud">Cloud</option>
            </select>
            <Button variant="outline" size="icon" onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => loadMedia(true)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Media Grid/List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : mediaFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No files found</p>
              <Button variant="link" onClick={() => setActiveTab('upload')} className="mt-2">
                Upload your first file
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 h-full overflow-y-auto">
              {mediaFiles.map((media) => {
                const isSelected = selectedMedia.some(m => m.media_id === media.media_id)
                return (
                  <div
                    key={media.media_id}
                    className={`relative group rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                    onClick={() => handleMediaSelect(media)}
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                      {media.file_type === 'image' && (media.public_url || getCachedThumbnailUrl(media)) ? (
                        <CachedImage
                          src={media.public_url || getCachedThumbnailUrl(media)!}
                          alt={media.alt_text || media.original_name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                          priority={false}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          {getFileIcon(media.file_type, "h-8 w-8")}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{media.original_name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{formatBytes(media.file_size)}</span>
                        {media.storage_provider === 'local' ? (
                          <HardDrive className="h-3 w-3 text-blue-500" />
                        ) : (
                          <Globe className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2 h-full overflow-y-auto">
              {mediaFiles.map((media) => {
                const isSelected = selectedMedia.some(m => m.media_id === media.media_id)
                return (
                  <div
                    key={media.media_id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleMediaSelect(media)}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                      {media.file_type === 'image' && (media.public_url || getCachedThumbnailUrl(media)) ? (
                        <CachedImage
                          src={media.public_url || getCachedThumbnailUrl(media)!}
                          alt={media.original_name}
                          width={40}
                          height={40}
                          className="object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          {getFileIcon(media.file_type)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{media.original_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(media.file_size)} • {media.storage_provider}
                      </p>
                    </div>
                    {isSelected && <Check className="h-5 w-5 text-primary" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const files = Array.from(e.dataTransfer.files)
              // Filter based on mode
              const filteredFiles = mode === 'all' ? files : files.filter(f => {
                if (mode === 'image') return f.type.startsWith('image/')
                if (mode === 'video') return f.type.startsWith('video/')
                if (mode === 'audio') return f.type.startsWith('audio/')
                if (mode === 'document') return f.type.startsWith('application/') || f.type.startsWith('text/')
                return true
              })
              setSelectedFiles(prev => [...prev, ...filteredFiles])
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === 'image' ? 'Images only (JPG, PNG, GIF, WebP)' :
               mode === 'video' ? 'Videos only (MP4, WebM, MOV)' :
               mode === 'audio' ? 'Audio only (MP3, WAV, OGG)' :
               mode === 'document' ? 'Documents only (PDF, DOC, TXT)' :
               'All file types supported'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={getAcceptString()}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Folder Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Upload Folder</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsFolderManagerOpen(true)}
                className="text-xs"
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                Manage
              </Button>
            </div>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
              >
                {availableFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Files will be organized in the selected folder
            </p>
          </div>

          {/* Storage Type Selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Upload Destination</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Local Storage Option */}
              <label
                className={`relative flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                  selectedStorageType === 'local'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="storage"
                  value="local"
                  checked={selectedStorageType === 'local'}
                  onChange={() => setSelectedStorageType('local')}
                  className="sr-only"
                />
                <div className={`flex items-center justify-center w-12 h-12 rounded-full mb-3 transition-colors ${
                  selectedStorageType === 'local'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <HardDrive className="h-6 w-6" />
                </div>
                <span className={`text-sm font-medium mb-1 ${
                  selectedStorageType === 'local' ? 'text-primary' : 'text-foreground'
                }`}>
                  Local Storage
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  Save to server
                </span>
                {selectedStorageType === 'local' && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </label>

              {/* Cloud Storage Option */}
              <label
                className={`relative flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                  selectedStorageType === 'cloud'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="storage"
                  value="cloud"
                  checked={selectedStorageType === 'cloud'}
                  onChange={() => setSelectedStorageType('cloud')}
                  className="sr-only"
                />
                <div className={`flex items-center justify-center w-12 h-12 rounded-full mb-3 transition-colors ${
                  selectedStorageType === 'cloud'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <Globe className="h-6 w-6" />
                </div>
                <span className={`text-sm font-medium mb-1 ${
                  selectedStorageType === 'cloud' ? 'text-primary' : 'text-foreground'
                }`}>
                  Cloud Storage
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  Google, S3, etc.
                </span>
                {selectedStorageType === 'cloud' && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Files ({selectedFiles.length})</p>
              <div className="max-h-[400px] overflow-y-auto">
                {/* Grid layout for images - 3 per row */}
                <div className="grid grid-cols-3 gap-3">
                  {selectedFiles.map((file, index) => {
                    const isImage = file.type.startsWith('image/')
                    const previewUrl = isImage ? previewUrls.get(`${index}-${file.name}`) : null
                    
                    if (isImage && previewUrl) {
                      // Image files - show in grid with preview
                      return (
                        <div key={index} className="relative group border rounded-lg overflow-hidden bg-muted/30">
                          {/* Image Preview */}
                          <div className="relative w-full aspect-square bg-muted flex items-center justify-center overflow-hidden">
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                            {/* Overlay with delete button */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const urlKey = `${index}-${file.name}`
                                  if (previewUrls.has(urlKey)) {
                                    URL.revokeObjectURL(previewUrls.get(urlKey)!)
                                    setPreviewUrls(prev => {
                                      const newMap = new Map(prev)
                                      newMap.delete(urlKey)
                                      return newMap
                                    })
                                  }
                                  setSelectedFiles(prev => prev.filter((_, i) => i !== index))
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {/* File Info */}
                          <div className="p-2">
                            <p className="text-xs font-medium truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                            {uploadProgress[file.name] !== undefined && (
                              <div className="mt-1">
                                {uploadProgress[file.name] === 100 ? (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Done
                                  </span>
                                ) : uploadProgress[file.name] === -1 ? (
                                  <span className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Failed
                                  </span>
                                ) : (
                                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary transition-all"
                                      style={{ width: `${uploadProgress[file.name]}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    } else {
                      // Non-image files - show in list format below grid
                      return null // Will be rendered separately
                    }
                  })}
                </div>
                
                {/* Non-image files list */}
                {selectedFiles.some(f => !f.type.startsWith('image/')) && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((file, index) => {
                      const isImage = file.type.startsWith('image/')
                      if (isImage) return null
                      
                      return (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                          <div className="flex-shrink-0">
                            {file.type.startsWith('video/') ? (
                              <Video className="h-5 w-5 text-purple-500" />
                            ) : file.type.startsWith('audio/') ? (
                              <Music className="h-5 w-5 text-pink-500" />
                            ) : (
                              <File className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                            {uploadProgress[file.name] !== undefined && (
                              <div className="mt-1">
                                {uploadProgress[file.name] === 100 ? (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Uploaded
                                  </span>
                                ) : uploadProgress[file.name] === -1 ? (
                                  <span className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Failed
                                  </span>
                                ) : (
                                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary transition-all"
                                      style={{ width: `${uploadProgress[file.name]}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {!uploading && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedFiles(prev => prev.filter((_, i) => i !== index))
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Tab */}
      {activeTab === 'url' && (
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Enter image URL</p>
            <p className="text-xs text-muted-foreground mb-4">
              Paste a URL to an image from the web. The image will be used directly without uploading.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/image.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => setUrlInput('')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* URL Preview */}
          {urlInput && (
            <div className="border rounded-lg overflow-hidden">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {mode === 'image' || urlInput.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                  <img
                    src={urlInput}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <ExternalLink className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">External URL</p>
                  </div>
                )}
              </div>
              <div className="p-3 border-t">
                <p className="text-xs text-muted-foreground truncate">{urlInput}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Folder Manager */}
      <FolderManager
        open={isFolderManagerOpen}
        onClose={() => setIsFolderManagerOpen(false)}
        onSelectFolder={(folder) => {
          setSelectedFolder(folder)
          if (!availableFolders.includes(folder)) {
            setAvailableFolders(prev => [...prev, folder].sort())
          }
          setIsFolderManagerOpen(false)
        }}
        selectedFolder={selectedFolder}
      />
    </SidePanel>
  )
}

// Hook for easy media picker usage
export function useMediaPicker() {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<Partial<MediaPickerProps>>({})
  const [resolveRef, setResolveRef] = useState<((value: Media | string | null) => void) | null>(null)

  const openPicker = (options?: Partial<MediaPickerProps>): Promise<Media | string | null> => {
    return new Promise((resolve) => {
      setConfig(options || {})
      setResolveRef(() => resolve)
      setIsOpen(true)
    })
  }

  const handleSelect = (media: Media | string) => {
    if (resolveRef) {
      resolveRef(media)
      setResolveRef(null)
    }
    setIsOpen(false)
  }

  const handleClose = () => {
    if (resolveRef) {
      resolveRef(null)
      setResolveRef(null)
    }
    setIsOpen(false)
  }

  const PickerComponent = () => (
    <MediaPicker
      open={isOpen}
      onClose={handleClose}
      onSelect={handleSelect}
      {...config}
    />
  )

  return {
    openPicker,
    isOpen,
    PickerComponent,
  }
}

