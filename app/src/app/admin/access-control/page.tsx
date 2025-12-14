"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
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
import { 
  Shield, Search, RefreshCw, Users, Key, CheckCircle2, XCircle, 
  Settings, ChevronDown, ChevronRight, ArrowRight, Tag, Plus, 
  Trash2, BarChart3, Power
} from "lucide-react"
import { Switch } from "@components/ui/switch"
import { Badge } from "@components/ui/badge"
import { GroupsAnalyticsContent, type GroupsStatistics } from "@components/analytics/GroupsAnalyticsContent"
import { PermissionsAnalyticsContent, type PermissionsStatistics } from "@components/analytics/PermissionsAnalyticsContent"
import type { Group } from "@models/user.model"
import type { Permission } from "@models/permission.model"

interface GroupWithPermissions extends Group {
  permissions?: Permission[]
  permission_count?: number
}

export default function AccessControlPage() {
  return (
    <PageGuard requireAnyPermission={["view_permission", "view_group", "manage_permission", "manage_group"]}>
      <AccessControlContent />
    </PageGuard>
  )
}

function AccessControlContent() {
  const router = useRouter()
  const { user, tokens, loading: authLoading } = useAuth()
  const { showSuccess, showError } = useToast()
  
  const [activeTab, setActiveTab] = useState<"groups" | "permissions" | "matrix">("groups")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  
  // Groups state
  const [groups, setGroups] = useState<GroupWithPermissions[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GroupWithPermissions | null>(null)
  const selectedGroupRef = useRef<GroupWithPermissions | null>(null)
  const [isGroupPanelOpen, setIsGroupPanelOpen] = useState(false)
  const [groupPermissions, setGroupPermissions] = useState<Permission[]>([])
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([])
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedGroupRef.current = selectedGroup
  }, [selectedGroup])
  
  // Permissions state
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [isPermissionPanelOpen, setIsPermissionPanelOpen] = useState(false)
  const [permissionGroups, setPermissionGroups] = useState<Group[]>([])
  
  // Matrix view state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  
  // Group management state
  const [isGroupEditPanelOpen, setIsGroupEditPanelOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithPermissions | null>(null)
  const [groupName, setGroupName] = useState("")
  const [groupCode, setGroupCode] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [groupIsActive, setGroupIsActive] = useState(true)
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null)
  
  // Permission management state
  const [isPermissionEditPanelOpen, setIsPermissionEditPanelOpen] = useState(false)
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null)
  const [permissionName, setPermissionName] = useState("")
  const [permissionCodename, setPermissionCodename] = useState("")
  const [permissionCategory, setPermissionCategory] = useState("")
  const [permissionDescription, setPermissionDescription] = useState("")
  const [deletePermissionDialogOpen, setDeletePermissionDialogOpen] = useState(false)
  const [permissionToDelete, setPermissionToDelete] = useState<{ id: string; name: string } | null>(null)
  
  // Analytics state
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsType, setAnalyticsType] = useState<"groups" | "permissions">("groups")
  const [groupsStats, setGroupsStats] = useState<GroupsStatistics | null>(null)
  const [permissionsStats, setPermissionsStats] = useState<PermissionsStatistics | null>(null)

  // Set authenticated API service
  useEffect(() => {
    if (tokens) {
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
    }
  }, [tokens])

  // Load groups with permissions
  const loadGroups = useApiCall(
    async () => {
      const response = await permissionService.getGroups(false)
      if (response?.success && response.data) {
        const groupsData = Array.isArray(response.data) ? response.data : []
        // Fetch permissions for each group
        const groupsWithPermissions = await Promise.all(
          groupsData.map(async (group) => {
            try {
              const groupResponse = await permissionService.getGroupById(group.group_id)
              if (groupResponse?.success && groupResponse.data) {
                // API returns { group: {...} } in response.data
                // Extract the group object from response.data.group or use response.data directly
                const responseData = groupResponse.data as GroupWithPermissions & { group?: GroupWithPermissions }
                const groupData = responseData?.group || responseData
                const permissions = (groupData as GroupWithPermissions)?.permissions || []
                
                
                return {
                  ...group,
                  permissions: Array.isArray(permissions) ? permissions : [],
                  permission_count: Array.isArray(permissions) ? permissions.length : 0
                }
              }
              console.warn(`Failed to load permissions for group ${group.group_id}:`, groupResponse)
              return { ...group, permissions: [], permission_count: 0 }
            } catch (error) {
              console.error(`Error loading permissions for group ${group.group_id}:`, error)
              return { ...group, permissions: [], permission_count: 0 }
            }
          })
        )
        return { success: true, data: groupsWithPermissions, message: 'Groups loaded' }
      }
      return { success: true, data: [], message: 'No groups found' }
    },
    {
      onSuccess: (data) => {
        if (Array.isArray(data)) {
          setGroups(data)
        }
      },
      showErrorToast: true,
    }
  )

  // Load permissions
  const loadPermissions = useApiCall<Permission[]>(
    async () => {
      const response = await permissionService.getPermissions(false)
      if (response?.success && response.data) {
        const permissionsData = Array.isArray(response.data) ? response.data : []
        return { ...response, data: permissionsData }
      }
      return { success: true, data: [], message: 'No permissions found' }
    },
    {
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          setPermissions(data)
          setAvailablePermissions(data)
        }
      },
      showErrorToast: true,
    }
  )

  // Load group details with permissions
  const loadGroupDetails = useCallback(async (groupId: string) => {
    try {
      if (!groupId) {
        showError('Group ID is required')
        return
      }
      
      const response = await permissionService.getGroupById(groupId)
      if (response?.success && response.data) {
        // API returns { group: {...} } in response.data
        const responseData = response.data as GroupWithPermissions & { group?: GroupWithPermissions }
        const groupData = responseData?.group || responseData
        
        // Always use the groupId we passed in, in case API response doesn't include it
        const groupWithId: GroupWithPermissions = {
          ...groupData,
          group_id: groupData.group_id || groupId, // Use provided groupId as fallback
          permissions: Array.isArray(groupData.permissions) ? groupData.permissions : [],
          permission_count: Array.isArray(groupData.permissions) ? groupData.permissions.length : 0
        }
        
        // Final validation
        if (!groupWithId.group_id) {
          console.error('Group data missing group_id after processing:', { groupData, groupId })
          showError('Invalid group data: missing group ID')
          return
        }
        
        setSelectedGroup(groupWithId)
        setGroupPermissions(groupData.permissions || [])
        setIsGroupPanelOpen(true)
      } else {
        showError('Failed to load group details')
      }
    } catch (error) {
      console.error('Error loading group details:', error)
      showError('Failed to load group details')
    }
  }, [showError])

  // Load permission details with groups
  const loadPermissionDetails = useCallback(async (permissionId: string) => {
    try {
      // Get all groups and filter those that have this permission
      const groupsResponse = await permissionService.getGroups(false)
      if (groupsResponse?.success && groupsResponse.data) {
        const allGroups = Array.isArray(groupsResponse.data) ? groupsResponse.data : []
        const groupsWithPermission = await Promise.all(
          allGroups.map(async (group) => {
            try {
              const groupResponse = await permissionService.getGroupById(group.group_id)
              if (groupResponse?.success && groupResponse.data) {
                const groupData = groupResponse.data as GroupWithPermissions & { permissions?: Permission[] }
                const hasPermission = (groupData.permissions || []).some(
                  (p: Permission) => p.permission_id === permissionId
                )
                return hasPermission ? group : null
              }
              return null
            } catch {
              return null
            }
          })
        )
        const filteredGroups = groupsWithPermission.filter(Boolean) as Group[]
        
        const permission = permissions.find(p => p.permission_id === permissionId)
        if (permission) {
          setSelectedPermission(permission)
          setPermissionGroups(filteredGroups)
          setIsPermissionPanelOpen(true)
        }
      }
    } catch (error) {
      console.error('Error loading permission details:', error)
      showError('Failed to load permission details')
    }
  }, [permissions, showError])

  // Assign permissions to group
  const assignPermissionsToGroup = useApiCall(
    async () => {
      // Use ref to get current value to avoid closure issues
      const currentGroup = selectedGroupRef.current
      
      if (!currentGroup) {
        return { success: false, message: "No group selected" }
      }
      
      if (!currentGroup.group_id) {
        console.error('Selected group missing group_id:', currentGroup)
        return { success: false, message: "Group ID is missing" }
      }
      
      const permissionIds = groupPermissions.map(p => p.permission_id)
      const groupId = currentGroup.group_id
      
      
      return await permissionService.assignPermissionsToGroup(groupId, permissionIds)
    },
    {
      onSuccess: () => {
        showSuccess("Permissions assigned successfully!")
        loadGroups.execute()
        const currentGroup = selectedGroupRef.current
        if (currentGroup?.group_id) {
          loadGroupDetails(currentGroup.group_id)
        }
      },
      successMessage: "Permissions assigned successfully!",
      showSuccessToast: true,
    }
  )

  // Toggle permission in group
  const togglePermissionInGroup = useCallback((permission: Permission) => {
    const isAssigned = groupPermissions.some(p => p.permission_id === permission.permission_id)
    
    if (isAssigned) {
      // Remove permission
      setGroupPermissions(prev => prev.filter(p => p.permission_id !== permission.permission_id))
    } else {
      // Add permission
      setGroupPermissions(prev => [...prev, permission])
    }
  }, [groupPermissions])

  // Save group (create or update)
  const saveGroup = useApiCall(
    async () => {
      if (editingGroup) {
        return await permissionService.updateGroup(editingGroup.group_id, {
          name: groupName,
          codename: groupCode,
          description: groupDescription,
          is_active: groupIsActive,
        })
      }
      return await permissionService.createGroup({
        name: groupName,
        codename: groupCode,
        description: groupDescription,
        is_active: groupIsActive,
      })
    },
    {
      onSuccess: () => {
        setIsGroupEditPanelOpen(false)
        setEditingGroup(null)
        setGroupName("")
        setGroupCode("")
        setGroupDescription("")
        setGroupIsActive(true)
        loadGroups.execute()
      },
      successMessage: "Group saved successfully!",
      showSuccessToast: true,
    }
  )

  // Delete group
  const handleDeleteGroup = useApiCall(
    async () => {
      if (!groupToDelete) return { success: false, message: "No group selected" }
      return await permissionService.deleteGroup(groupToDelete.id)
    },
    {
      onSuccess: () => {
        setDeleteGroupDialogOpen(false)
        setGroupToDelete(null)
        loadGroups.execute()
      },
      successMessage: "Group deleted successfully!",
      showSuccessToast: true,
    }
  )

  // Toggle group active status
  const toggleGroupActive = useCallback((group: GroupWithPermissions) => {
    const newActiveState = !(group.is_active ?? true)
    permissionService.updateGroup(group.group_id, {
      is_active: newActiveState,
    }).then(() => {
      loadGroups.execute()
      showSuccess("Group status updated successfully!")
    }).catch((error) => {
      console.error('Error toggling group status:', error)
      showError('Failed to update group status')
    })
  }, [loadGroups, showSuccess, showError])

  // Save permission (create or update)
  const savePermission = useApiCall(
    async () => {
      if (editingPermission) {
        return await permissionService.updatePermission(editingPermission.permission_id, {
          name: permissionName,
          codename: permissionCodename,
          description: permissionDescription,
          category: permissionCategory,
        })
      }
      return await permissionService.createPermission({
        name: permissionName,
        codename: permissionCodename,
        description: permissionDescription,
        category: permissionCategory,
      })
    },
    {
      onSuccess: () => {
        setIsPermissionEditPanelOpen(false)
        setEditingPermission(null)
        setPermissionName("")
        setPermissionCodename("")
        setPermissionCategory("")
        setPermissionDescription("")
        loadPermissions.execute()
      },
      successMessage: "Permission saved successfully!",
      showSuccessToast: true,
    }
  )

  // Delete permission
  const handleDeletePermission = useApiCall(
    async () => {
      if (!permissionToDelete) return { success: false, message: "No permission selected" }
      return await permissionService.deletePermission(permissionToDelete.id)
    },
    {
      onSuccess: () => {
        setDeletePermissionDialogOpen(false)
        setPermissionToDelete(null)
        loadPermissions.execute()
      },
      successMessage: "Permission deleted successfully!",
      showSuccessToast: true,
    }
  )

  // Load groups statistics
  const loadGroupsStats = useApiCall<{ statistics: GroupsStatistics }>(
    async () => {
      if (!tokens) throw new Error("Authentication required")
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

  // Load permissions statistics
  const loadPermissionsStats = useApiCall<{ statistics: PermissionsStatistics }>(
    async () => {
      if (!tokens) throw new Error("Authentication required")
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

  // Load analytics when panel opens
  useEffect(() => {
    if (analyticsOpen && tokens) {
      if (analyticsType === "groups" && !groupsStats) {
        loadGroupsStats.execute()
      } else if (analyticsType === "permissions" && !permissionsStats) {
        loadPermissionsStats.execute()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsOpen, analyticsType])

  // Load data on mount
  useEffect(() => {
    if (user && tokens) {
      loadGroups.execute()
      loadPermissions.execute()
    } else if (!authLoading && !user) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tokens, authLoading])

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      const matchesSearch = !searchQuery || 
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.codename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [groups, searchQuery])

  // Filtered permissions
  const filteredPermissions = useMemo(() => {
    return permissions.filter(permission => {
      const matchesSearch = !searchQuery || 
        permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        permission.codename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        permission.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = !categoryFilter || permission.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [permissions, searchQuery, categoryFilter])

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(permissions.map(p => p.category).filter(Boolean)))
  }, [permissions])

  // Get permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {}
    filteredPermissions.forEach(permission => {
      const category = permission.category || 'other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(permission)
    })
    return grouped
  }, [filteredPermissions])

  // Matrix: Get groups for a permission
  const getGroupsForPermission = useCallback((permissionId: string) => {
    return groups.filter(group => 
      group.permissions?.some(p => p.permission_id === permissionId)
    )
  }, [groups])

  // Matrix: Get permissions for a group
  const getPermissionsForGroup = useCallback((groupId: string) => {
    const group = groups.find(g => g.group_id === groupId)
    return group?.permissions || []
  }, [groups])

  if (authLoading) {
    return (
      <MainLayout title="Access Control">
        <div className="flex-1 container mx-auto px-6 py-8 overflow-y-auto flex items-center justify-center">
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
      title="Access Control"
      description="Manage groups, permissions, and access control"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setAnalyticsType(activeTab === "groups" ? "groups" : "permissions")
              setAnalyticsOpen(true)
            }}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              loadGroups.execute()
              loadPermissions.execute()
            }}
            disabled={loadGroups.loading || loadPermissions.loading}
            loading={loadGroups.loading || loadPermissions.loading}
            loadingText="Refreshing..."
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {activeTab === "groups" && (
            <Button
              className="gap-2"
              onClick={() => {
                setEditingGroup(null)
                setGroupName("")
                setGroupCode("")
                setGroupDescription("")
                setGroupIsActive(true)
                setIsGroupEditPanelOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add Group
            </Button>
          )}
          {activeTab === "permissions" && (
            <Button
              className="gap-2"
              onClick={() => {
                setEditingPermission(null)
                setPermissionName("")
                setPermissionCodename("")
                setPermissionCategory("")
                setPermissionDescription("")
                setIsPermissionEditPanelOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add Permission
            </Button>
          )}
        </div>
      }
    >
      <div className="flex-1 container mx-auto px-6 py-8 overflow-y-auto">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab("groups")}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === "groups"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Groups ({groups.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab("permissions")}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === "permissions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Permissions ({permissions.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === "matrix"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Matrix View
              </div>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {activeTab === "permissions" && (
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.filter((cat): cat is string => !!cat).map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Groups Tab */}
        {activeTab === "groups" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {filteredGroups.map((group) => (
              <Card 
                key={group.group_id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => loadGroupDetails(group.group_id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        {group.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {group.codename}
                      </CardDescription>
                    </div>
                    {group.is_system && (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {group.description || "No description"}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Key className="h-4 w-4" />
                      {group.permission_count || 0} permissions
                    </div>
                    <div className="flex items-center gap-2">
                      {group.is_active ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                      {!group.is_system && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleGroupActive(group)
                            }}
                            title={group.is_active ? "Deactivate" : "Activate"}
                          >
                            <Power className={`h-4 w-4 ${!group.is_active ? "text-green-600" : "text-orange-600"}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setGroupToDelete({ id: group.group_id, name: group.name })
                              setDeleteGroupDialogOpen(true)
                            }}
                            title="Delete group"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingGroup(group)
                              setGroupName(group.name)
                              setGroupCode(group.codename)
                              setGroupDescription(group.description || "")
                              setGroupIsActive(group.is_active ?? true)
                              setIsGroupEditPanelOpen(true)
                            }}
                            title="Edit group"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === "permissions" && (
          <div className="space-y-6">
            {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    {category.charAt(0).toUpperCase() + category.slice(1)} ({categoryPermissions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {categoryPermissions.map((permission) => {
                      const assignedGroups = getGroupsForPermission(permission.permission_id)
                      return (
                        <div
                          key={permission.permission_id}
                          className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => loadPermissionDetails(permission.permission_id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{permission.name}</div>
                              <div className="text-xs text-muted-foreground font-mono mt-1">
                                {permission.codename}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPermissionToDelete({ id: permission.permission_id, name: permission.name })
                                  setDeletePermissionDialogOpen(true)
                                }}
                                title="Delete permission"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingPermission(permission)
                                  setPermissionName(permission.name)
                                  setPermissionCodename(permission.codename)
                                  setPermissionCategory(permission.category || "")
                                  setPermissionDescription(permission.description || "")
                                  setIsPermissionEditPanelOpen(true)
                                }}
                                title="Edit permission"
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {permission.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {permission.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {assignedGroups.length} group{assignedGroups.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Matrix View Tab */}
        {activeTab === "matrix" && (
          <Card>
            <CardHeader>
              <CardTitle>Group-Permission Matrix</CardTitle>
              <CardDescription>
                View which groups have which permissions. Click to expand/collapse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.group_id)
                  const groupPerms = getPermissionsForGroup(group.group_id)
                  
                  return (
                    <div key={group.group_id} className="border rounded-lg">
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedGroups)
                          if (isExpanded) {
                            newExpanded.delete(group.group_id)
                          } else {
                            newExpanded.add(group.group_id)
                          }
                          setExpandedGroups(newExpanded)
                        }}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Shield className="h-5 w-5 text-primary" />
                          <div className="text-left">
                            <div className="font-medium">{group.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {groupPerms.length} permission{groupPerms.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            loadGroupDetails(group.group_id)
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t">
                          <div className="pt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {groupPerms.length > 0 ? (
                              groupPerms.map((permission) => (
                                <div
                                  key={permission.permission_id}
                                  className="p-2 rounded border bg-muted/30 flex items-center gap-2"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {permission.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono truncate">
                                      {permission.codename}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="col-span-full text-center py-4 text-muted-foreground">
                                No permissions assigned
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty States */}
        {activeTab === "groups" && filteredGroups.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No groups found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? "Try adjusting your search" : "Groups will appear here"}
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === "permissions" && filteredPermissions.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No permissions found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || categoryFilter ? "Try adjusting your filters" : "Permissions will appear here"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Group Details SidePanel */}
      {isGroupPanelOpen && selectedGroup && (
        <SidePanel
          open={isGroupPanelOpen}
          title={`Manage Permissions: ${selectedGroup.name}`}
          description={selectedGroup.description || "Assign or remove permissions for this group"}
          width="lg"
          onClose={() => {
            setIsGroupPanelOpen(false)
            setSelectedGroup(null)
            setGroupPermissions([])
          }}
        >
          <div className="space-y-6">
            {/* Group Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Group Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <p className="font-medium">{selectedGroup.name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Codename</label>
                  <p className="font-mono text-sm">{selectedGroup.codename}</p>
                </div>
                {selectedGroup.description && (
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <p className="text-sm">{selectedGroup.description}</p>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={selectedGroup.is_active ?? false} 
                      onCheckedChange={() => {}} 
                      disabled 
                    />
                    <span className="text-sm">Active</span>
                  </div>
                  {selectedGroup.is_system && (
                    <Badge variant="secondary">System Group</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Permissions Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Permissions ({groupPermissions.length} selected)
                </CardTitle>
                <CardDescription>
                  Select permissions to assign to this group
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {Object.entries(
                    availablePermissions.reduce((acc, perm) => {
                      const cat = perm.category || 'other'
                      if (!acc[cat]) acc[cat] = []
                      acc[cat].push(perm)
                      return acc
                    }, {} as Record<string, Permission[]>)
                  ).map(([category, categoryPerms]) => (
                    <div key={category}>
                      <h4 className="font-medium text-sm mb-2 text-muted-foreground">
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </h4>
                      <div className="space-y-2">
                        {categoryPerms.map((permission) => {
                          const isSelected = groupPermissions.some(
                            p => p.permission_id === permission.permission_id
                          )
                          return (
                            <div
                              key={permission.permission_id}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/50"
                              }`}
                              onClick={() => togglePermissionInGroup(permission)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {isSelected ? (
                                      <CheckCircle2 className="h-4 w-4 text-primary" />
                                    ) : (
                                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                                    )}
                                    <div>
                                      <div className="font-medium text-sm">{permission.name}</div>
                                      <div className="text-xs text-muted-foreground font-mono mt-1">
                                        {permission.codename}
                                      </div>
                                    </div>
                                  </div>
                                  {permission.description && (
                                    <p className="text-xs text-muted-foreground mt-2 ml-6">
                                      {permission.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsGroupPanelOpen(false)
                  setSelectedGroup(null)
                  setGroupPermissions([])
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const currentGroup = selectedGroupRef.current || selectedGroup
                  if (!currentGroup?.group_id) {
                    console.error('Cannot save: Group ID is missing', { 
                      selectedGroup, 
                      refGroup: selectedGroupRef.current 
                    })
                    showError('Group ID is missing. Please close and reopen the panel.')
                    return
                  }
                  assignPermissionsToGroup.execute()
                }}
                disabled={assignPermissionsToGroup.loading || !selectedGroup?.group_id}
                loading={assignPermissionsToGroup.loading}
              >
                Save Permissions
              </Button>
            </div>
          </div>
        </SidePanel>
      )}

      {/* Permission Details SidePanel */}
      {isPermissionPanelOpen && selectedPermission && (
        <SidePanel
          open={isPermissionPanelOpen}
          title={`Permission: ${selectedPermission.name}`}
          description={selectedPermission.description || "Groups that have this permission"}
          width="lg"
          onClose={() => {
            setIsPermissionPanelOpen(false)
            setSelectedPermission(null)
            setPermissionGroups([])
          }}
        >
          <div className="space-y-6">
            {/* Permission Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Permission Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <p className="font-medium">{selectedPermission.name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Codename</label>
                  <p className="font-mono text-sm">{selectedPermission.codename}</p>
                </div>
                {selectedPermission.description && (
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <p className="text-sm">{selectedPermission.description}</p>
                  </div>
                )}
                {selectedPermission.category && (
                  <div>
                    <label className="text-xs text-muted-foreground">Category</label>
                    <Badge variant="outline">
                      {selectedPermission.category}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned Groups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Assigned Groups ({permissionGroups.length})
                </CardTitle>
                <CardDescription>
                  Groups that have this permission assigned
                </CardDescription>
              </CardHeader>
              <CardContent>
                {permissionGroups.length > 0 ? (
                  <div className="space-y-2">
                    {permissionGroups.map((group) => (
                      <div
                        key={group.group_id}
                        className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setIsPermissionPanelOpen(false)
                          loadGroupDetails(group.group_id)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <div>
                              <div className="font-medium text-sm">{group.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {group.codename}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No groups have this permission</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </SidePanel>
      )}

      {/* Group Edit/Create SidePanel */}
      {isGroupEditPanelOpen && (
        <SidePanel
          open={isGroupEditPanelOpen}
          onClose={() => {
            if (!saveGroup.loading) {
              setIsGroupEditPanelOpen(false)
              setEditingGroup(null)
              setGroupName("")
              setGroupCode("")
              setGroupDescription("")
              setGroupIsActive(true)
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
              saveGroup.execute()
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Administrators"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Group Code</label>
              <Input
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                placeholder="admin"
                required
                disabled={!!editingGroup}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Full system access"
              />
            </div>
            {editingGroup && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {groupIsActive ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">Group Status</p>
                    <p className="text-sm text-muted-foreground">
                      {groupIsActive ? "Group is active and accessible" : "Group is inactive and hidden"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={groupIsActive}
                  onCheckedChange={setGroupIsActive}
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
                    setIsGroupEditPanelOpen(false)
                    setEditingGroup(null)
                    setGroupName("")
                    setGroupCode("")
                    setGroupDescription("")
                    setGroupIsActive(true)
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={saveGroup.loading}
                loadingText="Saving..."
                disabled={saveGroup.loading || !groupName || !groupCode}
              >
                Save
              </Button>
            </div>
          </form>
        </SidePanel>
      )}

      {/* Permission Edit/Create SidePanel */}
      {isPermissionEditPanelOpen && (
        <SidePanel
          open={isPermissionEditPanelOpen}
          onClose={() => {
            if (!savePermission.loading) {
              setIsPermissionEditPanelOpen(false)
              setEditingPermission(null)
              setPermissionName("")
              setPermissionCodename("")
              setPermissionCategory("")
              setPermissionDescription("")
            }
          }}
          title={editingPermission ? "Edit Permission" : "Create Permission"}
          description="Define permission name, code and category"
          width="md"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              savePermission.execute()
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Permission Name</label>
              <Input
                value={permissionName}
                onChange={(e) => setPermissionName(e.target.value)}
                placeholder="View Dashboard"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Codename</label>
              <Input
                value={permissionCodename}
                onChange={(e) => setPermissionCodename(e.target.value)}
                placeholder="view_dashboard"
                required
                disabled={!!editingPermission}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <Input
                value={permissionCategory}
                onChange={(e) => setPermissionCategory(e.target.value)}
                placeholder="dashboard"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={permissionDescription}
                onChange={(e) => setPermissionDescription(e.target.value)}
                placeholder="Allow viewing the dashboard"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!savePermission.loading) {
                    setIsPermissionEditPanelOpen(false)
                    setEditingPermission(null)
                    setPermissionName("")
                    setPermissionCodename("")
                    setPermissionCategory("")
                    setPermissionDescription("")
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={savePermission.loading}
                loadingText="Saving..."
                disabled={savePermission.loading || !permissionName || !permissionCodename}
              >
                Save
              </Button>
            </div>
          </form>
        </SidePanel>
      )}

      {/* Analytics SidePanel */}
      <SidePanel
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        title={`${analyticsType === "groups" ? "Groups" : "Permissions"} Analytics`}
        description={`Statistics and insights about ${analyticsType === "groups" ? "user groups" : "system permissions"}`}
        width="lg"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (analyticsType === "groups") {
                permissionService.getGroupsStatistics(true).then((response) => {
                  if (response?.success && response.data && typeof response.data === 'object' && 'statistics' in response.data) {
                    setGroupsStats((response.data as { statistics: GroupsStatistics }).statistics)
                  }
                })
              } else {
                permissionService.getPermissionsStatistics(true).then((response) => {
                  if (response?.success && response.data && typeof response.data === 'object' && 'statistics' in response.data) {
                    setPermissionsStats((response.data as { statistics: PermissionsStatistics }).statistics)
                  }
                })
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      >
        {analyticsType === "groups" ? (
          loadGroupsStats.loading && !groupsStats ? (
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
          )
        ) : (
          loadPermissionsStats.loading && !permissionsStats ? (
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
          )
        )}
      </SidePanel>

      {/* Delete Group Confirmation Dialog */}
      <ConfirmDialog
        open={deleteGroupDialogOpen}
        onClose={() => {
          setDeleteGroupDialogOpen(false)
          setGroupToDelete(null)
        }}
        onConfirm={() => {
          void handleDeleteGroup.execute()
        }}
        title={groupToDelete ? `Delete "${groupToDelete.name}"?` : "Delete Group?"}
        description="Are you sure you want to delete this group? This action cannot be undone and will remove all associated data."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        successMessage={groupToDelete ? `"${groupToDelete.name}" has been deleted successfully!` : "Group deleted successfully!"}
        errorMessage="Failed to delete group. Please try again."
        autoCloseOnSuccess={true}
        autoCloseDelay={2000}
      />

      {/* Delete Permission Confirmation Dialog */}
      <ConfirmDialog
        open={deletePermissionDialogOpen}
        onClose={() => {
          setDeletePermissionDialogOpen(false)
          setPermissionToDelete(null)
        }}
        onConfirm={() => {
          void handleDeletePermission.execute()
        }}
        title={permissionToDelete ? `Delete "${permissionToDelete.name}"?` : "Delete Permission?"}
        description="Are you sure you want to delete this permission? This action cannot be undone and will remove all associated data."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        successMessage={permissionToDelete ? `"${permissionToDelete.name}" has been deleted successfully!` : "Permission deleted successfully!"}
        errorMessage="Failed to delete permission. Please try again."
        autoCloseOnSuccess={true}
        autoCloseDelay={2000}
      />
    </MainLayout>
  )
}

