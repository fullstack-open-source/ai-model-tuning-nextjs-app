/**
 * useApiCall Hook
 * Combines API calls with loading, error handling, and toast notifications
 * Prevents multiple simultaneous calls
 */

import { useState, useCallback, useRef } from "react"
import { useToast } from "./useToast"
import { handleError } from "@lib/error/errorHandler"
import type { ApiResponse } from "@models/api.model"

interface UseApiCallOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: any) => void
  successMessage?: string
  showErrorToast?: boolean
  showSuccessToast?: boolean
}

export function useApiCall<T = any>(
  apiCall: () => Promise<ApiResponse<T>>,
  options: UseApiCallOptions<T> = {}
) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<any>(null)
  const { showError, showSuccess } = useToast()
  const abortControllerRef = useRef<AbortController | null>(null)
  const isCallingRef = useRef(false)

  const execute = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isCallingRef.current || loading) {
      return
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    isCallingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const response = await apiCall()

      if (response?.success) {
        const resultData = response.data ?? null
        setData(resultData)
        setError(null)

        // Skip if this is a component unmounted response (silent success)
        if (response?.message === "Component unmounted") {
          return { success: true, data: resultData }
        }

        // Show success toast if enabled
        if (options.showSuccessToast !== false && options.successMessage) {
          showSuccess(options.successMessage)
        }

        // Call success callback
        if (options.onSuccess && resultData !== null) {
          options.onSuccess(resultData)
        }

        return { success: true, data: resultData }
      } else {
        // Handle API error response - extract user-friendly message
        const errorData = response?.error || {}
        const errorCode = typeof errorData === 'string' ? errorData : (errorData.code || errorData.id)
        const errorMessage = typeof errorData === 'object' 
          ? (errorData.message || errorData.reason || response?.message)
          : (response?.message || "Request failed")
        
        // Get user-friendly error message from error handler
        const friendlyError = handleError({ 
          response: { 
            data: { 
              error: errorCode,
              errorObj: errorData
            } 
          },
          error: errorData
        })
        
        // Use friendly message if available, otherwise use original
        const displayMessage = friendlyError.message || errorMessage
        
        // Skip error handling for component unmounted (silent failure)
        if (displayMessage === "Component unmounted") {
          return { success: true, data: null }
        }
        
        const apiError = new Error(displayMessage)
        apiError.name = errorCode || "API_ERROR"
        setError(apiError)

        // Show error toast if enabled
        if (options.showErrorToast !== false) {
          showError(displayMessage)
        }

        // Call error callback
        if (options.onError) {
          options.onError(apiError)
        }

        return { success: false, error: apiError }
      }
    } catch (err: any) {
      // Handle network/request errors
      const errorMessage = handleError(err)
      const errorText = typeof errorMessage === 'string' ? errorMessage : errorMessage.message || 'An error occurred'
      
      // Skip error handling for component unmounted (silent failure)
      if (errorText === "Component unmounted" || errorText?.includes('Component unmounted')) {
        return { success: true, data: null }
      }
      
      setError(errorMessage)

      // Show error toast if enabled
      if (options.showErrorToast !== false) {
        showError(errorText)
      }

      // Call error callback
      if (options.onError) {
        options.onError(errorMessage)
      }

      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
      isCallingRef.current = false
      abortControllerRef.current = null
    }
  }, [apiCall, options, loading, showError, showSuccess])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
    isCallingRef.current = false
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return {
    execute,
    loading,
    data,
    error,
    reset,
  }
}

