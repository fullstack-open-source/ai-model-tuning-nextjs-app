"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useAuthHook } from "@hooks/useAuth"
import { NotificationDropdown } from "@components/notifications/NotificationDropdown"
import { Button } from "@components/ui/button"
import {
  LayoutDashboard,
  User,
  LogOut,
  ChevronUp,
  ChevronDown,
  Palette,
  Globe,
  Lock,
  Share2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { usePermissions } from "@hooks/usePermissions"
import { Avatar, AvatarImage, AvatarFallback } from "@components/ui/avatar"
import { isProfileComplete } from "@utils/onboarding"

interface TopNavProps {
  title?: string
  description?: string
  actions?: React.ReactNode
}

export function TopNav({ title, description, actions }: TopNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user: authUser, tokens } = useAuth()
  const { logout } = useAuthHook()
  const { hasPermission, isAdmin, isSuperAdmin } = usePermissions()
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  
  // Sidebar collapse state - synced with localStorage and Navbar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('navbar-collapsed')
      return saved === 'true'
    }
    return false
  })
  
  // Permission check for account sharing
  const hasAccountSharingAccess = hasPermission("view_account_sharing") || hasPermission("manage_account_sharing") || 
                                   isAdmin || isSuperAdmin

  // Toggle sidebar collapse - updates localStorage and dispatches event for Navbar to listen
  const toggleSidebar = useCallback(() => {
    const newState = !isSidebarCollapsed
    setIsSidebarCollapsed(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('navbar-collapsed', String(newState))
      // Dispatch custom event so Navbar can react
      window.dispatchEvent(new CustomEvent('navbar-toggle', { detail: { collapsed: newState } }))
    }
  }, [isSidebarCollapsed])

  // Listen for sidebar toggle events from Navbar
  useEffect(() => {
    const handleNavbarToggle = (event: CustomEvent<{ collapsed: boolean }>) => {
      setIsSidebarCollapsed(event.detail.collapsed)
    }

    window.addEventListener('navbar-toggle', handleNavbarToggle as EventListener)
    return () => {
      window.removeEventListener('navbar-toggle', handleNavbarToggle as EventListener)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }

    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [profileDropdownOpen])

  const handleLogout = async () => {
    // Capture current pathname before logout
    const currentPath = pathname || "/"
    await logout()
    // Redirect to login with ?next= parameter
    const { buildLoginUrl } = await import("@utils/auth-redirect")
    router.push(buildLoginUrl(currentPath))
  }

  // Get page title from pathname if not provided
  const getPageTitle = () => {
    if (title) return title
    
    const pathMap: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/profile-settings": "Profile & Settings",
      "/admin/users": "Users",
      "/admin/groups": "Groups",
      "/admin/permissions": "Permissions",
      "/activity": "Activity Logs",
      "/media": "Media",
      "/admin/project-settings": "Project Settings",
      "/admin/system-analytics": "System Analytics",
      "/notifications": "Notifications",
      "/chats": "Chats",
      "/account-sharing": "Account Sharing",
    }

    return pathMap[pathname || ""] || "Dashboard"
  }

  const getPageDescription = () => {
    if (description) return description
    
    const descMap: Record<string, string> = {
      "/dashboard": "Welcome to your dashboard",
      "/profile-settings": "Manage your profile information and account settings",
      "/admin/users": "Manage users and their permissions",
      "/admin/groups": "Manage user groups and access control",
      "/admin/permissions": "Manage system permissions",
      "/activity": "Monitor all system activities and user actions",
      "/media": "Manage your media files",
      "/admin/project-settings": "Configure project settings and preferences",
      "/admin/system-analytics": "View system analytics and statistics",
      "/notifications": "View and manage your notifications",
      "/chats": "Chat with users and groups",
      "/account-sharing": "Share account access and collaborate securely",
    }

    return descMap[pathname || ""] || ""
  }

  if (!authUser) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 h-14 relative">
      {/* Sidebar Toggle Button - Positioned on the dividing line */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted hover:border-primary/60 hover:shadow-md transition-all group"
        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isSidebarCollapsed ? (
          <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </Button>
      
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {getPageTitle()}
            </h1>
            {getPageDescription() && (
              <p className="text-xs text-muted-foreground truncate hidden sm:block">
                {getPageDescription()}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {/* Notifications */}
          {authUser && tokens && (
            <div className="flex items-center">
              <NotificationDropdown 
                user={authUser as { user_id: string; [key: string]: unknown }} 
                tokens={tokens as { session_token?: string; access_token?: string; token_type?: string; [key: string]: unknown }} 
              />
            </div>
          )}
          
          {/* User Profile Dropdown */}
          {authUser && (
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/60 px-3 py-1.5 hover:border-primary/60 transition-colors"
              >
                <Avatar className="h-8 w-8 border-2 border-primary/30">
                  {authUser.profile_picture_url ? (
                    <AvatarImage
                      src={authUser.profile_picture_url}
                      alt={authUser.first_name || authUser.user_name || "User"}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {(authUser.first_name || authUser.user_name || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-medium text-foreground leading-tight">
                    {authUser.first_name || authUser.user_name || "User"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {authUser.email}
                  </div>
                </div>
                {profileDropdownOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border/60 bg-background shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                  {/* User Info Section */}
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-12 w-12 border-2 border-primary/30">
                        {authUser.profile_picture_url ? (
                          <AvatarImage
                            src={authUser.profile_picture_url}
                            alt={authUser.first_name || authUser.user_name || "User"}
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                          {(authUser.first_name || authUser.user_name || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {authUser.first_name || authUser.user_name || "User"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground mt-0.5">
                          {authUser.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {!isProfileComplete(authUser as any) ? (
                        <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-400">
                          Profile Incomplete
                        </span>
                      ) : (
                        <>
                          {(authUser as any)?.is_active !== false && (
                            <span className="inline-flex rounded-full bg-green-100 dark:bg-green-900/20 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:text-green-400">
                              Active
                            </span>
                          )}
                          {((authUser as any)?.is_verified === true || (authUser as any)?.is_email_verified === true || (authUser as any)?.is_phone_verified === true) && (
                            <span className="inline-flex rounded-full bg-blue-100 dark:bg-blue-900/20 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-400">
                              Verified
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/dashboard")
                        setProfileDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      Dashboard
                    </button>
                    {hasAccountSharingAccess && (
                      <button
                        type="button"
                        onClick={() => {
                          router.push("/account-sharing")
                          setProfileDropdownOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <Share2 className="h-4 w-4 text-muted-foreground" />
                        Account Sharing
                      </button>
                    )}
                  </div>

                  {/* Settings Links */}
                  <div className="border-t border-border/40 py-1">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4">
                      Settings
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/profile-settings?tab=appearance")
                        setProfileDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      Appearance
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/profile-settings?tab=language")
                        setProfileDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Language & Region
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/profile-settings?tab=privacy")
                        setProfileDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      Privacy
                    </button>
                  </div>

                  {/* Profile & Settings Link */}
                  <div className="border-t border-border/40 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/profile-settings")
                        setProfileDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      Profile & Settings
                    </button>
                  </div>

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout()
                      setProfileDropdownOpen(false)
                    }}
                    className="flex w-full items-center gap-2 border-t border-border/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

