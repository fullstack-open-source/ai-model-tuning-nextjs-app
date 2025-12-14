import { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { logger } from '@lib/logger/logger';
import { ERROR } from '@lib/response/response';
import { authConfig } from '@lib/config/env';

export interface AuthenticatedUser {
  uid?: string;
  user_id?: string;
  email?: string;
  phone_number?: any;
  [key: string]: any;
}

/**
 * Extract token from request headers
 */
function extractToken(req: NextRequest): string | null {
  // Priority 1: X-Session-Token header (preferred)
  const sessionToken = req.headers.get('x-session-token');
  if (sessionToken) return sessionToken.trim();

  // Priority 2: Authorization Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }

  // Priority 3: access_token query parameter (backward compatibility)
  const url = new URL(req.url);
  const accessToken = url.searchParams.get('access_token');
  if (accessToken) return accessToken;

  return null;
}

/**
 * Validate user token and return user object
 */
export async function validateUser(req: NextRequest): Promise<AuthenticatedUser> {
  const token = extractToken(req);

  if (!token) {
    const error = new Error('No token provided');
    (error as any).statusCode = 401;
    (error as any).details = {
      success: false,
      error_key: 'UNAUTHORIZED',
      message: 'Missing or invalid Bearer token or Expired session',
    };
    throw error;
  }

  try {
    const SECRET_KEY = authConfig.jwtSecretKey || authConfig.jwtSecret;
    if (!SECRET_KEY) {
      throw new Error('JWT_SECRET_KEY not configured');
    }

    // Decode and verify token
    let payload: any;
    try {
      payload = jwt.verify(token, SECRET_KEY, {
        algorithms: [authConfig.jwtAlgorithm],
        audience: 'authenticated',
      });
    } catch (audienceError: any) {
      // Fallback: try without audience
      payload = jwt.verify(token, SECRET_KEY, {
        algorithms: [authConfig.jwtAlgorithm],
      });
    }

    // Check token type
    const tokenType = payload.type || 'access';
    if (tokenType === 'session' && payload.user) {
      // Session token contains full user data
      return payload.user as AuthenticatedUser;
    }

    // For access tokens, extract user_id
    const userId = payload.sub || payload.user_id;
    if (!userId) {
      throw new Error('User ID not found in token');
    }

    // Return minimal user object for access tokens
    return {
      uid: String(userId),
      user_id: String(userId),
    } as AuthenticatedUser;
  } catch (error: any) {
    logger.error('Token validation failed', { module: 'Auth', label: 'VALIDATE_USER', extraData: { error: error.message } });
    
    const jwtError = new Error('Invalid or expired token');
    (jwtError as any).statusCode = 401;
    (jwtError as any).details = {
      success: false,
      error_key: 'UNAUTHORIZED',
      message: 'Missing or invalid Bearer token or Expired session',
    };
    throw jwtError;
  }
}

/**
 * Middleware to validate authentication
 * Attaches user to request
 */
export async function validateRequest(req: NextRequest): Promise<{ user: AuthenticatedUser }> {
  try {
    const user = await validateUser(req);
    return { user };
  } catch (error: any) {
    logger.error('Authentication validation failed', { module: 'Auth', label: 'VALIDATE_REQUEST', extraData: { error: error.message } });
    throw error;
  }
}

