import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { getUserProfileCacheKey } from '@lib/cache/keys';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { cache } from '@lib/cache/cache';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';
import { updateUserPassword } from '@lib/authenticate/helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Complete Onboarding
 * POST /api/settings/complete-onboarding
 * Sets password, updates profile, and marks profile as completed in a single call
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
    const { 
      password, 
      confirm_password,
      first_name,
      last_name,
      user_name,
      bio,
      country,
      gender,
      dob,
      phone_number,
    } = body;

    // Validate password if provided
    if (password || confirm_password) {
      if (!password || !confirm_password) {
        return ERROR.json('AUTH_INVALID_PAYLOAD', {
          message: 'Both password and confirm_password are required',
        });
      }

      if (password !== confirm_password) {
        return ERROR.json('AUTH_INVALID_PAYLOAD', {
          message: 'password and confirm_password do not match',
        });
      }

      if (password.length < 6) {
        return ERROR.json('AUTH_INVALID_PAYLOAD', {
          message: 'Password must be at least 6 characters',
        });
      }
    }

    // Validate required profile fields
    if (!first_name || !last_name) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'first_name and last_name are required',
      });
    }

    // Build update data object for Prisma
    const updateDataForPrisma: any = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      is_profile_completed: true, // Always set to true when completing onboarding
    };

    // Add optional fields if provided
    if (user_name) updateDataForPrisma.user_name = user_name.trim();
    if (bio) updateDataForPrisma.bio = bio.trim();
    if (country) updateDataForPrisma.country = country.trim();
    if (gender) updateDataForPrisma.gender = gender;
    if (dob) updateDataForPrisma.dob = new Date(dob);
    if (phone_number) {
      updateDataForPrisma.phone_number = typeof phone_number === 'object' 
        ? phone_number 
        : { phone: phone_number.trim() };
    }

    // Update password if provided
    if (password && confirm_password) {
      const passwordSuccess = await updateUserPassword(userId, confirm_password);
      if (!passwordSuccess) {
        return ERROR.json('AUTH_PASSWORD_UPDATE_FAILED', { user_id: userId });
      }
    }

    // Update profile in database
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

    return SUCCESS.json('Onboarding completed successfully', serializedData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error completing onboarding', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'COMPLETE_ONBOARDING',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}

