import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import { Prisma } from '@prisma/client'
import { emitDatasetUpdated, emitDatasetDeleted } from '@lib/websocket/emitter'

/**
 * Get dataset by ID
 * GET /api/datasets/[dataset_id]
 * Admin only
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dataset_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { dataset_id } = await params
    if (!dataset_id) {
      return ERROR.json('INVALID_REQUEST', { message: 'Dataset ID is required' })
    }

    const dataset = await prisma.dataset.findUnique({
      where: { dataset_id },
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
      return ERROR.json('NOT_FOUND', { dataset_id, message: 'Dataset not found' })
    }

    return SUCCESS.json('Dataset retrieved successfully', dataset)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching dataset', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Update dataset
 * PATCH /api/datasets/[dataset_id]
 * Admin only
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ dataset_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { dataset_id } = await params
    if (!dataset_id) {
      return ERROR.json('INVALID_REQUEST', { message: 'Dataset ID is required' })
    }

    const body = await req.json()
    const { title, description, dataset_type, content, tags, metadata, is_active } = body

    // Build update data
    const updateData: {
      title?: string
      description?: string | null
      dataset_type?: string
      content?: string
      tags?: string[]
      metadata?: unknown
      is_active?: boolean
      updated_at?: Date
    } = {
      updated_at: new Date(),
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    if (dataset_type !== undefined) {
      const validTypes = ['chat', 'calling', 'voice', 'all']
      if (!validTypes.includes(dataset_type)) {
        return ERROR.json('INVALID_DATASET_TYPE', { valid_types: validTypes })
      }
      updateData.dataset_type = dataset_type
    }
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = tags
    if (metadata !== undefined) {
      updateData.metadata = metadata as Prisma.InputJsonValue
    }
    if (is_active !== undefined) updateData.is_active = is_active

    const dataset = await prisma.dataset.update({
      where: { dataset_id },
      data: updateData as Prisma.DatasetUpdateInput,
    })

    // Emit WebSocket event
    try {
      emitDatasetUpdated(dataset)
    } catch (error) {
      logger.warning('Failed to emit dataset updated WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    logger.info('Dataset updated successfully', { extraData: { dataset_id: dataset.dataset_id } })
    return SUCCESS.json('Dataset updated successfully', dataset)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error updating dataset', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Delete dataset
 * DELETE /api/datasets/[dataset_id]
 * Admin only
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ dataset_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { dataset_id } = await params
    if (!dataset_id) {
      return ERROR.json('INVALID_REQUEST', { message: 'Dataset ID is required' })
    }

    await prisma.dataset.delete({
      where: { dataset_id },
    })

    // Emit WebSocket event
    try {
      emitDatasetDeleted(dataset_id)
    } catch (error) {
      logger.warning('Failed to emit dataset deleted WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    logger.info('Dataset deleted successfully', { extraData: { datasetId: dataset_id } })
    return SUCCESS.json('Dataset deleted successfully')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error deleting dataset', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

