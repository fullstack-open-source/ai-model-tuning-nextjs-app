/**
 * OTP Input Component
 * Renders N individual inputs that behave like a single OTP field.
 * - Only digits allowed
 * - Arrow / backspace navigation
 * - Paste full code to auto-fill
 * - Calls onComplete when all boxes are filled (for auto-submit flows)
 */

"use client"

import * as React from "react"
import { Input } from "./input"
import { cn } from "@lib/utils"

export interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  className,
}: OtpInputProps) {
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([])

  const safeValue = (value || "").replace(/\D/g, "").slice(0, length)

  const focusInput = (index: number) => {
    const input = inputsRef.current[index]
    if (input) {
      input.focus()
      input.select()
    }
  }

  const updateValueAtIndex = (index: number, digit: string) => {
    const digits = safeValue.split("")
    const normalized = digit.replace(/\D/g, "")
    
    if (!normalized) {
      // If deleting, clear current and move back
      digits[index] = ""
      const newValue = digits.join("").slice(0, length)
      onChange(newValue)
      if (index > 0) {
        focusInput(index - 1)
      }
    } else {
      // If entering a digit, set it and auto-advance to next
      digits[index] = normalized[0]
      const newValue = digits.join("").slice(0, length)
      onChange(newValue)
      
      // Auto-advance to next input if available
      const nextIndex = index + 1
      if (nextIndex < length) {
        // Use setTimeout to ensure the value is updated first
        setTimeout(() => {
          focusInput(nextIndex)
        }, 0)
      }
      
      // Check if all boxes are filled
      if (newValue.length === length && !newValue.includes("")) {
        onComplete?.(newValue)
      }
    }
  }

  const handleChange =
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value: targetValue } = event.target
      updateValueAtIndex(index, targetValue)
    }

  const handleKeyDown =
    (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      const { key } = event

      if (key === "Backspace") {
        event.preventDefault()
        const digits = safeValue.split("")
        if (digits[index]) {
          // If current box has value, clear it and auto-move back
          digits[index] = ""
          const newValue = digits.join("")
          onChange(newValue)
          // Auto-move back to previous box after clearing
          if (index > 0) {
            setTimeout(() => {
              focusInput(index - 1)
            }, 0)
          }
        } else if (index > 0) {
          // If current box is empty, move back and clear previous (auto-delete)
          const prevDigits = safeValue.split("")
          prevDigits[index - 1] = ""
          const newValue = prevDigits.join("")
          onChange(newValue)
          // Focus previous input after clearing
          setTimeout(() => {
            focusInput(index - 1)
          }, 0)
        }
        return
      }

      // Handle Delete key (same as Backspace but forward)
      if (key === "Delete") {
        event.preventDefault()
        const digits = safeValue.split("")
        if (digits[index]) {
          digits[index] = ""
          const newValue = digits.join("")
          onChange(newValue)
        }
        return
      }

      // Handle arrow keys for navigation
      if (key === "ArrowLeft" && index > 0) {
        event.preventDefault()
        focusInput(index - 1)
        return
      }

      if (key === "ArrowRight" && index < length - 1) {
        event.preventDefault()
        focusInput(index + 1)
        return
      }

      // Handle single digit input - auto-advance
      if (/^[0-9]$/.test(key)) {
        event.preventDefault()
        const digits = safeValue.split("")
        digits[index] = key
        const newValue = digits.join("").slice(0, length)
        onChange(newValue)
        
        // Auto-advance to next input
        const nextIndex = index + 1
        if (nextIndex < length) {
          setTimeout(() => {
            focusInput(nextIndex)
          }, 0)
        }
        
        // Check if complete
        if (newValue.length === length && !newValue.includes("")) {
          onComplete?.(newValue)
        }
        return
      }
    }

  const handlePaste =
    (index: number) => (event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      const pasted = event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, length)

      if (!pasted) return

      const digits = safeValue.split("")
      for (let i = 0; i < length; i++) {
        const char = pasted[i]
        if (typeof char === "undefined") break
        digits[index + i] = char
      }

      const newValue = digits.join("").slice(0, length)
      onChange(newValue)

      if (newValue.length === length && !newValue.includes("")) {
        onComplete?.(newValue)
      } else {
        const nextIndex = Math.min(index + pasted.length, length - 1)
        focusInput(nextIndex)
      }
    }

  React.useEffect(() => {
    if (autoFocus) {
      focusInput(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  return (
    <div className={cn("mx-auto flex justify-between gap-3 max-w-xs", className)}>
      {Array.from({ length }).map((_, index) => {
        const char = safeValue[index] ?? ""
        return (
          <Input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={char}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste(index)}
            disabled={disabled}
            className="h-14 w-12 rounded-lg border border-gray-300 bg-white text-center text-2xl font-mono tracking-widest"
          />
        )
      })}
    </div>
  )
}


