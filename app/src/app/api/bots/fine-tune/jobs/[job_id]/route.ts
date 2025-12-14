import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import type { Prisma } from '@prisma/client'
import { emitFineTuneJobUpdated, emitFineTuneJobProgress } from '@lib/websocket/emitter'

/**
 * Get fine-tuning job status
 * GET /api/fine-tune/jobs/[job_id]
 * Admin only
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { job_id } = await params

    const job = await prisma.fineTuneJob.findUnique({
      where: { job_id },
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
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      } as Prisma.FineTuneJobInclude,
    })

    if (!job) {
      return ERROR.json('FINE_TUNE_JOB_NOT_FOUND', { job_id })
    }

    // If job has OpenAI job ID, fetch latest status from OpenAI
    if (job.openai_job_id) {
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (openaiApiKey) {
        try {
          const response = await fetch(
            `https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}`,
            {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
              },
            }
          )

          // Check response status code (OpenAI returns 200 for success)
          if (response.status === 200) {
            let openaiJob: {
              id?: string
              status?: string
              fine_tuned_model?: string
              fine_tuned_model_id?: string
              trained_tokens?: number
              finished_at?: number
              created_at?: number
              error?: {
                message?: string
                code?: string
                type?: string
                param?: string
                [key: string]: unknown
              }
              result_files?: Array<{ id?: string; object?: string; bytes?: number; created_at?: number }>
              [key: string]: unknown
            }
            try {
              openaiJob = await response.json() as typeof openaiJob
            } catch (parseError) {
              logger.error('Failed to parse OpenAI job response', {
                extraData: { 
                  error: parseError instanceof Error ? parseError.message : 'Unknown error',
                  status: response.status,
                },
              })
              return SUCCESS.json('Fine-tuning job retrieved successfully', job)
            }

            // Validate response structure matches OpenAI API
            if (!openaiJob || typeof openaiJob !== 'object') {
              logger.error('Invalid OpenAI API response structure', { extraData: { response: openaiJob } })
              return SUCCESS.json('Fine-tuning job retrieved successfully', job)
            }

            // Calculate durations and track phases
            const now = new Date()
            const createdDate = new Date(job.created_at)
            
            // Extract training metrics from OpenAI response
            // OpenAI provides result_files with training metrics (loss, accuracy, etc.)
            let trainingMetrics: {
              train_loss?: number
              train_accuracy?: number
              valid_loss?: number
              valid_accuracy?: number
              checkpoints?: Array<{
                step: number
                loss: number
                accuracy?: number
              }>
            } | null = null

            // OpenAI may provide result_files array with training metrics
            if (openaiJob.result_files && Array.isArray(openaiJob.result_files) && openaiJob.result_files.length > 0) {
              // The first result file typically contains training metrics
              // In production, you'd download and parse this file
              // For now, we'll note that metrics are available
              trainingMetrics = {
                checkpoints: [], // Would be populated from result file
              }
            }

            // Prepare update data with proper types for Prisma
            const updateData: Record<string, unknown> = {
              // OpenAI API status values: 'pending', 'validating_files', 'running', 'succeeded', 'failed', 'cancelled'
              status: openaiJob.status || job.status,
              // OpenAI returns 'fine_tuned_model' field (not 'fine_tuned_model_id')
              fine_tuned_model_id: openaiJob.fine_tuned_model || openaiJob.fine_tuned_model_id || null,
              trained_tokens: openaiJob.trained_tokens || null,
              // OpenAI returns 'finished_at' as Unix timestamp (seconds)
              finished_at: openaiJob.finished_at ? new Date(openaiJob.finished_at * 1000) : null,
              // OpenAI error structure: { message: string, code?: string, param?: string, type?: string }
              // Store complete error object if it exists
              ...(openaiJob.error && { 
                error: {
                  message: openaiJob.error.message || 'Unknown error',
                  code: openaiJob.error.code || null,
                  param: openaiJob.error.param || null,
                  type: openaiJob.error.type || null,
                  ...openaiJob.error, // Include any additional error fields
                } as Prisma.InputJsonValue
              }),
              // Store training metrics in hyperparameters JSON for now
              // In production, add a separate training_metrics JSON field to schema
              hyperparameters: {
                ...(job.hyperparameters as Record<string, unknown> || {}),
                _training_metrics: trainingMetrics,
                _result_files: openaiJob.result_files || [],
              },
            }
            
            // Add optional timestamp fields
            if (openaiJob.status === 'validating_files' && job.status !== 'validating_files') {
              updateData.validation_started_at = now
            }
            if (openaiJob.status === 'running' && job.status !== 'running') {
              updateData.training_started_at = now
              if (job.status === 'validating_files') {
                updateData.validation_ended_at = now
              }
            }

            // Also check if OpenAI provides timestamps in the response
            // OpenAI may provide 'created_at' and 'finished_at' as Unix timestamps
            if (openaiJob.created_at && !job.validation_started_at) {
              const openaiCreatedAt = new Date(openaiJob.created_at * 1000)
              // If status is validating or later, validation likely started at creation
              if (openaiJob.status === 'validating_files' || openaiJob.status === 'running' || openaiJob.status === 'succeeded') {
                updateData.validation_started_at = openaiCreatedAt
              }
            }

            // Calculate durations when job is finished
            if (openaiJob.finished_at) {
              const finishedDate = new Date(openaiJob.finished_at * 1000)
              updateData.finished_at = finishedDate
              updateData.total_duration_seconds = Math.floor((finishedDate.getTime() - createdDate.getTime()) / 1000)

              // Calculate validation duration
              const validationStarted = updateData.validation_started_at as Date | undefined
              const validationEnded = updateData.validation_ended_at as Date | undefined
              if (validationStarted && validationEnded) {
                updateData.validation_duration_seconds = Math.floor((validationEnded.getTime() - validationStarted.getTime()) / 1000)
              } else if (job.validation_started_at && validationEnded) {
                const validationStart = new Date(job.validation_started_at)
                updateData.validation_duration_seconds = Math.floor((validationEnded.getTime() - validationStart.getTime()) / 1000)
              }

              // Calculate training duration
              const trainingStarted = updateData.training_started_at as Date | undefined
              if (trainingStarted) {
                updateData.training_ended_at = finishedDate
                updateData.training_duration_seconds = Math.floor((finishedDate.getTime() - trainingStarted.getTime()) / 1000)
              } else if (job.training_started_at) {
                const trainingStart = new Date(job.training_started_at)
                updateData.training_ended_at = finishedDate
                updateData.training_duration_seconds = Math.floor((finishedDate.getTime() - trainingStart.getTime()) / 1000)
              }

              // Estimate training cost (rough calculation based on tokens)
              // OpenAI fine-tuning pricing: ~$0.008 per 1K tokens for training
              if (openaiJob.trained_tokens) {
                updateData.training_cost_usd = (openaiJob.trained_tokens / 1000) * 0.008
              }
            }

                 // Update job status in database
                 const updatedJob = await prisma.fineTuneJob.update({
                   where: { job_id },
                   data: updateData,
                 })

                 // Emit WebSocket events
                 try {
                   if (openaiJob.status === 'succeeded' || openaiJob.status === 'failed' || openaiJob.status === 'cancelled') {
                     emitFineTuneJobUpdated({
                       job_id: updatedJob.job_id,
                       bot_id: updatedJob.bot_id,
                       status: updatedJob.status,
                       trained_tokens: updatedJob.trained_tokens || undefined,
                       training_cost_usd: updatedJob.training_cost_usd || undefined,
                       fine_tuned_model_id: updatedJob.fine_tuned_model_id || undefined,
                     })
                   } else {
                     emitFineTuneJobProgress({
                       job_id: updatedJob.job_id,
                       bot_id: updatedJob.bot_id,
                       status: updatedJob.status,
                       trained_tokens: updatedJob.trained_tokens || undefined,
                       training_cost_usd: updatedJob.training_cost_usd || undefined,
                       fine_tuned_model_id: updatedJob.fine_tuned_model_id || undefined,
                     })
                   }
                 } catch (error) {
                   logger.warning('Failed to emit fine-tune job WebSocket event', { 
                     extraData: { error: error instanceof Error ? error.message : 'Unknown error' } 
                   })
                 }

                 // Notify admins about progress
                 try {
                   const { notifyFineTuneJobProgress } = await import('@lib/notifications/bot-notifications')
                   await notifyFineTuneJobProgress({
                     job_id,
                     bot_id: job.bot_id,
                     bot_name: (job as typeof job & { bot?: { name: string } }).bot?.name || 'Unknown Bot',
                     status: openaiJob.status || job.status,
                     progress: updateData.total_duration_seconds ? Math.min(95, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60)) : undefined,
                   })
                 } catch (notifError) {
                   logger.warning('Failed to send notification for fine-tune job progress', {
                     extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' },
                   })
                 }

            // Update bot based on job status (following OpenAI status values)
            // OpenAI status: 'pending', 'validating_files', 'running', 'succeeded', 'failed', 'cancelled'
            const fineTunedModelId = updateData.fine_tuned_model_id as string | null | undefined
            if (openaiJob.status === 'succeeded' && fineTunedModelId) {
              // Job succeeded - save fine-tuned model ID to bot
              await prisma.bot.update({
                where: { bot_id: job.bot_id },
                data: {
                  fine_tuned_model_id: fineTunedModelId,
                  model: fineTunedModelId, // Update bot's model to use fine-tuned model
                  status: 'active',
                },
              })
                   logger.info('Bot updated with fine-tuned model', {
                     extraData: {
                       botId: job.bot_id,
                       fineTunedModelId: fineTunedModelId,
                     },
                   })

              // If this is a child job (enhancement), update the parent job to have the latest model
              // This ensures the parent job always has the latest fine_tuned_model_id for next enhancement
              const jobWithParent = job as typeof job & { parent_job_id?: string | null }
              if (jobWithParent.parent_job_id) {
                try {
                  await prisma.fineTuneJob.update({
                    where: { job_id: jobWithParent.parent_job_id },
                    data: {
                      // Update parent's fine_tuned_model_id to the latest child's model
                      // This way, when enhancing again, it uses the most recent model
                      fine_tuned_model_id: fineTunedModelId,
                    },
                  })
                  
                  // Emit update for parent job so UI refreshes
                  const { emitFineTuneJobUpdated } = await import('@lib/websocket/emitter')
                  const updatedParent = await prisma.fineTuneJob.findUnique({
                    where: { job_id: jobWithParent.parent_job_id },
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
                    const parentWithChildren = updatedParent as typeof updatedParent & { childJobs?: unknown[] }
                    emitFineTuneJobUpdated({
                      job_id: updatedParent.job_id,
                      bot_id: updatedParent.bot_id,
                      status: updatedParent.status,
                      fine_tuned_model_id: updatedParent.fine_tuned_model_id,
                      childJobs: parentWithChildren.childJobs || [],
                    })
                  }
                  
                  logger.info('Parent job updated with latest child model', {
                    extraData: {
                      parentJobId: jobWithParent.parent_job_id,
                      latestModelId: fineTunedModelId,
                    },
                  })
                } catch (parentUpdateError) {
                  logger.warning('Failed to update parent job with latest model', {
                    extraData: {
                      error: parentUpdateError instanceof Error ? parentUpdateError.message : 'Unknown error',
                      parentJobId: jobWithParent.parent_job_id,
                    },
                  })
                }
              }

                   // Notify admins about job completion
                   try {
                     const { notifyFineTuneJobCompleted } = await import('@lib/notifications/bot-notifications')
                     await notifyFineTuneJobCompleted({
                       job_id,
                       bot_id: job.bot_id,
                       bot_name: (job as typeof job & { bot?: { name: string } }).bot?.name || 'Unknown Bot',
                       fine_tuned_model_id: fineTunedModelId,
                     })
                   } catch (notifError) {
                     logger.warning('Failed to send notification for fine-tune job completed', {
                       extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' },
                     })
                   }

              // Automatically trigger model testing if test data is available
              // This will be handled asynchronously to not block the response
              try {
                // Get dataset from job metadata or find associated dataset
                const dataset = await prisma.dataset.findFirst({
                  where: {
                    OR: [
                      { content: { contains: '' } }, // Placeholder - we'll need to store dataset_id in job metadata
                    ],
                  },
                })

                // If we have test examples, trigger testing
                // For now, we'll need to get test examples from the dataset metadata
                if (dataset?.metadata && typeof dataset.metadata === 'object' && 'split' in dataset.metadata) {
                  const split = (dataset.metadata as { split?: { test_count?: number } }).split
                  if (split && split.test_count && split.test_count > 0 && dataset.content && dataset.num_examples) {
                    // Parse test examples from dataset content
                    const allLines = dataset.content.split('\n').filter((line) => line.trim())
                    const trainingCount = dataset.num_examples - (split.test_count || 0)
                    const testLines = allLines.slice(trainingCount)
                    const testExamples = testLines
                      .map((line) => {
                        try {
                          return JSON.parse(line)
                        } catch {
                          return null
                        }
                      })
                      .filter((ex) => ex !== null)

                    if (testExamples.length > 0) {
                      // Trigger testing asynchronously (don't await to avoid blocking)
                      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/fine-tune/test-model`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          // Note: In production, you'd need to pass auth token
                        },
                        body: JSON.stringify({
                          fine_tune_job_id: job.job_id,
                          bot_id: job.bot_id,
                          dataset_id: dataset.dataset_id,
                          training_file_id: job.training_file_id,
                          model_id: updateData.fine_tuned_model_id,
                          test_examples: testExamples,
                        }),
                      }).catch((err) => {
                        logger.error('Error triggering model test', {
                          extraData: { error: err.message, job_id: job.job_id },
                        })
                      })
                    }
                  }
                }
              } catch (testTriggerError: unknown) {
                const errorMessage = testTriggerError instanceof Error ? testTriggerError.message : 'Unknown error'
                logger.error('Error triggering automatic model test', {
                  extraData: { error: errorMessage, job_id: job.job_id },
                })
                // Don't fail the request if testing trigger fails
              }
            } else if (openaiJob.status === 'failed') {
              await prisma.bot.update({
                where: { bot_id: job.bot_id },
                data: { status: 'inactive' },
              })
              logger.error('Fine-tuning job failed', {
                extraData: {
                  botId: job.bot_id,
                  job_id: job_id,
                  error: openaiJob.error,
                },
              })
            } else if (openaiJob.status === 'cancelled') {
              await prisma.bot.update({
                where: { bot_id: job.bot_id },
                data: { status: 'inactive' },
              })
            } else if (openaiJob.status === 'running' || openaiJob.status === 'validating_files' || openaiJob.status === 'pending') {
              // Keep bot in training status while job is running
              await prisma.bot.update({
                where: { bot_id: job.bot_id },
                data: { status: 'training' },
              })
            }

            // Fetch the updated job with all relations
            const finalJob = await prisma.fineTuneJob.findUnique({
              where: { job_id },
              include: {
                bot: {
                  select: {
                    bot_id: true,
                    name: true,
                    model: true,
                  },
                },
              },
            })

            return SUCCESS.json('Fine-tuning job retrieved successfully', finalJob)
          }
        } catch (apiError: unknown) {
          const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error'
          logger.error('Error fetching job status from OpenAI', {
            extraData: { error: errorMessage },
          })
        }
      }
    }

    return SUCCESS.json('Fine-tuning job retrieved successfully', job)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching fine-tuning job', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Cancel fine-tuning job
 * POST /api/fine-tune/jobs/[job_id]/cancel
 * Admin only
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { job_id } = await params

    const job = await prisma.fineTuneJob.findUnique({
      where: { job_id },
    })

    if (!job) {
      return ERROR.json('FINE_TUNE_JOB_NOT_FOUND', { job_id })
    }

    if (!job.openai_job_id) {
      return ERROR.json('OPENAI_JOB_ID_MISSING', {})
    }

    // Cancel job via OpenAI API
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return ERROR.json('OPENAI_API_KEY_NOT_CONFIGURED', {})
    }

    try {
      const response = await fetch(
        `https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
        }
      )

      // Check response status code (OpenAI returns 200 for success)
      if (response.status !== 200) {
        const error = await response.json()
        logger.error('Failed to cancel fine-tuning job', {
          extraData: {
            jobId: job_id,
            openaiJobId: job.openai_job_id,
            error: error.error,
            statusCode: response.status,
          },
        })
        return ERROR.json('CANCEL_JOB_FAILED', { error: error.error || error })
      }

      // Update job status
      const updatedJob = await prisma.fineTuneJob.update({
        where: { job_id },
        data: {
          status: 'cancelled',
        },
      })

      // Emit WebSocket event
      try {
        emitFineTuneJobUpdated({
          job_id: updatedJob.job_id,
          bot_id: updatedJob.bot_id,
          status: updatedJob.status,
        })
      } catch (error) {
        logger.warning('Failed to emit fine-tune job cancelled WebSocket event', { 
          extraData: { error: error instanceof Error ? error.message : 'Unknown error' } 
        })
      }

      // Update bot status
      await prisma.bot.update({
        where: { bot_id: job.bot_id },
        data: { status: 'inactive' },
      })

      logger.info('Fine-tuning job cancelled successfully', { extraData: { jobId: job_id } })

      return SUCCESS.json('Fine-tuning job cancelled successfully', updatedJob)
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error'
      logger.error('Error cancelling fine-tuning job', {
        extraData: { error: errorMessage },
      })
      return ERROR.json('INTERNAL_ERROR', {}, apiError)
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error cancelling fine-tuning job', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

