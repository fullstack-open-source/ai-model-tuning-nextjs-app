import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { invalidateAllUserRelatedCache, invalidateDashboardCache } from '@lib/cache/invalidation';
import { verifyOtp } from '@lib/authenticate/otp-cache';
import { validateEmail, validatePhone } from '@lib/authenticate/helpers';
import { prisma } from '@lib/db/prisma';

/**
 * Verify Email and Phone
 * POST /api/auth/verify-email-and-phone
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, channel, otp } = body;

    if (!user_id || !channel || !otp) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'user_id, channel, and otp are required',
      });
    }

    if (!['email', 'sms'].includes(channel)) {
      return ERROR.json('AUTH_CHANNEL_UNSUPPORTED', { channel });
    }

    const userIdClean = user_id.trim();
    if (channel === 'email' && !validateEmail(userIdClean)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        user_id: userIdClean,
        channel,
        message: 'Invalid email format',
      });
    } else if (channel === 'sms' && !validatePhone(userIdClean)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        user_id: userIdClean,
        channel,
        message: 'Invalid phone number format',
      });
    }

    // Verify OTP (don't delete - keep for potential reuse)
    const isValid = await verifyOtp(userIdClean, otp, false);
    if (!isValid) {
      return ERROR.json('AUTH_OTP_INVALID', { user_id: userIdClean, channel });
    }

    let updatedUser;
    let userId: string | null = null;

    if (channel === 'email') {
      // First get the user_id before updating
      const user = await prisma.user.findFirst({
        where: {
          email: {
            equals: userIdClean,
            mode: 'insensitive',
          },
        },
        select: { user_id: true },
      });

      if (!user) {
        return ERROR.json('AUTH_PROCESSING_ERROR', { user_id: userIdClean, channel });
      }

      userId = user.user_id;

      updatedUser = await prisma.user.updateMany({
        where: {
          email: {
            equals: userIdClean,
            mode: 'insensitive',
          },
        },
        data: {
          email_verified: true,
        },
      });

      if (updatedUser.count === 0) {
        return ERROR.json('AUTH_PROCESSING_ERROR', { user_id: userIdClean, channel });
      }
    } else if (channel === 'sms') {
      const phoneClean = userIdClean.replace('+', '');
      // Use raw query for JSONB field search
      const result = await prisma.$queryRaw<Array<{ user_id: string }>>`
        UPDATE "user"
        SET is_phone_verified = TRUE, phone_number_verified_at = NOW()
        WHERE phone_number->>'phone' = ${phoneClean} OR phone_number->>'phone' = ${`+${phoneClean}`}
        RETURNING user_id, is_phone_verified, phone_number_verified_at
      `;

      if (result.length === 0) {
        return ERROR.json('AUTH_PROCESSING_ERROR', { user_id: userIdClean, channel });
      }

      userId = result[0].user_id;
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag)
    if (userId) {
      await invalidateAllUserRelatedCache(userId);
      await invalidateDashboardCache();
    }

    return SUCCESS.json(`${channel.charAt(0).toUpperCase() + channel.slice(1)} verified successfully`, {
      user_id: userIdClean,
      channel,
      verified: true,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in verify_email_and_phone', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'VERIFY_EMAIL_PHONE',
      },
    });
    return ERROR.json('AUTH_PROCESSING_ERROR', {}, error);
  }
}

