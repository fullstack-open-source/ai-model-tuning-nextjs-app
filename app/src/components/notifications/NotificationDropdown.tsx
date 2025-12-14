"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@components/ui/button"
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  Loader2,
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
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
  RefreshCw,
} from "lucide-react"
import { notificationService } from "@services/notification.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import type { Notification } from "@models/notification.model"
import type { NotificationEvent } from "@services/websocket.service"
import { useToast } from "@hooks/useToast"
import { useWebSocket } from "@context/WebSocketContext"
import { cn } from "@lib/utils"
import { formatTimeAgo } from "@lib/utils/time"

interface NotificationDropdownProps {
  user: { user_id: string; [key: string]: unknown } | null
  tokens: { session_token?: string; access_token?: string; token_type?: string; [key: string]: unknown } | null
}

export function NotificationDropdown({ user, tokens }: NotificationDropdownProps) {
  const router = useRouter()
  const { showError, showInfo } = useToast()
  const { onNotification, onNotificationUpdate, onNotificationDelete, onNotificationsAllRead, subscribeToNotifications, connected } = useWebSocket()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications({
        status: 'all',
        limit: 10,
        offset: 0,
      })
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load notifications"
      showError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [showError])


  // Track if initial load has been done
  const hasInitialLoadRef = useRef(false)

  // Initial load
  useEffect(() => {
    if (user && tokens && !hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true
      loadNotifications()
      subscribeToNotifications()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, tokens?.session_token, tokens?.access_token]) // Only depend on essential values

  // Real-time WebSocket notifications
  useEffect(() => {
    if (!user || !tokens) return

    const handleNewNotification = (notification: NotificationEvent) => {
      // Only process notifications for the current user
      const userId = user.user_id || (user as { uid?: string }).uid
      if (notification.user_id && notification.user_id !== userId) {
        return // Skip notifications not meant for this user
      }

      // Add new notification to the top of the list
      setNotifications(prev => {
        // Check if notification already exists (avoid duplicates)
        const exists = prev.some(n => n.id === notification.id)
        if (exists) return prev
        return [notification, ...prev].slice(0, 10) // Keep only latest 10
      })
      
      // Update unread count
      if (!notification.read_at) {
        setUnreadCount(prev => prev + 1)
        showInfo("New Notification", notification.title || "You have a new notification")
      }
    }

    const handleNotificationUpdate = (notification: NotificationEvent) => {
      // Update existing notification (e.g., when marked as read)
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? notification as Notification : n)
      )
      
      // Update unread count if notification was marked as read
      if (notification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    }

    const handleNotificationDelete = (data: { id: string }) => {
      setNotifications(prev => prev.filter(n => n.id !== data.id))
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

    // Subscribe to WebSocket notifications
    const unsubscribeNew = onNotification((data) => {
      if (data.read_at) {
        handleNotificationUpdate(data)
      } else {
        handleNewNotification(data)
      }
    })

    const unsubscribeUpdate = onNotificationUpdate(handleNotificationUpdate)
    const unsubscribeDelete = onNotificationDelete(handleNotificationDelete)
    const unsubscribeAllRead = onNotificationsAllRead(handleAllRead)

    return () => {
      unsubscribeNew()
      unsubscribeUpdate()
      unsubscribeDelete()
      unsubscribeAllRead()
    }
  }, [user, tokens, onNotification, onNotificationUpdate, onNotificationDelete, onNotificationsAllRead, showInfo])

  // Reload notifications when dropdown opens
  useEffect(() => {
    if (isOpen && user && tokens) {
      loadNotifications()
    }
  }, [isOpen, user, tokens, loadNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to mark as read"
      showError(errorMessage)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to mark all as read"
      showError(errorMessage)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await notificationService.deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      // Update unread count if deleted notification was unread
      const deleted = notifications.find(n => n.id === id)
      if (deleted && !deleted.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete notification"
      showError(errorMessage)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      handleMarkAsRead(notification.id)
    }
    if (notification.action_url) {
      router.push(notification.action_url)
      setIsOpen(false)
    }
  }

  // Map Font Awesome class names to Lucide React icons
  const getIconFromClass = (iconClass: string, className = "h-4 w-4") => {
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

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative transition-all duration-200",
          unreadCount > 0 && "animate-pulse"
        )}
      >
        <Bell className={cn(
          "h-5 w-5 transition-transform duration-200",
          isOpen && "rotate-12"
        )} />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white text-xs flex items-center justify-center font-bold shadow-lg shadow-red-500/50",
            "animate-in zoom-in-50 duration-200 ring-2 ring-background"
          )}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className={cn(
          "fixed right-4 top-[56px] w-[420px] bg-background border-2 border-border rounded-xl shadow-2xl z-[100] flex flex-col overflow-hidden",
          "animate-in slide-in-from-top-2 fade-in-0 zoom-in-95 duration-200",
          "backdrop-blur-sm bg-background/95"
        )}
        style={{ 
          height: 'calc(100vh - 72px)',
          maxHeight: 'calc(100vh - 72px)'
        }}
        >
          {/* Header with gradient */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-gradient-to-br from-card via-card to-muted/20 flex-shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex-shrink-0">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <h3 className="font-semibold text-base text-foreground whitespace-nowrap">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold shadow-sm flex-shrink-0">
                    {unreadCount} new
                  </span>
                )}
                {connected && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-green-500/10 to-green-600/10 text-green-700 dark:text-green-400 font-medium flex items-center gap-1.5 border border-green-200 dark:border-green-800 flex-shrink-0">
                    <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse shadow-sm shadow-green-500/50" />
                    Live
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs h-8 px-2.5 hover:bg-primary/10 hover:text-primary transition-colors whitespace-nowrap"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  router.push('/notifications')
                  setIsOpen(false)
                }}
                className="text-xs h-8 px-2.5 hover:bg-primary/10 hover:text-primary transition-colors whitespace-nowrap"
              >
                View all
                <ExternalLink className="h-3 w-3 ml-1.5" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30 min-h-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground font-medium">Loading notifications...</p>
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-border/30">
                {notifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "px-5 py-4 hover:bg-muted/30 cursor-pointer transition-all duration-200 group relative",
                      "animate-in slide-in-from-right-2 fade-in-0 duration-300",
                      !notification.read_at && "bg-gradient-to-r from-blue-50/60 via-blue-50/40 to-transparent dark:from-blue-950/30 dark:via-blue-900/20 border-l-2 border-l-blue-500",
                      notification.read_at && "opacity-75 hover:opacity-100",
                      getPriorityColor(notification.priority)
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Icon */}
                        <div className={cn(
                          "p-2.5 rounded-lg flex-shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:shadow-md",
                          "border border-border/50",
                          getNotificationTypeColor(notification.notification_type).split(' ')[0]
                        )}>
                          {notification.icon_class ? (
                            getIconFromClass(notification.icon_class, "h-4 w-4")
                          ) : (
                            getNotificationIcon(notification.notification_type, "h-4 w-4")
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={cn(
                              "text-sm leading-tight",
                              !notification.read_at ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                            )}>
                              {notification.title}
                            </h4>
                            {!notification.read_at && (
                              <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5 animate-pulse shadow-sm shadow-blue-500/50" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              {formatTimeAgo(notification.created_at)}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 text-xs rounded-md border font-medium",
                              getNotificationTypeColor(notification.notification_type)
                            )}>
                              {notification.notification_type}
                            </span>
                            {notification.action_url && (
                              <div className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                                <ExternalLink className="h-3 w-3" />
                                <span>{notification.action_text || 'View Progress'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-start gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        {!notification.read_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-green-100 dark:hover:bg-green-900/30 hover:border-green-200 dark:hover:border-green-800 border border-transparent rounded-md transition-all"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsRead(notification.id)
                            }}
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-200 dark:hover:border-red-800 border border-transparent rounded-md transition-all"
                          onClick={(e) => handleDelete(notification.id, e)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="p-5 rounded-full bg-gradient-to-br from-muted to-muted/50 border border-border mb-4 shadow-sm">
                  <Bell className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1.5">All caught up!</p>
                <p className="text-sm text-muted-foreground max-w-xs">You have no new notifications at this time</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

