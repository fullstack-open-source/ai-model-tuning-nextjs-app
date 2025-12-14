import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Update Timezone
 * POST /api/settings/update-timezone
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'update_timezone');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const body = await req.json();
    const { timezone } = body;

    if (!timezone) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'timezone is required',
      });
    }

    try {
      await prisma.user.update({
        where: { user_id: userId },
        data: { timezone },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return ERROR.json('PROFILE_UPDATE_FAILED', { user_id: userId });
      }
      throw error;
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateAllUserRelatedCache(userId);

    const userData = await getUserByUserId(userId);
    if (!userData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }
    const serializedData = serializeData(userData);

    return SUCCESS.json('Timezone updated successfully', serializedData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating timezone', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_TIMEZONE',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}
