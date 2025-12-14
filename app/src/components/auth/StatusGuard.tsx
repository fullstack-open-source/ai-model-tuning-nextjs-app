"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { profileService } from "@services/profile.service"

/**
 * StatusGuard Component
 * Redirects suspended users to the suspended page immediately
 */
export function StatusGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, tokens, apiService } = useAuth()
  const [checking, setChecking] = useState(true)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRedirectingRef = useRef(false)

  // Check user status immediately and periodically
  const checkUserStatus = useCallback(async (isInitial = false) => {
    // Skip check if not authenticated
    if (!user || !tokens.session_token) {
      if (isInitial) {
        setChecking(false)
      }
      return
    }

    // Skip if already on suspended page and we're not doing initial check
    if (!isInitial && pathname === "/suspended") {
      return
    }

    // Prevent multiple simultaneous redirects
    if (isRedirectingRef.current) {
      return
    }

    try {
      // Set auth API for profile service
      profileService.setAuthApi(apiService)

      // Use cache for all checks (localStorage -> Redis -> DB)
      // getProfile(false) will check localStorage first, then Redis, then DB
      // This reduces API load significantly
      const response = await profileService.getProfile(false)
      
      // If response indicates it came from localStorage, that's fine
      // We only need the status field which should be in localStorage
      
      if (response?.success && response.data) {
        const status = response.data.status || null

        // Redirect to suspended page immediately if status is SUSPENDED
        if (status === "SUSPENDED" && pathname !== "/suspended") {
          isRedirectingRef.current = true
          router.push("/suspended")
          router.refresh() // Force refresh to ensure redirect happens
          return
        }

        // Redirect away from suspended page if status is not SUSPENDED
        if (status !== "SUSPENDED" && pathname === "/suspended") {
          isRedirectingRef.current = true
          router.push("/dashboard")
          router.refresh()
          return
        }
      }
    } catch (error) {
      console.error("Error checking user status:", error)
      // On error, allow access (don't block user)
    } finally {
      if (isInitial) {
        setChecking(false)
      }
      // Reset redirect flag after a short delay
      setTimeout(() => {
        isRedirectingRef.current = false
      }, 1000)
    }
  }, [user, tokens.session_token, apiService, pathname, router])

  // Initial check and setup periodic checks
  useEffect(() => {
    if (!user || !tokens.session_token) {
      setChecking(false)
      return
    }

    // Immediate check
    void checkUserStatus(true)

    // Set up periodic checks every 30 seconds (reduced from 3 seconds to minimize API calls)
    // Status changes are rare, so checking every 30 seconds is sufficient
    checkIntervalRef.current = setInterval(() => {
      void checkUserStatus(false)
    }, 30000) // 30 seconds instead of 3 seconds

    // Cleanup interval on unmount
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [user, tokens.session_token, checkUserStatus])

  // Check on pathname change (use cache, don't force refresh unless needed)
  useEffect(() => {
    if (user && tokens.session_token && pathname !== "/suspended") {
      // Use cached profile (from localStorage or Redis), only refresh if status check fails
      profileService.setAuthApi(apiService)
      profileService.getProfile(false).then((response) => {
        if (response?.success && response.data) {
          const status = response.data.status || null
          if (status === "SUSPENDED") {
            isRedirectingRef.current = true
            router.push("/suspended")
            router.refresh()
          }
        }
      }).catch(() => {
        // Silently fail
      })
    }
  }, [pathname, user, tokens.session_token, apiService, router])

  // Show loading state only on initial check
  if (checking && user && pathname !== "/suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return <>{children}</>
}

