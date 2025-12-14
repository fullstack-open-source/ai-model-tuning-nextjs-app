/**
 * Signup Page
 * Beautiful UI/UX for user registration matching the design
 */

"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { OtpInput } from "@components/ui/otp-input"
import { CountrySelector } from "@components/ui/country-selector"
import { useAuthHook } from "@hooks/useAuth"
import { useAuthRedirect } from "@hooks/useAuthRedirect"
import { useApiCall } from "@hooks/useApiCall"
import { useModuleI18n } from "@context/I18nContext"
import { authService } from "@services/auth.service"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { SocialButton } from "@components/ui/social-button"
import { Loader2 } from "lucide-react"

type SignupMethod = "email" | "phone"

function SignupPageContent() {
  const router = useRouter()
  const { t } = useModuleI18n("auth")
  
  // Redirect authenticated users to dashboard or ?next= path
  const { isChecking: isAuthChecking } = useAuthRedirect()
  const { verifySignup: verifySignupWithContext, loginWithOtp } = useAuthHook()
  const [signupMethod, setSignupMethod] = useState<SignupMethod>("email")
  const [countryCode, setCountryCode] = useState("+977")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [userId, setUserId] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email")
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)
  const [isLoginMode, setIsLoginMode] = useState(false) // Track if we're logging in existing user

  // Login with OTP (for existing users)
  const loginWithOtpCall = useApiCall(
    () => loginWithOtp({ user_id: userId, channel, otp }),
    {
      onSuccess: async () => {
        // Wait a bit for auth context to update
        await new Promise(resolve => setTimeout(resolve, 200))
        // After successful login, redirect to dashboard
        router.push("/dashboard")
      },
      successMessage: "Logged in successfully!",
      showSuccessToast: true,
    }
  )

  // Check availability before signup
  const checkAvailabilityCall = useApiCall(
    () => authService.checkUserAvailability(userId),
    {
      onSuccess: (data) => {
        const available = data?.available ?? false
        if (!available) {
          // User already exists – automatically switch to login mode and send OTP
          setIsLoginMode(true)
          setAvailabilityMessage(null)
          // Automatically send OTP for login
          sendOtpCall.execute()
          return
        }
        // Clear any previous message if now available
        setAvailabilityMessage(null)
        setIsLoginMode(false)
      },
      showErrorToast: true,
    }
  )

  // Send OTP for signup (only after availability check passes)
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

  // Combined loading state for availability check + send OTP
  const isSendingOtp = checkAvailabilityCall.loading || sendOtpCall.loading
  const sendingOtpText = checkAvailabilityCall.loading
    ? t("checking")
    : t("sending")

  // Verify signup (uses AuthContext to store tokens and user)
  const verifySignupCall = useApiCall(
    () => verifySignupWithContext({ user_id: userId, channel, otp }),
    {
      onSuccess: async () => {
        // Wait a bit for auth context to update
        await new Promise(resolve => setTimeout(resolve, 200))
        // After successful signup & verification, send user to unified onboarding
        router.push("/onboarding")
      },
      successMessage: "Account created successfully!",
      showSuccessToast: true,
    }
  )

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    // First check availability
    setAvailabilityMessage(null)
    setIsLoginMode(false)
    const availabilityResult = await checkAvailabilityCall.execute()
    const available = (availabilityResult as { success: boolean; data?: { available: boolean } })?.data?.available ?? false

    if (!available) {
      // If already registered, onSuccess will automatically send OTP for login
      // and set isLoginMode to true
      return
    }

    // Only send OTP when user is available for signup
    await sendOtpCall.execute()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !otp) return
    
    if (isLoginMode) {
      // Login existing user with OTP
      await loginWithOtpCall.execute()
    } else {
      // Signup new user with OTP
      await verifySignupCall.execute()
    }
  }

  const handleEmailChange = (value: string) => {
    setUserId(value)
    setChannel("email")
    if (availabilityMessage) {
      setAvailabilityMessage(null)
    }
  }

  const handlePhoneNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, "")
    setPhoneNumber(digits)
    const fullPhoneNumber = `${countryCode}${digits}`
    setUserId(fullPhoneNumber)
    setChannel("sms")
    if (availabilityMessage) {
      setAvailabilityMessage(null)
    }
  }

  const handleCountryCodeChange = (dialCode: string) => {
    setCountryCode(dialCode)
    const fullPhoneNumber = `${dialCode}${phoneNumber}`
    setUserId(fullPhoneNumber)
    setChannel("sms")
    if (availabilityMessage) {
      setAvailabilityMessage(null)
    }
  }

  const switchToEmail = () => {
    setSignupMethod("email")
    setUserId("")
    setPhoneNumber("")
    setChannel("email")
    setAvailabilityMessage(null)
  }

  const switchToPhone = () => {
    setSignupMethod("phone")
    setUserId("")
    setPhoneNumber("")
    setChannel("sms")
    setAvailabilityMessage(null)
  }

  // Show loading while checking if user is already authenticated
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto" />
          <p className="mt-4 text-gray-500">{t("checking_session") || "Checking session..."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black mb-2">
            {isLoginMode ? t("log_in_to_account") : t("create_account")}
          </h1>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {!otpSent ? (
            <>
              {signupMethod === "email" ? (
                <>
                  {/* Email Input Form */}
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("email_address")}
                        value={userId}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className="h-12 rounded-lg border-gray-300 text-base"
                        required
                        disabled={isSendingOtp}
                      />
                    </div>
                    {availabilityMessage && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {availabilityMessage}{" "}
                        <button
                          type="button"
                          onClick={() => router.push("/login")}
                          className="font-medium text-red-800 underline underline-offset-2 ml-1"
                        >
                          {t("log_in")}
                        </button>
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                      loading={isSendingOtp}
                      loadingText={sendingOtpText}
                      disabled={!userId || isSendingOtp}
                    >
                      {t("continue")}
                    </Button>
                  </form>

                  {/* Already have account link */}
                  <div className="text-center text-sm">
                    <span className="text-gray-600">{t("already_have_account")} </span>
                    <Link href="/login" className="text-blue-600 hover:underline">
                      {t("log_in")}
                    </Link>
                  </div>

                  {/* OR Separator */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">{t("or")}</span>
                    </div>
                  </div>

                  {/* Social / Phone Signup Buttons */}
                  <div className="space-y-3">
                    <SocialButton
                      provider="google"
                      onClick={() => {
                        // TODO: Implement Google OAuth
                      }}
                    >
                      {t("continue_with_google")}
                    </SocialButton>
                    <SocialButton
                      provider="apple"
                      onClick={() => {
                        // TODO: Implement Apple OAuth
                      }}
                    >
                      {t("continue_with_apple")}
                    </SocialButton>
                    <SocialButton
                      provider="microsoft"
                      onClick={() => {
                        // TODO: Implement Microsoft OAuth
                      }}
                    >
                      {t("continue_with_microsoft")}
                    </SocialButton>
                    <SocialButton
                      provider="phone"
                      onClick={switchToPhone}
                    >
                      {t("continue_with_phone")}
                    </SocialButton>
                  </div>
                </>
              ) : (
                <>
                  {/* Phone Signup Form */}
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-3">
                      <CountrySelector
                        value={countryCode}
                        onChange={handleCountryCodeChange}
                      />
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder={t("phone_number")}
                        value={phoneNumber}
                        onChange={(e) => handlePhoneNumberChange(e.target.value)}
                        className="h-12 rounded-lg border-gray-300 text-base"
                        required
                        disabled={isSendingOtp}
                      />
                    </div>
                    {availabilityMessage && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {availabilityMessage}{" "}
                        <button
                          type="button"
                          onClick={() => router.push("/login")}
                          className="font-medium text-red-800 underline underline-offset-2 ml-1"
                        >
                          {t("log_in")}
                        </button>
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                      loading={isSendingOtp}
                      loadingText={sendingOtpText}
                      disabled={!phoneNumber || isSendingOtp}
                    >
                      {t("continue")}
                    </Button>
                  </form>

                  {/* Switch back to email */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-lg border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center gap-3"
                    onClick={switchToEmail}
                  >
                    {t("continue_with_email")}
                  </Button>

                  {/* Already have account link */}
                  <div className="text-center text-sm">
                    <span className="text-gray-600">{t("already_have_account")} </span>
                    <Link href="/login" className="text-blue-600 hover:underline">
                      {t("log_in")}
                    </Link>
                  </div>
                </>
              )}
            </>
          ) : (
            /* OTP Verification Form */
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-gray-600">
                  {isLoginMode 
                    ? t("we_sent_code_to_log_in")
                    : t("we_sent_verification_code")
                  }
                </p>
                <p className="text-sm font-medium mt-1 text-black">{userId}</p>
                {isLoginMode && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t("account_already_exists")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="space-y-2 pt-4">
                  <OtpInput
                    length={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    onComplete={async (value) => {
                      setOtp(value)
                      if (value.length === 6) {
                        if (isLoginMode && !loginWithOtpCall.loading) {
                          await loginWithOtpCall.execute()
                        } else if (!isLoginMode && !verifySignupCall.loading) {
                          await verifySignupCall.execute()
                        }
                      }
                    }}
                    disabled={isLoginMode ? loginWithOtpCall.loading : verifySignupCall.loading}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-lg"
                  onClick={() => {
                    setOtpSent(false)
                    setOtp("")
                    setIsLoginMode(false)
                    setAvailabilityMessage(null)
                  }}
                  disabled={isLoginMode ? loginWithOtpCall.loading : verifySignupCall.loading}
                >
                  {t("change")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-lg"
                  onClick={handleSendOtp}
                  loading={isSendingOtp}
                  loadingText={sendingOtpText}
                  disabled={isSendingOtp}
                >
                  {t("resend_code")}
                </Button>
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                loading={isLoginMode ? loginWithOtpCall.loading : verifySignupCall.loading}
                loadingText={isLoginMode ? t("logging_in") : t("verifying")}
                disabled={!otp || otp.length !== 6 || (isLoginMode ? loginWithOtpCall.loading : verifySignupCall.loading)}
              >
                {isLoginMode ? t("log_in") : t("continue")}
              </Button>
            </form>
          )}
        </div>

        {/* Footer Links */}
        <div className="flex justify-center items-center gap-4 text-sm text-gray-500 pt-4 border-t border-gray-200">
          <Link href="/terms" className="hover:text-gray-700">
            {t("terms_of_use")}
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/privacy" className="hover:text-gray-700">
            {t("privacy_policy")}
          </Link>
        </div>
      </div>
    </div>
  )
}

function SignupPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto" />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageLoading />}>
      <SignupPageContent />
    </Suspense>
  )
}

