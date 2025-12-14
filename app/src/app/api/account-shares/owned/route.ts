import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';

/**
 * Get shares I've given to others (accounts I'm sharing)
 * GET /api/account-shares/owned
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_account_sharing');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'active';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = {
      owner_id: userId
    };

    if (status !== 'all') {
      where.status = status;
    }

    // Get shares with related user data
    const [shares, total] = await Promise.all([
      prisma.accountShare.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { created_at: 'desc' },
        include: {
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
      }),
      prisma.accountShare.count({ where })
    ]);

    return SUCCESS.json('Owned shares retrieved successfully', {
      shares,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting owned shares', {
      module: 'AccountShares',
      label: 'GET_OWNED_SHARES',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

