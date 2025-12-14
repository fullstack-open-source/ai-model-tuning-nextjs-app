/**
 * Unified Onboarding Page
 * Simple and plain onboarding flow: Verify -> Set Password -> Complete Profile
 */

"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useAuthHook } from "@hooks/useAuth"
import { useApiCall } from "@hooks/useApiCall"
import { PageGuard } from "@components/auth/PageGuard"
import { OtpInput } from "@components/ui/otp-input"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { authService } from "@services/auth.service"
import { profileService } from "@services/profile.service"
import { permissionService } from "@services/permission.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { getRedirectPath } from "@utils/auth-redirect"
import { isProfileComplete } from "@utils/onboarding"
import { Eye, EyeOff, ArrowRight, ArrowLeft, Check } from "lucide-react"
import type { User as UserType } from "@models/user.model"

type Step = 1 | 2 | 3

function OnboardingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser, apiService, tokens, login } = useAuth()
  const { setPassword: setPasswordWithAuth } = useAuthHook()
  
  // Check for access_token or session_token
  const hasValidToken = !!(tokens.access_token || tokens.session_token)
  const isAuthenticated = !!authUser && hasValidToken

  // Redirect if no valid token
  useEffect(() => {
    if (!authUser && !tokens.access_token && !tokens.session_token) {
      const timer = setTimeout(() => {
        router.push("/login")
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [authUser, tokens.access_token, tokens.session_token, router])

  // Step 1: Verify
  const [userId, setUserId] = useState("")
  const [otp, setOtp] = useState("")
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email")

  // Step 2: Set Password (optional - can be skipped if user already has password)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [skipPassword, setSkipPassword] = useState(false)

  // Step 3: Complete Profile
  const [profileStep, setProfileStep] = useState<1 | 2 | 3>(1)
  const [profile, setProfile] = useState<UserType | null>(null)
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    user_name: "",
    bio: "",
    country: "",
    gender: "",
    dob: "",
    phone_number: "",
  })

  const [currentStep, setCurrentStep] = useState<Step>(1)

  // Initialize from URL params
  useEffect(() => {
    const userIdParam = searchParams.get("user_id")
    const channelParam = searchParams.get("channel") as "email" | "sms" | "whatsapp" | null
    if (userIdParam) setUserId(userIdParam)
    if (channelParam) setChannel(channelParam)
  }, [searchParams])

  // Set authenticated API service
  useEffect(() => {
    if (apiService) {
      profileService.setAuthApi(apiService)
      permissionService.setAuthApi(apiService)
    }
  }, [apiService])

  // Skip verification if already authenticated
  useEffect(() => {
    if (isAuthenticated && currentStep === 1 && !userId) {
      setCurrentStep(2)
    }
  }, [isAuthenticated, currentStep, userId])

  // Verify OTP
  const verifyOtpCall = useApiCall(
    async () => {
      const response = await authService.verifyOtp({ user_id: userId, channel, otp })
      if (response?.success && response.data) {
        const { session_token, access_token, token_type, user } = response.data
        
        const authHeaders: Record<string, string> = {}
        if (session_token) {
          authHeaders["X-Session-Token"] = session_token
        } else if (access_token && token_type) {
          authHeaders["Authorization"] = `${token_type} ${access_token}`
        }
        
        const authenticatedApi = createPublicApiService(authHeaders)
        profileService.setAuthApi(authenticatedApi)
        permissionService.setAuthApi(authenticatedApi)

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
        setCurrentStep(2)
      },
      successMessage: "Verification successful!",
      showSuccessToast: true,
    }
  )

  // Note: Password is no longer set separately - it's included in completeOnboarding API call
  // This is kept for backward compatibility but not used

  // Fetch Profile
  const fetchProfile = useApiCall(
    async () => {
      const cachedProfile = profileService.getProfileFromCache()
      if (cachedProfile) {
        return {
          success: true,
          message: 'Profile loaded from cache',
          data: cachedProfile,
        }
      }
      return await profileService.getProfile(false)
    },
    {
      onSuccess: async (data) => {
        if (data) {
          const userData = data as UserType
          setProfile(userData)
          
          if (!isProfileComplete(userData)) {
            const phoneNumber = userData.phone_number 
              ? (typeof userData.phone_number === 'string' 
                  ? userData.phone_number 
                  : (userData.phone_number as any)?.phone || "")
              : ""
            setFormData({
              first_name: userData.first_name || "",
              last_name: userData.last_name || "",
              user_name: userData.user_name || "",
              bio: userData.bio || "",
              country: userData.country || "",
              gender: userData.gender || "",
              dob: userData.dob ? (typeof userData.dob === 'string' ? userData.dob.split('T')[0] : new Date(userData.dob).toISOString().split('T')[0]) : "",
              phone_number: phoneNumber,
            })
          }
        }
      },
    }
  )

  // Complete Onboarding - Single API call for password + profile update
  // Called when ALL data is complete (password from step 2 + profile from step 3)
  const completeOnboarding = useApiCall(
    async () => {
      // Validate all required fields before submitting
      if (!isProfileFormValid()) {
        throw new Error("Please complete all required fields with valid data")
      }

      // Prepare data for complete onboarding API
      // Include password if it was set in step 2 (not skipped)
      const onboardingData: {
        password?: string;
        confirm_password?: string;
        first_name: string;
        last_name: string;
        user_name?: string;
        bio?: string;
        country?: string;
        gender?: string;
        dob?: string;
        phone_number?: string;
      } = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        user_name: formData.user_name?.trim() || undefined,
        bio: formData.bio?.trim() || undefined,
        country: formData.country?.trim() || undefined,
        gender: formData.gender || undefined,
        dob: formData.dob || undefined,
        phone_number: formData.phone_number?.trim() || undefined,
      }

      // Include password if it was provided in step 2 (user didn't skip)
      // Password is only included if both password and confirmPassword are set
      if (password && confirmPassword && password.length >= 6 && password === confirmPassword) {
        onboardingData.password = password
        onboardingData.confirm_password = confirmPassword
      }

      // Call single API that does everything: set password + update profile + mark as completed
      const response = await profileService.completeOnboarding(onboardingData)
      
      // Update user in AuthContext with updated profile data
      if (response?.success && response.data && authUser) {
        login({
          ...authUser,
          first_name: response.data.first_name || authUser.first_name,
          last_name: response.data.last_name || authUser.last_name,
          user_name: response.data.user_name || authUser.user_name,
          profile_picture_url: response.data.profile_picture_url || authUser.profile_picture_url,
        } as any, tokens)
      }
      
      return response
    },
    {
      onSuccess: async (completedProfile) => {
        // completedProfile is the User data directly from useApiCall
        if (completedProfile) {
          // Update profile state with latest data
          setProfile(completedProfile as UserType)
          
          // Update user in AuthContext with is_profile_completed set to true
          if (authUser) {
            login({
              ...authUser,
              first_name: completedProfile.first_name || authUser.first_name,
              last_name: completedProfile.last_name || authUser.last_name,
              user_name: completedProfile.user_name || authUser.user_name,
              profile_picture_url: completedProfile.profile_picture_url || authUser.profile_picture_url,
              is_profile_completed: true, // Explicitly set to true after completion
            } as any, tokens)
          }
        }
        
        // Force refresh profile cache to ensure latest data
        await profileService.getProfile(true)
        
        // Wait a moment for AuthContext to update with is_profile_completed before redirecting
        await new Promise(resolve => setTimeout(resolve, 500))
        
        try {
          if (apiService) {
            permissionService.setAuthApi(apiService)
            const groupsResponse = await permissionService.getMyGroups()
            const groups = groupsResponse?.data || []
            const redirectPath = getRedirectPath(groups, completedProfile || profile)
            router.push(redirectPath)
          } else {
            router.push("/dashboard")
          }
        } catch (error) {
          console.error("Error fetching groups:", error)
          router.push("/dashboard")
        }
      },
      successMessage: "Onboarding completed successfully!",
      showSuccessToast: true,
    }
  )

  // Load profile when on step 3
  useEffect(() => {
    if (isAuthenticated && apiService && currentStep === 3) {
      fetchProfile.execute()
    }
  }, [isAuthenticated, apiService, currentStep])

  // Check if profile is already complete - only redirect if we're not in the middle of onboarding
  useEffect(() => {
    // Only check if we're not actively filling out the form (currentStep === 3 means we're completing profile)
    if (profile && isProfileComplete(profile) && isAuthenticated && currentStep !== 3) {
      const timer = setTimeout(async () => {
        try {
          if (apiService) {
            permissionService.setAuthApi(apiService)
            const groupsResponse = await permissionService.getMyGroups()
            const groups = groupsResponse?.data || []
            const redirectPath = getRedirectPath(groups, profile)
            router.push(redirectPath)
          } else {
            router.push("/dashboard")
          }
        } catch (error) {
          console.error("Error fetching groups:", error)
          router.push("/dashboard")
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [profile, isAuthenticated, apiService, router, currentStep])

  // Resend OTP
  const resendOtpCall = useApiCall(
    () => authService.sendOtp({ user_id: userId, channel }),
    {
      successMessage: "Code resent successfully!",
      showSuccessToast: true,
    }
  )

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !otp) return
    await verifyOtpCall.execute()
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password !== confirmPassword) return
      setCurrentStep(3)
  }

  const handleNextProfile = () => {
    if (profileStep < 3) {
      // Validate current step before proceeding
      if (profileStep === 1) {
        // Step 1: Validate first_name and last_name
        if (!formData.first_name.trim() || !formData.last_name.trim()) {
          return // Don't proceed if required fields are empty
        }
      }
      setProfileStep((prev) => (prev + 1) as 1 | 2 | 3)
    } else {
      // Step 3: Final step - validate all fields before submitting
      if (!isProfileFormValid()) {
        // Show error or prevent submission
        return
      }
      // All data is complete - call single API to set password + update profile + mark as completed
      completeOnboarding.execute()
    }
  }

  const handleBackProfile = () => {
    if (profileStep > 1) {
      setProfileStep((prev) => (prev - 1) as 1 | 2 | 3)
    }
  }

  const canProceedStep1 = formData.first_name.trim().length > 0 && formData.last_name.trim().length > 0

  // Validation function to check if all required profile fields are complete
  const isProfileFormValid = (): boolean => {
    // Required fields: first_name, last_name
    const hasRequiredFields = 
      formData.first_name.trim().length > 0 && 
      formData.last_name.trim().length > 0
    
    // Optional fields validation (can be empty, but if filled, should be valid)
    const isValidPhone = !formData.phone_number || formData.phone_number.trim().length >= 10
    const isValidDob = !formData.dob || new Date(formData.dob) < new Date() // Date should be in the past
    
    return hasRequiredFields && isValidPhone && isValidDob
  }

  // Progress calculation
  const progress = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Progress Bar with Check Icons */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {/* Step 1: Verify */}
            <div className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentStep > 1
                      ? "bg-black text-white"
                      : currentStep === 1
                      ? "bg-black text-white ring-2 ring-black ring-offset-2"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {currentStep > 1 ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">1</span>
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium transition-colors ${
                  currentStep >= 1 ? "text-black" : "text-gray-400"
                }`}>
                  Verify
                </span>
              </div>
              <div className="flex-1 h-0.5 mx-2 mt-[-20px]">
                <div
                  className={`h-full transition-all duration-500 ${
                    currentStep > 1 ? "bg-black" : "bg-gray-200"
                  }`}
                  style={{ width: currentStep > 1 ? "100%" : "0%" }}
                />
              </div>
            </div>

            {/* Step 2: Password */}
            <div className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentStep > 2
                      ? "bg-black text-white"
                      : currentStep === 2
                      ? "bg-black text-white ring-2 ring-black ring-offset-2"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {currentStep > 2 ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">2</span>
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium transition-colors ${
                  currentStep >= 2 ? "text-black" : "text-gray-400"
                }`}>
                  Password
                </span>
              </div>
              <div className="flex-1 h-0.5 mx-2 mt-[-20px]">
                <div
                  className={`h-full transition-all duration-500 ${
                    currentStep > 2 ? "bg-black" : "bg-gray-200"
                  }`}
                  style={{ width: currentStep > 2 ? "100%" : "0%" }}
                />
              </div>
            </div>

            {/* Step 3: Profile */}
            <div className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentStep === 3
                      ? "bg-black text-white ring-2 ring-black ring-offset-2"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  <span className="text-sm font-semibold">3</span>
                </div>
                <span className={`mt-2 text-xs font-medium transition-colors ${
                  currentStep >= 3 ? "text-black" : "text-gray-400"
                }`}>
                  Profile
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Verify */}
        {currentStep === 1 && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black mb-2">Enter verification code</h1>
            </div>

            <div className="space-y-6">
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    We sent a verification code to
                  </p>
                  <p className="text-sm font-medium mt-1 text-black">{userId || "your email"}</p>
                </div>

                <div className="space-y-2">
                  <OtpInput
                    length={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    onComplete={async (value) => {
                      setOtp(value)
                      if (value.length === 6 && userId && !verifyOtpCall.loading) {
                        await verifyOtpCall.execute()
                      }
                    }}
                    disabled={verifyOtpCall.loading}
                    autoFocus
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 rounded-lg border-gray-300"
                    onClick={() => {
                      setOtp("")
                      router.push("/login")
                    }}
                    disabled={verifyOtpCall.loading}
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 rounded-lg border-gray-300"
                    onClick={() => resendOtpCall.execute()}
                    loading={resendOtpCall.loading}
                    loadingText="Resending..."
                    disabled={!userId || resendOtpCall.loading}
                  >
                    Resend OTP
                  </Button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                  loading={verifyOtpCall.loading}
                  loadingText="Verifying..."
                  disabled={!userId || !otp || otp.length !== 6 || verifyOtpCall.loading}
                >
                  Continue
                </Button>
              </form>
            </div>
          </>
        )}

        {/* Step 2: Set Password (Optional) */}
        {currentStep === 2 && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black mb-2">Create password</h1>
              <p className="text-sm text-gray-500 mt-2">You can skip this step and set it later</p>
            </div>

            <div className="space-y-6">
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm text-gray-600">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-lg border-gray-300 text-base pr-10"
                      required
                      disabled={false}
                      minLength={6}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Password must be at least 6 characters</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm text-gray-600">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 rounded-lg border-gray-300 text-base pr-10"
                      required
                      disabled={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                  {confirmPassword && password === confirmPassword && password.length >= 6 && (
                    <p className="text-xs text-green-500">✓ Passwords match</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                    disabled={!password || password.length < 6 || password !== confirmPassword}
                  >
                    Continue
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-lg border-gray-300"
                    onClick={() => {
                      setSkipPassword(true)
                      setPassword("") // Clear password if skipping
                      setConfirmPassword("")
                      setCurrentStep(3)
                    }}
                  >
                    Skip for now
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Step 3: Complete Profile */}
        {currentStep === 3 && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-black mb-2">
                {profileStep === 1 && "What's your name?"}
                {profileStep === 2 && "Tell us about yourself"}
                {profileStep === 3 && "Additional details"}
              </h1>
            </div>

            <div className="space-y-6">
              {/* Profile Step 1: Basic Info */}
              {profileStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="first_name" className="text-sm text-gray-600">
                      First Name
                    </label>
                    <Input
                      id="first_name"
                      type="text"
                      placeholder="Mr"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="h-12 rounded-lg border-gray-300 text-base"
                      required
                      disabled={completeOnboarding.loading}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="last_name" className="text-sm text-gray-600">
                      Last Name
                    </label>
                    <Input
                      id="last_name"
                      type="text"
                      placeholder="Das"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="h-12 rounded-lg border-gray-300 text-base"
                      required
                      disabled={completeOnboarding.loading}
                    />
                  </div>
                  <Button
                    onClick={handleNextProfile}
                    disabled={!canProceedStep1 || completeOnboarding.loading}
                    className="w-full h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                  >
                    Continue
                  </Button>
                </div>
              )}

              {/* Profile Step 2: About You */}
              {profileStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="user_name" className="text-sm text-gray-600">
                      Username
                    </label>
                    <Input
                      id="user_name"
                      type="text"
                      placeholder="mrdas"
                      value={formData.user_name}
                      onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                      className="h-12 rounded-lg border-gray-300 text-base"
                      disabled={completeOnboarding.loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="bio" className="text-sm text-gray-600">
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      placeholder="Tell us about yourself..."
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      className="w-full min-h-[120px] px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                      disabled={completeOnboarding.loading}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 text-right">{formData.bio.length}/500</p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleBackProfile}
                      disabled={completeOnboarding.loading}
                      className="flex-1 h-12 rounded-lg border-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleNextProfile}
                      disabled={completeOnboarding.loading}
                      className="flex-1 h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Profile Step 3: Additional Details */}
              {profileStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="phone_number" className="text-sm text-gray-600">
                      Phone Number <span className="text-gray-400">(optional)</span>
                    </label>
                    <Input
                      id="phone_number"
                      type="tel"
                      placeholder="+1234567890"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="h-12 rounded-lg border-gray-300 text-base"
                      disabled={completeOnboarding.loading}
                    />
                    {formData.phone_number && formData.phone_number.trim().length > 0 && formData.phone_number.trim().length < 10 && (
                      <p className="text-xs text-red-500">Please enter a valid phone number (at least 10 digits)</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="country" className="text-sm text-gray-600">
                        Country
                      </label>
                      <Input
                        id="country"
                        type="text"
                        placeholder="United States"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="h-12 rounded-lg border-gray-300 text-base"
                        disabled={completeOnboarding.loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="gender" className="text-sm text-gray-600">
                        Gender
                      </label>
                      <select
                        id="gender"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full h-12 px-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        disabled={completeOnboarding.loading}
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="dob" className="text-sm text-gray-600">
                      Date of Birth <span className="text-gray-400">(optional)</span>
                    </label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="h-12 rounded-lg border-gray-300 text-base"
                      disabled={completeOnboarding.loading}
                      max={new Date().toISOString().split('T')[0]} // Prevent future dates
                    />
                    {formData.dob && new Date(formData.dob) >= new Date() && (
                      <p className="text-xs text-red-500">Date of birth cannot be in the future</p>
                    )}
                  </div>
                  
                  {/* Validation Summary */}
                  {!isProfileFormValid() && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800">
                        Please ensure all required fields are filled correctly:
                      </p>
                      <ul className="text-xs text-amber-700 mt-1 list-disc list-inside space-y-0.5">
                        {!formData.first_name.trim() && <li>First name is required</li>}
                        {!formData.last_name.trim() && <li>Last name is required</li>}
                        {formData.phone_number && formData.phone_number.trim().length > 0 && formData.phone_number.trim().length < 10 && (
                          <li>Phone number must be at least 10 digits</li>
                        )}
                        {formData.dob && new Date(formData.dob) >= new Date() && (
                          <li>Date of birth must be in the past</li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleBackProfile}
                      disabled={completeOnboarding.loading}
                      className="flex-1 h-12 rounded-lg border-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleNextProfile}
                      disabled={!isProfileFormValid() || completeOnboarding.loading}
                      loading={completeOnboarding.loading}
                      loadingText="Completing..."
                      className="flex-1 h-12 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Complete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <PageGuard requireAuth={true} loginRedirect="/login">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        </div>
      }>
        <OnboardingPageContent />
      </Suspense>
    </PageGuard>
  )
}
