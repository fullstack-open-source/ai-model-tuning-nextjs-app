/**
 * Forgot Password Page
 * Beautiful UI/UX for password reset
 */

"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useApiCall } from "@hooks/useApiCall"
import { useAuthRedirect } from "@hooks/useAuthRedirect"
import { authService } from "@services/auth.service"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { OtpInput } from "@components/ui/otp-input"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Mail, Phone, ArrowRight, Lock, ArrowLeft, Loader2 } from "lucide-react"

function ForgotPasswordPageContent() {
  const router = useRouter()
  
  // Redirect authenticated users to change-password page instead
  const { isChecking: isAuthChecking } = useAuthRedirect({ defaultRedirect: "/profile-settings?tab=security" })
  
  const [userId, setUserId] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [step, setStep] = useState<"request" | "verify" | "reset">("request")
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email")
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)

  // Check if account exists before allowing reset
  const checkAvailabilityCall = useApiCall(
    () => authService.checkUserAvailability(userId),
    {
      showErrorToast: true,
    }
  )

  // Send OTP for password reset (only if account exists)
  const sendOtpCall = useApiCall(
    () => authService.sendOtp({ user_id: userId, channel }),
    {
      onSuccess: () => {
        setStep("verify")
      },
      successMessage: "Reset code sent!",
      showSuccessToast: true,
    }
  )

  const isSendingOtp = checkAvailabilityCall.loading || sendOtpCall.loading
  const sendingOtpText = checkAvailabilityCall.loading ? "Checking..." : "Sending code..."

  // Verify OTP and reset password
  const resetPasswordCall = useApiCall(
    async () => {
      // 1) Verify OTP (generic endpoint)
      await authService.verifyOtp({ user_id: userId, channel, otp })

      // 2) Reset password using forget-password endpoint
      return authService.resetPassword(userId, otp, newPassword, confirmPassword)
    },
    {
      onSuccess: () => {
        router.push("/login")
      },
      successMessage: "Password reset successful!",
      showSuccessToast: true,
    }
  )

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setAvailabilityMessage(null)

    const availabilityResult = await checkAvailabilityCall.execute()
    const available =
      (availabilityResult as { success: boolean; data?: { available: boolean } })?.data?.available ??
      false

    // For password reset, account must already exist (available=false)
    if (available) {
      setAvailabilityMessage(
        "We couldn't find an account with this email or phone. Please sign up instead."
      )
      return
    }

    await sendOtpCall.execute()
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || !newPassword || newPassword !== confirmPassword) return
    await resetPasswordCall.execute()
  }

  const detectChannel = (value: string): "email" | "sms" | "whatsapp" => {
    if (value.includes("@")) return "email"
    if (value.startsWith("+")) return "sms"
    return "sms"
  }

  const handleUserIdChange = (value: string) => {
    setUserId(value)
    setChannel(detectChannel(value))
    if (availabilityMessage) {
      setAvailabilityMessage(null)
    }
  }

  // Show loading while checking if user is already authenticated
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto" />
          <p className="mt-4 text-gray-500">Checking session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-black">Reset Password</h1>
          <p className="text-sm text-gray-600">
            {step === "request" && "Enter your email or phone to receive a reset code"}
            {step === "verify" && "Enter the code and your new password"}
          </p>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          {step === "request" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="userId" className="text-sm text-gray-600">
                  Email or Phone Number
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
                    disabled={isSendingOtp}
                  />
                </div>
              </div>
              {availabilityMessage && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {availabilityMessage}{" "}
                  <Link
                    href="/signup"
                    className="ml-1 font-medium text-red-800 underline underline-offset-2"
                  >
                    Sign up
                  </Link>
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                loading={isSendingOtp}
                loadingText={sendingOtpText}
                disabled={!userId || isSendingOtp}
              >
                Send Reset Code
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-gray-600">
                  Reset code sent to
                </p>
                <p className="text-sm font-medium mt-1 text-black">{userId}</p>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label htmlFor="user-display" className="text-sm text-gray-600">
                    {channel === "email" ? "Email address" : "Phone number"}
                  </label>
                  <div className="relative">
                    <Input
                      id="user-display"
                      type="text"
                      value={userId}
                      disabled
                      className="h-12 w-full rounded-lg border-gray-300 bg-gray-50 pr-24"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setStep("request")
                        setOtp("")
                        setNewPassword("")
                        setConfirmPassword("")
                      }}
                      className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-medium text-blue-600 hover:bg-gray-100 focus:outline-none"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="space-y-2 pt-4">
                  <label htmlFor="otp" className="text-sm font-medium">
                    Enter Reset Code
                  </label>
                  <OtpInput
                    length={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    onComplete={(value) => {
                      setOtp(value)
                    }}
                    disabled={resetPasswordCall.loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm text-gray-600">
                  New Password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={resetPasswordCall.loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm text-gray-600">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={resetPasswordCall.loading}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-lg border-gray-300"
                  onClick={() => setStep("request")}
                  disabled={resetPasswordCall.loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-12 rounded-lg"
                  onClick={handleRequestOtp}
                  loading={isSendingOtp}
                  loadingText={sendingOtpText}
                  disabled={isSendingOtp}
                >
                  Resend Code
                </Button>
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                loading={resetPasswordCall.loading}
                loadingText="Resetting password..."
                disabled={
                  !otp ||
                  otp.length !== 6 ||
                  !newPassword ||
                  newPassword !== confirmPassword ||
                  resetPasswordCall.loading
                }
              >
                Reset Password
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          <div className="mt-2 text-center">
            <Link
              href="/login"
              className="text-sm text-blue-600 font-medium hover:underline inline-flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to login
            </Link>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex justify-center items-center gap-4 text-sm text-gray-500 pt-4 border-t border-gray-200">
          <Link href="/terms" className="hover:text-gray-700">
            Terms of Use
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/privacy" className="hover:text-gray-700">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}

function ForgotPasswordLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto" />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordLoading />}>
      <ForgotPasswordPageContent />
    </Suspense>
  )
}

