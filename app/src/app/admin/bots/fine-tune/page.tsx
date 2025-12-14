"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { useApiCall } from "@hooks/useApiCall"
import { botService } from "@services/bot.service"
import { fineTuneService } from "@services/finetune.service"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Badge } from "@components/ui/badge"
import { SidePanel } from "@components/ui/side-panel"
import { FineTuneForm } from "@components/bots/fine-tune-form"
import { GuideSidePanel } from "@components/bots/guide-side-panel"
import { FineTuneJobDetails } from "@components/bots/fine-tune-job-details"
import { EnhanceModelWizard } from "@components/bots/enhance-model-wizard"
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Bot,
  Sparkles,
  Plus,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  TrendingUp,
  Eye,
  MessageSquare,
  Phone,
  Mic,
  DollarSign,
} from "lucide-react"
import type { Bot as BotType, FineTuneJob } from "@models/bot.model"
import { getModelConfig, type ModelType } from "@lib/models/model-config"
import { formatDate, formatTime } from "@lib/utils/date-format"

type FilterState = {
  search: string
  status: string
  bot_id: string
  date_from: string
  date_to: string
}

export default function FineTunePage() {
  return (
    <PageGuard requireAdmin={true}>
      <Suspense fallback={
        <MainLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading...</p>
            </div>
          </div>
        </MainLayout>
      }>
        <FineTuneContent />
      </Suspense>
    </PageGuard>
  )
}

function FineTuneContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { apiService, loading: authLoading } = useAuth()
  const { subscribeToBots, unsubscribeFromBots, onFineTuneJobCreated, onFineTuneJobUpdated, onFineTuneJobProgress, connected } = useWebSocket()

  const [jobs, setJobs] = useState<FineTuneJob[]>([])
  const [bots, setBots] = useState<BotType[]>([])
  const [selectedJob, setSelectedJob] = useState<FineTuneJob | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isGuidePanelOpen, setIsGuidePanelOpen] = useState(false)
  const [enhancementJob, setEnhancementJob] = useState<FineTuneJob | null>(null)
  const [isEnhancementWizardOpen, setIsEnhancementWizardOpen] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "",
    bot_id: "",
    date_from: "",
    date_to: "",
  })

  // Ensure API service is set
  useEffect(() => {
    if (apiService) {
      botService.setAuthApi(apiService)
      fineTuneService.setAuthApi(apiService)
    }
  }, [apiService])

  // Fetch all jobs
  const fetchJobs = useApiCall(
    async () => {
      if (!apiService) {
        throw new Error("API service not available")
      }
      fineTuneService.setAuthApi(apiService)
      const response = await fineTuneService.listFineTuneJobs()
      if (!response?.success) {
        throw new Error(response?.message || "Failed to fetch jobs")
      }
      return response
    },
    {
      onSuccess: (response) => {
        const jobsData = ((response as { data?: FineTuneJob[] })?.data) || (response as FineTuneJob[])
        if (Array.isArray(jobsData)) {
          setJobs(jobsData)
        }
      },
      showErrorToast: true,
      showSuccessToast: false,
    }
  )

  // Fetch bots
  const fetchBots = useApiCall(
    async () => {
      if (!apiService) {
        throw new Error("API service not available")
      }
      botService.setAuthApi(apiService)
      const response = await botService.getBots()
      if (!response?.success) {
        throw new Error(response?.message || "Failed to fetch bots")
      }
      return response
    },
    {
      onSuccess: (response) => {
        const botsData = ((response as { data?: BotType[] })?.data) || (response as BotType[])
        if (Array.isArray(botsData)) {
          setBots(botsData)
        }
      },
      showErrorToast: false,
      showSuccessToast: false,
    }
  )

  // Subscribe to WebSocket bot events
  useEffect(() => {
    if (connected) {
      subscribeToBots()
    }
    return () => {
      unsubscribeFromBots()
    }
  }, [connected, subscribeToBots, unsubscribeFromBots])

  // Listen for WebSocket fine-tune job events
  useEffect(() => {
    const unsubscribeCreated = onFineTuneJobCreated((job) => {
      setJobs((prev) => {
        // Check if job already exists
        if (prev.find((j) => j.job_id === job.job_id)) {
          return prev
        }
        
        const newJob = {
          ...job,
          status: job.status as "pending" | "validating_files" | "running" | "succeeded" | "failed" | "cancelled",
          bot_id: job.bot_id || "",
        } as FineTuneJob

        // If this is a child job (has parent_job_id), refresh the parent job
        const parentJobId = (job as FineTuneJob & { parent_job_id?: string }).parent_job_id
        if (parentJobId) {
          // Refresh parent job to get updated childJobs
          const refreshParentJob = async () => {
            try {
              const response = await fineTuneService.getFineTuneJobStatus(parentJobId)
              if (response?.success && response.data) {
                const responseData = response.data as unknown
                const updatedParent = (responseData as { data?: FineTuneJob })?.data || (responseData as FineTuneJob) as FineTuneJob
                setJobs((prevJobs) =>
                  prevJobs.map((j) => (j.job_id === parentJobId ? updatedParent : j))
                )
                // Update selected job if it's the parent
                if (selectedJob?.job_id === parentJobId) {
                  setSelectedJob(updatedParent)
                }
              }
            } catch (error) {
              console.error("Error refreshing parent job:", error)
            }
          }
          refreshParentJob()
        }

        return [...prev, newJob]
      })
    })

    const unsubscribeUpdated = onFineTuneJobUpdated((job) => {
      setJobs((prev) =>
        prev.map((j) => (j.job_id === job.job_id ? {
          ...j,
          ...job,
          status: job.status as "pending" | "validating_files" | "running" | "succeeded" | "failed" | "cancelled",
        } as FineTuneJob : j))
      )
      // Update selected job if it's the one being updated
      if (selectedJob?.job_id === job.job_id) {
        setSelectedJob((prev) => prev ? {
          ...prev,
          ...job,
          status: job.status as "pending" | "validating_files" | "running" | "succeeded" | "failed" | "cancelled",
        } as FineTuneJob : null)
      }
    })

    const unsubscribeProgress = onFineTuneJobProgress((job) => {
      // Update job progress in real-time
      setJobs((prev) =>
        prev.map((j) =>
          j.job_id === job.job_id
            ? {
                ...j,
                status: job.status as "pending" | "validating_files" | "running" | "succeeded" | "failed" | "cancelled",
                progress: job.progress,
                trained_tokens: job.trained_tokens,
                training_cost_usd: job.training_cost_usd,
                fine_tuned_model_id: job.fine_tuned_model_id,
              }
            : j
        )
      )
      // Update selected job if it's the one being updated
      if (selectedJob?.job_id === job.job_id) {
        setSelectedJob((prev) => prev ? {
          ...prev,
          status: job.status as "pending" | "validating_files" | "running" | "succeeded" | "failed" | "cancelled",
          progress: job.progress,
          trained_tokens: job.trained_tokens,
          training_cost_usd: job.training_cost_usd,
          fine_tuned_model_id: job.fine_tuned_model_id,
        } as FineTuneJob : null)
      }
    })

    return () => {
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeProgress()
    }
  }, [onFineTuneJobCreated, onFineTuneJobUpdated, onFineTuneJobProgress, selectedJob])

  // Load data on mount
  useEffect(() => {
    if (!authLoading && apiService) {
      fetchJobs.execute()
      fetchBots.execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, apiService])

  // Auto-select bot from query parameter
  useEffect(() => {
    const botId = searchParams?.get("bot_id")
    if (botId && isSidePanelOpen) {
      const bot = bots.find((b) => b.bot_id === botId)
      if (bot) {
        // Bot will be passed to FineTuneForm
      }
    }
  }, [searchParams, bots, isSidePanelOpen])

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch = !filters.search ||
        job.job_id.toLowerCase().includes(filters.search.toLowerCase()) ||
        job.openai_job_id?.toLowerCase().includes(filters.search.toLowerCase()) ||
        job.bot?.name.toLowerCase().includes(filters.search.toLowerCase())

      const matchesStatus = !filters.status || job.status === filters.status
      const matchesBot = !filters.bot_id || job.bot_id === filters.bot_id

      const jobDate = new Date(job.created_at)
      const matchesDateFrom = !filters.date_from || jobDate >= new Date(filters.date_from)
      const matchesDateTo = !filters.date_to || jobDate <= new Date(filters.date_to + "T23:59:59")

      return matchesSearch && matchesStatus && matchesBot && matchesDateFrom && matchesDateTo
    })
  }, [jobs, filters])

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: "",
      status: "",
      bot_id: "",
      date_from: "",
      date_to: "",
    })
  }

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Succeeded</Badge>
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case "running":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>
      case "validating_files":
        return <Badge variant="outline" className="border-purple-500 text-purple-600"><FileText className="h-3 w-3 mr-1" />Validating</Badge>
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case "cancelled":
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Get unique statuses
  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(jobs.map((j) => j.status))).sort()
  }, [jobs])

  if (authLoading) {
    return (
      <MainLayout title="Fine-tune Jobs" description="Manage and monitor fine-tuning jobs">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Fine-tune Jobs"
      description="Manage and monitor all fine-tuning jobs"
      actions={
        <div className="flex gap-2">
          <Button onClick={() => router.push("/admin/bots")} variant="outline" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Bots</span>
          </Button>
          <Button onClick={() => setIsGuidePanelOpen(true)} variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Guide</span>
          </Button>
          <Button onClick={() => fetchJobs.execute()} variant="outline" className="gap-2" disabled={fetchJobs.loading}>
            <RefreshCw className={`h-4 w-4 ${fetchJobs.loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button onClick={() => setIsSidePanelOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Fine-tune</span>
          </Button>
        </div>
      }
    >
      {/* Side Panel for Create/View Fine-tune */}
      <SidePanel
        open={isSidePanelOpen}
        onClose={() => {
          setIsSidePanelOpen(false)
          setSelectedJob(null)
        }}
        title={selectedJob ? `Fine-tune Job: ${selectedJob.job_id.slice(0, 8)}...` : "Create Fine-tune Job"}
        description={selectedJob ? "View detailed training information and track progress" : "Upload training data and fine-tune your bot"}
        width="xl"
      >
        {selectedJob ? (
          <FineTuneJobDetails
            job={selectedJob}
            onRefresh={async () => {
              // WebSocket will handle updates automatically
              // Only fetch if WebSocket is not connected
              if (!connected) {
                await fetchJobs.execute()
                const response = await fineTuneService.listFineTuneJobs()
                if (response?.success) {
                  const updatedJobs = Array.isArray(response.data) ? response.data : []
                  const updatedJob = updatedJobs.find((j: FineTuneJob) => j.job_id === selectedJob.job_id)
                  if (updatedJob) {
                    setSelectedJob(updatedJob)
                  }
                }
              }
            }}
            onCancel={async () => {
              // WebSocket will handle updates automatically
              // Only fetch if WebSocket is not connected
              if (!connected) {
                await fetchJobs.execute()
                const response = await fineTuneService.listFineTuneJobs()
                if (response?.success) {
                  const updatedJobs = Array.isArray(response.data) ? response.data : []
                  const updatedJob = updatedJobs.find((j: FineTuneJob) => j.job_id === selectedJob.job_id)
                  if (updatedJob) {
                    setSelectedJob(updatedJob)
                  }
                }
              }
            }}
            onEnhance={(enhanceJob) => {
              // Open enhancement wizard
              setEnhancementJob(enhanceJob)
              setIsEnhancementWizardOpen(true)
            }}
          />
        ) : (
          <FineTuneForm
            selectedBot={searchParams?.get("bot_id") ? bots.find((b) => b.bot_id === searchParams.get("bot_id")) || null : null}
            onSuccess={() => {
              // WebSocket will handle updates automatically
            }}
            onOpenGuide={() => setIsGuidePanelOpen(true)}
          />
        )}
      </SidePanel>

      <GuideSidePanel open={isGuidePanelOpen} onClose={() => setIsGuidePanelOpen(false)} />

      {/* Enhancement Wizard Side Panel */}
      {enhancementJob && (
        <SidePanel
          open={isEnhancementWizardOpen}
          onClose={() => {
            setIsEnhancementWizardOpen(false)
            setEnhancementJob(null)
          }}
          title="Enhance Model"
          description="Re-fine-tune your model with additional training data"
          width="md"
        >
          <EnhanceModelWizard
            job={enhancementJob}
            onSuccess={(newJob) => {
              // Add new job to list
              setJobs((prev) => {
                if (prev.find((j) => j.job_id === newJob.job_id)) {
                  return prev
                }
                return [...prev, newJob]
              })
              // Close wizard and show success
              setIsEnhancementWizardOpen(false)
              setEnhancementJob(null)
              // Optionally open the new job details
              setSelectedJob(newJob)
              setIsSidePanelOpen(true)
            }}
            onCancel={() => {
              setIsEnhancementWizardOpen(false)
              setEnhancementJob(null)
            }}
          />
        </SidePanel>
      )}

      <div className="w-full px-4 md:px-6 pt-0">
        <div className="space-y-6 pt-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Jobs</p>
                    <p className="text-2xl font-bold">{jobs.length}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Succeeded</p>
                    <p className="text-2xl font-bold text-green-600">
                      {jobs.filter((j) => j.status === "succeeded").length}
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-red-600">
                      {jobs.filter((j) => j.status === "failed").length}
                    </p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {jobs.filter((j) => j.status === "running" || j.status === "validating_files" || j.status === "pending").length}
                    </p>
                  </div>
                  <RefreshCw className="h-8 w-8 text-blue-600 opacity-50 animate-spin" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-base">Filters</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {(filters.search || filters.status || filters.bot_id || filters.date_from || filters.date_to) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="gap-1 h-7"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                    className="gap-1 h-7"
                  >
                    {filtersExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Hide
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {filtersExpanded && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Search</label>
                    <Input
                      placeholder="Search jobs, bots..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">All Statuses</option>
                      {uniqueStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">Bot</label>
                    <select
                      value={filters.bot_id}
                      onChange={(e) => setFilters({ ...filters, bot_id: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">All Bots</option>
                      {bots.map((bot) => (
                        <option key={bot.bot_id} value={bot.bot_id}>
                          {bot.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">From Date</label>
                    <Input
                      type="date"
                      value={filters.date_from}
                      onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">To Date</label>
                    <Input
                      type="date"
                      value={filters.date_to}
                      onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Jobs Table */}
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Fine-tuning Jobs</CardTitle>
                  <CardDescription>
                    {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"} found
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Bot</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Tokens</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                          <p className="text-muted-foreground mb-2 font-semibold">No jobs found</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            {jobs.length === 0
                              ? "Create your first fine-tuning job to get started"
                              : "Try adjusting your filters"}
                          </p>
                          {jobs.length === 0 && (
                            <Button onClick={() => setIsSidePanelOpen(true)} className="gap-2">
                              <Plus className="h-4 w-4" />
                              Create Fine-tune Job
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map((job) => {
                        const bot = bots.find((b) => b.bot_id === job.bot_id)
                        return (
                          <tr
                            key={job.job_id}
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedJob(job)
                              setIsSidePanelOpen(true)
                            }}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {bot?.logo_url ? (
                                  <img src={bot.logo_url} alt={bot.name} className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Bot className="h-4 w-4 text-primary" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium">{bot?.name || "Unknown Bot"}</p>
                                  <p className="text-xs text-muted-foreground">{job.job_id.slice(0, 8)}...</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {getStatusBadge(job.status)}
                                {job.status === "failed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // Open side panel with this bot selected for retry
                                      const bot = bots.find((b) => b.bot_id === job.bot_id)
                                      if (bot) {
                                        router.push(`/admin/bots/fine-tune?bot_id=${bot.bot_id}`)
                                        setIsSidePanelOpen(true)
                                      }
                                    }}
                                    className="h-6 px-2 text-xs"
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Retry
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-mono text-xs">{job.bot?.model || "N/A"}</p>
                                  {(() => {
                                    const modelId = job.bot?.model || ""
                                    const config = getModelConfig(modelId)
                                    if (config && config.supportedTypes.length > 0) {
                                      return config.supportedTypes.map((type) => (
                                        <Badge key={type} variant="outline" className="text-xs">
                                          {type === 'chat' && <MessageSquare className="h-3 w-3 mr-1" />}
                                          {type === 'calling' && <Phone className="h-3 w-3 mr-1" />}
                                          {type === 'voice' && <Mic className="h-3 w-3 mr-1" />}
                                          {type.toUpperCase()}
                                        </Badge>
                                      ))
                                    }
                                    // Also check hyperparameters for model_type
                                    if (job.hyperparameters && typeof job.hyperparameters === 'object') {
                                      const hyperparams = job.hyperparameters as Record<string, unknown>
                                      const modelType = hyperparams.model_type as ModelType | undefined
                                      if (modelType) {
                                        return (
                                          <Badge variant="outline" className="text-xs">
                                            {modelType === 'chat' && <MessageSquare className="h-3 w-3 mr-1" />}
                                            {modelType === 'calling' && <Phone className="h-3 w-3 mr-1" />}
                                            {modelType === 'voice' && <Mic className="h-3 w-3 mr-1" />}
                                            {modelType.toUpperCase()}
                                          </Badge>
                                        )
                                      }
                                    }
                                    return null
                                  })()}
                                </div>
                                {job.fine_tuned_model_id && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                    Fine-tuned: {job.fine_tuned_model_id.slice(0, 20)}...
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {job.total_duration_seconds ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  {formatDuration(job.total_duration_seconds)}
                                </div>
                              ) : job.status === "running" || job.status === "validating_files" || job.status === "pending" ? (
                                <span className="text-sm text-muted-foreground">In progress...</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {job.trained_tokens ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-sm">
                                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                                    {job.trained_tokens.toLocaleString()}
                                  </div>
                                  {job.training_cost_usd && (
                                    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                      <DollarSign className="h-3 w-3" />
                                      ${job.training_cost_usd.toFixed(4)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(job.created_at)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {formatTime(job.created_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedJob(job)
                                  setIsSidePanelOpen(true)
                                }}
                                className="gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <GuideSidePanel open={isGuidePanelOpen} onClose={() => setIsGuidePanelOpen(false)} />
    </MainLayout>
  )
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }
}
