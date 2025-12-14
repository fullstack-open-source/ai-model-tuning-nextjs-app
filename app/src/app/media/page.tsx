"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { useApiCall } from "@hooks/useApiCall"
import { useToast } from "@hooks/useToast"
import { mediaService } from "@services/media.service"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { MediaPicker } from "@components/media/MediaPicker"
import { FolderManager } from "@components/media/FolderManager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { 
  Upload, File, Image, Video, Music, FileText, Archive, X, CheckCircle2, 
  Loader2, Search, Filter, RefreshCw, Trash2, Download, Eye, Link2, 
  Copy, MoreVertical, FolderOpen, Grid, List, HardDrive, Globe, Lock,
  Clock, User, ExternalLink, Edit, ChevronDown, ChevronUp, Info, AlertCircle,
  Calendar, Tag, Folder, Check
} from "lucide-react"
import type { Media, MediaStats, MediaFilters } from "@models/media.model"
import { getMediaDisplayUrl, getMediaThumbnailUrl, getCachedThumbnailUrl } from "@models/media.model"
import { CachedImage } from "@components/media/CachedImage"
import { mediaCache } from "@lib/cache/mediaCache"
import { formatDate, formatDateTime } from "@lib/utils/date-format"

// Helper to format file size
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get icon for file type
function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'image': return <Image className="h-5 w-5 text-green-500" />;
    case 'video': return <Video className="h-5 w-5 text-purple-500" />;
    case 'audio': return <Music className="h-5 w-5 text-pink-500" />;
    case 'document': return <FileText className="h-5 w-5 text-blue-500" />;
    case 'archive': return <Archive className="h-5 w-5 text-orange-500" />;
    default: return <File className="h-5 w-5 text-gray-500" />;
  }
}

export default function MediaPage() {
  return (
    <PageGuard requireAnyPermission={["view_media", "add_upload", "manage_media"]}>
      <MediaContent />
    </PageGuard>
  )
}

function MediaContent() {
  const router = useRouter()
  const { user, apiService, loading: authLoading } = useAuth()
  const { showSuccess, showError } = useToast()
  
  // State
  const [mediaFiles, setMediaFiles] = useState<Media[]>([])
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set())
  const [statistics, setStatistics] = useState<MediaStats | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false)
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 24
  
  // Filters
  const [filters, setFilters] = useState<MediaFilters>({
    search: '',
    file_type: undefined,
    visibility: undefined,
    folder: undefined,
    status: 'active',
    is_trashed: false,
  })
  
  // Folder management
  const [folders, setFolders] = useState<string[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined)

  // Set auth API
  useEffect(() => {
    if (apiService) {
      mediaService.setAuthApi(apiService)
    }
  }, [apiService])

  // Load media
  const loadMedia = useApiCall(
    async () => {
      const response = await mediaService.getMedia({
        ...filters,
        limit,
        offset: (page - 1) * limit,
      })
      return response
    },
    {
      onSuccess: (data: any) => {
        if (data?.media) {
          // Cache all media URLs for fast access
          data.media.forEach((media: Media) => {
            if (media.public_url) {
              mediaCache.set(media.media_id, media.public_url, media.is_public)
            }
            if (media.thumbnail_url) {
              mediaCache.set(`${media.media_id}_thumb`, media.thumbnail_url, media.is_public)
            }
          })
          
          setMediaFiles(data.media)
          setTotal(data.total || data.media.length)
          setTotalPages(data.pagination?.total_pages || 1)
        }
      },
    }
  )

  // Refresh media (bypass cache)
  const refreshMedia = useApiCall(
    async () => {
      const response = await mediaService.refreshMedia({
        ...filters,
        limit,
        offset: (page - 1) * limit,
      })
      return response
    },
    {
      onSuccess: (data: any) => {
        if (data?.media) {
          // Cache all media URLs for fast access
          data.media.forEach((media: Media) => {
            if (media.public_url) {
              mediaCache.set(media.media_id, media.public_url, media.is_public)
            }
            if (media.thumbnail_url) {
              mediaCache.set(`${media.media_id}_thumb`, media.thumbnail_url, media.is_public)
            }
          })
          
          setMediaFiles(data.media)
          setTotal(data.total || data.media.length)
          setTotalPages(data.pagination?.total_pages || 1)
        }
      },
    }
  )

  // Load statistics
  const loadStatistics = useApiCall(
    async () => await mediaService.getMediaStats(),
    {
      onSuccess: (data: any) => {
        if (data?.statistics) {
          setStatistics(data.statistics)
        }
      },
    }
  )

  // Load folders from API
  const loadFolders = useApiCall(
    async () => await mediaService.getFolders(),
    {
      onSuccess: (data: any) => {
        if (data?.folders && Array.isArray(data.folders)) {
          const folderNames = data.folders.map((f: any) => f.name || f.path).filter(Boolean)
          // Always include 'uploads' as default folder
          const allFolders = Array.from(new Set([...folderNames, 'uploads'])).sort()
          setFolders(allFolders)
        } else {
          // Fallback: load from media files if API fails
          if (mediaFiles.length > 0) {
            const uniqueFolders = Array.from(new Set(
              mediaFiles
                .map(m => m.folder)
                .filter(Boolean) as string[]
            )).sort()
            setFolders(uniqueFolders.length > 0 ? uniqueFolders : ['uploads'])
          } else {
            setFolders(['uploads'])
          }
        }
      },
      onError: () => {
        // Fallback: load from media files if API fails
        if (mediaFiles.length > 0) {
          const uniqueFolders = Array.from(new Set(
            mediaFiles
              .map(m => m.folder)
              .filter(Boolean) as string[]
          )).sort()
          setFolders(uniqueFolders.length > 0 ? uniqueFolders : ['uploads'])
        } else {
          setFolders(['uploads'])
        }
      },
    }
  )

  // Load folders when component mounts
  useEffect(() => {
    loadFolders.execute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Also refresh folders when media files change (in case new folders were created via uploads)
  useEffect(() => {
    if (mediaFiles.length > 0) {
      // Refresh folder list to include any new folders from uploaded files
      loadFolders.execute()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [mediaFiles.length]) // Only when count changes

  // Refresh folders when folder manager closes (in case folders were created/renamed/deleted)
  const handleFolderManagerClose = () => {
    setIsFolderManagerOpen(false)
    // Refresh folder list after folder operations
    loadFolders.execute()
    // Reload media to get updated folder list
    loadMedia.execute()
  }

  // Handle folder change (defined before WebSocket hooks)
  const handleFolderChange = useCallback((folder: string | undefined) => {
    setSelectedFolder(folder)
    setFilters(prev => ({ ...prev, folder: folder || undefined }))
  }, [])

  // WebSocket subscriptions
  const { subscribeToMedia, unsubscribeFromMedia, onMediaCreated, onMediaUpdated, onMediaDeleted, onFolderCreated, onFolderUpdated, onFolderDeleted } = useWebSocket()

  // Subscribe to media updates on mount
  useEffect(() => {
    if (user && apiService) {
      subscribeToMedia()
      loadMedia.execute()
      loadStatistics.execute()
    }
    return () => {
      unsubscribeFromMedia()
    }
  }, [user, apiService, subscribeToMedia, unsubscribeFromMedia])

  // Listen to real-time media events
  useEffect(() => {
    const unsubscribeCreated = onMediaCreated((media: any) => {
      // Invalidate list cache when new media is created
      mediaCache.invalidateListCache()
      
      // The data IS the media object (not wrapped in data.media)
      if (media && media.media_id) {
        // Cache the new media URL immediately
        if (media.public_url) {
          mediaCache.set(media.media_id, media.public_url, media.is_public)
        }
        if (media.thumbnail_url) {
          mediaCache.set(`${media.media_id}_thumb`, media.thumbnail_url, media.is_public)
        }
        
        // Add to current list if it matches current filters
        setMediaFiles(prev => {
          // Check if media matches current filters
          const matchesFilters = 
            (!filters.folder || media.folder === filters.folder) &&
            (!filters.file_type || media.file_type === filters.file_type) &&
            (!filters.visibility || media.visibility === filters.visibility) &&
            (!filters.search || 
              media.original_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
              media.alt_text?.toLowerCase().includes(filters.search.toLowerCase()))
          
          if (matchesFilters && !prev.find(m => m.media_id === media.media_id)) {
            // Add to beginning of list
            return [media, ...prev]
          }
          return prev
        })
        
        // Update total count
        setTotal(prev => prev + 1)
      }
      
      // Refresh data to ensure consistency (use refreshMedia to bypass cache)
      setTimeout(() => {
        refreshMedia.execute()
        loadStatistics.execute()
      }, 300)
    })
    const unsubscribeUpdated = onMediaUpdated((updatedMedia: any) => {
      // The data IS the media object (not wrapped in data.media)
      if (updatedMedia && updatedMedia.media_id) {
        // Invalidate cache for updated media
        mediaCache.invalidate(updatedMedia.media_id)
        mediaCache.invalidate(`${updatedMedia.media_id}_thumb`)
        
        // Invalidate list cache
        mediaCache.invalidateListCache()
        
        // Update in the list immediately
        setMediaFiles(prev => 
          prev.map(m => m.media_id === updatedMedia.media_id ? updatedMedia : m)
        )
        
        // Update cache with new URLs
        if (updatedMedia.public_url) {
          mediaCache.set(updatedMedia.media_id, updatedMedia.public_url, updatedMedia.is_public)
        }
        if (updatedMedia.thumbnail_url) {
          mediaCache.set(`${updatedMedia.media_id}_thumb`, updatedMedia.thumbnail_url, updatedMedia.is_public)
        }
      }
      
      // Refresh data to ensure consistency (use refreshMedia to bypass cache)
      setTimeout(() => {
        refreshMedia.execute()
        loadStatistics.execute()
      }, 300)
    })
    const unsubscribeDeleted = onMediaDeleted((data: { media_id: string }) => {
      const deletedId = data.media_id
      
      // Invalidate cache for deleted media
      mediaCache.invalidate(deletedId)
      mediaCache.invalidate(`${deletedId}_thumb`)
      
      // Invalidate list cache
      mediaCache.invalidateListCache()
      
      // Remove from current list immediately (use functional update to ensure we get latest state)
      setMediaFiles(prev => {
        const filtered = prev.filter(m => m.media_id !== deletedId)
        return filtered
      })
      
      // Update total count
      setTotal(prev => Math.max(0, prev - 1))
      
      // Clear selection if deleted media was selected
      setSelectedMediaIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletedId)
        return newSet
      })
      
      // Close details panel if the deleted file is the one being viewed
      setSelectedMedia(currentMedia => {
        if (currentMedia && currentMedia.media_id === deletedId) {
          setIsDetailsOpen(false)
          return null
        }
        return currentMedia
      })
      
      // Refresh data to ensure consistency (use refreshMedia to bypass cache)
      setTimeout(() => {
        refreshMedia.execute()
        loadStatistics.execute()
      }, 300)
    })
    const unsubscribeFolderCreated = onFolderCreated(() => {
      setTimeout(() => {
        refreshMedia.execute()
        loadStatistics.execute()
      }, 300)
    })
    const unsubscribeFolderUpdated = onFolderUpdated((data: { old_name: string; new_name: string }) => {
      setTimeout(() => {
        refreshMedia.execute()
        loadStatistics.execute()
      }, 300)
      // Update selected folder if it was renamed
      if (selectedFolder === data.old_name) {
        handleFolderChange(data.new_name)
      }
    })
    const unsubscribeFolderDeleted = onFolderDeleted((data: { folder_name: string }) => {
      setTimeout(() => {
        refreshMedia.execute()
        loadStatistics.execute()
      }, 300)
      // Reset folder if deleted folder was selected
      if (selectedFolder === data.folder_name) {
        handleFolderChange(undefined)
      }
    })

    return () => {
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeDeleted()
      unsubscribeFolderCreated()
      unsubscribeFolderUpdated()
      unsubscribeFolderDeleted()
    }
  }, [onMediaCreated, onMediaUpdated, onMediaDeleted, onFolderCreated, onFolderUpdated, onFolderDeleted, selectedFolder, handleFolderChange, refreshMedia, loadStatistics])

  // Reload when filters/page change
  useEffect(() => {
    if (user && apiService) {
      loadMedia.execute()
    }
  }, [filters, page])

  // Close details panel if selected media is no longer in the list (was deleted)
  useEffect(() => {
    if (selectedMedia && mediaFiles.length > 0) {
      const stillExists = mediaFiles.some(m => m.media_id === selectedMedia.media_id)
      if (!stillExists) {
        setIsDetailsOpen(false)
        setSelectedMedia(null)
      }
    }
  }, [mediaFiles, selectedMedia])

  // Handle media selection from MediaPicker
  const handleMediaSelect = async (media: Media | string) => {
    // If it's a URL string, just show success
    if (typeof media === 'string') {
      showSuccess('URL selected')
      setIsMediaPickerOpen(false)
      return
    }

    // If it's a Media object, cache it and refresh the list
    if (typeof media === 'object') {
      // Cache the new media URL
      if (media.public_url) {
        mediaCache.set(media.media_id, media.public_url, media.is_public)
      }
      if (media.thumbnail_url) {
        mediaCache.set(`${media.media_id}_thumb`, media.thumbnail_url, media.is_public)
      }
    }
    
    showSuccess('File uploaded successfully')
    setIsMediaPickerOpen(false)
    // Use refreshMedia to bypass cache and get latest data
    setTimeout(() => {
      refreshMedia.execute()
      loadStatistics.execute()
    }, 300)
  }

  // Delete media
  const [mediaToDelete, setMediaToDelete] = useState<string | null>(null)
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([])
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  
  const deleteMedia = useApiCall(
    async () => {
      if (!mediaToDelete) throw new Error('No media to delete')
      // Always permanently delete (delete file from server)
      return await mediaService.deleteMedia(mediaToDelete, true)
    },
    {
      onSuccess: () => {
        const deletedId = mediaToDelete
        
        // Invalidate cache for deleted media
        if (deletedId) {
          mediaCache.invalidate(deletedId)
          mediaCache.invalidate(`${deletedId}_thumb`)
        }
        
        // Invalidate list cache
        mediaCache.invalidateListCache()
        
        // Remove from list immediately (before WebSocket event)
        setMediaFiles(prev => {
          const filtered = prev.filter(m => m.media_id !== deletedId)
          return filtered
        })
        setTotal(prev => Math.max(0, prev - 1))
        
        // Clear selection if deleted media was selected
        setSelectedMediaIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(deletedId || '')
          return newSet
        })
        
        showSuccess('File deleted successfully')
        // Close details panel immediately
        setIsDetailsOpen(false)
        setSelectedMedia(null)
        setMediaToDelete(null)
        setIsDeleteDialogOpen(false)
        
        // Refresh data after a short delay to ensure server has processed deletion (use refreshMedia to bypass cache)
        setTimeout(() => {
          refreshMedia.execute()
          loadStatistics.execute()
        }, 300)
      },
      showErrorToast: true,
    }
  )

  // Bulk delete media
  const bulkDeleteMedia = useApiCall(
    async () => {
      if (bulkDeleteIds.length === 0) throw new Error('No media selected for deletion')
      
      // Delete all selected media files (permanently delete from server)
      const deletePromises = bulkDeleteIds.map(id => mediaService.deleteMedia(id, true))
      await Promise.all(deletePromises)
      
      // Return proper API response format
      return {
        success: true,
        message: `${bulkDeleteIds.length} file(s) deleted successfully`,
        data: { deleted: bulkDeleteIds.length }
      }
    },
    {
      onSuccess: () => {
        const deletedIds = [...bulkDeleteIds]
        
        // Invalidate cache for all deleted media
        deletedIds.forEach(id => {
          mediaCache.invalidate(id)
          mediaCache.invalidate(`${id}_thumb`)
        })
        
        // Invalidate list cache
        mediaCache.invalidateListCache()
        
        // Remove from list immediately
        setMediaFiles(prev => {
          const filtered = prev.filter(m => !deletedIds.includes(m.media_id))
          return filtered
        })
        setTotal(prev => Math.max(0, prev - deletedIds.length))
        
        // Clear selections
        setSelectedMediaIds(new Set())
        
        // Close details panel if any of the deleted files was being viewed
        if (selectedMedia && deletedIds.includes(selectedMedia.media_id)) {
          setIsDetailsOpen(false)
          setSelectedMedia(null)
        }
        
        showSuccess(`${deletedIds.length} file(s) deleted successfully`)
        setBulkDeleteIds([])
        setIsBulkDeleteDialogOpen(false)
        
        // Refresh data after a short delay to ensure server has processed deletions
        setTimeout(() => {
          loadMedia.execute()
          loadStatistics.execute()
        }, 100)
      },
      showErrorToast: true,
    }
  )

  // Handle single media selection
  const toggleMediaSelection = (mediaId: string) => {
    setSelectedMediaIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(mediaId)) {
        newSet.delete(mediaId)
      } else {
        newSet.add(mediaId)
      }
      return newSet
    })
  }

  // Select all media on current page
  const selectAllMedia = () => {
    if (selectedMediaIds.size === mediaFiles.length) {
      setSelectedMediaIds(new Set())
    } else {
      setSelectedMediaIds(new Set(mediaFiles.map(m => m.media_id)))
    }
  }

  // Handle delete button click
  const handleDeleteClick = (mediaId: string) => {
    setMediaToDelete(mediaId)
    setIsDeleteDialogOpen(true)
  }

  // Handle bulk delete button click
  const handleBulkDeleteClick = () => {
    if (selectedMediaIds.size === 0) {
      showError('Please select files to delete')
      return
    }
    setBulkDeleteIds(Array.from(selectedMediaIds))
    setIsBulkDeleteDialogOpen(true)
  }

  // Update media visibility
  const [updatingVisibility, setUpdatingVisibility] = useState(false)
  const mediaToUpdateRef = useRef<{ id: string; visibility: 'public' | 'private' } | null>(null)
  
  const updateMediaVisibility = useApiCall(
    async () => {
      if (!mediaToUpdateRef.current || !mediaToUpdateRef.current.id) {
        throw new Error('No media to update')
      }
      const updateData = mediaToUpdateRef.current
      // API expects is_public, not visibility
      return await mediaService.updateMedia(updateData.id, { 
        is_public: updateData.visibility === 'public'
      } as any)
    },
    {
      onSuccess: (data) => {
        const updateData = mediaToUpdateRef.current
        if (!updateData) return
        
        // Invalidate cache when visibility changes (URL might change)
        if (selectedMedia) {
          mediaCache.invalidate(selectedMedia.media_id)
          mediaCache.invalidate(`${selectedMedia.media_id}_thumb`)
        }
        
        // Invalidate list cache
        mediaCache.invalidateListCache()
        
        showSuccess('Visibility updated successfully')
        
        // Update selected media state from response
        // API returns { media: Media } or just Media directly
        let updatedMedia: Media | null = null
        
        if (data && typeof data === 'object') {
          if ('media' in data) {
            updatedMedia = (data as { media: Media }).media
          } else if ('media_id' in data) {
            // Response is the media object directly
            updatedMedia = data as Media
          }
        }
        
        if (updatedMedia && selectedMedia && updatedMedia.media_id === selectedMedia.media_id) {
          setSelectedMedia(updatedMedia)
          
          // Update in list
          setMediaFiles(prev => 
            prev.map(m => m.media_id === updatedMedia!.media_id ? updatedMedia! : m)
          )
          
          // Update cache with new URLs
          if (updatedMedia.public_url) {
            mediaCache.set(updatedMedia.media_id, updatedMedia.public_url, updatedMedia.is_public || false)
          }
        } else if (selectedMedia && updateData) {
          // Fallback: update from updateData if response doesn't have media object
          const fallbackMedia = {
            ...selectedMedia,
            visibility: updateData.visibility,
            is_public: updateData.visibility === 'public',
          }
          setSelectedMedia(fallbackMedia)
          
          // Update in list
          setMediaFiles(prev => 
            prev.map(m => m.media_id === selectedMedia.media_id ? fallbackMedia : m)
          )
        }
        
        // Clear the ref
        mediaToUpdateRef.current = null
        
        // Refresh media list and statistics
        loadMedia.execute()
        loadStatistics.execute()
      },
      showErrorToast: true,
    }
  )

  // Handle visibility toggle
  const handleToggleVisibility = async () => {
    if (!selectedMedia) return
    const newVisibility = selectedMedia.is_public ? 'private' : 'public'
    setUpdatingVisibility(true)
    // Store update data in ref before calling execute
    mediaToUpdateRef.current = { 
      id: selectedMedia.media_id, 
      visibility: newVisibility 
    }
    try {
      await updateMediaVisibility.execute()
    } finally {
      setUpdatingVisibility(false)
    }
  }

  // Handle folder selection from FolderManager
  const handleFolderSelect = useCallback((folder: string) => {
    handleFolderChange(folder)
    setIsFolderManagerOpen(false)
    showSuccess(`Switched to folder: ${folder}`)
  }, [handleFolderChange, showSuccess])

  // Copy URL to clipboard
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
    showSuccess('URL copied to clipboard')
  }

  if (authLoading) {
    return (
      <MainLayout title="Media Library">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Media Library"
      description={`Manage your files and media assets (${total} files)`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadMedia.execute()
              loadStatistics.execute()
            }}
            disabled={loadMedia.loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadMedia.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsMediaPickerOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      }
    >
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Files</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  {statistics.total_files}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Storage Used</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-500" />
                  {formatBytes(statistics.total_size)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Public Files</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-500" />
                  {statistics.by_visibility?.public || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Private Files</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Lock className="h-5 w-5 text-orange-500" />
                  {statistics.by_visibility?.private || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* File Type Stats */}
        {statistics?.by_type && Object.keys(statistics.by_type).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Files by Type</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(statistics.by_type).map(([type, data]) => (
                  <div key={type} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    {getFileIcon(type)}
                    <span className="text-sm font-medium capitalize">{type}</span>
                    <span className="text-xs text-muted-foreground">
                      {data.count} ({formatBytes(data.size)})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        {filtersExpanded && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters({
                      search: '',
                      file_type: undefined,
                      visibility: undefined,
                      folder: undefined,
                      status: 'active',
                      is_trashed: false,
                    })
                    handleFolderChange(undefined)
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
              </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={filters.search || ''}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">File Type</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.file_type || ''}
                    onChange={(e) => setFilters({ ...filters, file_type: e.target.value as any || undefined })}
                  >
                    <option value="">All Types</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                    <option value="audio">Audio</option>
                    <option value="document">Documents</option>
                    <option value="archive">Archives</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Visibility</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.visibility || ''}
                    onChange={(e) => setFilters({ ...filters, visibility: e.target.value as any || undefined })}
                  >
                    <option value="">All</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="authenticated">Authenticated</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Folder</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={filters.folder || ''}
                        onChange={(e) => {
                          const folder = e.target.value || undefined
                          handleFolderChange(folder)
                        }}
                      >
                        <option value="">All Folders</option>
                        {folders.map((folder) => (
                          <option key={folder} value={folder}>
                            {folder}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsFolderManagerOpen(true)}
                        title="Manage Folders"
                      >
                        <Folder className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.is_trashed ? 'trashed' : 'active'}
                    onChange={(e) => setFilters({ 
                      ...filters, 
                      is_trashed: e.target.value === 'trashed',
                      status: e.target.value === 'trashed' ? undefined : 'active',
                    })}
                  >
                    <option value="active">Active</option>
                    <option value="trashed">Trashed</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Media Grid/List */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle>Files</CardTitle>
                  {filters.folder && (
                    <div className="flex items-center gap-1 mt-1">
                      <Folder className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{filters.folder}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 ml-1"
                        onClick={() => handleFolderChange(undefined)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {selectedMediaIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedMediaIds.size} selected
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDeleteClick}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMediaIds(new Set())}
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {mediaFiles.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllMedia}
                  >
                    {selectedMediaIds.size === mediaFiles.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
                <CardDescription>
                  Showing {mediaFiles.length} of {total} files
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loadMedia.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No files found</p>
                <p className="text-sm text-muted-foreground mt-1">Upload files to get started</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {mediaFiles.map((media) => {
                  const isSelected = selectedMediaIds.has(media.media_id)
                  return (
                  <div
                    key={media.media_id}
                    className={`group relative bg-muted/30 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={(e) => {
                      // Don't open details if clicking on checkbox
                      if ((e.target as HTMLElement).closest('.media-checkbox')) {
                        e.stopPropagation()
                        toggleMediaSelection(media.media_id)
                        return
                      }
                      setSelectedMedia(media)
                      setIsDetailsOpen(true)
                    }}
                  >
                    {/* Selection Checkbox */}
                    <div 
                      className="absolute top-2 left-2 z-10 media-checkbox"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMediaSelection(media.media_id)
                      }}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-primary border-primary' 
                          : 'bg-background border-border hover:border-primary'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                    {/* Thumbnail */}
                    <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
                      {media.file_type === 'image' && (media.public_url || media.url) ? (
                        <CachedImage
                          src={media.public_url || media.url || null}
                          alt={media.alt_text || media.original_name}
                          fill
                          className="object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="p-4">
                          {getFileIcon(media.file_type)}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-2">
                      <p className="text-xs font-medium truncate" title={media.original_name}>
                        {media.original_name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(media.file_size || (media as any).size || 0)}
                        </span>
                        <div className="flex items-center gap-1">
                          {media.folder && (
                            <span className="text-xs text-muted-foreground" title={`Folder: ${media.folder}`}>
                              <Folder className="h-3 w-3" />
                            </span>
                          )}
                          {media.is_public ? (
                            <span title="Public">
                              <Globe className="h-3 w-3 text-green-500" />
                            </span>
                          ) : (
                            <span title="Private">
                              <Lock className="h-3 w-3 text-orange-500" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={(e) => {
                        e.stopPropagation()
                        setSelectedMedia(media)
                        setIsDetailsOpen(true)
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {getMediaDisplayUrl(media) && (
                    <Button
                      size="sm"
                          variant="secondary" 
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(getMediaDisplayUrl(media)!)
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {mediaFiles.map((media) => {
                  const isSelected = selectedMediaIds.has(media.media_id)
                  return (
                  <div
                    key={media.media_id}
                    className={`flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer ${
                      isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={(e) => {
                      // Don't open details if clicking on checkbox
                      if ((e.target as HTMLElement).closest('.media-checkbox')) {
                        e.stopPropagation()
                        toggleMediaSelection(media.media_id)
                        return
                      }
                      setSelectedMedia(media)
                      setIsDetailsOpen(true)
                    }}
                  >
                    {/* Selection Checkbox */}
                    <div 
                      className="flex-shrink-0 media-checkbox"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMediaSelection(media.media_id)
                      }}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-primary border-primary' 
                          : 'bg-background border-border hover:border-primary'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded bg-muted">
                      {getFileIcon(media.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{media.original_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(media.file_size || (media as any).size || 0)} • {formatDate(media.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {media.is_public ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded">
                          <Globe className="h-3 w-3" /> Public
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/20 px-2 py-1 rounded">
                          <Lock className="h-3 w-3" /> Private
                        </span>
                      )}
                      {getMediaDisplayUrl(media) && (
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(getMediaDisplayUrl(media)!)
                        }}>
                          <Copy className="h-4 w-4" />
                    </Button>
                      )}
                    </div>
                  </div>
                )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Media Picker for Upload */}
      <MediaPicker
        open={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        title="Upload Media"
        description="Upload new files, select from your library, or use a URL"
        allowUrl={true}
        allowUpload={true}
        multiple={false}
      />

      {/* Folder Manager */}
      <FolderManager
        open={isFolderManagerOpen}
        onClose={handleFolderManagerClose}
        onSelectFolder={handleFolderSelect}
        selectedFolder={selectedFolder}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setMediaToDelete(null)
        }}
        onConfirm={async () => {
          if (mediaToDelete) {
            await deleteMedia.execute()
          }
        }}
        title="Delete File"
        description={`Are you sure you want to delete "${selectedMedia?.original_name || 'this file'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        successMessage="File deleted successfully!"
        errorMessage="Failed to delete file. Please try again."
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isBulkDeleteDialogOpen}
        onClose={() => {
          setIsBulkDeleteDialogOpen(false)
          setBulkDeleteIds([])
        }}
        onConfirm={async () => {
          await bulkDeleteMedia.execute()
        }}
        title="Delete Files"
        description={`Are you sure you want to delete ${bulkDeleteIds.length} file(s)? This action cannot be undone.`}
        confirmText={`Delete ${bulkDeleteIds.length} file(s)`}
        cancelText="Cancel"
        variant="destructive"
        successMessage={`${bulkDeleteIds.length} file(s) deleted successfully!`}
        errorMessage="Failed to delete files. Please try again."
      />

      {/* Media Details Panel */}
      {isDetailsOpen && selectedMedia && (
        <SidePanel
          open={isDetailsOpen}
          title="File Details"
          description={selectedMedia.original_name}
          width="lg"
          onClose={() => {
            setIsDetailsOpen(false)
            setSelectedMedia(null)
          }}
          // Close panel if selected media is no longer in the list (was deleted)
          key={selectedMedia.media_id}
          actions={
            <div className="flex gap-2">
              {getMediaDisplayUrl(selectedMedia) && (
                <Button variant="outline" size="sm" onClick={() => window.open(getMediaDisplayUrl(selectedMedia)!, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </Button>
              )}
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleDeleteClick(selectedMedia.media_id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          }
        >
          <div className="space-y-6 pt-4">
            {/* Preview */}
            {selectedMedia.file_type === 'image' && getMediaDisplayUrl(selectedMedia) && (
              <div className="rounded-lg overflow-hidden bg-muted relative aspect-video">
                <CachedImage
                  src={getMediaDisplayUrl(selectedMedia)}
                  alt={selectedMedia.alt_text || selectedMedia.original_name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
            )}

            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  File Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">File Name</p>
                    <p className="text-sm font-medium">{selectedMedia.original_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">File Type</p>
                    <p className="text-sm font-medium capitalize">{selectedMedia.file_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Size</p>
                    <p className="text-sm font-medium">{formatBytes(selectedMedia.file_size || (selectedMedia as any).size || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">MIME Type</p>
                    <p className="text-sm font-medium">{selectedMedia.mime_type}</p>
                  </div>
                  {selectedMedia.width && selectedMedia.height && (
                    <div>
                      <p className="text-xs text-muted-foreground">Dimensions</p>
                      <p className="text-sm font-medium">{selectedMedia.width} x {selectedMedia.height}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Visibility</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium flex items-center gap-1">
                        {selectedMedia.is_public ? (
                          <><Globe className="h-3 w-3 text-green-500" /> Public</>
                        ) : (
                          <><Lock className="h-3 w-3 text-orange-500" /> Private</>
                        )}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleToggleVisibility}
                        disabled={updatingVisibility}
                        className="ml-auto"
                      >
                        {updatingVisibility ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : selectedMedia.is_public ? (
                          <>
                            <Lock className="h-3 w-3 mr-1" />
                            Make Private
                          </>
                        ) : (
                          <>
                            <Globe className="h-3 w-3 mr-1" />
                            Make Public
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {selectedMedia.folder && (
                    <div>
                      <p className="text-xs text-muted-foreground">Folder</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Folder className="h-3 w-3" /> {selectedMedia.folder}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* URLs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  URLs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getMediaDisplayUrl(selectedMedia) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {selectedMedia.is_public ? 'Public URL' : 'Access URL'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={getMediaDisplayUrl(selectedMedia)!}
                        readOnly
                        className="text-xs font-mono"
                      />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(getMediaDisplayUrl(selectedMedia)!)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {selectedMedia.storage_path && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Storage Path</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={selectedMedia.storage_path}
                        readOnly
                        className="text-xs font-mono"
                      />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(selectedMedia.storage_path)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {selectedMedia.access_key && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Access Key</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={selectedMedia.access_key}
                        readOnly
                        className="text-xs font-mono"
                      />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(selectedMedia.access_key!)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                    </CardContent>
                  </Card>

            {/* Metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">{formatDateTime(selectedMedia.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Modified</p>
                    <p className="text-sm font-medium">{formatDateTime(selectedMedia.last_updated)}</p>
                  </div>
                  {selectedMedia.last_accessed && (
                    <div>
                      <p className="text-xs text-muted-foreground">Last Accessed</p>
                      <p className="text-sm font-medium">{formatDateTime(selectedMedia.last_accessed)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Storage Provider</p>
                    <p className="text-sm font-medium capitalize">{selectedMedia.storage_provider}</p>
                  </div>
                </div>
                {selectedMedia.tags && selectedMedia.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedMedia.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-muted px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedMedia.checksum_md5 && (
                  <div>
                    <p className="text-xs text-muted-foreground">MD5 Checksum</p>
                    <p className="text-xs font-mono text-muted-foreground">{selectedMedia.checksum_md5}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Owner */}
            {selectedMedia.user && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Owner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    {selectedMedia.user.profile_picture_url ? (
                      <img
                        src={selectedMedia.user.profile_picture_url}
                        alt={selectedMedia.user.first_name || 'User'}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
              </div>
            )}
                    <div>
                      <p className="text-sm font-medium">
                        {selectedMedia.user.first_name} {selectedMedia.user.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedMedia.user.email}</p>
                    </div>
                  </div>
          </CardContent>
        </Card>
            )}
      </div>
        </SidePanel>
      )}
    </MainLayout>
  )
}
