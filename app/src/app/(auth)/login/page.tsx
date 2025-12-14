/**
 * Login Page
 * Beautiful UI/UX with multi-step login flow matching the design
 */

"use client"

import { useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { OtpInput } from "@components/ui/otp-input"
import { useAuthHook } from "@hooks/useAuth"
import { useAuthRedirect } from "@hooks/useAuthRedirect"
import { useApiCall } from "@hooks/useApiCall"
import { useModuleI18n } from "@context/I18nContext"
import { authService } from "@services/auth.service"
import { permissionService } from "@services/permission.service"
import { profileService } from "@services/profile.service"
// import { getRedirectPath } from "@utils/auth-redirect"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { SocialButton } from "@components/ui/social-button"
import { CountrySelector } from "@components/ui/country-selector"
import { Eye, EyeOff, Mail, Loader2 } from "lucide-react"
import { getNextPath, getRedirectPathAfterLogin } from "@utils/auth-redirect"

type LoginStep = "phone" | "email" | "password" | "otp"
type LoginMethod = "phone" | "email"

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useModuleI18n("auth")
  
  // Redirect authenticated users to dashboard or ?next= path
  const { isChecking: isAuthChecking } = useAuthRedirect()
  const {
    loginWithPassword: loginWithPasswordWithContext,
    loginWithOtp: loginWithOtpWithContext,
    verifySignup: verifySignupWithContext,
  } = useAuthHook()
  
  // Get redirect path from ?next= parameter
  const nextPath = getNextPath(searchParams)
  const redirectPath = getRedirectPathAfterLogin(nextPath)
  const [step, setStep] = useState<LoginStep>("email")
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email")
  const [countryCode, setCountryCode] = useState("+977")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState("")
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email")
  const [otpMode, setOtpMode] = useState<"login" | "signup">("login")
  const [userStatus, setUserStatus] = useState<{ exists: boolean; has_password: boolean } | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  // Check user status (exists and has password)
  const checkUserStatusCall = useApiCall(
    async () => {
      setStatusMessage(t("checking_account") || "Checking account...")
      return await authService.checkUserStatus(userId)
    },
    {
      onSuccess: (status: any) => {
        console.log("User status received:", status)
        
        if (status) {
          setUserStatus(status)
          
          if (!status.exists) {
            // User doesn't exist - send OTP for signup
            console.log("User doesn't exist, sending OTP for signup")
            setStatusMessage(t("account_not_found_sending_otp") || "Account not found. Sending OTP for signup...")
            setOtpMode("signup")
            sendOtpCall.execute()
          } else {
            // User exists - always show password form
            console.log("User exists, showing password form. Status:", status)
            setStatusMessage("")
            setCheckingStatus(false)
            setStep("password")
          }
        }
      },
      onError: (error: any) => {
        console.error("Error checking user status:", error)
        setStatusMessage("")
        setCheckingStatus(false)
      },
      showErrorToast: true,
    }
  )

  // Check availability to decide login vs signup flow for OTP (legacy - kept for backward compatibility)
  const checkAvailabilityCall = useApiCall(
    () => authService.checkUserAvailability(userId),
    {
      showErrorToast: true,
    }
  )

  // Password login
  const passwordLogin = useApiCall(
    async () => {
      setStatusMessage(t("verifying_password") || "Verifying password...")
      // Use Auth hook to login and populate AuthContext
      const response = await loginWithPasswordWithContext({ user_id: userId, password });
      
      // After successful login, fetch user groups using tokens from response
      if (response?.success && response.data) {
        setStatusMessage(t("loading_profile") || "Loading your profile...")
        const { session_token, access_token, token_type } = response.data;
        
        // Create authenticated API service with tokens from login response
        const authHeaders: Record<string, string> = {};
        if (session_token) {
          authHeaders["X-Session-Token"] = session_token;
        } else if (access_token && token_type) {
          authHeaders["Authorization"] = `${token_type} ${access_token}`;
        }
        
        const authenticatedApi = createPublicApiService(authHeaders);
        permissionService.setAuthApi(authenticatedApi);
        profileService.setAuthApi(authenticatedApi);
        
        // Fetch user groups and profile to determine redirect path
        try {
          const [groupsResponse, profileResponse] = await Promise.all([
            permissionService.getMyGroups(),
            profileService.getProfile().catch(() => null), // Don't fail if profile fetch fails
          ]);
          setStatusMessage(t("redirecting") || "Redirecting...")
          return { 
            ...response, 
            groups: groupsResponse?.data || [],
            user: profileResponse?.data || response.data?.user || null
          };
        } catch (error) {
          console.error("Error fetching user data:", error);
          return { ...response, groups: [], user: response.data?.user || null };
        }
      }
      
      return response;
    },
    {
      onError: (error: any) => {
        setStatusMessage("")
        // Check error code to provide specific feedback
        const errorCode = error?.response?.data?.error?.code || error?.error?.code || error?.code
        const errorMessage = error?.response?.data?.error?.message || error?.error?.message || error?.message || ""
        
        // If password login fails and user doesn't have password, suggest OTP
        if (userStatus && !userStatus.has_password) {
          // User doesn't have password set, switch to OTP mode
          setOtpMode("login")
          setStep("otp")
          sendOtpCall.execute()
        } else if (errorCode === 1201 || errorMessage?.toLowerCase().includes('invalid') || errorMessage?.toLowerCase().includes('incorrect')) {
          // Invalid credentials - show helpful message
          // Error toast will be shown by useApiCall, but we can add additional context
        }
      },
      onSuccess: async () => {
        // Wait for auth context to update with permissions
        // Check if permissions are loaded by polling (max 3 seconds)
        let attempts = 0
        const maxAttempts = 30 // 30 * 100ms = 3 seconds max wait
        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          // Check if permissions are in localStorage (indicates AuthContext has updated)
          const cachedPermissions = typeof window !== 'undefined' 
            ? localStorage.getItem('auth_permissions') 
            : null
          if (cachedPermissions) {
            try {
              const perms = JSON.parse(cachedPermissions)
              if (Array.isArray(perms) && perms.length > 0) {
                break // Permissions loaded
              }
            } catch (e) {
              // Continue waiting
            }
          }
          attempts++
        }
        router.push(redirectPath)
      },
      successMessage: "Login successful!",
      showSuccessToast: true,
    }
  )

  // Send OTP
  const sendOtpCall = useApiCall(
    async () => {
      setStatusMessage(t("sending_otp") || "Sending verification code...")
      return await authService.sendOtp({ user_id: userId, channel })
    },
    {
      onSuccess: () => {
        setStatusMessage("")
        setCheckingStatus(false)
        setStep("otp")
      },
      onError: () => {
        setStatusMessage("")
        setCheckingStatus(false)
      },
      successMessage: "OTP sent successfully!",
      showSuccessToast: true,
    }
  )

  // Combined loading state for availability check + send OTP
  const isSendingOtp = checkAvailabilityCall.loading || sendOtpCall.loading
  const sendingOtpText = checkAvailabilityCall.loading ? t("checking") : t("sending")

  // OTP login
  const otpLogin = useApiCall(
    async () => {
      setStatusMessage(t("verifying_code") || "Verifying code...")
      // Use Auth hook to login and populate AuthContext
      const response = await loginWithOtpWithContext({ user_id: userId, channel, otp });
      
      // After successful login, fetch user groups and profile using tokens from response
      if (response?.success && response.data) {
        setStatusMessage(t("loading_profile") || "Loading your profile...")
        const { session_token, access_token, token_type } = response.data;
        
        // Create authenticated API service with tokens from login response
        const authHeaders: Record<string, string> = {};
        if (session_token) {
          authHeaders["X-Session-Token"] = session_token;
        } else if (access_token && token_type) {
          authHeaders["Authorization"] = `${token_type} ${access_token}`;
        }
        
        const authenticatedApi = createPublicApiService(authHeaders);
        permissionService.setAuthApi(authenticatedApi);
        profileService.setAuthApi(authenticatedApi);
        
        // Fetch user groups and profile to determine redirect path
        try {
          const [groupsResponse, profileResponse] = await Promise.all([
            permissionService.getMyGroups(),
            profileService.getProfile().catch(() => null), // Don't fail if profile fetch fails
          ]);
          setStatusMessage(t("redirecting") || "Redirecting...")
          return { 
            ...response, 
            groups: groupsResponse?.data || [],
            user: profileResponse?.data || response.data?.user || null
          };
        } catch (error) {
          console.error("Error fetching user data:", error);
          return { ...response, groups: [], user: response.data?.user || null };
        }
      }
      
      return response;
    },
    {
      onSuccess: async () => {
        // Wait for auth context to update with permissions
        // Check if permissions are loaded by polling (max 3 seconds)
        let attempts = 0
        const maxAttempts = 30 // 30 * 100ms = 3 seconds max wait
        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          // Check if permissions are in localStorage (indicates AuthContext has updated)
          const cachedPermissions = typeof window !== 'undefined' 
            ? localStorage.getItem('auth_permissions') 
            : null
          if (cachedPermissions) {
            try {
              const perms = JSON.parse(cachedPermissions)
              if (Array.isArray(perms) && perms.length > 0) {
                break // Permissions loaded
              }
            } catch (e) {
              // Continue waiting
            }
          }
          attempts++
        }
        
        // If user doesn't have password set, redirect to onboarding
        // Otherwise redirect to dashboard
        if (userStatus && !userStatus.has_password) {
          router.push("/onboarding")
        } else {
          router.push(redirectPath)
        }
      },
      onError: () => {
        setStatusMessage("")
      },
      successMessage: "Login successful!",
      showSuccessToast: true,
    }
  )

  // Helper: send OTP and decide whether this is login or signup based on availability
  const sendOtpWithAvailability = async () => {
    if (!userId) return

    const availabilityResult = await checkAvailabilityCall.execute()
    const available =
      (availabilityResult as { success: boolean; data?: { available: boolean } })?.data?.available ??
      false

    // For this API, available === true => account does NOT exist (signup flow)
    // available === false => account exists (login flow)
    setOtpMode(available ? "signup" : "login")

    await sendOtpCall.execute()
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber) return
    const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, "")}`
    setUserId(fullPhoneNumber)
    setChannel("sms")
    setCheckingStatus(true)
    setUserStatus(null)
    setStatusMessage(t("checking_account") || "Checking account...")
    // Check user status first - onSuccess will handle step change and setCheckingStatus(false)
    await checkUserStatusCall.execute()
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setCheckingStatus(true)
    setUserStatus(null)
    setStatusMessage(t("checking_account") || "Checking account...")
    // Check user status first - onSuccess will handle step change and setCheckingStatus(false)
    await checkUserStatusCall.execute()
  }

  const handleSwitchToEmail = () => {
    setLoginMethod("email")
    setStep("email")
    setUserId("")
    setPhoneNumber("")
  }

  const handleSwitchToPhone = () => {
    setLoginMethod("phone")
    setStep("phone")
    setUserId("")
    setPhoneNumber("")
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !password) return
    await passwordLogin.execute()
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendOtpWithAvailability()
  }

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !otp) return
    if (otpMode === "login") {
      await otpLogin.execute()
    } else {
      await signupOtpVerifyCall.execute()
    }
  }

  const handleUseOtp = async () => {
    // If we already checked user status, use that info
    if (userStatus) {
      if (!userStatus.exists) {
        setOtpMode("signup")
      } else {
        setOtpMode("login")
      }
      await sendOtpCall.execute()
    } else {
      // Otherwise check status first
      await sendOtpWithAvailability()
    }
  }

  // Debug: Log step changes
  useEffect(() => {
    console.log("Current step:", step, "User status:", userStatus, "Checking:", checkingStatus)
  }, [step, userStatus, checkingStatus])

  // Signup OTP verification (when account doesn't exist yet)
  const signupOtpVerifyCall = useApiCall(
    async () => {
      setStatusMessage(t("verifying_and_creating") || "Verifying and creating account...")
      return await verifySignupWithContext({ user_id: userId, channel, otp })
    },
    {
      onSuccess: async () => {
        setStatusMessage(t("redirecting") || "Redirecting...")
        // Wait a bit for auth context to update, then take user to unified onboarding
        await new Promise((resolve) => setTimeout(resolve, 200))
        router.push("/onboarding")
      },
      onError: () => {
        setStatusMessage("")
      },
      successMessage: "Account created successfully!",
      showSuccessToast: true,
    }
  )


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
        {/* Step 1: Email Input (Default) */}
        {step === "email" && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black mb-2">{t("welcome_back")}</h1>
            </div>

            <div className="space-y-6">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <Input
                    id="userId"
                    type="email"
                    placeholder={t("email_address")}
                    value={userId}
                    onChange={(e) => {
                      setUserId(e.target.value)
                      setChannel("email")
                    }}
                    className="h-12 rounded-lg border-gray-300 text-base"
                    required
                    disabled={checkingStatus || checkUserStatusCall.loading}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                  disabled={!userId || checkingStatus || checkUserStatusCall.loading}
                  loading={checkingStatus || checkUserStatusCall.loading}
                  loadingText={statusMessage || t("checking") || "Checking..."}
                >
                  {t("continue")}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-gray-600">{t("dont_have_account")} </span>
                <Link href="/signup" className="text-blue-600 hover:underline">
                  {t("sign_up")}
                </Link>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">{t("or")}</span>
                </div>
              </div>

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
                  onClick={handleSwitchToPhone}
                >
                  {t("continue_with_phone")}
                </SocialButton>
              </div>
            </div>
          </>
        )}

        {/* Step 1b: Phone Number Input (Alternative) */}
        {step === "phone" && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black mb-2">{t("welcome_back")}</h1>
            </div>

            <div className="space-y-6">
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div className="space-y-3">
                  <CountrySelector
                    value={countryCode}
                    onChange={setCountryCode}
                  />
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder={t("phone_number")}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    className="h-12 rounded-lg border-gray-300 text-base"
                    required
                    disabled={checkingStatus || checkUserStatusCall.loading}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                  disabled={!phoneNumber || checkingStatus || checkUserStatusCall.loading}
                  loading={checkingStatus || checkUserStatusCall.loading}
                  loadingText={statusMessage || t("checking") || "Checking..."}
                >
                  {t("continue")}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-gray-600">{t("dont_have_account")} </span>
                <Link href="/signup" className="text-blue-600 hover:underline">
                  {t("sign_up")}
                </Link>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">{t("or")}</span>
                </div>
              </div>

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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-lg border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center gap-3"
                  onClick={handleSwitchToEmail}
                >
                  <Mail className="w-5 h-5" />
                  {t("continue_with_email")}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Password Input */}
        {step === "password" && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black mb-2">{t("enter_your_password")}</h1>
            </div>

            <div className="space-y-6">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="user-display" className="text-sm text-gray-600">
                    {loginMethod === "phone" ? t("phone_number") : t("email_address")}
                  </label>
                  <div className="relative">
                    <Input
                      id="user-display"
                      type="text"
                      value={userId}
                      disabled
                      className="h-12 w-full rounded-lg border-gray-300 bg-gray-50 pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setStep(loginMethod === "phone" ? "phone" : "email")}
                      className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-medium text-blue-600 hover:bg-gray-100 focus:outline-none"
                    >
                      {t("edit")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm text-gray-600">
                    {t("password")}
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-lg border-gray-300 text-base pr-10"
                      required
                      disabled={passwordLogin.loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t("forgot_password")}
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                  loading={passwordLogin.loading}
                  loadingText={statusMessage || t("signing_in") || "Signing in..."}
                  disabled={!password || passwordLogin.loading}
                >
                  {t("continue")}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">{t("or")}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-lg border-gray-300"
                onClick={handleUseOtp}
                loading={sendOtpCall.loading}
                loadingText={t("sending")}
              >
                {userStatus && !userStatus.has_password 
                  ? t("use_otp_instead") || "Use OTP Instead" 
                  : t("log_in_with_otp")}
              </Button>
              
              {userStatus && !userStatus.has_password && (
                <p className="text-sm text-center text-gray-500">
                  {t("no_password_set_use_otp") || "Password not set. Please use OTP to login."}
                </p>
              )}

              <div className="text-center text-sm">
                <span className="text-gray-600">{t("dont_have_account")} </span>
                <Link href="/signup" className="text-blue-600 hover:underline">
                  {t("sign_up")}
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Step 3: OTP Verification */}
        {step === "otp" && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black mb-2">{t("enter_verification_code")}</h1>
            </div>

            <div className="space-y-6">
              <form onSubmit={handleOtpLogin} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    {t("we_sent_verification_code")}
                  </p>
                  <p className="text-sm font-medium mt-1 text-black">{userId}</p>
                </div>

                <div className="space-y-2">
                  <OtpInput
                    length={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    onComplete={async (value) => {
                      setOtp(value)
                      if (value.length === 6 && !otpLogin.loading) {
                        await otpLogin.execute()
                      }
                    }}
                    disabled={otpLogin.loading}
                    autoFocus
                  />
                </div>

                {/* Show error message if OTP verification fails */}
                {(otpLogin.error || signupOtpVerifyCall.error) && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-medium">
                      {otpLogin.error?.message || signupOtpVerifyCall.error?.message || t("invalid_otp") || "Invalid verification code"}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {t("otp_incorrect") || "The code you entered is incorrect or expired. Please request a new one."}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 rounded-lg"
                    onClick={() => {
                      // Go back to the appropriate identifier step so user can edit
                      setStep(loginMethod === "phone" ? "phone" : "email")
                      setOtp("")
                    }}
                    disabled={otpLogin.loading || signupOtpVerifyCall.loading}
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
                    disabled={isSendingOtp || otpLogin.loading || signupOtpVerifyCall.loading}
                  >
                    {t("resend_otp")}
                  </Button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                  loading={otpLogin.loading || signupOtpVerifyCall.loading}
                  loadingText={statusMessage || t("verifying") || "Verifying..."}
                  disabled={!otp || otp.length !== 6 || otpLogin.loading || signupOtpVerifyCall.loading}
                >
                  {t("continue")}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-gray-600">{t("dont_have_account")} </span>
                <Link href="/signup" className="text-blue-600 hover:underline">
                  {t("sign_up")}
                </Link>
              </div>
            </div>
          </>
        )}

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

function LoginPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginPageContent />
    </Suspense>
  )
}

