import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'

interface OpenAIModel {
  id: string
  created: number
  owned_by: string
}

interface FormattedModel {
  id: string
  name: string
  created: number
  owned_by: string
  supports_fine_tuning: boolean
}

/**
 * Get available OpenAI models
 * GET /api/bots/models
 * Admin only
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return ERROR.json('OPENAI_API_KEY_NOT_CONFIGURED', {})
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('OpenAI models fetch failed', { extraData: { error } })
        return ERROR.json('FETCH_MODELS_FAILED', { error: error.error?.message || 'Failed to fetch models' })
      }

      const data = await response.json() as { data?: OpenAIModel[] }
      
      // Filter and format models - show ALL GPT models (not just fine-tunable)
      const gptModels: FormattedModel[] = data.data
        ?.filter((model: OpenAIModel) => 
          model.id.includes('gpt') && 
          !model.id.includes('instruct') && // Exclude instruction-tuned variants
          !model.id.includes('vision') // Exclude vision models (they're separate)
        )
        .map((model: OpenAIModel) => ({
          id: model.id,
          name: model.id,
          created: model.created,
          owned_by: model.owned_by,
          // Check if model supports fine-tuning based on OpenAI's known fine-tunable models
          supports_fine_tuning: model.id.includes('gpt-4o-mini') || 
                                model.id.includes('gpt-3.5-turbo') ||
                                model.id.includes('gpt-4-0125') ||
                                model.id.includes('gpt-4-1106'),
        }))
        .sort((a: FormattedModel, b: FormattedModel) => b.created - a.created) || []

      // Add some default models if API doesn't return them
      const defaultModels: FormattedModel[] = [
        {
          id: 'gpt-4o-2024-08-06',
          name: 'GPT-4o',
          created: 1715297890,
          owned_by: 'openai',
          supports_fine_tuning: false,
        },
        {
          id: 'gpt-4o-mini-2024-07-18',
          name: 'GPT-4o Mini',
          created: 1721250000,
          owned_by: 'openai',
          supports_fine_tuning: true,
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          created: 1700000000,
          owned_by: 'openai',
          supports_fine_tuning: false,
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          created: 1670000000,
          owned_by: 'openai',
          supports_fine_tuning: true,
        },
      ]

      // Merge and deduplicate
      const allModels = [...defaultModels, ...gptModels]
      const uniqueModels = Array.from(
        new Map(allModels.map((model) => [model.id, model])).values()
      )

      return SUCCESS.json('Models retrieved successfully', uniqueModels)
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error'
      logger.error('Error fetching OpenAI models', { extraData: { error: errorMessage } })
      
      // Return default models if API fails
      const defaultModels: FormattedModel[] = [
        {
          id: 'gpt-4o-2024-08-06',
          name: 'GPT-4o',
          created: 1715297890,
          owned_by: 'openai',
          supports_fine_tuning: false,
        },
        {
          id: 'gpt-4o-mini-2024-07-18',
          name: 'GPT-4o Mini',
          created: 1721250000,
          owned_by: 'openai',
          supports_fine_tuning: true,
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          created: 1700000000,
          owned_by: 'openai',
          supports_fine_tuning: false,
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          created: 1670000000,
          owned_by: 'openai',
          supports_fine_tuning: true,
        },
      ]
      
      return SUCCESS.json('Models retrieved successfully (using defaults)', defaultModels)
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching models', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

