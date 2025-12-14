/**
 * Check User Availability Page
 * Check if email or phone is available for registration
 */

"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useApiCall } from "@hooks/useApiCall"
import { useAuthRedirect } from "@hooks/useAuthRedirect"
import { authService } from "@services/auth.service"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Mail, Phone, CheckCircle2, XCircle, Search, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"

function CheckAvailabilityPageContent() {
  const router = useRouter()
  
  // Redirect authenticated users to dashboard
  const { isChecking: isAuthChecking } = useAuthRedirect()
  
  const [userId, setUserId] = useState("")
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email")
  const [availability, setAvailability] = useState<boolean | null>(null)
  const [checked, setChecked] = useState(false)

  // Check availability
  const checkAvailabilityCall = useApiCall(
    () => authService.checkUserAvailability(userId),
    {
      onSuccess: (data) => {
        setAvailability(data?.available ?? false)
        setChecked(true)
      },
      showErrorToast: true,
    }
  )

  const handleCheck = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!userId) return
    setChecked(false)
    setAvailability(null)
    await checkAvailabilityCall.execute()
  }

  const detectChannel = (value: string): "email" | "sms" | "whatsapp" => {
    if (value.includes("@")) return "email"
    if (value.startsWith("+")) return "sms"
    return "sms"
  }

  const handleUserIdChange = (value: string) => {
    setUserId(value)
    setChannel(detectChannel(value))
    setChecked(false)
    setAvailability(null)
  }

  const handleContinue = () => {
    if (availability) {
      router.push(`/signup?user_id=${encodeURIComponent(userId)}`)
    }
  }

  // Show loading while checking if user is already authenticated
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50 to-yellow-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto" />
          <p className="mt-4 text-gray-500">Checking session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50 to-yellow-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center mb-2">
            <Search className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
            Check Availability
          </CardTitle>
          <CardDescription className="text-base">
            Check if your email or phone is available for registration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleCheck(); }} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium">
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
                  disabled={checkAvailabilityCall.loading}
                />
              </div>
            </div>

            {/* Availability Result */}
            {checked && availability !== null && (
              <div
                className={`p-4 rounded-lg border-2 ${
                  availability
                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                    : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  {availability ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900 dark:text-green-100">
                          Available!
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          This {channel === "email" ? "email" : "phone"} is available for registration.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-red-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-red-900 dark:text-red-100">
                          Already Taken
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          This {channel === "email" ? "email" : "phone"} is already registered. Please login instead.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700"
              loading={checkAvailabilityCall.loading}
              loadingText="Checking..."
              disabled={!userId || checkAvailabilityCall.loading}
            >
              Check Availability
              <Search className="w-4 h-4 ml-2" />
            </Button>

            {checked && availability && (
              <Button
                type="button"
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                Continue to Signup
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {checked && !availability && (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/login")}
                className="w-full"
              >
                Go to Login
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/signup"
              className="text-sm text-primary font-medium hover:underline"
            >
              Or sign up directly
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CheckAvailabilityLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50 to-yellow-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto" />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

export default function CheckAvailabilityPage() {
  return (
    <Suspense fallback={<CheckAvailabilityLoading />}>
      <CheckAvailabilityPageContent />
    </Suspense>
  )
}

