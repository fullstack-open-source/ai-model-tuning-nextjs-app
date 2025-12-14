/**
 * Fine-tune Service
 * Handles fine-tuning operations for ChatGPT models
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory'
import type { ApiService } from '@lib/api/ApiService'
import type {
  FineTuneJob,
  FineTuneJobCreateRequest,
  TrainingDataValidation,
} from '@models/bot.model'
import type { ApiResponse } from '@models/api.model'

class FineTuneService {
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
   * Upload training data file
   */
  async uploadTrainingFile(file: File): Promise<ApiResponse<{ file_id: string }>> {
    const formData = new FormData()
    formData.append('file', file)
    return await this.api.post<ApiResponse<{ file_id: string }>>('/fine-tune/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  /**
   * Validate training data
   */
  async validateTrainingData(file: File): Promise<ApiResponse<TrainingDataValidation>> {
    const formData = new FormData()
    formData.append('file', file)
    return await this.api.post<ApiResponse<TrainingDataValidation>>('/fine-tune/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  /**
   * Preview training data (returns JSON structure)
   */
  async previewTrainingData(file: File): Promise<ApiResponse<{ entries: any[]; total: number }>> {
    const formData = new FormData()
    formData.append('file', file)
    return await this.api.post<ApiResponse<{ entries: any[]; total: number }>>('/fine-tune/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  /**
   * Create fine-tuning job
   */
  async createFineTuneJob(data: FineTuneJobCreateRequest): Promise<ApiResponse<FineTuneJob>> {
    return await this.api.post<ApiResponse<FineTuneJob>>('/fine-tune/jobs', data)
  }

  /**
   * Get fine-tuning job status
   */
  async getFineTuneJobStatus(jobId: string): Promise<ApiResponse<FineTuneJob>> {
    return await this.api.get<ApiResponse<FineTuneJob>>(`/fine-tune/jobs/${jobId}`)
  }

  /**
   * List fine-tuning jobs for a bot (or all jobs if botId is not provided)
   */
  async listFineTuneJobs(botId?: string): Promise<ApiResponse<FineTuneJob[]>> {
    const url = botId ? `/fine-tune/jobs?bot_id=${botId}` : '/fine-tune/jobs'
    return await this.api.get<ApiResponse<FineTuneJob[]>>(url)
  }

  /**
   * Cancel fine-tuning job
   */
  async cancelFineTuneJob(jobId: string): Promise<ApiResponse<void>> {
    return await this.api.post<ApiResponse<void>>(`/fine-tune/jobs/${jobId}/cancel`)
  }

  /**
   * Get fine-tuning job events
   */
  async getFineTuneJobEvents(jobId: string): Promise<ApiResponse<any[]>> {
    return await this.api.get<ApiResponse<any[]>>(`/fine-tune/jobs/${jobId}/events`)
  }

  /**
   * Generate training dataset
   */
  async generateDataset(data: {
    title: string
    description: string
    num_examples?: number
    dataset_type?: 'chat' | 'calling' | 'voice' | 'all'
  }): Promise<ApiResponse<{ content: string; examples: any[]; count: number; dataset_id?: string }>> {
    return await this.api.post<ApiResponse<{ content: string; examples: any[]; count: number; dataset_id?: string }>>(
      '/fine-tune/generate-dataset',
      data
    )
  }
}

// Export singleton instance
export const fineTuneService = new FineTuneService()

// Dataset Service
import type { Dataset, DatasetCreateRequest, DatasetUpdateRequest } from '@models/bot.model'

class DatasetService {
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
   * Get all datasets
   */
  async listDatasets(params?: {
    dataset_type?: string
    search?: string
    limit?: number
    offset?: number
    is_active?: boolean
  }): Promise<ApiResponse<{ datasets: Dataset[]; pagination: any }>> {
    const queryParams = new URLSearchParams()
    if (params?.dataset_type) queryParams.append('dataset_type', params.dataset_type)
    if (params?.search) queryParams.append('search', params.search)
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.offset) queryParams.append('offset', String(params.offset))
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active))

    const query = queryParams.toString()
    return await this.api.get<ApiResponse<{ datasets: Dataset[]; pagination: any }>>(
      `/datasets${query ? `?${query}` : ''}`
    )
  }

  /**
   * Get dataset by ID
   */
  async getDataset(datasetId: string): Promise<ApiResponse<Dataset>> {
    return await this.api.get<ApiResponse<Dataset>>(`/datasets/${datasetId}`)
  }

  /**
   * Create dataset
   */
  async createDataset(data: DatasetCreateRequest): Promise<ApiResponse<Dataset>> {
    return await this.api.post<ApiResponse<Dataset>>('/datasets', data)
  }

  /**
   * Update dataset
   */
  async updateDataset(datasetId: string, data: DatasetUpdateRequest): Promise<ApiResponse<Dataset>> {
    return await this.api.patch<ApiResponse<Dataset>>(`/datasets/${datasetId}`, data)
  }

  /**
   * Delete dataset
   */
  async deleteDataset(datasetId: string): Promise<ApiResponse<void>> {
    return await this.api.delete<ApiResponse<void>>(`/datasets/${datasetId}`)
  }
}

export const datasetService = new DatasetService()

// Training Report Service
import type { TrainingReport } from '@models/bot.model'

class TrainingReportService {
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
   * Get all training reports
   */
  async listReports(params?: {
    bot_id?: string
    fine_tune_job_id?: string
    dataset_id?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<{ reports: TrainingReport[]; pagination: any }>> {
    const queryParams = new URLSearchParams()
    if (params?.bot_id) queryParams.append('bot_id', params.bot_id)
    if (params?.fine_tune_job_id) queryParams.append('fine_tune_job_id', params.fine_tune_job_id)
    if (params?.dataset_id) queryParams.append('dataset_id', params.dataset_id)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.offset) queryParams.append('offset', String(params.offset))

    const query = queryParams.toString()
    return await this.api.get<ApiResponse<{ reports: TrainingReport[]; pagination: any }>>(
      `/training-reports${query ? `?${query}` : ''}`
    )
  }

  /**
   * Get training report by ID
   */
  async getReport(reportId: string): Promise<ApiResponse<TrainingReport>> {
    return await this.api.get<ApiResponse<TrainingReport>>(`/training-reports/${reportId}`)
  }

  /**
   * Test model and generate report
   */
  async testModel(data: {
    fine_tune_job_id?: string
    bot_id?: string
    dataset_id?: string
    training_file_id?: string
    test_file_id?: string
    model_id: string
    test_examples: Array<{ messages: Array<{ role: string; content: string }> }>
  }): Promise<ApiResponse<TrainingReport>> {
    return await this.api.post<ApiResponse<TrainingReport>>('/fine-tune/test-model', data)
  }
}

export const trainingReportService = new TrainingReportService()

// Dataset Generation Job Service (now uses Dataset model)
class DatasetGenerationJobService {
  private api: ApiService

  constructor() {
    this.api = createPublicApiService()
  }

  setAuthApi(api: ApiService) {
    this.api = api
  }

  async listJobs(filters?: {
    limit?: number
    offset?: number
  }): Promise<ApiResponse<{ jobs: Dataset[]; pagination: any }>> {
    const params = new URLSearchParams()
    if (filters?.limit) params.append('limit', String(filters.limit))
    if (filters?.offset) params.append('offset', String(filters.offset))
    return await this.api.get<ApiResponse<{ jobs: Dataset[]; pagination: any }>>(`/datasets/generate?${params.toString()}`)
  }

  async getJob(jobId: string): Promise<ApiResponse<Dataset>> {
    return await this.api.get<ApiResponse<Dataset>>(`/datasets/generate/${jobId}`)
  }
}

export const datasetGenerationJobService = new DatasetGenerationJobService()

