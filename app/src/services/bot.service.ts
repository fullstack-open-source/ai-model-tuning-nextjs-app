/**
 * Bot Service
 * Handles bot configuration API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory'
import type { ApiService } from '@lib/api/ApiService'
import type { Bot, BotCreateRequest, BotUpdateRequest } from '@models/bot.model'
import type { ApiResponse } from '@models/api.model'

class BotService {
  private api: ApiService

  constructor() {
    this.api = createPublicApiService()
  }

  /**
   * Set authenticated API service
   */
  setAuthApi(api: ApiService) {
    this.api = api
  }

  /**
   * Get all bots
   */
  async getBots(): Promise<ApiResponse<Bot[]>> {
    return await this.api.get<ApiResponse<Bot[]>>('/bots')
  }

  /**
   * Get bot by ID
   */
  async getBotById(botId: string): Promise<ApiResponse<Bot>> {
    return await this.api.get<ApiResponse<Bot>>(`/bots/${botId}`)
  }

  /**
   * Create bot
   */
  async createBot(data: BotCreateRequest): Promise<ApiResponse<Bot>> {
    return await this.api.post<ApiResponse<Bot>>('/bots', data)
  }

  /**
   * Update bot
   */
  async updateBot(botId: string, data: BotUpdateRequest): Promise<ApiResponse<Bot>> {
    return await this.api.patch<ApiResponse<Bot>>(`/bots/${botId}`, data)
  }

  /**
   * Delete bot
   */
  async deleteBot(botId: string): Promise<ApiResponse<void>> {
    return await this.api.delete<ApiResponse<void>>(`/bots/${botId}`)
  }

  /**
   * Get available OpenAI models
   */
  async getAvailableModels(): Promise<ApiResponse<Array<{
    id: string
    name: string
    created: number
    owned_by: string
    supports_fine_tuning: boolean
  }>>> {
    return await this.api.get<ApiResponse<Array<{
      id: string
      name: string
      created: number
      owned_by: string
      supports_fine_tuning: boolean
    }>>>('/bots/models')
  }
}

// Export singleton instance
export const botService = new BotService()

