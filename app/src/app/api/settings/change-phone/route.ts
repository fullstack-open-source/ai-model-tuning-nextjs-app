import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { verifyOtp } from '@lib/authenticate/otp-cache';
import { validatePhone } from '@lib/authenticate/helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Change Phone
 * POST /api/settings/change-phone
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'change_phone');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const body = await req.json();
    const { new_phone, otp } = body;

    if (!new_phone || !otp) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'new_phone and otp are required',
      });
    }

    const newPhoneClean = new_phone.trim();

    if (!validatePhone(newPhoneClean)) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'Invalid phone number format',
      });
    }

    // Verify OTP
    const isValid = await verifyOtp(newPhoneClean, otp, false);
    if (!isValid) {
      return ERROR.json('PROFILE_INVALID_OTP', { user_id: userId });
    }

    const phoneClean = newPhoneClean.replace('+', '');

    // Check if phone already exists for another user (using raw query for JSONB)
    const checkResult = await prisma.$queryRaw<Array<any>>`
      SELECT user_id, phone_number
      FROM "user"
      WHERE phone_number->>'phone' = ${phoneClean} AND user_id::text != ${userId}
    `;

    if (checkResult.length > 0) {
      return ERROR.json('EMAIL_ALREADY_EXISTS', { user_id: userId, phone: newPhoneClean });
    }

    // Update phone number
    try {
      const updatedUser = await prisma.user.update({
        where: { user_id: userId },
        data: {
          phone_number: { phone: phoneClean },
          phone_verified: true,
        },
        select: {
          user_id: true,
          phone_number: true,
          phone_verified: true,
        },
      });

      await verifyOtp(newPhoneClean, otp, true);

      // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
      await invalidateAllUserRelatedCache(userId);

      return SUCCESS.json('Phone number updated and verified successfully', {
        user: {
          id: userId,
          phone_number: updatedUser.phone_number,
          phone_verified: updatedUser.phone_verified,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return ERROR.json('PROFILE_UPDATE_FAILED', { user_id: userId });
      }
      throw error;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error changing phone', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'CHANGE_PHONE',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}
