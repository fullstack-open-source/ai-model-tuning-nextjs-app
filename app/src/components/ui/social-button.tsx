/**
 * Social Login Button Component
 * Beautiful social login buttons with icons
 */

import * as React from "react"
import { cn } from "@lib/utils"
import { Button } from "./button"

export interface SocialButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  provider: "google" | "apple" | "microsoft" | "phone"
  children: React.ReactNode
}

const SocialButton = React.forwardRef<HTMLButtonElement, SocialButtonProps>(
  ({ className, provider, children, ...props }, ref) => {
    const getIcon = () => {
      switch (provider) {
        case "google":
          return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )
        case "apple":
          return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          )
        case "microsoft":
          return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M11.4 11.4H1V1h10.4v10.4z" fill="#F25022" />
              <path d="M23 11.4H12.6V1H23v10.4z" fill="#7FBA00" />
              <path d="M11.4 23H1V12.6h10.4V23z" fill="#00A4EF" />
              <path d="M23 23H12.6V12.6H23V23z" fill="#FFB900" />
            </svg>
          )
        case "phone":
          return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          )
      }
    }

    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn(
          "w-full bg-white hover:bg-gray-50 border-gray-300 text-gray-700 font-medium",
          "flex items-center justify-center gap-3 h-12",
          className
        )}
        {...props}
      >
        {getIcon()}
        {children}
      </Button>
    )
  }
)
SocialButton.displayName = "SocialButton"

export { SocialButton }
