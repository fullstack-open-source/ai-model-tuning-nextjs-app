/**
 * Token Info Page
 * View token information and details
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthHook } from "@hooks/useAuth"
import { useApiCall } from "@hooks/useApiCall"
import { authService } from "@services/auth.service"
import { Button } from "@components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Info, RefreshCw, ArrowLeft, Copy, Check } from "lucide-react"
import Link from "next/link"
import { formatDateTime } from "@lib/utils/date-format"

export default function TokenInfoPage() {
  const router = useRouter()
  const { isAuthenticated, tokens } = useAuthHook()
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Get token info
  const getTokenInfoCall = useApiCall(
    () => authService.getTokenInfo(),
    {
      onSuccess: (data) => {
        setTokenInfo(data)
      },
      showErrorToast: true,
    }
  )

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    getTokenInfoCall.execute()
  }, [isAuthenticated])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A"
    return formatDateTime(new Date(timestamp * 1000))
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-0">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Token Information
              </CardTitle>
              <CardDescription className="text-base mt-2">
                View your authentication token details
              </CardDescription>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <Info className="w-6 h-6 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {getTokenInfoCall.loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading token information...</p>
            </div>
          ) : tokenInfo ? (
            <div className="space-y-4">
              {/* Token Details */}
              <div className="grid gap-4">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Token Type</h3>
                    <span className="text-sm text-muted-foreground">{tokenInfo.token_type || "Bearer"}</span>
                  </div>
                </div>

                {tokenInfo.exp && (
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Expires At</h3>
                      <span className="text-sm text-muted-foreground">{formatDate(tokenInfo.exp)}</span>
                    </div>
                  </div>
                )}

                {tokenInfo.iat && (
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Issued At</h3>
                      <span className="text-sm text-muted-foreground">{formatDate(tokenInfo.iat)}</span>
                    </div>
                  </div>
                )}

                {tokenInfo.user_id && (
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">User ID</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-mono">{tokenInfo.user_id}</span>
                        <button
                          onClick={() => copyToClipboard(tokenInfo.user_id, "user_id")}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {copied === "user_id" ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Access Token (masked) */}
                {tokens.access_token && (
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Access Token</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-mono">
                          {tokens.access_token.substring(0, 20)}...
                        </span>
                        <button
                          onClick={() => copyToClipboard(tokens.access_token || "", "access_token")}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {copied === "access_token" ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Session Token (masked) */}
                {tokens.session_token && (
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Session Token</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-mono">
                          {tokens.session_token.substring(0, 20)}...
                        </span>
                        <button
                          onClick={() => copyToClipboard(tokens.session_token || "", "session_token")}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {copied === "session_token" ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Refresh Button */}
              <Button
                onClick={() => getTokenInfoCall.execute()}
                variant="outline"
                className="w-full"
                loading={getTokenInfoCall.loading}
                loadingText="Refreshing..."
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Token Info
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No token information available</p>
            </div>
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

