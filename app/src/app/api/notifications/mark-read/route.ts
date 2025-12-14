import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { getNotificationsUnreadCountCacheKey } from '@lib/cache/keys';
import { invalidateNotificationsCache } from '@lib/cache/invalidation';
import { cache } from '@lib/cache/cache';
import { prisma } from '@lib/db/prisma';
import { emitNotificationUpdateToUser } from '@lib/websocket/emitter';

// Access the global io instance from server.js
declare global {
  var io: any;
}

function isWebSocketAvailable(): boolean {
  return typeof global !== 'undefined' && global.io && typeof global.io.emit === 'function';
}

/**
 * Mark notification as read
 * POST /api/notifications/mark-read
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'mark_notification_read');
    if (permissionError) return permissionError;

    const body = await req.json();
    const { id, mark_all } = body;
    const userId = user?.uid || user?.user_id;

    // Check if user is admin
    const isAdminUser = user?.groups?.some((g: { codename: string }) => 
      g.codename === 'admin' || g.codename === 'super_admin'
    ) || false;

    if (mark_all) {
      // Mark all unread notifications as read
      // Regular users can only mark their own notifications
      const whereClause: Record<string, unknown> = {
        read_at: null,
      };
      
      // Regular users can only mark their own notifications as read
      if (!isAdminUser && userId) {
        whereClause.user_id = userId;
      }

      const result = await prisma.notification.updateMany({
        where: whereClause,
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      // Invalidate notification caches (respects REDIS_CACHE_ENABLED flag)
      await invalidateNotificationsCache();
      await cache.delete(getNotificationsUnreadCountCacheKey());

      // Emit WebSocket event for all notifications marked as read
      if (userId && isWebSocketAvailable()) {
        try {
          global.io.to(`user:${userId}`).emit('notifications:all-read', { userId });
          global.io.to('notifications').emit('notifications:all-read', { userId });
        } catch (wsError) {
          logger.warning('Failed to emit WebSocket mark all as read', {
            module: 'Notifications',
            label: 'WEBSOCKET_EMIT',
            extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
          });
        }
      }

      return SUCCESS.json('All notifications marked as read', { 
        count: result.count 
      });
    }

    if (!id) {
      return ERROR.json('INVALID_REQUEST', { message: 'id is required' });
    }

    // First, check if notification exists and belongs to user (if not admin)
    const existingNotification = await prisma.notification.findUnique({
      where: { notification_id: id },
    });

    if (!existingNotification) {
      return ERROR.json('NOTIFICATION_NOT_FOUND', { id });
    }

    // Regular users can only mark their own notifications as read
    if (!isAdminUser && userId && existingNotification.user_id !== userId) {
      return ERROR.json('FORBIDDEN', { 
        message: 'You can only mark your own notifications as read' 
      });
    }

    const notification = await prisma.notification.update({
      where: { notification_id: id },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    // Invalidate notification caches (respects REDIS_CACHE_ENABLED flag)
    await invalidateNotificationsCache(id);
    await cache.delete(getNotificationsUnreadCountCacheKey());

    // Emit WebSocket event for notification update
    try {
      emitNotificationUpdateToUser(userId || notification.user_id || '', notification);
    } catch (wsError) {
      logger.warning('Failed to emit WebSocket notification update', {
        module: 'Notifications',
        label: 'WEBSOCKET_EMIT',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
      });
    }

    return SUCCESS.json('Notification marked as read', { notification });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error marking notification as read', { 
      module: 'Notifications', 
      label: 'MARK_NOTIFICATION_READ',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

