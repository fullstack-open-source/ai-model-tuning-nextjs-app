"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useApiCall } from "@hooks/useApiCall"
import { useToast } from "@hooks/useToast"
import { projectService } from "@services/project.service"
import { createPublicApiService } from "@lib/api/ApiServiceFactory"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { MediaPicker } from "@components/media/MediaPicker"
import { getMediaDisplayUrl } from "@models/media.model"
import {
  Building2, Info, Mail, Phone, Image as ImageIcon, Share2, Search,
  Save, RefreshCw, Globe, MapPin, Facebook, Twitter, Instagram, Linkedin,
  Youtube, MessageCircle, Music, Camera, FileText
} from "lucide-react"
import type { ProjectInformation, ProjectInformationUpdate } from "@models/project.model"

type TabType = "general" | "contact" | "logos" | "social" | "seo"

export default function ProjectSettingsPage() {
  return (
    <PageGuard requireAnyPermission={["manage_project_settings", "view_project_settings"]}>
      <ProjectSettingsContent />
    </PageGuard>
  )
}

function ProjectSettingsContent() {
  const router = useRouter()
  const { user: authUser, apiService, tokens, loading: authLoading } = useAuth()
  const { showError, showSuccess } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>("general")
  const [projectInfo, setProjectInfo] = useState<ProjectInformation | null>(null)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [currentLogoField, setCurrentLogoField] = useState<'logo' | 'hlogo' | 'flogo' | null>(null)

  // Form state
  const [formData, setFormData] = useState<ProjectInformationUpdate>({
    name: "",
    title: "",
    baseURL: "",
    support_mail: "",
    support_contact: "",
    company_address: "",
    hlogo: "",
    flogo: "",
    logo: "",
    facebook: "",
    vimeo: "",
    youtube: "",
    linkedin: "",
    pintrest: "",
    twitter: "",
    instagram: "",
    tiktok: "",
    whatsapp: "",
    head_meta_data: "",
    body_meta_data: "",
    extra_meta_data: "",
    meta_title: "",
    meta_keywords: "",
    meta_description: "",
    project_id: "",
  })

  // Set authenticated API service
  useEffect(() => {
    if (apiService) {
      projectService.setAuthApi(apiService)
    } else if (tokens) {
      const authHeaders: Record<string, string> = {}
      if (tokens.session_token) {
        authHeaders["X-Session-Token"] = tokens.session_token
      } else if (tokens.access_token && tokens.token_type) {
        authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`
      }
      if (Object.keys(authHeaders).length > 0) {
        const authenticatedApi = createPublicApiService(authHeaders)
        projectService.setAuthApi(authenticatedApi)
      }
    }
  }, [apiService, tokens])

  // Helper to update form data from project info
  const updateFormDataFromProjectInfo = (data: ProjectInformation) => {
    setProjectInfo(data)
    setFormData({
      name: data.name || "",
      title: data.title || "",
      baseURL: data.baseURL || "",
      support_mail: data.support_mail || "",
      support_contact: data.support_contact || "",
      company_address: data.company_address || "",
      hlogo: data.hlogo || "",
      flogo: data.flogo || "",
      logo: data.logo || "",
      facebook: data.facebook || "",
      vimeo: data.vimeo || "",
      youtube: data.youtube || "",
      linkedin: data.linkedin || "",
      pintrest: data.pintrest || "",
      twitter: data.twitter || "",
      instagram: data.instagram || "",
      tiktok: data.tiktok || "",
      whatsapp: data.whatsapp || "",
      head_meta_data: data.head_meta_data || "",
      body_meta_data: data.body_meta_data || "",
      extra_meta_data: data.extra_meta_data || "",
      meta_title: data.meta_title || "",
      meta_keywords: data.meta_keywords || "",
      meta_description: data.meta_description || "",
      project_id: data.project_id || "",
    })
  }

  // Fetch from API (middleware handles caching automatically)
  const fetchProjectInfo = useApiCall(
    async () => {
      return await projectService.getProjectInformation()
    },
    {
      onSuccess: (data: any) => {
        // API returns { project: {...} } structure
        const projectData = data?.project || data
        if (projectData) {
          console.log("📦 Project data loaded:", projectData)
          updateFormDataFromProjectInfo(projectData as ProjectInformation)
        }
      },
      showErrorToast: true,
    }
  )

  // Update project information
  const updateProjectInfo = useApiCall(
    async () => {
      return await projectService.updateProjectInformation(formData)
    },
    {
      onSuccess: (data: any) => {
        // API returns { project: {...} } structure
        const projectData = data?.project || data
        if (projectData) {
          console.log("📦 Project data updated:", projectData)
          setProjectInfo(projectData as ProjectInformation)
          updateFormDataFromProjectInfo(projectData as ProjectInformation)
          showSuccess("Project settings updated successfully! Meta tags have been applied.")
          // Reload page to apply meta tags
          setTimeout(() => {
            window.location.reload()
          }, 1500)
        }
      },
      successMessage: "Project settings updated successfully!",
      showSuccessToast: true,
    }
  )

  // Load project info on mount (middleware handles caching)
  useEffect(() => {
    if (authUser && apiService) {
      fetchProjectInfo.execute()
    } else if (!authLoading && !authUser) {
      router.push("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, apiService, authLoading])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <div className="text-muted-foreground">Loading project settings...</div>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return null
  }

  const tabs = [
    { id: "general" as TabType, label: "General Information", icon: Info },
    { id: "contact" as TabType, label: "Contact & Support", icon: Mail },
    { id: "logos" as TabType, label: "Logos", icon: ImageIcon },
    { id: "social" as TabType, label: "Social Media", icon: Share2 },
    { id: "seo" as TabType, label: "SEO & Meta", icon: Search },
  ]

  return (
    <MainLayout
      title="Project Settings"
      description="Configure project settings and preferences"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fetchProjectInfo.execute()}
          disabled={fetchProjectInfo.loading}
          loading={fetchProjectInfo.loading}
          loadingText="Refreshing..."
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Tabs */}
        <aside className="w-64 border-r bg-gradient-to-b from-card to-card/95 backdrop-blur-sm">
          <div className="sticky top-0 p-4 h-screen overflow-y-auto">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground mb-2">Project Settings</h1>
              <p className="text-sm text-muted-foreground">Manage project configuration</p>
            </div>

            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 container mx-auto px-6 py-8 max-w-5xl overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {tabs.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-muted-foreground">
              {activeTab === "general" && "Configure basic project information"}
              {activeTab === "contact" && "Set up contact and support details"}
              {activeTab === "logos" && "Upload and manage project logos"}
              {activeTab === "social" && "Configure social media links"}
              {activeTab === "seo" && "Manage SEO and meta data"}
            </p>
          </div>

          {fetchProjectInfo.loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                <div className="text-muted-foreground">Loading project settings...</div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                updateProjectInfo.execute()
              }}
              className="space-y-6"
            >
              {/* General Information Tab */}
              {activeTab === "general" && (
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      General Information
                    </CardTitle>
                    <CardDescription>Basic project details and configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Project Name</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Project Name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Project Title</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Project Title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Base URL</label>
                      <Input
                        value={formData.baseURL}
                        onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Project ID</label>
                      <Input
                        value={formData.project_id}
                        onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                        placeholder="project-id"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact & Support Tab */}
              {activeTab === "contact" && (
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact & Support
                    </CardTitle>
                    <CardDescription>Contact information and support details</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Support Email</label>
                      <Input
                        type="email"
                        value={formData.support_mail}
                        onChange={(e) => setFormData({ ...formData, support_mail: e.target.value })}
                        placeholder="support@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Support Contact</label>
                      <Input
                        value={formData.support_contact}
                        onChange={(e) => setFormData({ ...formData, support_contact: e.target.value })}
                        placeholder="+1234567890"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Company Address</label>
                      <Input
                        value={formData.company_address}
                        onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                        placeholder="123 Main St, City, Country"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Logos Tab */}
              {activeTab === "logos" && (
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Logos
                    </CardTitle>
                    <CardDescription>Upload and manage project logos</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Favicon</label>
                      <div className="flex gap-2">
                        <Input
                          value={formData.logo}
                          onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                          placeholder="https://example.com/logo.png or select from media library"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCurrentLogoField('logo')
                            setMediaPickerOpen(true)
                          }}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Select
                        </Button>
                      </div>
                      {formData.logo && (
                        <div className="mt-2 border rounded-lg overflow-hidden max-w-xs">
                          <img
                            src={formData.logo}
                            alt="Favicon Preview"
                            className="w-full h-auto object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Header Logo</label>
                      <div className="flex gap-2">
                        <Input
                          value={formData.hlogo}
                          onChange={(e) => setFormData({ ...formData, hlogo: e.target.value })}
                          placeholder="https://example.com/header-logo.png or select from media library"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCurrentLogoField('hlogo')
                            setMediaPickerOpen(true)
                          }}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Select
                        </Button>
                      </div>
                      {formData.hlogo && (
                        <div className="mt-2 border rounded-lg overflow-hidden max-w-xs">
                          <img
                            src={formData.hlogo}
                            alt="Header Logo Preview"
                            className="w-full h-auto object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Footer Logo</label>
                      <div className="flex gap-2">
                        <Input
                          value={formData.flogo}
                          onChange={(e) => setFormData({ ...formData, flogo: e.target.value })}
                          placeholder="https://example.com/footer-logo.png or select from media library"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setCurrentLogoField('flogo')
                            setMediaPickerOpen(true)
                          }}
                          className="gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Select
                        </Button>
                      </div>
                      {formData.flogo && (
                        <div className="mt-2 border rounded-lg overflow-hidden max-w-xs">
                          <img
                            src={formData.flogo}
                            alt="Footer Logo Preview"
                            className="w-full h-auto object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Social Media Tab */}
              {activeTab === "social" && (
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="h-5 w-5" />
                      Social Media
                    </CardTitle>
                    <CardDescription>Configure social media links</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Facebook className="h-4 w-4" />
                          Facebook
                        </label>
                        <Input
                          value={formData.facebook}
                          onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                          placeholder="https://facebook.com/yourpage"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Twitter className="h-4 w-4" />
                          Twitter
                        </label>
                        <Input
                          value={formData.twitter}
                          onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                          placeholder="https://twitter.com/yourhandle"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Instagram className="h-4 w-4" />
                          Instagram
                        </label>
                        <Input
                          value={formData.instagram}
                          onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                          placeholder="https://instagram.com/yourhandle"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Linkedin className="h-4 w-4" />
                          LinkedIn
                        </label>
                        <Input
                          value={formData.linkedin}
                          onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                          placeholder="https://linkedin.com/company/yourcompany"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Youtube className="h-4 w-4" />
                          YouTube
                        </label>
                        <Input
                          value={formData.youtube}
                          onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                          placeholder="https://youtube.com/yourchannel"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </label>
                        <Input
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                          placeholder="https://wa.me/1234567890"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          TikTok
                        </label>
                        <Input
                          value={formData.tiktok}
                          onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                          placeholder="https://tiktok.com/@yourhandle"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Vimeo
                        </label>
                        <Input
                          value={formData.vimeo}
                          onChange={(e) => setFormData({ ...formData, vimeo: e.target.value })}
                          placeholder="https://vimeo.com/yourchannel"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Pinterest
                        </label>
                        <Input
                          value={formData.pintrest}
                          onChange={(e) => setFormData({ ...formData, pintrest: e.target.value })}
                          placeholder="https://pinterest.com/yourprofile"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* SEO & Meta Tab */}
              {activeTab === "seo" && (
                <Card className="shadow-lg border-2">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      SEO & Meta Data
                    </CardTitle>
                    <CardDescription>Configure SEO settings and meta tags</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Meta Title</label>
                      <Input
                        value={formData.meta_title}
                        onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                        placeholder="Your Site Title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Meta Keywords</label>
                      <Input
                        value={formData.meta_keywords}
                        onChange={(e) => setFormData({ ...formData, meta_keywords: e.target.value })}
                        placeholder="keyword1, keyword2, keyword3"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Meta Description</label>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                        value={formData.meta_description}
                        onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                        placeholder="A brief description of your project"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Head Meta Data</label>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono text-xs"
                        value={formData.head_meta_data}
                        onChange={(e) => setFormData({ ...formData, head_meta_data: e.target.value })}
                        placeholder="<meta name='...' content='...' />"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Body Meta Data</label>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono text-xs"
                        value={formData.body_meta_data}
                        onChange={(e) => setFormData({ ...formData, body_meta_data: e.target.value })}
                        placeholder="<script>...</script>"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Extra Meta Data</label>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono text-xs"
                        value={formData.extra_meta_data}
                        onChange={(e) => setFormData({ ...formData, extra_meta_data: e.target.value })}
                        placeholder="Additional meta tags or scripts"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={updateProjectInfo.loading}
                  loading={updateProjectInfo.loading}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Media Picker */}
      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => {
          setMediaPickerOpen(false)
          setCurrentLogoField(null)
        }}
        onSelect={(media) => {
          if (currentLogoField) {
            const url = typeof media === 'string' ? media : (media.public_url || getMediaDisplayUrl(media) || '')
            setFormData({ ...formData, [currentLogoField]: url })
            setMediaPickerOpen(false)
            setCurrentLogoField(null)
          }
        }}
        mode="image"
        title="Select Logo"
        description="Choose a logo from your media library or upload a new one"
        allowUrl={true}
        allowUpload={true}
      />
    </MainLayout>
  )
}

