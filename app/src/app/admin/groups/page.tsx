"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useApiCall } from "@hooks/useApiCall"
import { useToast } from "@hooks/useToast"
import { permissionService } from "@services/permission.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { Shield, Plus, Search, Users, Settings, RefreshCw, Trash2, BarChart3, CheckCircle2, XCircle, Power } from "lucide-react"
import { Switch } from "@components/ui/switch"
import { GroupsAnalyticsContent, type GroupsStatistics } from "@components/analytics/GroupsAnalyticsContent"

import type { Group } from "@models/user.model"

export default function GroupsPage() {
  return (
    <PageGuard requireAnyPermission={["view_group", "manage_group"]}>
      <GroupsContent />
    </PageGuard>
  )
}

function GroupsContent() {
  const router = useRouter()
  const { user, tokens, loading: authLoading } = useAuth()
  const { showError } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [groups, setGroups] = useState<Group[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null)
  const [groupsStats, setGroupsStats] = useState<GroupsStatistics | null>(null)

  // Memoize the API call function to prevent infinite loops
  const fetchGroups = useCallback(async () => {
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
    
    const response = await permissionService.getGroups(false);
    // Service already extracts groups from nested structure and returns ApiResponse<Group[]>
    return response;
  }, [tokens]);

  const loadGroups = useApiCall<Group[]>(
    fetchGroups,
    {
      onSuccess: (groupsData) => {
        if (Array.isArray(groupsData)) {
          setGroups(groupsData);
        }
      },
      showErrorToast: true,
    }
  )

  // Refresh function that clears cache and reloads fresh data
  const refreshGroups = useApiCall<Group[]>(
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
      
      const response = await permissionService.getGroups(true); // Force refresh (clears cache)
      // Service already extracts groups from nested structure and returns ApiResponse<Group[]>
      return response;
    },
    {
      onSuccess: (groupsData) => {
        if (Array.isArray(groupsData)) {
          setGroups(groupsData);
        }
      },
      showErrorToast: true,
      successMessage: "Groups refreshed successfully",
      showSuccessToast: true,
    }
  )

  const saveGroup = useApiCall(
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
      
      if (editingGroup) {
        return permissionService.updateGroup(editingGroup.group_id, {
          name,
          codename: code,
          description,
          is_active: isActive,
        })
      }
      return permissionService.createGroup({
        name,
        codename: code,
        description,
        is_active: isActive,
      })
    },
    {
      onSuccess: () => {
        setPanelOpen(false)
        setEditingGroup(null)
        setName("")
        setCode("")
        setDescription("")
        setIsActive(true)
        // Refresh to get latest data from API (cache already cleared by service)
        refreshGroups.execute()
      },
      successMessage: "Group saved successfully",
      showSuccessToast: true,
    }
  )

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return

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
    
    const response = await permissionService.deleteGroup(groupToDelete.id);
    if (response?.success) {
      // Refresh to get latest data from API (cache already cleared by service)
      await refreshGroups.execute()
    } else {
      throw new Error(response?.message || "Failed to delete group");
    }
  }

  const toggleGroupActive = async (group: Group) => {
    if (!tokens) return

    try {
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
      
      const newActiveState = !(group.is_active ?? true);
      const response = await permissionService.updateGroup(group.group_id, {
        is_active: newActiveState,
      });
      
      if (response?.success) {
        await refreshGroups.execute()
      } else {
        throw new Error(response?.message || "Failed to update group status");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update group status";
      console.error("Error toggling group status:", error);
      showError(errorMessage);
    }
  }

  const loadGroupsStats = useApiCall<{ statistics: GroupsStatistics }>(
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

      return await permissionService.getGroupsStatistics()
    },
    {
      onSuccess: (data) => {
        if (data && typeof data === 'object' && 'statistics' in data) {
          setGroupsStats((data as { statistics: GroupsStatistics }).statistics)
        }
      },
      showErrorToast: true,
    }
  )

  const refreshGroupsStats = useApiCall<{ statistics: GroupsStatistics }>(
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

      return await permissionService.getGroupsStatistics(true)
    },
    {
      onSuccess: (data) => {
        if (data && typeof data === 'object' && 'statistics' in data) {
          setGroupsStats((data as { statistics: GroupsStatistics }).statistics)
        }
      },
      showErrorToast: true,
      successMessage: "Statistics refreshed successfully",
      showSuccessToast: true,
    }
  )

  useEffect(() => {
    if (analyticsOpen && tokens && !groupsStats) {
      void loadGroupsStats.execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsOpen])

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) return;
    
    if (user && tokens) {
      void loadGroups.execute()
    } else if (!user) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tokens, authLoading, router])

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <MainLayout title="Groups">
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
      title="Groups"
      description="Manage user groups and access control"
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
              onClick={() => refreshGroups.execute()}
              disabled={refreshGroups.loading}
              loading={refreshGroups.loading}
              loadingText="Refreshing..."
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                setEditingGroup(null)
                setName("")
                setCode("")
                setDescription("")
                setIsActive(true)
                setPanelOpen(true)
              }}
            >
            <Plus className="h-4 w-4" />
            Create Group
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
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Groups Grid */}
        {groups.length === 0 && !loadGroups.loading && !refreshGroups.loading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">No groups found</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first group to get started</p>
              <Button
                className="gap-2"
                onClick={() => {
                  setEditingGroup(null)
                  setName("")
                  setCode("")
                  setDescription("")
                  setPanelOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            </CardContent>
          </Card>
        ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {groups
              .filter((group) =>
                searchQuery
                  ? group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    group.codename.toLowerCase().includes(searchQuery.toLowerCase())
                  : true
              )
              .map((group) => (
            <Card key={group.group_id} className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription className="text-xs">{group.codename}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                  {group.is_system && (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      System
                    </span>
                  )}
                    {group.is_active ? (
                      <span className="rounded-full bg-green-100 dark:bg-green-900/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 dark:bg-red-900/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">{group.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                      Members
                  </div>
                  <div className="flex items-center gap-2">
                    {!group.is_system && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`gap-2 ${group.is_active ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}`}
                          onClick={() => toggleGroupActive(group)}
                          title={group.is_active ? "Deactivate group" : "Activate group"}
                        >
                          <Power className={`h-4 w-4 ${!group.is_active ? "text-green-600" : ""}`} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => {
                            setGroupToDelete({ id: group.group_id, name: group.name || "" })
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setEditingGroup(group)
                        setName(group.name || "")
                        setCode(group.codename || "")
                        setDescription(group.description || "")
                        setIsActive(group.is_active ?? true)
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
            if (!saveGroup.loading) {
              setPanelOpen(false)
              setEditingGroup(null)
            }
          }}
          title={editingGroup ? "Edit Group" : "Create Group"}
          description="Manage group name, code and description"
          width="md"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void saveGroup.execute()
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Administrators"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Group Code</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Full system access"
              />
            </div>
            {editingGroup && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">Group Status</p>
                    <p className="text-sm text-muted-foreground">
                      {isActive ? "Group is active and accessible" : "Group is inactive and hidden"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={saveGroup.loading}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!saveGroup.loading) {
                    setPanelOpen(false)
                    setEditingGroup(null)
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={saveGroup.loading}
                loadingText="Saving..."
                disabled={saveGroup.loading || !name || !code}
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
          title="Groups Analytics"
          description="Statistics and insights about user groups"
          width="lg"
          actions={
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => refreshGroupsStats.execute()}
              disabled={refreshGroupsStats.loading}
              loading={refreshGroupsStats.loading}
              loadingText="Refreshing..."
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          }
        >
          {loadGroupsStats.loading && !groupsStats ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading statistics...</div>
            </div>
          ) : groupsStats ? (
            <GroupsAnalyticsContent stats={groupsStats} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">No statistics available</p>
                <Button onClick={() => loadGroupsStats.execute()}>Load Statistics</Button>
              </CardContent>
            </Card>
          )}
        </SidePanel>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false)
            setGroupToDelete(null)
          }}
          onConfirm={handleDeleteGroup}
          title={`Delete "${groupToDelete?.name}"?`}
          description={`Are you sure you want to delete this group? This action cannot be undone and will remove all associated data.`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          variant="destructive"
          successMessage={`"${groupToDelete?.name}" has been deleted successfully!`}
          errorMessage="Failed to delete group. Please try again."
          autoCloseOnSuccess={true}
          autoCloseDelay={2000}
        />
      </div>
    </MainLayout>
  )
}

