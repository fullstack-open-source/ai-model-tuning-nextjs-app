import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'

/**
 * Get dataset generation job status (using dataset_id as job_id)
 * GET /api/datasets/generate/[job_id]
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
    if (!job_id) {
      return ERROR.json('INVALID_REQUEST', { message: 'Job ID is required' })
    }

    // job_id is actually dataset_id now
    const dataset = await prisma.dataset.findUnique({
      where: { dataset_id: job_id },
      include: {
        createdBy: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    if (!dataset) {
      return ERROR.json('NOT_FOUND', { message: 'Dataset generation job not found' })
    }

    // Return in the format expected by frontend (using dataset_id as job_id)
    return SUCCESS.json('Dataset generation job retrieved successfully', {
      ...dataset,
      job_id: dataset.dataset_id, // For backward compatibility
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching dataset generation job', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}
