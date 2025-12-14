"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@context/AuthContext"
import { useWebSocket } from "@context/WebSocketContext"
import { useApiCall } from "@hooks/useApiCall"
import { useToast } from "@hooks/useToast"
import { botService } from "@services/bot.service"
import { MainLayout } from "@components/layout/MainLayout"
import { PageGuard } from "@components/auth/PageGuard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Badge } from "@components/ui/badge"
import { Textarea } from "@components/ui/textarea"
import { SidePanel } from "@components/ui/side-panel"
import { ConfirmDialog } from "@components/ui/confirm-dialog"
import { ToggleButton } from "@components/ui/toggle-button"
import { Switch } from "@components/ui/switch"
import { GuideSidePanel } from "@components/bots/guide-side-panel"
import {
  Bot,
  CheckCircle2,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  MessageSquare,
  Phone,
  Mic,
  Sparkles,
  Power,
  FileText,
} from "lucide-react"
import type { Bot as BotType, BotCreateRequest, BotUpdateRequest } from "@models/bot.model"
import { calculateCostEstimate, formatCost, getModelDisplayName } from "@lib/utils/cost-estimation"

interface OpenAIModel {
  id: string
  name: string
  created: number
  owned_by: string
  supports_fine_tuning: boolean
}

export default function AdminBotsPage() {
  return (
    <PageGuard requireAdmin={true}>
      <AdminBotsContent />
    </PageGuard>
  )
}

function AdminBotsContent() {
  const router = useRouter()
  const { apiService, loading: authLoading } = useAuth()
  const { showSuccess } = useToast()
  const { subscribeToBots, unsubscribeFromBots, onBotCreated, onBotUpdated, onBotDeleted, connected } = useWebSocket()

  const [bots, setBots] = useState<BotType[]>([])
  const [selectedBot, setSelectedBot] = useState<BotType | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [isGuidePanelOpen, setIsGuidePanelOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [availableModels, setAvailableModels] = useState<OpenAIModel[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [botToDelete, setBotToDelete] = useState<BotType | null>(null)

  // Bot form state
  const [botForm, setBotForm] = useState<BotCreateRequest & { status?: "active" | "inactive" }>({
    name: "",
    description: "",
    model: "gpt-4o-mini-2024-07-18",
    logo_url: "",
    status: "inactive",
    settings: {
      temperature: 0.7,
      max_tokens: 2000,
      supports_chat: true,
      supports_call: false,
      supports_voice: false,
    },
  })


  // Calculate cost estimate
  const costEstimate = useMemo(() => {
    if (!botForm.model) return null
    return calculateCostEstimate(
      botForm.model,
      botForm.settings?.supports_chat || false,
      botForm.settings?.supports_call || false,
      botForm.settings?.supports_voice || false
    )
  }, [botForm.model, botForm.settings?.supports_chat, botForm.settings?.supports_call, botForm.settings?.supports_voice])

  // Ensure API service is set
  useEffect(() => {
    if (apiService) {
      botService.setAuthApi(apiService)
    }
  }, [apiService])

  // Fetch available models
  const fetchModels = useApiCall(
    async () => {
      if (!apiService) {
        throw new Error("API service not available")
      }
      botService.setAuthApi(apiService)
      const response = await botService.getAvailableModels()
      if (!response?.success) {
        throw new Error(response?.message || "Failed to fetch models")
      }
      return response
    },
    {
      onSuccess: (response) => {
        const responseData = (response as { data?: OpenAIModel[] })?.data
        if (responseData && Array.isArray(responseData)) {
          setAvailableModels(responseData)
        } else if (Array.isArray(response)) {
          setAvailableModels(response as OpenAIModel[])
        } else {
          setAvailableModels([])
        }
      },
      showErrorToast: false,
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
        // Handle both direct array and wrapped response
        const responseData = (response as { data?: BotType[] })?.data
        if (responseData && Array.isArray(responseData)) {
          setBots(responseData)
          if (process.env.NODE_ENV === 'development') {
            console.log('Bots fetched:', responseData.length, responseData)
          }
        } else if (Array.isArray(response)) {
          // Fallback: if response is directly an array
          setBots(response as BotType[])
          if (process.env.NODE_ENV === 'development') {
            console.log('Bots fetched (direct array):', response.length, response)
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Unexpected response format:', response)
          }
          setBots([])
        }
      },
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching bots:', error)
        }
      },
      showErrorToast: true,
      showSuccessToast: false,
    }
  )

  // Load bots and models on mount
  useEffect(() => {
    if (!authLoading && apiService) {
      fetchBots.execute()
      fetchModels.execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, apiService])

  // Subscribe to WebSocket bot events
  useEffect(() => {
    if (connected) {
      subscribeToBots()
    }
    return () => {
      unsubscribeFromBots()
    }
  }, [connected, subscribeToBots, unsubscribeFromBots])

  // Listen for WebSocket bot events
  useEffect(() => {
    const unsubscribeCreated = onBotCreated((bot) => {
      setBots((prev) => {
        // Check if bot already exists
        if (prev.find((b) => b.bot_id === bot.bot_id)) {
          return prev
        }
        return [...prev, {
          ...bot,
          status: bot.status as "active" | "inactive" | "training" | "error",
        } as BotType]
      })
    })

    const unsubscribeUpdated = onBotUpdated((bot) => {
      setBots((prev) =>
        prev.map((b) => (b.bot_id === bot.bot_id ? {
          ...b,
          ...bot,
          status: bot.status as "active" | "inactive" | "training" | "error",
        } as BotType : b))
      )
      // Update selected bot if it's the one being updated
      if (selectedBot?.bot_id === bot.bot_id) {
        setSelectedBot((prev) => prev ? {
          ...prev,
          ...bot,
          status: bot.status as "active" | "inactive" | "training" | "error",
        } as BotType : null)
      }
    })

    const unsubscribeDeleted = onBotDeleted(({ bot_id }) => {
      setBots((prev) => prev.filter((b) => b.bot_id !== bot_id))
      if (selectedBot?.bot_id === bot_id) {
        setSelectedBot(null)
        setIsSidePanelOpen(false)
      }
    })

    return () => {
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeDeleted()
    }
  }, [onBotCreated, onBotUpdated, onBotDeleted, selectedBot])

  // WebSocket handles all updates automatically, no need to refresh on panel close

  // Handle bot selection
  const handleBotSelect = (bot: BotType) => {
    setSelectedBot(bot)
    setBotForm({
      name: bot.name,
      description: bot.description || "",
      model: bot.model,
      logo_url: bot.logo_url || "",
      status: bot.status === "active" ? "active" : "inactive",
      settings: bot.settings || {
        temperature: 0.7,
        max_tokens: 2000,
        supports_chat: true,
        supports_call: false,
        supports_voice: false,
      },
    })
    setIsCreating(false)
    setIsSidePanelOpen(true)
  }

  // Handle create button
  const handleCreateClick = () => {
    setSelectedBot(null)
    setIsCreating(true)
    setBotForm({
      name: "",
      description: "",
      model: "gpt-4o-mini-2024-07-18",
      logo_url: "",
      status: "inactive",
      settings: {
        temperature: 0.7,
        max_tokens: 2000,
        supports_chat: true,
        supports_call: false,
        supports_voice: false,
      },
    })
    setIsSidePanelOpen(true)
  }

  // Create bot
  const createBot = useApiCall(
    async () => {
      if (!apiService) {
        throw new Error("API service not available")
      }
      if (!botForm.name.trim() || !botForm.model.trim()) {
        throw new Error("Name and model are required")
      }
      botService.setAuthApi(apiService)
      const createData: BotCreateRequest = {
        name: botForm.name,
        description: botForm.description,
        model: botForm.model,
        logo_url: botForm.logo_url,
        status: botForm.status,
        settings: botForm.settings,
      }
      const response = await botService.createBot(createData)
      if (!response?.success) {
        throw new Error(response?.message || "Failed to create bot")
      }
      return response
    },
    {
      onSuccess: (response) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Bot created response:', response)
        }
        showSuccess("Bot created successfully")
        
        // Optimistically update state immediately (WebSocket will sync if needed)
        const responseData = (response as { data?: BotType })?.data
        if (responseData) {
          setBots((prev) => {
            // Check if bot already exists (from WebSocket)
            if (prev.find((b) => b.bot_id === responseData.bot_id)) {
              return prev.map((b) => b.bot_id === responseData.bot_id ? responseData : b)
            }
            return [responseData, ...prev]
          })
        }
        
        // Reset form
        setBotForm({
          name: "",
          description: "",
          model: "gpt-4o-mini-2024-07-18",
          logo_url: "",
          status: "inactive",
          settings: {
            temperature: 0.7,
            max_tokens: 2000,
            supports_chat: true,
            supports_call: false,
            supports_voice: false,
          },
        })
        setIsSidePanelOpen(false)
        setIsCreating(false)
        setSelectedBot(null)
      },
      showErrorToast: true,
      showSuccessToast: false,
    }
  )

  // Update bot
  const updateBot = useApiCall(
    async () => {
      if (!selectedBot?.bot_id || !apiService) {
        throw new Error("Bot ID or API service not available")
      }
      botService.setAuthApi(apiService)
      const updateData: BotUpdateRequest = {
        name: botForm.name,
        description: botForm.description,
        model: botForm.model,
        logo_url: botForm.logo_url,
        status: botForm.status,
        settings: botForm.settings,
      }
      const response = await botService.updateBot(selectedBot.bot_id, updateData)
      if (!response?.success) {
        throw new Error(response?.message || "Failed to update bot")
      }
      return response
    },
    {
      onSuccess: (response) => {
        const responseData = (response as { data?: BotType })?.data
        if (responseData) {
          showSuccess("Bot updated successfully")
          
          // Optimistically update state immediately (WebSocket will sync if needed)
          setBots((prev) =>
            prev.map((b) => (b.bot_id === responseData.bot_id ? responseData : b))
          )
          
          setSelectedBot(responseData)
        }
      },
      showErrorToast: true,
      showSuccessToast: false,
    }
  )

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, bot: BotType) => {
    e.stopPropagation()
    setBotToDelete(bot)
    setDeleteDialogOpen(true)
  }

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!botToDelete || !apiService) {
      throw new Error("Bot or API service not available")
    }
    
    if (!botToDelete.bot_id || botToDelete.bot_id === 'undefined') {
      throw new Error("Invalid bot ID")
    }

    botService.setAuthApi(apiService)
    const response = await botService.deleteBot(botToDelete.bot_id)
    if (!response?.success) {
      throw new Error(response?.message || "Failed to delete bot")
    }
    showSuccess("Bot deleted successfully")
    setDeleteDialogOpen(false)
    const deletedBotId = botToDelete.bot_id
    setBotToDelete(null)
    
    // Optimistically update state immediately (WebSocket will sync if needed)
    setBots((prev) => prev.filter((b) => b.bot_id !== deletedBotId))
    
    if (selectedBot?.bot_id === deletedBotId) {
      setIsSidePanelOpen(false)
      setSelectedBot(null)
    }
  }


  if (authLoading) {
    return (
      <MainLayout title="Bot Configuration" description="Configure and fine-tune AI bots">
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
      title="Bot Configuration"
      description="Configure and fine-tune AI bots for chat, call, and voice interactions"
      actions={
        <div className="flex gap-2">
          <Button onClick={() => setIsGuidePanelOpen(true)} variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Guide</span>
          </Button>
          <Button onClick={handleCreateClick} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Bot</span>
          </Button>
          <Button onClick={() => fetchBots.execute()} variant="outline" className="gap-2" disabled={fetchBots.loading}>
            <RefreshCw className={`h-4 w-4 ${fetchBots.loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      }
    >
      <div className="w-full px-4 md:px-6 pt-0">
        {/* Bots List */}
        <Card className="border-0 shadow-sm mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI Bots ({bots.length})</CardTitle>
            <CardDescription className="text-xs">Manage your AI bots and fine-tune models</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {bots.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">No bots found</p>
                <Button onClick={handleCreateClick} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Bot
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {bots.map((bot) => {
                  const botCost = calculateCostEstimate(
                    bot.model,
                    bot.settings?.supports_chat || false,
                    bot.settings?.supports_call || false,
                    bot.settings?.supports_voice || false
                  )
                  
                  return (
                    <Card
                      key={bot.bot_id}
                      className="border-2 hover:border-primary/50 transition-all cursor-pointer hover:shadow-md"
                      onClick={() => handleBotSelect(bot)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {bot.logo_url ? (
                              <img src={bot.logo_url} alt={bot.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Bot className="h-6 w-6 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base truncate">{bot.name}</CardTitle>
                              <CardDescription className="text-xs truncate">
                                {getModelDisplayName(bot.model)}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant={
                              bot.status === "active"
                                ? "default"
                                : bot.status === "training"
                                ? "secondary"
                                : bot.status === "error"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {bot.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        {bot.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{bot.description}</p>
                        )}
                        
                        {/* Capabilities */}
                        <div className="flex flex-wrap gap-2">
                          {bot.settings?.supports_chat && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Chat
                            </Badge>
                          )}
                          {bot.settings?.supports_call && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Phone className="h-3 w-3" />
                              Call
                            </Badge>
                          )}
                          {bot.settings?.supports_voice && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Mic className="h-3 w-3" />
                              Voice
                            </Badge>
                          )}
                        </div>

                        {/* Cost Estimate */}
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Est. Monthly Cost:</span>
                            <span className="font-semibold text-foreground">
                              {formatCost(botCost.total_estimated_monthly)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBotSelect(bot)
                            }}
                          >
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                          {availableModels.find((m) => m.id === bot.model)?.supports_fine_tuning && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/admin/bots/fine-tune?bot_id=${bot.bot_id}`)
                              }}
                            >
                              <Sparkles className="h-3 w-3" />
                              Fine-tune
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={(e) => handleDeleteClick(e, bot)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Bot Side Panel */}
        <SidePanel
          open={isSidePanelOpen}
          onClose={() => {
            setIsSidePanelOpen(false)
            setIsCreating(false)
            setSelectedBot(null)
          }}
          title={isCreating ? "Create New Bot" : selectedBot ? `Edit: ${selectedBot.name}` : "Bot Configuration"}
          width="lg"
        >
          <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Bot Name *</label>
                    <Input
                      placeholder="Enter bot name"
                      value={botForm.name}
                      onChange={(e) => setBotForm({ ...botForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Model *</label>
                    <div className="space-y-2">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={botForm.model}
                        onChange={(e) => setBotForm({ ...botForm, model: e.target.value })}
                      >
                        {availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {getModelDisplayName(model.id)} {model.supports_fine_tuning ? "✓ Fine-tunable" : ""}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="gpt-4o-2024-08-06">GPT-4o</option>
                            <option value="gpt-4o-mini-2024-07-18">GPT-4o Mini ✓ Fine-tunable</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo ✓ Fine-tunable</option>
                          </>
                        )}
                      </select>
                      {botForm.model && availableModels.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {availableModels.find((m) => m.id === botForm.model)?.supports_fine_tuning ? (
                            <>
                              <Sparkles className="h-3 w-3 text-primary" />
                              <span>This model supports fine-tuning. You can fine-tune it later.</span>
                            </>
                          ) : (
                            <>
                              <Bot className="h-3 w-3" />
                              <span>This model can be used directly without fine-tuning.</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Description</label>
                  <Textarea
                    placeholder="Enter bot description"
                    value={botForm.description}
                    onChange={(e) => setBotForm({ ...botForm, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Logo URL</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter logo URL"
                      value={botForm.logo_url}
                      onChange={(e) => setBotForm({ ...botForm, logo_url: e.target.value })}
                    />
                    {botForm.logo_url && (
                      <img src={botForm.logo_url} alt="Logo preview" className="h-10 w-10 rounded object-cover" />
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <label className="text-sm font-semibold">Status</label>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${botForm.status === "active" ? "bg-green-100 dark:bg-green-900/20" : "bg-muted"}`}>
                        <Power className={`h-5 w-5 ${botForm.status === "active" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {botForm.status === "active" ? "Active" : "Inactive"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {botForm.status === "active" 
                            ? "Bot is currently active and ready to use" 
                            : "Bot is inactive and will not respond to requests"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={botForm.status === "active"}
                      onCheckedChange={(checked) =>
                        setBotForm({
                          ...botForm,
                          status: checked ? "active" : "inactive",
                        })
                      }
                      label=""
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Temperature</label>
                      <Input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={botForm.settings?.temperature || 0.7}
                        onChange={(e) =>
                          setBotForm({
                            ...botForm,
                            settings: { ...botForm.settings, temperature: parseFloat(e.target.value) },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Tokens</label>
                      <Input
                        type="number"
                        min="1"
                        max="8000"
                        value={botForm.settings?.max_tokens || 2000}
                        onChange={(e) =>
                          setBotForm({
                            ...botForm,
                            settings: { ...botForm.settings, max_tokens: parseInt(e.target.value) },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold">Capabilities</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <ToggleButton
                        checked={botForm.settings?.supports_chat || false}
                        onCheckedChange={(checked) =>
                          setBotForm({
                            ...botForm,
                            settings: { ...botForm.settings, supports_chat: checked },
                          })
                        }
                        icon={<MessageSquare className="h-5 w-5" />}
                        label="Chat"
                        variant="primary"
                        size="md"
                        className="w-full"
                      />
                      <ToggleButton
                        checked={botForm.settings?.supports_call || false}
                        onCheckedChange={(checked) =>
                          setBotForm({
                            ...botForm,
                            settings: { ...botForm.settings, supports_call: checked },
                          })
                        }
                        icon={<Phone className="h-5 w-5" />}
                        label="Call"
                        variant="success"
                        size="md"
                        className="w-full"
                      />
                      <ToggleButton
                        checked={botForm.settings?.supports_voice || false}
                        onCheckedChange={(checked) =>
                          setBotForm({
                            ...botForm,
                            settings: { ...botForm.settings, supports_voice: checked },
                          })
                        }
                        icon={<Mic className="h-5 w-5" />}
                        label="Voice"
                        variant="warning"
                        size="md"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Cost Estimation */}
                {costEstimate && (
                  <Card className="border-2 bg-muted/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Estimated Monthly Costs</CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Based on typical usage patterns (10K messages, 100h calls, 50h voice)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {botForm.settings?.supports_chat && (
                          <div className="p-3 rounded-lg border bg-background">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium">Chat</span>
                            </div>
                            <div className="text-sm font-semibold">{formatCost(costEstimate.chat.estimated_monthly)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCost(costEstimate.chat.input_cost_per_1k)}/1K input
                              <br />
                              {formatCost(costEstimate.chat.output_cost_per_1k)}/1K output
                            </div>
                          </div>
                        )}
                        {botForm.settings?.supports_call && (
                          <div className="p-3 rounded-lg border bg-background">
                            <div className="flex items-center gap-2 mb-2">
                              <Phone className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium">Call</span>
                            </div>
                            <div className="text-sm font-semibold">{formatCost(costEstimate.call.estimated_monthly)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCost(costEstimate.call.cost_per_minute)}/minute
                            </div>
                          </div>
                        )}
                        {botForm.settings?.supports_voice && (
                          <div className="p-3 rounded-lg border bg-background">
                            <div className="flex items-center gap-2 mb-2">
                              <Mic className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium">Voice</span>
                            </div>
                            <div className="text-sm font-semibold">{formatCost(costEstimate.voice.estimated_monthly)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCost(costEstimate.voice.cost_per_minute)}/minute
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Total Estimated Monthly:</span>
                          <span className="text-lg font-bold text-primary">
                            {formatCost(costEstimate.total_estimated_monthly)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  {isCreating ? (
                    <Button onClick={() => createBot.execute()} disabled={createBot.loading} className="gap-2 flex-1">
                      {createBot.loading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Create Bot
                    </Button>
                  ) : (
                    <Button onClick={() => updateBot.execute()} disabled={updateBot.loading} className="gap-2 flex-1">
                      {updateBot.loading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Update Bot
                    </Button>
                  )}
                </div>
              </div>
          </div>
        </SidePanel>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false)
            setBotToDelete(null)
          }}
          onConfirm={handleConfirmDelete}
          title="Delete Bot"
          description={botToDelete ? `Are you sure you want to delete "${botToDelete.name}"? This action cannot be undone.` : "Are you sure you want to delete this bot?"}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          successMessage="Bot deleted successfully!"
          errorMessage="Failed to delete bot. Please try again."
          autoCloseOnSuccess={true}
          autoCloseDelay={1500}
        />
      </div>
      <GuideSidePanel open={isGuidePanelOpen} onClose={() => setIsGuidePanelOpen(false)} />
    </MainLayout>
  )
}
