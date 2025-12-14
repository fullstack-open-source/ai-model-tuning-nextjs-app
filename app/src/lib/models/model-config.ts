/**
 * OpenAI Model Configuration
 * Maps models to their supported fine-tuning types (chat, calling, voice)
 * Based on OpenAI's official documentation
 */

export type ModelType = 'chat' | 'calling' | 'voice'
export type TrainingMethod = 'supervised' | 'reinforcement'

export interface ModelConfig {
  id: string
  name: string
  supportsFineTuning: boolean
  supportedTypes: ModelType[] // Which types this model supports
  defaultType?: ModelType // Default type if model supports multiple
  trainingMethods: TrainingMethod[] // Which training methods are supported
  description?: string
  category?: string // e.g., 'GPT-4o', 'GPT-3.5', 'GPT-5'
}

/**
 * OpenAI Model Configuration
 * Based on official OpenAI documentation and fine-tuning capabilities
 */
export const OPENAI_MODELS: ModelConfig[] = [
  // GPT-4o Models
  {
    id: 'gpt-4o-mini-2024-07-18',
    name: 'GPT-4o Mini',
    supportsFineTuning: true,
    supportedTypes: ['chat', 'calling', 'voice'], // Supports all types
    defaultType: 'chat',
    trainingMethods: ['supervised'],
    description: 'Fast and efficient model for chat, calling, and voice applications',
    category: 'GPT-4o',
  },
  {
    id: 'gpt-4o-2024-08-06',
    name: 'GPT-4o',
    supportsFineTuning: false,
    supportedTypes: ['chat', 'calling', 'voice'],
    defaultType: 'chat',
    trainingMethods: [],
    description: 'Advanced model (fine-tuning not yet available)',
    category: 'GPT-4o',
  },

  // GPT-3.5 Models
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    supportsFineTuning: true,
    supportedTypes: ['chat'], // Primarily for chat
    defaultType: 'chat',
    trainingMethods: ['supervised'],
    description: 'Cost-effective model for chat applications',
    category: 'GPT-3.5',
  },

  // GPT-5 Models (if available)
  {
    id: 'gpt-5-pro',
    name: 'GPT-5 Pro',
    supportsFineTuning: false,
    supportedTypes: ['chat', 'calling', 'voice'],
    defaultType: 'chat',
    trainingMethods: [],
    description: 'Next-generation model',
    category: 'GPT-5',
  },
  {
    id: 'gpt-5-pro-2025-10-06',
    name: 'GPT-5 Pro (2025-10-06)',
    supportsFineTuning: false,
    supportedTypes: ['chat', 'calling', 'voice'],
    defaultType: 'chat',
    trainingMethods: [],
    category: 'GPT-5',
  },
  {
    id: 'gpt-realtime-mini',
    name: 'GPT Realtime Mini',
    supportsFineTuning: false,
    supportedTypes: ['calling', 'voice'], // Specialized for real-time interactions
    defaultType: 'calling',
    trainingMethods: [],
    description: 'Optimized for real-time calling and voice interactions',
    category: 'GPT-5',
  },
  {
    id: 'gpt-realtime-mini-2025-10-06',
    name: 'GPT Realtime Mini (2025-10-06)',
    supportsFineTuning: false,
    supportedTypes: ['calling', 'voice'],
    defaultType: 'calling',
    trainingMethods: [],
    category: 'GPT-5',
  },
  {
    id: 'gpt-audio-mini',
    name: 'GPT Audio Mini',
    supportsFineTuning: false,
    supportedTypes: ['voice'], // Specialized for voice/audio
    defaultType: 'voice',
    trainingMethods: [],
    description: 'Optimized for voice and audio applications',
    category: 'GPT-5',
  },
  {
    id: 'gpt-audio-mini-2025-10-06',
    name: 'GPT Audio Mini (2025-10-06)',
    supportsFineTuning: false,
    supportedTypes: ['voice'],
    defaultType: 'voice',
    trainingMethods: [],
    category: 'GPT-5',
  },
  {
    id: 'gpt-5-codex',
    name: 'GPT-5 Codex',
    supportsFineTuning: false,
    supportedTypes: ['chat'], // Code generation is chat-based
    defaultType: 'chat',
    trainingMethods: [],
    description: 'Specialized for code generation',
    category: 'GPT-5',
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    supportsFineTuning: false,
    supportedTypes: ['chat', 'calling', 'voice'],
    defaultType: 'chat',
    trainingMethods: [],
    category: 'GPT-5.1',
  },
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    supportsFineTuning: false,
    supportedTypes: ['chat'],
    defaultType: 'chat',
    trainingMethods: [],
    category: 'GPT-5.1',
  },
  {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    supportsFineTuning: false,
    supportedTypes: ['chat'],
    defaultType: 'chat',
    trainingMethods: [],
    category: 'GPT-5.1',
  },
  {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    supportsFineTuning: false,
    supportedTypes: ['chat'],
    defaultType: 'chat',
    trainingMethods: [],
    category: 'GPT-5.1',
  },
  {
    id: 'gpt-5.1-chat-latest',
    name: 'GPT-5.1 Chat Latest',
    supportsFineTuning: false,
    supportedTypes: ['chat'],
    defaultType: 'chat',
    trainingMethods: [],
    category: 'GPT-5.1',
  },
  {
    id: 'gpt-image-1-mini',
    name: 'GPT Image 1 Mini',
    supportsFineTuning: false,
    supportedTypes: ['chat'], // Image models typically used via chat interface
    defaultType: 'chat',
    trainingMethods: [],
    description: 'Specialized for image generation',
    category: 'GPT-5',
  },
  {
    id: 'gpt-5-search-api',
    name: 'GPT-5 Search API',
    supportsFineTuning: false,
    supportedTypes: ['chat'],
    defaultType: 'chat',
    trainingMethods: [],
    description: 'Specialized for search applications',
    category: 'GPT-5',
  },
  {
    id: 'gpt-5-search-api-2025-10-14',
    name: 'GPT-5 Search API (2025-10-14)',
    supportsFineTuning: false,
    supportedTypes: ['chat'],
    defaultType: 'chat',
    trainingMethods: [],
    category: 'GPT-5',
  },
]

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return OPENAI_MODELS.find((model) => model.id === modelId)
}

/**
 * Get all fine-tunable models
 */
export function getFineTunableModels(): ModelConfig[] {
  return OPENAI_MODELS.filter((model) => model.supportsFineTuning)
}

/**
 * Get models that support a specific type
 */
export function getModelsByType(type: ModelType): ModelConfig[] {
  return OPENAI_MODELS.filter((model) => model.supportedTypes.includes(type))
}

/**
 * Get models that support multiple types (chat, calling, voice)
 */
export function getMultiTypeModels(): ModelConfig[] {
  return OPENAI_MODELS.filter((model) => model.supportedTypes.length > 1)
}

/**
 * Check if a model supports a specific type
 */
export function modelSupportsType(modelId: string, type: ModelType): boolean {
  const config = getModelConfig(modelId)
  return config ? config.supportedTypes.includes(type) : false
}

/**
 * Get compatible dataset types for a model
 */
export function getCompatibleDatasetTypes(modelId: string): ModelType[] {
  const config = getModelConfig(modelId)
  return config ? config.supportedTypes : []
}

/**
 * Get default model type for a model
 */
export function getDefaultModelType(modelId: string): ModelType | undefined {
  const config = getModelConfig(modelId)
  return config?.defaultType || config?.supportedTypes[0]
}

