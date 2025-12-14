"use client"

import { ReactNode, useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@lib/utils"

interface SidePanelProps {
  open: boolean
  title?: string
  description?: string
  width?: "sm" | "md" | "lg" | "xl"
  side?: "right" | "left"
  onClose: () => void
  children: ReactNode
  actions?: ReactNode // Action buttons to display in header (e.g., Refresh button)
}

const widthMap: Record<NonNullable<SidePanelProps["width"]>, string> = {
  sm: "w-full max-w-md",
  md: "w-full max-w-lg",
  lg: "w-full max-w-2xl",
  xl: "w-full max-w-4xl",
}

export function SidePanel({
  open,
  title,
  description,
  width = "md",
  side = "right",
  onClose,
  children,
  actions,
}: SidePanelProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - full height from top 0 to bottom 0, no gaps */}
      <aside
        className={cn(
          "h-screen bg-background shadow-2xl border-l border-border/60 flex flex-col",
          "transform transition-transform duration-300 ease-in-out",
          widthMap[width],
          side === "left" ? "order-first border-l-0 border-r" : "order-last"
        )}
        aria-modal="true"
        role="dialog"
      >
        {/* Header - flush with top (0), no gap */}
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-3 bg-muted/30 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            {title && (
              <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content area - fills remaining space, no top/bottom padding, only horizontal padding */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-5">
            {children}
          </div>
        </div>
      </aside>
    </div>
  )
}


