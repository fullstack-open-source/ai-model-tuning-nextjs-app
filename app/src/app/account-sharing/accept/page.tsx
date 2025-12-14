"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@context/AuthContext"
import { accountShareService } from "@services/account-share.service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import {
  Share2,
  Check,
  X,
  Clock,
  Shield,
  Eye,
  Key,
  User,
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  UserPlus,
  LogIn,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import type { AccountShareInvitation, AccessLevel } from "@models/account-share.model"

// Access level display config
const ACCESS_LEVEL_CONFIG: Record<AccessLevel, { label: string; description: string; icon: typeof Eye; className: string }> = {
  view_only: {
    label: 'View Only',
    description: 'Can view account information, no modifications allowed',
    icon: Eye,
    className: 'bg-sky-500/10 text-sky-600 border-sky-500/20'
  },
  limited: {
    label: 'Limited Access',
    description: 'Can view and perform limited actions',
    icon: Shield,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
  },
  full: {
    label: 'Full Access',
    description: 'Full access to all account features',
    icon: Key,
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  },
}

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, apiService, loading: authLoading } = useAuth()
  
  const token = searchParams.get('token')
  
  const [invitation, setInvitation] = useState<AccountShareInvitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [responseStatus, setResponseStatus] = useState<'accepted' | 'declined' | null>(null)

  // Set API service when available
  useEffect(() => {
    if (apiService) {
      accountShareService.setAuthApi(apiService)
    }
  }, [apiService])

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link. No token provided.')
        setLoading(false)
        return
      }

      try {
        const inv = await accountShareService.getInvitationByToken(token)
        setInvitation(inv)
      } catch (err: unknown) {
        console.error('Error fetching invitation:', err)
        setError('This invitation link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [token])

  // Handle respond to invitation
  const handleRespond = async (accept: boolean) => {
    if (!token) return
    
    setResponding(true)
    try {
      await accountShareService.respondToInvitation({
        invitation_token: token,
        accept,
      })
      setResponseStatus(accept ? 'accepted' : 'declined')
    } catch (err: unknown) {
      console.error('Error responding to invitation:', err)
      setError('Failed to respond to invitation. Please try again.')
    } finally {
      setResponding(false)
    }
  }

  // Format date
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Check if invitation is expired
  const isExpired = invitation && new Date(invitation.expires_at) < new Date()

  // Get sender display name
  const getSenderName = () => {
    if (!invitation?.sender) return 'Unknown'
    const { first_name, last_name, email, user_name } = invitation.sender
    const fullName = [first_name, last_name].filter(Boolean).join(' ')
    return fullName || user_name || email || 'Unknown'
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500/5 via-background to-indigo-500/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600 mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500/5 via-background to-orange-500/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-red-500/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-red-500/10 mb-4">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-center mb-6">{error}</p>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state after responding
  if (responseStatus) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        responseStatus === 'accepted'
          ? 'bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5'
          : 'bg-gradient-to-br from-slate-500/5 via-background to-gray-500/5'
      }`}>
        <Card className={`w-full max-w-lg ${responseStatus === 'accepted' ? 'border-emerald-500/20' : ''}`}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className={`p-4 rounded-full mb-6 ${
              responseStatus === 'accepted' ? 'bg-emerald-500/10' : 'bg-slate-500/10'
            }`}>
              {responseStatus === 'accepted' ? (
                <CheckCircle2 className="h-16 w-16 text-emerald-600" />
              ) : (
                <XCircle className="h-16 w-16 text-slate-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {responseStatus === 'accepted' ? 'Invitation Accepted!' : 'Invitation Declined'}
            </h2>
            <p className="text-muted-foreground text-center mb-8 max-w-sm">
              {responseStatus === 'accepted'
                ? `You now have ${invitation?.access_level.replace('_', ' ')} access to ${getSenderName()}'s account.`
                : 'You have declined this invitation. The sender will be notified.'
              }
            </p>
            <div className="flex gap-3">
              {responseStatus === 'accepted' && (
                <Button
                  onClick={() => router.push('/account-sharing')}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  View Shared Accounts
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              <Button
                variant={responseStatus === 'accepted' ? 'outline' : 'default'}
                onClick={() => router.push('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Invitation already responded
  if (invitation && invitation.status !== 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-500/5 via-background to-gray-500/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-slate-500/10 mb-4">
              {invitation.status === 'accepted' ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              ) : invitation.status === 'declined' ? (
                <XCircle className="h-12 w-12 text-red-600" />
              ) : (
                <Clock className="h-12 w-12 text-slate-600" />
              )}
            </div>
            <h2 className="text-xl font-bold mb-2">
              Invitation {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
            </h2>
            <p className="text-muted-foreground text-center mb-6">
              This invitation has already been {invitation.status}.
            </p>
            <Button onClick={() => router.push('/account-sharing')} variant="outline">
              View Account Sharing
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Expired invitation
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500/5 via-background to-orange-500/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-amber-500/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-amber-500/10 mb-4">
              <Clock className="h-12 w-12 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground text-center mb-6">
              This invitation expired on {formatDate(invitation!.expires_at)}. Please ask {getSenderName()} to send a new invitation.
            </p>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not logged in - show login/signup prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500/5 via-background to-indigo-500/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-white/20">
                <Share2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Account Share Invitation</h1>
                <p className="text-white/80 text-sm">You've been invited to access an account</p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Sender info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-violet-500/5 to-indigo-500/5 border border-violet-500/10">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold">
                {getSenderName().charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-lg">{getSenderName()}</p>
                <p className="text-muted-foreground text-sm">{invitation?.sender?.email}</p>
                <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">
                  wants to share their account with you
                </p>
              </div>
            </div>

            {/* Access level */}
            {invitation && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Access Level</h3>
                <div className={`p-4 rounded-xl border ${ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]?.className}`}>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const config = ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]
                      const Icon = config?.icon || Shield
                      return <Icon className="h-5 w-5" />
                    })()}
                    <div>
                      <p className="font-semibold">{ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]?.label}</p>
                      <p className="text-sm opacity-80">{ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]?.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message */}
            {invitation?.message && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Personal Message</h3>
                <p className="p-4 rounded-xl bg-muted italic text-muted-foreground">
                  &ldquo;{invitation.message}&rdquo;
                </p>
              </div>
            )}

            {/* Expiration */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Expires {formatDate(invitation!.expires_at)}</span>
            </div>

            {/* Login/Signup prompt */}
            <div className="space-y-4 pt-4 border-t">
              <div className="text-center">
                <h3 className="font-semibold mb-2">Sign in to accept this invitation</h3>
                <p className="text-sm text-muted-foreground">
                  You need to be logged in to accept this invitation. If you don't have an account, you can create one.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => router.push(`/signup?redirect=/account-sharing/accept?token=${token}`)}
                >
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </Button>
                <Button
                  className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600"
                  onClick={() => router.push(`/login?next=/account-sharing/accept?token=${token}`)}
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Logged in - show accept/decline buttons
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500/5 via-background to-indigo-500/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-white/20">
              <Share2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Account Share Invitation</h1>
              <p className="text-white/80 text-sm">You've been invited to access an account</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Sender info */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-violet-500/5 to-indigo-500/5 border border-violet-500/10">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold">
              {getSenderName().charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-lg">{getSenderName()}</p>
              <p className="text-muted-foreground text-sm">{invitation?.sender?.email}</p>
              <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">
                wants to share their account with you
              </p>
            </div>
          </div>

          {/* Access level */}
          {invitation && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Access Level</h3>
              <div className={`p-4 rounded-xl border ${ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]?.className}`}>
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]
                    const Icon = config?.icon || Shield
                    return <Icon className="h-5 w-5" />
                  })()}
                  <div>
                    <p className="font-semibold">{ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]?.label}</p>
                    <p className="text-sm opacity-80">{ACCESS_LEVEL_CONFIG[invitation.access_level as AccessLevel]?.description}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          {invitation?.message && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Personal Message</h3>
              <p className="p-4 rounded-xl bg-muted italic text-muted-foreground">
                &ldquo;{invitation.message}&rdquo;
              </p>
            </div>
          )}

          {/* Expiration */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Expires {formatDate(invitation!.expires_at)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => handleRespond(false)}
              disabled={responding}
            >
              {responding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Decline
            </Button>
            <Button
              className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              onClick={() => handleRespond(true)}
              disabled={responding}
            >
              {responding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Accept Invitation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-violet-500/5 via-background to-indigo-500/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600 mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  )
}

