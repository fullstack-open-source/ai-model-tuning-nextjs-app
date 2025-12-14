import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { withCache, reCache } from '@lib/middleware/cache';
import { getDashboardOverviewCacheKey } from '@lib/cache/keys';
import { prisma } from '@lib/db/prisma';

/**
 * Get dashboard overview statistics
 * GET /api/dashboard/overview
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_dashboard');
    if (permissionError) return permissionError;

    // Check for cache bypass parameter
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('_refresh');

    // Define the data fetcher function
    const fetchOverviewData = async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const [
          totalUsers,
          activeUsers,
          verifiedUsers,
          emailVerified,
          phoneVerified,
          newUsersToday,
          newUsersThisWeek,
          newUsersThisMonth,
          usersWithLastSignIn,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { is_active: true } }),
          prisma.user.count({ where: { is_verified: true } }),
          prisma.user.count({ where: { email_verified: true } }),
          prisma.user.count({ where: { phone_verified: true } }),
          prisma.user.count({ 
            where: { 
              created_at: { gte: today, lt: tomorrow }
            }
          }),
          prisma.user.count({ 
            where: { 
              created_at: { gte: weekAgo }
            }
          }),
          prisma.user.count({ 
            where: { 
              created_at: { gte: monthStart }
            }
          }),
          prisma.user.count({ 
            where: { 
              last_login: { not: null }
            }
          })
        ]);
        
        return {
          overview: {
            total_users: totalUsers,
            active_users: activeUsers,
            verified_users: verifiedUsers,
            email_verified: emailVerified,
            phone_verified: phoneVerified,
            new_users: {
              today: newUsersToday,
              this_week: newUsersThisWeek,
              this_month: newUsersThisMonth
            },
            users_with_sign_in: usersWithLastSignIn
          }
        };
    };

    // Use cache middleware: Redis -> DB -> Cache -> Return
    // If forceRefresh is true, invalidate cache and re-cache fresh data
    const result = forceRefresh
      ? await reCache(fetchOverviewData, {
          key: getDashboardOverviewCacheKey(),
          duration: 'long', // Cache for 1 hour (analytics are relatively stable)
        })
      : await withCache(fetchOverviewData, {
          key: getDashboardOverviewCacheKey(),
          duration: 'long', // Cache for 1 hour (analytics are relatively stable)
        });
    
    return SUCCESS.json('Dashboard overview retrieved successfully', result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error in dashboard overview', { module: 'Dashboard', label: 'OVERVIEW', extraData: { error: errorMessage, stack: errorStack } });
    return ERROR.json('DASHBOARD_ERROR', {}, error);
  }
}

