"use client"

import { useState, useEffect, useCallback } from "react"
import { SidePanel } from "@components/ui/side-panel"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { useToast } from "@hooks/useToast"
import { useApiCall } from "@hooks/useApiCall"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { mediaService } from "@services/media.service"
import {
  Folder, FolderOpen, Plus, Edit, Trash2, Search, Loader2, Check, X,
  FileText, Image, Video, Music, Archive, HardDrive, RefreshCw
} from "lucide-react"

interface FolderInfo {
  name: string
  path: string
  file_count: number
  total_size: number
  by_type?: Record<string, { count: number; size: number }>
}

interface FolderManagerProps {
  open: boolean
  onClose: () => void
  onSelectFolder?: (folder: string) => void
  selectedFolder?: string
}

export function FolderManager({
  open,
  onClose,
  onSelectFolder,
  selectedFolder,
}: FolderManagerProps) {
  const { showSuccess, showError } = useToast()
  const { apiService } = useAuth()

  // Set auth API
  useEffect(() => {
    if (apiService) {
      mediaService.setAuthApi(apiService)
    }
  }, [apiService])
  const [folders, setFolders] = useState<FolderInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null)
  const [showCreateInput, setShowCreateInput] = useState(false)

  // Load folders
  const loadFolders = useApiCall(
    async () => await mediaService.getFolders(),
    {
      onSuccess: (data: any) => {
        if (data?.folders) {
          setFolders(data.folders)
        }
      },
    }
  )

  // Create folder
  const createFolder = useApiCall(
    async () => {
      if (!newFolderName.trim()) throw new Error('Folder name is required')
      return await mediaService.createFolder(newFolderName.trim())
    },
    {
      onSuccess: (data: any) => {
        showSuccess('Folder created successfully')
        const folderName = newFolderName.trim()
        setNewFolderName('')
        setShowCreateInput(false)
        
        // Optimistic update - add folder immediately
        setFolders(prev => {
          const exists = prev.some(f => f.name === folderName)
          if (exists) return prev
          const newFolder = {
            name: folderName,
            path: folderName,
            file_count: 0,
            total_size: 0,
            by_type: {},
            ...(data?.folder || {}),
          }
          const updated = [...prev, newFolder]
          return updated.sort((a, b) => a.name.localeCompare(b.name))
        })
      },
      showErrorToast: true,
    }
  )

  // Update folder
  const [folderToUpdate, setFolderToUpdate] = useState<{ oldName: string; newName: string } | null>(null)
  const updateFolder = useApiCall(
    async () => {
      if (!folderToUpdate) throw new Error('No folder to update')
      if (!folderToUpdate.newName.trim()) throw new Error('Folder name is required')
      return await mediaService.updateFolder(folderToUpdate.oldName, folderToUpdate.newName.trim())
    },
    {
      onSuccess: () => {
        showSuccess('Folder renamed successfully')
        const oldName = folderToUpdate?.oldName
        const newName = folderToUpdate?.newName?.trim()
        
        // Optimistic update - rename folder immediately
        if (oldName && newName) {
          setFolders(prev => {
            const updated = prev.map(f => 
              f.name === oldName 
                ? { ...f, name: newName, path: newName }
                : f
            )
            return updated.sort((a, b) => a.name.localeCompare(b.name))
          })
          
          // Update selected folder if it was renamed
          if (onSelectFolder && selectedFolder === oldName) {
            onSelectFolder(newName)
          }
        }
        
        setEditingFolder(null)
        setFolderToUpdate(null)
      },
      showErrorToast: true,
    }
  )

  // Delete folder
  const deleteFolder = useApiCall(
    async () => {
      if (!folderToDelete) throw new Error('No folder selected for deletion')
      return await mediaService.deleteFolder(folderToDelete)
    },
    {
      onSuccess: () => {
        showSuccess('Folder deleted successfully')
        const deletedFolder = folderToDelete
        
        // Optimistic update - remove folder immediately
        setFolders(prev => prev.filter(f => f.name !== deletedFolder))
        
        // Reset selected folder if it was deleted
        if (onSelectFolder && selectedFolder === deletedFolder) {
          onSelectFolder('uploads')
        }
        
        setFolderToDelete(null)
      },
      showErrorToast: true,
    }
  )

  // WebSocket subscriptions for real-time updates
  const { onFolderCreated, onFolderUpdated, onFolderDeleted, subscribeToMedia, unsubscribeFromMedia } = useWebSocket()

  // Subscribe to media updates when panel is open
  useEffect(() => {
    if (open) {
      subscribeToMedia()
    }
    return () => {
      if (open) {
        unsubscribeFromMedia()
      }
    }
  }, [open, subscribeToMedia, unsubscribeFromMedia])

  // Listen for real-time folder events
  useEffect(() => {
    if (!open) return

    // When a folder is created, add it to the list instantly
    const unsubscribeCreated = onFolderCreated((folder: any) => {
      if (folder && folder.name) {
        setFolders(prev => {
          // Check if folder already exists
          const exists = prev.some(f => f.name === folder.name)
          if (exists) return prev
          // Add new folder and sort
          const updated = [...prev, {
            name: folder.name,
            path: folder.path || folder.name,
            file_count: folder.file_count || 0,
            total_size: folder.total_size || 0,
            by_type: folder.by_type || {},
          }]
          return updated.sort((a, b) => a.name.localeCompare(b.name))
        })
      }
    })

    // When a folder is updated/renamed, update it in the list instantly
    const unsubscribeUpdated = onFolderUpdated((data: { old_name: string; new_name: string }) => {
      if (data.old_name && data.new_name) {
        setFolders(prev => {
          const updated = prev.map(f => 
            f.name === data.old_name 
              ? { ...f, name: data.new_name, path: data.new_name }
              : f
          )
          return updated.sort((a, b) => a.name.localeCompare(b.name))
        })
        // Update selected folder if it was renamed
        if (selectedFolder === data.old_name && onSelectFolder) {
          onSelectFolder(data.new_name)
        }
      }
    })

    // When a folder is deleted, remove it from the list instantly
    const unsubscribeDeleted = onFolderDeleted((data: { folder_name: string }) => {
      if (data.folder_name) {
        setFolders(prev => prev.filter(f => f.name !== data.folder_name))
        // Reset selected folder if it was deleted
        if (selectedFolder === data.folder_name && onSelectFolder) {
          onSelectFolder('uploads')
        }
      }
    })

    return () => {
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeDeleted()
    }
  }, [open, onFolderCreated, onFolderUpdated, onFolderDeleted, selectedFolder, onSelectFolder])

  // Load folders when panel opens
  useEffect(() => {
    if (open) {
      loadFolders.execute()
    }
  }, [open])

  // Filter folders by search
  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Format file size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get folder icon
  const getFolderIcon = (folder: FolderInfo) => {
    if (folder.by_type) {
      if (folder.by_type.image) return <Image className="h-4 w-4 text-green-500" />
      if (folder.by_type.video) return <Video className="h-4 w-4 text-purple-500" />
      if (folder.by_type.audio) return <Music className="h-4 w-4 text-pink-500" />
      if (folder.by_type.document) return <FileText className="h-4 w-4 text-blue-500" />
      if (folder.by_type.archive) return <Archive className="h-4 w-4 text-orange-500" />
    }
    return <Folder className="h-4 w-4 text-muted-foreground" />
  }

  const handleEdit = (folderName: string) => {
    setEditingFolder(folderName)
    setNewFolderName(folderName)
  }

  const handleSaveEdit = () => {
    if (editingFolder && newFolderName.trim() && newFolderName.trim() !== editingFolder) {
      setFolderToUpdate({ oldName: editingFolder, newName: newFolderName.trim() })
      updateFolder.execute()
    } else {
      setEditingFolder(null)
      setNewFolderName('')
    }
  }

  const handleCancelEdit = () => {
    setEditingFolder(null)
    setNewFolderName('')
  }

  const handleCreate = () => {
    if (newFolderName.trim()) {
      createFolder.execute()
    }
  }

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        title="Manage Folders"
        description="Organize your media files into folders"
        width="md"
      >
        <div className="space-y-4">
          {/* Search and Refresh */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadFolders.execute()}
              disabled={loadFolders.loading}
              title="Refresh folders"
            >
              <RefreshCw className={`h-4 w-4 ${loadFolders.loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Create New Folder */}
          {showCreateInput ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <Input
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreate()
                      } else if (e.key === 'Escape') {
                        setShowCreateInput(false)
                        setNewFolderName('')
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={!newFolderName.trim() || createFolder.loading}
                  >
                    {createFolder.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowCreateInput(false)
                      setNewFolderName('')
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed hover:border-primary hover:bg-primary/5"
              onClick={() => {
                setShowCreateInput(true)
                setNewFolderName('')
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Folder
            </Button>
          )}

          {/* Folders List */}
          <div className="space-y-2">
            {loadFolders.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No folders found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? 'Try a different search' : 'Create your first folder'}
                </p>
              </div>
            ) : (
              filteredFolders.map((folder) => {
                const isEditing = editingFolder === folder.name
                const isSelected = selectedFolder === folder.name

                return (
                  <Card
                    key={folder.name}
                    className={`transition-all hover:shadow-md ${
                      isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <CardContent className="pt-4 pb-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                handleCancelEdit()
                              }
                            }}
                            className="flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={!newFolderName.trim() || updateFolder.loading}
                          >
                            {updateFolder.loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Folder Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                {getFolderIcon(folder)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-base truncate">{folder.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {folder.file_count} {folder.file_count === 1 ? 'file' : 'files'} • {formatBytes(folder.total_size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {onSelectFolder && (
                                <Button
                                  size="sm"
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={() => onSelectFolder(folder.name)}
                                  className="h-8"
                                >
                                  {isSelected ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 mr-1.5" />
                                      Selected
                                    </>
                                  ) : (
                                    'Select'
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(folder.name)}
                                className="h-8 w-8 p-0"
                                title="Rename folder"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setFolderToDelete(folder.name)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title="Delete folder"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Folder Stats by Type */}
                          {folder.by_type && Object.keys(folder.by_type).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-border/50">
                              {Object.entries(folder.by_type).map(([type, data]) => (
                                <div
                                  key={type}
                                  className="flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted rounded-md px-2.5 py-1.5 transition-colors"
                                >
                                  {type === 'image' && <Image className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
                                  {type === 'video' && <Video className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
                                  {type === 'audio' && <Music className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />}
                                  {type === 'document' && <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                                  {type === 'archive' && <Archive className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />}
                                  <span className="font-medium capitalize text-foreground">{type}</span>
                                  <span className="text-muted-foreground font-normal">
                                    {data.count}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </SidePanel>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={async () => {
          await deleteFolder.execute()
        }}
        title="Delete Folder"
        description={`Are you sure you want to delete the folder "${folderToDelete}"? This will not delete the files inside, but will remove the folder organization.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        successMessage="Folder deleted successfully!"
        errorMessage="Failed to delete folder. Please try again."
      />
    </>
  )
}

