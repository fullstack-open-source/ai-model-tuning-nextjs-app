/**
 * Two-Factor Authentication Verification Page
 * Simple page to verify 2FA code after login
 */

"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useApiCall } from "@hooks/useApiCall"
import { OtpInput } from "@components/ui/otp-input"
import { Button } from "@components/ui/button"
import { authService } from "@services/auth.service"
import { ShieldCheck } from "lucide-react"

function Verify2FAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tokens, login } = useAuth()
  const [otp, setOtp] = useState("")
  const redirectPath = searchParams.get("next") || "/dashboard"

  // Verify 2FA Code
  const verify2FACall = useApiCall(
    async () => {
      const response = await authService.verify2FA({ 
        code: otp,
        session_token: tokens.session_token || undefined,
      })
      if (response?.success && response.data) {
        const { session_token, access_token, token_type, user } = response.data
        
        if (user) {
          login(user, {
            session_token,
            access_token,
            token_type: token_type || "bearer",
          })
        }

        return response
      }
      return response
    },
    {
      onSuccess: async () => {
        await new Promise(resolve => setTimeout(resolve, 300))
        router.push(redirectPath)
      },
      successMessage: "Verification successful!",
      showSuccessToast: true,
    }
  )

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) return
    await verify2FACall.execute()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Two-Factor Authentication</h1>
          <p className="text-sm text-gray-600">
            Enter the verification code sent to your email
          </p>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Verification Code</label>
              <OtpInput
                length={6}
                value={otp}
                onChange={(value) => setOtp(value)}
                onComplete={async (value) => {
                  setOtp(value)
                  if (value.length === 6 && !verify2FACall.loading) {
                    await verify2FACall.execute()
                  }
                }}
                disabled={verify2FACall.loading}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
              loading={verify2FACall.loading}
              disabled={!otp || otp.length !== 6 || verify2FACall.loading}
            >
              Verify
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <Verify2FAContent />
    </Suspense>
  )
}

