/**
 * PageGuard Component
 * Protects pages with authentication and permission checks
 * Redirects unauthorized users and shows loading states
 */

"use client"

import { useEffect, useState, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { usePermissions } from "@hooks/usePermissions"
import { buildLoginUrl } from "@utils/auth-redirect"
import { isProfileComplete } from "@utils/onboarding"

interface PageGuardProps {
  children: ReactNode
  /**
   * Require authentication (default: true)
   */
  requireAuth?: boolean
  /**
   * Redirect to login if not authenticated (default: "/login")
   */
  loginRedirect?: string
  /**
   * Redirect to this path if user doesn't have required permissions (default: "/dashboard")
   */
  unauthorizedRedirect?: string
  /**
   * Required permission(s) - user must have ALL if array, or ANY if use requireAnyPermission
   */
  requirePermission?: string | string[]
  /**
   * User must have ANY of these permissions
   */
  requireAnyPermission?: string[]
  /**
   * User must have ALL of these permissions
   */
  requireAllPermissions?: string[]
  /**
   * Required group(s)
   */
  requireGroup?: string | string[]
  /**
   * User must belong to ANY of these groups
   */
  requireAnyGroup?: string[]
  /**
   * Require super admin
   */
  requireSuperAdmin?: boolean
  /**
   * Require admin (super_admin or admin group)
   */
  requireAdmin?: boolean
  /**
   * Custom loading component
   */
  loadingComponent?: ReactNode
  /**
   * Custom unauthorized component (shown instead of redirecting)
   */
  unauthorizedComponent?: ReactNode
}

export function PageGuard({
  children,
  requireAuth = true,
  loginRedirect = "/login",
  unauthorizedRedirect = "/dashboard",
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireGroup,
  requireAnyGroup,
  requireSuperAdmin,
  requireAdmin,
  loadingComponent,
  unauthorizedComponent,
}: PageGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading, groups, permissions } = useAuth()
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
  } = usePermissions()

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [permissionsReady, setPermissionsReady] = useState(false)

  // Wait for permissions to load before checking
  useEffect(() => {
    if (authLoading) {
      setPermissionsReady(false)
      return
    }
    
    // Check if permissions are loaded (from context or localStorage)
    if (permissions.length > 0 || groups.length > 0) {
      setPermissionsReady(true)
      return
    }
    
    // Check localStorage as fallback
    if (typeof window !== 'undefined') {
      const cachedPermissions = localStorage.getItem('auth_permissions')
      const cachedGroups = localStorage.getItem('auth_groups')
      if (cachedPermissions || cachedGroups) {
        setPermissionsReady(true)
        return
      }
    }
    
    // Wait a bit for permissions to load (max 2 seconds)
    const timeout = setTimeout(() => {
      setPermissionsReady(true) // Proceed anyway after timeout
    }, 2000)
    
    return () => clearTimeout(timeout)
  }, [authLoading, permissions, groups])

  useEffect(() => {
    // Wait for auth and permissions to finish loading
    if (authLoading || !permissionsReady) {
      return
    }

    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setIsChecking(false)
    }, 0)

    // Check authentication
    if (requireAuth && !user) {
      // Build login URL with ?next= parameter to redirect back after login
      const loginUrl = buildLoginUrl(pathname || undefined, loginRedirect)
      router.push(loginUrl)
      return
    }

    // If no auth required and no user, allow access
    if (!requireAuth) {
      setIsAuthorized(true)
      return
    }

    // CRITICAL: Check if profile is complete - redirect to onboarding if incomplete
    // Skip this check for the onboarding page itself to avoid redirect loops
    if (user && pathname !== '/onboarding') {
      // Check is_profile_completed field directly from user object
      const profileCompleted = (user as any)?.is_profile_completed === true
      if (!profileCompleted) {
        router.push('/onboarding')
        return
      }
    }

    // Check super admin requirement
    if (requireSuperAdmin && !isSuperAdmin) {
      if (unauthorizedComponent) {
        setIsAuthorized(false)
      } else {
        router.push(unauthorizedRedirect)
      }
      return
    }

    // Check admin requirement
    if (requireAdmin && !isAdmin) {
      if (unauthorizedComponent) {
        setIsAuthorized(false)
      } else {
        router.push(unauthorizedRedirect)
      }
      return
    }

    // Check single permission (must have ALL if array)
    if (requirePermission) {
      const permissions = Array.isArray(requirePermission)
        ? requirePermission
        : [requirePermission]
      if (!hasAllPermissions(permissions)) {
        if (unauthorizedComponent) {
          setIsAuthorized(false)
        } else {
          router.push(unauthorizedRedirect)
        }
        return
      }
    }

    // Check any permission
    if (requireAnyPermission && requireAnyPermission.length > 0) {
      if (!hasAnyPermission(requireAnyPermission)) {
        if (unauthorizedComponent) {
          setIsAuthorized(false)
        } else {
          router.push(unauthorizedRedirect)
        }
        return
      }
    }

    // Check all permissions
    if (requireAllPermissions && requireAllPermissions.length > 0) {
      if (!hasAllPermissions(requireAllPermissions)) {
        if (unauthorizedComponent) {
          setIsAuthorized(false)
        } else {
          router.push(unauthorizedRedirect)
        }
        return
      }
    }

    // Check single group (must belong to ANY if array)
    if (requireGroup) {
      const groups = Array.isArray(requireGroup) ? requireGroup : [requireGroup]
      if (!groups.some((g) => hasGroup(g))) {
        if (unauthorizedComponent) {
          setIsAuthorized(false)
        } else {
          router.push(unauthorizedRedirect)
        }
        return
      }
    }

    // Check any group
    if (requireAnyGroup && requireAnyGroup.length > 0) {
      if (!hasAnyGroup(requireAnyGroup)) {
        if (unauthorizedComponent) {
          setIsAuthorized(false)
        } else {
          router.push(unauthorizedRedirect)
        }
        return
      }
    }

    // All checks passed
    setIsAuthorized(true)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [
    user,
    authLoading,
    permissionsReady,
    requireAuth,
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireGroup,
    requireAnyGroup,
    requireSuperAdmin,
    requireAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
    router,
    loginRedirect,
    unauthorizedRedirect,
    unauthorizedComponent,
  ])

  // Show loading state
  if (isChecking || authLoading || !permissionsReady) {
    return (
      <>
        {loadingComponent || (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">
                {authLoading ? "Loading..." : "Loading permissions..."}
              </p>
            </div>
          </div>
        )}
      </>
    )
  }

  // Show unauthorized component if provided
  if (isAuthorized === false && unauthorizedComponent) {
    return <>{unauthorizedComponent}</>
  }

  // If not authorized and no custom component, redirect will happen
  if (isAuthorized === false) {
    return null
  }

  // Render children if authorized
  if (isAuthorized === true) {
    return <>{children}</>
  }

  // Still checking (shouldn't reach here, but just in case)
  return null
}

