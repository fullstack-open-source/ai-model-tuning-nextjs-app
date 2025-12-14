"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { usePermissions } from "@hooks/usePermissions"
import { accountShareService } from "@services/account-share.service"
import { MainLayout } from "@components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import {
  Users,
  UserPlus,
  Send,
  Inbox,
  Clock,
  Shield,
  Eye,
  Key,
  RefreshCw,
  Search,
  MoreVertical,
  Mail,
  Check,
  X,
  AlertCircle,
  Activity,
  Settings,
  Copy,
  ExternalLink,
  ArrowRight,
  Share2,
  Loader2,
  LogOut,
  Ban,
  XCircle,
} from "lucide-react"
import type {
  AccountShare,
  AccountShareInvitation,
  AccountShareActivity,
  ShareStatistics,
  AccessLevel,
} from "@models/account-share.model"

// Tab types
type TabType = 'shared-with-me' | 'shared-by-me' | 'invitations' | 'requests' | 'activity'

// Access level badges
const ACCESS_LEVEL_BADGES: Record<AccessLevel, { label: string; icon: typeof Eye; className: string }> = {
  view_only: { label: 'View Only', icon: Eye, className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  limited: { label: 'Limited', icon: Shield, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  full: { label: 'Full Access', icon: Key, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
}

// Status badges
const STATUS_BADGES: Record<string, { className: string }> = {
  active: { className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  pending: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  accepted: { className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  declined: { className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  revoked: { className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  expired: { className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  cancelled: { className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
}

export default function AccountSharingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { hasPermission, isAdmin, isSuperAdmin } = usePermissions()
  const [checking, setChecking] = useState(true)
  
  // Check access - allow if has permission OR is admin
  const hasAccess = hasPermission("view_account_sharing") || 
                    hasPermission("manage_account_sharing") || 
                    isAdmin || 
                    isSuperAdmin

  useEffect(() => {
    if (authLoading) return
    
    // Not logged in - redirect to login
    if (!user) {
      router.push("/login?next=/account-sharing")
      return
    }
    
    // Check access after auth is loaded
    setChecking(false)
    
    if (!hasAccess) {
      router.push("/dashboard")
    }
  }, [authLoading, user, hasAccess, router])

  // Show loading while checking auth
  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Not authorized
  if (!hasAccess) {
    return null
  }

  return <AccountSharingContent />
}

function AccountSharingContent() {
  const searchParams = useSearchParams()
  const { apiService } = useAuth()
  const { hasPermission } = usePermissions()
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('shared-with-me')
  const [statistics, setStatistics] = useState<ShareStatistics | null>(null)
  const [sharesReceived, setSharesReceived] = useState<AccountShare[]>([])
  const [sharesOwned, setSharesOwned] = useState<AccountShare[]>([])
  const [invitationsSent, setInvitationsSent] = useState<AccountShareInvitation[]>([])
  const [invitationsReceived, setInvitationsReceived] = useState<AccountShareInvitation[]>([])
  const [accessRequests, setAccessRequests] = useState<AccountShareInvitation[]>([])
  const [activities, setActivities] = useState<AccountShareActivity[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteAccessLevel, setInviteAccessLevel] = useState<AccessLevel>('view_only')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ user_id: string; email: string; user_name?: string; full_name?: string; profile_picture_url?: string }>>([])
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; email: string; full_name?: string } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'leave' | 'revoke' | 'cancel' | null
    title: string
    description: string
    confirmText: string
    successMessage: string
    data: AccountShare | AccountShareInvitation | null
  }>({
    open: false,
    type: null,
    title: '',
    description: '',
    confirmText: '',
    successMessage: '',
    data: null
  })

  // Set API service
  useEffect(() => {
    if (apiService) {
      accountShareService.setAuthApi(apiService)
    }
  }, [apiService])

  // Handle tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['shared-with-me', 'shared-by-me', 'invitations', 'requests', 'activity'].includes(tab)) {
      setActiveTab(tab as TabType)
    }
  }, [searchParams])

  // Helper function to add timeout to promises
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number = 10000, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => {
        setTimeout(() => resolve(fallback), timeoutMs)
      })
    ])
  }

  // Fetch all data with timeout and permission checks
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      // Check permissions
      const canViewStatistics = hasPermission('view_share_activity') || hasPermission('admin_manage_shares')
      const canViewActivity = hasPermission('view_share_activity')

      // Create promises with timeout and permission checks
      const promises: Promise<any>[] = [
        // Statistics - only if user has permission
        canViewStatistics
          ? withTimeout(accountShareService.getStatistics().catch(() => null), 8000, null)
          : Promise.resolve(null),
        // Shares received - always fetch (user's own data)
        withTimeout(accountShareService.getSharesReceived({ status: 'active' }).catch(() => ({ shares: [] })), 8000, { shares: [] }),
        // Shares owned - always fetch (user's own data)
        withTimeout(accountShareService.getSharesOwned({ status: 'all' }).catch(() => ({ shares: [] })), 8000, { shares: [] }),
        // Invitations sent - always fetch (user's own data)
        withTimeout(accountShareService.getInvitationsSent({ status: 'all' }).catch(() => ({ invitations: [] })), 8000, { invitations: [] }),
        // Invitations received - always fetch (user's own data)
        withTimeout(accountShareService.getInvitationsReceived({ status: 'pending' }).catch(() => ({ invitations: [] })), 8000, { invitations: [] }),
        // Access requests - always fetch (user's own data)
        withTimeout(accountShareService.getAccessRequestsReceived({ status: 'pending' }).catch(() => ({ invitations: [] })), 8000, { invitations: [] }),
        // Activity - only if user has permission
        canViewActivity
          ? withTimeout(accountShareService.getMyShareActivity({ limit: 50 }).catch(() => ({ activities: [] })), 8000, { activities: [] })
          : Promise.resolve({ activities: [] })
      ]

      // Use Promise.allSettled to handle failures gracefully
      const results = await Promise.allSettled(promises)

      // Process results
      const [
        statsResult,
        receivedResult,
        ownedResult,
        sentInvResult,
        recvInvResult,
        reqResult,
        actResult
      ] = results

      // Set statistics only if successful and user has permission
      if (canViewStatistics && statsResult.status === 'fulfilled' && statsResult.value) {
        setStatistics(statsResult.value)
      } else {
        setStatistics(null)
      }

      // Set other data
      if (receivedResult.status === 'fulfilled') {
        setSharesReceived(receivedResult.value?.shares || [])
      } else {
        setSharesReceived([])
      }

      if (ownedResult.status === 'fulfilled') {
        setSharesOwned(ownedResult.value?.shares || [])
      } else {
        setSharesOwned([])
      }

      if (sentInvResult.status === 'fulfilled') {
        setInvitationsSent(sentInvResult.value?.invitations || [])
      } else {
        setInvitationsSent([])
      }

      if (recvInvResult.status === 'fulfilled') {
        setInvitationsReceived(recvInvResult.value?.invitations || [])
      } else {
        setInvitationsReceived([])
      }

      if (reqResult.status === 'fulfilled') {
        setAccessRequests(reqResult.value?.invitations || [])
      } else {
        setAccessRequests([])
      }

      if (canViewActivity && actResult.status === 'fulfilled') {
        setActivities(actResult.value?.activities || [])
      } else {
        setActivities([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      // Set defaults on error
      setStatistics(null)
      setSharesReceived([])
      setSharesOwned([])
      setInvitationsSent([])
      setInvitationsReceived([])
      setAccessRequests([])
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [hasPermission])

  // Load initial data
  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // Send invitation handler
  const handleSendInvitation = async () => {
    setIsSending(true)
    try {
      const payload = {
        recipient_email: selectedUser ? undefined : inviteEmail,
        recipient_id: selectedUser?.user_id,
        access_level: inviteAccessLevel,
        message: inviteMessage || undefined,
      }
      await accountShareService.sendInvitation(payload)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteMessage('')
      setSelectedUser(null)
      fetchAllData()
    } catch (error) {
      console.error('Error sending invitation:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Request access handler
  const handleRequestAccess = async () => {
    setIsSending(true)
    try {
      await accountShareService.requestAccess({
        target_owner_email: requestEmail,
        message: requestMessage || undefined,
      })
      setShowRequestModal(false)
      setRequestEmail('')
      setRequestMessage('')
      fetchAllData()
    } catch (error) {
      console.error('Error requesting access:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Search users
  const handleSearchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const results = await accountShareService.searchUsers(query)
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Respond to invitation
  const handleRespondToInvitation = useCallback(async (invitation: AccountShareInvitation, accept: boolean) => {
    try {
      await accountShareService.respondToInvitation({
        invitation_token: invitation.invitation_token,
        accept,
      })
      fetchAllData()
    } catch (error) {
      console.error('Error responding to invitation:', error)
    }
  }, [fetchAllData])

  // Respond to access request
  const handleRespondToAccessRequest = useCallback(async (invitation: AccountShareInvitation, accept: boolean, accessLevel?: AccessLevel) => {
    try {
      await accountShareService.respondToAccessRequest({
        invitation_token: invitation.invitation_token,
        accept,
        access_level: accessLevel,
      })
      fetchAllData()
    } catch (error) {
      console.error('Error responding to access request:', error)
    }
  }, [fetchAllData])

  // Open revoke share confirmation
  const openRevokeConfirm = useCallback((share: AccountShare) => {
    const userName = getUserDisplayName(share.recipient)
    setConfirmDialog({
      open: true,
      type: 'revoke',
      title: 'Revoke Access',
      description: `Are you sure you want to revoke ${userName}'s access to your account? They will no longer be able to access your account.`,
      confirmText: 'Yes, Revoke Access',
      successMessage: 'Access has been revoked successfully!',
      data: share
    })
  }, [])

  // Open leave share confirmation
  const openLeaveConfirm = useCallback((share: AccountShare) => {
    const ownerName = getUserDisplayName(share.owner)
    setConfirmDialog({
      open: true,
      type: 'leave',
      title: 'Leave Shared Account',
      description: `Are you sure you want to leave ${ownerName}'s shared account? You will lose access to their account.`,
      confirmText: 'Yes, Leave Account',
      successMessage: 'You have left the shared account successfully!',
      data: share
    })
  }, [])

  // Open cancel invitation confirmation
  const openCancelInvitationConfirm = useCallback((invitation: AccountShareInvitation) => {
    const recipientName = getUserDisplayName(invitation.recipient) || invitation.recipient_email || 'this user'
    setConfirmDialog({
      open: true,
      type: 'cancel',
      title: 'Cancel Invitation',
      description: `Are you sure you want to cancel the invitation to ${recipientName}? They will no longer be able to accept this invitation.`,
      confirmText: 'Yes, Cancel Invitation',
      successMessage: 'Invitation cancelled successfully!',
      data: invitation
    })
  }, [])

  // Handle confirm dialog action
  const handleConfirmAction = useCallback(async () => {
    if (!confirmDialog.data) return

    try {
      switch (confirmDialog.type) {
        case 'revoke':
          await accountShareService.revokeShare((confirmDialog.data as AccountShare).share_id)
          break
        case 'leave':
          await accountShareService.leaveShare((confirmDialog.data as AccountShare).share_id)
          break
        case 'cancel':
          await accountShareService.cancelInvitation((confirmDialog.data as AccountShareInvitation).invitation_id)
          break
      }
      fetchAllData()
    } catch (error) {
      console.error('Error executing action:', error)
      throw error // Re-throw to let ConfirmDialog handle the error state
    }
  }, [confirmDialog.data, confirmDialog.type, fetchAllData])

  // Close confirm dialog
  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, open: false }))
  }, [])

  // Format date
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get user display name
  const getUserDisplayName = (user?: { first_name?: string | null; last_name?: string | null; email?: string | null; user_name?: string | null }) => {
    if (!user) return 'Unknown User'
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
    return fullName || user.user_name || user.email || 'Unknown User'
  }

  // Render tabs
  const tabs: { id: TabType; label: string; icon: typeof Users; count?: number }[] = [
    { id: 'shared-with-me', label: 'Shared with Me', icon: Inbox, count: statistics?.active_shares_received },
    { id: 'shared-by-me', label: 'Shared by Me', icon: Send, count: statistics?.active_shares_owned },
    { id: 'invitations', label: 'Invitations', icon: Mail, count: (statistics?.pending_invitations_received || 0) + (statistics?.pending_invitations_sent || 0) },
    { id: 'requests', label: 'Access Requests', icon: UserPlus, count: statistics?.pending_access_requests },
    { id: 'activity', label: 'Activity', icon: Activity },
  ]

  return (
    <MainLayout
      title="Account Sharing"
      description="Manage shared account access and collaborate securely"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllData()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRequestModal(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Request Access
          </Button>
          <Button
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            <Share2 className="h-4 w-4" />
            Share Access
          </Button>
        </div>
      }
    >
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Shares</p>
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {(statistics?.active_shares_owned || 0) + (statistics?.active_shares_received || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-violet-500/20">
                  <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Invitations</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {statistics?.pending_invitations_received || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Access Requests</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {statistics?.pending_access_requests || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/20">
                  <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 border-sky-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Shared by Me</p>
                  <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                    {statistics?.active_shares_owned || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-sky-500/20">
                  <Send className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === tab.id
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {/* Shared with Me Tab */}
          {activeTab === 'shared-with-me' && (
            <div className="space-y-4">
              {sharesReceived.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Inbox className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Shared Accounts</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      When someone shares their account access with you, it will appear here.
                    </p>
                    <Button variant="outline" onClick={() => setShowRequestModal(true)} className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Request Access
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sharesReceived.map((share) => (
                    <Card key={share.share_id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3 bg-gradient-to-r from-violet-500/5 to-indigo-500/5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                              {getUserDisplayName(share.owner).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <CardTitle className="text-base">{getUserDisplayName(share.owner)}</CardTitle>
                              <CardDescription>{share.owner?.email}</CardDescription>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium border ${ACCESS_LEVEL_BADGES[share.access_level as AccessLevel]?.className || ''}`}>
                            {ACCESS_LEVEL_BADGES[share.access_level as AccessLevel]?.label || share.access_level}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        {share.share_note && (
                          <p className="text-sm text-muted-foreground mb-3 italic">&ldquo;{share.share_note}&rdquo;</p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Shared {formatDate(share.created_at)}
                          </span>
                          {share.expires_at && (
                            <span className="text-amber-600">
                              Expires {formatDate(share.expires_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Access
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openLeaveConfirm(share)}
                            title="Leave shared account"
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shared by Me Tab */}
          {activeTab === 'shared-by-me' && (
            <div className="space-y-4">
              {sharesOwned.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Send className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Shared Access</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-4">
                      You haven't shared your account access with anyone yet.
                    </p>
                    <Button onClick={() => setShowInviteModal(true)} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600">
                      <Share2 className="h-4 w-4" />
                      Share Access
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sharesOwned.map((share) => (
                    <Card key={share.share_id} className={`overflow-hidden hover:shadow-lg transition-shadow ${share.status !== 'active' ? 'opacity-60' : ''}`}>
                      <CardHeader className="pb-3 bg-gradient-to-r from-sky-500/5 to-blue-500/5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                              {getUserDisplayName(share.recipient).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <CardTitle className="text-base">{getUserDisplayName(share.recipient)}</CardTitle>
                              <CardDescription>{share.recipient?.email}</CardDescription>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[share.status]?.className || ''}`}>
                            {share.status}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium border ${ACCESS_LEVEL_BADGES[share.access_level as AccessLevel]?.className || ''}`}>
                            {ACCESS_LEVEL_BADGES[share.access_level as AccessLevel]?.label || share.access_level}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Shared {formatDate(share.created_at)}
                          </span>
                        </div>
                        {share.status === 'active' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 gap-1">
                              <Settings className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openRevokeConfirm(share)}
                              title="Revoke access"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invitations Tab */}
          {activeTab === 'invitations' && (
            <div className="space-y-6">
              {/* Received Invitations */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-violet-600" />
                  Received Invitations
                </h3>
                {invitationsReceived.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No pending invitations
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {invitationsReceived.map((invitation) => (
                      <Card key={invitation.invitation_id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                                {getUserDisplayName(invitation.sender).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">{getUserDisplayName(invitation.sender)}</p>
                                <p className="text-sm text-muted-foreground">
                                  wants to share their account • {invitation.access_level.replace('_', ' ')}
                                </p>
                                {invitation.message && (
                                  <p className="text-sm text-muted-foreground mt-1 italic">&ldquo;{invitation.message}&rdquo;</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleRespondToInvitation(invitation, true)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => handleRespondToInvitation(invitation, false)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Invitations */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Send className="h-5 w-5 text-sky-600" />
                  Sent Invitations
                </h3>
                {invitationsSent.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No sent invitations
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {invitationsSent.map((invitation) => (
                      <Card key={invitation.invitation_id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                                {(getUserDisplayName(invitation.recipient) || invitation.recipient_email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">{getUserDisplayName(invitation.recipient) || invitation.recipient_email}</p>
                                <p className="text-sm text-muted-foreground">
                                  {invitation.access_level.replace('_', ' ')} access
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[invitation.status]?.className || ''}`}>
                                {invitation.status}
                              </span>
                              {invitation.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 gap-1"
                                  onClick={() => openCancelInvitationConfirm(invitation)}
                                >
                                  <XCircle className="h-3 w-3" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Access Requests Tab */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-600" />
                Access Requests to Your Account
              </h3>
              {accessRequests.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No pending access requests
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {accessRequests.map((request) => (
                    <Card key={request.invitation_id} className="overflow-hidden border-l-4 border-l-emerald-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold">
                              {getUserDisplayName(request.sender).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{getUserDisplayName(request.sender)}</p>
                              <p className="text-sm text-muted-foreground">{request.sender?.email}</p>
                              {request.message && (
                                <p className="text-sm text-muted-foreground mt-1 italic">&ldquo;{request.message}&rdquo;</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className="h-9 px-3 rounded-md border bg-background text-sm"
                              defaultValue="view_only"
                              id={`access-level-${request.invitation_id}`}
                            >
                              <option value="view_only">View Only</option>
                              <option value="limited">Limited</option>
                              <option value="full">Full Access</option>
                            </select>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => {
                                const select = document.getElementById(`access-level-${request.invitation_id}`) as HTMLSelectElement
                                handleRespondToAccessRequest(request, true, select.value as AccessLevel)
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Grant
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600"
                              onClick={() => handleRespondToAccessRequest(request, false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet-600" />
                Account Sharing Activity
              </h3>
              {activities.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No activity yet
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <Card key={activity.activity_id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${
                            activity.action_type === 'security' ? 'bg-red-500/10' :
                            activity.action_type === 'warning' ? 'bg-amber-500/10' :
                            'bg-sky-500/10'
                          }`}>
                            {activity.action_type === 'security' ? (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            ) : activity.action_type === 'warning' ? (
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Activity className="h-4 w-4 text-sky-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{activity.description}</p>
                            <p className="text-sm text-muted-foreground">
                              by {getUserDisplayName(activity.actor)} • {formatDate(activity.created_at)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-violet-600" />
                  Share Account Access
                </CardTitle>
                <CardDescription>
                  Invite someone to access your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Recipient</label>
                  <div className="relative">
                    <Input
                      placeholder="Search by email or name..."
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value)
                        setSelectedUser(null)
                        handleSearchUsers(e.target.value)
                      }}
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {searchResults.length > 0 && !selectedUser && (
                    <div className="mt-2 border rounded-md max-h-40 overflow-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.user_id}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                          onClick={() => {
                            setSelectedUser(user)
                            setInviteEmail(user.email)
                            setSearchResults([])
                          }}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                            {(user.full_name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.full_name || user.user_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUser && (
                    <div className="mt-2 p-2 bg-violet-500/10 rounded-md flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-semibold">
                          {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{selectedUser.full_name}</p>
                          <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(null)
                          setInviteEmail('')
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Access Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['view_only', 'limited', 'full'] as AccessLevel[]).map((level) => {
                      const config = ACCESS_LEVEL_BADGES[level]
                      const Icon = config.icon
                      return (
                        <button
                          key={level}
                          onClick={() => setInviteAccessLevel(level)}
                          className={`p-3 rounded-lg border-2 text-center transition-all ${
                            inviteAccessLevel === level
                              ? 'border-violet-500 bg-violet-500/10'
                              : 'border-border hover:border-violet-500/50'
                          }`}
                        >
                          <Icon className="h-5 w-5 mx-auto mb-1" />
                          <span className="text-xs font-medium">{config.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Message (optional)</label>
                  <textarea
                    className="w-full h-20 px-3 py-2 rounded-md border bg-background text-sm resize-none"
                    placeholder="Add a personal message..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteEmail('')
                      setInviteMessage('')
                      setSelectedUser(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600"
                    onClick={handleSendInvitation}
                    disabled={!inviteEmail || isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Invitation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Request Access Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                  Request Account Access
                </CardTitle>
                <CardDescription>
                  Request access to another user's account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Account Owner Email</label>
                  <Input
                    type="email"
                    placeholder="Enter email address..."
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Message (optional)</label>
                  <textarea
                    className="w-full h-20 px-3 py-2 rounded-md border bg-background text-sm resize-none"
                    placeholder="Explain why you need access..."
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowRequestModal(false)
                      setRequestEmail('')
                      setRequestMessage('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                    onClick={handleRequestAccess}
                    disabled={!requestEmail || isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirmation Dialog */}
        <ConfirmDialog
          open={confirmDialog.open}
          onClose={closeConfirmDialog}
          onConfirm={handleConfirmAction}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText={confirmDialog.confirmText}
          cancelText="Cancel"
          variant="destructive"
          successMessage={confirmDialog.successMessage}
          autoCloseOnSuccess={true}
          autoCloseDelay={1500}
          icon={
            confirmDialog.type === 'leave' ? <LogOut className="h-6 w-6 text-red-600" /> :
            confirmDialog.type === 'revoke' ? <Ban className="h-6 w-6 text-red-600" /> :
            <XCircle className="h-6 w-6 text-red-600" />
          }
        />
      </div>
    </MainLayout>
  )
}

