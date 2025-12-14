"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import type { NotificationEvent } from "@services/websocket.service"
import { useApiCall } from "@hooks/useApiCall"
import { usePermissions } from "@hooks/usePermissions"
import { useToast } from "@hooks/useToast"
import { notificationService } from "@services/notification.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import type { ApiResponse } from "@models/api.model"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@components/ui/tabs"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Loader2,
  Calendar,
  Database,
  FileText,
  Sparkles,
  Bot,
  Settings,
  User,
  Users,
  Zap,
  Activity,
  BarChart,
  Shield,
  Lock,
  Unlock,
  Upload,
  Download,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@lib/utils"
import type { Notification } from "@models/notification.model"
import { formatTimeAgo } from "@lib/utils/time"
import { formatDate, formatDateTime } from "@lib/utils/date-format"
import { Avatar, AvatarImage, AvatarFallback } from "@components/ui/avatar"

export default function NotificationsPage() {
  return (
    <PageGuard requireAnyPermission={["view_notifications", "manage_notifications"]}>
      <NotificationsContent />
    </PageGuard>
  )
}

function NotificationsContent() {
  const router = useRouter()
  const { user, tokens, loading: authLoading } = useAuth()
  const { hasPermission } = usePermissions()
  const { showSuccess, showError } = useToast()
  
  // Check if user has permission to view notifications
  const hasNotificationAccess = hasPermission('view_notification') || hasPermission('manage_notifications')
  const [activeTab, setActiveTab] = useState("all")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState({
    notification_type: "all",
    priority: "all",
  })
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null)

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
        notificationService.setAuthApi(authenticatedApi)
      }
    }
  }, [tokens])

  // Helper to update notifications from data
  const updateNotificationsFromData = (data: {
    notifications: Notification[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    unread_count: number;
  }) => {
    setNotifications(data.notifications || [])
    setUnreadCount(data.unread_count || 0)
    setTotalCount(data.pagination?.total || 0)
    // Calculate total pages from pagination
    const calculatedTotalPages = Math.ceil((data.pagination?.total || 0) / (data.pagination?.limit || limit))
    setTotalPages(calculatedTotalPages || 1)
  }

  // Fetch from API (middleware handles caching automatically)
  const loadNotifications = useApiCall(
    async () => {
      const status = activeTab === "all" ? "all" : activeTab === "unread" ? "unread" : "read"
      const offset = (page - 1) * limit
      const data = await notificationService.getNotifications({
        status: status as "all" | "unread" | "read",
        notification_type: filter.notification_type !== "all" ? filter.notification_type : undefined,
        priority: filter.priority !== "all" ? filter.priority : undefined,
        limit,
        offset,
      })
      return { success: true, data, message: 'Notifications retrieved' } as ApiResponse<typeof data>
    },
    {
      onSuccess: (data: {
        notifications: Notification[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
        unread_count: number;
      }) => {
        updateNotificationsFromData(data)
      },
    }
  )

  // Force refresh from API (bypasses cache)
  const refreshNotifications = useApiCall(
    async () => {
      const status = activeTab === "all" ? "all" : activeTab === "unread" ? "unread" : "read"
      const offset = (page - 1) * limit
      const data = await notificationService.refreshNotifications({
        status: status as "all" | "unread" | "read",
        notification_type: filter.notification_type !== "all" ? filter.notification_type : undefined,
        priority: filter.priority !== "all" ? filter.priority : undefined,
        limit,
        offset,
      })
      return { success: true, data, message: 'Notifications retrieved' } as ApiResponse<typeof data>
    },
    {
      onSuccess: (data: {
        notifications: Notification[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
        unread_count: number;
      }) => {
        updateNotificationsFromData(data)
      },
    }
  )

  // Reset to page 1 when tab or filter changes
  useEffect(() => {
    if (!hasNotificationAccess) return
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filter.notification_type, filter.priority, hasNotificationAccess])

  // Load notifications when page, tab, or filter changes (middleware handles caching)
  useEffect(() => {
    if (!hasNotificationAccess) return
    loadNotifications.execute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab, filter.notification_type, filter.priority, hasNotificationAccess])

  // Real-time WebSocket notifications - no polling needed!
  const { onNotification, onNotificationUpdate, onNotificationDelete, onNotificationsAllRead, subscribeToNotifications } = useWebSocket()
  
  useEffect(() => {
    if (!user || !tokens || !hasNotificationAccess) return

    // Subscribe to notifications
    subscribeToNotifications()

    const handleNewNotification = (notification: NotificationEvent) => {
      const userId = user.user_id || (user as { uid?: string }).uid
      if (notification.user_id && notification.user_id !== userId) return

      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id)
        if (exists) return prev
        // Only add to current page if we're on page 1, otherwise refresh
        if (page === 1) {
          return [notification, ...prev].slice(0, limit)
        } else {
          // If not on page 1, refresh to get updated list
          loadNotifications.execute()
          return prev
        }
      })
      
      if (!notification.read_at) {
        setUnreadCount(prev => prev + 1)
        setTotalCount(prev => {
          const newTotal = prev + 1
          // Recalculate total pages based on new total
          setTotalPages(Math.ceil(newTotal / limit))
          return newTotal
        })
      }
    }

    const handleNotificationUpdate = (notification: NotificationEvent) => {
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? notification as Notification : n)
      )
      
      if (notification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    }

    const handleNotificationDelete = (data: { id: string }) => {
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== data.id)
        // If we deleted the last item on the page and we're not on page 1, go to previous page
        if (filtered.length === 0 && page > 1) {
          setPage(prevPage => Math.max(1, prevPage - 1))
        }
        return filtered
      })
      setTotalCount(prev => {
        const newTotal = Math.max(0, prev - 1)
        // Recalculate total pages based on new total
        setTotalPages(Math.ceil(newTotal / limit) || 1)
        return newTotal
      })
    }

    const handleAllRead = (data: { userId: string }) => {
      const userId = user.user_id || (user as { uid?: string }).uid
      if (data.userId === userId) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        )
        setUnreadCount(0)
      }
    }

    const unsubscribeNew = onNotification(handleNewNotification)
    const unsubscribeUpdate = onNotificationUpdate(handleNotificationUpdate)
    const unsubscribeDelete = onNotificationDelete(handleNotificationDelete)
    const unsubscribeAllRead = onNotificationsAllRead(handleAllRead)

    return () => {
      unsubscribeNew()
      unsubscribeUpdate()
      unsubscribeDelete()
      unsubscribeAllRead()
    }
  }, [user, tokens, hasNotificationAccess, onNotification, onNotificationUpdate, onNotificationDelete, onNotificationsAllRead, subscribeToNotifications])

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Error handled by service
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch {
      // Error handled by service
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification)
    setIsSidePanelOpen(true)
    // Mark as read if unread
    if (!notification.read_at) {
      handleMarkAsRead(notification.id)
    }
  }

  const handleDeleteClick = (notification: Notification, event?: React.MouseEvent) => {
    event?.stopPropagation() // Prevent opening side panel when clicking delete
    setNotificationToDelete(notification)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!notificationToDelete) return
    
    try {
      await notificationService.deleteNotification(notificationToDelete.id)
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== notificationToDelete.id)
        // If we deleted the last item on the page and we're not on page 1, go to previous page
        if (filtered.length === 0 && page > 1) {
          setPage(prevPage => Math.max(1, prevPage - 1))
        }
        return filtered
      })
      const deleted = notificationToDelete
      if (deleted && !deleted.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      setTotalCount(prev => {
        const newTotal = Math.max(0, prev - 1)
        // Recalculate total pages based on new total
        setTotalPages(Math.ceil(newTotal / limit) || 1)
        return newTotal
      })
      
      // Close side panel if the deleted notification was selected
      if (selectedNotification?.id === notificationToDelete.id) {
        setIsSidePanelOpen(false)
        setSelectedNotification(null)
      }
      
      showSuccess("Notification deleted successfully")
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to delete notification")
      throw error // Re-throw to let ConfirmDialog handle it
    }
  }

  // Map Font Awesome class names to Lucide React icons
  const getIconFromClass = (iconClass: string, className = "h-5 w-5") => {
    if (!iconClass) return null
    
    const iconName = iconClass.toLowerCase()
    
    // Map common Font Awesome icons to Lucide icons
    if (iconName.includes('database') || iconName.includes('fa-database')) {
      return <Database className={className} />
    }
    if (iconName.includes('file') || iconName.includes('fa-file')) {
      return <FileText className={className} />
    }
    if (iconName.includes('sparkles') || iconName.includes('magic') || iconName.includes('fa-magic')) {
      return <Sparkles className={className} />
    }
    if (iconName.includes('bot') || iconName.includes('robot') || iconName.includes('fa-robot')) {
      return <Bot className={className} />
    }
    if (iconName.includes('settings') || iconName.includes('cog') || iconName.includes('fa-cog')) {
      return <Settings className={className} />
    }
    if (iconName.includes('user') || iconName.includes('fa-user')) {
      return <User className={className} />
    }
    if (iconName.includes('users') || iconName.includes('fa-users')) {
      return <Users className={className} />
    }
    if (iconName.includes('zap') || iconName.includes('bolt') || iconName.includes('fa-bolt')) {
      return <Zap className={className} />
    }
    if (iconName.includes('activity') || iconName.includes('chart') || iconName.includes('fa-chart')) {
      return <Activity className={className} />
    }
    if (iconName.includes('bar-chart') || iconName.includes('fa-chart-bar')) {
      return <BarChart className={className} />
    }
    if (iconName.includes('shield') || iconName.includes('fa-shield')) {
      return <Shield className={className} />
    }
    if (iconName.includes('lock') || iconName.includes('fa-lock')) {
      return <Lock className={className} />
    }
    if (iconName.includes('unlock') || iconName.includes('fa-unlock')) {
      return <Unlock className={className} />
    }
    if (iconName.includes('upload') || iconName.includes('fa-upload')) {
      return <Upload className={className} />
    }
    if (iconName.includes('download') || iconName.includes('fa-download')) {
      return <Download className={className} />
    }
    if (iconName.includes('play') || iconName.includes('fa-play')) {
      return <Play className={className} />
    }
    if (iconName.includes('pause') || iconName.includes('fa-pause')) {
      return <Pause className={className} />
    }
    if (iconName.includes('stop') || iconName.includes('fa-stop')) {
      return <Square className={className} />
    }
    if (iconName.includes('refresh') || iconName.includes('sync') || iconName.includes('fa-sync')) {
      return <RefreshCw className={className} />
    }
    
    // Default fallback
    return <Bell className={className} />
  }

  const getNotificationIcon = (type: string, className = "h-5 w-5") => {
    const iconClass = cn(className)
    switch (type.toLowerCase()) {
      case 'success':
        return <CheckCircle2 className={cn(iconClass, "text-green-600")} />
      case 'error':
        return <XCircle className={cn(iconClass, "text-red-600")} />
      case 'warning':
        return <AlertTriangle className={cn(iconClass, "text-yellow-600")} />
      case 'info':
        return <Info className={cn(iconClass, "text-blue-600")} />
      default:
        return <Bell className={cn(iconClass, "text-gray-600")} />
    }
  }

  const getNotificationTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-900/10'
      case 'medium':
        return 'border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10'
      case 'low':
        return 'border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10'
      default:
        return 'border-l-4 border-l-gray-500'
    }
  }

  if (authLoading || !user || !hasNotificationAccess) {
    return (
      <MainLayout title="Notifications">
        <div className="flex-1 container mx-auto p-4 md:p-6 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Notifications"
      description="Manage and view all your notifications"
      actions={
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button 
              onClick={handleMarkAllAsRead} 
              variant="outline" 
              size="sm"
              className="hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
          <Button 
            onClick={() => refreshNotifications.execute()} 
            variant="outline"
            size="sm"
            disabled={refreshNotifications.loading}
            loading={refreshNotifications.loading}
            loadingText="Refreshing..."
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 max-w-full">

          {/* Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-2 hover:border-primary/50 transition-colors duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {totalCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">All notifications</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-red-200 dark:border-red-900/50 hover:border-red-400 dark:hover:border-red-700 transition-colors duration-200 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Unread
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {unreadCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-green-200 dark:border-green-900/50 hover:border-green-400 dark:hover:border-green-700 transition-colors duration-200 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-900/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Read
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {totalCount - unreadCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Already viewed</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="flex items-center gap-2">
                All
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 rounded-full">
                  {totalCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="unread" className="flex items-center gap-2">
                Unread
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="read" className="flex items-center gap-2">
                Read
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                  {totalCount - unreadCount}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={filter.notification_type}
                  onChange={(e) => setFilter({ ...filter, notification_type: e.target.value })}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
              </select>
            </div>

            {/* Notifications List */}
            <TabsContent value={activeTab} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {activeTab === "all" ? "All Notifications" : activeTab === "unread" ? "Unread Notifications" : "Read Notifications"}
                  </CardTitle>
                  <CardDescription>
                    Showing {notifications.length} of {totalCount} notification{totalCount !== 1 ? 's' : ''} 
                    {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadNotifications.loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                      <p className="text-sm text-muted-foreground">Loading notifications...</p>
                    </div>
                  ) : notifications.length > 0 ? (
                    <div className="space-y-3">
                      {notifications.map((notification, index) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "p-5 border rounded-xl hover:shadow-md transition-all duration-200 group cursor-pointer",
                            "animate-in slide-in-from-right-2 fade-in-0 duration-300",
                            !notification.read_at && "bg-gradient-to-r from-blue-50/50 via-blue-50/30 to-transparent dark:from-blue-900/10 dark:via-blue-900/5 shadow-sm",
                            getPriorityColor(notification.priority)
                          )}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              {/* User Avatar or Icon */}
                              {user?.profile_picture_url ? (
                                <Avatar className="h-10 w-10 border-2 border-primary/30 flex-shrink-0">
                                  <AvatarImage
                                    src={user.profile_picture_url}
                                    alt={user.first_name || user.user_name || "User"}
                                  />
                                  <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                                    {(user.first_name?.[0] || user.user_name?.[0] || "U").toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className={cn(
                                  "p-2.5 rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-110 shadow-sm",
                                  getNotificationTypeColor(notification.notification_type).split(' ')[0]
                                )}>
                                  {notification.icon_class ? (
                                    getIconFromClass(notification.icon_class, "h-5 w-5")
                                  ) : (
                                    getNotificationIcon(notification.notification_type, "h-5 w-5")
                                  )}
                                </div>
                              )}
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className={cn(
                                      "text-base font-medium",
                                      !notification.read_at && "font-semibold"
                                    )}>
                                      {notification.title}
                                    </h4>
                                    {!notification.read_at && (
                                      <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                                    )}
                                    <span className={cn(
                                      "px-2.5 py-1 text-xs rounded-md border font-medium",
                                      notification.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' :
                                      notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800'
                                    )}>
                                      {notification.priority}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Bell className="h-3 w-3" />
                                    {formatTimeAgo(notification.created_at)}
                                  </span>
                                  <span className={cn(
                                    "px-2 py-0.5 text-xs rounded-md border",
                                    getNotificationTypeColor(notification.notification_type)
                                  )}>
                                    {notification.notification_type}
                                  </span>
                                  {notification.action_url && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        router.push(notification.action_url!)
                                      }}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      {notification.action_text || 'View Details'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-start gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              {!notification.read_at && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 hover:bg-green-100 dark:hover:bg-green-900/30"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleMarkAsRead(notification.id)
                                  }}
                                  title="Mark as read"
                                >
                                  <CheckCheck className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 hover:bg-red-100 dark:hover:bg-red-900/30"
                                onClick={(e) => handleDeleteClick(notification, e)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Bell className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">No notifications found</p>
                      <p className="text-sm text-muted-foreground">You&apos;re all caught up!</p>
                    </div>
                  )}

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
                          disabled={page === 1 || loadNotifications.loading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages || loadNotifications.loading}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      {/* Side Panel for Notification Details */}
      <SidePanel
        open={isSidePanelOpen}
        onClose={() => {
          setIsSidePanelOpen(false)
          setSelectedNotification(null)
        }}
        title={selectedNotification?.title || "Notification Details"}
        description="View full notification details"
        width="md"
        actions={
          selectedNotification && (
            <div className="flex items-center gap-2">
              {!selectedNotification.read_at && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedNotification) {
                      handleMarkAsRead(selectedNotification.id)
                    }
                  }}
                  className="gap-2"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark as Read
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (selectedNotification) {
                    handleDeleteClick(selectedNotification)
                  }
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          )
        }
      >
        {selectedNotification && (
          <div className="space-y-6">
            {/* User Avatar or Icon and Type */}
            <div className="flex items-start gap-4">
              {user?.profile_picture_url ? (
                <Avatar className="h-12 w-12 border-2 border-primary/30 flex-shrink-0">
                  <AvatarImage
                    src={user.profile_picture_url}
                    alt={user.first_name || user.user_name || "User"}
                  />
                  <AvatarFallback className="bg-primary/10 text-base font-medium text-primary">
                    {(user.first_name?.[0] || user.user_name?.[0] || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className={cn(
                  "p-4 rounded-lg flex-shrink-0 shadow-sm",
                  getNotificationTypeColor(selectedNotification.notification_type).split(' ')[0]
                )}>
                  {selectedNotification.icon_class ? (
                    getIconFromClass(selectedNotification.icon_class, "h-6 w-6")
                  ) : (
                    getNotificationIcon(selectedNotification.notification_type, "h-6 w-6")
                  )}
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "px-3 py-1 text-sm rounded-md border font-medium",
                    getNotificationTypeColor(selectedNotification.notification_type)
                  )}>
                    {selectedNotification.notification_type}
                  </span>
                  <span className={cn(
                    "px-3 py-1 text-sm rounded-md border font-medium",
                    selectedNotification.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' :
                    selectedNotification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800'
                  )}>
                    {selectedNotification.priority}
                  </span>
                  {!selectedNotification.read_at && (
                    <span className="px-3 py-1 text-sm rounded-md border bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-medium">
                      Unread
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Message
              </h3>
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                {selectedNotification.message}
              </p>
            </div>

            {/* Metadata */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-foreground">Created</div>
                      <div className="text-muted-foreground">
                        {formatDateTime(selectedNotification.created_at)}
                      </div>
                    </div>
                  </div>
                {selectedNotification.read_at && (
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium text-foreground">Read</div>
                      <div className="text-muted-foreground">
                        {formatDateTime(selectedNotification.read_at)}
                      </div>
                    </div>
                  </div>
                )}
                {selectedNotification.action_url && (
                  <div className="flex items-center gap-3 text-sm">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-foreground">Action URL</div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-primary hover:text-primary/80"
                        onClick={() => router.push(selectedNotification.action_url!)}
                      >
                        {selectedNotification.action_text || selectedNotification.action_url}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            {selectedNotification.action_url && (
              <div className="pt-4 border-t border-border">
                <Button
                  onClick={() => router.push(selectedNotification.action_url!)}
                  className="w-full gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {selectedNotification.action_text || "View Details"}
                </Button>
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setNotificationToDelete(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Notification"
        description={
          notificationToDelete
            ? `Are you sure you want to delete "${notificationToDelete.title}"? This action cannot be undone.`
            : "Are you sure you want to delete this notification?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        successMessage="Notification deleted successfully"
        errorMessage="Failed to delete notification. Please try again."
      />
    </MainLayout>
  )
}

