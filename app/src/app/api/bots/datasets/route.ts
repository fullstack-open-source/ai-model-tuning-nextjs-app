import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import { emitDatasetCreated } from '@lib/websocket/emitter'

/**
 * Get all datasets
 * GET /api/datasets?dataset_type=all&search=title&limit=50&offset=0
 * Admin only
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // No filters - fetch all datasets (admin only access)
    const where = {}

    const [datasets, total] = await Promise.all([
      prisma.dataset.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
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
      }),
      prisma.dataset.count({ where }),
    ])

    return SUCCESS.json('Datasets retrieved successfully', {
      datasets,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching datasets', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Create dataset
 * POST /api/datasets
 * Admin only
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const body = await req.json()
    const { title, description, dataset_type, content, num_examples, tags, metadata } = body

    if (!title || !content || !dataset_type) {
      return ERROR.json('MISSING_REQUIRED_FIELDS', { fields: ['title', 'content', 'dataset_type'] })
    }

    // Validate dataset_type
    const validTypes = ['chat', 'calling', 'voice', 'all']
    if (!validTypes.includes(dataset_type)) {
      return ERROR.json('INVALID_DATASET_TYPE', { valid_types: validTypes })
    }

    // Count examples if not provided
    let exampleCount = num_examples
    if (!exampleCount) {
      try {
        const lines = content.split('\n').filter((line: string) => line.trim().length > 0)
        exampleCount = lines.length
      } catch {
        exampleCount = 0
      }
    }

    const dataset = await prisma.dataset.create({
      data: {
        title,
        description: description || null,
        dataset_type,
        content,
        num_examples: exampleCount,
        tags: tags || [],
        metadata: metadata || {},
        created_by: user?.uid || user?.user_id || null,
      },
    })

    logger.info('Dataset created successfully', { extraData: { dataset_id: dataset.dataset_id, title } })
    
    // Emit WebSocket event
    try {
      emitDatasetCreated(dataset)
    } catch (error) {
      logger.warning('Failed to emit dataset created WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }
    
    // Notify admins about dataset creation
    try {
      const { notifyDatasetCreated } = await import('@lib/notifications/bot-notifications')
      const creator = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : undefined
      await notifyDatasetCreated({
        dataset_id: dataset.dataset_id,
        title,
        num_examples: exampleCount,
        created_by_name: creator,
      })
    } catch (notifError) {
      logger.warning('Failed to send notification for dataset created', {
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' },
      })
    }

    return SUCCESS.json('Dataset created successfully', dataset)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error creating dataset', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

