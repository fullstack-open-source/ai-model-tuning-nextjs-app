"use client"

import * as React from "react"
import { cn } from "@lib/utils"
import { Check } from "lucide-react"

export interface ToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  icon?: React.ReactNode
  label: string
  variant?: "default" | "primary" | "success" | "warning" | "destructive"
  size?: "sm" | "md" | "lg"
}

export function ToggleButton({
  checked,
  onCheckedChange,
  icon,
  label,
  variant = "default",
  size = "md",
  className,
  disabled,
  ...props
}: ToggleButtonProps) {
  const sizeClasses = {
    sm: "h-9 px-3 text-xs",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  }

  const variantClasses = {
    default: checked
      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
      : "bg-background text-muted-foreground border-border hover:bg-muted hover:border-primary/50",
    primary: checked
      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
      : "bg-background text-muted-foreground border-border hover:bg-primary/5 hover:border-primary/50",
    success: checked
      ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-600/20"
      : "bg-background text-muted-foreground border-border hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-500/50",
    warning: checked
      ? "bg-yellow-600 text-white border-yellow-600 shadow-md shadow-yellow-600/20"
      : "bg-background text-muted-foreground border-border hover:bg-yellow-50 dark:hover:bg-yellow-950/20 hover:border-yellow-500/50",
    destructive: checked
      ? "bg-destructive text-destructive-foreground border-destructive shadow-md shadow-destructive/20"
      : "bg-background text-muted-foreground border-border hover:bg-destructive/5 hover:border-destructive/50",
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-lg border-2 font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "active:scale-[0.98]",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {checked && (
        <div className="absolute top-1 right-1">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-background/20 backdrop-blur-sm">
            <Check className="h-2.5 w-2.5" />
          </div>
        </div>
      )}
      {icon && (
        <span className={cn("transition-transform duration-200", checked && "scale-110")}>
          {icon}
        </span>
      )}
      <span className="font-semibold">{label}</span>
    </button>
  )
}

