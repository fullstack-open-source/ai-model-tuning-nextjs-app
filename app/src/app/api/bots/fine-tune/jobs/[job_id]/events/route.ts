import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'

/**
 * Get fine-tuning job events (training logs and analytics)
 * GET /api/fine-tune/jobs/[job_id]/events
 * Admin only
 * 
 * Following OpenAI's official fine-tuning events API:
 * https://platform.openai.com/docs/api-reference/fine-tuning/list-events
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
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const after = url.searchParams.get('after') // For pagination

    const job = await prisma.fineTuneJob.findUnique({
      where: { job_id },
    })

    if (!job) {
      return ERROR.json('FINE_TUNE_JOB_NOT_FOUND', { job_id })
    }

    // If job has OpenAI job ID, fetch events from OpenAI API
    if (job.openai_job_id) {
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (openaiApiKey) {
        try {
          const params = new URLSearchParams()
          params.append('limit', String(limit))
          if (after) params.append('after', after)

          const response = await fetch(
            `https://api.openai.com/v1/fine_tuning/jobs/${job.openai_job_id}/events?${params.toString()}`,
            {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
              },
            }
          )

          if (response.status === 200) {
            const openaiEvents = await response.json()

            // OpenAI events structure:
            // {
            //   "object": "list",
            //   "data": [
            //     {
            //       "object": "fine_tuning.job.event",
            //       "id": "ftevent-abc123",
            //       "created_at": 1677610602,
            //       "level": "info",
            //       "message": "Created fine-tuning job",
            //       "data": {}
            //     }
            //   ],
            //   "has_more": false
            // }

            // Store events in database for analytics (optional - can be done async)
            // For now, just return the events from OpenAI

            return SUCCESS.json('Fine-tuning job events retrieved successfully', {
              events: openaiEvents.data || [],
              has_more: openaiEvents.has_more || false,
              object: 'list',
            })
          }
        } catch (apiError: unknown) {
          const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error'
          logger.error('Error fetching job events from OpenAI', {
            extraData: { error: errorMessage, job_id },
          })
        }
      }
    }

    // Return empty events if no OpenAI job ID or API call failed
    return SUCCESS.json('Fine-tuning job events retrieved successfully', {
      events: [],
      has_more: false,
      object: 'list',
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching fine-tuning job events', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

