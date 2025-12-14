/**
 * useToast Hook
 * Manages toast notifications
 */

import React, { useState, useCallback, useEffect } from "react"
import type { ErrorMessage } from "@lib/error/errorHandler"

export interface Toast {
  id: string
  title: string
  message: string
  variant: "success" | "error" | "warning" | "info" | "default"
  duration?: number
}

let toastId = 0
const listeners: Set<(toasts: Toast[]) => void> = new Set()
let toasts: Toast[] = []

function notify() {
  listeners.forEach((listener) => listener([...toasts]))
}

export function useToast() {
  const [, setState] = useState(toasts)

  React.useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setState(newToasts)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const toast = useCallback(
    (toastData: Omit<Toast, "id">) => {
      const id = (toastId++).toString()
      const newToast: Toast = {
        id,
        duration: 5000,
        ...toastData,
      }
      toasts = [...toasts, newToast]
      notify()

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          dismiss(id)
        }, newToast.duration)
      }

      return id
    },
    []
  )

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, [])

  const showError = useCallback(
    (error: ErrorMessage | string) => {
      if (typeof error === "string") {
        return toast({
          title: "Error",
          message: error,
          variant: "error",
        })
      }
      return toast({
        title: error.title,
        message: error.message,
        variant: error.type === "error" ? "error" : error.type === "warning" ? "warning" : "info",
      })
    },
    [toast]
  )

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      return toast({
        title,
        message: message || "",
        variant: "success",
      })
    },
    [toast]
  )

  const showWarning = useCallback(
    (title: string, message?: string) => {
      return toast({
        title,
        message: message || "",
        variant: "warning",
      })
    },
    [toast]
  )

  const showInfo = useCallback(
    (title: string, message?: string) => {
      return toast({
        title,
        message: message || "",
        variant: "info",
      })
    },
    [toast]
  )

  return {
    toast,
    dismiss,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    toasts,
  }
}

