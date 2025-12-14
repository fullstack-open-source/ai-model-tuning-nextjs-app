import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getNotificationsCacheKey } from '@lib/cache/keys';
import { invalidateNotificationsCache } from '@lib/cache/invalidation';
import { prisma } from '@lib/db/prisma';
import { emitNotificationToUser, emitNotificationToAdmins } from '@lib/websocket/emitter';

/**
 * Get notifications
 * GET /api/notifications?status=unread&limit=10&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_notification');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'all'; // 'read', 'unread', or 'all'
    const notificationType = url.searchParams.get('notification_type') || 'all';
    const priority = url.searchParams.get('priority') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const forceRefresh = url.searchParams.has('_refresh');

    // Generate cache key based on filters
    const cacheKey = getNotificationsCacheKey({
      status,
      notification_type: notificationType,
      priority,
      limit,
      offset,
    });

    // Get user ID and check if user is admin
    const userId = user?.uid || user?.user_id;
    const isAdminUser = user?.groups?.some((g: { codename: string }) => 
      g.codename === 'admin' || g.codename === 'super_admin'
    ) || false;

    // Define the data fetcher function
    const fetchNotificationsData = async () => {
        const where: Record<string, unknown> = {};
        
        // Filter by user_id - regular users only see their own notifications
        // Admins can see all notifications (no user_id filter)
        if (!isAdminUser && userId) {
          where.user_id = userId;
        }

        // Filter by status
        if (status === 'unread') {
          where.read_at = null;
        } else if (status === 'read') {
          where.read_at = { not: null };
        }
        // If status is 'all' or not provided, no filter on read_at

        if (notificationType && notificationType !== 'all') {
          where.notification_type = notificationType;
        }

        if (priority && priority !== 'all') {
          where.priority = priority;
        }

        // Try to query notifications, but handle case where table might not exist
        let notifications: unknown[] = [];
        let total = 0;
        let unreadCount = 0;

        try {
          // Use type assertion to access notification model (may not exist if table not created)
          const prismaClient = prisma as typeof prisma & { notification?: { findMany: (args: unknown) => Promise<unknown[]>; count: (args: unknown) => Promise<number> } };
          
          if (!prismaClient.notification) {
            // Table doesn't exist - return empty results
            return {
              notifications: [],
              pagination: {
                total: 0,
                limit,
                offset,
                hasMore: false,
              },
              unread_count: 0,
            };
          }

          [notifications, total] = await Promise.all([
            prismaClient.notification.findMany({
              where,
              take: limit,
              skip: offset,
              orderBy: { created_at: 'desc' },
            }),
            prismaClient.notification.count({ where }),
          ]) as [unknown[], number];

          // Get unread count - filter by user_id for regular users
          const unreadWhere: Record<string, unknown> = { read_at: null };
          if (!isAdminUser && userId) {
            unreadWhere.user_id = userId;
          }
          unreadCount = await prismaClient.notification.count({
            where: unreadWhere,
          });
        } catch (dbError: unknown) {
          const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
          // Check if it's a table doesn't exist error
          if (dbErrorMessage.includes('does not exist') || dbErrorMessage.includes('relation') || dbErrorMessage.includes('table') || dbErrorMessage.includes('Unknown arg')) {
            logger.info('Notifications table does not exist yet', { 
              module: 'Notifications', 
              label: 'GET_NOTIFICATIONS',
              extraData: { error: dbErrorMessage }
            });
            // Return empty results instead of error
            return {
              notifications: [],
              pagination: {
                total: 0,
                limit,
                offset,
                hasMore: false,
              },
              unread_count: 0,
            };
          }
          // Re-throw if it's a different error
          throw dbError;
        }

        return {
          notifications,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
          unread_count: unreadCount,
        };
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const result = forceRefresh
      ? await reCache(fetchNotificationsData, {
          key: cacheKey,
          duration: 'short', // Cache for 5 minutes (notifications change frequently)
        })
      : await withCache(fetchNotificationsData, {
          key: cacheKey,
          duration: 'short', // Cache for 5 minutes (notifications change frequently)
        });

    return SUCCESS.json('Notifications retrieved successfully', result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting notifications', { 
      module: 'Notifications', 
      label: 'GET_NOTIFICATIONS',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Create notification
 * POST /api/notifications
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'add_notification');
    if (permissionError) return permissionError;

    const body = await req.json();
    const {
      title,
      message,
      notification_type,
      is_read = false,
      priority = 'normal',
      action_url,
      action_label,
      icon,
      metadata,
      user_id, // Optional: user_id to send notification to specific user (admin only)
    } = body;

    if (!title || !message || !notification_type) {
      return ERROR.json('INVALID_REQUEST', { 
        message: 'title, message, and notification_type are required' 
      });
    }

    // Get current user ID
    const currentUserId = user?.uid || user?.user_id;
    
    // Check if user is admin (can send to other users)
    const isAdminUser = user?.groups?.some((g: { codename: string }) => 
      g.codename === 'admin' || g.codename === 'super_admin'
    ) || false;

    // Determine recipient user_id
    let recipientUserId: string | null = null;
    if (user_id) {
      // Admin can specify user_id to send to specific user
      if (!isAdminUser) {
        return ERROR.json('FORBIDDEN', { 
          message: 'Only admins can send notifications to other users' 
        });
      }
      recipientUserId = user_id;
    } else {
      // If no user_id specified, send to current user (for self-notifications)
      recipientUserId = currentUserId || null;
    }

    // Use type assertion to access notification model
    const prismaClient = prisma as typeof prisma & { notification?: { create: (args: { data: unknown }) => Promise<unknown> } };
    
    if (!prismaClient.notification) {
      return ERROR.json('INVALID_REQUEST', { 
        message: 'Notifications table does not exist. Please run database migrations.' 
      });
    }

    const notification = await prismaClient.notification.create({
      data: {
        title,
        message,
        notification_type,
        is_read,
        priority,
        action_url: action_url || null,
        action_label: action_label || null,
        icon: icon || null,
        metadata: metadata || null,
        user_id: recipientUserId, // Link notification to specific user
      },
    });

    // Invalidate notifications cache when a new notification is created (respects REDIS_CACHE_ENABLED flag)
    await invalidateNotificationsCache();

    // Emit WebSocket event to the recipient user
    if (recipientUserId) {
      try {
        emitNotificationToUser(recipientUserId, notification);
      } catch (wsError) {
        // Log but don't fail the request if WebSocket emit fails
        logger.warning('Failed to emit WebSocket notification', {
          module: 'Notifications',
          label: 'WEBSOCKET_EMIT',
          extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
        });
      }
    }

    return SUCCESS.json('Notification created successfully', { notification }, {}, 201);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating notification', { 
      module: 'Notifications', 
      label: 'CREATE_NOTIFICATION',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

