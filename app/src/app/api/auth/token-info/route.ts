import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import jwt from 'jsonwebtoken';
import { authConfig } from '@lib/config/env';
import {
  ACCESS_TOKEN_EXPIRY,
  SESSION_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '@lib/authenticate/session-manager';

const SECRET_KEY = authConfig.jwtSecretKey || authConfig.jwtSecret;
const ALGORITHM = authConfig.jwtAlgorithm || 'HS256';

/**
 * Format duration in minutes to human-readable format
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (minutes < 1440) {
    // Less than 24 hours
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  } else if (minutes < 10080) {
    // Less than 7 days
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else {
      return `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
  } else {
    // 7 days or more
    const days = Math.floor(minutes / 1440);
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) {
      return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    } else {
      return `${weeks} week${weeks !== 1 ? 's' : ''} and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    }
  }
}

/**
 * Get Token Info (GET)
 * GET /api/auth/token-info
 */
export async function GET(req: NextRequest) {
  try {
    // Extract token from headers
    const authHeader = req.headers.get('authorization') || '';
    let token: string | null = null;

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    } else {
      token = req.headers.get('x-session-token') || '';
    }

    if (!token) {
      return ERROR.json('AUTH_INVALID_TOKEN', {
        message: 'No token provided',
      });
    }

    return getTokenInfo(token);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in token_info (GET)', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'TOKEN_INFO',
      },
    });
    return ERROR.json('AUTH_INVALID_TOKEN', {}, error);
  }
}

/**
 * Get Token Info (POST)
 * POST /api/auth/token-info
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'token is required',
      });
    }

    return getTokenInfo(token);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in token_info (POST)', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'TOKEN_INFO',
      },
    });
    return ERROR.json('AUTH_INVALID_TOKEN', {}, error);
  }
}

/**
 * Get token information helper
 */
function getTokenInfo(token: string) {
  try {
    if (!SECRET_KEY) {
      return ERROR.json('AUTH_INVALID_TOKEN', {
        message: 'JWT configuration error',
      });
    }

    // Decode token (without verification for info purposes)
    let payload: any;
    try {
      payload = jwt.decode(token, { complete: false });
    } catch (error: unknown) {
      return ERROR.json('AUTH_INVALID_TOKEN', {
        message: 'Invalid token format',
      });
    }

    if (!payload) {
      return ERROR.json('AUTH_INVALID_TOKEN', {
        message: 'Could not decode token',
      });
    }

    // Get token type
    const tokenType = payload.type || 'access';
    const userId = payload.sub || payload.user_id;
    const sessionId = payload.session_id;
    const jti = payload.jti;
    const iat = payload.iat;
    const exp = payload.exp;

    // Calculate expiry times
    let expiresInMinutes = 0;
    let expiresIn: string = 'Unknown';

    if (tokenType === 'access') {
      expiresInMinutes = ACCESS_TOKEN_EXPIRY;
      expiresIn = formatDuration(expiresInMinutes);
    } else if (tokenType === 'session') {
      expiresInMinutes = SESSION_TOKEN_EXPIRY;
      expiresIn = formatDuration(expiresInMinutes);
    } else if (tokenType === 'refresh') {
      expiresInMinutes = REFRESH_TOKEN_EXPIRY;
      expiresIn = formatDuration(expiresInMinutes);
    }

    // Calculate time remaining
    let timeRemaining: string = 'Expired';
    let isExpired = false;
    if (exp) {
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = exp - now;
      if (remainingSeconds > 0) {
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        timeRemaining = formatDuration(remainingMinutes);
        isExpired = false;
      } else {
        isExpired = true;
        timeRemaining = 'Expired';
      }
    }

    const tokenInfo = {
      token_type: tokenType,
      user_id: userId,
      session_id: sessionId,
      jti: jti,
      issued_at: iat ? new Date(iat * 1000).toISOString() : null,
      expires_at: exp ? new Date(exp * 1000).toISOString() : null,
      expires_in: expiresIn,
      time_remaining: timeRemaining,
      is_expired: isExpired,
      algorithm: ALGORITHM,
    };

    return SUCCESS.json('Token information retrieved successfully', tokenInfo);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting token info', {
      module: 'Auth',
      extraData: { error: errorMessage },
    });
    return ERROR.json('AUTH_INVALID_TOKEN', {}, error);
  }
}

