/**
 * Verify Email and Phone Page
 * Verify email or phone number with OTP
 */

"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthHook } from "@hooks/useAuth"
import { useApiCall } from "@hooks/useApiCall"
import { authService } from "@services/auth.service"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Mail, Phone, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react"
import Link from "next/link"

function VerifyEmailPhonePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuthHook()
  const [userId, setUserId] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email")
  const [verificationType, setVerificationType] = useState<"email" | "phone">("email")

  useEffect(() => {
    const userIdParam = searchParams.get("user_id")
    const typeParam = searchParams.get("type") as "email" | "phone" | null
    if (userIdParam) setUserId(userIdParam)
    if (typeParam) {
      setVerificationType(typeParam)
      setChannel(typeParam === "email" ? "email" : "sms")
    }
  }, [searchParams])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  // Send OTP for verification
  const sendOtpCall = useApiCall(
    () => authService.sendOtp({ user_id: userId, channel }),
    {
      onSuccess: () => {
        setOtpSent(true)
      },
      successMessage: "Verification code sent!",
      showSuccessToast: true,
    }
  )

  // Verify email/phone
  const verifyCall = useApiCall(
    () => authService.verifyEmailAndPhone({ user_id: userId, channel, otp }),
    {
      onSuccess: () => {
        router.push("/profile-settings")
      },
      successMessage: `${verificationType === "email" ? "Email" : "Phone"} verified successfully!`,
      showSuccessToast: true,
    }
  )

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    await sendOtpCall.execute()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !otp) return
    await verifyCall.execute()
  }

  const detectChannel = (value: string): "email" | "sms" | "whatsapp" => {
    if (value.includes("@")) {
      setVerificationType("email")
      return "email"
    }
    setVerificationType("phone")
    return "sms"
  }

  const handleUserIdChange = (value: string) => {
    setUserId(value)
    setChannel(detectChannel(value))
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50 to-purple-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Verify {verificationType === "email" ? "Email" : "Phone"}
          </CardTitle>
          <CardDescription className="text-base">
            Verify your {verificationType === "email" ? "email address" : "phone number"} to secure your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="userId" className="text-sm font-medium">
                  {verificationType === "email" ? "Email Address" : "Phone Number"}
                </label>
                <div className="relative">
                  {channel === "email" ? (
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  )}
                  <Input
                    id="userId"
                    type={channel === "email" ? "email" : "tel"}
                    placeholder={channel === "email" ? "you@example.com" : "+1234567890"}
                    value={userId}
                    onChange={(e) => handleUserIdChange(e.target.value)}
                    className="pl-10"
                    required
                    disabled={sendOtpCall.loading}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send a verification code to verify your {channel === "email" ? "email" : "phone"}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                loading={sendOtpCall.loading}
                loadingText="Sending code..."
                disabled={!userId || sendOtpCall.loading}
              >
                Send Verification Code
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Verification code sent to
                </p>
                <p className="text-sm font-medium mt-1">{userId}</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium">
                  Enter Verification Code
                </label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  required
                  disabled={verifyCall.loading}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setOtpSent(false)
                    setOtp("")
                  }}
                  disabled={verifyCall.loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Change
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={handleSendOtp}
                  loading={sendOtpCall.loading}
                  loadingText="Resending..."
                  disabled={sendOtpCall.loading}
                >
                  Resend Code
                </Button>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                loading={verifyCall.loading}
                loadingText="Verifying..."
                disabled={!otp || otp.length !== 6 || verifyCall.loading}
              >
                Verify {verificationType === "email" ? "Email" : "Phone"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/profile-settings"
              className="text-sm text-primary font-medium hover:underline inline-flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to profile
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyEmailPhonePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailPhonePageContent />
    </Suspense>
  )
}

