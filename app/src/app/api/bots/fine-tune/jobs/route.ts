import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import { emitFineTuneJobCreated } from '@lib/websocket/emitter'
import type { Prisma } from '@prisma/client'

/**
 * Create fine-tuning job
 * POST /api/fine-tune/jobs
 * Admin only
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const body = await req.json()
    const { 
      bot_id, 
      training_file_id, 
      validation_file_id, // Optional validation file for supervised fine-tuning
      model, 
      hyperparameters,
      training_method, // 'supervised' or 'reinforcement' (RLHF)
      model_type, // 'chat', 'calling', 'voice' (primary type)
      model_types, // Array of model types for multi-type fine-tuning
      suffix, // Optional suffix for fine-tuned model name
      parent_job_id, // Parent job ID if this is an enhancement job
    } = body

    if (!bot_id || !training_file_id) {
      return ERROR.json('MISSING_REQUIRED_FIELDS', { fields: ['bot_id', 'training_file_id'] })
    }

    // Validate training method
    const validTrainingMethods = ['supervised', 'reinforcement']
    const trainingMethod = training_method || 'supervised'
    if (!validTrainingMethods.includes(trainingMethod)) {
      return ERROR.json('INVALID_TRAINING_METHOD', { 
        valid_methods: validTrainingMethods,
        provided: trainingMethod 
      })
    }

    // Validate model type(s)
    const validModelTypes = ['chat', 'calling', 'voice']
    const modelType = model_type || 'chat'
    if (!validModelTypes.includes(modelType)) {
      return ERROR.json('INVALID_MODEL_TYPE', { 
        valid_types: validModelTypes,
        provided: modelType 
      })
    }

    // Validate model_types array if provided
    let validatedModelTypes: string[] = [modelType]
    if (model_types && Array.isArray(model_types)) {
      validatedModelTypes = model_types.filter((t: string) => validModelTypes.includes(t))
      if (validatedModelTypes.length === 0) {
        validatedModelTypes = [modelType] // Fallback to primary type
      }
    }

    // Verify bot exists
    const bot = await prisma.bot.findUnique({
      where: { bot_id },
    })

    if (!bot) {
      return ERROR.json('BOT_NOT_FOUND', { bot_id })
    }

    // Get OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return ERROR.json('OPENAI_API_KEY_NOT_CONFIGURED', {})
    }

    // Determine base model based on model type and OpenAI's official recommendations
    // For supervised fine-tuning, OpenAI supports: gpt-4o-mini, gpt-3.5-turbo, etc.
    // For different model types, we may need different base models
    let baseModel = model || bot.model
    if (!baseModel) {
      // Default models based on model type
      switch (modelType) {
        case 'chat':
          baseModel = 'gpt-4o-mini-2024-07-18'
          break
        case 'calling':
          baseModel = 'gpt-4o-mini-2024-07-18' // OpenAI's calling models
          break
        case 'voice':
          baseModel = 'gpt-4o-mini-2024-07-18' // OpenAI's voice models
          break
        default:
          baseModel = 'gpt-4o-mini-2024-07-18'
      }
    }
    
    // Get file size if available (from OpenAI file info)
    let fileSizeBytes: bigint | null = null
    let totalExamples: number | null = null
    try {
      const fileResponse = await fetch(`https://api.openai.com/v1/files/${training_file_id}`, {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
      })
      if (fileResponse.ok) {
        const fileInfo = await fileResponse.json()
        if (fileInfo.bytes) {
          fileSizeBytes = BigInt(fileInfo.bytes)
        }
        // Try to estimate examples from file size (rough estimate: ~500 bytes per example)
        if (fileSizeBytes) {
          totalExamples = Math.floor(Number(fileSizeBytes) / 500)
        }
      }
    } catch (fileError) {
      // Ignore file info errors, not critical
      console.log('Could not fetch file info:', fileError)
    }

    // Prepare hyperparameters following OpenAI's official recommendations
    // OpenAI default hyperparameters:
    // - n_epochs: "auto" (usually 3-4 epochs)
    // - batch_size: "auto" (usually ~0.2% of dataset size, min 1, max 256)
    // - learning_rate_multiplier: "auto" (usually 0.1, 0.5, 1, or 2)
    const defaultHyperparameters = {
      n_epochs: 'auto',
      batch_size: 'auto',
      learning_rate_multiplier: 'auto',
    }
    const finalHyperparameters = {
      ...defaultHyperparameters,
      ...(hyperparameters || {}),
    }

    // Create job in database first with enhanced metadata
    // Note: validation_file_id and metadata should be added to schema in a migration
    // For now, storing in hyperparameters JSON field
    const jobMetadata = {
      training_method: trainingMethod,
      model_type: modelType, // Primary type
      model_types: validatedModelTypes, // All selected types
      base_model: baseModel,
      suffix: suffix || null,
      validation_file_id: validation_file_id || null,
      parent_job_id: parent_job_id || null, // Track enhancement chain
      is_enhancement: !!parent_job_id, // Flag to indicate this is an enhancement
    }
    
    // Build create data - use relation for parentJob
    // Note: If parent_job_id column doesn't exist in DB yet, the relation will fail
    // In that case, we'll catch the error and provide a helpful message
    const createData: Prisma.FineTuneJobCreateInput & { parentJob?: { connect: { job_id: string } } } = {
      bot: {
        connect: { bot_id },
      },
      training_file_id,
      status: 'pending',
      hyperparameters: {
        ...finalHyperparameters,
        _metadata: jobMetadata, // Store metadata in hyperparameters for now
      } as Prisma.InputJsonValue,
      file_size_bytes: fileSizeBytes,
      total_examples: totalExamples,
    }

    // Add parent job relation if this is an enhancement
    // Using 'any' type to handle cases where migration hasn't been run yet
    if (parent_job_id) {
      try {
        // Try to use the relation first (if migration has been run)
        createData.parentJob = {
          connect: { job_id: parent_job_id },
        }
      } catch {
        // If relation fails, we'll catch it in the outer try-catch
      }
    }

    let fineTuneJob
    try {
      fineTuneJob = await prisma.fineTuneJob.create({
        data: createData as Prisma.FineTuneJobCreateInput,
      })
    } catch (dbError: unknown) {
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      
      // Check if error is related to parent_job_id column missing
      if (dbErrorMessage.includes('parent_job_id') || dbErrorMessage.includes('parentJob') || dbErrorMessage.includes('Unknown argument')) {
        logger.error('Database migration required for enhancement feature', {
          extraData: {
            error: dbErrorMessage,
            message: 'The parent_job_id column is missing. Please run the database migration.',
          },
        })
        return ERROR.json('MIGRATION_REQUIRED', {
          message: 'Database migration required for enhancement feature. Please run: npx prisma migrate dev --name add_parent_job_id',
          error: 'parent_job_id column not found in database',
        })
      }
      
      // Re-throw other database errors
      throw dbError
    }

    // Emit WebSocket event
    try {
      emitFineTuneJobCreated({
        job_id: fineTuneJob.job_id,
        bot_id: fineTuneJob.bot_id,
        status: fineTuneJob.status,
        parent_job_id: parent_job_id || undefined, // Include parent_job_id if this is an enhancement
      })
    } catch (error: unknown) {
        logger.warning('Failed to emit fine-tune job created WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    // If this is a child job, also emit an update event for the parent job to refresh its childJobs
    if (parent_job_id) {
      try {
        // Fetch the updated parent job with childJobs
        const updatedParent = await prisma.fineTuneJob.findUnique({
          where: { job_id: parent_job_id },
          include: {
            childJobs: {
              select: {
                job_id: true,
                fine_tuned_model_id: true,
                status: true,
                created_at: true,
                trained_tokens: true,
                training_cost_usd: true,
                total_duration_seconds: true,
                openai_job_id: true,
              },
              orderBy: {
                created_at: 'asc',
              },
            },
          } as Prisma.FineTuneJobInclude,
        })
        
        if (updatedParent) {
          const { emitFineTuneJobUpdated } = await import('@lib/websocket/emitter')
          const parentWithChildren = updatedParent as typeof updatedParent & { childJobs?: unknown[] }
          emitFineTuneJobUpdated({
            job_id: updatedParent.job_id,
            bot_id: updatedParent.bot_id,
            status: updatedParent.status,
            childJobs: parentWithChildren.childJobs || [],
          })
        }
      } catch (error: unknown) {
        logger.warning('Failed to emit parent job update after child creation', { 
          extraData: { error: error instanceof Error ? error.message : 'Unknown error' } 
        })
      }
    }

    // Update bot status to training
    await prisma.bot.update({
      where: { bot_id },
      data: {
        status: 'training',
        training_file_id,
      },
    })

    // Call OpenAI API to create fine-tuning job
    try {
      const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          training_file: training_file_id,
          model: baseModel,
          hyperparameters: finalHyperparameters,
          ...(validation_file_id && { validation_file: validation_file_id }),
          ...(suffix && { suffix }),
        }),
      })

      // Check response status code (OpenAI returns 200 for success)
      if (response.status !== 200) {
        let errorResponse: {
          error?: {
            message?: string
            code?: string
            type?: string
            param?: string
            [key: string]: unknown
          }
        }
        try {
          errorResponse = await response.json() as {
            error?: {
              message?: string
              code?: string
              type?: string
              param?: string
              [key: string]: unknown
            }
          }
        } catch {
          errorResponse = {
            error: {
              message: `HTTP ${response.status}: ${response.statusText}`,
              code: String(response.status),
            },
          }
        }
        
        const errorDetails = errorResponse.error || {}
        
        // Update job status to failed with complete error details
        await prisma.fineTuneJob.update({
          where: { job_id: fineTuneJob.job_id },
          data: {
            status: 'failed',
            error: {
              message: errorDetails.message || 'Failed to create fine-tuning job',
              code: errorDetails.code || String(response.status),
              type: errorDetails.type || null,
              param: errorDetails.param || null,
              ...errorDetails, // Include any additional error fields
            },
          },
        })

        await prisma.bot.update({
          where: { bot_id },
          data: { status: 'inactive' },
        })

        logger.error('Failed to create fine-tuning job', {
          extraData: {
            botId: bot_id,
            jobId: fineTuneJob.job_id,
            error: errorResponse.error,
            statusCode: response.status,
          },
        })

        return ERROR.json('FINE_TUNE_JOB_CREATION_FAILED', { error: errorResponse.error })
      }

      const openaiResponse = await response.json()

      // Validate OpenAI response structure
      if (!openaiResponse || !openaiResponse.id) {
        logger.error('Invalid OpenAI API response', { extraData: { response: openaiResponse } })
        await prisma.fineTuneJob.update({
          where: { job_id: fineTuneJob.job_id },
          data: {
            status: 'failed',
            error: {
              message: 'Invalid response from OpenAI API',
              code: 'INVALID_RESPONSE',
            },
          },
        })
        return ERROR.json('FINE_TUNE_JOB_CREATION_FAILED', { error: 'Invalid response from OpenAI' })
      }

      // Update job with OpenAI job ID and status
      // OpenAI returns: { id: string, status: string, ... }
      // Status values: 'pending', 'validating_files', 'running', 'succeeded', 'failed', 'cancelled'
      const updatedJob = await prisma.fineTuneJob.update({
        where: { job_id: fineTuneJob.job_id },
        data: {
          openai_job_id: openaiResponse.id,
          status: openaiResponse.status || 'pending',
        },
      })

      logger.info('Fine-tuning job created successfully', {
        extraData: {
          job_id: fineTuneJob.job_id,
          openai_job_id: openaiResponse.id,
        },
      })

      // Notify admins about job started
      try {
        const { notifyFineTuneJobStarted } = await import('@lib/notifications/bot-notifications')
        await notifyFineTuneJobStarted({
          job_id: fineTuneJob.job_id,
          bot_id,
          bot_name: bot.name,
          model: baseModel,
        })
      } catch (notifError) {
        logger.warning('Failed to send notification for fine-tune job started', {
          extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' },
        })
      }

      return SUCCESS.json('Fine-tuning job created successfully', updatedJob)
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Failed to create fine-tuning job'
      const errorStack = apiError instanceof Error ? apiError.stack : undefined
      
      // Update job status to failed with complete error details
      await prisma.fineTuneJob.update({
        where: { job_id: fineTuneJob.job_id },
        data: {
          status: 'failed',
          error: {
            message: errorMessage,
            code: 'API_ERROR',
            type: 'internal_error',
            ...(errorStack && { stack: errorStack }),
          },
        },
      })

      await prisma.bot.update({
        where: { bot_id },
        data: { status: 'inactive' },
      })

      throw apiError
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error creating fine-tuning job', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * List fine-tuning jobs
 * GET /api/fine-tune/jobs?bot_id=xxx
 * Admin only
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const url = new URL(req.url)
    const botId = url.searchParams.get('bot_id')

    // Filter: Only show parent jobs (jobs without parent_job_id) in the main list
    // Child jobs will be shown in the parent job's history tab
    const where = botId 
      ? { 
          bot_id: botId,
          parent_job_id: null, // Only show parent jobs, not child jobs
        } 
      : { 
          parent_job_id: null, // Only show parent jobs, not child jobs
        }

    const jobs = await prisma.fineTuneJob.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        bot: {
          select: {
            bot_id: true,
            name: true,
            model: true,
          },
        },
        parentJob: {
          select: {
            job_id: true,
            fine_tuned_model_id: true,
            status: true,
            created_at: true,
          },
        },
        childJobs: {
          select: {
            job_id: true,
            fine_tuned_model_id: true,
            status: true,
            created_at: true,
            trained_tokens: true,
            training_cost_usd: true,
            total_duration_seconds: true,
            openai_job_id: true,
            training_file_id: true,
            total_examples: true,
            finished_at: true,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      } as Prisma.FineTuneJobInclude,
    })

      return SUCCESS.json('Fine-tuning jobs retrieved successfully', jobs)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching fine-tuning jobs', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

