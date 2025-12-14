"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { AlertCircle, Calendar, User, FileText, Mail } from "lucide-react"
import { profileService } from "@services/profile.service"
import { useProject } from "@context/ProjectContext"
import { formatDateTime } from "@lib/utils/date-format"

export default function SuspendedPage() {
  const { user, apiService } = useAuth()
  const { projectInfo } = useProject()
  const [suspensionDetails, setSuspensionDetails] = useState<{
    suspension_reason?: string | null
    suspended_at?: string | Date | null
  } | null>(null)

  // Fetch user profile to get suspension details
  useEffect(() => {
    const fetchSuspensionDetails = async () => {
      if (!user?.user_id || !apiService) return
      try {
        profileService.setAuthApi(apiService)
        const response = await profileService.getProfile(true)
        if (response?.success && response.data) {
          const userData = response.data as unknown as Record<string, unknown>
          setSuspensionDetails({
            suspension_reason: userData.suspension_reason as string | null | undefined,
            suspended_at: userData.suspended_at as string | Date | null | undefined,
          })
        }
      } catch (error) {
        console.error("Error fetching suspension details:", error)
      }
    }
    fetchSuspensionDetails()
  }, [user, apiService])

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "N/A"
    try {
      return formatDateTime(date)
    } catch {
      return "N/A"
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header Card */}
        <Card className="shadow-xl border-2 border-red-200 dark:border-red-900">
          <CardHeader className="text-center bg-gradient-to-r from-red-500/10 to-orange-500/10 border-b">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <CardTitle className="text-3xl text-red-600 dark:text-red-400">
              Account Suspended
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Your account has been suspended. Please review the details below and contact support if you believe this is an error.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Suspension Details */}
              {suspensionDetails && (
                <div className="space-y-4">
                  {suspensionDetails.suspension_reason && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                            Suspension Reason
                          </p>
                          <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap">
                            {suspensionDetails.suspension_reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suspensionDetails.suspended_at && (
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-semibold">Suspended On</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(suspensionDetails.suspended_at)}
                        </p>
                      </div>
                    )}
                    
                    {user && (
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-semibold">Account Information</p>
                        </div>
                        <p className="text-sm font-medium">
                          {user.first_name || user.last_name
                            ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                            : user.user_name || user.email || "User"}
                        </p>
                        {user.email && (
                          <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!suspensionDetails?.suspension_reason && (
                <div className="text-center">
                  <p className="text-muted-foreground">
                    Suspension details are being loaded...
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Support Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Support
            </CardTitle>
            <CardDescription>
              If you believe this suspension was made in error, please contact our support team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                For assistance with your account, please reach out to our support team:
              </p>
              {projectInfo?.support_mail ? (
                <a
                  href={`mailto:${projectInfo.support_mail}`}
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  <Mail className="h-4 w-4" />
                  {projectInfo.support_mail}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Contact information is not available. Please try again later.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
