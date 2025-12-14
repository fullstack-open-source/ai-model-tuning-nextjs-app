"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { useModuleI18n } from "@context/I18nContext"
import { usePermissions } from "@hooks/usePermissions"
import { useApiCall } from "@hooks/useApiCall"
import { useToast } from "@hooks/useToast"
import { activityService } from "@services/activity.service"
import { userService } from "@services/user.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { Avatar, AvatarImage, AvatarFallback } from "@components/ui/avatar"
import {
  Activity, Search, Filter, Calendar, Shield, RefreshCw, X,
  Info, AlertTriangle, AlertCircle, CheckCircle2, Bug, FileText,
  User, Clock, MapPin, Monitor, Globe, ChevronLeft, ChevronRight,
  BarChart3, ChevronDown, ChevronUp, Trash2
} from "lucide-react"
import type { ActivityLog, ActivityLogFilters, ActivityLogStats } from "@models/activity.model"
import type { User as UserType } from "@models/user.model"
import type { ApiResponse, PaginatedResponse } from "@models/api.model"
import { formatDateTime } from "@lib/utils/date-format"

type FilterState = {
  search: string
  user_id: string
  level: string
  action: string
  module: string
  ip_address: string
  start_date: string
  end_date: string
}

export default function ActivityPage() {
  return (
    <PageGuard requireAnyPermission={["view_activity_log", "view_own_activity_log"]}>
      <ActivityContent />
    </PageGuard>
  )
}

function ActivityContent() {
  const router = useRouter()
  const { user: authUser, apiService, tokens, loading: authLoading } = useAuth()
  const { onActivityNew, subscribeToActivity, unsubscribeFromActivity, connected } = useWebSocket()
  const { hasPermission } = usePermissions()
  const { showError, showSuccess } = useToast()
  const { t } = useModuleI18n("activity")
  const { t: tGeneral } = useModuleI18n("general")

  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statistics, setStatistics] = useState<ActivityLogStats | null>(null)
  const [users, setUsers] = useState<UserType[]>([])
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const limit = 50

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    user_id: "",
    level: "",
    action: "",
    module: "",
    ip_address: "",
    start_date: "",
    end_date: "",
  })

  // Set authenticated API service
  useEffect(() => {
    if (apiService) {
      activityService.setAuthApi(apiService)
      userService.setAuthApi(apiService)
    } else if (tokens) {
      const authHeaders: Record<string, string> = {}
      if (tokens.session_token) {
        authHeaders["X-Session-Token"] = tokens.session_token
      } else if (tokens.access_token && tokens.token_type) {
        authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`
      }
      if (Object.keys(authHeaders).length > 0) {
        const authenticatedApi = createPublicApiService(authHeaders)
        activityService.setAuthApi(authenticatedApi)
        userService.setAuthApi(authenticatedApi)
      }
    }
  }, [apiService, tokens])

  // Fetch users for filter dropdown (only if user has view_users permission)
  useEffect(() => {
    // Check if user has permission before making API call
    if (!authUser || !apiService) {
      setUsers([])
      return
    }

    // Only fetch if user has view_users permission
    if (!hasPermission('view_users')) {
      setUsers([])
      return
    }

    // Fetch users with permission check
    userService.getUsers({ page: 1, limit: 1000 })
      .then((response) => {
        if (response?.success && response.data) {
          const usersData = Array.isArray(response.data) ? response.data : []
          setUsers(usersData)
        } else {
          // API returned error, set empty array
          setUsers([])
        }
      })
      .catch((error) => {
        // Silently fail - users filter is optional
        console.debug('Failed to fetch users for filter (optional)', error)
        setUsers([])
      })
  }, [authUser, apiService, hasPermission])

  // Helper to process activity logs response
  const processActivityLogsResponse = (result: PaginatedResponse<ActivityLog> | ApiResponse<ActivityLog[]> | null) => {
    // Handle response structure - API returns { activity_logs: [...], total: ..., pagination: {...} }
    let activitiesData: ActivityLog[] = []
    let totalCount = 0
    if (result?.success) {
      // Check if result.data is the direct response object
      if (result.data && typeof result.data === 'object' && 'activity_logs' in result.data) {
        const responseData = result.data as { activity_logs?: ActivityLog[]; total?: number; pagination?: { total?: number } }
        activitiesData = responseData.activity_logs || []
        totalCount = responseData.total || responseData.pagination?.total || 0
      } else if (Array.isArray(result.data)) {
        activitiesData = result.data
        totalCount = result.data.length
      }
    }

    // Apply search filter (client-side for better UX)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      activitiesData = activitiesData.filter(activity => 
        activity.message?.toLowerCase().includes(searchLower) ||
        activity.action?.toLowerCase().includes(searchLower) ||
        activity.module?.toLowerCase().includes(searchLower) ||
        activity.ip_address?.toLowerCase().includes(searchLower) ||
        (activity.user as UserType | undefined)?.email?.toLowerCase().includes(searchLower) ||
        (activity.user as UserType | undefined)?.user_name?.toLowerCase().includes(searchLower) ||
        (activity.user as UserType | undefined)?.first_name?.toLowerCase().includes(searchLower) ||
        (activity.user as UserType | undefined)?.last_name?.toLowerCase().includes(searchLower)
      )
    }

    // Apply IP filter (client-side)
    if (filters.ip_address) {
      activitiesData = activitiesData.filter(activity => 
        activity.ip_address?.includes(filters.ip_address)
      )
    }

    return { activitiesData, totalCount }
  }

  // Helper to update activities from data
  const updateActivitiesFromData = (activitiesData: ActivityLog[], totalCount: number) => {
    setActivities(activitiesData)
    setTotal(totalCount || activitiesData.length)
    setTotalPages(Math.ceil((totalCount || activitiesData.length) / limit) || 1)
  }

  // Load data from API (middleware handles caching automatically)
  const loadData = async () => {
    try {
      const filterParams: ActivityLogFilters = {
        limit,
        offset: (page - 1) * limit,
      }

      if (filters.user_id) filterParams.user_id = filters.user_id
      if (filters.level) filterParams.level = filters.level as ActivityLog['level']
      if (filters.action) filterParams.action = filters.action
      if (filters.module) filterParams.module = filters.module
      if (filters.start_date) filterParams.start_date = new Date(filters.start_date).toISOString()
      if (filters.end_date) filterParams.end_date = new Date(filters.end_date).toISOString()

      // Check if user has permission to view statistics
      const canViewStatistics = hasPermission('view_activity_statistics')
      
      // Fetch from API (middleware handles caching automatically)
      // Only fetch statistics if user has permission
      const promises: Promise<any>[] = [
        activityService.getActivityLogs(filterParams),
      ]
      
      if (canViewStatistics) {
        promises.push(activityService.getActivityStatistics())
      }

      const responses = await Promise.all(promises)
      const logsResponse = responses[0]
      const statsResponse = canViewStatistics ? responses[1] : null

      if (logsResponse && logsResponse.success) {
        const { activitiesData, totalCount } = processActivityLogsResponse(logsResponse)
        updateActivitiesFromData(activitiesData, totalCount)
      }

      // Only process statistics if user has permission and response is successful
      if (canViewStatistics && statsResponse && statsResponse.success) {
        const statsData = statsResponse.data
        if (statsData && typeof statsData === 'object' && 'statistics' in statsData) {
          setStatistics((statsData as { statistics: ActivityLogStats }).statistics)
        } else if (statsData) {
          setStatistics(statsData as ActivityLogStats)
        }
      } else if (!canViewStatistics) {
        // User doesn't have permission, set statistics to null
        setStatistics(null)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  // Refresh from API (force API call and update cache)
  const fetchActivities = useApiCall(
    async () => {
      const filterParams: ActivityLogFilters = {
        limit,
        offset: (page - 1) * limit,
      }

      if (filters.user_id) filterParams.user_id = filters.user_id
      if (filters.level) filterParams.level = filters.level as ActivityLog['level']
      if (filters.action) filterParams.action = filters.action
      if (filters.module) filterParams.module = filters.module
      if (filters.start_date) filterParams.start_date = new Date(filters.start_date).toISOString()
      if (filters.end_date) filterParams.end_date = new Date(filters.end_date).toISOString()

      const result = await activityService.refreshActivityLogs(filterParams)
      
      const { activitiesData, totalCount } = processActivityLogsResponse(result)

      return {
        success: true,
        message: 'Activities retrieved successfully',
        data: activitiesData,
        count: activitiesData.length,
        total: totalCount || activitiesData.length,
      } as ApiResponse<ActivityLog[]>
    },
    {
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          const responseTotal = (data as ActivityLog[] & { total?: number }).total || data.length
          updateActivitiesFromData(data, responseTotal)
        }
      },
      showErrorToast: true,
    }
  )

  // Refresh statistics from API (force API call and update cache)
  // Only fetch if user has permission
  const fetchStatistics = useApiCall(
    async () => {
      // Check permission before making API call
      if (!hasPermission('view_activity_statistics')) {
        setStatistics(null)
        return { success: false, message: 'Permission denied' }
      }
      
      const result = await activityService.refreshActivityStatistics()
      return result
    },
    {
      onSuccess: (data) => {
        if (data && typeof data === 'object' && 'statistics' in data) {
          setStatistics((data as { statistics: ActivityLogStats }).statistics)
        } else if (data) {
          setStatistics(data as ActivityLogStats)
        }
      },
      showErrorToast: false, // Don't show error toast for permission denied
    }
  )

  // Load data on mount (middleware handles caching automatically)
  useEffect(() => {
    if (authUser && apiService) {
      loadData()
    } else if (!authLoading && !authUser) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, apiService, authLoading])

  // Load data when page changes (middleware handles caching automatically)
  useEffect(() => {
    if (authUser && apiService) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Load from cache when filters change (debounced, no API call)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (authUser && apiService) {
        setPage(1) // Reset to first page when filters change
        loadData()
      }
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // Subscribe to activity room for real-time updates
  useEffect(() => {
    if (!connected) return;

    // Subscribe to activity room
    subscribeToActivity();

    return () => {
      unsubscribeFromActivity();
    };
  }, [connected, subscribeToActivity, unsubscribeFromActivity]);

  // Subscribe to WebSocket for real-time activity updates
  useEffect(() => {
    if (!connected) return;

    // Subscribe to new activity events
    const unsubActivityNew = onActivityNew((data) => {
      // Add new activity to the top of the list
      setActivities(prev => {
        // Check if activity already exists
        if (prev.some(a => a.log_id === data.log_id)) return prev;
        // Add to top and maintain limit
        const updated = [data as unknown as ActivityLog, ...prev];
        return updated.slice(0, limit);
      });
      setTotal(prev => prev + 1);
      // Refresh statistics only if user has permission
      if (hasPermission('view_activity_statistics')) {
        fetchStatistics.execute();
      }
    });

    return () => {
      unsubActivityNew();
    };
  }, [connected, onActivityNew, fetchStatistics])

  // Delete activity log (Admin only)
  const [logToDelete, setLogToDelete] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [activityToDelete, setActivityToDelete] = useState<ActivityLog | null>(null)
  
  const deleteActivityLog = useApiCall(
    async () => {
      if (!logToDelete) {
        throw new Error("No log ID provided")
      }
      if (!hasPermission('manage_activity_logs')) {
        throw new Error("You do not have permission to delete activity logs")
      }
      return await activityService.deleteActivityLog(logToDelete)
    },
    {
      onSuccess: () => {
        showSuccess("Activity log deleted successfully!")
        // Remove from list
        setActivities(prev => prev.filter(a => a.log_id !== logToDelete))
        setTotal(prev => Math.max(0, prev - 1))
        if (selectedActivity?.log_id === logToDelete) {
          setIsDetailsOpen(false)
          setSelectedActivity(null)
        }
        setLogToDelete(null)
        setActivityToDelete(null)
        setIsDeleteDialogOpen(false)
        // Refresh list
        fetchActivities.execute()
      },
      successMessage: "Activity log deleted successfully!",
      showErrorToast: true,
    }
  )

  const handleDeleteActivity = useCallback((activity: ActivityLog, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the view details
    setActivityToDelete(activity)
    setLogToDelete(activity.log_id)
    setIsDeleteDialogOpen(true)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      user_id: "",
      level: "",
      action: "",
      module: "",
      ip_address: "",
      start_date: "",
      end_date: "",
    })
    setPage(1)
  }, [])

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-500" />
      case 'audit':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getLevelBadge = (level: string) => {
    const colors = {
      error: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      debug: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
      audit: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${colors[level as keyof typeof colors] || colors.info}`}>
        {getLevelIcon(level)}
        {level.toUpperCase()}
      </span>
    )
  }

  const handleViewDetails = (activity: ActivityLog) => {
    setSelectedActivity(activity)
    setIsDetailsOpen(true)
  }

  // Get unique actions and modules from activities for filter dropdowns
  const uniqueActions = Array.from(new Set(activities.map(a => a.action).filter(Boolean)))
  const uniqueModules = Array.from(new Set(activities.map(a => a.module).filter(Boolean)))

  if (authLoading) {
    return (
      <MainLayout title={t("activity_logs")}>
        <div className="flex-1 container mx-auto px-6 py-8 overflow-y-auto flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <div className="text-muted-foreground">{t("loading_activities")}</div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title={t("activity_logs")}
      description={`${t("monitor_activities")} (${total} ${tGeneral("total").toLowerCase()})`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            title={filtersExpanded ? tGeneral("hide_filters") : tGeneral("show_filters")}
          >
            <Filter className="h-4 w-4" />
            {filtersExpanded ? tGeneral("hide_filters") : tGeneral("show_filters")}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              fetchActivities.execute()
              // Only refresh statistics if user has permission
              if (hasPermission('view_activity_statistics')) {
                fetchStatistics.execute()
              }
            }}
            disabled={fetchActivities.loading || (hasPermission('view_activity_statistics') && fetchStatistics.loading)}
            loading={fetchActivities.loading || (hasPermission('view_activity_statistics') && fetchStatistics.loading)}
            loadingText={tGeneral("refreshing")}
          >
            <RefreshCw className="h-4 w-4" />
            {tGeneral("refresh")}
          </Button>
        </div>
      }
    >
      <div className="container mx-auto px-6 py-8">

          {/* Statistics Cards - Level Analytics */}
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* INFO Level */}
              <Card className="shadow-lg border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/20 border-b border-blue-200 dark:border-blue-800">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    INFO
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                        {typeof statistics.by_level?.info === 'number' ? statistics.by_level.info : 
                         typeof statistics.by_level?.INFO === 'number' ? statistics.by_level.INFO : 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Information logs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* WARNING Level */}
              <Card className="shadow-lg border-2 border-yellow-200 dark:border-yellow-800">
                <CardHeader className="pb-3 bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-950/20 border-b border-yellow-200 dark:border-yellow-800">
                  <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    WARNING
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                        {typeof statistics.by_level?.warn === 'number' ? statistics.by_level.warn : 
                         typeof statistics.by_level?.warning === 'number' ? statistics.by_level.warning :
                         typeof statistics.by_level?.WARN === 'number' ? statistics.by_level.WARN :
                         typeof statistics.by_level?.WARNING === 'number' ? statistics.by_level.WARNING : 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Warning logs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ERROR Level */}
              <Card className="shadow-lg border-2 border-red-200 dark:border-red-800">
                <CardHeader className="pb-3 bg-gradient-to-r from-red-50 to-transparent dark:from-red-950/20 border-b border-red-200 dark:border-red-800">
                  <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    ERROR
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                        {typeof statistics.by_level?.error === 'number' ? statistics.by_level.error : 
                         typeof statistics.by_level?.ERROR === 'number' ? statistics.by_level.ERROR : 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Error logs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
                    <CardDescription>Filter activities by various criteria</CardDescription>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                      placeholder="Message, action, module, IP, user..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
                </div>

                {/* User Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">User</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.user_id}
                    onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                  >
                    <option value="">All Users</option>
                    {users.map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.first_name || user.last_name
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                          : user.user_name || user.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Level</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.level}
                    onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                  >
                    <option value="">All Levels</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                    <option value="debug">Debug</option>
                    <option value="audit">Audit</option>
                  </select>
                </div>

                {/* Action Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Action</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.action}
                    onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  >
                    <option value="">All Actions</option>
                    {uniqueActions.map((action) => (
                      <option key={action} value={action || ""}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Module Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Module</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.module}
                    onChange={(e) => setFilters({ ...filters, module: e.target.value })}
                  >
                    <option value="">All Modules</option>
                    {uniqueModules.map((module) => (
                      <option key={module} value={module || ""}>
                        {module}
                      </option>
                    ))}
                  </select>
                </div>

                {/* IP Address Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">IP Address</label>
                  <Input
                    placeholder="192.168.1.1"
                    value={filters.ip_address}
                    onChange={(e) => setFilters({ ...filters, ip_address: e.target.value })}
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                  />
                </div>
            </div>
          </CardContent>
          )}
        </Card>

          {/* Activities List */}
          <Card className="shadow-lg border-2">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
              <CardTitle className="text-xl">Activity Logs</CardTitle>
              <CardDescription>
                Showing {activities.length} of {total} activities (Page {page} of {totalPages})
              </CardDescription>
          </CardHeader>
            <CardContent className="pt-6">
              {fetchActivities.loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <div className="text-muted-foreground">Loading activities...</div>
                  </div>
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Activity className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No activities found</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {activities.map((activity) => {
                      const user = activity.user as UserType | undefined
                      return (
                        <div
                          key={activity.log_id}
                          className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                          onClick={() => handleViewDetails(activity)}
                        >
                          {/* User Avatar or Level Icon */}
                          {user ? (
                            <Avatar className="h-10 w-10 border-2 border-primary/30 flex-shrink-0">
                              {user.profile_picture_url ? (
                                <AvatarImage
                                  src={user.profile_picture_url}
                                  alt={user.first_name || user.user_name || "User"}
                                />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                                {(user.first_name?.[0] || user.user_name?.[0] || user.email?.[0] || "U").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30 flex-shrink-0">
                              {getLevelIcon(activity.level)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-medium text-sm">
                                {user?.first_name || user?.last_name
                                  ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                                  : user?.user_name || user?.email || "System"}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm font-medium capitalize">
                                {activity.action || "Unknown Action"}
                              </span>
                              {activity.module && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {activity.module}
                                  </span>
                                </>
                              )}
                              <div className="ml-auto">
                                {getLevelBadge(activity.level)}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {activity.message}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDateTime(activity.created_at)}
                              </div>
                              {activity.ip_address && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {activity.ip_address}
                                </div>
                              )}
                              {activity.device && (
                                <div className="flex items-center gap-1">
                                  <Monitor className="h-3 w-3" />
                                  {activity.device}
                                </div>
                              )}
                              {activity.browser && (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {activity.browser}
                                </div>
                              )}
                              {activity.os && (
                                <div className="flex items-center gap-1">
                                  <Monitor className="h-3 w-3" />
                                  {activity.os}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
                          disabled={page === 1 || fetchActivities.loading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages || fetchActivities.loading}
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

      {/* Activity Details Sidebar */}
      {isDetailsOpen && selectedActivity && (
          <SidePanel
            open={isDetailsOpen}
            title="Activity Details"
            description="Complete information about this activity"
            width="lg"
            onClose={() => {
              setIsDetailsOpen(false)
              setSelectedActivity(null)
            }}
            actions={
              hasPermission('manage_activity_logs') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setActivityToDelete(selectedActivity)
                    setLogToDelete(selectedActivity.log_id)
                    setIsDeleteDialogOpen(true)
                  }}
                  disabled={deleteActivityLog.loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Log
                </Button>
              )
            }
          >
            <div className="space-y-6">
              {/* Basic Info */}
              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                  <CardTitle className="flex items-center gap-2">
                    {getLevelIcon(selectedActivity.level)}
                    Activity Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Level</p>
                      <div>{getLevelBadge(selectedActivity.level)}</div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Action</p>
                      <p className="text-sm font-medium capitalize">{selectedActivity.action || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Module</p>
                      <p className="text-sm font-medium">{selectedActivity.module || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status Code</p>
                      <p className="text-sm font-medium">{selectedActivity.status_code || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Message</p>
                    <p className="text-sm">{selectedActivity.message}</p>
                  </div>
                </CardContent>
              </Card>

              {/* User Information */}
              {selectedActivity.user && (
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      User Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {/* User Profile with Avatar */}
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                        <Avatar className="h-14 w-14 border-2 border-primary/30">
                          {(selectedActivity.user as UserType)?.profile_picture_url ? (
                            <AvatarImage
                              src={(selectedActivity.user as UserType).profile_picture_url!}
                              alt={(selectedActivity.user as UserType).first_name || (selectedActivity.user as UserType).user_name || "User"}
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">
                            {((selectedActivity.user as UserType)?.first_name?.[0] || 
                              (selectedActivity.user as UserType)?.user_name?.[0] || 
                              (selectedActivity.user as UserType)?.email?.[0] || "U").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold truncate">
                            {(selectedActivity.user as UserType)?.first_name || (selectedActivity.user as UserType)?.last_name
                              ? `${(selectedActivity.user as UserType).first_name || ""} ${(selectedActivity.user as UserType).last_name || ""}`.trim()
                              : (selectedActivity.user as UserType)?.user_name || "N/A"}
                          </p>
                          {(selectedActivity.user as UserType)?.email && (
                            <p className="text-sm text-muted-foreground truncate">
                              {(selectedActivity.user as UserType).email}
                            </p>
                          )}
                          {(selectedActivity.user as UserType)?.user_name && (selectedActivity.user as UserType)?.first_name && (
                            <p className="text-xs text-muted-foreground">
                              @{(selectedActivity.user as UserType).user_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">User ID</p>
                          <p className="text-sm font-medium font-mono">{selectedActivity.user_id || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Technical Details */}
              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Technical Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                      <p className="text-sm font-medium">{selectedActivity.ip_address || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Device</p>
                      <p className="text-sm font-medium capitalize">{selectedActivity.device || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Browser</p>
                      <p className="text-sm font-medium capitalize">{selectedActivity.browser || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Operating System</p>
                      <p className="text-sm font-medium capitalize">{selectedActivity.os || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Platform</p>
                      <p className="text-sm font-medium capitalize">{selectedActivity.platform || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Method</p>
                      <p className="text-sm font-medium">{selectedActivity.method || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Endpoint</p>
                      <p className="text-sm font-medium font-mono text-xs truncate">{selectedActivity.endpoint || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Duration</p>
                      <p className="text-sm font-medium">{selectedActivity.duration_ms ? `${selectedActivity.duration_ms}ms` : "N/A"}</p>
                    </div>
                  </div>
                  {selectedActivity.user_agent && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">User Agent</p>
                      <p className="text-sm font-mono text-xs break-all">{selectedActivity.user_agent}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timestamps */}
              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Timestamps
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Created At</p>
                        <p className="text-sm font-medium">
                          {formatDateTime(selectedActivity.created_at)}
                        </p>
                      </div>
                    </div>
                    {selectedActivity.request_id && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Request ID</p>
                          <p className="text-sm font-medium font-mono">{selectedActivity.request_id}</p>
                        </div>
                      </div>
                    )}
                    {selectedActivity.session_id && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Session ID</p>
                          <p className="text-sm font-medium font-mono">{selectedActivity.session_id}</p>
                  </div>
                </div>
                    )}
            </div>
          </CardContent>
        </Card>

              {/* Metadata */}
              {selectedActivity.metadata && (
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Metadata
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-auto max-h-64">
                      {JSON.stringify(selectedActivity.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Error Details */}
              {selectedActivity.error_details && (
                <Card className="shadow-lg border-2 border-red-200 dark:border-red-900/50">
                  <CardHeader className="bg-gradient-to-r from-red-500/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-5 w-5" />
                      Error Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <pre className="text-xs font-mono bg-red-50 dark:bg-red-950/20 p-4 rounded-lg overflow-auto max-h-64 text-red-800 dark:text-red-200">
                      {JSON.stringify(selectedActivity.error_details, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
    </div>
          </SidePanel>
        )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setLogToDelete(null)
          setActivityToDelete(null)
        }}
        onConfirm={async () => {
          if (logToDelete) {
            await deleteActivityLog.execute()
          }
        }}
        title={t("delete_activity_log") || "Delete Activity Log"}
        description={
          activityToDelete
            ? `${t("delete_activity_log_confirmation") || "Are you sure you want to delete this activity log?"} ${t("action") || "Action"}: ${activityToDelete.action || 'Unknown'}. ${t("message") || "Message"}: ${activityToDelete.message || 'N/A'}`
            : t("delete_activity_log_confirmation") || "Are you sure you want to delete this activity log?"
        }
        confirmText={t("delete") || "Delete"}
        cancelText={tGeneral("cancel") || "Cancel"}
        variant="destructive"
        successMessage={t("activity_log_deleted") || "Activity log deleted successfully!"}
        autoCloseOnSuccess={true}
      />
    </MainLayout>
  )
}
