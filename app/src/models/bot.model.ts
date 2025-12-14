/**
 * Bot Configuration Models
 */

export interface Bot {
  bot_id: string
  name: string
  description?: string
  model: string
  logo_url?: string
  fine_tuned_model_id?: string
  training_file_id?: string
  status: "active" | "inactive" | "training" | "error"
  created_at: string
  updated_at: string
  created_by?: string
  settings?: BotSettings
}

export interface BotSettings {
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  system_prompt?: string
  supports_chat?: boolean
  supports_call?: boolean
  supports_voice?: boolean
}

export interface BotCreateRequest {
  name: string
  description?: string
  model: string
  logo_url?: string
  status?: "active" | "inactive" | "training" | "error"
  settings?: BotSettings
}

export interface BotUpdateRequest {
  name?: string
  description?: string
  model?: string
  logo_url?: string
  status?: "active" | "inactive" | "training" | "error"
  settings?: BotSettings
}

export interface FineTuneJob {
  job_id: string
  bot_id: string
  training_file_id: string
  validation_file_id?: string // Optional validation file for supervised fine-tuning
  openai_job_id?: string
  status: "pending" | "validating_files" | "running" | "succeeded" | "failed" | "cancelled"
  fine_tuned_model_id?: string
  error?: {
    message: string
    code?: string
  }
  created_at: string
  finished_at?: string
  trained_tokens?: number
  hyperparameters?: {
    n_epochs?: number | "auto"
    batch_size?: number | "auto"
    learning_rate_multiplier?: number | "auto"
    // Metadata stored in hyperparameters
    _metadata?: {
      training_method?: "supervised" | "reinforcement"
      model_type?: "chat" | "calling" | "voice"
      base_model?: string
      suffix?: string
      validation_file_id?: string
    }
    // Training metrics stored in hyperparameters
    _training_metrics?: {
      train_loss?: number
      train_accuracy?: number
      valid_loss?: number
      valid_accuracy?: number
      checkpoints?: Array<{
        step: number
        loss: number
        accuracy?: number
      }>
    }
    _result_files?: string[] // OpenAI result file IDs
  }
  // Time Tracking
  validation_started_at?: string
  validation_ended_at?: string
  training_started_at?: string
  training_ended_at?: string
  total_duration_seconds?: number
  validation_duration_seconds?: number
  training_duration_seconds?: number
  // Training Metrics
  training_cost_usd?: number
  file_size_bytes?: number
  total_examples?: number
  bot?: {
    bot_id: string
    name: string
    model: string
  }
  // Training Events (from OpenAI events API)
  events?: FineTuneJobEvent[]
  // Enhancement Chain
  parent_job_id?: string // Parent job ID if this is an enhancement
  parentJob?: FineTuneJob // Parent job relation
  childJobs?: FineTuneJob[] // Child jobs relation
}

export interface FineTuneJobEvent {
  id: string
  created_at: number
  level: "info" | "warn" | "error"
  message: string
  data?: Record<string, unknown>
  object: "fine_tuning.job.event"
}

export interface TrainingDataEntry {
  messages: Array<{
    role: "user" | "assistant" | "system"
    content: string
  }>
}

export interface TrainingDataValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  entry_count: number
  sample_entries: TrainingDataEntry[]
}

export interface FineTuneJobCreateRequest {
  bot_id: string
  training_file_id: string
  validation_file_id?: string // Optional validation file for supervised fine-tuning
  model?: string
  training_method?: "supervised" | "reinforcement" // Training method
  model_type?: "chat" | "calling" | "voice" // Primary model type
  model_types?: Array<"chat" | "calling" | "voice"> // Multiple model types for multi-type fine-tuning
  suffix?: string // Optional suffix for fine-tuned model name
  parent_job_id?: string // Parent job ID if this is an enhancement job
  hyperparameters?: {
    n_epochs?: number | "auto"
    batch_size?: number | "auto"
    learning_rate_multiplier?: number | "auto"
  }
}

// Dataset Model
export interface Dataset {
  dataset_id: string
  title: string
  description?: string
  dataset_type: "chat" | "calling" | "voice" | "all"
  content?: string // JSONL content (null while generating)
  training_content?: string // 80% for training
  test_content?: string // 20% for testing
  file_id?: string // OpenAI file ID if uploaded
  num_examples?: number // Number of examples (null while generating)
  training_examples_count?: number
  test_examples_count?: number
  tags?: string[]
  metadata?: Record<string, unknown>
  is_active: boolean
  
  // Generation job fields (merged from DatasetGenerationJob)
  status?: "pending" | "processing" | "completed" | "failed" // Generation status
  progress?: number // 0-100 percentage
  current_batch?: number
  total_batches?: number
  generated_count?: number
  error?: {
    message: string
    timestamp?: string
  }
  completed_at?: string
  
  created_by?: string
  created_at: string
  updated_at: string
  createdBy?: {
    user_id: string
    first_name?: string
    last_name?: string
    email?: string
  }
}

export interface DatasetCreateRequest {
  title: string
  description?: string
  dataset_type: "chat" | "calling" | "voice" | "all"
  content: string
  num_examples?: number
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface DatasetUpdateRequest {
  title?: string
  description?: string
  dataset_type?: "chat" | "calling" | "voice" | "all"
  content?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  is_active?: boolean
}

// Training Report Model
export interface TrainingReport {
  report_id: string
  fine_tune_job_id?: string
  bot_id?: string
  dataset_id?: string
  training_file_id?: string
  test_file_id?: string
  training_examples: number
  test_examples: number
  accuracy?: number
  precision?: number
  recall?: number
  f1_score?: number
  perplexity?: number
  detailed_metrics?: Record<string, unknown>
  confusion_matrix?: Record<string, unknown>
  test_results?: Array<{
    input: string
    expected: string
    predicted: string
    correct: boolean
    similarity: number
  }>
  model_name?: string
  base_model?: string
  fine_tuned_model?: string
  status: "pending" | "testing" | "completed" | "failed"
  error?: {
    message: string
    timestamp?: string
  }
  metadata?: Record<string, unknown>
  created_by?: string
  created_at: string
  updated_at: string
  completed_at?: string
  bot?: {
    bot_id: string
    name: string
    model: string
    status: string
  }
  fineTuneJob?: {
    job_id: string
    status: string
    fine_tuned_model_id?: string
    created_at: string
    finished_at?: string
  }
  dataset?: {
    dataset_id: string
    title: string
    description?: string
    num_examples: number
    dataset_type: string
  }
}


