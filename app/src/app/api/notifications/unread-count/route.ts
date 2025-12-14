import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getNotificationsUnreadCountCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_notification_count');
    if (permissionError) return permissionError;

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Get user ID and check if user is admin
    const userId = user?.uid || user?.user_id;
    const isAdminUser = user?.groups?.some((g: { codename: string }) => 
      g.codename === 'admin' || g.codename === 'super_admin'
    ) || false;

    // Define the data fetcher function
    const fetchUnreadCountData = async () => {
        try {
          // Use type assertion to access notification model (may not exist if table not created)
          const prismaClient = prisma as typeof prisma & { notification?: { count: (args: unknown) => Promise<number> } };
          
          if (!prismaClient.notification) {
            // Table doesn't exist - return 0
            return 0;
          }

          // Filter by user_id for regular users, admins see all
          const whereClause: Record<string, unknown> = { read_at: null };
          if (!isAdminUser && userId) {
            whereClause.user_id = userId;
          }

          return await prismaClient.notification.count({
            where: whereClause,
          });
        } catch (dbError: unknown) {
          const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
          // Check if it's a table doesn't exist error
          if (dbErrorMessage.includes('does not exist') || dbErrorMessage.includes('relation') || dbErrorMessage.includes('table') || dbErrorMessage.includes('Unknown arg')) {
            logger.info('Notifications table does not exist yet', { 
              module: 'Notifications', 
              label: 'GET_UNREAD_COUNT',
              extraData: { error: dbErrorMessage }
            });
            // Return 0 instead of error
            return 0;
          }
          // Re-throw if it's a different error
          throw dbError;
        }
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const unreadCount = forceRefresh
      ? await reCache(fetchUnreadCountData, {
          key: getNotificationsUnreadCountCacheKey(),
          duration: 'short', // Cache for 5 minutes (unread count changes frequently)
        })
      : await withCache(fetchUnreadCountData, {
          key: getNotificationsUnreadCountCacheKey(),
          duration: 'short', // Cache for 5 minutes (unread count changes frequently)
        });

    return SUCCESS.json('Unread count retrieved', { 
      unread_count: unreadCount 
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting unread count', { 
      module: 'Notifications', 
      label: 'GET_UNREAD_COUNT',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

