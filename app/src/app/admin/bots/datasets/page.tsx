"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { PageGuard } from "@components/auth/PageGuard"
import { MainLayout } from "@components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Badge } from "@components/ui/badge"
import { SidePanel } from "@components/ui/side-panel"
import { DatasetForm } from "@components/bots/dataset-form"
import { GuideSidePanel } from "@components/bots/guide-side-panel"
import { useApiCall } from "@hooks/useApiCall"
import { formatDate, formatTime } from "@lib/utils/date-format"
import { datasetService, datasetGenerationJobService } from "@services/finetune.service"
import { useToast } from "@hooks/useToast"
import {
  Plus,
  Search,
  FileText,
  Calendar,
  User,
  Edit,
  Eye,
  Trash2,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Info,
  TrendingUp,
  Layers,
  ArrowRight,
} from "lucide-react"
import type { Dataset } from "@models/bot.model"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { cn } from "@lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"

export default function DatasetsPage() {
  return (
    <PageGuard requireAdmin={true}>
      <DatasetsContent />
    </PageGuard>
  )
}

function DatasetsContent() {
  const { apiService } = useAuth()
  const { showSuccess, showError } = useToast()
  const { subscribeToBots, unsubscribeFromBots, onDatasetCreated, onDatasetUpdated, onDatasetDeleted, onDatasetProgress, connected } = useWebSocket()

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [filteredDatasets, setFilteredDatasets] = useState<Dataset[]>([])
  const [activeTab, setActiveTab] = useState<"datasets" | "generation">("datasets")

  // Check URL params for tab selection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'generation') {
      setActiveTab('generation')
    }
  }, [])
  const [searchQuery, setSearchQuery] = useState("")
  const [datasetTypeFilter, setDatasetTypeFilter] = useState<string>("all")
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isGuidePanelOpen, setIsGuidePanelOpen] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [viewMode, setViewMode] = useState<"create" | "edit" | "view" | "enhance">("create")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [datasetToDelete, setDatasetToDelete] = useState<Dataset | null>(null)
  
  // Generation form state
  const [generationTitle, setGenerationTitle] = useState("")
  const [generationDescription, setGenerationDescription] = useState("")
  const [numExamples, setNumExamples] = useState<string>("100")
  const [activeGenerationJobId, setActiveGenerationJobId] = useState<string | null>(null)
  const [activeJobStatus, setActiveJobStatus] = useState<{
    status: string
    progress: number
    current_batch: number
    total_batches: number
    generated_count: number
    dataset_id?: string
  } | null>(null)

  // Ensure API service is set
  useEffect(() => {
    if (apiService) {
      datasetService.setAuthApi(apiService)
      datasetGenerationJobService.setAuthApi(apiService)
    }
  }, [apiService])

  // Fetch datasets - no filters, get all
  const fetchDatasets = useApiCall(
    async () => {
      const response = await datasetService.listDatasets({
        limit: 1000,
        offset: 0,
      })
      if (!response?.success) {
        throw new Error(response?.message || "Failed to fetch datasets")
      }
      return response
    },
    {
      onSuccess: (response: unknown) => {
        // Simple parsing - handle direct response structure
        // Response can be: { datasets: [...], pagination: {...} } OR { success: true, data: { datasets: [...] } }
        let datasets: Dataset[] = []
        
        if (response && typeof response === 'object') {
          const resp = response as Record<string, unknown>
          
          // Check if datasets is directly in response
          if ('datasets' in resp && Array.isArray(resp.datasets)) {
            datasets = resp.datasets as Dataset[]
          }
          // Check if datasets is nested in data
          else if ('data' in resp && resp.data && typeof resp.data === 'object') {
            const data = resp.data as Record<string, unknown>
            if ('datasets' in data && Array.isArray(data.datasets)) {
              datasets = data.datasets as Dataset[]
            }
          }
          // Check if response itself is an array
          else if (Array.isArray(response)) {
            datasets = response as Dataset[]
          }
        }
        
        if (datasets.length > 0) {
          console.log('✅ Fetched datasets:', datasets.length, 'items')
          setDatasets(datasets)
        } else {
          console.warn('⚠️ No datasets found in response:', response)
          setDatasets([])
        }
      },
      showErrorToast: true,
    }
  )

  // Generation jobs are datasets that are actively generating (pending/processing)
  const generationJobs = useMemo(() => {
    return datasets.filter(dataset => {
      const status = dataset.status?.toLowerCase() || ''
      const isGenerating = status === 'pending' || status === 'processing'
      return isGenerating
    })
  }, [datasets])
  
  // Regular datasets are those that are not actively generating (show all, regardless of content)
  const completedDatasets = useMemo(() => {
    return datasets.filter(dataset => {
      const status = dataset.status?.toLowerCase() || ''
      const isNotGenerating = status !== 'pending' && status !== 'processing'
      // Show all datasets that are not actively generating, even if they don't have content yet
      return isNotGenerating
    })
  }, [datasets])
  
  // Debug logging
  useEffect(() => {
    console.log('📊 Dataset State:', {
      datasetsCount: datasets.length,
      completedCount: completedDatasets.length,
      generatingCount: generationJobs.length,
      filteredCount: filteredDatasets.length,
      datasets: datasets.map(d => ({
        id: d.dataset_id,
        title: d.title,
        status: d.status,
        hasContent: !!d.content,
        contentLength: d.content?.length || 0
      })),
      completed: completedDatasets.map(d => ({
        id: d.dataset_id,
        title: d.title,
        status: d.status
      })),
      generating: generationJobs.map(d => ({
        id: d.dataset_id,
        title: d.title,
        status: d.status
      })),
      filtered: filteredDatasets.map(d => ({
        id: d.dataset_id,
        title: d.title
      }))
    })
  }, [datasets, completedDatasets, generationJobs, filteredDatasets])

  // Delete dataset
  const deleteDataset = useApiCall(
    async () => {
      if (!datasetToDelete) throw new Error("No dataset selected")
      const response = await datasetService.deleteDataset(datasetToDelete.dataset_id)
      if (!response?.success) {
        throw new Error(response?.message || "Failed to delete dataset")
      }
      return response
    },
    {
      onSuccess: () => {
        showSuccess("Dataset deleted successfully")
        setDeleteDialogOpen(false)
        setDatasetToDelete(null)
        // WebSocket will handle the update automatically
      },
      showErrorToast: true,
    }
  )

  // Filter datasets (only show completed datasets, not generation jobs)
  useEffect(() => {
    // Use completedDatasets for the datasets tab (exclude generation jobs)
    let filtered = [...completedDatasets]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      if (query === 'enhanced') {
        // Special filter for enhanced datasets
        filtered = filtered.filter(
          (dataset) =>
            dataset.metadata && 
            typeof dataset.metadata === 'object' && 
            'enhanced_from' in dataset.metadata
        )
      } else {
        filtered = filtered.filter(
          (dataset) =>
            dataset.title.toLowerCase().includes(query) ||
            dataset.description?.toLowerCase().includes(query) ||
            (dataset.tags && dataset.tags.some((tag) => tag.toLowerCase().includes(query)))
        )
      }
    }

    // Type filter
    if (datasetTypeFilter !== "all") {
      filtered = filtered.filter((dataset) => dataset.dataset_type === datasetTypeFilter)
    }

    setFilteredDatasets(filtered)
  }, [searchQuery, datasetTypeFilter, completedDatasets])

  // Subscribe to WebSocket bot events
  useEffect(() => {
    if (connected) {
      subscribeToBots()
    }
    return () => {
      unsubscribeFromBots()
    }
  }, [connected, subscribeToBots, unsubscribeFromBots])

  // Listen for WebSocket dataset events
  useEffect(() => {
    const unsubscribeCreated = onDatasetCreated((dataset) => {
      setDatasets((prev) => {
        // Check if dataset already exists
        if (prev.find((d) => d.dataset_id === dataset.dataset_id)) {
          return prev
        }
        return [...prev, {
          ...dataset,
          dataset_type: dataset.dataset_type as "chat" | "calling" | "voice" | "all",
          status: dataset.status as "pending" | "processing" | "completed" | "failed" | undefined,
        } as Dataset]
      })
    })

    const unsubscribeUpdated = onDatasetUpdated((dataset) => {
      setDatasets((prev) =>
        prev.map((d) => (d.dataset_id === dataset.dataset_id ? {
          ...d,
          ...dataset,
          dataset_type: dataset.dataset_type as "chat" | "calling" | "voice" | "all",
          status: dataset.status as "pending" | "processing" | "completed" | "failed" | undefined,
        } as Dataset : d))
      )
      // Update selected dataset if it's the one being updated
      if (selectedDataset?.dataset_id === dataset.dataset_id) {
        setSelectedDataset((prev) => prev ? {
          ...prev,
          ...dataset,
          dataset_type: dataset.dataset_type as "chat" | "calling" | "voice" | "all",
          status: dataset.status as "pending" | "processing" | "completed" | "failed" | undefined,
        } as Dataset : null)
      }
    })

    const unsubscribeDeleted = onDatasetDeleted(({ dataset_id }) => {
      setDatasets((prev) => prev.filter((d) => d.dataset_id !== dataset_id))
      if (selectedDataset?.dataset_id === dataset_id) {
        setSelectedDataset(null)
        setIsSidePanelOpen(false)
      }
    })

    const unsubscribeProgress = onDatasetProgress((dataset) => {
      // Update dataset progress in real-time
      setDatasets((prev) =>
        prev.map((d) =>
          d.dataset_id === dataset.dataset_id
            ? {
                ...d,
                status: dataset.status as "pending" | "processing" | "completed" | "failed" | undefined,
                progress: dataset.progress,
                num_examples: dataset.num_examples,
              }
            : d
        )
      )
    })

    return () => {
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeDeleted()
      unsubscribeProgress()
    }
  }, [onDatasetCreated, onDatasetUpdated, onDatasetDeleted, onDatasetProgress, selectedDataset])

  // Load datasets on mount and when API service is ready (only once)
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (apiService && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      fetchDatasets.execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiService])

  // Disabled auto-polling - datasets will only refresh on manual refresh or after operations
  // If you need auto-refresh for active generation jobs, uncomment the code below:
  /*
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fetchDatasetsRef = useRef(fetchDatasets)
  const prevActiveJobKeysRef = useRef<string>('')
  
  useEffect(() => {
    fetchDatasetsRef.current = fetchDatasets
  }, [fetchDatasets])
  
  const activeJobKeys = useMemo(() => {
    return datasets
      .filter(job => {
        const status = job.status?.toLowerCase() || ''
        return status === 'pending' || status === 'processing'
      })
      .map(job => `${job.dataset_id}-${job.status}`)
      .sort()
      .join(',')
  }, [datasets])
  
  useEffect(() => {
    const hasActiveJobs = activeJobKeys.length > 0
    const keysChanged = prevActiveJobKeysRef.current !== activeJobKeys
    prevActiveJobKeysRef.current = activeJobKeys

    if (!hasActiveJobs) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    if (keysChanged || !pollIntervalRef.current) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      
      pollIntervalRef.current = setInterval(() => {
        fetchDatasetsRef.current.execute()
      }, 5000)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [activeJobKeys])
  */

  // Parse number of examples (supports formats like 10, 500, 50k, 1.5k, 100K, etc.)
  const parseNumExamples = (value: string): number => {
    if (!value || !value.trim()) return 100
    
    const trimmed = value.trim().toLowerCase()
    
    // Remove commas and spaces
    const cleaned = trimmed.replace(/[,\s]/g, '')
    
    // Check for 'k' suffix (thousands)
    if (cleaned.endsWith('k')) {
      const num = parseFloat(cleaned.slice(0, -1))
      if (isNaN(num)) return 100
      return Math.round(num * 1000)
    }
    
    // Check for 'm' suffix (millions)
    if (cleaned.endsWith('m')) {
      const num = parseFloat(cleaned.slice(0, -1))
      if (isNaN(num)) return 100
      return Math.round(num * 1000000)
    }
    
    // Regular number
    const num = parseFloat(cleaned)
    if (isNaN(num)) return 100
    return Math.round(num)
  }

  // Create generation job
  const createGenerationJob = useApiCall(
    async () => {
      if (!apiService) {
        throw new Error("API service not available")
      }
      if (!generationTitle.trim() || !generationDescription.trim()) {
        throw new Error("Title and description are required")
      }

      const parsedNumExamples = parseNumExamples(numExamples)
      if (parsedNumExamples < 1 || parsedNumExamples > 100000) {
        throw new Error("Number of examples must be between 1 and 100,000")
      }

      const response = await apiService.post<{ job_id: string; status: string; progress: number }>('/datasets/generate', {
        title: generationTitle.trim(),
        description: generationDescription.trim(),
        num_examples: parsedNumExamples,
        dataset_type: 'all', // Default to all types
      }) as unknown as { success: boolean; message?: string; data?: { job_id: string; status: string; progress: number } }

      if (!response?.success) {
        throw new Error(response?.message || "Failed to create generation job")
      }

      return {
        success: response.success,
        message: response.message || "Job created successfully",
        data: response.data!,
      }
    },
    {
      onSuccess: (response: unknown) => {
        const data = ((response as { data?: { job_id: string; status: string; progress: number } })?.data) ||
          (response as { job_id: string; status: string; progress: number })
        
        if (data && typeof data === 'object' && 'job_id' in data) {
          setActiveGenerationJobId(data.job_id)
          setActiveJobStatus({
            status: data.status || 'pending',
            progress: data.progress || 0,
            current_batch: 0,
            total_batches: 0,
            generated_count: 0,
          })
          // Clear form
          setGenerationTitle("")
          setGenerationDescription("")
          setNumExamples("100")
          showSuccess("Dataset generation started! Check progress below.")
          // WebSocket will handle the update automatically when dataset is created
        }
      },
      showErrorToast: true,
      showSuccessToast: false,
    }
  )

  // Auto-polling disabled - use refresh button to check generation job status
  // If you need auto-polling for generation job status, uncomment the code below:
  /*
  useEffect(() => {
    if (!activeGenerationJobId || !apiService) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await apiService.get<{
          status: string
          progress: number
          current_batch: number
          total_batches: number
          generated_count: number
          dataset_id?: string
          dataset?: { dataset_id: string; title: string; num_examples: number }
        }>(`/datasets/generate/${activeGenerationJobId}`) as unknown as { success: boolean; data?: {
          status: string
          progress: number
          current_batch: number
          total_batches: number
          generated_count: number
          dataset_id?: string
          dataset?: { dataset_id: string; title: string; num_examples: number }
        } }
        if (response?.success && response.data) {
          const job = response.data
          
          setActiveJobStatus({
            status: job.status,
            progress: job.progress || 0,
            current_batch: job.current_batch || 0,
            total_batches: job.total_batches || 0,
            generated_count: job.generated_count || 0,
            dataset_id: job.dataset_id || job.dataset?.dataset_id,
          })

          if (job.status === 'completed' && job.dataset_id) {
            clearInterval(pollInterval)
            setActiveGenerationJobId(null)
            setActiveJobStatus(null)
            showSuccess(`Dataset generated successfully! ${job.generated_count} examples created.`)
            // WebSocket will handle the update automatically
          } else if (job.status === 'failed') {
            clearInterval(pollInterval)
            setActiveGenerationJobId(null)
            setActiveJobStatus(null)
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [activeGenerationJobId, apiService, showSuccess, fetchDatasets])
  */
  

  const handleCreate = () => {
    setSelectedDataset(null)
    setViewMode("create")
    setIsSidePanelOpen(true)
  }

  const handleEdit = (dataset: Dataset) => {
    setSelectedDataset(dataset)
    setViewMode("edit")
    setIsSidePanelOpen(true)
  }

  const handleView = (dataset: Dataset) => {
    setSelectedDataset(dataset)
    setViewMode("view")
    setIsSidePanelOpen(true)
  }

  const handleDelete = (dataset: Dataset) => {
    setDatasetToDelete(dataset)
    setDeleteDialogOpen(true)
  }

  const handleEnhance = (dataset: Dataset) => {
    setSelectedDataset(dataset)
    setViewMode("enhance")
    setIsSidePanelOpen(true)
  }

  const handleDownload = (dataset: Dataset) => {
    if (!dataset.content) {
      showError("Dataset content is not available yet")
      return
    }
    const blob = new Blob([dataset.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${dataset.title.replace(/\s+/g, "-")}.jsonl`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showSuccess("Dataset downloaded successfully")
  }

  const handleClosePanel = () => {
    setIsSidePanelOpen(false)
    setSelectedDataset(null)
    // WebSocket will handle updates automatically
  }

  const handleSuccess = () => {
    // WebSocket will handle updates automatically
    // Don't auto-close - let user close manually
  }

  const getDatasetTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      chat: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      calling: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      voice: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      all: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    }
    return colors[type] || colors.all
  }

  // Get enhancement chain for a dataset
  const getEnhancementChain = (dataset: Dataset): Dataset[] => {
    const chain: Dataset[] = [dataset]
    let current = dataset
    
    // Traverse backwards through enhancement chain
    while (current.metadata && typeof current.metadata === 'object' && 'enhanced_from' in current.metadata) {
      const enhancedFromId = typeof current.metadata.enhanced_from === 'string' 
        ? current.metadata.enhanced_from 
        : String(current.metadata.enhanced_from || '')
      const parent = datasets.find(d => d.dataset_id === enhancedFromId)
      if (parent) {
        chain.unshift(parent)
        current = parent
      } else {
        break
      }
    }
    
    return chain
  }

  // Check if dataset is enhanced
  const isEnhancedDataset = (dataset: Dataset): boolean => {
    return !!(dataset.metadata && typeof dataset.metadata === 'object' && 'enhanced_from' in dataset.metadata)
  }

  // Refresh handler
  const handleRefresh = () => {
    fetchDatasets.execute()
  }

  return (
    <MainLayout
      title="Datasets"
      description="Manage your training datasets"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsGuidePanelOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Guide
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={fetchDatasets.loading}
          >
            <RefreshCw className={cn("h-4 w-4", fetchDatasets.loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={handleCreate} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Create Dataset
          </Button>
        </div>
      }
    >
      <div className="w-full ">

        {/* Tabs for Datasets and Generation Jobs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "datasets" | "generation")} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="datasets" className="gap-2">
              <FileText className="h-4 w-4" />
              Datasets ({datasets.length})
            </TabsTrigger>
            <TabsTrigger value="generation" className="gap-2">
              <Loader2 className="h-4 w-4" />
              Generation Jobs ({generationJobs.length})
            </TabsTrigger>
          </TabsList>

          {/* Datasets Tab */}
          <TabsContent value="datasets" className="space-y-4 mt-4">
            {/* Filters */}
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search datasets by title, description, or tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10"
                    />
                  </div>
                </div>
                <div className="sm:w-48">
                  <select
                    value={datasetTypeFilter}
                    onChange={(e) => setDatasetTypeFilter(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="all">All Types</option>
                    <option value="chat">Chat</option>
                    <option value="calling">Calling</option>
                    <option value="voice">Voice</option>
                  </select>
                </div>
                <div className="sm:w-48">
                  <select
                    value={searchQuery.includes('enhanced') ? 'enhanced' : 'all'}
                    onChange={(e) => {
                      if (e.target.value === 'enhanced') {
                        // Filter to show only enhanced datasets
                        const enhancedDatasets = completedDatasets.filter(d => 
                          d.metadata && typeof d.metadata === 'object' && 'enhanced_from' in d.metadata
                        )
                        if (enhancedDatasets.length > 0) {
                          setSearchQuery('enhanced')
                        }
                      } else {
                        setSearchQuery('')
                      }
                    }}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="all">All Datasets</option>
                    <option value="enhanced">Enhanced Only</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

            {/* Datasets List */}
            {fetchDatasets.loading ? (
              <Card className="border shadow-sm">
                <CardContent className="p-12">
                  <div className="text-center text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium">Loading datasets...</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredDatasets.length === 0 ? (
              <Card className="border shadow-sm">
                <CardContent className="p-12">
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">No datasets found</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    {searchQuery || datasetTypeFilter !== "all"
                        ? "Try adjusting your filters to find what you're looking for."
                        : "Get started by creating your first training dataset. You can generate datasets automatically or upload your own."}
                  </p>
                  {!searchQuery && datasetTypeFilter === "all" && (
                      <Button onClick={handleCreate} className="gap-2" size="lg">
                      <Plus className="h-4 w-4" />
                      Create Dataset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDatasets.map((dataset) => (
                <Card 
                  key={dataset.dataset_id} 
                  className={cn(
                    "hover:shadow-lg transition-all duration-300 border cursor-pointer group overflow-hidden relative",
                    isEnhancedDataset(dataset)
                      ? "border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700 bg-gradient-to-br from-purple-50/30 to-card dark:from-purple-950/10 dark:to-card"
                      : "hover:border-primary/50"
                  )}
                  onClick={() => handleView(dataset)}
                >
                  {/* Enhanced Dataset Ribbon */}
                  {isEnhancedDataset(dataset) && (
                    <div className="absolute top-0 right-0 bg-gradient-to-br from-purple-600 to-purple-700 text-white text-[10px] font-semibold px-3 py-1 rounded-bl-lg shadow-md z-10 flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      Enhanced
                    </div>
                  )}
                  <CardHeader className="pb-3 bg-gradient-to-br from-card to-card/50 border-b p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <CardTitle className="text-base font-semibold truncate group-hover:text-primary transition-colors">
                            {dataset.title}
                          </CardTitle>
                          {/* Enhanced Dataset Indicator */}
                          {dataset.metadata && typeof dataset.metadata === 'object' && 'enhanced_from' in dataset.metadata && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200 dark:border-purple-800 flex items-center gap-1"
                              title="Enhanced Dataset"
                            >
                              <Layers className="h-3 w-3" />
                              Enhanced
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs line-clamp-2 min-h-[2.5rem] text-muted-foreground mt-1">
                          {dataset.description || "No description provided"}
                        </CardDescription>
                        {/* Show enhancement info */}
                        {isEnhancedDataset(dataset) && (() => {
                          const chain = getEnhancementChain(dataset)
                          const isLatest = chain[chain.length - 1].dataset_id === dataset.dataset_id
                          
                          return (
                            <div className="mt-2 p-2.5 rounded-md bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50">
                              <div className="flex items-center gap-1.5 text-[10px] text-purple-700 dark:text-purple-300 mb-1.5">
                                <TrendingUp className="h-3 w-3" />
                                <span className="font-medium">Enhancement Chain:</span>
                                {chain.length > 1 && (
                                  <span className="text-purple-600 dark:text-purple-400">
                                    {chain.length} versions
                                  </span>
                                )}
                              </div>
                              {chain.length > 1 && (
                                <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 flex-wrap">
                                  {chain.map((d, idx) => (
                                    <span key={d.dataset_id} className="flex items-center gap-1">
                                      <span className={cn(
                                        "truncate max-w-[100px]",
                                        d.dataset_id === dataset.dataset_id && "font-semibold text-purple-800 dark:text-purple-200"
                                      )}>
                                        {d.title.replace(' (Enhanced)', '')}
                                      </span>
                                      {idx < chain.length - 1 && (
                                        <ArrowRight className="h-2.5 w-2.5 text-purple-400" />
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(() => {
                                const newExamples = dataset.metadata?.new_examples
                                const originalExamples = dataset.metadata?.original_examples
                                if (typeof newExamples === 'number' && newExamples > 0) {
                                  return (
                                    <div className="mt-1.5 pt-1.5 border-t border-purple-200/50 dark:border-purple-800/50 flex items-center gap-2 text-[10px]">
                                      <span className="text-purple-600 dark:text-purple-400">
                                        {typeof originalExamples === 'number' ? originalExamples : '?'} examples
                                      </span>
                                      <ArrowRight className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                                      <span className="text-green-600 dark:text-green-400 font-semibold">
                                        +{newExamples} new
                                      </span>
                                      <ArrowRight className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
                                      <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                        {dataset.num_examples} total
                                      </span>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                              {isLatest && (
                                <div className="mt-1.5 pt-1.5 border-t border-purple-200/50 dark:border-purple-800/50">
                                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800">
                                    Latest Version
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("text-xs font-medium", getDatasetTypeBadge(dataset.dataset_type))}>
                        {dataset.dataset_type.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        {dataset.num_examples || 0} examples
                      </Badge>
                      {/* Show enhancement stats if available */}
                      {dataset.metadata && typeof dataset.metadata === 'object' && 'duplicates_removed' in dataset.metadata && (
                        <Badge 
                          variant="outline" 
                          className="text-xs bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                          title={`${typeof dataset.metadata.duplicates_removed === 'number' ? dataset.metadata.duplicates_removed : 0} duplicate entries were removed during enhancement`}
                        >
                          {typeof dataset.metadata.duplicates_removed === 'number' ? dataset.metadata.duplicates_removed : 0} duplicates removed
                        </Badge>
                      )}
                      {dataset.status && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            dataset.status === 'completed' ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800" :
                            dataset.status === 'processing' ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800" :
                            dataset.status === 'failed' ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800" :
                            "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                          )}
                        >
                          {dataset.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          {dataset.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {dataset.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                          {dataset.status}
                        </Badge>
                      )}
                      {dataset.is_active ? (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    
                    {/* Show progress if generating */}
                    {dataset.status === 'processing' && dataset.progress !== undefined && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{dataset.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${dataset.progress}%` }}
                          />
                        </div>
                        {dataset.generated_count !== undefined && dataset.num_examples && (
                          <p className="text-xs text-muted-foreground">
                            {dataset.generated_count} / {dataset.num_examples} generated
                          </p>
                        )}
                      </div>
                    )}

                    {dataset.tags && dataset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {dataset.tags.slice(0, 3).map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0.5">
                            {tag}
                          </Badge>
                        ))}
                        {dataset.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                            +{dataset.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(dataset.created_at)}</span>
                      </div>
                      {dataset.createdBy && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[80px]">
                            {dataset.createdBy.first_name || dataset.createdBy.email || "User"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleView(dataset)
                        }}
                        className="flex-1 gap-1.5 h-8 text-xs hover:bg-primary/10"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(dataset)
                        }}
                        className="flex-1 gap-1.5 h-8 text-xs hover:bg-primary/10"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {dataset.content && dataset.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEnhance(dataset)
                          }}
                          className="flex-1 gap-1.5 h-8 text-xs hover:bg-primary/10"
                          title="Enhance Dataset"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Enhance
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(dataset)
                        }}
                        className="h-8 w-8 p-0 hover:bg-primary/10"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(dataset)
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </TabsContent>

          {/* Generation Jobs Tab */}
          <TabsContent value="generation" className="space-y-4 mt-4">
            {/* Info Card */}
            <Card className="border border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Auto-Generate Training Data
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Provide a title, description, and the number of examples you want to generate. We&apos;ll use ChatGPT to automatically generate high-quality training examples in the correct JSONL format. The dataset will be split into 80% training and 20% testing automatically. Generation runs in the background - you can check progress below.
                    </p>
                  </div>
                  </div>
                </CardContent>
              </Card>

            {/* Generation Form */}
            {!activeGenerationJobId && (
              <Card className="border shadow-sm">
                <CardHeader className="bg-gradient-to-br from-card to-card/50 border-b pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Generate New Dataset
                  </CardTitle>
                  <CardDescription className="mt-1">Enter details about your training topic</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="generation-title" className="text-sm font-semibold">Topic Title *</label>
                    <Input
                      id="generation-title"
                      placeholder="e.g., Customer Support, Product Information, FAQ"
                      value={generationTitle}
                      onChange={(e) => setGenerationTitle(e.target.value)}
                      disabled={createGenerationJob.loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      A short title describing what your bot will be trained on
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="generation-description" className="text-sm font-semibold">Topic Description *</label>
                    <Textarea
                      id="generation-description"
                      placeholder="e.g., A customer support bot that helps users with product inquiries, troubleshooting, and order status..."
                      value={generationDescription}
                      onChange={(e) => setGenerationDescription(e.target.value)}
                      rows={4}
                      disabled={createGenerationJob.loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      A detailed description of what your bot should know and respond about
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="num-examples" className="text-sm font-semibold">
                      Number of Examples (Rows) * <span className="text-muted-foreground font-normal">(1 - 100,000)</span>
                    </label>
                    <Input
                      id="num-examples"
                      type="text"
                      placeholder="e.g., 100, 500, 1k, 5k, 50k, 100k"
                      value={numExamples}
                      onChange={(e) => {
                        const value = e.target.value
                        // Allow numbers, k, K, m, M, commas, dots, and spaces
                        if (value === '' || /^[\d.,\s]*[kmKM]?$/.test(value)) {
                          setNumExamples(value)
                        }
                      }}
                      disabled={createGenerationJob.loading}
                      className="font-mono"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Supports formats:</span>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">10</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">500</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">1k</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">50k</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">100k</Badge>
                      </div>
                    </div>
                    {numExamples && (
                      <p className="text-xs text-muted-foreground">
                        Will generate: <span className="font-semibold text-foreground">{parseNumExamples(numExamples).toLocaleString()}</span> examples
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={() => createGenerationJob.execute()}
                    disabled={
                      !generationTitle.trim() || 
                      !generationDescription.trim() || 
                      !numExamples.trim() ||
                      parseNumExamples(numExamples) < 1 ||
                      parseNumExamples(numExamples) > 100000 ||
                      createGenerationJob.loading
                    }
                    className="w-full gap-2"
                    size="lg"
                  >
                    {createGenerationJob.loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting Generation...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                      Generate Dataset
                      </>
                    )}
                    </Button>
                </CardContent>
              </Card>
            )}

            {/* Active Generation Progress */}
            {activeJobStatus && (
              <Card className="border border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 shadow-sm">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Loader2 className={cn("h-4 w-4", activeJobStatus.status === 'processing' && "animate-spin")} />
                    Active Generation Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Progress</span>
                      <span className="text-muted-foreground">{activeJobStatus.progress}%</span>
                  </div>
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          activeJobStatus.status === 'completed' ? "bg-green-500" :
                          activeJobStatus.status === 'failed' ? "bg-red-500" :
                          "bg-primary"
                        )}
                        style={{ width: `${activeJobStatus.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="ml-2 capitalize">
                        {activeJobStatus.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Generated:</span>
                      <span className="ml-2 font-semibold">{activeJobStatus.generated_count} examples</span>
                    </div>
                    {activeJobStatus.total_batches > 0 && (
                      <div>
                        <span className="text-muted-foreground">Batch:</span>
                        <span className="ml-2 font-semibold">{activeJobStatus.current_batch} / {activeJobStatus.total_batches}</span>
                      </div>
                    )}
                    {activeJobStatus.dataset_id && (
                      <div>
                        <span className="text-muted-foreground">Dataset ID:</span>
                        <span className="ml-2 font-semibold text-xs font-mono">{activeJobStatus.dataset_id.slice(0, 8)}...</span>
                      </div>
                    )}
                  </div>
                  {activeJobStatus.status === 'completed' && activeJobStatus.dataset_id && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
                          Dataset generated successfully! {activeJobStatus.generated_count} examples created.
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setActiveTab('datasets')
                          // WebSocket will keep data updated automatically
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        View Datasets
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Generation Jobs Table */}
            {generationJobs.length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader className="bg-gradient-to-br from-card to-card/50 border-b pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Generation Jobs ({generationJobs.length})
                  </CardTitle>
                  <CardDescription className="mt-1">Track dataset generation progress in real-time</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 text-sm font-semibold">Title</th>
                          <th className="text-left p-3 text-sm font-semibold">Status</th>
                          <th className="text-left p-3 text-sm font-semibold">Progress</th>
                          <th className="text-left p-3 text-sm font-semibold">Examples</th>
                          <th className="text-left p-3 text-sm font-semibold">Batch</th>
                          <th className="text-left p-3 text-sm font-semibold">Created</th>
                          <th className="text-left p-3 text-sm font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generationJobs.map((job) => (
                          <tr key={job.dataset_id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                              <div className="font-medium">{job.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {job.description}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  job.status === 'completed'
                                    ? 'default'
                                    : job.status === 'failed'
                                    ? 'destructive'
                                    : job.status === 'processing'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="gap-1"
                              >
                                {job.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                                {job.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                                {job.status === 'failed' && <XCircle className="h-3 w-3" />}
                                {job.status === 'pending' && <Clock className="h-3 w-3" />}
                                {job.status}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span>{job.progress || 0}%</span>
                                </div>
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      job.status === 'completed' ? "bg-green-500" :
                                      job.status === 'failed' ? "bg-red-500" :
                                      "bg-primary"
                                    )}
                                    style={{ width: `${job.progress || 0}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-sm">
                              {job.generated_count || 0} / {job.num_examples || 0}
                            </td>
                            <td className="p-3 text-sm">
                              {job.current_batch || 0} / {job.total_batches || 0}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {formatDate(job.created_at)}
                              <br />
                              {formatTime(job.created_at)}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                {job.status === 'completed' && job.content && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setActiveTab('datasets')
                                      // WebSocket will keep data updated automatically
                                    }}
                                    className="h-7 text-xs"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                )}
                                {job.status === 'failed' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setActiveGenerationJobId(null)
                                      setActiveJobStatus(null)
                                    }}
                                    className="h-7 text-xs"
                                    title="Retry"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!activeGenerationJobId && generationJobs.length === 0 && !fetchDatasets.loading && (
              <Card className="border shadow-sm">
                <CardContent className="p-12">
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">No generation jobs yet</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                      Use the form above to start generating your first dataset automatically
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {fetchDatasets.loading && (
              <Card className="border shadow-sm">
                <CardContent className="p-12">
                  <div className="text-center text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium">Loading generation jobs...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Side Panel for Create/Edit/View */}
        <SidePanel
          open={isSidePanelOpen}
          onClose={handleClosePanel}
          title={
            viewMode === "create"
              ? "Create Dataset"
              : viewMode === "edit"
              ? "Edit Dataset"
              : viewMode === "enhance"
              ? "Enhance Dataset"
              : "View Dataset"
          }
          description={
            viewMode === "create"
              ? "Create a new training dataset"
              : viewMode === "edit"
              ? "Edit dataset details and content"
              : viewMode === "enhance"
              ? "Add new examples to enhance this dataset"
              : "View dataset details and content"
          }
          width="lg"
        >
          <DatasetForm
            dataset={selectedDataset}
            mode={viewMode}
            onSuccess={handleSuccess}
            onCancel={handleClosePanel}
          />
        </SidePanel>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false)
              setDatasetToDelete(null)
            }}
            onConfirm={async () => {
              await deleteDataset.execute()
            }}
            title="Delete Dataset"
            description={`Are you sure you want to delete "${datasetToDelete?.title}"? This action cannot be undone.`}
            confirmText="Delete"
          />
      </div>

      <GuideSidePanel open={isGuidePanelOpen} onClose={() => setIsGuidePanelOpen(false)} />
    </MainLayout>
  )
}

