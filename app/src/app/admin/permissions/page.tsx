"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useApiCall } from "@hooks/useApiCall"
import { permissionService } from "@services/permission.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { Shield, Plus, Search, RefreshCw, Trash2, BarChart3, Settings, Tag } from "lucide-react"
import { PermissionsAnalyticsContent, type PermissionsStatistics } from "@components/analytics/PermissionsAnalyticsContent"

import type { Permission } from "@models/permission.model"

export default function PermissionsPage() {
  return (
    <PageGuard requireAnyPermission={["view_permission", "manage_permission"]}>
      <PermissionsContent />
    </PageGuard>
  )
}

function PermissionsContent() {
  const router = useRouter()
  const { user, tokens, loading: authLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Permission | null>(null)
  const [name, setName] = useState("")
  const [codename, setCodename] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [permissionToDelete, setPermissionToDelete] = useState<{ id: string; name: string } | null>(null)
  const [permissionsStats, setPermissionsStats] = useState<PermissionsStatistics | null>(null)

  // Memoize the API call function to prevent infinite loops
  const fetchPermissions = useCallback(async () => {
    // Ensure authenticated API is set up before making the call
    if (tokens) {
      const authHeaders: Record<string, string> = {};
      if (tokens.session_token) {
        authHeaders["X-Session-Token"] = tokens.session_token;
      } else if (tokens.access_token && tokens.token_type) {
        authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
      }
      
      if (Object.keys(authHeaders).length > 0) {
        const authenticatedApi = createPublicApiService(authHeaders);
        permissionService.setAuthApi(authenticatedApi);
      }
    }
    
    const response = await permissionService.getPermissions(false);
    // Service already extracts permissions from nested structure and returns ApiResponse<Permission[]>
    return response;
  }, [tokens]);

  const loadPermissions = useApiCall<Permission[]>(
    fetchPermissions,
    {
      onSuccess: (permissionsData) => {
        if (Array.isArray(permissionsData)) {
          setPermissions(permissionsData);
        }
      },
      showErrorToast: true,
    }
  )

  // Refresh function that clears cache and reloads fresh data
  const refreshPermissions = useApiCall<Permission[]>(
    async () => {
      // Ensure authenticated API is set up before making the call
      if (tokens) {
        const authHeaders: Record<string, string> = {};
        if (tokens.session_token) {
          authHeaders["X-Session-Token"] = tokens.session_token;
        } else if (tokens.access_token && tokens.token_type) {
          authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
        }
        
        if (Object.keys(authHeaders).length > 0) {
          const authenticatedApi = createPublicApiService(authHeaders);
          permissionService.setAuthApi(authenticatedApi);
        }
      }
      
      const response = await permissionService.getPermissions(true); // Force refresh (clears cache)
      // Service already extracts permissions from nested structure and returns ApiResponse<Permission[]>
      return response;
    },
    {
      onSuccess: (permissionsData) => {
        if (Array.isArray(permissionsData)) {
          setPermissions(permissionsData);
        }
      },
      showErrorToast: true,
      successMessage: "Permissions refreshed successfully",
      showSuccessToast: true,
    }
  )

  const savePermission = useApiCall<Permission>(
    async () => {
      // Ensure authenticated API is set up before making the call
      if (tokens) {
        const authHeaders: Record<string, string> = {};
        if (tokens.session_token) {
          authHeaders["X-Session-Token"] = tokens.session_token;
        } else if (tokens.access_token && tokens.token_type) {
          authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
        }
        
        if (Object.keys(authHeaders).length > 0) {
          const authenticatedApi = createPublicApiService(authHeaders);
          permissionService.setAuthApi(authenticatedApi);
        }
      }
      
      if (editing) {
        return permissionService.updatePermission(editing.permission_id, {
          name,
          codename,
          description,
          category,
        })
      }
      return permissionService.createPermission({
        name,
        codename,
        description,
        category,
      })
    },
    {
      onSuccess: () => {
        setPanelOpen(false)
        setEditing(null)
        setName("")
        setCodename("")
        setCategory("")
        setDescription("")
        // Refresh to get latest data from API (cache already cleared by service)
        refreshPermissions.execute()
      },
      successMessage: "Permission saved successfully",
      showSuccessToast: true,
    }
  )

  const handleDeletePermission = async () => {
    if (!permissionToDelete) return

    // Ensure authenticated API is set up before making the call
    if (tokens) {
      const authHeaders: Record<string, string> = {};
      if (tokens.session_token) {
        authHeaders["X-Session-Token"] = tokens.session_token;
      } else if (tokens.access_token && tokens.token_type) {
        authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
      }
      
      if (Object.keys(authHeaders).length > 0) {
        const authenticatedApi = createPublicApiService(authHeaders);
        permissionService.setAuthApi(authenticatedApi);
      }
    }
    
    const response = await permissionService.deletePermission(permissionToDelete.id);
    if (response?.success) {
      // Refresh to get latest data from API (cache already cleared by service)
      await refreshPermissions.execute()
    } else {
      throw new Error(response?.message || "Failed to delete permission");
    }
  }

  const loadPermissionsStats = useApiCall<{ statistics: PermissionsStatistics }>(
    async () => {
      if (!tokens) {
        throw new Error("Authentication required")
      }

      const authHeaders: Record<string, string> = {}
      if (tokens.session_token) {
        authHeaders["X-Session-Token"] = tokens.session_token
      } else if (tokens.access_token && tokens.token_type) {
        authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`
      }

      if (Object.keys(authHeaders).length > 0) {
        const authenticatedApi = createPublicApiService(authHeaders)
        permissionService.setAuthApi(authenticatedApi)
      }

      return await permissionService.getPermissionsStatistics()
    },
    {
      onSuccess: (data) => {
        if (data && typeof data === 'object' && 'statistics' in data) {
          setPermissionsStats((data as { statistics: PermissionsStatistics }).statistics)
        }
      },
      showErrorToast: true,
    }
  )

  const refreshPermissionsStats = useApiCall<{ statistics: PermissionsStatistics }>(
    async () => {
      if (!tokens) {
        throw new Error("Authentication required")
      }

      const authHeaders: Record<string, string> = {}
      if (tokens.session_token) {
        authHeaders["X-Session-Token"] = tokens.session_token
      } else if (tokens.access_token && tokens.token_type) {
        authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`
      }

      if (Object.keys(authHeaders).length > 0) {
        const authenticatedApi = createPublicApiService(authHeaders)
        permissionService.setAuthApi(authenticatedApi)
      }

      return await permissionService.getPermissionsStatistics(true)
    },
    {
      onSuccess: (data) => {
        if (data && typeof data === 'object' && 'statistics' in data) {
          setPermissionsStats((data as { statistics: PermissionsStatistics }).statistics)
        }
      },
      showErrorToast: true,
      successMessage: "Statistics refreshed successfully",
      showSuccessToast: true,
    }
  )

  useEffect(() => {
    if (analyticsOpen && tokens && !permissionsStats) {
      void loadPermissionsStats.execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsOpen])

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) return;
    
    if (user && tokens) {
      void loadPermissions.execute()
    } else if (!user) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tokens, authLoading, router])

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <MainLayout title="Permissions">
        <div className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  if (!user) {
    return null
  }

  return (
    <MainLayout
      title="Permissions"
      description="Manage system permissions and access controls"
      actions={
        <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setAnalyticsOpen(true)}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => refreshPermissions.execute()}
              disabled={refreshPermissions.loading}
              loading={refreshPermissions.loading}
              loadingText="Refreshing..."
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                setEditing(null)
                setName("")
                setCodename("")
                setCategory("")
                setDescription("")
                setPanelOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add Permission
            </Button>
        </div>
      }
    >
      <div className="container mx-auto px-4 py-8">

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search permissions by name, code, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Permissions List */}
        {permissions.length === 0 && !loadPermissions.loading && !refreshPermissions.loading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">No permissions found</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first permission to get started</p>
              <Button
                className="gap-2"
                onClick={() => {
                  setEditing(null)
                  setName("")
                  setCodename("")
                  setCategory("")
                  setDescription("")
                  setPanelOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Create Permission
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {permissions
              .filter((permission) =>
                searchQuery
                  ? permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    permission.codename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (permission.category && permission.category.toLowerCase().includes(searchQuery.toLowerCase()))
                  : true
              )
              .map((permission) => (
            <Card key={permission.permission_id} className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{permission.name}</CardTitle>
                      <CardDescription className="text-xs font-mono">{permission.codename}</CardDescription>
                    </div>
                  </div>
                  {permission.category && (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary capitalize flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {permission.category}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">{permission.description || "No description provided"}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    Permission
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        setPermissionToDelete({ id: permission.permission_id, name: permission.name })
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setEditing(permission)
                        setName(permission.name)
                        setCodename(permission.codename)
                        setCategory(permission.category || "")
                        setDescription(permission.description || "")
                        setPanelOpen(true)
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Manage
                  </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}

        <SidePanel
          open={panelOpen}
          onClose={() => {
            if (!savePermission.loading) {
              setPanelOpen(false)
              setEditing(null)
              setName("")
              setCodename("")
              setCategory("")
              setDescription("")
            }
          }}
          title={editing ? "Edit Permission" : "Add Permission"}
          description="Define permission name, code and category"
          width="md"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void savePermission.execute()
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Permission Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="View Dashboard"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Codename</label>
              <Input
                value={codename}
                onChange={(e) => setCodename(e.target.value)}
                placeholder="view_dashboard"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="dashboard"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Allow viewing the dashboard"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!savePermission.loading) {
                    setPanelOpen(false)
                    setEditing(null)
                    setName("")
                    setCodename("")
                    setCategory("")
                    setDescription("")
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={savePermission.loading}
                loadingText="Saving..."
                disabled={savePermission.loading || !name || !codename}
              >
                Save
              </Button>
            </div>
          </form>
        </SidePanel>

        {/* Analytics Sidebar */}
        <SidePanel
          open={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
          title="Permissions Analytics"
          description="Statistics and insights about system permissions"
          width="lg"
          actions={
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => refreshPermissionsStats.execute()}
              disabled={refreshPermissionsStats.loading}
              loading={refreshPermissionsStats.loading}
              loadingText="Refreshing..."
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          }
        >
          {loadPermissionsStats.loading && !permissionsStats ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading statistics...</div>
            </div>
          ) : permissionsStats ? (
            <PermissionsAnalyticsContent stats={permissionsStats} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">No statistics available</p>
                <Button onClick={() => loadPermissionsStats.execute()}>Load Statistics</Button>
              </CardContent>
            </Card>
          )}
        </SidePanel>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false)
            setPermissionToDelete(null)
          }}
          onConfirm={handleDeletePermission}
          title={permissionToDelete ? `Delete "${permissionToDelete.name}"?` : "Delete Permission?"}
          description={`Are you sure you want to delete this permission? This action cannot be undone and will remove all associated data.`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          variant="destructive"
          successMessage={permissionToDelete ? `"${permissionToDelete.name}" has been deleted successfully!` : "Permission deleted successfully!"}
          errorMessage="Failed to delete permission. Please try again."
          autoCloseOnSuccess={true}
          autoCloseDelay={2000}
        />
      </div>
    </MainLayout>
  )
}