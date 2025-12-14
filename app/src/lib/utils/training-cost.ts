/**
 * Training Cost Calculator
 * Calculates costs for OpenAI fine-tuning based on model type and tokens
 */

export interface TrainingCostBreakdown {
  trainingCost: number
  validationCost: number
  totalCost: number
  costPerToken: number
  tokensTrained: number
  tokensValidated?: number
  modelType: string
}

/**
 * OpenAI Fine-tuning Pricing (as of 2024)
 * Training: $0.008 per 1K tokens
 * Validation: $0.008 per 1K tokens (if validation file provided)
 * 
 * Note: Prices may vary by model. This is for gpt-4o-mini and gpt-3.5-turbo
 */
export const TRAINING_COST_PER_1K_TOKENS = 0.008
export const VALIDATION_COST_PER_1K_TOKENS = 0.008

/**
 * Calculate training cost based on tokens
 */
export function calculateTrainingCost(
  tokens: number,
  validationTokens?: number,
  modelType: string = 'gpt-4o-mini'
): TrainingCostBreakdown {
  const trainingCost = (tokens / 1000) * TRAINING_COST_PER_1K_TOKENS
  const validationCost = validationTokens ? (validationTokens / 1000) * VALIDATION_COST_PER_1K_TOKENS : 0
  const totalCost = trainingCost + validationCost
  const costPerToken = tokens > 0 ? totalCost / tokens : 0

  return {
    trainingCost,
    validationCost,
    totalCost,
    costPerToken,
    tokensTrained: tokens,
    tokensValidated: validationTokens,
    modelType,
  }
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`
  } else if (cost < 1) {
    return `$${cost.toFixed(4)}`
  } else {
    return `$${cost.toFixed(2)}`
  }
}

/**
 * Estimate cost before training based on file size
 */
export function estimateTrainingCost(
  fileSizeBytes: number,
  hasValidationFile: boolean = false
): TrainingCostBreakdown {
  // Rough estimate: ~500 bytes per example, ~100 tokens per example
  const estimatedExamples = Math.floor(fileSizeBytes / 500)
  const estimatedTokens = estimatedExamples * 100
  
  // Add 20% buffer for overhead
  const tokensWithBuffer = Math.floor(estimatedTokens * 1.2)
  const validationTokens = hasValidationFile ? Math.floor(tokensWithBuffer * 0.1) : undefined

  return calculateTrainingCost(tokensWithBuffer, validationTokens)
}

