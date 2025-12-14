import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { getUserProfileCacheKey } from '@lib/cache/keys';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { cache } from '@lib/cache/cache';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Update Profile
 * POST /api/settings/update-profile
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'edit_profile');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const body = await req.json();
    const updateData = { ...body };

    // Remove protected fields
    const protectedFields = ['user_id'];
    if (user.email) {
      protectedFields.push('email');
    } else {
      protectedFields.push('phone');
    }

    for (const field of protectedFields) {
      delete updateData[field];
    }

    if (Object.keys(updateData).length === 0) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', { user_id: userId });
    }

    // Build update data object for Prisma
    const updateDataForPrisma: any = {};

    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'phone_number' && typeof value === 'object') {
        updateDataForPrisma[key] = value;
      } else if (key === 'is_profile_completed') {
        // Handle is_profile_completed field
        updateDataForPrisma.is_profile_completed = value === true || value === 'true';
      } else {
        updateDataForPrisma[key] = value;
      }
    }

    try {
      await prisma.user.update({
        where: { user_id: userId },
        data: updateDataForPrisma,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return ERROR.json('PROFILE_UPDATE_FAILED', { user_id: userId });
      }
      throw error;
    }

    // Invalidate profile and user-related caches
    await cache.delete(getUserProfileCacheKey(userId));
    await invalidateAllUserRelatedCache(userId);

    // Fetch updated user data
    const userData = await getUserByUserId(userId);
    if (!userData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }
    const serializedData = serializeData(userData);

    return SUCCESS.json('User profile update successfully', serializedData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating profile', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_PROFILE',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}
