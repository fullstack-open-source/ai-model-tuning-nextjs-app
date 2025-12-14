import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'

/**
 * Get all training reports
 * GET /api/training-reports?bot_id=xxx&fine_tune_job_id=xxx&status=completed
 * Admin only
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const url = new URL(req.url)
    const botId = url.searchParams.get('bot_id') || undefined
    const fineTuneJobId = url.searchParams.get('fine_tune_job_id') || undefined
    const datasetId = url.searchParams.get('dataset_id') || undefined
    const status = url.searchParams.get('status') || undefined
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build where clause
    const where: {
      bot_id?: string
      fine_tune_job_id?: string
      dataset_id?: string
      status?: string
    } = {}

    if (botId) where.bot_id = botId
    if (fineTuneJobId) where.fine_tune_job_id = fineTuneJobId
    if (datasetId) where.dataset_id = datasetId
    if (status) where.status = status

    const [reports, total] = await Promise.all([
      prisma.trainingReport.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
        include: {
          bot: {
            select: {
              bot_id: true,
              name: true,
              model: true,
            },
          },
          fineTuneJob: {
            select: {
              job_id: true,
              status: true,
              fine_tuned_model_id: true,
            },
          },
          dataset: {
            select: {
              dataset_id: true,
              title: true,
              num_examples: true,
            },
          },
        },
      }),
      prisma.trainingReport.count({ where }),
    ])

    return SUCCESS.json('Training reports retrieved successfully', {
      reports,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching training reports', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

