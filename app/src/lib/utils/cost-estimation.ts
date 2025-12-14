/**
 * Cost Estimation Utility
 * Calculates estimated costs for OpenAI API usage (chat, call, voice)
 */

export interface CostEstimate {
  chat: {
    input_cost_per_1k: number
    output_cost_per_1k: number
    estimated_monthly: number // Based on 10k messages/month
  }
  call: {
    cost_per_minute: number
    estimated_monthly: number // Based on 100 hours/month
  }
  voice: {
    cost_per_minute: number
    estimated_monthly: number // Based on 50 hours/month
  }
  total_estimated_monthly: number
}

// OpenAI Pricing (as of 2024) - in USD
const MODEL_PRICING: Record<string, {
  input: number // per 1M tokens
  output: number // per 1M tokens
  call?: number // per minute (for voice/call)
}> = {
  'gpt-4o-2024-08-06': {
    input: 2.50, // $2.50 per 1M input tokens
    output: 10.00, // $10.00 per 1M output tokens
    call: 0.15, // $0.15 per minute for voice/call
  },
  'gpt-4o-mini-2024-07-18': {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.60, // $0.60 per 1M output tokens
    call: 0.06, // $0.06 per minute for voice/call
  },
  'gpt-4-turbo': {
    input: 10.00, // $10.00 per 1M input tokens
    output: 30.00, // $30.00 per 1M output tokens
    call: 0.30, // $0.30 per minute for voice/call
  },
  'gpt-3.5-turbo': {
    input: 0.50, // $0.50 per 1M input tokens
    output: 1.50, // $1.50 per 1M output tokens
    call: 0.10, // $0.10 per minute for voice/call
  },
}

// Default usage assumptions
const DEFAULT_USAGE = {
  chat: {
    messages_per_month: 10000,
    avg_input_tokens: 500, // Average tokens per message input
    avg_output_tokens: 300, // Average tokens per message output
  },
  call: {
    hours_per_month: 100,
    minutes_per_month: 100 * 60, // 6000 minutes
  },
  voice: {
    hours_per_month: 50,
    minutes_per_month: 50 * 60, // 3000 minutes
  },
}

/**
 * Calculate cost estimate for a model
 */
export function calculateCostEstimate(
  modelId: string,
  supportsChat: boolean = true,
  supportsCall: boolean = false,
  supportsVoice: boolean = false
): CostEstimate {
  const pricing = MODEL_PRICING[modelId] || MODEL_PRICING['gpt-4o-mini-2024-07-18']
  
  let chatCost = 0
  let callCost = 0
  let voiceCost = 0

  // Chat cost calculation
  if (supportsChat) {
    const inputTokens = (DEFAULT_USAGE.chat.messages_per_month * DEFAULT_USAGE.chat.avg_input_tokens) / 1000000
    const outputTokens = (DEFAULT_USAGE.chat.messages_per_month * DEFAULT_USAGE.chat.avg_output_tokens) / 1000000
    
    const inputCost = inputTokens * pricing.input
    const outputCost = outputTokens * pricing.output
    
    chatCost = inputCost + outputCost
  }

  // Call cost calculation
  if (supportsCall && pricing.call) {
    callCost = (DEFAULT_USAGE.call.minutes_per_month * pricing.call) / 1000 // Convert to dollars
  }

  // Voice cost calculation
  if (supportsVoice && pricing.call) {
    voiceCost = (DEFAULT_USAGE.voice.minutes_per_month * pricing.call) / 1000 // Convert to dollars
  }

  return {
    chat: {
      input_cost_per_1k: pricing.input / 1000, // Cost per 1K tokens
      output_cost_per_1k: pricing.output / 1000,
      estimated_monthly: chatCost,
    },
    call: {
      cost_per_minute: pricing.call ? pricing.call / 1000 : 0,
      estimated_monthly: callCost,
    },
    voice: {
      cost_per_minute: pricing.call ? pricing.call / 1000 : 0,
      estimated_monthly: voiceCost,
    },
    total_estimated_monthly: chatCost + callCost + voiceCost,
  }
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}/1K`
  }
  return `$${cost.toFixed(2)}`
}

/**
 * Get model display name
 */
export function getModelDisplayName(modelId: string): string {
  const names: Record<string, string> = {
    'gpt-4o-2024-08-06': 'GPT-4o',
    'gpt-4o-mini-2024-07-18': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  }
  return names[modelId] || modelId
}

