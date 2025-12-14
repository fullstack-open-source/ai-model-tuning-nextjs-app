import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getNotificationCacheKey, getNotificationsUnreadCountCacheKey } from '@lib/cache/keys';
import { invalidateNotificationsCache } from '@lib/cache/invalidation';
import { cache } from '@lib/cache/cache';
import { prisma } from '@lib/db/prisma';
import { emitNotificationUpdateToUser, emitNotificationDeleted } from '@lib/websocket/emitter';

/**
 * Get notification by ID
 * GET /api/notifications/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_notification');
    if (permissionError) return permissionError;

    const { id } = await params;
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchNotificationData = async () => {
      return await prisma.notification.findUnique({
        where: { notification_id: id },
      });
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const notification = forceRefresh
      ? await reCache(fetchNotificationData, {
          key: getNotificationCacheKey(id),
          duration: 'short', // Cache for 5 minutes
        })
      : await withCache(fetchNotificationData, {
          key: getNotificationCacheKey(id),
          duration: 'short', // Cache for 5 minutes
        });

    if (!notification) {
      return ERROR.json('NOTIFICATION_NOT_FOUND', { id });
    }

    return SUCCESS.json('Notification retrieved successfully', { notification });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting notification', { 
      module: 'Notifications', 
      label: 'GET_NOTIFICATION',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Update notification
 * PUT /api/notifications/[id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'edit_notification');
    if (permissionError) return permissionError;

    const { id } = await params;
    const body = await req.json();
    const {
      title,
      message,
      notification_type,
      is_read,
      priority,
      action_url,
      action_label,
      icon,
      metadata,
    } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (notification_type !== undefined) updateData.notification_type = notification_type;
    if (is_read !== undefined) updateData.is_read = is_read;
    if (priority !== undefined) updateData.priority = priority;
    if (action_url !== undefined) updateData.action_url = action_url || null;
    if (action_label !== undefined) updateData.action_label = action_label || null;
    if (icon !== undefined) updateData.icon = icon || null;
    if (metadata !== undefined) updateData.metadata = metadata || null;

    const notification = await prisma.notification.update({
      where: { notification_id: id },
      data: updateData,
    });

    // Invalidate notification caches (respects REDIS_CACHE_ENABLED flag)
    await invalidateNotificationsCache(id);
    await cache.delete(getNotificationsUnreadCountCacheKey());

    // Emit WebSocket event for notification update
    const userId = user?.uid || user?.user_id;
    const notificationUserId = (notification as any)?.user_id;
    if (notificationUserId || userId) {
      try {
        emitNotificationUpdateToUser(notificationUserId || userId || '', notification);
      } catch (wsError) {
        logger.warning('Failed to emit WebSocket notification update', {
          module: 'Notifications',
          label: 'WEBSOCKET_EMIT',
          extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
        });
      }
    }

    return SUCCESS.json('Notification updated successfully', { notification });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating notification', { 
      module: 'Notifications', 
      label: 'UPDATE_NOTIFICATION',
      extraData: { error: errorMessage }
    });
    if ((error as any)?.code === 'P2025') {
      return ERROR.json('NOTIFICATION_NOT_FOUND', { id: (await params).id });
    }
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Delete notification
 * DELETE /api/notifications/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'delete_notification');
    if (permissionError) return permissionError;

    const { id } = await params;
    const userId = user?.uid || user?.user_id;
    
    // Check if user is admin
    const isAdminUser = user?.groups?.some((g: { codename: string }) => 
      g.codename === 'admin' || g.codename === 'super_admin'
    ) || false;

    // First, check if notification exists and belongs to user (if not admin)
    const existingNotification = await prisma.notification.findUnique({
      where: { notification_id: id },
    });

    if (!existingNotification) {
      return ERROR.json('NOTIFICATION_NOT_FOUND', { id });
    }

    // Regular users can only delete their own notifications
    if (!isAdminUser && userId && existingNotification.user_id !== userId) {
      return ERROR.json('FORBIDDEN', { 
        message: 'You can only delete your own notifications' 
      });
    }

    const notificationUserId = existingNotification.user_id;

    await prisma.notification.delete({
      where: { notification_id: id },
    });

    // Invalidate notification caches (respects REDIS_CACHE_ENABLED flag)
    await invalidateNotificationsCache(id);
    await cache.delete(getNotificationsUnreadCountCacheKey());

    // Emit WebSocket event for notification deletion
    if (notificationUserId || userId) {
      try {
        emitNotificationDeleted(notificationUserId || userId || '', id);
      } catch (wsError) {
        logger.warning('Failed to emit WebSocket notification deletion', {
          module: 'Notifications',
          label: 'WEBSOCKET_EMIT',
          extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
        });
      }
    }

    return SUCCESS.json('Notification deleted successfully', { id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting notification', { 
      module: 'Notifications', 
      label: 'DELETE_NOTIFICATION',
      extraData: { error: errorMessage }
    });
    if ((error as any)?.code === 'P2025') {
      return ERROR.json('NOTIFICATION_NOT_FOUND', { id: (await params).id });
    }
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

