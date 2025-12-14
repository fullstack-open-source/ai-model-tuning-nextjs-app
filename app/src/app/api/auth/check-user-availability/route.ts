import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { checkUserAvailabilityInDb } from '@lib/authenticate/helpers';

/**
 * Check User Availability
 * POST /api/auth/check-user-availability
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, phone, email } = body;

    const identifier = user_id || phone || email;

    if (!identifier) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'user_id, phone, or email is required',
      });
    }

    const isAvailable = await checkUserAvailabilityInDb(identifier);
    const available = !isAvailable; // Available means NOT in database

    return SUCCESS.json('User availability checked', {
      available,
      user_id: identifier,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking user availability', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'CHECK_AVAILABILITY',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

