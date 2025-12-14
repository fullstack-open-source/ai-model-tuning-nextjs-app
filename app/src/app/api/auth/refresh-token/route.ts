import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import jwt from 'jsonwebtoken';
import { authConfig } from '@lib/config/env';
import {
  getUserById,
  generateAllTokens,
  extractOrigin,
} from '@lib/authenticate/helpers';
import {
  blacklistToken,
  blacklistSession,
} from '@lib/authenticate/session-manager';

const SECRET_KEY = authConfig.jwtSecretKey || authConfig.jwtSecret;
const ALGORITHM = authConfig.jwtAlgorithm || 'HS256';

/**
 * Refresh Token
 * POST /api/auth/refresh-token
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refresh_token } = body;

    if (!refresh_token || !refresh_token.trim()) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'refresh_token is required',
      });
    }

    if (!SECRET_KEY) {
      return ERROR.json('AUTH_REFRESH_FAILED', {
        message: 'JWT configuration error',
      });
    }

    // Decode and validate refresh token
    let tokenPayload: any;
    try {
      try {
        tokenPayload = jwt.verify(refresh_token, SECRET_KEY, {
          algorithms: [ALGORITHM],
          audience: 'authenticated',
        });
      } catch (audienceError) {
        // Fallback: try without audience
        tokenPayload = jwt.verify(refresh_token, SECRET_KEY, {
          algorithms: [ALGORITHM],
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (error instanceof jwt.TokenExpiredError) {
        return ERROR.json('AUTH_INVALID_REFRESH_TOKEN', {
          message: 'Refresh token has expired',
        });
      }
      logger.error('JWT decode error for refresh token', {
        module: 'Auth',
        extraData: { error: errorMessage },
      });
      return ERROR.json('AUTH_INVALID_REFRESH_TOKEN', {
        message: `Invalid refresh token: ${errorMessage}`,
      });
    }

    // Validate token type
    if (tokenPayload.type !== 'refresh') {
      return ERROR.json('AUTH_INVALID_TOKEN_TYPE', {
        message: 'Token is not a refresh token',
      });
    }

    // Extract user_id and session_id
    const userId = tokenPayload.sub;
    const sessionId = tokenPayload.session_id;

    if (!userId) {
      return ERROR.json('AUTH_USER_NOT_FOUND', {
        message: 'User ID not found in token',
      });
    }

    // Get user from database
    const user = await getUserById(userId);
    if (!user) {
      return ERROR.json('USER_NOT_FOUND', { user_id: userId });
    }

    // Get origin for new tokens
    const origin = extractOrigin(req);

    // Token rotation: Blacklist old tokens and session before generating new ones
    await blacklistToken(refresh_token, 'refresh');
    if (sessionId) {
      await blacklistSession(sessionId);
    }

    // Generate NEW tokens with NEW session_id (complete token rotation)
    const tokens = generateAllTokens(user, origin, req);

    return SUCCESS.json('Tokens refreshed successfully', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      session_token: tokens.session_token,
      session_id: tokens.session_id,
      token_type: 'bearer',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error refreshing token', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'REFRESH_TOKEN',
      },
    });
    return ERROR.json('AUTH_REFRESH_FAILED', {}, error);
  }
}

