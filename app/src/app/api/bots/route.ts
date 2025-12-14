import { NextRequest } from 'next/server'
import { SUCCESS } from '@lib/response/response'
import { ERROR } from '@lib/response/response'
import { logger } from '@lib/logger/logger'
import { validateRequest } from '@lib/middleware/auth'
import { checkAdminOrReturnError } from '@lib/middleware/permission-check'
import { prisma } from '@lib/db/prisma'
import { emitBotCreated } from '@lib/websocket/emitter'

/**
 * Get all bots
 * GET /api/bots
 * Admin only
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const bots = await prisma.bot.findMany({
      orderBy: { created_at: 'desc' },
    })

    return SUCCESS.json('Bots retrieved successfully', bots)
  } catch (error: any) {
    logger.error('Error fetching bots', { extraData: { error: error.message } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

/**
 * Create bot
 * POST /api/bots
 * Admin only
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req)
    const adminError = await checkAdminOrReturnError(user)
    if (adminError) return adminError

    const body = await req.json()
    const { name, description, model, logo_url, settings, status } = body

    if (!name || !model) {
      return ERROR.json('MISSING_REQUIRED_FIELDS', { fields: ['name', 'model'] })
    }

    const bot = await prisma.bot.create({
      data: {
        name,
        description,
        model,
        logo_url,
        settings: settings || {},
        status: status || 'inactive',
        created_by: user?.uid || user?.user_id || null,
      },
    })

    // Emit WebSocket event
    try {
      emitBotCreated(bot)
    } catch (error) {
      logger.warning('Failed to emit bot created WebSocket event', { extraData: { error: error instanceof Error ? error.message : 'Unknown error' } })
    }

    logger.info('Bot created successfully', { extraData: { botId: bot.bot_id } })
    return SUCCESS.json('Bot created successfully', bot)
  } catch (error: any) {
    logger.error('Error creating bot', { extraData: { error: error.message } })
    return ERROR.json('INTERNAL_ERROR', {}, error)
  }
}

