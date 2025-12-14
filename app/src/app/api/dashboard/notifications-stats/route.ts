import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardStatisticsCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get Notifications Statistics
 * GET /api/dashboard/notifications-stats
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard_statistics');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchNotificationsStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      const [
        totalNotifications,
        unreadNotifications,
        byType,
        byPriority,
        notificationsThisWeek,
        notificationsThisMonth,
      ] = await Promise.all([
        prisma.notification.count(),
        prisma.notification.count({
          where: { read_at: null },
        }),
        prisma.notification.groupBy({
          by: ['notification_type'],
          _count: { notification_type: true },
        }),
        prisma.notification.groupBy({
          by: ['priority'],
          _count: { priority: true },
        }),
        prisma.notification.count({
          where: { created_at: { gte: weekAgo } },
        }),
        prisma.notification.count({
          where: { created_at: { gte: monthAgo } },
        }),
      ]);

      return {
        total: totalNotifications,
        unread: unreadNotifications,
        read: totalNotifications - unreadNotifications,
        by_type: byType.map((r: { notification_type: string; _count: { notification_type: number } }) => ({
          type: r.notification_type,
          count: r._count.notification_type,
        })),
        by_priority: byPriority.map((r: { priority: string | null; _count: { priority: number } }) => ({
          priority: r.priority || 'normal',
          count: r._count.priority,
        })),
        this_week: notificationsThisWeek,
        this_month: notificationsThisMonth,
      };
    };

    const stats = forceRefresh
      ? await reCache(fetchNotificationsStats, {
          key: getDashboardStatisticsCacheKey('notifications-stats'),
          duration: 'long',
        })
      : await withCache(fetchNotificationsStats, {
          key: getDashboardStatisticsCacheKey('notifications-stats'),
          duration: 'long',
        });

    return SUCCESS.json('Notifications statistics retrieved successfully', stats);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in notifications stats', {
      module: 'Dashboard',
      extraData: { error: errorMessage, label: 'NOTIFICATIONS_STATS' },
    });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}

