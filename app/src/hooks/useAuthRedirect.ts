/**
 * useAuthRedirect Hook
 * Redirects authenticated users away from auth pages (login, signup, etc.)
 * to dashboard or the ?next= URL parameter
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { getNextPath, getRedirectPathAfterLogin } from "@utils/auth-redirect"

interface UseAuthRedirectOptions {
  /** Where to redirect if no ?next= param (default: "/dashboard") */
  defaultRedirect?: string
  /** Whether to check auth status (default: true) */
  enabled?: boolean
}

interface UseAuthRedirectReturn {
  /** Whether we're still checking auth status */
  isChecking: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** The path user will be redirected to */
  redirectPath: string
}

/**
 * Hook to redirect authenticated users from auth pages
 * 
 * Usage:
 * ```tsx
 * const { isChecking, isAuthenticated } = useAuthRedirect()
 * 
 * // Show loading while checking
 * if (isChecking) return <LoadingSpinner />
 * 
 * // Only render auth page content if not authenticated
 * // (authenticated users are automatically redirected)
 * ```
 */
export function useAuthRedirect(options: UseAuthRedirectOptions = {}): UseAuthRedirectReturn {
  const { defaultRedirect = "/dashboard", enabled = true } = options
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, tokens, loading } = useAuth()
  
  const [isChecking, setIsChecking] = useState(true)
  
  // Get redirect path from ?next= parameter or use default
  const nextPath = getNextPath(searchParams)
  const redirectPath = getRedirectPathAfterLogin(nextPath) || defaultRedirect
  
  // Check if user is authenticated
  const isAuthenticated = !!(user && tokens?.access_token)
  
  useEffect(() => {
    if (!enabled) {
      setIsChecking(false)
      return
    }
    
    // Wait for auth loading to complete
    if (loading) {
      return
    }
    
    // If user is authenticated, redirect them
    if (isAuthenticated) {
      router.replace(redirectPath)
      return
    }
    
    // Not authenticated, allow access to auth page
    setIsChecking(false)
  }, [enabled, loading, isAuthenticated, router, redirectPath])
  
  return {
    isChecking: enabled ? (loading || isChecking) : false,
    isAuthenticated,
    redirectPath,
  }
}

export default useAuthRedirect

