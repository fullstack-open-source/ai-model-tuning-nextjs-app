import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Update Profile Accessibility
 * POST /api/settings/profile-accessibility
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'update_profile_accessibility');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const body = await req.json();
    const { profile_accessibility } = body;

    if (!profile_accessibility || !['public', 'private'].includes(profile_accessibility)) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'profile_accessibility must be "public" or "private"',
      });
    }

    await prisma.user.update({
      where: { user_id: userId },
      data: { profile_accessibility },
    });

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
    await invalidateAllUserRelatedCache(userId);

    // Fetch latest user data
    const userData = await getUserByUserId(userId);
    if (!userData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }
    const serializedData = serializeData(userData);

    return SUCCESS.json('Profile accessibility update successfully', serializedData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating profile accessibility', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_ACCESSIBILITY',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}
