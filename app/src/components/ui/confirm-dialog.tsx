"use client"

import { useEffect, useState, useCallback, ReactNode } from "react"
import { X, AlertTriangle, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react"
import { cn } from "@lib/utils"
import { Button } from "./button"

export type ConfirmDialogState = "confirm" | "loading" | "success" | "error"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  icon?: ReactNode
  variant?: "default" | "destructive"
  successMessage?: string
  errorMessage?: string
  autoCloseOnSuccess?: boolean
  autoCloseDelay?: number
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Yes, Delete",
  cancelText = "Cancel",
  icon,
  variant = "destructive",
  successMessage = "Deleted successfully!",
  errorMessage,
  autoCloseOnSuccess = true,
  autoCloseDelay = 2000,
}: ConfirmDialogProps) {
  const [state, setState] = useState<ConfirmDialogState>("confirm")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    if (state === "loading") return
    setState("confirm")
    setErrorMsg(null)
    onClose()
  }, [state, onClose])

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setState("confirm")
      setErrorMsg(null)
    }
  }, [open])

  // Auto-close on success
  useEffect(() => {
    if (state === "success" && autoCloseOnSuccess && open) {
      const timer = setTimeout(() => {
        handleClose()
      }, autoCloseDelay)
      return () => clearTimeout(timer)
    }
  }, [state, autoCloseOnSuccess, autoCloseDelay, open, handleClose])

  // Close on ESC
  useEffect(() => {
    if (!open || state === "loading") return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, state, handleClose])

  const handleConfirm = async () => {
    setState("loading")
    setErrorMsg(null)

    try {
      await onConfirm()
      setState("success")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : errorMessage || "An error occurred"
      setErrorMsg(message)
      setState("error")
    }
  }

  const getDefaultIcon = () => {
    if (state === "success") {
      return <CheckCircle2 className="h-6 w-6 text-green-600" />
    }
    if (state === "error") {
      return <AlertCircle className="h-6 w-6 text-red-600" />
    }
    if (state === "loading") {
      return <Loader2 className="h-6 w-6 text-primary animate-spin" />
    }
    if (variant === "destructive") {
      return <AlertTriangle className="h-6 w-6 text-destructive" />
    }
    return icon || <AlertTriangle className="h-6 w-6 text-primary" />
  }

  const getTitle = () => {
    if (state === "success") return "Success!"
    if (state === "error") return "Error"
    if (state === "loading") return "Processing..."
    return title
  }

  const getDescription = () => {
    if (state === "success") return successMessage
    if (state === "error") return errorMsg || errorMessage || "Something went wrong. Please try again."
    if (state === "loading") return "Please wait while we process your request..."
    return description
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={state !== "loading" ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className={cn(
          "relative z-50 w-full max-w-md mx-4 bg-background rounded-lg shadow-2xl border border-border",
          "transform transition-all duration-300",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        {/* Content */}
        <div className="p-6">
          {/* Icon and State Indicator */}
          <div className="flex items-center justify-center mb-4">
            <div
              className={cn(
                "flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300",
                state === "success" && "bg-green-100 dark:bg-green-900/20",
                state === "error" && "bg-red-100 dark:bg-red-900/20",
                state === "loading" && "bg-primary/10",
                state === "confirm" && variant === "destructive" && "bg-destructive/10",
                state === "confirm" && variant === "default" && "bg-primary/10"
              )}
            >
              {getDefaultIcon()}
            </div>
          </div>

          {/* Title */}
          <h2
            id="confirm-dialog-title"
            className={cn(
              "text-xl font-semibold text-center mb-2",
              state === "success" && "text-green-600 dark:text-green-400",
              state === "error" && "text-red-600 dark:text-red-400",
              state === "loading" && "text-foreground",
              state === "confirm" && "text-foreground"
            )}
          >
            {getTitle()}
          </h2>

          {/* Description */}
          <p
            id="confirm-dialog-description"
            className={cn(
              "text-sm text-muted-foreground text-center mb-6",
              state === "error" && "text-red-600 dark:text-red-400"
            )}
          >
            {getDescription()}
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {state === "confirm" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  disabled={false}
                >
                  {cancelText}
                </Button>
                <Button
                  variant={variant === "destructive" ? "destructive" : "default"}
                  onClick={handleConfirm}
                  className="flex-1 gap-2"
                  disabled={false}
                >
                  {variant === "destructive" && <Trash2 className="h-4 w-4" />}
                  {confirmText}
                </Button>
              </>
            )}

            {state === "success" && (
              <Button
                variant="default"
                onClick={handleClose}
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Close
              </Button>
            )}

            {state === "error" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  variant={variant === "destructive" ? "destructive" : "default"}
                  onClick={handleConfirm}
                  className="flex-1 gap-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  Try Again
                </Button>
              </>
            )}

            {state === "loading" && (
              <div className="w-full">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled
                >
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Close button (only visible when not loading) */}
        {state !== "loading" && (
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
