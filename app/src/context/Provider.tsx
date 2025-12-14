/**
 * Root Provider Component
 * Wraps app with all context providers
 */

"use client"

import { ReactNode } from "react"
import { AuthProvider } from "@context/AuthContext"
import { ThemeProvider } from "@context/ThemeContext"
import { I18nProvider } from "@context/I18nContext"
import { ProjectProvider } from "@context/ProjectContext"
import { WebSocketProvider } from "@context/WebSocketContext"
import { ToastProvider } from "@components/providers/ToastProvider"
import { StatusGuard } from "@components/auth/StatusGuard"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <WebSocketProvider>
            <ProjectProvider>
              <ToastProvider />
              <StatusGuard>
                {children}
              </StatusGuard>
            </ProjectProvider>
          </WebSocketProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

