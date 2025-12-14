import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';

/**
 * Search users to share with (by email or username)
 * GET /api/account-shares/search-users?q=search_term
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'share_account');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return SUCCESS.json('Search results', { users: [] });
    }

    // Search by email or username, exclude current user
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { user_id: { not: userId } },
          { is_active: true },
          {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { first_name: { contains: query, mode: 'insensitive' } },
              { last_name: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      take: 10,
      select: {
        user_id: true,
        email: true,
        first_name: true,
        last_name: true,
        profile_picture_url: true
      }
    });

    // Add full_name to each user
    const usersWithFullName = users.map(u => ({
      ...u,
      full_name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null
    }));

    return SUCCESS.json('Search results', { users: usersWithFullName });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error searching users', {
      module: 'AccountShares',
      label: 'SEARCH_USERS',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

