import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache, invalidateDashboardCache } from '@lib/cache/invalidation';
import { prisma } from '@lib/db/prisma';

/**
 * Delete Account
 * POST /api/settings/delete-account
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'delete_account');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const body = await req.json();
    const { confirm } = body;

    if (confirm !== true) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'Account deletion must be confirmed',
      });
    }

    try {
      await prisma.user.update({
        where: { user_id: userId },
        data: {
          is_active: false,
          account_status: 'inactive',
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return ERROR.json('PROFILE_UPDATE_FAILED', { user_id: userId });
      }
      throw error;
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateAllUserRelatedCache(userId);
    await invalidateDashboardCache();

    return SUCCESS.json('Account deactivated successfully', {
      user_id: userId,
      is_active: false,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting account', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'DELETE_ACCOUNT',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}
