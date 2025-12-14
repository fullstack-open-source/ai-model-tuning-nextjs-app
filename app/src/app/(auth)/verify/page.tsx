/**
 * OTP Verification Page
 * Standalone OTP verification page
 */

"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { OtpInput } from "@components/ui/otp-input"
import { useApiCall } from "@hooks/useApiCall"
import { useAuthRedirect } from "@hooks/useAuthRedirect"
import { authService } from "@services/auth.service"
import { permissionService } from "@services/permission.service"
import { profileService } from "@services/profile.service"
import { getRedirectPath } from "@utils/auth-redirect"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Mail, Phone, ArrowRight, ShieldCheck, Loader2 } from "lucide-react"

function VerifyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Redirect authenticated users to dashboard or ?next= path
  const { isChecking: isAuthChecking } = useAuthRedirect()
  
  const [userId, setUserId] = useState("")
  const [otp, setOtp] = useState("")
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email")

  useEffect(() => {
    const userIdParam = searchParams.get("user_id")
    const channelParam = searchParams.get("channel") as "email" | "sms" | "whatsapp" | null
    if (userIdParam) setUserId(userIdParam)
    if (channelParam) setChannel(channelParam)
  }, [searchParams])

  // Verify OTP
  const verifyOtpCall = useApiCall(
    async () => {
      const response = await authService.verifyOtp({ user_id: userId, channel, otp });
      
      // After successful verification, fetch user groups and profile using tokens from response
      if (response?.success && response.data) {
        const { session_token, access_token, token_type } = response.data;
        
        // Create authenticated API service with tokens from verification response
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
      onSuccess: async (response: any) => {
        // Wait a bit for auth context to update
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // After verification, redirect to unified onboarding page
        router.push("/onboarding");
      },
      successMessage: "Verification successful!",
      showSuccessToast: true,
    }
  )

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

  const handleResend = async () => {
    if (!userId) return
    await resendOtpCall.execute()
  }

  // Show loading while checking if user is already authenticated
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto" />
          <p className="mt-4 text-gray-500">Checking session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-full flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            Verify Your Account
          </CardTitle>
          <CardDescription className="text-base">
            Enter the verification code sent to your {channel === "email" ? "email" : "phone"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            {!userId && (
              <div className="space-y-2">
                <label htmlFor="userId" className="text-sm font-medium">
                  Email or Phone
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
                    onChange={(e) => setUserId(e.target.value)}
                    className="pl-10"
                    required
                    disabled={verifyOtpCall.loading}
                  />
                </div>
              </div>
            )}

            {userId && (
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Verification code sent to
                </p>
                <p className="text-sm font-medium mt-1">{userId}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium">
                Enter Verification Code
              </label>
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

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleResend}
              loading={resendOtpCall.loading}
              loadingText="Resending..."
              disabled={!userId || resendOtpCall.loading}
            >
              Resend Code
            </Button>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              loading={verifyOtpCall.loading}
              loadingText="Verifying..."
              disabled={!userId || !otp || otp.length !== 6 || verifyOtpCall.loading}
            >
              Verify Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  )
}

