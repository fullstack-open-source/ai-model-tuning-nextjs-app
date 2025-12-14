"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { useModuleI18n } from "@context/I18nContext"
import { useApiCall } from "@hooks/useApiCall"
import { usePermissions } from "@hooks/usePermissions"
import { dashboardService } from "@services/dashboard.service"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { PermissionGuard } from "@components/permissions/PermissionGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { ChartCard } from "@components/dashboard/ChartCard"
import { LineChart } from "@components/dashboard/LineChart"
import { BarChart } from "@components/dashboard/BarChart"
import { PieChart } from "@components/dashboard/PieChart"

import {
  Users,
  UserCheck,
  TrendingUp,
  Activity,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  FileText,
  Bell,
  Loader2,
} from "lucide-react"
import { formatDate } from "@lib/utils/date-format"

interface DashboardStats {
  total_users: number
  active_users: number
  verified_users: number
  email_verified: number
  phone_verified: number
  new_today: number
  new_this_week: number
  new_this_month: number
}

interface UserGrowthData extends Record<string, string | number> {
  period: string
  count: number
}

interface ChartData extends Record<string, string | number> {
  name: string
  value: number
}

export default function DashboardPage() {
  return (
    <PageGuard 
      requireAuth={true}
      loginRedirect="/login"
    >
      <DashboardContent />
    </PageGuard>
  )
}

function DashboardContent() {
  const router = useRouter()
  const { user, apiService, groups, loading: authLoading } = useAuth()
  const { hasPermission, isAdmin, isSuperAdmin, permissions, groups: permissionGroups, refreshPermissions, isRefreshing } = usePermissions()
  const [permissionsReady, setPermissionsReady] = useState(false)
  const [hasTriedRefresh, setHasTriedRefresh] = useState(false)
  const { 
    onUserCreated, 
    onUserUpdated, 
    onUserDeleted, 
    onDashboardStatsUpdate, 
    subscribeToDashboard, 
    unsubscribeFromDashboard,
    connected 
  } = useWebSocket()
  const { t } = useModuleI18n("dashboard")
  const { t: tGeneral } = useModuleI18n("general")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [userGrowth, setUserGrowth] = useState<UserGrowthData[]>([])
  const [usersByStatus, setUsersByStatus] = useState<ChartData[]>([])
  const [usersByCountry, setUsersByCountry] = useState<ChartData[]>([])
  const [usersByType, setUsersByType] = useState<ChartData[]>([])
  const [usersByAuthType, setUsersByAuthType] = useState<ChartData[]>([])
  const [roleStats, setRoleStats] = useState<ChartData[]>([])
  const [notificationsStats, setNotificationsStats] = useState<any>(null)
  const [activityStats, setActivityStats] = useState<any>(null)
  
  // Check if permissions are loaded (from context or localStorage)
  // Auto-refresh if permissions are missing but user is authenticated
  useEffect(() => {
    if (permissions.length > 0 || permissionGroups.length > 0) {
      setPermissionsReady(true)
      return
    }
    
    // Check localStorage as fallback
    if (typeof window !== 'undefined') {
      const cachedPermissions = localStorage.getItem('auth_permissions')
      const cachedGroups = localStorage.getItem('auth_groups')
      if (cachedPermissions || cachedGroups) {
        try {
          const parsedPerms = cachedPermissions ? JSON.parse(cachedPermissions) : []
          const parsedGroups = cachedGroups ? JSON.parse(cachedGroups) : []
          if (parsedPerms.length > 0 || parsedGroups.length > 0) {
            setPermissionsReady(true)
            return
          }
        } catch {
          // Continue to refresh
        }
      }
    }
    
    // If user is authenticated but no permissions, try to refresh them
    if (user && !hasTriedRefresh && !isRefreshing) {
      console.log('🔄 No permissions found, attempting auto-refresh...')
      setHasTriedRefresh(true)
      refreshPermissions().then(() => {
        setPermissionsReady(true)
      }).catch(() => {
        setPermissionsReady(true) // Proceed anyway
      })
      return
    }
    
    // Wait a bit for permissions to load
    const timeout = setTimeout(() => {
      setPermissionsReady(true) // Proceed anyway after timeout
    }, 1500)
    
    return () => clearTimeout(timeout)
  }, [permissions, permissionGroups, user, hasTriedRefresh, isRefreshing, refreshPermissions])

  // Check user's access level
  // Admin access: super_admin group, admin group, OR view_dashboard permission
  const hasDashboardAccess = isSuperAdmin || isAdmin || hasPermission("view_dashboard")
  const userGroups = permissionGroups.length > 0 ? permissionGroups : groups

  // Debug: Log groups and permissions for troubleshooting
  useEffect(() => {
    if (user && permissionsReady) {
      console.log("🔍 Dashboard Debug Info:", {
        userId: user.user_id,
        groups: userGroups,
        groupCodenames: userGroups.map((g: any) => g?.codename || g?.name || "unknown"),
        permissionCount: permissions.length,
        samplePermissions: permissions.slice(0, 5),
        isSuperAdmin,
        isAdmin,
        hasDashboardAccess,
        hasViewDashboard: hasPermission("view_dashboard"),
        showAdminDashboard: hasDashboardAccess,
      })
      
      // Show warning if user has groups but no permissions (likely seeding issue)
      if (userGroups.length > 0 && permissions.length === 0) {
        console.warn("⚠️ User has groups assigned but no permissions. This may indicate:")
        console.warn("  1. The seed script hasn't been run (npm run seed)")
        console.warn("  2. Group permissions weren't assigned in group_permissions table")
        console.warn("  3. Redis cache has stale data (try clearing cache)")
      }
    }
  }, [user, userGroups, permissions, isSuperAdmin, isAdmin, hasDashboardAccess, permissionsReady, hasPermission])

  // Set authenticated API service
  useEffect(() => {
    if (apiService) {
      dashboardService.setAuthApi(apiService)
    }
  }, [apiService])

  // Helper to update stats from data
  // Note: useApiCall passes response.data to onSuccess, not the full response
  const updateStatsFromData = (data: unknown) => {
    try {
      // useApiCall extracts response.data and passes it here
      // So data is: { overview: { total_users: ..., ... } }
      const responseData = data as { 
        overview?: { 
          total_users?: number; 
          active_users?: number; 
          verified_users?: number; 
          email_verified?: number; 
          phone_verified?: number; 
          new_users?: { 
            today?: number; 
            this_week?: number; 
            this_month?: number 
          } 
        } 
      };
      
      // Extract overview from the data
      const overview = responseData?.overview;
      
      if (overview) {
        setStats({
          total_users: Number(overview.total_users) || 0,
          active_users: Number(overview.active_users) || 0,
          verified_users: Number(overview.verified_users) || 0,
          email_verified: Number(overview.email_verified) || 0,
          phone_verified: Number(overview.phone_verified) || 0,
          new_today: Number(overview.new_users?.today) || 0,
          new_this_week: Number(overview.new_users?.this_week) || 0,
          new_this_month: Number(overview.new_users?.this_month) || 0,
        })
      } else {
        // If no overview data, set defaults to 0
        setStats({
          total_users: 0,
          active_users: 0,
          verified_users: 0,
          email_verified: 0,
          phone_verified: 0,
          new_today: 0,
          new_this_week: 0,
          new_this_month: 0,
        })
      }
    } catch (error) {
      // On error, set defaults
      setStats({
        total_users: 0,
        active_users: 0,
        verified_users: 0,
        email_verified: 0,
        phone_verified: 0,
        new_today: 0,
        new_this_week: 0,
        new_this_month: 0,
      })
    }
  }

  // Fetch dashboard data
  const fetchOverview = useApiCall(
    async () => {
      return await dashboardService.getOverview()
    },
    {
      onSuccess: updateStatsFromData,
      onError: (error) => {
        // Set defaults on error
        setStats({
          total_users: 0,
          active_users: 0,
          verified_users: 0,
          email_verified: 0,
          phone_verified: 0,
          new_today: 0,
          new_this_week: 0,
          new_this_month: 0,
        })
      },
    }
  )

  const refreshOverview = useApiCall(
    async () => {
      return await dashboardService.refreshOverview()
    },
    {
      onSuccess: updateStatsFromData,
      onError: (error) => {
        // Set defaults on error
        setStats({
          total_users: 0,
          active_users: 0,
          verified_users: 0,
          email_verified: 0,
          phone_verified: 0,
          new_today: 0,
          new_this_week: 0,
          new_this_month: 0,
        })
      },
    }
  )

  const fetchUserGrowth = useApiCall(
    async () => {
      const response = await dashboardService.getUserGrowth(30)
      return response as any
    },
    {
      onSuccess: (data: any) => {
        // useApiCall passes response.data, so data is: { period: '...', growth: [...] }
        const growthData = data?.growth || data?.data?.growth || []
        setUserGrowth(growthData.map((item: any) => ({
          period: item.period ? formatDate(item.period) : '',
          count: Number(item.count) || 0
        })))
      },
      onError: () => {
        setUserGrowth([])
      }
    }
  )

  const fetchUsersByStatus = useApiCall(
    async () => {
      const response = await dashboardService.getUsersByStatus()
      return response as any
    },
    {
      onSuccess: (data: any) => {
        // useApiCall passes response.data, so data is: { users_by_status: [...] }
        const statusData = data?.users_by_status || data?.data?.users_by_status || []
        setUsersByStatus(statusData.map((item: any) => ({
          name: item.status || 'Unknown',
          value: Number(item.count) || 0
        })))
      },
      onError: () => {
        setUsersByStatus([])
      }
    }
  )

  const fetchUsersByCountry = useApiCall(
    async () => {
      const response = await dashboardService.getUsersByCountry()
      return response as any
    },
    {
      onSuccess: (data: any) => {
        // useApiCall passes response.data, so data is: { users_by_country: [...] }
        const countryData = data?.users_by_country || data?.data?.users_by_country || []
        setUsersByCountry(countryData.slice(0, 10).map((item: any) => ({
          name: item.country || 'Unknown',
          value: Number(item.count) || 0
        })))
      },
      onError: () => {
        setUsersByCountry([])
      }
    }
  )

  const fetchUsersByType = useApiCall(
    async () => {
      const response = await dashboardService.getUsersByType()
      return response as any
    },
    {
      onSuccess: (data: any) => {
        // useApiCall passes response.data, so data is: { users_by_type: [...] }
        const typeData = data?.users_by_type || data?.data?.users_by_type || []
        setUsersByType(typeData.map((item: any) => ({
          name: item.user_type || 'Unknown',
          value: Number(item.count) || 0
        })))
      },
      onError: () => {
        setUsersByType([])
      }
    }
  )

  const fetchUsersByAuthType = useApiCall(
    async () => {
      const response = await dashboardService.getUsersByAuthType()
      return response as any
    },
    {
      onSuccess: (data: any) => {
        // useApiCall passes response.data, so data is: { users_by_auth_type: [...] }
        const authData = data?.users_by_auth_type || data?.data?.users_by_auth_type || []
        setUsersByAuthType(authData.map((item: any) => ({
          name: item.auth_type || 'Unknown',
          value: Number(item.count) || 0
        })))
      },
      onError: () => {
        setUsersByAuthType([])
      }
    }
  )

  const fetchRoleStats = useApiCall(
    async () => {
      const response = await dashboardService.getRoleStatistics()
      return response as any
    },
    {
      onSuccess: (data: any) => {
        const roleData = data?.data?.role_statistics || []
        setRoleStats(roleData.map((item: any) => ({
          name: item.role || 'Unknown',
          value: item.count || 0
        })))
      }
    }
  )

  const fetchNotificationsStats = useApiCall(
    async () => {
      const response = await dashboardService.getNotificationsStats()
      return response as any  
    },
    {
      onSuccess: (data: any) => {
        setNotificationsStats(data?.data || null)
      }
    }
  )

  const fetchActivityStats = useApiCall(
    async () => {
      const response = await dashboardService.getActivityStats()
      return response as any
    },
    {
      onSuccess: (data: any) => {
        setActivityStats(data?.data || null)
      }
    }
  )

  // Helper function to refresh all dashboard data
  const refreshAllDashboardData = useCallback(() => {
    if (!user || !hasDashboardAccess) return;
    
    // Refresh overview
    if (hasPermission('view_dashboard') || isAdmin || isSuperAdmin) {
      refreshOverview.execute()
    }
    
    // Refresh statistics
    if (hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) {
      fetchUserGrowth.execute()
      fetchUsersByStatus.execute()
      fetchUsersByCountry.execute()
      fetchUsersByType.execute()
      fetchUsersByAuthType.execute()
      fetchRoleStats.execute()
    }
    
    // Refresh additional stats - requires view_dashboard_statistics permission
    if (hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) {
      fetchNotificationsStats.execute()
      fetchActivityStats.execute()
    }
  }, [user, hasDashboardAccess, hasPermission, isAdmin, isSuperAdmin])

  // Load all dashboard data - only call APIs user has permission for
  useEffect(() => {
    if (authLoading) return;
    
    if (user && hasDashboardAccess) {
      // Only fetch overview if user has view_dashboard permission
      if (hasPermission('view_dashboard') || isAdmin || isSuperAdmin) {
        // Force fetch on mount to ensure data loads
        fetchOverview.execute()
      }
      
      // Only fetch statistics if user has view_dashboard_statistics permission
      if (hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) {
        fetchUserGrowth.execute()
        fetchUsersByStatus.execute()
        fetchUsersByCountry.execute()
        fetchUsersByType.execute()
        fetchUsersByAuthType.execute()
        fetchRoleStats.execute()
      }
      
      // Load additional stats based on permissions
      // Note: notifications-stats API requires view_dashboard_statistics permission
      if (hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) {
        fetchNotificationsStats.execute()
        fetchActivityStats.execute()
      }
    }
    // Don't redirect - show user dashboard if no admin access
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, hasDashboardAccess, router, isAdmin, isSuperAdmin, hasPermission])

  // Subscribe to dashboard room for real-time updates
  useEffect(() => {
    if (!connected || !hasDashboardAccess) return;

    // Subscribe to dashboard room to receive real-time updates
    subscribeToDashboard();

    // Cleanup - unsubscribe when leaving dashboard
    return () => {
      unsubscribeFromDashboard();
    };
  }, [connected, hasDashboardAccess, subscribeToDashboard, unsubscribeFromDashboard]);

  // Subscribe to WebSocket events for real-time updates
  useEffect(() => {
    if (!connected) return;

    // Subscribe to user events - refresh dashboard when users are created/updated/deleted
    const unsubUserCreated = onUserCreated(() => {
      refreshAllDashboardData();
    });

    const unsubUserUpdated = onUserUpdated(() => {
      refreshAllDashboardData();
    });

    const unsubUserDeleted = onUserDeleted(() => {
      refreshAllDashboardData();
    });

    // Subscribe to dashboard stats update event
    const unsubDashboardStats = onDashboardStatsUpdate(() => {
      refreshAllDashboardData();
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubUserCreated();
      unsubUserUpdated();
      unsubUserDeleted();
      unsubDashboardStats();
    };
  }, [connected, onUserCreated, onUserUpdated, onUserDeleted, onDashboardStatsUpdate, refreshAllDashboardData])
  
  // Show loading while auth or permissions are loading
  if (authLoading || !permissionsReady || isRefreshing) {
    return (
      <MainLayout
        title={t("dashboard")}
        description={tGeneral("loading")}
      >
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">
                {authLoading ? tGeneral("loading") : isRefreshing ? "Refreshing permissions..." : "Loading permissions..."}
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  // Admin stats cards
  const adminStatCards = [
    {
      title: t("total_users"),
      value: stats?.total_users || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      permission: "view_users",
    },
    {
      title: t("active_users"),
      value: stats?.active_users || 0,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
      permission: "view_users",
    },
    {
      title: t("verified_users"),
      value: stats?.verified_users || 0,
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      permission: "view_users",
    },
    {
      title: t("new_today"),
      value: stats?.new_today || 0,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
      permission: "view_dashboard",
    },
    {
      title: t("email_verified"),
      value: stats?.email_verified || 0,
      icon: Mail,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
      permission: "view_users",
    },
    {
      title: t("phone_verified"),
      value: stats?.phone_verified || 0,
      icon: Phone,
      color: "text-pink-600",
      bgColor: "bg-pink-100 dark:bg-pink-900/20",
      permission: "view_users",
    },
  ]
  
  // Filter stat cards based on permissions
  const statCards = adminStatCards.filter((card) => {
    if (isSuperAdmin) return true;
    if (isAdmin) return true;
    if (card.permission) {
      return hasPermission(card.permission);
    }
    return true;
  })
  
  const showAdminDashboard = hasDashboardAccess

  if (!user) {
    return null
  }

  return (
    <MainLayout
      title={t("dashboard")}
      description={`${tGeneral("welcome_back")}, ${user.first_name || user.user_name}!`}
      actions={
        <div className="flex gap-2">
          {/* Refresh Permissions Button - Always visible for debugging */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refreshPermissions().then(() => {
                // Also refresh dashboard data after permissions update
                if (hasPermission('view_dashboard') || isAdmin || isSuperAdmin) {
                  refreshOverview.execute()
                }
              })
            }}
            disabled={isRefreshing}
            className="gap-2"
            title="Refresh your permissions from the server"
          >
            <Shield className="h-4 w-4" />
            {isRefreshing ? "Refreshing..." : "Reload Access"}
          </Button>
          
          {/* Dashboard Data Refresh Button */}
          {showAdminDashboard && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Only refresh APIs user has permission for
                if (hasPermission('view_dashboard') || isAdmin || isSuperAdmin) {
                  refreshOverview.execute()
                }
                
                if (hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) {
                  fetchUserGrowth.execute()
                  fetchUsersByStatus.execute()
                  fetchUsersByCountry.execute()
                  fetchUsersByType.execute()
                  fetchUsersByAuthType.execute()
                  fetchRoleStats.execute()
                  fetchNotificationsStats.execute()
                  fetchActivityStats.execute()
                }
              }}
              disabled={refreshOverview.loading}
              loading={refreshOverview.loading}
              loadingText={tGeneral("refreshing")}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {tGeneral("refresh")}
            </Button>
          )}
        </div>
      }
    >
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header with badges */}
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
              <Shield className="h-3 w-3" />
              {tGeneral("super_admin")}
            </span>
          )}
          {isAdmin && !isSuperAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              <Shield className="h-3 w-3" />
              {tGeneral("admin")}
            </span>
          )}
        </div>

        {/* Admin Stats Grid */}
        {showAdminDashboard && statCards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {statCards.map((stat, index) => (
              <Card key={index} className="transition-all hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.title === t("new_today") && stats?.new_this_week
                      ? `${stats.new_this_week} ${t("this_week").toLowerCase()}`
                      : stat.title === t("total_users") && stats?.active_users
                        ? `${stats.active_users} ${t("active").toLowerCase()}`
                        : t("updated_just_now")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Charts Section - Admin Dashboard */}
        {showAdminDashboard && (
          <div className="space-y-6">
            {/* User Growth Chart - Only show if user has view_dashboard_statistics permission */}
            {(hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) && (
              <ChartCard
                title={t("user_growth_30_days")}
                description={t("daily_registrations")}
              >
              {fetchUserGrowth.loading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : userGrowth.length > 0 ? (
                <LineChart
                  data={userGrowth}
                  dataKey="period"
                  lines={[
                    { key: "count", name: t("new_users"), color: "#3b82f6" }
                  ]}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-sm font-medium text-muted-foreground">{t("no_data_available")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("data_will_appear_here")}</p>
                </div>
              )}
              </ChartCard>
            )}

            {/* Charts Grid - Only show if user has view_dashboard_statistics permission */}
            {(hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) && (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Users by Status */}
                <ChartCard
                title="Users by Status"
                description="Distribution of user statuses"
              >
                {fetchUsersByStatus.loading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : usersByStatus.length > 0 ? (
                  <PieChart data={usersByStatus} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">User status data will appear here</p>
                  </div>
                )}
              </ChartCard>

              {/* Users by Type */}
              <ChartCard
                title="Users by Type"
                description="Distribution of user types"
              >
                {fetchUsersByType.loading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : usersByType.length > 0 ? (
                  <PieChart data={usersByType} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <UserCheck className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">User type data will appear here</p>
                  </div>
                )}
              </ChartCard>

              {/* Users by Auth Type */}
              <ChartCard
                title="Users by Authentication Type"
                description="Distribution of authentication methods"
              >
                {fetchUsersByAuthType.loading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : usersByAuthType.length > 0 ? (
                  <BarChart
                    data={usersByAuthType}
                    dataKey="name"
                    bars={[
                      { key: "value", name: "Users", color: "#10b981" }
                    ]}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Shield className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Authentication type data will appear here</p>
                  </div>
                )}
              </ChartCard>

              {/* Role Statistics */}
              <ChartCard
                title="Users by Role"
                description="Distribution of user roles/groups"
              >
                {fetchRoleStats.loading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : roleStats.length > 0 ? (
                  <BarChart
                    data={roleStats}
                    dataKey="name"
                    bars={[
                      { key: "value", name: "Users", color: "#8b5cf6" }
                    ]}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Shield className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Role statistics will appear here</p>
                  </div>
                )}
              </ChartCard>
            </div>
            )}

            {/* Users by Country - Only show if user has view_dashboard_statistics permission */}
            {(hasPermission('view_dashboard_statistics') || isAdmin || isSuperAdmin) && (
              <ChartCard
                title="Top 10 Countries"
                description="User distribution by country"
              >
                {fetchUsersByCountry.loading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : usersByCountry.length > 0 ? (
                  <BarChart
                    data={usersByCountry}
                    dataKey="name"
                    bars={[
                      { key: "value", name: "Users", color: "#f59e0b" }
                    ]}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Country distribution will appear here</p>
                  </div>
                )}
              </ChartCard>
            )}

            {/* Notifications Stats */}
            {(hasPermission('view_notification') || isAdmin || isSuperAdmin) && notificationsStats && (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-2xl font-bold">{notificationsStats.total || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Unread</span>
                        <span className="text-xl font-semibold text-red-600">{notificationsStats.unread || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Read</span>
                        <span className="text-xl font-semibold text-green-600">{notificationsStats.read || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ChartCard
                  title="Notifications by Type"
                  description="Distribution of notification types"
                >
                  {notificationsStats.by_type && notificationsStats.by_type.length > 0 ? (
                    <PieChart
                      data={notificationsStats.by_type.map((item: any) => ({
                        name: item.type || 'Unknown',
                        value: item.count || 0
                      }))}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                      <p className="text-sm font-medium text-muted-foreground">No data available</p>
                      <p className="text-xs text-muted-foreground mt-1">Notification type data will appear here</p>
                    </div>
                  )}
                </ChartCard>
              </div>
            )}

            {/* Activity Stats */}
            {(hasPermission('view_activity_log') || isAdmin || isSuperAdmin) && activityStats && (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Activity Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Logs</span>
                        <span className="text-2xl font-bold">{activityStats.total || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Today</span>
                        <span className="text-xl font-semibold text-blue-600">{activityStats.today || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">This Week</span>
                        <span className="text-xl font-semibold text-indigo-600">{activityStats.this_week || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Errors</span>
                        <span className="text-xl font-semibold text-red-600">{activityStats.errors || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ChartCard
                  title="Activity by Level"
                  description="Distribution of activity log levels"
                >
                  {activityStats.by_level && activityStats.by_level.length > 0 ? (
                    <PieChart
                      data={activityStats.by_level.map((item: any) => ({
                        name: item.level || 'Unknown',
                        value: item.count || 0
                      }))}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                      <p className="text-sm font-medium text-muted-foreground">No data available</p>
                      <p className="text-xs text-muted-foreground mt-1">Activity level data will appear here</p>
                    </div>
                  )}
                </ChartCard>
              </div>
            )}

            {/* Activity by Module */}
            {(hasPermission('view_activity_log') || isAdmin || isSuperAdmin) && activityStats && (
              <ChartCard
                title="Activity by Module"
                description="Distribution of activities by module"
              >
                {activityStats.by_module && activityStats.by_module.length > 0 ? (
                  <BarChart
                    data={activityStats.by_module.map((item: any) => ({
                      name: item.module || 'Unknown',
                      value: item.count || 0
                    }))}
                    dataKey="name"
                    bars={[
                      { key: "value", name: "Activities", color: "#06b6d4" }
                    ]}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">No data available</p>
                    <p className="text-xs text-muted-foreground mt-1">Activity module data will appear here</p>
                  </div>
                )}
              </ChartCard>
            )}
          </div>
        )}

        {/* User Dashboard - For non-admin users */}
        {!showAdminDashboard && (
          <div className="space-y-6">
            {/* User Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="transition-all hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    My Profile
                  </CardTitle>
                  <div className="rounded-lg p-2 bg-blue-100 dark:bg-blue-900/20">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">100%</div>
                  <p className="text-xs text-muted-foreground">
                    {user?.email || "Complete your profile"}
                  </p>
                </CardContent>
              </Card>

              <PermissionGuard
                requireAnyPermission={["view_notification"]}
                fallback={null}
              >
                <Card className="transition-all hover:shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Notifications
                    </CardTitle>
                    <div className="rounded-lg p-2 bg-purple-100 dark:bg-purple-900/20">
                      <Bell className="h-4 w-4 text-purple-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">-</div>
                    <p className="text-xs text-muted-foreground">
                      View your notifications
                    </p>
                  </CardContent>
                </Card>
              </PermissionGuard>
            </div>

            {/* User Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <PermissionGuard
                    requireAnyPermission={["view_profile", "edit_profile"]}
                    fallback={null}
                  >
                    <Button
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() => router.push("/profile-settings")}
                    >
                      <UserCheck className="h-4 w-4" />
                      Profile & Settings
                    </Button>
                  </PermissionGuard>

                  <PermissionGuard
                    requireAnyPermission={["view_notification"]}
                    fallback={null}
                  >
                    <Button
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() => router.push("/notifications")}
                    >
                      <Bell className="h-4 w-4" />
                      Notifications
                    </Button>
                  </PermissionGuard>

                  <PermissionGuard
                    requireAnyPermission={["view_own_activity_log"]}
                    fallback={null}
                  >
                    <Button
                      variant="outline"
                      className="justify-start gap-2"
                      onClick={() => router.push("/activity")}
                    >
                      <Activity className="h-4 w-4" />
                      My Activity
                    </Button>
                  </PermissionGuard>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Group Information Display - Shows user's access level */}
        {userGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Access Level</CardTitle>
              <CardDescription>Your groups determine what content you can see</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {userGroups.map((group) => (
                  <span
                    key={group.group_id}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                      group.codename === "super_admin"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
                        : group.codename === "admin"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300"
                    }`}
                  >
                    <Shield className="mr-1 h-3 w-3" />
                    {group.name}
                  </span>
                ))}
              </div>
              {permissions.length > 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  You have {permissions.length} permission{permissions.length !== 1 ? "s" : ""} from your groups
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions - Admin Dashboard */}
        {showAdminDashboard && (
          <Card>
            <CardHeader>
              <CardTitle>{t("quick_actions")}</CardTitle>
              <CardDescription>{t("common_tasks")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                <PermissionGuard
                  requireAnyPermission={["view_users", "manage_users"]}
                  fallback={null}
                >
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => router.push("/admin/users")}
                  >
                    <Users className="h-4 w-4" />
                    {t("manage_users")}
                  </Button>
                </PermissionGuard>
                
                <PermissionGuard
                  requireAnyPermission={["view_activity_log", "view_dashboard"]}
                  fallback={null}
                >
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => router.push("/activity")}
                  >
                    <Activity className="h-4 w-4" />
                    {tGeneral("activity_logs")}
                  </Button>
                </PermissionGuard>
                
                <PermissionGuard
                  requireAnyPermission={["view_profile", "edit_profile"]}
                  fallback={null}
                >
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => router.push("/profile-settings")}
                  >
                    <UserCheck className="h-4 w-4" />
                    {t("profile_settings")}
                  </Button>
                </PermissionGuard>
                
                <PermissionGuard requireSuperAdmin fallback={null}>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => router.push("/admin/groups")}
                  >
                    <Shield className="h-4 w-4" />
                    {t("manage_groups")}
                  </Button>
                </PermissionGuard>
                
                <PermissionGuard requireSuperAdmin fallback={null}>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => router.push("/admin/permissions")}
                  >
                    <FileText className="h-4 w-4" />
                    {t("manage_permissions")}
                  </Button>
                </PermissionGuard>

                <PermissionGuard
                  requireAnyPermission={["view_notification", "manage_notifications"]}
                  fallback={null}
                >
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => router.push("/notifications")}
                  >
                    <Bell className="h-4 w-4" />
                    {t("notifications")}
                  </Button>
                </PermissionGuard>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}

