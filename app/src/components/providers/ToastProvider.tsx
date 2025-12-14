/**
 * Toast Provider Component
 * Provides toast notifications to the app
 */

"use client"

import { ToastProvider as RadixToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastIcon } from "@components/ui/toast"
import { useToast } from "@hooks/useToast"

export function ToastProvider() {
  const { toasts, dismiss } = useToast()

  return (
    <RadixToastProvider>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          open={true}
          onOpenChange={(open) => {
            if (!open) dismiss(toast.id)
          }}
        >
          <div className="flex items-start gap-3">
            <ToastIcon variant={toast.variant} />
            <div className="flex-1">
              <ToastTitle>{toast.title}</ToastTitle>
              {toast.message && <ToastDescription>{toast.message}</ToastDescription>}
            </div>
          </div>
        </Toast>
      ))}
      <ToastViewport />
    </RadixToastProvider>
  )
}

