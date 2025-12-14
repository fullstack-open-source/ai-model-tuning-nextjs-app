/**
 * Authentication Redirect Utilities
 * Handles redirect logic with ?next= parameter for post-login navigation
 */

import type { Group } from "@models/user.model"
import type { User } from "@models/user.model"

/**
 * Build login URL with ?next= parameter
 * @param currentPath - Current pathname to redirect back to after login
 * @param baseLoginPath - Base login path (default: "/login")
 * @returns Login URL with ?next= parameter
 */
export function buildLoginUrl(currentPath?: string, baseLoginPath: string = "/login"): string {
  if (!currentPath || currentPath === "/login" || currentPath === "/signup") {
    return baseLoginPath
  }
  
  // Encode the current path for URL
  const encodedPath = encodeURIComponent(currentPath)
  return `${baseLoginPath}?next=${encodedPath}`
}

/**
 * Extract next parameter from URL search params
 * @param searchParams - URL search params (from useSearchParams() or URL.searchParams)
 * @returns Decoded next path or null
 */
export function getNextPath(searchParams: URLSearchParams | string | null): string | null {
  if (!searchParams) return null
  
  let params: URLSearchParams
  if (typeof searchParams === 'string') {
    params = new URLSearchParams(searchParams)
  } else {
    params = searchParams
  }
  
  const next = params.get('next')
  if (!next) return null
  
  try {
    return decodeURIComponent(next)
  } catch {
    return null
  }
}

/**
 * Get redirect path after login
 * Validates the next path and returns a safe redirect destination
 * @param nextPath - Path from ?next= parameter
 * @param defaultPath - Default path if next is invalid (default: "/dashboard")
 * @returns Safe redirect path
 */
export function getRedirectPathAfterLogin(nextPath: string | null, defaultPath: string = "/dashboard"): string {
  if (!nextPath) return defaultPath
  
  // Security: Only allow relative paths (no external URLs)
  if (nextPath.startsWith('http://') || nextPath.startsWith('https://') || nextPath.startsWith('//')) {
    return defaultPath
  }
  
  // Security: Prevent redirect to login/signup pages (would cause loops)
  if (nextPath.startsWith('/login') || nextPath.startsWith('/signup')) {
    return defaultPath
  }
  
  // Ensure path starts with /
  if (!nextPath.startsWith('/')) {
    return defaultPath
  }
  
  return nextPath
}

/**
 * Check if user has admin access based on groups
 * @param groups - User groups array
 * @returns true if user has admin access
 */
export function hasAdminAccess(groups: Group[] | undefined | null): boolean {
  if (!groups || !Array.isArray(groups)) return false
  return groups.some(
    (group) =>
      group.name === "Super Admin" ||
      group.name === "Admin" ||
      group.name?.toLowerCase() === "admin" ||
      group.name?.toLowerCase() === "super_admin"
  )
}

/**
 * Get redirect path based on user groups and profile
 * Used for post-signup/verification redirects
 * @param groups - User groups array
 * @param user - User object (optional)
 * @returns Redirect path
 */
export function getRedirectPath(
  groups: Group[] | undefined | null,
  user: User | null | undefined = null
): string {
  if (hasAdminAccess(groups)) {
    return "/dashboard"
  }
  
  // Check if profile is complete (if user object provided)
  // Note: We can't use async/await here as this is a synchronous function
  // The caller should handle profile completion check separately if needed
  // For now, we'll just return dashboard and let the app handle redirects
  
  return "/dashboard"
}
