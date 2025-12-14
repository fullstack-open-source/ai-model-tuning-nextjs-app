import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import { emitBotUpdated, emitBotDeleted } from '@lib/websocket/emitter'

/**
 * Get bot by ID
 * GET /api/bots/[bot_id]
 * Admin only
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bot_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { bot_id } = await params

    const bot = await prisma.bot.findUnique({
      where: { bot_id },
    })

    if (!bot) {
      return ERROR.json('BOT_NOT_FOUND', { bot_id })
    }

    return SUCCESS.json('Bot retrieved successfully', bot)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error fetching bot', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Update bot
 * PATCH /api/bots/[bot_id]
 * Admin only
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bot_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { bot_id } = await params
    const body = await req.json()
    const { name, description, model, logo_url, status, settings } = body

    const bot = await prisma.bot.update({
      where: { bot_id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(model && { model }),
        ...(logo_url !== undefined && { logo_url }),
        ...(status && { status }),
        ...(settings && { settings }),
        updated_at: new Date(),
      },
    })

    // Emit WebSocket event
    try {
      emitBotUpdated(bot)
    } catch (error) {
      logger.warning('Failed to emit bot updated WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    logger.info('Bot updated successfully', { extraData: { botId: bot.bot_id } })
    return SUCCESS.json('Bot updated successfully', bot)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error updating bot', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Delete bot
 * DELETE /api/bots/[bot_id]
 * Admin only
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bot_id: string }> }
) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const { bot_id } = await params

    if (!bot_id || bot_id === 'undefined') {
      return ERROR.json('INVALID_REQUEST', { message: 'Bot ID is required' })
    }

    await prisma.bot.delete({
      where: { bot_id },
    })

    // Emit WebSocket event
    try {
      emitBotDeleted(bot_id)
    } catch (error) {
      logger.warning('Failed to emit bot deleted WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    logger.info('Bot deleted successfully', { extraData: { botId: bot_id } })
    return SUCCESS.json('Bot deleted successfully')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error deleting bot', { extraData: { error: errorMessage } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

