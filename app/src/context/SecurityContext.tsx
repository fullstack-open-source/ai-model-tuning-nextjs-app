/**
 * Security Context
 * Disables inspect, right-click, and other shortcuts in production
 * Auto-logout and blocks access when DevTools are detected
 * 
 * Controlled by: NEXT_PUBLIC_SECURITY_ENABLED environment variable
 * - Set to "true" to enable security features
 * - Set to "false" or omit to disable (default in development)
 */

"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react"

interface SecurityContextType {
  isProduction: boolean
  devToolsDetected: boolean
  securityEnabled: boolean
}

const SecurityContext = createContext<SecurityContextType>({
  isProduction: false,
  devToolsDetected: false,
  securityEnabled: false,
})

interface SecurityProviderProps {
  children: ReactNode
  enabled?: boolean // Allow manual override
}

// Security violation handler - clears auth and redirects
const handleSecurityViolation = () => {
  // Clear all auth data from localStorage
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_user")
    localStorage.removeItem("auth_tokens")
    localStorage.removeItem("auth_groups")
    localStorage.removeItem("auth_permissions")
    
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
  }
}

export function SecurityProvider({ children, enabled = true }: SecurityProviderProps) {
  // Check both APP_MODE and NEXT_PUBLIC_SECURITY_ENABLED for flexibility
  const isProduction = process.env.APP_MODE === "production"
  const securityEnabled = enabled && (
    process.env.NEXT_PUBLIC_SECURITY_ENABLED === "true" || 
    (isProduction && process.env.NEXT_PUBLIC_SECURITY_ENABLED !== "false")
  )
  
  const [devToolsDetected, setDevToolsDetected] = useState(false)
  const [blockedPermanently, setBlockedPermanently] = useState(false)
  const detectionCountRef = useRef(0)

  // Window size based DevTools detection (most reliable)
  const checkDevToolsOpen = useCallback(() => {
    if (typeof window === "undefined") return false
    
    const threshold = 160
    const widthThreshold = window.outerWidth - window.innerWidth > threshold
    const heightThreshold = window.outerHeight - window.innerHeight > threshold
    
    return widthThreshold || heightThreshold
  }, [])

  // Initial detection on mount - immediate check
  useEffect(() => {
    if (!securityEnabled) return

    // Check immediately on page load
    const initialCheck = () => {
      if (checkDevToolsOpen()) {
        setDevToolsDetected(true)
        setBlockedPermanently(true)
        handleSecurityViolation()
      }
    }

    // Run immediately
    initialCheck()

    // Also run after a short delay to catch late-loading devtools
    const timeoutId = setTimeout(initialCheck, 100)

    return () => clearTimeout(timeoutId)
  }, [securityEnabled, checkDevToolsOpen])

  // Continuous monitoring
  useEffect(() => {
    if (!securityEnabled || blockedPermanently) return

    const maxDetections = 3 // Block after 3 detections
    let warningShown = false

    const monitorDevTools = () => {
      if (checkDevToolsOpen()) {
        detectionCountRef.current++
        setDevToolsDetected(true)
        
        // Show warning only once per session
        if (!warningShown) {
          warningShown = true
          // Clear console and show warning
          try {
            console.clear()
            console.log("%c🚫 ACCESS DENIED", "color: red; font-size: 60px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);")
            console.log("%c⚠️ Security Violation Detected", "color: orange; font-size: 24px; font-weight: bold;")
            console.log("%cDevTools are not allowed on this site.", "color: red; font-size: 16px;")
            console.log("%cYour session has been terminated for security reasons.", "color: red; font-size: 16px;")
            console.log("%cPlease close DevTools and refresh the page.", "color: yellow; font-size: 14px;")
          } catch {
            // Ignore console errors
          }
        }
        
        // After multiple detections, permanently block
        if (detectionCountRef.current >= maxDetections) {
          setBlockedPermanently(true)
          handleSecurityViolation()
        }
      } else if (!blockedPermanently) {
        setDevToolsDetected(false)
        warningShown = false
      }
    }

    // Check every 500ms
    const intervalId = setInterval(monitorDevTools, 500)

    // Also check on window resize
    window.addEventListener("resize", monitorDevTools)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener("resize", monitorDevTools)
    }
  }, [securityEnabled, blockedPermanently, checkDevToolsOpen])

  // Keyboard shortcut blocking
  useEffect(() => {
    if (!securityEnabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 - Open DevTools
      if (e.key === "F12") {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+Shift+I / Cmd+Option+I - Open DevTools
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i")) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+Shift+J / Cmd+Option+J - Open Console
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+Shift+C / Cmd+Option+C - Inspect Element
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+U / Cmd+U - View Source
      if ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u")) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+S / Cmd+S - Save Page
      if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s")) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+Shift+P / Cmd+Shift+P - Command Palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+P / Cmd+P - Print
      if ((e.ctrlKey || e.metaKey) && (e.key === "P" || e.key === "p") && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+Shift+Del - Clear browsing data
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Delete") {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }

    // Text selection
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("input, textarea, [contenteditable]")
      ) {
        return true
      }
      e.preventDefault()
      return false
    }

    // Drag prevention
    const handleDrag = (e: Event) => {
      e.preventDefault()
      return false
    }

    document.addEventListener("contextmenu", handleContextMenu, true)
    document.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("selectstart", handleSelectStart, true)
    document.addEventListener("dragstart", handleDrag, true)
    document.addEventListener("drop", handleDrag, true)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true)
      document.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("selectstart", handleSelectStart, true)
      document.removeEventListener("dragstart", handleDrag, true)
      document.removeEventListener("drop", handleDrag, true)
    }
  }, [securityEnabled])

  // CSS-based protections
  useEffect(() => {
    if (!securityEnabled) return

    const style = document.createElement("style")
    style.id = "security-styles"
    style.textContent = `
      /* Prevent text selection on body (but allow in form fields) */
      body {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      
      /* Allow text selection in input fields, textarea, and contenteditable */
      input, textarea, [contenteditable="true"], pre, code {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      
      /* Prevent image dragging */
      img {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
        pointer-events: none;
      }
      
      /* Allow images in specific contexts */
      img[alt], img[src*="avatar"], img[src*="profile"] {
        pointer-events: auto;
      }

      /* Security block overlay */
      .security-block-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .security-block-overlay .icon {
        font-size: 80px;
        margin-bottom: 24px;
        animation: pulse 2s ease-in-out infinite;
      }

      .security-block-overlay h1 {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 16px;
        color: #ff4757;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .security-block-overlay p {
        font-size: 16px;
        color: #a0a0a0;
        text-align: center;
        max-width: 400px;
        line-height: 1.6;
        margin-bottom: 12px;
      }

      .security-block-overlay .action-text {
        font-size: 14px;
        color: #ffd93d;
        margin-top: 24px;
        padding: 12px 24px;
        border: 1px solid #ffd93d;
        border-radius: 8px;
        background: rgba(255, 217, 61, 0.1);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.05); }
      }
    `

    const existingStyle = document.getElementById("security-styles")
    if (existingStyle) {
      document.head.removeChild(existingStyle)
    }
    document.head.appendChild(style)

    return () => {
      const styleToRemove = document.getElementById("security-styles")
      if (styleToRemove) {
        document.head.removeChild(styleToRemove)
      }
    }
  }, [securityEnabled])

  // Show blocking overlay when devtools detected (only if security is enabled)
  if (securityEnabled && (devToolsDetected || blockedPermanently)) {
    return (
      <SecurityContext.Provider value={{ isProduction, devToolsDetected, securityEnabled }}>
        <div className="security-block-overlay">
          <div className="icon">🛡️</div>
          <h1>Access Denied</h1>
          <p>
            Developer tools have been detected. For security reasons, 
            access to this application has been temporarily restricted.
          </p>
          <p>
            Your session has been terminated to protect your account.
          </p>
          <div className="action-text">
            Please close Developer Tools and refresh the page to continue.
          </div>
        </div>
      </SecurityContext.Provider>
    )
  }

  return (
    <SecurityContext.Provider value={{ isProduction, devToolsDetected, securityEnabled }}>
      {children}
    </SecurityContext.Provider>
  )
}

export function useSecurity() {
  return useContext(SecurityContext)
}

