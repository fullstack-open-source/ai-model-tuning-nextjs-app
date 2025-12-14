"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useApiCall } from "@hooks/useApiCall"
import { usePermissions } from "@hooks/usePermissions"
import { systemAnalyticsService } from "@services/system-analytics.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import type { ApiResponse } from "@models/api.model"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@components/ui/tabs"
import { LogViewer } from "@components/system-analytics/LogViewer"
import {
  AlertTriangle,
  FileText,
  Info,
  Container,
  List,
  RefreshCw,
  Heart,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Database,
  Eye,
  Trash2,
} from "lucide-react"
import type {
  LogFile,
  LogEntry,
  SystemInfo,
  DockerStatus,
  Process,
  RedisCacheStats,
  RedisKeyDetails,
} from "@services/system-analytics.service"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { SidePanel } from "@components/ui/side-panel"
import { Switch } from "@components/ui/switch"

// JSON Viewer Component with syntax highlighting
function JsonViewer({ data, isString = false }: { data: unknown; isString?: boolean }) {
  const formatJson = (obj: unknown): React.ReactNode => {
    if (obj === null) {
      return <span className="text-[#569cd6]">null</span>
    }
    
    if (obj === undefined) {
      return <span className="text-[#569cd6]">undefined</span>
    }

    if (typeof obj === "string") {
      return <span className="text-[#ce9178]">&quot;{obj}&quot;</span>
    }

    if (typeof obj === "number") {
      return <span className="text-[#b5cea8]">{obj}</span>
    }

    if (typeof obj === "boolean") {
      return <span className="text-[#569cd6]">{obj ? "true" : "false"}</span>
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return <span className="text-[#808080]">[]</span>
      }
      return (
        <>
          <span className="text-[#808080]">[</span>
          <div className="ml-4">
            {obj.map((item, index) => (
              <div key={index} className="flex">
                <span className="text-[#808080] mr-2">{index}:</span>
                <div className="flex-1">
                  {formatJson(item)}
                  {index < obj.length - 1 && <span className="text-[#808080]">,</span>}
                </div>
              </div>
            ))}
          </div>
          <span className="text-[#808080]">]</span>
        </>
      )
    }

    if (typeof obj === "object") {
      const keys = Object.keys(obj)
      if (keys.length === 0) {
        return <span className="text-[#808080]">{`{}`}</span>
      }
      return (
        <>
          <span className="text-[#808080]">{`{`}</span>
          <div className="ml-4">
            {keys.map((key, index) => (
              <div key={key} className="flex">
                <span className="text-[#9cdcfe]">&quot;{key}&quot;</span>
                <span className="text-[#808080] mx-2">:</span>
                <div className="flex-1">
                  {formatJson((obj as Record<string, unknown>)[key])}
                  {index < keys.length - 1 && <span className="text-[#808080]">,</span>}
                </div>
              </div>
            ))}
          </div>
          <span className="text-[#808080]">{`}`}</span>
        </>
      )
    }

    return <span className="text-[#808080]">{String(obj)}</span>
  }

  const renderContent = () => {
    if (isString && typeof data === "string") {
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(data)
        return formatJson(parsed)
      } catch {
        // If not valid JSON, display as string
        return <span className="text-[#ce9178] whitespace-pre-wrap break-words">{data}</span>
      }
    }
    return formatJson(data)
  }

  return (
    <pre className="text-sm font-mono leading-relaxed">
      {renderContent()}
    </pre>
  )
}

export default function SystemAnalyticsPage() {
  return (
    <PageGuard requireAnyPermission={["view_system_analytics", "manage_system_analytics"]}>
      <SystemAnalyticsContent />
    </PageGuard>
  )
}

function SystemAnalyticsContent() {
  const router = useRouter()
  const { user, tokens, loading: authLoading } = useAuth()
  const { hasPermission, isAdmin, isSuperAdmin } = usePermissions()
  const [activeTab, setActiveTab] = useState("errors")
  const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null)
  
  // Data states
  const [recentErrors, setRecentErrors] = useState<LogEntry[]>([])
  const [errorCount, setErrorCount] = useState(0)
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [logStats, setLogStats] = useState<{
    files: LogFile[];
    totalFiles: number;
    totalSize: number;
    totalSizeFormatted: string;
    totalLines: number;
    byLevel: Record<string, number>;
    byModule: Record<string, number>;
  } | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null)
  const [topProcesses, setTopProcesses] = useState<Process[]>([])
  const [systemHealthy, setSystemHealthy] = useState(true)
  const [cacheStats, setCacheStats] = useState<RedisCacheStats | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [keyDetails, setKeyDetails] = useState<RedisKeyDetails | null>(null)
  const [deleteKeyDialog, setDeleteKeyDialog] = useState<{ open: boolean; key: string | null }>({ open: false, key: null })
  const [flushCacheDialog, setFlushCacheDialog] = useState<boolean>(false)
  const [filterOwnKeys, setFilterOwnKeys] = useState<boolean>(false)

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
        systemAnalyticsService.setAuthApi(authenticatedApi)
      }
    }
  }, [tokens])

  // Helper function to ensure auth API is set
  const ensureAuthApiSet = () => {
    if (!tokens) return false
    
    // Check if auth API is already set by trying to access it
    // We'll set it again to be sure
    const authHeaders: Record<string, string> = {}
    if (tokens.session_token) {
      authHeaders["X-Session-Token"] = tokens.session_token
    } else if (tokens.access_token && tokens.token_type) {
      authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`
    }

    if (Object.keys(authHeaders).length > 0) {
      const authenticatedApi = createPublicApiService(authHeaders)
      systemAnalyticsService.setAuthApi(authenticatedApi)
      return true
    }
    return false
  }

  // Check access
  const hasDashboardAccess = isSuperAdmin || isAdmin || hasPermission("view_dashboard")

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (!hasDashboardAccess) {
      router.push("/dashboard")
      return
    }
  }, [user, authLoading, hasDashboardAccess, router])

  // Load from API (middleware handles caching automatically)
  const loadData = async (tab: string) => {
    try {
      switch (tab) {
        case "errors": {
          const data = await systemAnalyticsService.getRecentErrors(5)
          if (data) {
            setRecentErrors(data.errors || [])
            setErrorCount(data.count || 0)
          }
          break
        }
        case "logs": {
          const [statsData, files] = await Promise.all([
            systemAnalyticsService.getLogStatistics(),
            systemAnalyticsService.getLogFiles()
          ])
          if (statsData) {
            setLogStats(statsData)
          }
          setLogFiles(files || [])
          break
        }
        case "system": {
          const data = await systemAnalyticsService.getSystemInfo()
          if (data) {
            setSystemInfo(data)
            const memUsage = parseFloat(data.memory.usagePercent)
            const cpuLoad = data.cpu.loadAverage[0] || 0
            setSystemHealthy(memUsage < 90 && cpuLoad < 10)
          }
          break
        }
        case "docker": {
          const data = await systemAnalyticsService.getDockerStatus()
          if (data) {
            setDockerStatus(data)
          }
          break
        }
        case "processes": {
          const data = await systemAnalyticsService.getTopProcesses(10)
          if (data) {
            setTopProcesses(data.processes || [])
          }
          break
        }
        case "cache": {
          const data = await systemAnalyticsService.getCacheStats(filterOwnKeys)
          if (data) {
            setCacheStats(data)
          }
          break
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  // Refresh from API (force API call and update cache)
  const fetchRecentErrors = useApiCall(
    async () => {
      if (!ensureAuthApiSet()) throw new Error('Auth API not set');
      const data = await systemAnalyticsService.refreshRecentErrors(5)
      return { success: true, data, message: 'Recent errors retrieved' } as ApiResponse<{ errors: LogEntry[]; count: number; total: number }>
    },
    {
      onSuccess: (data: { errors: LogEntry[]; count: number; total: number }) => {
        setRecentErrors(data.errors || [])
        setErrorCount(data.count || 0)
      },
      showErrorToast: false, // Don't show toast for individual errors in batch refresh
    }
  )

  // Refresh log statistics from API
  const fetchLogStatistics = useApiCall(
    async () => {
      if (!ensureAuthApiSet()) throw new Error('Auth API not set');
      const stats = await systemAnalyticsService.refreshLogStatistics()
      const files = await systemAnalyticsService.getLogFiles()
      return { success: true, data: { stats, files }, message: 'Log statistics retrieved' } as ApiResponse<{ stats: typeof logStats; files: LogFile[] }>
    },
    {
      onSuccess: (data: { stats: typeof logStats; files: LogFile[] }) => {
        setLogStats(data.stats)
        setLogFiles(data.files || [])
      },
      showErrorToast: false, // Don't show toast for individual errors in batch refresh
    }
  )

  // Refresh system information from API
  const fetchSystemInfo = useApiCall(
    async () => {
      if (!ensureAuthApiSet()) throw new Error('Auth API not set');
      const data = await systemAnalyticsService.refreshSystemInfo()
      return { success: true, data, message: 'System info retrieved' } as ApiResponse<SystemInfo>
    },
    {
      onSuccess: (data: SystemInfo) => {
        setSystemInfo(data)
        // Determine system health based on memory and CPU usage
        const memUsage = parseFloat(data.memory.usagePercent)
        const cpuLoad = data.cpu.loadAverage[0] || 0
        setSystemHealthy(memUsage < 90 && cpuLoad < 10)
      },
      showErrorToast: false, // Don't show toast for individual errors in batch refresh
    }
  )

  // Refresh Docker status from API
  const fetchDockerStatus = useApiCall(
    async () => {
      if (!ensureAuthApiSet()) throw new Error('Auth API not set');
      const data = await systemAnalyticsService.refreshDockerStatus()
      return { success: true, data, message: 'Docker status retrieved' } as ApiResponse<DockerStatus>
    },
    {
      onSuccess: (data: DockerStatus) => {
        setDockerStatus(data)
      },
      showErrorToast: false, // Don't show toast for individual errors in batch refresh
    }
  )

  // Refresh top processes from API
  const fetchTopProcesses = useApiCall(
    async () => {
      if (!ensureAuthApiSet()) throw new Error('Auth API not set');
      const data = await systemAnalyticsService.refreshTopProcesses(10)
      return { success: true, data: data.processes, message: 'Top processes retrieved' } as ApiResponse<Process[]>
    },
    {
      onSuccess: (data: Process[]) => {
        setTopProcesses(data || [])
      },
      showErrorToast: false, // Don't show toast for individual errors in batch refresh
    }
  )

  // Refresh cache statistics from API
  const fetchCacheStats = useApiCall(
    async () => {
      if (!ensureAuthApiSet()) throw new Error('Auth API not set');
      const data = await systemAnalyticsService.refreshCacheStats(filterOwnKeys)
      return { success: true, data, message: 'Cache statistics retrieved' } as ApiResponse<RedisCacheStats>
    },
    {
      onSuccess: (data: RedisCacheStats) => {
        setCacheStats(data)
      },
      showErrorToast: false, // Don't show toast for individual errors in batch refresh
    }
  )

  // Fetch key details
  const fetchKeyDetails = useApiCall(
    async () => {
      if (!selectedKey) throw new Error('No key selected')
      if (!tokens) throw new Error('Authentication required')
      
      // Ensure auth API is set before making the call
      if (!ensureAuthApiSet()) {
        throw new Error('Failed to initialize authentication')
      }
      
      const data = await systemAnalyticsService.getKeyDetails(selectedKey)
      return { success: true, data, message: 'Key details retrieved' } as ApiResponse<RedisKeyDetails>
    },
    {
      onSuccess: (data: RedisKeyDetails | null) => {
        setKeyDetails(data)
      },
    }
  )

  // Delete key
  const deleteKey = useApiCall(
    async () => {
      if (!deleteKeyDialog.key) return { success: false, message: 'No key selected' } as ApiResponse<void>
      await systemAnalyticsService.deleteKey(deleteKeyDialog.key)
      return { success: true, message: 'Key deleted successfully' } as ApiResponse<void>
    },
    {
      onSuccess: () => {
        setDeleteKeyDialog({ open: false, key: null })
        fetchCacheStats.execute()
        if (selectedKey === deleteKeyDialog.key) {
          setSelectedKey(null)
          setKeyDetails(null)
        }
      },
      successMessage: "Key deleted successfully",
      showSuccessToast: true,
    }
  )

  // Flush all cache
  const flushCache = useApiCall(
    async () => {
      await systemAnalyticsService.flushCache()
      return { success: true, message: 'All cache keys flushed successfully' } as ApiResponse<void>
    },
    {
      onSuccess: () => {
        setFlushCacheDialog(false)
        fetchCacheStats.execute()
        setSelectedKey(null)
        setKeyDetails(null)
      },
      successMessage: "All cache keys flushed successfully",
      showSuccessToast: true,
    }
  )

  // Load data on initial load (middleware handles caching)
  useEffect(() => {
    if (!hasDashboardAccess) return
    loadData("system")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDashboardAccess])

  // Load from cache when tab changes - no API call
  useEffect(() => {
    if (!hasDashboardAccess) return
    loadData(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hasDashboardAccess])

  // Reload cache stats when filter changes
  useEffect(() => {
    if (activeTab === "cache" && hasDashboardAccess && tokens) {
      loadData("cache")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOwnKeys, hasDashboardAccess, tokens])

  // Fetch key details when selected
  useEffect(() => {
    if (selectedKey && activeTab === "cache" && tokens) {
      // Small delay to ensure auth API is set
      const timer = setTimeout(() => {
        if (ensureAuthApiSet()) {
          fetchKeyDetails.execute()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, activeTab, tokens])

  // Check if any fetch is loading
  const isRefreshing = fetchRecentErrors.loading || fetchLogStatistics.loading || 
    fetchSystemInfo.loading || fetchDockerStatus.loading || 
    fetchTopProcesses.loading || fetchCacheStats.loading

  // Refresh all data
  const handleRefresh = async () => {
    // Ensure auth API is set before refreshing
    if (!ensureAuthApiSet()) {
      console.warn('Auth API not set, skipping refresh')
      return
    }
    
    // Execute all refresh calls in parallel, but don't throw errors
    // Each useApiCall will handle its own errors
    try {
      await Promise.allSettled([
        fetchRecentErrors.execute(),
        fetchLogStatistics.execute(),
        fetchSystemInfo.execute(),
        fetchDockerStatus.execute(),
        fetchTopProcesses.execute(),
        fetchCacheStats.execute(),
      ])
    } catch (error) {
      // Errors are handled by individual useApiCall hooks
      console.error('Error during refresh:', error)
    }
  }


  if (authLoading || !user || !hasDashboardAccess) {
    return (
      <MainLayout title="System Analytics">
        <div className="flex-1 container mx-auto p-4 md:p-6 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="System Analytics"
      description="Real-time system monitoring and audit logs"
      actions={
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          className="flex-shrink-0 gap-2"
          disabled={isRefreshing}
          loading={isRefreshing}
          loadingText="Refreshing..."
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh Now</span>
          <span className="sm:hidden">Refresh</span>
        </Button>
      }
    >
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 max-w-full">

        {/* System Status */}
        <div className="flex items-center gap-2 p-3 md:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <Heart className={`h-4 w-4 md:h-5 md:w-5 flex-shrink-0 ${systemHealthy ? "text-green-600" : "text-red-600"}`} />
          <span className="font-medium text-sm md:text-base">
            System Status {systemHealthy ? "Healthy" : "Warning"}
          </span>
        </div>

        {/* System Metrics Cards - Always Visible */}
        {systemInfo && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">CPU Usage</CardTitle>
                <Cpu className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {((systemInfo.cpu.loadAverage[0] / systemInfo.cpu.cores) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Load Average: {systemInfo.cpu.loadAverage.map((l) => l.toFixed(2)).join(", ")}
                </p>
                <div className="mt-2 h-2 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{
                      width: `${Math.min((systemInfo.cpu.loadAverage[0] / systemInfo.cpu.cores) * 100, 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Memory Usage</CardTitle>
                <MemoryStick className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{systemInfo.memory.usagePercent}%</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {systemInfo.memory.formatted.used} / {systemInfo.memory.formatted.total}
                </p>
                <div className="mt-2 h-2 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{ width: `${systemInfo.memory.usagePercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Disk Usage</CardTitle>
                <HardDrive className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {systemInfo.disk.usagePercent !== '0' ? `${systemInfo.disk.usagePercent}%` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {systemInfo.disk.formatted.used !== 'N/A' 
                    ? `${systemInfo.disk.formatted.used} / ${systemInfo.disk.formatted.total}`
                    : 'Storage information'}
                </p>
                {systemInfo.disk.usagePercent !== '0' && (
                  <div className="mt-2 h-2 bg-orange-200 dark:bg-orange-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-600 rounded-full"
                      style={{ width: `${systemInfo.disk.usagePercent}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Network I/O</CardTitle>
                <Network className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">Active</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {systemInfo.network.interfaces.length} interface{systemInfo.network.interfaces.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 h-auto">
            <TabsTrigger value="errors" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">Errors</span>
              {errorCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full flex-shrink-0">
                  {errorCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">Logs</span>
              {logStats && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full flex-shrink-0">
                  {logStats.totalFiles || 0}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Info className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">System</span>
            </TabsTrigger>
            <TabsTrigger value="docker" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Container className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">Docker</span>
            </TabsTrigger>
            <TabsTrigger value="processes" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <List className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">Processes</span>
              <span className="ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full flex-shrink-0">
                Live
              </span>
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-2">
              <Database className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">Cache</span>
              {cacheStats && cacheStats.totalKeys > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full flex-shrink-0">
                  {cacheStats.totalKeys}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Recent Errors Tab */}
          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>
                  Latest error entries from all log files
                </CardDescription>
              </CardHeader>
              <CardContent>
                {fetchRecentErrors.loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading errors...</div>
                ) : recentErrors.length > 0 ? (
                  <div className="space-y-2">
                    {recentErrors.map((error, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs flex-shrink-0">
                                {error.level}
                              </span>
                              <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                {error.timestamp}
                              </span>
                              {error.module && (
                                <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                  [{error.module}]
                                </span>
                              )}
                              <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                {error.filename || ""}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm break-words">{error.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent errors found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Log Statistics Tab */}
          <TabsContent value="logs" className="space-y-4">
            {logStats && (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{logStats.totalFiles}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Size</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold break-words">{logStats.totalSizeFormatted}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Lines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {logStats.totalLines.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Log Files</CardTitle>
                <CardDescription>Daily log files sorted by date (newest first)</CardDescription>
              </CardHeader>
              <CardContent>
                {fetchLogStatistics.loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading log files...
                  </div>
                ) : logFiles.length > 0 ? (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {logFiles.map((file) => (
                      <Card key={file.filename} className="cursor-pointer hover:border-primary overflow-hidden">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{file.filename}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Total Lines: </span>
                            <strong>{file.totalLines.toLocaleString()}</strong>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">File Size: </span>
                            <strong>{file.sizeFormatted}</strong>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setSelectedLogFile(file.filename)}
                          >
                            View Log
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No log files found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Information Tab */}
          <TabsContent value="system" className="space-y-4">
            {systemInfo ? (
              <>
                {/* Detailed System Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>System Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-semibold mb-2">Platform</h4>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">Type: </span>
                            {systemInfo.platform.type}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Architecture: </span>
                            {systemInfo.platform.arch}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Hostname: </span>
                            {systemInfo.platform.hostname}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">CPU</h4>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">Model: </span>
                            {systemInfo.cpu.model}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cores: </span>
                            {systemInfo.cpu.cores}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Node.js</h4>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">Version: </span>
                            {systemInfo.node.version}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Uptime</h4>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">Uptime: </span>
                            {systemInfo.uptime.formatted}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {fetchSystemInfo.loading ? "Loading system information..." : "No system information available"}
              </div>
            )}
          </TabsContent>

          {/* Docker Status Tab */}
          <TabsContent value="docker" className="space-y-4">
            {dockerStatus ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Docker Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          dockerStatus.installed && dockerStatus.running
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      />
                      <span>
                        Docker is {dockerStatus.installed ? "installed" : "not installed"}
                        {dockerStatus.running ? " and running" : " but not running"}
                      </span>
                    </div>
                    {dockerStatus.version && (
                      <div className="text-sm text-muted-foreground">
                        Version: {dockerStatus.version}
                      </div>
                    )}
                    {dockerStatus.error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
                        {dockerStatus.error}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {dockerStatus.containers.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Running Containers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dockerStatus.containers.map((container, index) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{container.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {container.image}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {container.status}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {dockerStatus.images.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Docker Images</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dockerStatus.images.map((image, index) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">
                                  {image.repository}:{image.tag}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">{image.size}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {fetchDockerStatus.loading ? "Loading Docker status..." : "Docker status unavailable"}
              </div>
            )}
          </TabsContent>

          {/* Cache Tab */}
          <TabsContent value="cache" className="space-y-4">
            {cacheStats && cacheStats.available ? (
              <>
                {/* Cache Type Badge */}
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">
                    Cache Type: <span className="capitalize">{(cacheStats as RedisCacheStats & { cacheType?: string }).cacheType || "redis"}</span>
                  </span>
                </div>

                {/* Cache Statistics */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Total Keys</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{cacheStats.totalKeys.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Total Memory</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold break-words">{cacheStats.totalMemoryFormatted}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Key Types</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{Object.keys(cacheStats.keysByType).length}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">Active</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Keys by Type */}
                {Object.keys(cacheStats.keysByType).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Keys by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                        {Object.entries(cacheStats.keysByType).map(([type, count]) => (
                          <div key={type} className="p-3 border rounded-lg">
                            <div className="text-sm font-medium capitalize">{type}</div>
                            <div className="text-2xl font-bold">{count.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              {cacheStats.memoryByType[type] ? formatBytes(cacheStats.memoryByType[type]) : "0 B"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Keys List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Cache Keys</CardTitle>
                        <CardDescription>
                          All stored {((cacheStats as RedisCacheStats & { cacheType?: string }).cacheType || "redis") === "local" ? "local cache" : "Redis"} keys (showing up to 1000 keys)
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={filterOwnKeys}
                          onCheckedChange={(checked) => {
                            setFilterOwnKeys(checked)
                          }}
                          label="Show Only My Keys"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setFlushCacheDialog(true)}
                          disabled={flushCache.loading || cacheStats.keys.length === 0}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Flush All Cache
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fetchCacheStats.loading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading cache keys...</div>
                    ) : cacheStats.keys.length > 0 ? (
                      <div className="space-y-2 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Key</th>
                              <th className="text-left p-2">Privacy</th>
                              <th className="text-left p-2">Type</th>
                              <th className="text-left p-2">Size</th>
                              <th className="text-left p-2">TTL</th>
                              <th className="text-left p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cacheStats.keys.map((key, index) => (
                              <tr key={index} className="border-b hover:bg-muted/50">
                                <td className="p-2 font-mono text-xs break-all max-w-md">{key.key}</td>
                                <td className="p-2">
                                  {key.privacy === "private" ? (
                                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs font-medium">
                                      Private
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                      Public
                                    </span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs capitalize">
                                    {key.type}
                                  </span>
                                </td>
                                <td className="p-2">{key.sizeFormatted}</td>
                                <td className="p-2">
                                  {key.ttl ? (
                                    <span className="text-xs">
                                      {key.ttl < 60 ? `${key.ttl}s` : key.ttl < 3600 ? `${Math.floor(key.ttl / 60)}m` : `${Math.floor(key.ttl / 3600)}h`}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No expiry</span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2"
                                      onClick={() => setSelectedKey(key.key)}
                                      title="View full details"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 px-2"
                                      onClick={() => setDeleteKeyDialog({ open: true, key: key.key })}
                                      title="Delete key"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No cache keys found</div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    {fetchCacheStats.loading ? "Loading cache information..." : "Redis cache is not available or not configured"}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Top Processes Tab */}
          <TabsContent value="processes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Processes (by CPU)</CardTitle>
                <CardDescription>Live process monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                {fetchTopProcesses.loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading processes...
                  </div>
                ) : topProcesses.length > 0 ? (
                  <div className="space-y-2 overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">PID</th>
                          <th className="text-left p-2">CPU %</th>
                          <th className="text-left p-2">Memory %</th>
                          <th className="text-left p-2">Command</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProcesses.map((process, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-mono">{process.pid}</td>
                            <td className="p-2">{process.cpu}%</td>
                            <td className="p-2">{process.memory}%</td>
                            <td className="p-2 break-words max-w-xs">{process.command}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No processes found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Log Viewer Side Panel */}
        {selectedLogFile && (
          <LogViewer
            filename={selectedLogFile}
            onClose={() => setSelectedLogFile(null)}
            onFileDeleted={() => {
              fetchLogStatistics.execute()
            }}
          />
        )}

        {/* Key Details Side Panel */}
        {selectedKey && (
          <SidePanel
            open={!!selectedKey}
            onClose={() => {
              setSelectedKey(null)
              setKeyDetails(null)
            }}
            title="Cache Key Details"
            description={selectedKey}
            width="xl"
          >
            {fetchKeyDetails.loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading key details...</div>
              </div>
            ) : keyDetails ? (
              <div className="space-y-6 h-full flex flex-col">
                {/* Metadata Section */}
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key</label>
                    <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all border">
                      {keyDetails.key}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
                    <div className="p-3">
                      <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium capitalize inline-block">
                        {keyDetails.type}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">TTL</label>
                    <div className="p-3 bg-muted rounded-lg text-sm font-medium border">
                      {keyDetails.ttl ? (
                        <span>
                          {keyDetails.ttl < 60 ? `${keyDetails.ttl} seconds` : 
                           keyDetails.ttl < 3600 ? `${Math.floor(keyDetails.ttl / 60)} minutes` : 
                           `${Math.floor(keyDetails.ttl / 3600)} hours`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No expiry</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Size</label>
                    <div className="p-3 bg-muted rounded-lg text-sm font-medium border">
                      {formatBytes(keyDetails.size)}
                    </div>
                  </div>
                </div>

                {/* JSON Viewer Section */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Value</label>
                    <div className="flex items-center gap-2">
                      {keyDetails.value && typeof keyDetails.value === "object" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            const jsonString = JSON.stringify(keyDetails.value, null, 2)
                            navigator.clipboard.writeText(jsonString)
                          }}
                        >
                          Copy JSON
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 bg-[#1e1e1e] dark:bg-[#0d1117] rounded-lg border border-border overflow-hidden">
                    <div className="h-full overflow-auto p-4">
                      {typeof keyDetails.value === "string" ? (
                        <JsonViewer data={keyDetails.value} isString={true} />
                      ) : keyDetails.value && typeof keyDetails.value === "object" ? (
                        <JsonViewer data={keyDetails.value} />
                      ) : (
                        <div className="text-muted-foreground text-sm text-center py-8">No value</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSelectedKey(null)
                      setKeyDetails(null)
                      setDeleteKeyDialog({ open: true, key: keyDetails.key })
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Key
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Failed to load key details</div>
            )}
          </SidePanel>
        )}

        {/* Delete Key Confirmation Dialog */}
        <ConfirmDialog
          open={deleteKeyDialog.open}
          onClose={() => setDeleteKeyDialog({ open: false, key: null })}
          onConfirm={async () => {
            await deleteKey.execute()
          }}
          title="Delete Cache Key"
          description={`Are you sure you want to delete the key "${deleteKeyDialog.key}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />
        <ConfirmDialog
          open={flushCacheDialog}
          onClose={() => setFlushCacheDialog(false)}
          onConfirm={async () => {
            await flushCache.execute()
          }}
          title="Flush All Cache"
          description={`Are you sure you want to delete ALL cache keys? This will remove ${cacheStats?.totalKeys || 0} keys and cannot be undone.`}
          confirmText="Flush All"
          cancelText="Cancel"
          variant="destructive"
        />
      </div>
    </MainLayout>
  )
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

