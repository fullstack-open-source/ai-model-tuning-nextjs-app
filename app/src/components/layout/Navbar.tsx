 "use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuthHook } from "@hooks/useAuth"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { useProject } from "@context/ProjectContext";

import {
  LayoutDashboard,
  Users,
  Shield,
  Activity,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Lock,
  Building2,
  BarChart3,
  Moon,
  Sun,
  Monitor,
  CheckCircle2,
  Bell,
  FolderOpen,
  X,
  Share2,
} from "lucide-react"
import { usePermissions } from "@hooks/usePermissions"
import { useTheme } from "@context/ThemeContext"
import { useAuth } from "@context/AuthContext"

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  subItems?: Array<{ name: string; href: string; icon?: React.ComponentType<{ className?: string }>; divider?: boolean }>
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuthHook()
  const { hasPermission, isAdmin, isSuperAdmin } = usePermissions()
  const { theme, setTheme } = useTheme()
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('navbar-collapsed')
      return saved === 'true'
    }
    return false
  })
  const [searchFocused, setSearchFocused] = useState(false)

  const { projectInfo } = useProject();
  const projectName = projectInfo?.name || projectInfo?.title || "Nextjs Starter";
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false)
      }
    }

    if (themeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [themeMenuOpen])
  // Auto-open menu when on groups, permissions, or access-control pages - derive from pathname
  const isAccessControlActive = pathname?.startsWith("/admin/groups") || pathname?.startsWith("/admin/permissions") || pathname?.startsWith("/admin/access-control") || false
  
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "access-control": false,
  })
  
  // Derive current open state - auto-open if on that page
  const currentOpenState = useMemo(() => ({
    "access-control": openMenus["access-control"] || isAccessControlActive,
  }), [openMenus, isAccessControlActive])

  // Permission checks for menu items (based on seed-defaults.js)
  const hasDashboardAccess = hasPermission("view_dashboard") || isAdmin || isSuperAdmin
  const hasNotificationAccess = hasPermission("view_notification") || isAdmin || isSuperAdmin
  const hasProfileAccess = hasPermission("view_profile") || isAdmin || isSuperAdmin
  const hasUserManagementAccess = hasPermission("view_users") || hasPermission("manage_users") || isAdmin || isSuperAdmin
  const hasAccessControlAccess = hasPermission("view_group") || hasPermission("manage_groups") || 
                                  hasPermission("view_permission") || hasPermission("manage_permissions") ||
                                  isAdmin || isSuperAdmin
  const hasActivityAccess = hasPermission("view_activity_log") || hasPermission("view_own_activity_log") || 
                           hasPermission("manage_activity_log") || isAdmin || isSuperAdmin
  const hasMediaAccess = hasPermission("view_media") || hasPermission("manage_media") || isAdmin || isSuperAdmin
  const hasProjectSettingsAccess = hasPermission("view_project_settings") || hasPermission("manage_project_settings") || 
                                   isAdmin || isSuperAdmin
  const hasSystemAnalyticsAccess = hasPermission("view_system_analytics") || hasPermission("manage_system_analytics") || 
                                   isAdmin || isSuperAdmin
  const hasAccountSharingAccess = hasPermission("view_account_sharing") || hasPermission("manage_account_sharing") || 
                                   isAdmin || isSuperAdmin
  
  // Build navigation array with useMemo for performance
  const navigation: NavItem[] = useMemo(() => [
    // Dashboard - requires view_dashboard permission
    ...(hasDashboardAccess ? [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ] : []),
    // Notifications - requires view_notification permission
    ...(hasNotificationAccess ? [
      { name: "Notifications", href: "/notifications", icon: Bell },
    ] : []),
    // Account Sharing - requires view_account_sharing or manage_account_sharing permission
    ...(hasAccountSharingAccess ? [
      { name: "Account Sharing", href: "/account-sharing", icon: Share2 },
    ] : []),
    // Users - requires view_users or manage_users permission
    ...(hasUserManagementAccess ? [
      { name: "Users", href: "/admin/users", icon: Users },
    ] : []),
    // Access Control - only for admins/super admins with group or permission permissions
    ...(hasAccessControlAccess ? [
      {
        name: "Access Control",
        href: "/admin/access-control",
        icon: Lock,
        subItems: [
          { name: "Access Control", href: "/admin/access-control", icon: Lock },
          ...(hasPermission("view_group") || hasPermission("manage_groups") || isAdmin || isSuperAdmin ? [
            { name: "Groups", href: "/admin/groups", icon: Shield },
          ] : []),
          ...(hasPermission("view_permission") || hasPermission("manage_permissions") || isAdmin || isSuperAdmin ? [
            { name: "Permissions", href: "/admin/permissions", icon: Shield, divider: true },
          ] : []),
        ],
      },
    ] : []),
    // Activity - requires view_activity_log, view_own_activity_log, or manage_activity_log permission
    ...(hasActivityAccess ? [
      { name: "Activity", href: "/activity", icon: Activity },
    ] : []),
    // Media - requires view_media or manage_media permission
    ...(hasMediaAccess ? [
      { name: "Media", href: "/media", icon: FolderOpen },
    ] : []),
    // Project Settings - requires view_project_settings or manage_project_settings permission
    ...(hasProjectSettingsAccess ? [
      { name: "Project Settings", href: "/admin/project-settings", icon: Building2 },
    ] : []),
    // System Analytics - requires view_system_analytics or manage_system_analytics permission
    ...(hasSystemAnalyticsAccess ? [
      { name: "System Analytics", href: "/admin/system-analytics", icon: BarChart3 },
    ] : []),
  ], [hasDashboardAccess, hasNotificationAccess, hasAccountSharingAccess, hasUserManagementAccess, hasAccessControlAccess, hasActivityAccess, hasMediaAccess, hasProjectSettingsAccess, hasSystemAnalyticsAccess, hasPermission, isAdmin, isSuperAdmin])

  const toggleMenu = (menuKey: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }))
  }

  // Listen for toggle events from TopNav (sidebar toggle button)
  useEffect(() => {
    const handleNavbarToggle = (event: CustomEvent<{ collapsed: boolean }>) => {
      setIsCollapsed(event.detail.collapsed)
    }

    window.addEventListener('navbar-toggle', handleNavbarToggle as EventListener)
    return () => {
      window.removeEventListener('navbar-toggle', handleNavbarToggle as EventListener)
    }
  }, [])

  // Filter navigation based on search query
  const filteredNavigation = useMemo(() => {
    if (!searchQuery.trim()) return navigation

    const query = searchQuery.toLowerCase().trim()
    return navigation.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(query)
      const subItemsMatch = item.subItems?.some(subItem => 
        subItem.name.toLowerCase().includes(query)
      )
      return nameMatch || subItemsMatch
    }).map(item => {
      if (!item.subItems) return item
      
      const filteredSubItems = item.subItems.filter(subItem =>
        subItem.name.toLowerCase().includes(query)
      )
      
      return {
        ...item,
        subItems: filteredSubItems.length > 0 ? filteredSubItems : item.subItems
      }
    })
  }, [navigation, searchQuery])

  // Clear search
  const clearSearch = () => {
    setSearchQuery("")
    setSearchFocused(false)
  }

  if (!user) return null

  return (
    <aside className={`hidden md:flex sticky top-0 h-screen flex-col border-r border-border/40 bg-background/95 transition-all duration-300 ${
      isCollapsed ? 'w-16 px-2' : 'w-64 px-3'
    } py-4 overflow-hidden`}>
      {/* Header with Logo */}
      <div className="mb-4 flex items-center justify-center overflow-hidden">
        <Link 
          href={hasDashboardAccess ? "/dashboard" : hasProfileAccess ? "/profile-settings" : "/"} 
          className={`flex items-center gap-2 px-2 transition-opacity overflow-hidden ${isCollapsed ? 'w-full justify-center' : 'flex-1 min-w-0'}`}
          title={isCollapsed ? projectName : undefined}
        >
          {isCollapsed ? (
              // Collapsed state: Show favicon or fallback icon
              projectInfo?.logo ? (
                <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden">
                  <img 
                    src={projectInfo.logo} 
                    alt={projectName}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <div className="absolute inset-0 hidden items-center justify-center">
                    <LayoutDashboard className="h-5 w-5 text-primary" />
                  </div>
                </div>
              ) : (
                <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                </div>
              )
            ) : (
              // Expanded state - always show logo + name
              <>
                {/* Logo container - transparent background */}
                {projectInfo?.logo ? (
                  <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden">
                    <img 
                      src={projectInfo.logo} 
                      alt={projectName}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                    <div className="absolute inset-0 hidden items-center justify-center">
                      <LayoutDashboard className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                ) : (
                  <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
                    <LayoutDashboard className="h-5 w-5 text-primary" />
                  </div>
                )}
                {/* Project name - always shown */}
                <span className="text-lg font-bold truncate overflow-hidden">{projectName}</span>
              </>
            )}
        </Link>
      </div>

      {/* Enhanced Search */}
      {!isCollapsed && (
        <div className="mb-4 px-2">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
              searchFocused ? 'text-primary' : 'text-muted-foreground'
            }`} />
            <Input
              type="search"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="h-9 rounded-lg border-input bg-muted/50 pl-9 pr-8 text-xs transition-all focus:bg-background focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted transition-colors"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {searchQuery && filteredNavigation.length === 0 && (
            <div className="mt-2 px-2 text-xs text-muted-foreground">
              No results found
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-1 pb-4 min-h-0">
        {(isCollapsed ? navigation : filteredNavigation).map((item) => {
          const hasSubItems = item.subItems && item.subItems.length > 0
          const menuKey = item.name.toLowerCase().replace(/\s+/g, "-") as keyof typeof currentOpenState
          
          // Check if any sub-item is active - improved matching for datasets page
          const hasActiveSubItem = hasSubItems && item.subItems && item.subItems.some(
            (subItem) => {
              // Exact match
              if (pathname === subItem.href) return true
              // Path starts with subItem href (but not with other subItems)
              if (pathname?.startsWith(subItem.href + "/") && item.subItems) {
                // Check if it's not actually matching another subItem
                const otherSubItems = item.subItems.filter(si => si.href !== subItem.href)
                const matchesOther = otherSubItems.some(si => pathname?.startsWith(si.href + "/"))
                return !matchesOther
              }
              return false
            }
          )
          
          // Menu should be open if any sub-item is active OR if manually opened
          const isMenuOpen = (currentOpenState[menuKey] ?? false) || hasActiveSubItem || (pathname?.startsWith(item.href) && hasSubItems)
          
          // Parent is active only if it's the exact path and no sub-item is active
          const isActive = !hasActiveSubItem && (pathname === item.href || (pathname?.startsWith(item.href + "/") && !hasSubItems))

          if (hasSubItems) {
            // When collapsed, show only icon with tooltip
            if (isCollapsed) {
              return (
                <div key={item.name} className="relative group">
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => toggleMenu(menuKey)}
                    className="w-full justify-center p-0 h-9"
                    title={item.name}
                  >
                    <item.icon className="h-4 w-4" />
                  </Button>
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border border-border whitespace-nowrap">
                      {item.name}
                    </div>
                  </div>
                  {/* Submenu when collapsed - show as popover */}
                  {isMenuOpen && (
                    <div className="absolute left-full ml-2 top-0 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
                      {item.subItems?.map((subItem, index) => {
                        let isSubActive = false
                        if (pathname === subItem.href) {
                          isSubActive = true
                        } else if (pathname?.startsWith(subItem.href + "/") && item.subItems) {
                          const otherSubItems = item.subItems.filter(si => si.href !== subItem.href)
                          const matchesOtherMore = otherSubItems.some(si => {
                            const otherPath = si.href + "/"
                            const currentPath = subItem.href + "/"
                            return pathname?.startsWith(otherPath) && otherPath.length > currentPath.length
                          })
                          isSubActive = !matchesOtherMore
                        }
                        
                        return (
                          <div key={subItem.name}>
                            {subItem.divider && index > 0 && (
                              <div className="my-1 border-t border-border/40" />
                            )}
                            <Button
                              variant={isSubActive ? "default" : "ghost"}
                              size="sm"
                              onClick={() => router.push(subItem.href)}
                              className="flex w-full justify-start items-center gap-2 rounded-md px-3 mx-1"
                            >
                              {subItem.icon && <subItem.icon className="h-3.5 w-3.5 flex-shrink-0" />}
                              <span className="truncate text-xs">{subItem.name}</span>
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // Expanded state with submenu
            return (
              <div key={item.name} className="space-y-1 relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMenu(menuKey)}
                  className="flex w-full justify-between gap-2 rounded-md px-3 overflow-hidden"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate text-sm">{item.name}</span>
                  </div>
                  {isMenuOpen ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </Button>
                {/* Tooltip for truncated text */}
                <div className="absolute left-0 top-0 bottom-0 right-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border border-border whitespace-nowrap">
                    {item.name}
                  </div>
                </div>
                {isMenuOpen && (
                  <div className="ml-4 space-y-1 border-l border-border/40 pl-2 overflow-hidden">
                    {item.subItems?.map((subItem, index) => {
                      // Improved active state detection for datasets
                      let isSubActive = false
                      if (pathname === subItem.href) {
                        isSubActive = true
                      } else if (pathname?.startsWith(subItem.href + "/") && item.subItems) {
                        // Check if it's not matching another subItem more specifically
                        const otherSubItems = item.subItems.filter(si => si.href !== subItem.href)
                        const matchesOtherMore = otherSubItems.some(si => {
                          const otherPath = si.href + "/"
                          const currentPath = subItem.href + "/"
                          return pathname?.startsWith(otherPath) && otherPath.length > currentPath.length
                        })
                        isSubActive = !matchesOtherMore
                      }
                      
                      return (
                        <div key={subItem.name} className="relative group/sub">
                          {subItem.divider && index > 0 && (
                            <div className="my-1 border-t border-border/40" />
                          )}
                          <Button
                            variant={isSubActive ? "default" : "ghost"}
                            size="sm"
                            onClick={() => router.push(subItem.href)}
                            className="flex w-full justify-start items-center gap-2 rounded-md px-3 overflow-hidden"
                          >
                            {subItem.icon && <subItem.icon className="h-3.5 w-3.5 flex-shrink-0" />}
                            <span className="truncate text-xs">{subItem.name}</span>
                          </Button>
                          {/* Tooltip for truncated sub-item text */}
                          <div className="absolute left-0 top-0 bottom-0 right-0 pointer-events-none opacity-0 group-hover/sub:opacity-100 transition-opacity z-50">
                            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border border-border whitespace-nowrap">
                              {subItem.name}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // Regular menu item
          if (isCollapsed) {
            return (
              <div key={item.name} className="relative group">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => router.push(item.href)}
                  className="w-full justify-center p-0 h-9"
                  title={item.name}
                >
                  <item.icon className="h-4 w-4" />
                </Button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border border-border whitespace-nowrap">
                    {item.name}
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={item.name} className="relative group">
              <Button
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => router.push(item.href)}
                className="flex w-full justify-start gap-2 rounded-md px-3 overflow-hidden"
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">{item.name}</span>
              </Button>
              {/* Tooltip for truncated text */}
              <div className="absolute left-0 top-0 bottom-0 right-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border border-border whitespace-nowrap">
                  {item.name}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Appearance section with dropdown - styled like old profile dropdown */}
      <div className="relative mt-auto border-t border-border/40 pt-3 flex-shrink-0" ref={themeMenuRef}>
        {isCollapsed ? (
          <div className="relative group flex justify-center">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((open) => !open)}
              className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/60 p-2 hover:border-primary/60 transition-colors"
              title="Appearance"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4 text-primary" />
              ) : theme === "dark" ? (
                <Moon className="h-4 w-4 text-primary" />
              ) : (
                <Monitor className="h-4 w-4 text-primary" />
              )}
            </button>
            {/* Tooltip */}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border border-border whitespace-nowrap">
                Appearance: {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-2">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/60 px-3 py-2 text-left hover:border-primary/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  {theme === "light" ? (
                    <Sun className="h-4 w-4 text-primary" />
                  ) : theme === "dark" ? (
                    <Moon className="h-4 w-4 text-primary" />
                  ) : (
                    <Monitor className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="text-xs">
                  <div className="font-medium text-foreground">Appearance</div>
                  <div className="text-muted-foreground">
                    {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"}
                  </div>
                </div>
              </div>
              {themeMenuOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        )}

        {themeMenuOpen && (
          <div className={`absolute z-50 rounded-xl border border-border/60 bg-background shadow-xl ${
            isCollapsed ? 'bottom-14 left-2 right-2 min-w-[200px]' : 'bottom-14 left-2 right-2'
          }`}>
            <div className="border-b px-3 py-3">
              <div className="text-sm font-semibold">Appearance</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Choose your preferred theme
              </div>
            </div>

            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setTheme("light")
                  setThemeMenuOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  theme === "light"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Sun className="h-4 w-4" />
                <span>Light</span>
                {theme === "light" && (
                  <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme("dark")
                  setThemeMenuOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  theme === "dark"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Moon className="h-4 w-4" />
                <span>Dark</span>
                {theme === "dark" && (
                  <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme("dynamic")
                  setThemeMenuOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  theme === "dynamic"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Monitor className="h-4 w-4" />
                <span>System</span>
                {theme === "dynamic" && (
                  <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

