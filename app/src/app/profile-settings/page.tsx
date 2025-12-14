"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useTheme } from "@context/ThemeContext"
import { useI18n, useModuleI18n } from "@context/I18nContext"
import { useApiCall } from "@hooks/useApiCall"
import { useToast } from "@hooks/useToast"
import { profileService } from "@services/profile.service"
import { permissionService } from "@services/permission.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { MainLayout } from "@components/layout/MainLayout"
import { useAuthHook } from "@hooks/useAuth"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { MediaPicker } from "@components/media/MediaPicker"
import { getMediaDisplayUrl } from "@models/media.model"
import { formatDate, formatDateTime } from "@lib/utils/date-format"
import { 
  User, Mail, Phone, Globe, Calendar, Edit, Save, X, Camera, 
  CheckCircle2, XCircle, Shield, Lock, Image as ImageIcon,
  UserCircle, FileText, MapPin, Clock, Building2, RefreshCw,
  Moon, Sun, Monitor, Eye, EyeOff, Trash2, AlertTriangle, Palette,
  Bell, KeyRound, Smartphone, LogOut
} from "lucide-react"
import type { User as UserType, Group } from "@models/user.model"

type TabType = 
  | "personal" | "contact" | "photo" | "groups" | "permissions" | "additional"
  | "appearance" | "language" | "privacy" | "security" | "notifications" | "sessions" | "danger"

export default function ProfileSettingsPage() {
  return (
    <PageGuard requirePermission="view_profile">
      <ProfileSettingsContent />
    </PageGuard>
  )
}

function ProfileSettingsContent() {
  const router = useRouter()
  const { user: authUser, apiService, tokens, groups: cachedGroups, permissions: cachedPermissions, loading: authLoading } = useAuth()
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useI18n()
  const { showError, showSuccess } = useToast()
  const { t } = useModuleI18n("profile")
  const { t: tGeneral } = useModuleI18n("general")
  const [activeTab, setActiveTab] = useState<TabType>("personal")
  const [profile, setProfile] = useState<UserType | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    user_name: "",
    bio: "",
    country: "",
    gender: "",
  })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [timezone, setTimezone] = useState("UTC")
  const [profileAccessibility, setProfileAccessibility] = useState<"public" | "private">("public")
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [pending2FAValue, setPending2FAValue] = useState<boolean | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    enable_email_notification: true,
    enable_push_notification: true,
    enable_sms_notification: true,
    enable_login_notification: true,
    enable_security_alerts: true,
    enable_newsletter: true,
    enable_marketing_emails: true,
    enable_activity_digest: true,
    activity_digest_frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
  })
  
  // Consent settings
  const [consentSettings, setConsentSettings] = useState({
    data_collection_consent: false,
    marketing_consent: false,
  })
  
  // Session settings
  const [sessionSettings, setSessionSettings] = useState({
    max_sessions: 5,
    session_timeout: 3600,
  })
  
  // Password change state
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Set authenticated API service
  useEffect(() => {
    if (apiService) {
      profileService.setAuthApi(apiService)
      if (tokens) {
        const authHeaders: Record<string, string> = {}
        if (tokens.session_token) {
          authHeaders["X-Session-Token"] = tokens.session_token
        } else if (tokens.access_token && tokens.token_type) {
          authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`
        }
        if (Object.keys(authHeaders).length > 0) {
          const authenticatedApi = createPublicApiService(authHeaders)
          permissionService.setAuthApi(authenticatedApi)
        }
      }
    }
  }, [apiService, tokens])

  // Fetch profile - optimized with caching
  const fetchProfile = useApiCall(
    async () => {
      return await profileService.getProfile()
    },
    {
      onSuccess: (data) => {
        if (data) {
          setProfile(data as UserType)
          setFormData({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            user_name: data.user_name || "",
            bio: data.bio || "",
            country: data.country || "",
            gender: data.gender || "",
          })
          setTimezone(data.timezone || "UTC")
          const accessibility = data.profile_accessibility === "private" ? "private" : "public"
          setProfileAccessibility(accessibility)
          setTwoFactorEnabled((data as any).two_factor_enabled || false)
          
          // Load notification settings
          setNotificationSettings({
            enable_email_notification: (data as any).enable_email_notification ?? true,
            enable_push_notification: (data as any).enable_push_notification ?? true,
            enable_sms_notification: (data as any).enable_sms_notification ?? true,
            enable_login_notification: (data as any).enable_login_notification ?? true,
            enable_security_alerts: (data as any).enable_security_alerts ?? true,
            enable_newsletter: (data as any).enable_newsletter ?? true,
            enable_marketing_emails: (data as any).enable_marketing_emails ?? true,
            enable_activity_digest: (data as any).enable_activity_digest ?? true,
            activity_digest_frequency: (data as any).activity_digest_frequency || 'daily',
          })
          
          // Load consent settings
          setConsentSettings({
            data_collection_consent: (data as any).data_collection_consent ?? false,
            marketing_consent: (data as any).marketing_consent ?? false,
          })
          
          // Load session settings
          setSessionSettings({
            max_sessions: (data as any).max_sessions ?? 5,
            session_timeout: (data as any).session_timeout ?? 3600,
          })
        }
      },
      showErrorToast: true,
    }
  )

  // Load groups - use cached if available
  const loadGroups = useApiCall<Group[]>(
    async () => {
      if (cachedGroups && cachedGroups.length > 0) {
        return {
          success: true,
          message: 'Groups loaded from cache',
          data: cachedGroups,
        }
      }
      return await permissionService.getMyGroups()
    },
    {
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          setGroups(data)
        }
      },
      showErrorToast: true,
    }
  )

  // Load permissions - use cached if available
  const loadPermissions = useApiCall<string[]>(
    async () => {
      if (cachedPermissions && cachedPermissions.length > 0) {
        return {
          success: true,
          message: 'Permissions loaded from cache',
          data: cachedPermissions,
        }
      }
      return await permissionService.getMyPermissions()
    },
    {
      onSuccess: (data) => {
        if (data && Array.isArray(data)) {
          setPermissions(data)
        }
      },
      showErrorToast: true,
    }
  )

  // Force refresh all data from DB (bypassing cache)
  const refreshAllData = useCallback(async () => {
    if (!apiService || !tokens) return

    setIsRefreshing(true)
    try {
      const [profileResponse, groupsResponse, permissionsResponse] = await Promise.all([
        profileService.getProfile(true),
        permissionService.getMyGroups(true),
        permissionService.getMyPermissions(true),
      ])

      if (profileResponse?.success && profileResponse.data) {
        setProfile(profileResponse.data as UserType)
        setFormData({
          first_name: profileResponse.data.first_name || "",
          last_name: profileResponse.data.last_name || "",
          user_name: profileResponse.data.user_name || "",
          bio: profileResponse.data.bio || "",
          country: profileResponse.data.country || "",
          gender: profileResponse.data.gender || "",
        })
        setTimezone(profileResponse.data.timezone || "UTC")
        const accessibility = profileResponse.data.profile_accessibility === "private" ? "private" : "public"
        setProfileAccessibility(accessibility)
      }

      if (groupsResponse?.success && groupsResponse.data) {
        setGroups(Array.isArray(groupsResponse.data) ? groupsResponse.data : [])
      }

      if (permissionsResponse?.success && permissionsResponse.data) {
        setPermissions(Array.isArray(permissionsResponse.data) ? permissionsResponse.data : [])
      }

      showSuccess("Profile data refreshed successfully from database!")
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh data'
      showError(errorMessage)
    } finally {
      setIsRefreshing(false)
    }
  }, [apiService, tokens, showSuccess, showError])

  // Update profile
  const updateProfile = useApiCall(
    async () => {
      return await profileService.updateProfile(formData)
    },
    {
      onSuccess: (data) => {
        if (data) {
          const updatedProfile = data as UserType
          // Update profile state immediately without refetching
          setProfile(updatedProfile)
          // Update formData to match the updated profile
          setFormData({
            first_name: updatedProfile.first_name || "",
            last_name: updatedProfile.last_name || "",
            user_name: updatedProfile.user_name || "",
            bio: updatedProfile.bio || "",
            country: updatedProfile.country || "",
            gender: updatedProfile.gender || "",
          })
          // Update other state fields if they exist in the response
          if (updatedProfile.timezone) {
            setTimezone(updatedProfile.timezone)
          }
          if (updatedProfile.profile_accessibility) {
            setProfileAccessibility(updatedProfile.profile_accessibility === "private" ? "private" : "public")
          }
          setIsEditing(false)
          // Profile service already updates localStorage, so no need to refetch
          // This prevents page reload and unnecessary API calls
        }
      },
      successMessage: "Profile updated successfully!",
      showSuccessToast: true,
    }
  )

  // Upload profile picture
  const uploadProfilePicture = useCallback(async (file: File) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Image size must be less than 5MB')
      return
    }

    setIsUploading(true)
    try {
      const response = await profileService.updateProfilePicture(file)
      if (response?.success && response.data) {
        let profilePictureUrl: string | null = null
        
        if (typeof response.data === 'string') {
          profilePictureUrl = response.data
        } else if (typeof response.data === 'object') {
          if ('profile_picture_url' in response.data) {
            profilePictureUrl = (response.data as { profile_picture_url: string }).profile_picture_url
          } else if ('url' in response.data) {
            profilePictureUrl = (response.data as { url: string }).url
          } else if ('image_url' in response.data) {
            profilePictureUrl = (response.data as { image_url: string }).image_url
          }
        }
        
        if (profilePictureUrl) {
          setProfile(prev => prev ? {
            ...prev,
            profile_picture_url: profilePictureUrl
          } : null)
          setSelectedImage(null)
          setImagePreview(null)
          showSuccess("Profile picture updated successfully!")
        } else {
          showError(response.message || 'Failed to upload profile picture: Invalid response format')
        }
      } else {
        showError(response?.message || 'Failed to upload profile picture')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload profile picture'
      console.error('Profile picture upload error:', error)
      showError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }, [showError, showSuccess])

  // Update theme
  const updateTheme = useApiCall(
    async () => {
      return await profileService.updateTheme(theme as 'light' | 'dark' | 'dynamic')
    },
    {
      successMessage: "Theme updated successfully!",
      showSuccessToast: true,
    }
  )

  // Update language
  const updateLanguage = useApiCall(
    async () => {
      return await profileService.updateLanguage(lang)
    },
    {
      onSuccess: (data) => {
        // Update local profile state if language is in the response
        if (data && typeof data === 'object' && 'language' in data) {
          setProfile(prev => prev ? { ...prev, language: (data as any).language } : null)
        }
      },
      successMessage: "Language updated successfully!",
      showSuccessToast: true,
    }
  )

  // Update timezone
  const updateTimezoneCall = useApiCall(
    async () => {
      return await profileService.updateTimezone(timezone)
    },
    {
      onSuccess: (data) => {
        // Update local profile state if timezone is in the response
        if (data && typeof data === 'object' && 'timezone' in data) {
          setProfile(prev => prev ? { ...prev, timezone: (data as any).timezone } : null)
        }
      },
      successMessage: "Timezone updated successfully!",
      showSuccessToast: true,
    }
  )

  // Update profile accessibility
  const updateAccessibility = useApiCall(
    async () => {
      return await profileService.updateProfileAccessibility(profileAccessibility)
    },
    {
      onSuccess: (data) => {
        // Update local profile state if profile_accessibility is in the response
        if (data && typeof data === 'object' && 'profile_accessibility' in data) {
          const accessibility = (data as any).profile_accessibility
          setProfile(prev => prev ? { ...prev, profile_accessibility: accessibility } : null)
          setProfileAccessibility(accessibility === "private" ? "private" : "public")
        }
      },
      successMessage: "Privacy settings updated successfully!",
      showSuccessToast: true,
    }
  )

  // Update Notification Settings
  const updateNotificationSettings = useApiCall(
    async () => {
      const api = apiService || createPublicApiService()
      const response = await api.post<any>('/settings/update-profile', {
        ...notificationSettings,
        ...consentSettings,
      })
      return response as any
    },
    {
      onSuccess: (data: any) => {
        if (data && typeof data === 'object') {
          setProfile(prev => prev ? { ...prev, ...data } as UserType : null)
        }
      },
      successMessage: "Notification settings updated successfully!",
      showSuccessToast: true,
    }
  )

  // Fetch Sessions Data
  const fetchSessions = useApiCall(
    async () => {
      const api = apiService || createPublicApiService()
      const response = await api.get<any>('/settings/sessions')
      return response.data as any
    },
    {
      onSuccess: (data: any) => {
        if (data) {
          setProfile(prev => prev ? { 
            ...prev, 
            active_sessions: data.active_sessions || [],
            trusted_devices: data.trusted_devices || [],
            login_history: data.login_history || [],
            max_sessions: data.max_sessions || 5,
            session_timeout: data.session_timeout || 3600,
          } as UserType : null)
          setSessionSettings({
            max_sessions: data.max_sessions || 5,
            session_timeout: data.session_timeout || 3600,
          })
        }
      },
      showErrorToast: true,
    }
  )

  // Update Session Settings
  const updateSessionSettings = useApiCall(
    async () => {
      const api = apiService || createPublicApiService()
      const response = await api.post<any>('/settings/update-profile', {
        max_sessions: sessionSettings.max_sessions,
        session_timeout: sessionSettings.session_timeout,
      })
      return response as any
    },
    {
      onSuccess: (data: any) => {
        if (data && typeof data === 'object') {
          setProfile(prev => prev ? { ...prev, ...data } as UserType : null)
        }
        // Refresh sessions data
        fetchSessions.execute()
      },
      successMessage: "Session settings updated successfully!",
      showSuccessToast: true,
    }
  )

  // Revoke Session or Remove Device
  const [manageSessionLoading, setManageSessionLoading] = useState(false)
  
  const handleRevokeSession = async (sessionId: string) => {
    if (!apiService) return
    setManageSessionLoading(true)
    try {
      const response = await apiService.post<any>('/settings/sessions', {
        action: 'revoke_session',
        session_id: sessionId,
      })
      if (response?.data) {
        setProfile(prev => prev ? { 
          ...prev, 
          active_sessions: response.data.active_sessions || [],
          trusted_devices: response.data.trusted_devices || [],
        } as UserType : null)
      }
    } catch (error) {
      console.error('Error revoking session:', error)
    } finally {
      setManageSessionLoading(false)
    }
  }
  
  const handleRemoveDevice = async (deviceId: string) => {
    if (!apiService) return
    setManageSessionLoading(true)
    try {
      const response = await apiService.post<any>('/settings/sessions', {
        action: 'remove_device',
        device_id: deviceId,
      })
      if (response?.data) {
        setProfile(prev => prev ? { 
          ...prev, 
          active_sessions: response.data.active_sessions || [],
          trusted_devices: response.data.trusted_devices || [],
        } as UserType : null)
      }
    } catch (error) {
      console.error('Error removing device:', error)
    } finally {
      setManageSessionLoading(false)
    }
  }
  
  const handleRevokeAllSessions = async () => {
    if (!apiService) return
    setManageSessionLoading(true)
    try {
      const response = await apiService.post<any>('/settings/sessions', {
        action: 'revoke_all_sessions',
      })
      if (response?.data) {
        setProfile(prev => prev ? { 
          ...prev, 
          active_sessions: response.data.active_sessions || [],
          trusted_devices: response.data.trusted_devices || [],
        } as UserType : null)
      }
    } catch (error) {
      console.error('Error revoking all sessions:', error)
    } finally {
      setManageSessionLoading(false)
    }
  }

  // Update Two-Factor Authentication
  const update2FA = useApiCall(
    async () => {
      const enabled = pending2FAValue !== null ? pending2FAValue : twoFactorEnabled
      const api = apiService || createPublicApiService()
      const response = await api.post<any>('/settings/two-factor-auth', {
        enabled: enabled,
        method: 'email',
      })
      return response as any
    },
    {
      onSuccess: (data: any) => {
        // Update local profile state
        // useApiCall passes response.data directly, so data should be the serialized user object
        if (data && typeof data === 'object') {
          // Check if data has two_factor_enabled field - be explicit about boolean check
          const newEnabled = data.two_factor_enabled === true
          console.log('2FA Update Response:', { 
            data, 
            two_factor_enabled: data.two_factor_enabled,
            newEnabled, 
            pending2FAValue,
            type: typeof data.two_factor_enabled
          })
          
          // Only update if we got a valid response
          if (typeof data.two_factor_enabled === 'boolean') {
            setProfile(prev => prev ? { ...prev, two_factor_enabled: newEnabled } as UserType : null)
            setTwoFactorEnabled(newEnabled)
            setPending2FAValue(null)
          } else {
            // If field is missing, use pending value
            console.warn('two_factor_enabled field missing from response, using pending value')
            if (pending2FAValue !== null) {
              setTwoFactorEnabled(pending2FAValue)
              setProfile(prev => prev ? { ...prev, two_factor_enabled: pending2FAValue } as UserType : null)
              setPending2FAValue(null)
            }
          }
        } else {
          // If data structure is different, revert to pending value
          console.error('Unexpected data structure:', data)
          if (pending2FAValue !== null) {
            setTwoFactorEnabled(pending2FAValue)
            setPending2FAValue(null)
          }
        }
      },
      onError: () => {
        // Revert on error - restore previous state
        setTwoFactorEnabled(!pending2FAValue)
        setPending2FAValue(null)
      },
      successMessage: pending2FAValue !== null && pending2FAValue
        ? "Two-factor authentication enabled successfully!" 
        : "Two-factor authentication disabled successfully!",
      showSuccessToast: true,
    }
  )

  // Change Password
  const changePassword = useApiCall(
    async () => {
      if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
        throw new Error("All password fields are required")
      }
      if (passwordData.new_password !== passwordData.confirm_password) {
        throw new Error("New passwords do not match")
      }
      if (passwordData.new_password.length < 6) {
        throw new Error("Password must be at least 6 characters")
      }
      const api = apiService || createPublicApiService()
      const response = await api.post<any>('/auth/change-password', {
        old_password: passwordData.current_password,
        new_password: passwordData.new_password,
      })
      return response as any
    },
    {
      onSuccess: () => {
        setPasswordData({
          current_password: "",
          new_password: "",
          confirm_password: "",
        })
        setPasswordFormOpen(false)
        setShowCurrentPassword(false)
        setShowNewPassword(false)
        setShowConfirmPassword(false)
      },
      successMessage: "Password changed successfully!",
      showSuccessToast: true,
      showErrorToast: true,
    }
  )

  // Deactivate account
  const deactivateAccount = useApiCall(
    async () => {
      return await profileService.deactivateAccount()
    },
    {
      onSuccess: () => {
        router.push("/")
      },
      successMessage: "Account deactivated successfully",
      showSuccessToast: true,
    }
  )

  // Delete account
  const deleteAccount = useApiCall(
    async () => {
      return await profileService.deleteAccount()
    },
    {
      onSuccess: () => {
        router.push("/")
      },
      successMessage: "Account deleted successfully",
      showSuccessToast: true,
    }
  )

  // Track if initial load has been done to prevent unnecessary refetches
  const initialLoadDone = useRef(false)

  // Load profile from localStorage first, then API only if needed
  useEffect(() => {
    // Only run on initial mount or when auth state changes (not on every render)
    if (authUser && apiService && !initialLoadDone.current) {
      initialLoadDone.current = true
      
      // Try to load from localStorage first
      try {
        const cachedProfile = localStorage.getItem('user_profile')
        const timestamp = localStorage.getItem('user_profile_timestamp')
        
        if (cachedProfile && timestamp) {
          const cacheAge = Date.now() - parseInt(timestamp, 10)
          const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes
          
          if (cacheAge < CACHE_DURATION) {
            // Cache is valid, use it immediately
            const profileData = JSON.parse(cachedProfile) as UserType
            setProfile(profileData)
            setFormData({
              first_name: profileData.first_name || "",
              last_name: profileData.last_name || "",
              user_name: profileData.user_name || "",
              bio: profileData.bio || "",
              country: profileData.country || "",
              gender: profileData.gender || "",
            })
            setTimezone(profileData.timezone || "UTC")
            const accessibility = profileData.profile_accessibility === "private" ? "private" : "public"
            setProfileAccessibility(accessibility)
            
            // Only fetch from API if cache is about to expire (within 5 minutes)
            // This ensures we refresh before it expires
            if (cacheAge > (CACHE_DURATION - 5 * 60 * 1000)) {
              // Cache is getting old, refresh in background
              fetchProfile.execute().catch(() => {
                // Silently fail, we already have cached data
              })
            }
          } else {
            // Cache expired, fetch from API
            fetchProfile.execute().catch((error) => {
              console.error('Error loading profile data:', error)
            })
          }
        } else {
          // No cache, fetch from API
          fetchProfile.execute().catch((error) => {
            console.error('Error loading profile data:', error)
          })
        }
      } catch (error) {
        // Error reading cache, fetch from API
        console.error('Error reading profile cache:', error)
        fetchProfile.execute().catch((err) => {
          console.error('Error loading profile data:', err)
        })
      }
      
      // Load groups and permissions (these have their own caching)
      loadGroups.execute().catch(() => {})
      loadPermissions.execute().catch(() => {})
      
      // Load sessions data if on sessions tab
      if (activeTab === 'sessions') {
        fetchSessions.execute().catch(() => {})
      }
    } else if (!authLoading && !authUser) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, apiService, authLoading])

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    await updateProfile.execute()
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        user_name: profile.user_name || "",
        bio: profile.bio || "",
        country: profile.country || "",
        gender: profile.gender || "",
      })
    }
    setIsEditing(false)
  }

  // Handle tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam && ['personal', 'contact', 'photo', 'groups', 'permissions', 'additional', 'appearance', 'language', 'privacy', 'security', 'notifications', 'sessions', 'danger'].includes(tabParam)) {
      setActiveTab(tabParam as TabType)
      // Load sessions data when switching to sessions tab
      if (tabParam === 'sessions' && apiService) {
        fetchSessions.execute().catch(() => {})
      }
    }
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <div className="text-muted-foreground">{t("loading_profile")}</div>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return null
  }

  const profileTabs = [
    { id: "personal" as TabType, label: t("personal_information"), icon: UserCircle, section: t("profile") },
    { id: "contact" as TabType, label: t("contact_information"), icon: Mail, section: t("profile") },
    { id: "photo" as TabType, label: t("profile_picture"), icon: ImageIcon, section: t("profile") },
    { id: "groups" as TabType, label: t("groups"), icon: Shield, section: t("profile") },
    { id: "permissions" as TabType, label: t("permissions"), icon: Lock, section: t("profile") },
    { id: "additional" as TabType, label: t("additional_information"), icon: FileText, section: t("profile") },
  ]

  const settingsTabs = [
    { id: "appearance" as TabType, label: t("appearance"), icon: Palette, section: tGeneral("settings") },
    { id: "language" as TabType, label: t("language_region"), icon: Globe, section: tGeneral("settings") },
    { id: "privacy" as TabType, label: t("privacy"), icon: Lock, section: tGeneral("settings") },
    { id: "security" as TabType, label: "Security", icon: Shield, section: tGeneral("settings") },
    { id: "notifications" as TabType, label: "Notifications", icon: Mail, section: tGeneral("settings") },
    { id: "sessions" as TabType, label: "Sessions", icon: RefreshCw, section: tGeneral("settings") },
    { id: "danger" as TabType, label: t("danger_zone"), icon: AlertTriangle, section: tGeneral("settings") },
  ]

  return (
    <MainLayout
      title={t("profile_settings")}
      description={t("manage_profile_settings")}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-2 flex-shrink-0"
          onClick={refreshAllData}
          disabled={isRefreshing}
          loading={isRefreshing}
          loadingText={tGeneral("refreshing")}
        >
          <RefreshCw className="h-4 w-4" />
          {tGeneral("refresh")}
        </Button>
      }
    >
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Refined Design */}
        <aside className="w-60 border-r bg-card/30 backdrop-blur-sm">
          <div className="sticky top-0 p-4 h-screen overflow-y-auto">
            {/* Profile Preview Card */}
            <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-primary/20 border-2 border-primary/30 shadow-sm">
                    {profile?.profile_picture_url ? (
                      <img
                        src={profile.profile_picture_url}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-7 w-7 text-primary" />
                      </div>
                    )}
                  </div>
                  {profile?.is_active && (
                    <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background shadow-sm"></div>
                  )}
                </div>
                <div className="text-center w-full space-y-0.5">
                  <p className="font-medium text-sm leading-tight truncate">
                    {profile?.first_name || profile?.last_name
                      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
                      : profile?.user_name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate leading-tight">
                    {profile?.email || "No email"}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Section */}
            <div className="mb-5">
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-2.5 text-lg">
                {t("profile")}
              </h2>
              <nav className="space-y-1">
                {profileTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "scale-105" : ""}`} />
                      <span className="truncate text-left text-sm">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Settings Section */}
            <div>
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-2.5 text-lg">
                {tGeneral("settings")}
              </h2>
              <nav className="space-y-1">
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "scale-105" : ""}`} />
                      <span className="truncate text-left text-sm">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Main Content Area - Refined */}
        <div className="flex-1 container mx-auto px-5 py-5 max-w-5xl overflow-y-auto">
          {/* Tab Content - Refined Design */}
          <div className="animate-in fade-in-50 duration-300">
            {/* Personal Information Tab */}
            {activeTab === "personal" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium mb-1">Personal Information</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Your basic profile details
                      </CardDescription>
                    </div>
                    {!isEditing ? (
                      <Button 
                        onClick={() => setIsEditing(true)} 
                        className="gap-2 flex-shrink-0" 
                        size="sm" 
                        variant="default"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button variant="outline" onClick={handleCancel} className="gap-2" size="sm">
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={updateProfile.loading}
                          loading={updateProfile.loading}
                          loadingText="Saving..."
                          className="gap-2"
                          size="sm"
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        First Name
                      </label>
                      {isEditing ? (
                        <Input
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          placeholder="Enter first name"
                          className="h-10"
                        />
                      ) : (
                        <div className="min-h-[40px] px-3 py-2 rounded-md bg-muted/50 flex items-center">
                          <p className="text-sm text-foreground">
                            {profile?.first_name || <span className="text-muted-foreground italic">Not set</span>}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        Last Name
                      </label>
                      {isEditing ? (
                        <Input
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          placeholder="Enter last name"
                          className="h-10"
                        />
                      ) : (
                        <div className="min-h-[40px] px-3 py-2 rounded-md bg-muted/50 flex items-center">
                          <p className="text-sm text-foreground">
                            {profile?.last_name || <span className="text-muted-foreground italic">Not set</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-md font-medium flex items-center gap-2 text-foreground">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Username
                    </label>
                    {isEditing ? (
                      <Input
                        value={formData.user_name}
                        onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                        placeholder="Enter username"
                        className="h-10 font-mono"
                      />
                    ) : (
                      <div className="min-h-[40px] px-3 py-2 rounded-md bg-muted/50 flex items-center">
                        <p className="text-sm text-foreground font-mono">
                          {profile?.user_name || <span className="text-muted-foreground italic">Not set</span>}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-md font-medium flex items-center gap-2 text-foreground">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Bio
                    </label>
                    {isEditing ? (
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm min-h-[110px] resize-none transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        placeholder="Tell us about yourself..."
                      />
                    ) : (
                      <div className="min-h-[110px] px-3 py-2.5 rounded-md bg-muted/50 flex items-start">
                        <p className="text-sm text-foreground leading-relaxed">
                          {profile?.bio || <span className="text-muted-foreground italic">No bio added</span>}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Details Tab */}
            {activeTab === "contact" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Contact Information</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Your email and phone details
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {profile?.email || "No email"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Email address</p>
                      </div>
                    </div>
                    {profile?.is_email_verified ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex-shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 flex-shrink-0">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Not verified</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {profile?.phone_number ? (typeof profile.phone_number === 'object' 
                            ? `${profile.phone_number.country_code || ''} ${profile.phone_number.phone || ''}`.trim()
                            : String(profile.phone_number)) : "No phone"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Phone number</p>
                      </div>
                    </div>
                    {profile?.is_phone_verified ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex-shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 flex-shrink-0">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Not verified</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Profile Photo Tab */}
            {activeTab === "photo" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Profile Picture</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Upload or change your profile picture
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative group">
                      <div className="h-44 w-44 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-3 border-primary/30 shadow-lg ring-2 ring-primary/10 transition-all duration-200 group-hover:scale-105">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />
                        ) : profile?.profile_picture_url ? (
                          <img
                            src={profile.profile_picture_url}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <User className="h-24 w-24 text-primary/50" />
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-2 right-2 p-2.5 bg-background rounded-full border-2 border-background shadow-lg">
                        <Camera className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-4 max-w-md w-full">
                      <div className="flex gap-2 w-full">
                        <Button 
                          variant="outline" 
                          className="gap-2 flex-1" 
                          size="default"
                          onClick={() => setMediaPickerOpen(true)}
                          type="button"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Select from Library
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          id="profile-picture-input"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <Button 
                          variant="outline" 
                          className="gap-2 flex-1" 
                          size="default"
                          onClick={() => fileInputRef.current?.click()}
                          type="button"
                        >
                          <Camera className="h-4 w-4" />
                          Upload New
                        </Button>
                      </div>
                      {selectedImage && (
                        <div className="flex gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedImage(null)
                              setImagePreview(null)
                            }}
                            disabled={isUploading}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => selectedImage && uploadProfilePicture(selectedImage)}
                            disabled={isUploading}
                            loading={isUploading}
                            loadingText="Uploading..."
                          >
                            <Camera className="h-4 w-4" />
                            Upload
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-sm">
                        JPG, PNG or GIF. Max size 5MB. Square image (1:1) recommended for best results.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Groups Tab */}
            {activeTab === "groups" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">My Groups</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Groups you belong to and their permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  {loadGroups.loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-7 w-7 animate-spin rounded-full border-3 border-primary border-t-transparent"></div>
                        <div className="text-sm text-muted-foreground">Loading groups...</div>
                      </div>
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Shield className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">No groups assigned</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {groups.map((group) => (
                        <div key={group.group_id} className="p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                              <Shield className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm text-foreground mb-1">{group.name}</h3>
                              <p className="text-xs text-muted-foreground font-mono">{group.codename}</p>
                            </div>
                          </div>
                          {group.description && (
                            <p className="text-xs text-foreground mb-3 line-clamp-2 leading-relaxed">{group.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {group.is_system && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                System
                              </span>
                            )}
                            {group.is_active !== false ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium">
                                Active
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Permissions Tab */}
            {activeTab === "permissions" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">My Permissions</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    All permissions you have access to
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  {loadPermissions.loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-7 w-7 animate-spin rounded-full border-3 border-primary border-t-transparent"></div>
                        <div className="text-sm text-muted-foreground">Loading permissions...</div>
                      </div>
                    </div>
                  ) : permissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Lock className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">No permissions assigned</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {permissions.map((permission, index) => (
                        <div key={index} className="p-3 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20 flex items-center gap-2.5">
                          <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
                            <Lock className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-xs font-mono truncate text-foreground">{permission}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Additional Info Tab */}
            {activeTab === "additional" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Additional Information</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Additional profile details and account information
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Country</p>
                        <p className="text-sm font-medium text-foreground">{profile?.country || "Not set"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Gender</p>
                        <p className="text-sm font-medium text-foreground capitalize">{profile?.gender || "Not set"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">User Type</p>
                        <p className="text-sm font-medium text-foreground capitalize">{profile?.user_type || "Not set"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Member Since</p>
                        <p className="text-sm font-medium text-foreground">
                          {profile?.created_at ? formatDate(profile.created_at) : "Unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Last Updated</p>
                        <p className="text-sm font-medium text-foreground">
                          {profile?.last_updated ? formatDateTime(profile.last_updated) : "Unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Language</p>
                        <p className="text-sm font-medium text-foreground uppercase">{profile?.language || "Not set"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Appearance</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Customize the look and feel of your interface
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <div className="space-y-5">
                    <div>
                      <label className="mb-3 block text-sm font-medium flex items-center gap-2 text-foreground">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        Theme
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        <button
                          onClick={() => {
                            setTheme("light")
                            updateTheme.execute()
                          }}
                          disabled={updateTheme.loading}
                          className={`flex flex-col items-center gap-2.5 rounded-lg border-2 p-5 transition-all duration-200 ${
                            theme === "light"
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <Sun className={`h-7 w-7 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${theme === "light" ? "text-primary" : "text-foreground"}`}>Light</span>
                        </button>
                        <button
                          onClick={() => {
                            setTheme("dark")
                            updateTheme.execute()
                          }}
                          disabled={updateTheme.loading}
                          className={`flex flex-col items-center gap-2.5 rounded-lg border-2 p-5 transition-all duration-200 ${
                            theme === "dark"
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <Moon className={`h-7 w-7 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${theme === "dark" ? "text-primary" : "text-foreground"}`}>Dark</span>
                        </button>
                        <button
                          onClick={() => {
                            setTheme("dynamic")
                            updateTheme.execute()
                          }}
                          disabled={updateTheme.loading}
                          className={`flex flex-col items-center gap-2.5 rounded-lg border-2 p-5 transition-all duration-200 ${
                            theme === "dynamic"
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <Monitor className={`h-7 w-7 ${theme === "dynamic" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${theme === "dynamic" ? "text-primary" : "text-foreground"}`}>System</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Language & Region Tab */}
            {activeTab === "language" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Language & Region</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Set your preferred language and timezone
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">
                  <div className="space-y-2">
                    <label className="text-md font-medium flex items-center gap-2 text-foreground">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Language
                    </label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm h-10 transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      value={lang}
                      onChange={(e) => {
                        const value = e.target.value === "ar" ? "ar" : "en"
                        setLang(value)
                        updateLanguage.execute()
                      }}
                      disabled={updateLanguage.loading}
                    >
                      <option value="en">English (LTR)</option>
                      <option value="ar">Arabic (RTL)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-md font-medium flex items-center gap-2 text-foreground">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Timezone
                    </label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm h-10 transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      value={timezone}
                      onChange={(e) => {
                        setTimezone(e.target.value)
                        updateTimezoneCall.execute()
                      }}
                      disabled={updateTimezoneCall.loading}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                      <option value="Asia/Dubai">Dubai (GST)</option>
                      <option value="Asia/Kolkata">Mumbai (IST)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Privacy Tab */}
            {activeTab === "privacy" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Privacy</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Control who can see your profile and manage your privacy settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                          {profileAccessibility === "public" ? (
                            <Eye className="h-4 w-4 text-primary" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground mb-1">Profile Visibility</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {profileAccessibility === "public"
                              ? "Your profile is visible to everyone"
                              : "Your profile is private"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant={profileAccessibility === "public" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setProfileAccessibility("public")
                            updateAccessibility.execute()
                          }}
                          disabled={updateAccessibility.loading}
                          loading={updateAccessibility.loading}
                        >
                          Public
                        </Button>
                        <Button
                          variant={profileAccessibility === "private" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setProfileAccessibility("private")
                            updateAccessibility.execute()
                          }}
                          disabled={updateAccessibility.loading}
                          loading={updateAccessibility.loading}
                        >
                          Private
                        </Button>
                      </div>
                    </div>
                    
                    {/* Data Collection Consent */}
                    <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground mb-1">Data Collection Consent</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Allow us to collect and use your data for service improvement
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !consentSettings.data_collection_consent
                            setConsentSettings(prev => ({ ...prev, data_collection_consent: newValue }))
                            updateNotificationSettings.execute()
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                            consentSettings.data_collection_consent ? 'bg-primary' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              consentSettings.data_collection_consent ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    
                    {/* Marketing Consent */}
                    <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground mb-1">Marketing Consent</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Receive marketing emails and promotional content
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !consentSettings.marketing_consent
                            setConsentSettings(prev => ({ ...prev, marketing_consent: newValue }))
                            updateNotificationSettings.execute()
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                            consentSettings.marketing_consent ? 'bg-primary' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              consentSettings.marketing_consent ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Security</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Manage your account security settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {/* Two-Factor Authentication */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Two-Factor Authentication</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {twoFactorEnabled
                            ? "Add an extra layer of security to your account"
                            : "Enable two-factor authentication for enhanced security"}
                        </p>
                        {twoFactorEnabled && (profile as any)?.two_factor_method && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Method: {(profile as any).two_factor_method}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !twoFactorEnabled
                          setPending2FAValue(newValue)
                          setTwoFactorEnabled(newValue)
                          update2FA.execute()
                        }}
                        disabled={update2FA.loading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          twoFactorEnabled ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Change Password */}
                  <div className="p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <KeyRound className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground mb-1">Change Password</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Update your password to keep your account secure
                          </p>
                          {(profile as any)?.last_password_changed && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last changed: {formatDate((profile as any).last_password_changed)}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPasswordFormOpen(!passwordFormOpen)}
                        className="flex-shrink-0"
                      >
                        {passwordFormOpen ? (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Edit className="h-4 w-4 mr-1" />
                            Change
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Password Change Form */}
                    {passwordFormOpen && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {/* Current Password */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Current Password
                          </label>
                          <div className="relative">
                            <Input
                              type={showCurrentPassword ? "text" : "password"}
                              value={passwordData.current_password}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                              placeholder="Enter current password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        
                        {/* New Password */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            New Password
                          </label>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? "text" : "password"}
                              value={passwordData.new_password}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                              placeholder="Enter new password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Password must be at least 6 characters
                          </p>
                        </div>
                        
                        {/* Confirm New Password */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              value={passwordData.confirm_password}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                              placeholder="Confirm new password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {passwordData.new_password && passwordData.confirm_password && 
                            passwordData.new_password !== passwordData.confirm_password && (
                            <p className="text-xs text-red-500">Passwords do not match</p>
                          )}
                        </div>
                        
                        {/* Submit Button */}
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPasswordFormOpen(false)
                              setPasswordData({
                                current_password: "",
                                new_password: "",
                                confirm_password: "",
                              })
                              setShowCurrentPassword(false)
                              setShowNewPassword(false)
                              setShowConfirmPassword(false)
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => changePassword.execute()}
                            disabled={
                              changePassword.loading ||
                              !passwordData.current_password ||
                              !passwordData.new_password ||
                              !passwordData.confirm_password ||
                              passwordData.new_password !== passwordData.confirm_password ||
                              passwordData.new_password.length < 6
                            }
                            loading={changePassword.loading}
                            loadingText="Changing..."
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Change Password
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email Verification Status */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Email Verification</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {profile?.email || "No email"}
                        </p>
                        {(profile as any)?.email_verified_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Verified: {formatDate((profile as any).email_verified_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    {(profile as any)?.is_email_verified ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex-shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 flex-shrink-0">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Not verified</span>
                      </div>
                    )}
                  </div>

                  {/* Phone Verification Status */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Phone Verification</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {profile?.phone_number 
                            ? (typeof profile.phone_number === 'object' 
                                ? `${profile.phone_number.country_code || ''} ${profile.phone_number.phone || ''}`.trim()
                                : String(profile.phone_number))
                            : "No phone number"}
                        </p>
                        {(profile as any)?.phone_number_verified_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Verified: {formatDate((profile as any).phone_number_verified_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    {(profile as any)?.is_phone_verified ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex-shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 flex-shrink-0">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Not verified</span>
                      </div>
                    )}
                  </div>

                  {/* Account Status */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Account Status</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {(profile as any)?.account_status || "Active"}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {(profile as any)?.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                              Active
                            </span>
                          )}
                          {(profile as any)?.is_verified && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                              Verified
                            </span>
                          )}
                          {(profile as any)?.is_profile_completed && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                              Profile Complete
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Last Login */}
                  {(profile as any)?.last_login && (
                    <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground mb-1">Last Login</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {formatDateTime((profile as any).last_login)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Notifications</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Manage your notification preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {/* Email Notifications */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Email Notifications</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Receive notifications via email
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_email_notification
                          setNotificationSettings(prev => ({ ...prev, enable_email_notification: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_email_notification ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_email_notification ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Push Notifications */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Push Notifications</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Receive push notifications on your device
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_push_notification
                          setNotificationSettings(prev => ({ ...prev, enable_push_notification: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_push_notification ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_push_notification ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* SMS Notifications */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Smartphone className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">SMS Notifications</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Receive notifications via SMS
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_sms_notification
                          setNotificationSettings(prev => ({ ...prev, enable_sms_notification: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_sms_notification ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_sms_notification ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Login Notifications */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <KeyRound className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Login Notifications</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Get notified when someone logs into your account
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_login_notification
                          setNotificationSettings(prev => ({ ...prev, enable_login_notification: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_login_notification ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_login_notification ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Security Alerts */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Security Alerts</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Receive alerts about security-related activities
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_security_alerts
                          setNotificationSettings(prev => ({ ...prev, enable_security_alerts: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_security_alerts ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_security_alerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Newsletter */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Newsletter</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Subscribe to our newsletter for updates
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_newsletter
                          setNotificationSettings(prev => ({ ...prev, enable_newsletter: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_newsletter ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_newsletter ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Marketing Emails */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Marketing Emails</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Receive marketing and promotional emails
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_marketing_emails
                          setNotificationSettings(prev => ({ ...prev, enable_marketing_emails: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_marketing_emails ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_marketing_emails ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Activity Digest */}
                  <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 transition-all hover:shadow-sm hover:border-primary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Activity Digest</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Receive periodic summaries of your account activity
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const newValue = !notificationSettings.enable_activity_digest
                          setNotificationSettings(prev => ({ ...prev, enable_activity_digest: newValue }))
                          updateNotificationSettings.execute()
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          notificationSettings.enable_activity_digest ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notificationSettings.enable_activity_digest ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Activity Digest Frequency */}
                  {notificationSettings.enable_activity_digest && (
                    <div className="p-4 rounded-lg border bg-card/50">
                      <label className="text-sm font-medium text-foreground mb-2 block">Digest Frequency</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-10"
                        value={notificationSettings.activity_digest_frequency}
                        onChange={(e) => {
                          setNotificationSettings(prev => ({ 
                            ...prev, 
                            activity_digest_frequency: e.target.value as 'daily' | 'weekly' | 'monthly'
                          }))
                          updateNotificationSettings.execute()
                        }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
              <Card className="shadow-sm border transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
                  <CardTitle className="text-lg font-semibold mb-1">Active Sessions</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Manage your active sessions and devices
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {/* Session Settings */}
                  <div className="space-y-4 mb-6">
                    <div className="p-4 rounded-lg border bg-card/50">
                      <label className="text-sm font-medium text-foreground mb-2 block">Max Sessions</label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={sessionSettings.max_sessions}
                        onChange={(e) => {
                          setSessionSettings(prev => ({ 
                            ...prev, 
                            max_sessions: parseInt(e.target.value) || 5
                          }))
                        }}
                        onBlur={() => updateSessionSettings.execute()}
                        className="w-full"
                        disabled={updateSessionSettings.loading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum number of concurrent sessions allowed
                      </p>
                    </div>

                    <div className="p-4 rounded-lg border bg-card/50">
                      <label className="text-sm font-medium text-foreground mb-2 block">Session Timeout (seconds)</label>
                      <Input
                        type="number"
                        min="300"
                        max="86400"
                        value={sessionSettings.session_timeout}
                        onChange={(e) => {
                          setSessionSettings(prev => ({ 
                            ...prev, 
                            session_timeout: parseInt(e.target.value) || 3600
                          }))
                        }}
                        onBlur={() => updateSessionSettings.execute()}
                        className="w-full"
                        disabled={updateSessionSettings.loading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Time before session expires (300-86400 seconds)
                      </p>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRevokeAllSessions}
                        loading={manageSessionLoading}
                        disabled={manageSessionLoading}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Revoke All Sessions
                      </Button>
                    </div>
                  </div>

                  {/* Active Sessions List */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Active Sessions</h3>
                    {(profile as any)?.active_sessions && Array.isArray((profile as any).active_sessions) && (profile as any).active_sessions.length > 0 ? (
                      <div className="space-y-2">
                        {(profile as any).active_sessions.map((session: any, index: number) => {
                          const isTrusted = (profile as any)?.trusted_devices?.some(
                            (device: any) => 
                              device.ip_address === session.ip_address && 
                              device.user_agent === session.user_agent
                          )
                          return (
                            <div key={index} className="p-3 rounded-lg border bg-card/50 flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {session.device || session.user_agent || "Unknown Device"}
                                    </p>
                                    {isTrusted && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                                        Trusted
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {session.ip_address || "Unknown IP"} • {session.created_at ? formatDateTime(session.created_at) : "Unknown time"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {!isTrusted && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={async () => {
                                      if (!apiService) return
                                      setManageSessionLoading(true)
                                      try {
                                        const response = await apiService.post<any>('/settings/sessions', {
                                          action: 'add_trusted_device',
                                          mark_as_trusted: {
                                            device_id: session.session_id || session.id,
                                            ip_address: session.ip_address,
                                            user_agent: session.user_agent,
                                            device: session.device,
                                            browser: session.browser,
                                            os: session.os,
                                          },
                                        })
                                        if (response?.data) {
                                          setProfile(prev => prev ? { 
                                            ...prev, 
                                            trusted_devices: response.data.trusted_devices || [],
                                          } as UserType : null)
                                        }
                                      } catch (error) {
                                        console.error('Error adding trusted device:', error)
                                      } finally {
                                        setManageSessionLoading(false)
                                      }
                                    }}
                                    loading={manageSessionLoading}
                                    disabled={manageSessionLoading}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Trust
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleRevokeSession(session.session_id || session.id)}
                                  loading={manageSessionLoading}
                                  disabled={manageSessionLoading}
                                >
                                  <LogOut className="h-4 w-4 mr-2" />
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border bg-card/50 text-center">
                        <p className="text-sm text-muted-foreground">No active sessions</p>
                      </div>
                    )}
                  </div>

                  {/* Trusted Devices */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Trusted Devices</h3>
                    {(profile as any)?.trusted_devices && Array.isArray((profile as any).trusted_devices) && (profile as any).trusted_devices.length > 0 ? (
                      <div className="space-y-2">
                        {(profile as any).trusted_devices.map((device: any, index: number) => (
                          <div key={index} className="p-3 rounded-lg border bg-card/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Smartphone className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {device.device || device.user_agent || "Unknown Device"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {device.ip_address || "Unknown IP"} • {device.created_at ? formatDateTime(device.created_at) : "Unknown time"}
                                </p>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleRemoveDevice(device.device_id || device.id)}
                              loading={manageSessionLoading}
                              disabled={manageSessionLoading}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border bg-card/50 text-center">
                        <p className="text-sm text-muted-foreground">No trusted devices</p>
                      </div>
                    )}
                  </div>

                  {/* Login History */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Recent Login History</h3>
                    {(profile as any)?.login_history && Array.isArray((profile as any).login_history) && (profile as any).login_history.length > 0 ? (
                      <div className="space-y-2">
                        {(profile as any).login_history.slice(0, 5).map((login: any, index: number) => (
                          <div key={index} className="p-3 rounded-lg border bg-card/50">
                            <div className="flex items-center gap-3">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {login.ip_address || "Unknown IP"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {login.device || login.user_agent || "Unknown Device"} • {login.created_at ? formatDateTime(login.created_at) : "Unknown time"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border bg-card/50 text-center">
                        <p className="text-sm text-muted-foreground">No login history</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Danger Zone Tab */}
            {activeTab === "danger" && (
              <Card className="shadow-sm border border-destructive/50 transition-all duration-200 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-destructive/5 to-transparent border-b border-destructive/50 py-4">
                  <CardTitle className="text-sm font-medium text-destructive mb-1">Danger Zone</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4 transition-all hover:shadow-sm hover:border-destructive/70">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-destructive/10 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Deactivate Account</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Temporarily disable your account. You can reactivate it later.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => setDeactivateDialogOpen(true)}
                      disabled={deactivateAccount.loading}
                    >
                      Deactivate
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4 transition-all hover:shadow-sm hover:border-destructive/70">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-destructive/10 flex-shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground mb-1">Delete Account</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={deleteAccount.loading}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Deactivate Account Confirmation Dialog */}
      <ConfirmDialog
        open={deactivateDialogOpen}
        onClose={() => setDeactivateDialogOpen(false)}
        onConfirm={async () => {
          await deactivateAccount.execute()
          setDeactivateDialogOpen(false)
        }}
        title="Deactivate Account"
        description="Are you sure you want to deactivate your account? You can reactivate it later."
        confirmText="Yes, Deactivate"
        cancelText="Cancel"
        variant="default"
        successMessage="Account deactivated successfully!"
        errorMessage="Failed to deactivate account. Please try again."
        autoCloseOnSuccess={true}
        autoCloseDelay={2000}
      />

      {/* Delete Account Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={async () => {
          await deleteAccount.execute()
          setDeleteDialogOpen(false)
        }}
        title="Delete Account"
        description="Are you absolutely sure? This will permanently delete your account and all data. This action cannot be undone."
        confirmText="Yes, Delete Account"
        cancelText="Cancel"
        variant="destructive"
        successMessage="Account deleted successfully!"
        errorMessage="Failed to delete account. Please try again."
        autoCloseOnSuccess={true}
        autoCloseDelay={2000}
      />

      {/* Media Picker */}
      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={async (media) => {
          if (typeof media === 'string') {
            // URL selected
            const url = media
            setProfile(prev => prev ? {
              ...prev,
              profile_picture_url: url
            } : null)
            setImagePreview(null)
            setSelectedImage(null)
            // Update via API
            try {
              const response = await profileService.updateProfile({ profile_picture_url: url })
              if (response?.success) {
                showSuccess("Profile picture updated successfully!")
              }
            } catch (error) {
              showError('Failed to update profile picture')
            }
          } else {
            // Media object selected
            const url = getMediaDisplayUrl(media) || media.public_url || ''
            if (url) {
              setProfile(prev => prev ? {
                ...prev,
                profile_picture_url: url
              } : null)
              setImagePreview(null)
              setSelectedImage(null)
              // Update via API
              try {
                const response = await profileService.updateProfile({ profile_picture_url: url })
                if (response?.success) {
                  showSuccess("Profile picture updated successfully!")
                }
              } catch (error) {
                showError('Failed to update profile picture')
              }
            }
          }
          setMediaPickerOpen(false)
        }}
        mode="image"
        title="Select Profile Picture"
        description="Choose a profile picture from your media library or upload a new one"
        allowUrl={true}
        allowUpload={true}
      />
    </MainLayout>
  )
}

