"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { useApiCall } from "@hooks/useApiCall"
import { useToast } from "@hooks/useToast"
import { userService } from "@services/user.service"
import { permissionService } from "@services/permission.service"
import { activityService } from "@services/activity.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { PermissionGuard } from "@components/permissions/PermissionGuard"
import { PermissionButton } from "@components/permissions/PermissionButton"
import { usePermissionCheck } from "@hooks/usePermissionCheck"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import {
  Users, Search, UserPlus, Mail, Phone, Shield, 
  Filter, X, Trash2, Edit, CheckCircle2, XCircle, 
  Calendar, UserCircle, RefreshCw, ChevronLeft, ChevronRight,
  Clock, MapPin, Save, MoreVertical,
  BarChart3, Activity, Settings, KeyRound,
  ChevronDown, ChevronUp, Eye, EyeOff, Lock, Unlock,
  UserCheck, UserX, FileText, Folder, Database, Server,
  Globe, Mail as MailIcon, Bell, BellOff, Settings as SettingsIcon,
  Zap, Trash, Plus, Pencil, Search as SearchIcon, Download, Upload
} from "lucide-react"
import type { User as UserType, Group } from "@models/user.model"
import type { ActivityLog } from "@models/activity.model"
import type { ApiResponse } from "@models/api.model"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@components/ui/tabs"
import { UserStatusAuthEnum } from "@lib/enum/enum"
import { formatDateTime } from "@lib/utils/date-format"

type FilterState = {
  search: string
  auth_type: string
  status: string
  gender: string
  is_active: string
  is_verified: string
}

export default function UsersPage() {
  return (
    <PageGuard requireAnyPermission={["view_users", "manage_users"]}>
      <UsersContent />
    </PageGuard>
  )
}

function UsersContent() {
  const router = useRouter()
  const { user: authUser, apiService, tokens, loading: authLoading } = useAuth()
  const { onUserCreated, onUserUpdated, onUserDeleted, connected } = useWebSocket()
  const { showError, showSuccess } = useToast()
  const { canPerformAction } = usePermissionCheck()
  
  const [users, setUsers] = useState<UserType[]>([])
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusSelectionDialogOpen, setStatusSelectionDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null)
  const [userToChangeStatus, setUserToChangeStatus] = useState<{ user: UserType; newStatus: string } | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    auth_type: "",
    status: "",
    gender: "",
    is_active: "",
    is_verified: "",
  })

  const [userGroups, setUserGroups] = useState<Group[]>([])
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [selectedGroupCodenames, setSelectedGroupCodenames] = useState<string[]>([])
  const [createFormSelectedGroups, setCreateFormSelectedGroups] = useState<string[]>([])
  const [overviewTab, setOverviewTab] = useState<"overview" | "groups" | "permissions" | "activities">("overview")
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  
  // Form states
  const [createFormData, setCreateFormData] = useState({
    email: "",
    phone_number: "",
    password: "",
    first_name: "",
    last_name: "",
    user_name: "",
    auth_type: "email",
    status: "ACTIVE",
    gender: "",
    country: "",
    user_type: "customer",
    is_email_verified: false,
    is_phone_verified: false,
  })
  
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    user_name: "",
    email: "",
    phone_number: "",
    status: "",
    gender: "",
    country: "",
    user_type: "",
    auth_type: "",
    is_active: true,
    is_verified: false,
  })

  // Set authenticated API service
  useEffect(() => {
    if (apiService) {
      userService.setAuthApi(apiService)
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
        activityService.setAuthApi(authenticatedApi)
      }
      }
    }
  }, [apiService, tokens])

  // Cache for pages 1 and 2
  const [pageCache, setPageCache] = useState<Record<number, { users: UserType[], total: number, totalPages: number }>>({})

  // Helper to update users from data
  const updateUsersFromData = (data: UserType[], pagination: { total_pages?: number; total?: number }) => {
    setUsers(data)
    setTotalPages(pagination.total_pages || 1)
    setTotal(pagination.total || 0)
    
    // Cache pages 1 and 2 when no filters/search
    const hasFilters = filters.search || filters.auth_type || filters.status || filters.gender || filters.is_active || filters.is_verified
    if (!hasFilters && (page === 1 || page === 2)) {
      setPageCache(prev => ({
        ...prev,
        [page]: {
          users: data,
          total: pagination.total || 0,
          totalPages: pagination.total_pages || 1,
        },
      }))
    }
  }


  // Load from API (middleware handles caching automatically)
  const fetchUsers = useApiCall(
    async () => {
      const filterParams: {
        page: number;
        limit: number;
        search?: string;
        auth_type?: string;
        status?: string;
        gender?: string;
        is_active?: boolean;
        is_verified?: boolean;
      } = {
        page,
        limit,
      }

      if (filters.search) filterParams.search = filters.search
      if (filters.auth_type) filterParams.auth_type = filters.auth_type
      if (filters.status) filterParams.status = filters.status
      if (filters.gender) filterParams.gender = filters.gender
      if (filters.is_active) filterParams.is_active = filters.is_active === "true"
      if (filters.is_verified) filterParams.is_verified = filters.is_verified === "true"

      const result = await userService.getUsers(filterParams)
      return {
        success: true,
        message: result.message || 'Users retrieved successfully',
        data: result.data || [],
        meta: { pagination: result.pagination },
      } as ApiResponse<UserType[]>
    },
    {
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          // Get pagination from the result
          const result = fetchUsers.data as unknown as { meta?: { pagination?: { total_pages?: number; total?: number } } }
          const pagination = result?.meta?.pagination || { total_pages: 1, total: 0 }
          updateUsersFromData(data, pagination)
        }
      },
      showErrorToast: true,
    }
  )

  // Refresh from API (force re-cache with fresh data)
  const refreshUsers = useApiCall(
    async () => {
      const filterParams: {
        page: number;
        limit: number;
        search?: string;
        auth_type?: string;
        status?: string;
        gender?: string;
        is_active?: boolean;
        is_verified?: boolean;
      } = {
        page,
        limit,
      }

      if (filters.search) filterParams.search = filters.search
      if (filters.auth_type) filterParams.auth_type = filters.auth_type
      if (filters.status) filterParams.status = filters.status
      if (filters.gender) filterParams.gender = filters.gender
      if (filters.is_active) filterParams.is_active = filters.is_active === "true"
      if (filters.is_verified) filterParams.is_verified = filters.is_verified === "true"

      const result = await userService.refreshUsers(filterParams)
      return {
        success: true,
        message: result.message || 'Users retrieved successfully',
        data: result.data || [],
        meta: { pagination: result.pagination },
      } as ApiResponse<UserType[]>
    },
    {
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          // Get pagination from the result
          const result = refreshUsers.data as unknown as { meta?: { pagination?: { total_pages?: number; total?: number } } }
          const pagination = result?.meta?.pagination || { total_pages: 1, total: 0 }
          updateUsersFromData(data, pagination)
        }
      },
      showErrorToast: true,
    }
  )

  // Listen for WebSocket events to refresh user list in real-time
  useEffect(() => {
    if (!connected || !authUser) return

    const handleUserCreated = () => {
      // Refresh user list when a new user is created
      setTimeout(() => {
        if (!fetchUsers.loading) {
          fetchUsers.execute()
        }
      }, 500)
    }

    const handleUserUpdated = () => {
      // Refresh user list when a user is updated
      setTimeout(() => {
        if (!fetchUsers.loading) {
          fetchUsers.execute()
        }
      }, 500)
    }

    const handleUserDeleted = () => {
      // Refresh user list when a user is deleted
      setTimeout(() => {
        if (!fetchUsers.loading) {
          fetchUsers.execute()
        }
      }, 500)
    }

    // Subscribe to WebSocket events
    const unsubscribeCreated = onUserCreated(handleUserCreated)
    const unsubscribeUpdated = onUserUpdated(handleUserUpdated)
    const unsubscribeDeleted = onUserDeleted(handleUserDeleted)

    return () => {
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeDeleted()
    }
  }, [connected, authUser, onUserCreated, onUserUpdated, onUserDeleted, fetchUsers])

  // Update user status
  const updateUserStatus = useApiCall(
    async () => {
      if (!userToChangeStatus) return { success: false, message: "No user selected" }
      // Check permission before API call
      const status = userToChangeStatus.newStatus
      if (status === "SUSPENDED" && !canPerformAction({ requireAnyPermission: ["suspend_user", "manage_users"] })) {
        throw new Error("You do not have permission to suspend users")
      }
      if (status === "ACTIVE" && !canPerformAction({ requireAnyPermission: ["activate_user", "manage_users"] })) {
        throw new Error("You do not have permission to activate users")
      }
      return await userService.updateUserStatus(userToChangeStatus.user.user_id, userToChangeStatus.newStatus)
    },
    {
      onSuccess: () => {
        showSuccess("User status updated successfully!")
        fetchUsers.execute()
        if (userToChangeStatus && isOverviewModalOpen) {
          // Refresh user data in overview
          handleOverviewUser(userToChangeStatus.user)
        }
      },
      successMessage: "Status updated successfully!",
      showSuccessToast: true,
    }
  )

  // Delete user
  const deleteUser = useApiCall(
    async () => {
      if (!selectedUser) return { success: false, message: "No user selected" }
      // Check permission before API call
      if (!canPerformAction({ requireAnyPermission: ["delete_user", "manage_users"] })) {
        throw new Error("You do not have permission to delete users")
      }
      return await userService.deleteUser(selectedUser.user_id)
    },
    {
      onSuccess: () => {
        showSuccess("User deleted successfully!")
        setIsOverviewModalOpen(false)
        setSelectedUser(null)
        fetchUsers.execute()
      },
      successMessage: "User deleted successfully!",
      showSuccessToast: true,
    }
  )

  // Create user
  const createUser = useApiCall(
    async () => {
      // Check permission before API call
      if (!canPerformAction({ requireAnyPermission: ["add_user", "manage_users"] })) {
        throw new Error("You do not have permission to create users")
      }
      const userData: {
        password: string;
        auth_type: string;
        status: string;
        user_type: string;
        is_email_verified: boolean;
        is_phone_verified: boolean;
        email?: string;
        phone_number?: { phone: string };
        first_name?: string;
        last_name?: string;
        user_name?: string;
        gender?: string;
        country?: string;
      } = {
        password: createFormData.password,
        auth_type: createFormData.auth_type,
        status: createFormData.status,
        user_type: createFormData.user_type,
        is_email_verified: createFormData.is_email_verified,
        is_phone_verified: createFormData.is_phone_verified,
      }

      if (createFormData.email) userData.email = createFormData.email
      if (createFormData.phone_number) {
        userData.phone_number = { phone: createFormData.phone_number }
      }
      if (createFormData.first_name) userData.first_name = createFormData.first_name
      if (createFormData.last_name) userData.last_name = createFormData.last_name
      if (createFormData.user_name) userData.user_name = createFormData.user_name
      if (createFormData.gender) userData.gender = createFormData.gender
      if (createFormData.country) userData.country = createFormData.country

      const result = await userService.createUser(userData)
      
      // Assign groups if any are selected
      let groupsAssigned = false
      if (createFormSelectedGroups.length > 0 && result?.success && result.data) {
        const createdUser = result.data as UserType
        if (createdUser?.user_id) {
          try {
            await permissionService.assignGroupsToUser(createdUser.user_id, createFormSelectedGroups)
            groupsAssigned = true
          } catch (error) {
            console.error('Error assigning groups to new user:', error)
            // Don't fail the entire operation if group assignment fails
          }
        }
      }
      
      return { ...result, groupsAssigned }
    },
    {
      onSuccess: (data) => {
        const message = (data as any)?.groupsAssigned 
          ? `User created and ${createFormSelectedGroups.length} group(s) assigned successfully!`
          : "User created successfully!"
        showSuccess(message)
        setIsCreateModalOpen(false)
        setCreateFormData({
          email: "",
          phone_number: "",
          password: "",
          first_name: "",
          last_name: "",
          user_name: "",
          auth_type: "email",
          status: "ACTIVE",
          gender: "",
          country: "",
      user_type: "customer",
          is_email_verified: false,
          is_phone_verified: false,
        })
        setCreateFormSelectedGroups([])
        fetchUsers.execute()
      },
      successMessage: "User created successfully!",
      showSuccessToast: true,
    }
  )

  // Update user
  const updateUser = useApiCall(
    async () => {
      if (!selectedUser) return { success: false, message: "No user selected" }
      // Check permission before API call
      if (!canPerformAction({ requireAnyPermission: ["edit_user", "manage_users"] })) {
        throw new Error("You do not have permission to edit users")
      }
      
      const updateData: Partial<UserType> = {}
      if (editFormData.first_name !== undefined) updateData.first_name = editFormData.first_name
      if (editFormData.last_name !== undefined) updateData.last_name = editFormData.last_name
      if (editFormData.user_name !== undefined) updateData.user_name = editFormData.user_name
      if (editFormData.email !== undefined) updateData.email = editFormData.email
      if (editFormData.phone_number !== undefined) {
        updateData.phone_number = { phone: editFormData.phone_number }
      }
      if (editFormData.status !== undefined) updateData.status = editFormData.status
      if (editFormData.gender !== undefined) updateData.gender = editFormData.gender
      if (editFormData.country !== undefined) updateData.country = editFormData.country
      if (editFormData.user_type !== undefined) updateData.user_type = editFormData.user_type
      if (editFormData.auth_type !== undefined) updateData.auth_type = editFormData.auth_type
      if (editFormData.is_active !== undefined) updateData.is_active = editFormData.is_active
      if (editFormData.is_verified !== undefined) updateData.is_verified = editFormData.is_verified

      return await userService.updateUser(selectedUser.user_id, updateData)
    },
    {
      onSuccess: () => {
        showSuccess("User updated successfully!")
        setIsEditModalOpen(false)
        fetchUsers.execute()
        if (selectedUser && isOverviewModalOpen) {
          // Refresh user data in overview
          handleOverviewUser(selectedUser)
        }
      },
      successMessage: "User updated successfully!",
      showSuccessToast: true,
    }
  )

  // Update user groups
  const updateUserGroups = useApiCall(
    async () => {
      if (!selectedUser) return { success: false, message: "No user selected" }
      // Check permission before API call
      if (!canPerformAction({ requireAnyPermission: ["assign_user_groups", "manage_users"] })) {
        throw new Error("You do not have permission to assign groups to users")
      }
      return await permissionService.assignGroupsToUser(selectedUser.user_id, selectedGroupCodenames)
    },
    {
      onSuccess: () => {
        showSuccess("User groups updated successfully!")
        setIsGroupModalOpen(false)
        if (selectedUser && isOverviewModalOpen) {
          // Refresh user data in overview
          handleOverviewUser(selectedUser)
        }
        fetchUsers.execute()
      },
      successMessage: "Groups updated successfully!",
      showSuccessToast: true,
    }
  )

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      auth_type: "",
      status: "",
      gender: "",
      is_active: "",
      is_verified: "",
    })
    setPage(1)
  }, [])

  // Load data on mount (middleware handles caching automatically)
  useEffect(() => {
    if (authUser && apiService) {
      // Always fetch from API on mount - cache middleware handles caching
      fetchUsers.execute()
    } else if (!authLoading && !authUser) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, apiService, authLoading])

  // Load data when page changes (middleware handles caching automatically)
  useEffect(() => {
    if (authUser && apiService) {
      fetchUsers.execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Load data when filters change (debounced, middleware handles caching automatically)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (authUser && apiService) {
        setPage(1) // Reset to first page when filters change
        fetchUsers.execute()
      }
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])


  const handleStatusChange = (userId: string) => {
    const user = users.find(u => u.user_id === userId)
    if (user) {
      setUserToChangeStatus({ user, newStatus: user.status || "ACTIVE" })
      setSelectedStatus(user.status || "ACTIVE")
      setStatusSelectionDialogOpen(true)
    }
  }

  const handleStatusSelectionConfirm = () => {
    if (userToChangeStatus && selectedStatus) {
      setUserToChangeStatus({ ...userToChangeStatus, newStatus: selectedStatus })
      setStatusSelectionDialogOpen(false)
      setStatusDialogOpen(true)
    }
  }

  const handleDeleteUserClick = (userId: string) => {
    const user = users.find(u => u.user_id === userId)
    if (user) {
      setUserToDelete(user)
      setDeleteDialogOpen(true)
    }
  }

  const handleConfirmStatusChange = async () => {
    if (userToChangeStatus) {
      setSelectedUser(userToChangeStatus.user)
      try {
        await updateUserStatus.execute()
        // Dialog will close automatically on success due to autoCloseOnSuccess
      } catch (error) {
        // Error is handled by the dialog
        console.error('Error changing status:', error)
      }
    }
  }

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      setSelectedUser(userToDelete)
      await deleteUser.execute()
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }

  if (authLoading) {
  return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <div className="text-muted-foreground">Loading users...</div>
          </div>
      </div>
    )
  }

  if (!authUser) {
    return null
  }

  const handleOverviewUser = async (user: UserType) => {
    setSelectedUser(user)
    setIsOverviewModalOpen(true)
    setOverviewTab("overview")
    
    // Reset state before loading new data to avoid showing stale data
    setUserGroups([])
    setUserPermissions([])
    setActivityLogs([])
    
    // Load user details for overview
    try {
      const [userResponse, groupsResponse, permissionsResponse, activityResponse] = await Promise.all([
        userService.getUserById(user.user_id),
        permissionService.getUserGroups(user.user_id),
        permissionService.getUserPermissions(user.user_id),
        activityService.getUserActivityLogs(user.user_id, { limit: 50 }),
      ])

      if (userResponse?.success && userResponse.data) {
        setSelectedUser(userResponse.data as UserType)
      }

      // Handle groups response - API returns { groups: [...] }
      if (groupsResponse?.success && groupsResponse.data) {
        let groupsData: Group[] = []
        if (Array.isArray(groupsResponse.data)) {
          groupsData = groupsResponse.data
        } else if (typeof groupsResponse.data === 'object' && 'groups' in groupsResponse.data) {
          groupsData = Array.isArray((groupsResponse.data as any).groups) 
            ? (groupsResponse.data as any).groups 
            : []
        }
        setUserGroups(groupsData)
      } else {
        setUserGroups([])
      }

      // Handle permissions response - API returns { permissions: [...] }
      // Permissions can be strings (codenames) or objects with permission details
      if (permissionsResponse?.success && permissionsResponse.data) {
        let permissionsData: string[] = []
        let rawPermissions: any[] = []
        
        if (Array.isArray(permissionsResponse.data)) {
          rawPermissions = permissionsResponse.data
        } else if (typeof permissionsResponse.data === 'object' && 'permissions' in permissionsResponse.data) {
          rawPermissions = Array.isArray((permissionsResponse.data as any).permissions) 
            ? (permissionsResponse.data as any).permissions 
            : []
        }
        
        // Extract codenames from permissions (handle both string and object formats)
        permissionsData = rawPermissions.map((perm: any) => {
          if (typeof perm === 'string') {
            return perm
          } else if (typeof perm === 'object' && perm !== null) {
            // If it's an object, extract codename or name
            return perm.codename || perm.name || String(perm)
          }
          return String(perm)
        }).filter(Boolean)
        
        setUserPermissions(permissionsData)
      } else {
        setUserPermissions([])
      }

      if (activityResponse?.success && activityResponse.data) {
        let logs: ActivityLog[] = []
        if (Array.isArray(activityResponse.data)) {
          logs = activityResponse.data
        } else if (typeof activityResponse.data === 'object' && 'activity_logs' in activityResponse.data) {
          logs = (activityResponse.data as any).activity_logs || []
        } else if (typeof activityResponse.data === 'object' && 'data' in activityResponse.data) {
          logs = Array.isArray((activityResponse.data as any).data) 
            ? (activityResponse.data as any).data 
            : []
        }
        setActivityLogs(logs)
      } else {
        setActivityLogs([])
      }
    } catch (error) {
      console.error('Error loading user overview:', error)
      showError('Failed to load user overview')
      // Reset state on error
      setUserGroups([])
      setUserPermissions([])
      setActivityLogs([])
    }
  }

  const handleEditUser = (user: UserType) => {
    setSelectedUser(user)
    setEditFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      user_name: user.user_name || "",
      email: user.email || "",
      phone_number: user.phone_number && typeof user.phone_number === 'object' ? user.phone_number.phone || "" : (user.phone_number || ""),
      status: user.status || "ACTIVE",
      gender: user.gender || "",
      country: user.country || "",
      user_type: user.user_type || "customer",
      auth_type: user.auth_type || "email",
      is_active: user.is_active ?? true,
      is_verified: user.is_verified ?? false,
    })
    setIsEditModalOpen(true)
  }

  const handleManageGroups = async (user: UserType) => {
    setSelectedUser(user)
    // Reset selected groups first
    setSelectedGroupCodenames([])
    setIsGroupModalOpen(true)
    // Load user groups and all available groups
    try {
      const [userGroupsRes, allGroupsRes] = await Promise.all([
        permissionService.getUserGroups(user.user_id),
        permissionService.getGroups(),
      ])
      
      if (userGroupsRes?.success && userGroupsRes.data) {
        const groups = Array.isArray(userGroupsRes.data) ? userGroupsRes.data : []
        setUserGroups(groups)
        // Set the codenames of already assigned groups
        const assignedCodenames = groups.map(g => g.codename).filter(Boolean)
        setSelectedGroupCodenames(assignedCodenames)
      } else {
        // If no groups found, ensure empty array
        setUserGroups([])
        setSelectedGroupCodenames([])
      }
      
      if (allGroupsRes?.success && allGroupsRes.data) {
        setAllGroups(Array.isArray(allGroupsRes.data) ? allGroupsRes.data : [])
      } else {
        setAllGroups([])
      }
    } catch (error) {
      console.error('Error loading groups:', error)
      showError('Failed to load groups')
      // Reset on error
      setUserGroups([])
      setSelectedGroupCodenames([])
      setAllGroups([])
    }
  }

  const getStatusBadge = (status: string | null | undefined, isActive: boolean | null | undefined) => {
    const displayStatus = status || (isActive ? "ACTIVE" : "INACTIVE")
    const isActiveStatus = displayStatus === "ACTIVE" || isActive === true

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
          isActiveStatus
            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
            : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
        }`}
      >
        {displayStatus}
      </span>
    )
  }

  const formatPhoneNumber = (phone: unknown) => {
    if (!phone) return "N/A"
    if (typeof phone === 'string') return phone
    if (typeof phone === 'object' && phone !== null && 'phone' in phone) {
      const phoneObj = phone as { phone: string; country_code?: string }
      return `${phoneObj.country_code || ''} ${phoneObj.phone}`.trim()
    }
    return "N/A"
  }

  // Helper function to format permission codename to human-readable name
  const formatPermissionName = (codename: string): string => {
    return codename
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Helper function to get icon for permission based on codename
  const getPermissionIcon = (codename: string) => {
    const lower = codename.toLowerCase()
    
    if (lower.includes('view') || lower.includes('read')) return Eye
    if (lower.includes('create') || lower.includes('add')) return Plus
    if (lower.includes('edit') || lower.includes('update') || lower.includes('change')) return Pencil
    if (lower.includes('delete') || lower.includes('remove')) return Trash
    if (lower.includes('manage') || lower.includes('admin')) return SettingsIcon
    if (lower.includes('upload')) return Upload
    if (lower.includes('download')) return Download
    if (lower.includes('search')) return SearchIcon
    if (lower.includes('permission') || lower.includes('access')) return KeyRound
    if (lower.includes('group')) return Shield
    if (lower.includes('user')) return UserCheck
    if (lower.includes('notification')) return Bell
    if (lower.includes('email') || lower.includes('mail')) return MailIcon
    if (lower.includes('dashboard')) return BarChart3
    if (lower.includes('activity') || lower.includes('log')) return Activity
    if (lower.includes('media') || lower.includes('file') || lower.includes('upload')) return FileText
    if (lower.includes('chat') || lower.includes('message')) return Mail
    if (lower.includes('bot') || lower.includes('dataset')) return Database
    if (lower.includes('auth') || lower.includes('login') || lower.includes('session')) return Lock
    
    return CheckCircle2
  }

  // Helper function to get icon for group
  const getGroupIcon = (group: Group) => {
    const codename = group.codename?.toLowerCase() || ''
    if (codename.includes('admin') || codename.includes('super')) return Shield
    if (codename.includes('user') || codename.includes('customer')) return UserCircle
    if (codename.includes('agent') || codename.includes('support')) return Users
    return Shield
  }

  const formatTimeAgo = (date: string | Date | null | undefined): string => {
    if (!date) return "Never"
    const now = new Date()
    const then = new Date(date)
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)
    
    if (diffInSeconds < 0) return "Just now"
    if (diffInSeconds < 60) return "Just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`
    return `${Math.floor(diffInSeconds / 31536000)}y ago`
  }

  return (
    <MainLayout
      title="Users"
      description={`Manage users and their permissions (${total} total)`}
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
          >
            <Filter className="h-4 w-4" />
            {filtersExpanded ? "Hide Filters" : "Show Filters"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => refreshUsers.execute()}
            disabled={refreshUsers.loading}
            loading={refreshUsers.loading}
            loadingText="Refreshing..."
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <PermissionButton
            variant="default"
            size="sm"
            className="gap-2"
            requireAnyPermission={["add_user", "manage_users"]}
            hideIfNoPermission={true}
            onClick={async () => {
              setIsCreateModalOpen(true)
              // Load all groups when opening create modal
              try {
                const allGroupsRes = await permissionService.getGroups()
                if (allGroupsRes?.success && allGroupsRes.data) {
                  setAllGroups(Array.isArray(allGroupsRes.data) ? allGroupsRes.data : [])
                }
              } catch (error) {
                console.error('Error loading groups:', error)
              }
            }}
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </PermissionButton>
        </div>
      }
    >
      <main className="flex-1 flex">
        {/* Main Content */}
        <div className="flex-1 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Users Management
          </h1>
          <p className="text-muted-foreground">Manage all users in the system</p>
        </div>

          {/* Filters Card */}
          <Card className="mb-6 shadow-lg border-2">
            <CardHeader 
              className="bg-gradient-to-r from-primary/5 to-transparent border-b cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <Filter className="h-5 w-5" />
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      Filters
                      {filtersExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </CardTitle>
                    <CardDescription>Filter users by various criteria</CardDescription>
                  </div>
                </div>
                {filtersExpanded && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation()
                      clearFilters()
                    }} 
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
          {filtersExpanded && (
          <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Search */}
                <div className="xl:col-span-2">
                  <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                      placeholder="Name, email, username..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
                  </div>
                </div>

                {/* Auth Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Auth Type</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.auth_type}
                    onChange={(e) => setFilters({ ...filters, auth_type: e.target.value })}
                  >
                    <option value="">All</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="google">Google</option>
                    <option value="facebook">Facebook</option>
                    <option value="github">GitHub</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="BANNED">Banned</option>
                  </select>
                </div>

                {/* Gender */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Gender</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.gender}
                    onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  >
                    <option value="">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Active Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Active</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.is_active}
                    onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
                  >
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Users Table */}
          <Card className="shadow-lg border-2 overflow-visible">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
              <CardTitle className="text-xl">All Users</CardTitle>
              <CardDescription>
                Showing {users.length} of {total} users (Page {page} of {totalPages})
              </CardDescription>
          </CardHeader>
            <CardContent className="pt-6 overflow-visible">
              {fetchUsers.loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <div className="text-muted-foreground">Loading users...</div>
                  </div>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Users className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No users found</p>
                </div>
              ) : (
                <>
              <div className="w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Auth Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Gender</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Verified</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                            {user.profile_picture_url ? (
                              <img
                                src={user.profile_picture_url}
                                alt={user.first_name || "User"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UserCircle className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {user.first_name || user.last_name
                                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                                : user.user_name || "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {user.user_name || user.user_id?.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {user.email || "N/A"}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {formatPhoneNumber(user.phone_number)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm capitalize">{user.auth_type || "N/A"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(user.status, user.is_active)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm capitalize">{user.gender || "N/A"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {user.is_verified || user.is_email_verified ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionMenuOpen(actionMenuOpen === user.user_id ? null : user.user_id)}
                            className="gap-1"
                          >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                          {actionMenuOpen === user.user_id && (
                            <>
                              <div
                                className="fixed inset-0 z-[100]"
                                onClick={() => setActionMenuOpen(null)}
                              />
                              <div className="absolute right-0 top-full z-[101] mt-1 w-48 bg-background border border-border rounded-lg shadow-xl">
                                <PermissionGuard requireAnyPermission={["view_user", "view_users"]}>
                                  <button
                                    onClick={() => {
                                      handleOverviewUser(user)
                                      setActionMenuOpen(null)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                    Overview
                                  </button>
                                </PermissionGuard>
                                <PermissionGuard requireAnyPermission={["edit_user", "manage_users"]}>
                                  <button
                                    onClick={() => {
                                      handleEditUser(user)
                                      setActionMenuOpen(null)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit User
                                  </button>
                                </PermissionGuard>
                                <PermissionGuard requireAnyPermission={["assign_user_groups", "manage_users"]}>
                                  <button
                                    onClick={() => {
                                      handleManageGroups(user)
                                      setActionMenuOpen(null)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                  >
                                    <Shield className="h-4 w-4" />
                                    Manage Groups
                                  </button>
                                </PermissionGuard>
                                <PermissionGuard requireAnyPermission={["suspend_user", "activate_user", "manage_users"]}>
                                  <button
                                    onClick={() => {
                                      handleStatusChange(user.user_id)
                                      setActionMenuOpen(null)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                  >
                                    <Settings className="h-4 w-4" />
                                    Change Status
                                  </button>
                                </PermissionGuard>
                                <PermissionGuard requireAnyPermission={["delete_user", "manage_users"]}>
                                  <div className="border-t border-border" />
                                  <button
                                    onClick={() => {
                                      handleDeleteUserClick(user.user_id)
                                      setActionMenuOpen(null)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete User
                                  </button>
                                </PermissionGuard>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
            </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1 || fetchUsers.loading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages || fetchUsers.loading}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
          </CardContent>
        </Card>
    </div>


        {/* Create User Modal */}
        {isCreateModalOpen && (
          <SidePanel
            open={isCreateModalOpen}
            title="Create New User"
            description="Add a new user to the system"
            width="lg"
            onClose={() => {
              setIsCreateModalOpen(false)
              setCreateFormSelectedGroups([])
            }}
          >
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">First Name</label>
                  <Input
                    value={createFormData.first_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, first_name: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Last Name</label>
                  <Input
                    value={createFormData.last_name}
                    onChange={(e) => setCreateFormData({ ...createFormData, last_name: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Username</label>
                <Input
                  value={createFormData.user_name}
                  onChange={(e) => setCreateFormData({ ...createFormData, user_name: e.target.value })}
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <Input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Phone Number</label>
                <Input
                  value={createFormData.phone_number}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone_number: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Password *</label>
                <Input
                  type="password"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  placeholder="Password"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Auth Type</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={createFormData.auth_type}
                    onChange={(e) => setCreateFormData({ ...createFormData, auth_type: e.target.value })}
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="google">Google</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={createFormData.status}
                    onChange={(e) => setCreateFormData({ ...createFormData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Gender</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={createFormData.gender}
                    onChange={(e) => setCreateFormData({ ...createFormData, gender: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">User Type</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={createFormData.user_type}
                    onChange={(e) => setCreateFormData({ ...createFormData, user_type: e.target.value })}
                  >
                    <option value="customer">Customer</option>
                    <option value="business">Business</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createFormData.is_email_verified}
                    onChange={(e) => setCreateFormData({ ...createFormData, is_email_verified: e.target.checked })}
                  />
                  <span className="text-sm">Email Verified</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createFormData.is_phone_verified}
                    onChange={(e) => setCreateFormData({ ...createFormData, is_phone_verified: e.target.checked })}
                  />
                  <span className="text-sm">Phone Verified</span>
                </label>
              </div>

              {/* Groups Selection */}
              <div className="pt-4 border-t">
                <label className="text-sm font-medium mb-2 block">Assign Groups</label>
                <p className="text-xs text-muted-foreground mb-4">
                  Select groups to assign to this user. The user will inherit all permissions from the selected groups.
                </p>
                {createFormSelectedGroups.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Selected Groups ({createFormSelectedGroups.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {allGroups
                        .filter(group => createFormSelectedGroups.includes(group.codename))
                        .map((group) => (
                          <span
                            key={group.group_id}
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary"
                          >
                            {group.name}
                            <button
                              type="button"
                              onClick={() => {
                                setCreateFormSelectedGroups(createFormSelectedGroups.filter(c => c !== group.codename))
                              }}
                              className="ml-2 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {allGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Loading groups...</p>
                  ) : (
                    allGroups.map((group) => (
                      <label
                        key={group.group_id}
                        className="flex items-center gap-3 p-2 rounded-lg border-2 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={createFormSelectedGroups.includes(group.codename)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateFormSelectedGroups([...createFormSelectedGroups, group.codename])
                            } else {
                              setCreateFormSelectedGroups(createFormSelectedGroups.filter(c => c !== group.codename))
                            }
                          }}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{group.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{group.codename}</p>
                          {group.description && (
                            <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
                          )}
                        </div>
                        {group.is_system && (
                          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">System</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <PermissionButton
                  onClick={() => createUser.execute()}
                  disabled={createUser.loading || !createFormData.password}
                  loading={createUser.loading}
                  className="flex-1"
                  requireAnyPermission={["add_user", "manage_users"]}
                  disabledTooltip="You do not have permission to create users"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Create User
                </PermissionButton>
              </div>
            </div>
          </SidePanel>
        )}

        {/* Edit User Modal */}
        {isEditModalOpen && selectedUser && (
          <SidePanel
            open={isEditModalOpen}
            title="Edit User"
            description={`Editing ${selectedUser.first_name || selectedUser.user_name || 'user'}`}
            width="lg"
            onClose={() => setIsEditModalOpen(false)}
          >
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">First Name</label>
                  <Input
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Last Name</label>
                  <Input
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Username</label>
                <Input
                  value={editFormData.user_name}
                  onChange={(e) => setEditFormData({ ...editFormData, user_name: e.target.value })}
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <Input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Phone Number</label>
                <Input
                  value={editFormData.phone_number}
                  onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="BANNED">Banned</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Gender</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Country</label>
                  <Input
                    value={editFormData.country}
                    onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                    placeholder="Country"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">User Type</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editFormData.user_type}
                    onChange={(e) => setEditFormData({ ...editFormData, user_type: e.target.value })}
                  >
                    <option value="customer">Customer</option>
                    <option value="business">Business</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.is_verified}
                    onChange={(e) => setEditFormData({ ...editFormData, is_verified: e.target.checked })}
                  />
                  <span className="text-sm">Verified</span>
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <PermissionButton
                  onClick={() => updateUser.execute()}
                  disabled={updateUser.loading}
                  loading={updateUser.loading}
                  className="flex-1"
                  requireAnyPermission={["edit_user", "manage_users"]}
                  disabledTooltip="You do not have permission to edit users"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </PermissionButton>
              </div>
            </div>
          </SidePanel>
        )}

        {/* Manage Groups Modal */}
        {isGroupModalOpen && selectedUser && (
          <SidePanel
            open={isGroupModalOpen}
            title="Manage User Groups"
            description={`Assign groups to ${selectedUser.first_name || selectedUser.user_name || 'user'}`}
            width="md"
            onClose={() => setIsGroupModalOpen(false)}
          >
            <div className="space-y-4 pt-4">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Select groups to assign to this user. The user will inherit all permissions from the selected groups.
                </p>
                {selectedGroupCodenames.length > 0 && (
                  <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-primary mb-1">
                      Currently Assigned Groups ({selectedGroupCodenames.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allGroups
                        .filter(group => selectedGroupCodenames.includes(group.codename))
                        .map((group) => (
                          <span
                            key={group.group_id}
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground"
                          >
                            {group.name}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allGroups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Loading groups...</p>
                    </div>
                  ) : (
                    allGroups.map((group) => (
                    <label
                      key={group.group_id}
                      className="flex items-center gap-3 p-3 rounded-lg border-2 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupCodenames.includes(group.codename)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroupCodenames([...selectedGroupCodenames, group.codename])
                          } else {
                            setSelectedGroupCodenames(selectedGroupCodenames.filter(c => c !== group.codename))
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{group.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{group.codename}</p>
                        {group.description && (
                          <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
                        )}
                      </div>
                      {group.is_system && (
                        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">System</span>
                      )}
                    </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <PermissionButton
                  onClick={() => updateUserGroups.execute()}
                  disabled={updateUserGroups.loading}
                  loading={updateUserGroups.loading}
                  className="flex-1"
                  requireAnyPermission={["assign_user_groups", "manage_users"]}
                  disabledTooltip="You do not have permission to assign groups"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Groups
                </PermissionButton>
              </div>
            </div>
          </SidePanel>
        )}

        {/* Delete User Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false)
            setUserToDelete(null)
            fetchUsers.execute()
          }}
          onConfirm={handleConfirmDelete}
          title={userToDelete ? `Delete "${userToDelete.first_name || userToDelete.user_name || 'User'}"?` : "Delete User?"}
          description="Are you absolutely sure? This will permanently delete the user. This action cannot be undone."
          confirmText="Yes, Delete"
          cancelText="Cancel"
          variant="destructive"
          successMessage={userToDelete ? `"${userToDelete.first_name || userToDelete.user_name || 'User'}" has been deleted successfully!` : "User deleted successfully!"}
          errorMessage="Failed to delete user. Please try again."
          autoCloseOnSuccess={true}
          autoCloseDelay={2000}
        />

        {/* Status Selection Dialog */}
        {statusSelectionDialogOpen && userToChangeStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => {
              setStatusSelectionDialogOpen(false)
              setUserToChangeStatus(null)
            }} />
            <Card className="relative z-50 w-full max-w-md shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Change User Status
                </CardTitle>
                <CardDescription>
                  Select a new status for &quot;{userToChangeStatus.user.first_name || userToChangeStatus.user.user_name || 'User'}&quot;
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Current Status</label>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium capitalize">
                        {userToChangeStatus.user.status || "ACTIVE"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">New Status</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {Object.entries(UserStatusAuthEnum).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatusSelectionDialogOpen(false)
                      setUserToChangeStatus(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStatusSelectionConfirm}
                    disabled={!selectedStatus || selectedStatus === userToChangeStatus.user.status}
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Change Status Confirmation Dialog */}
        <ConfirmDialog
          open={statusDialogOpen}
          onClose={() => {
            setStatusDialogOpen(false)
            setUserToChangeStatus(null)
          }}
          onConfirm={handleConfirmStatusChange}
          title="Confirm Status Change"
          description={userToChangeStatus ? `Are you sure you want to change "${userToChangeStatus.user.first_name || userToChangeStatus.user.user_name || 'User'}" status from ${userToChangeStatus.user.status || "ACTIVE"} to ${userToChangeStatus.newStatus}?` : "Are you sure you want to change user status?"}
          confirmText="Yes, Change"
          cancelText="Cancel"
          variant="default"
          successMessage={userToChangeStatus ? `User status changed to ${UserStatusAuthEnum[userToChangeStatus.newStatus as keyof typeof UserStatusAuthEnum] || userToChangeStatus.newStatus} successfully!` : "Status updated successfully!"}
          errorMessage="Failed to update user status. Please try again."
          autoCloseOnSuccess={true}
          autoCloseDelay={2000}
        />

        {/* User Overview Dashboard */}
        {isOverviewModalOpen && selectedUser && (
          <SidePanel
            open={isOverviewModalOpen}
            title="User Overview"
            description={`Complete dashboard for ${selectedUser.first_name || selectedUser.user_name || 'user'}`}
            width="lg"
            onClose={() => {
              setIsOverviewModalOpen(false)
              setSelectedUser(null)
            }}
          >
            {/* Tabs Navigation */}
            <Tabs value={overviewTab} onValueChange={(value) => setOverviewTab(value as typeof overviewTab)} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="groups" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Groups ({userGroups.length})
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Permissions ({userPermissions.length})
                </TabsTrigger>
                <TabsTrigger value="activities" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity Logs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
              <div className="space-y-6 overflow-x-hidden">
                {/* User Profile Card */}
                <Card className="shadow-lg border-2 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
                      {selectedUser.profile_picture_url ? (
                        <img
                          src={selectedUser.profile_picture_url}
                          alt={selectedUser.first_name || "User"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserCircle className="h-10 w-10 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-2xl truncate">
                        {selectedUser.first_name || selectedUser.last_name
                          ? `${selectedUser.first_name || ""} ${selectedUser.last_name || ""}`.trim()
                          : selectedUser.user_name || "User"}
                      </CardTitle>
                      <CardDescription className="text-base mt-1 truncate">
                        @{selectedUser.user_name || "username"}
                      </CardDescription>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {getStatusBadge(selectedUser.status, selectedUser.is_active)}
                        {selectedUser.is_verified && (
                          <>
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </span>
                            {selectedUser.last_sign_in_at && (
                              <span className="inline-flex items-center text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1" />
                                Last Sign In: {formatTimeAgo(selectedUser.last_sign_in_at)}
                              </span>
                            )}
                          </>
                        )}
                        {!selectedUser.is_verified && selectedUser.last_sign_in_at && (
                          <span className="inline-flex items-center text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            Last Sign In: {formatTimeAgo(selectedUser.last_sign_in_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 overflow-hidden">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-w-0">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Username</p>
                      <p className="text-sm font-medium">{selectedUser.user_name || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Auth Type</p>
                      <p className="text-sm font-medium capitalize">{selectedUser.auth_type || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">User Type</p>
                      <p className="text-sm font-medium capitalize">{selectedUser.user_type || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Gender</p>
                      <p className="text-sm font-medium capitalize">{selectedUser.gender || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card className="shadow-lg border-2 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{selectedUser.email || "N/A"}</p>
                          {selectedUser.is_email_verified && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{formatPhoneNumber(selectedUser.phone_number)}</p>
                          {selectedUser.is_phone_verified && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <p className="text-sm font-medium capitalize">{selectedUser.gender || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Country</p>
                        <p className="text-sm font-medium">{selectedUser.country || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-3">
                    <PermissionButton
                      variant="outline"
                      className="w-full gap-2"
                      requireAnyPermission={["edit_user", "manage_users"]}
                      hideIfNoPermission={true}
                      onClick={() => {
                        setIsOverviewModalOpen(false)
                        handleEditUser(selectedUser)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit User
                    </PermissionButton>
                    <PermissionButton
                      variant="outline"
                      className="w-full gap-2"
                      requireAnyPermission={["assign_user_groups", "manage_users"]}
                      hideIfNoPermission={true}
                      onClick={() => {
                        setIsOverviewModalOpen(false)
                        handleManageGroups(selectedUser)
                      }}
                    >
                      <Shield className="h-4 w-4" />
                      Manage Groups
                    </PermissionButton>
                    <PermissionButton
                      variant="outline"
                      className="w-full gap-2"
                      requireAnyPermission={["suspend_user", "activate_user", "manage_users"]}
                      hideIfNoPermission={true}
                      onClick={() => {
                        setIsOverviewModalOpen(false)
                        handleStatusChange(selectedUser.user_id)
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Change Status
                    </PermissionButton>
                    <PermissionButton
                      variant="destructive"
                      className="w-full gap-2"
                      requireAnyPermission={["delete_user", "manage_users"]}
                      hideIfNoPermission={true}
                      onClick={() => {
                        setIsOverviewModalOpen(false)
                        handleDeleteUserClick(selectedUser.user_id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete User
                    </PermissionButton>
                  </div>
                </CardContent>
              </Card>
              </div>
              </TabsContent>

              <TabsContent value="groups" className="mt-0">
                <div className="space-y-6">
                  <Card className="shadow-lg border-2">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Groups ({userGroups.length})
                      </CardTitle>
                      <CardDescription>
                        All groups assigned to this user. Permissions are inherited from these groups.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {userGroups.length > 0 ? (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                          {userGroups.map((group) => {
                            const GroupIcon = getGroupIcon(group)
                            return (
                              <div
                                key={group.group_id}
                                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                  <GroupIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-sm text-foreground">{group.name}</p>
                                    {group.codename && (
                                      <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                        {group.codename}
                                      </span>
                                    )}
                                  </div>
                                  {group.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>
                                  )}
                                </div>
                                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <Shield className="h-16 w-16 mx-auto mb-4 opacity-50" />
                          <p className="font-medium mb-1">No groups assigned</p>
                          <p className="text-sm">This user is not a member of any groups.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="mt-0">
                <div className="space-y-6">
                  <Card className="shadow-lg border-2">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                      <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5" />
                        Permissions ({userPermissions.length})
                      </CardTitle>
                      <CardDescription>
                        All permissions granted to this user through their groups. These permissions determine what actions the user can perform in the system.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {userPermissions.length > 0 ? (
                        <div className="space-y-3">
                          <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {userPermissions.map((permission, idx) => {
                              const PermissionIcon = getPermissionIcon(permission)
                              const permissionName = formatPermissionName(permission)
                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center justify-center">
                                    <PermissionIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-foreground mb-0.5">{permissionName}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{permission}</p>
                                  </div>
                                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                </div>
                              )
                            })}
                          </div>
                          <div className="pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                              <strong>Note:</strong> Permissions are automatically inherited from the groups this user belongs to. 
                              To modify permissions, update the user's group memberships.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <KeyRound className="h-16 w-16 mx-auto mb-4 opacity-50" />
                          <p className="font-medium mb-1">No permissions assigned</p>
                          <p className="text-sm">This user has no permissions. Assign them to groups to grant access.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="activities" className="mt-0">
              <div className="space-y-6">
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Activities
                    </CardTitle>
                    <CardDescription>
                      {activityLogs.length} {activityLogs.length === 1 ? 'activity' : 'activities'} found
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {activityLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground font-medium">No activities found</p>
                        <p className="text-sm text-muted-foreground mt-1">This user hasn't performed any activities yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activityLogs.map((log) => (
                          <div
                            key={log.log_id}
                            className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
                              <Activity className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                  {selectedUser.first_name || selectedUser.last_name
                                    ? `${selectedUser.first_name || ""} ${selectedUser.last_name || ""}`.trim()
                                    : selectedUser.user_name || "User"}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-sm">
                                  {log.action || log.message}
                                </span>
                                {log.module && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {log.module}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {log.created_at && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDateTime(log.created_at)}
                                  </div>
                                )}
                                {log.ip_address && (
                                  <div className="flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    {log.ip_address}
                                  </div>
                                )}
                              </div>
                              {log.message && log.message !== log.action && (
                                <p className="text-xs text-muted-foreground mt-2">{log.message}</p>
                              )}
                            </div>
                            {log.level && (
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  log.level === 'error'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                    : log.level === 'warn'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                    : log.level === 'audit'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {log.level}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              </TabsContent>
            </Tabs>
          </SidePanel>
        )}
      </main>
    </MainLayout>
  )
}
