import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { verifyOtp } from '@lib/authenticate/otp-cache';
import { validateEmail } from '@lib/authenticate/helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Change Email
 * POST /api/settings/change-email
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'change_email');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const body = await req.json();
    const { new_email, otp } = body;

    if (!new_email || !otp) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'new_email and otp are required',
      });
    }

    const newEmailClean = new_email.trim().toLowerCase();

    if (!validateEmail(newEmailClean)) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'Invalid email format',
      });
    }

    // Verify OTP first
    const isValid = await verifyOtp(newEmailClean, otp, false);
    if (!isValid) {
      return ERROR.json('PROFILE_INVALID_OTP', { user_id: userId });
    }

    // Check if email already exists for another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: newEmailClean,
        user_id: { not: userId },
      },
      select: { user_id: true, email: true },
    });

    if (existingUser) {
      return ERROR.json('EMAIL_ALREADY_EXISTS', { user_id: userId, email: newEmailClean });
    }

    // Update email and verify email status
    try {
      const updatedUser = await prisma.user.update({
        where: { user_id: userId },
        data: {
          email: newEmailClean,
          email_verified: true,
        },
        select: {
          user_id: true,
          email: true,
          email_verified: true,
        },
      });

      // Delete OTP after successful verification
      await verifyOtp(newEmailClean, otp, true);

      // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
      await invalidateAllUserRelatedCache(userId);

      return SUCCESS.json('Email updated and verified successfully', {
        user: {
          id: userId,
          email: updatedUser.email,
          email_verified: updatedUser.email_verified,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return ERROR.json('PROFILE_EMAIL_CHANGE_FAILED', { user_id: userId });
      }
      throw error;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error changing email', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'CHANGE_EMAIL',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}

