/**
 * Change Password Page
 * For authenticated users to change their password
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthHook } from "@hooks/useAuth"
import { useApiCall } from "@hooks/useApiCall"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Lock, ArrowRight, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ChangePasswordPage() {
  const router = useRouter()
  const { isAuthenticated, changePassword: changePasswordWithAuth } = useAuthHook()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  // Change password
  const changePasswordCall = useApiCall(
    () => changePasswordWithAuth(oldPassword, newPassword),
    {
      onSuccess: () => {
        router.push("/profile-settings")
      },
      successMessage: "Password changed successfully!",
      showSuccessToast: true,
    }
  )

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword || !newPassword || newPassword !== confirmPassword) return
    await changePasswordCall.execute()
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            Change Password
          </CardTitle>
          <CardDescription className="text-base">
            Update your account password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="oldPassword" className="text-sm font-medium">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="oldPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={changePasswordCall.loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={changePasswordCall.loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={changePasswordCall.loading}
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
              loading={changePasswordCall.loading}
              loadingText="Changing password..."
              disabled={
                !oldPassword ||
                !newPassword ||
                newPassword !== confirmPassword ||
                changePasswordCall.loading
              }
            >
              Change Password
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
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

