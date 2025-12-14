import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';

/**
 * Get account share activity for current user's owned shares
 * GET /api/account-shares/activity
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_share_activity');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const url = new URL(req.url);
    const shareId = url.searchParams.get('share_id');
    const action = url.searchParams.get('action');
    const actionType = url.searchParams.get('action_type');
    const fromDate = url.searchParams.get('from_date');
    const toDate = url.searchParams.get('to_date');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause - show activity for shares I own OR where I'm the shared user
    const where: Record<string, unknown> = {
      OR: [
        { user_id: userId }, // Activities performed by this user
        { share: { owner_id: userId } }, // Activities on shares owned by this user
        { share: { recipient_id: userId } } // Activities on shares where this user is recipient
      ]
    };

    if (shareId) {
      where.share_id = shareId;
    }

    if (action) {
      where.action = action;
    }

    if (actionType) {
      where.action_type = actionType;
    }

    if (fromDate || toDate) {
      where.created_at = {};
      if (fromDate) {
        (where.created_at as Record<string, unknown>).gte = new Date(fromDate);
      }
      if (toDate) {
        (where.created_at as Record<string, unknown>).lte = new Date(toDate);
      }
    }

    // Get activities with related data
    const [activities, total] = await Promise.all([
      prisma.accountShareActivity.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
              profile_picture_url: true
            }
          },
          share: {
            select: {
              share_id: true,
              access_level: true,
              status: true,
              owner: {
                select: {
                  user_id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  profile_picture_url: true
                }
              },
              recipient: {
                select: {
                  user_id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  profile_picture_url: true
                }
              }
            }
          }
        }
      }),
      prisma.accountShareActivity.count({ where })
    ]);

    return SUCCESS.json('Activity retrieved successfully', {
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting share activity', {
      module: 'AccountShares',
      label: 'GET_ACTIVITY',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

