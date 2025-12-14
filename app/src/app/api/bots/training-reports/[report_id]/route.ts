import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'

/**
 * Get training report by ID
 * GET /api/training-reports/[report_id]
 * Admin only
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { report_id } = await params
    if (!report_id) {
      return ERROR.json('INVALID_REQUEST', { message: 'Report ID is required' })
    }

    const report = await prisma.trainingReport.findUnique({
      where: { report_id },
      include: {
        bot: {
          select: {
            bot_id: true,
            name: true,
            model: true,
            status: true,
          },
        },
        fineTuneJob: {
          select: {
            job_id: true,
            status: true,
            fine_tuned_model_id: true,
            created_at: true,
            finished_at: true,
          },
        },
        dataset: {
          select: {
            dataset_id: true,
            title: true,
            description: true,
            num_examples: true,
            dataset_type: true,
          },
        },
      },
    })

    if (!report) {
      return ERROR.json('NOT_FOUND', { report_id, message: 'Training report not found' })
    }

    return SUCCESS.json('Training report retrieved successfully', report)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching training report', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

