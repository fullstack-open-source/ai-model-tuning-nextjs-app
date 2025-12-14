import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';
import { prisma } from '@lib/db/prisma';
import { authService } from '@services/auth.service';

/**
 * Enable/Disable Two-Factor Authentication
 * POST /api/settings/two-factor-auth
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
    const { enabled, method = 'email' } = body;

    if (typeof enabled !== 'boolean') {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'enabled must be a boolean',
      });
    }

    const updateData: any = {
      two_factor_enabled: enabled,
      two_factor_method: enabled ? method : null,
    };

    // Get current user from database to check if secret exists
    const currentUser = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { two_factor_secret: true },
    });

    // If enabling, generate a secret (in production, use a proper 2FA library like speakeasy)
    if (enabled && !currentUser?.two_factor_secret) {
      // Generate a simple secret (in production, use proper 2FA secret generation)
      const secret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      updateData.two_factor_secret = secret;
    } else if (!enabled) {
      // Clear secret when disabling
      updateData.two_factor_secret = null;
    }

    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: updateData,
    });

    // Invalidate cache
    await invalidateAllUserRelatedCache(userId);

    // Fetch updated user data (this will get fresh data from DB)
    const userData = await getUserByUserId(userId);
    if (!userData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }
    const serializedData = serializeData(userData);

    // Ensure two_factor_enabled is included in response - use the value from the update
    // The serializedData should already have it, but we'll explicitly set it to be sure
    const responseData = {
      ...serializedData,
      two_factor_enabled: updatedUser.two_factor_enabled === true, // Explicitly convert to boolean
    };
    
    logger.info('2FA update response', {
      module: 'Profile',
      extraData: {
        userId,
        enabled,
        updatedValue: updatedUser.two_factor_enabled,
        responseValue: responseData.two_factor_enabled,
        serializedHasField: 'two_factor_enabled' in serializedData,
      },
    });

    return SUCCESS.json(
      enabled ? 'Two-factor authentication enabled successfully' : 'Two-factor authentication disabled successfully',
      responseData
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating two-factor authentication', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_2FA',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}

