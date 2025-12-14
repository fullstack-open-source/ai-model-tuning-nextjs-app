/**
 * Authentication Helper Functions
 * Token generation, user authentication, and utility functions
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@lib/db/prisma';
import { logger } from '@lib/logger/logger';
import { authConfig } from '@lib/config/env';
import {
  clearUserBlacklist,
  clearUserRefreshTokenBlacklist,
} from './session-manager';

const SECRET_KEY = authConfig.jwtSecretKey || authConfig.jwtSecret;
const ALGORITHM = authConfig.jwtAlgorithm || 'HS256';

// Email and phone validators
const emailValidator = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phoneValidator = /^\+?[1-9]\d{1,14}$/;

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return emailValidator.test(email);
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string): boolean {
  return phoneValidator.test(phone);
}

/**
 * Verify password using bcrypt
 */
export function verifyPassword(plainPassword: string, hashedPassword: string): boolean {
  if (!hashedPassword || !plainPassword) {
    return false;
  }
  try {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Password verification error', {
      module: 'Auth',
      extraData: { error: errorMessage },
    });
    return false;
  }
}

/**
 * Hash password using bcrypt
 */
export function hashPassword(password: string): string {
  const saltRounds = authConfig.bcryptSaltRounds || 10;
  return bcrypt.hashSync(password, saltRounds);
}

/**
 * Normalize user ID for consistent lookup
 */
function normalizeUserId(userId: string): string {
  if (!userId) return userId;
  let normalized = userId.trim();
  if (normalized.includes('@')) {
    normalized = normalized.toLowerCase();
  }
  return normalized;
}

/**
 * Get user by email or phone
 */
export async function getUserByEmailOrPhone(identifier: string) {
  try {
    const normalized = normalizeUserId(identifier);
    
    if (normalized.includes('@')) {
      // Email lookup (case-insensitive)
      const user = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalized,
            mode: 'insensitive',
          },
        },
      });
      return user;
    } else {
      // Phone number lookup (handle JSON field)
      const phoneClean = normalized.trim().replace('+', '');
      const users = await prisma.$queryRaw<Array<any>>`
        SELECT * FROM "user"
        WHERE phone_number->>'phone' LIKE ${`%${phoneClean}%`} 
           OR phone_number->>'phone' LIKE ${`%+${phoneClean}%`}
        LIMIT 1
      `;
      return users[0] || null;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error fetching user', {
      module: 'Auth',
      extraData: { error: errorMessage, identifier },
    });
    return null;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });
    return user;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error fetching user by ID', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return null;
  }
}

/**
 * Check user availability in database
 */
export async function checkUserAvailabilityInDb(identifier: string): Promise<boolean> {
  try {
    if (identifier.includes('@')) {
      const user = await prisma.user.findFirst({
        where: {
          email: {
            equals: identifier,
            mode: 'insensitive',
          },
        },
        select: { user_id: true },
      });
      return !!user;
    } else {
      const phoneClean = identifier.trim().replace('+', '');
      const users = await prisma.$queryRaw<Array<{ user_id: string }>>`
        SELECT user_id FROM "user" 
        WHERE phone_number->>'phone' LIKE ${`%${phoneClean}%`} 
           OR phone_number->>'phone' LIKE ${`%+${phoneClean}%`}
        LIMIT 1
      `;
      return users.length > 0;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error checking user availability', {
      module: 'Auth',
      extraData: { error: errorMessage, identifier },
    });
    return false;
  }
}

/**
 * Authenticate user by email/phone and password
 */
export async function authenticateUser(identifier: string, password: string) {
  try {
    const user = await getUserByEmailOrPhone(identifier);
    
    if (!user) {
      logger.warning(`User not found: ${identifier}`, {
        module: 'Auth',
        extraData: { identifier },
      });
      return null;
    }
    
    // Check if user is active and verified
    if (!user.is_active || !user.is_verified) {
      logger.warning(`User account not active or verified: ${identifier}`, {
        module: 'Auth',
        extraData: { identifier },
      });
      return null;
    }
    
    const hashedPassword = user.password;
    if (!hashedPassword) {
      logger.warning(`User has no password set: ${identifier}`, {
        module: 'Auth',
        extraData: { identifier },
      });
      return null;
    }
    
    if (!verifyPassword(password, hashedPassword)) {
      logger.warning(`Invalid password for user: ${identifier}`, {
        module: 'Auth',
        extraData: { identifier },
      });
      return null;
    }
    
    // Update last sign in
    await updateLastSignIn(user.user_id);
    
    return user;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Authentication error', {
      module: 'Auth',
      extraData: { error: errorMessage, identifier },
    });
    return null;
  }
}

/**
 * Update user's last sign in timestamp
 */
/**
 * Extract IP address from request
 */
export function extractIpAddress(req: any): string | null {
  if (!req || !req.headers) return null;
  
  const headers = req.headers;
  const forwardedFor = headers.get?.('x-forwarded-for') || headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = headers.get?.('x-real-ip') || headers['x-real-ip'];
  if (realIp) return realIp;
  
  return null;
}

/**
 * Extract user agent from request
 */
export function extractUserAgent(req: any): string | null {
  if (!req || !req.headers) return null;
  
  const headers = req.headers;
  return headers.get?.('user-agent') || headers['user-agent'] || null;
}

/**
 * Parse user agent to get device info
 */
function parseUserAgent(userAgent: string | null): { device: string; browser: string; os: string } {
  if (!userAgent) {
    return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  }
  
  const ua = userAgent.toLowerCase();
  
  // Detect device
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  }
  
  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera')) {
    browser = 'Opera';
  }
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac os') || ua.includes('macos')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }
  
  return { device, browser, os };
}

/**
 * Track login session and history
 */
export async function trackLoginSession(
  userId: string,
  sessionId: string,
  request: any = null
): Promise<void> {
  try {
    const ipAddress = extractIpAddress(request);
    const userAgent = extractUserAgent(request);
    const deviceInfo = parseUserAgent(userAgent);
    
    const now = new Date();
    
    // Get current user data
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        active_sessions: true,
        login_history: true,
        max_sessions: true,
      },
    });
    
    if (!user) return;
    
    const activeSessions = (user.active_sessions as any[]) || [];
    const loginHistory = (user.login_history as any[]) || [];
    const maxSessions = user.max_sessions || 5;
    
    // Create new session object
    const newSession = {
      session_id: sessionId,
      ip_address: ipAddress,
      user_agent: userAgent,
      device: `${deviceInfo.device} - ${deviceInfo.browser} on ${deviceInfo.os}`,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      created_at: now.toISOString(),
      last_activity: now.toISOString(),
    };
    
    // Remove old sessions if exceeding max_sessions
    let updatedSessions = [...activeSessions];
    
    // Remove existing session with same session_id if any
    updatedSessions = updatedSessions.filter((s: any) => s.session_id !== sessionId);
    
    // Add new session
    updatedSessions.push(newSession);
    
    // Keep only the most recent max_sessions
    updatedSessions = updatedSessions
      .sort((a: any, b: any) => 
        new Date(b.last_activity || b.created_at).getTime() - 
        new Date(a.last_activity || a.created_at).getTime()
      )
      .slice(0, maxSessions);
    
    // Add to login history (keep last 50)
    const newLoginEntry = {
      ...newSession,
      id: uuidv4(),
    };
    
    const updatedHistory = [newLoginEntry, ...loginHistory]
      .slice(0, 50)
      .sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    
    // Update user
    await prisma.user.update({
      where: { user_id: userId },
      data: {
        last_login: now,
        last_activity: now,
        active_sessions: updatedSessions,
        login_history: updatedHistory,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error tracking login session', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    // Don't fail authentication if this fails
  }
}

export async function updateLastSignIn(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { user_id: userId },
      data: { last_login: new Date() },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating last sign in', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    // Don't fail authentication if this fails
  }
}

/**
 * Update user verification status based on channel
 */
export async function updateUserVerificationStatus(
  userId: string,
  channel: string
): Promise<boolean> {
  try {
    const channelLower = (channel || '').toLowerCase();

    if (channelLower === 'email') {
      await prisma.user.update({
        where: { user_id: userId },
        data: {
          email_verified: true,
          is_verified: true,
          last_updated: new Date(),
        },
      });
      return true;
    } else if (channelLower === 'sms' || channelLower === 'whatsapp') {
      await prisma.user.update({
        where: { user_id: userId },
        data: {
          phone_verified: true,
          is_verified: true,
          last_updated: new Date(),
        },
      });
      return true;
    } else {
      logger.warning(`Invalid channel for verification update: ${channel}`, {
        module: 'Auth',
        extraData: { userId, channel },
      });
      return false;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating verification status', {
      module: 'Auth',
      extraData: { error: errorMessage, userId, channel },
    });
    return false;
  }
}

/**
 * Build user profile payload for tokens
 */
function buildUserProfilePayload(user: any) {
  return {
    user_id: String(user.user_id || user.uid),
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    user_name: user.user_name,
    phone_number: user.phone_number,
    country: user.country,
    dob: user.dob ? (user.dob instanceof Date ? user.dob.toISOString() : user.dob) : null,
    profile_picture_url: user.profile_picture_url,
    bio: user.bio,
    auth_type: user.auth_type,
    theme: user.theme,
    profile_accessibility: user.profile_accessibility,
    user_type: user.user_type,
    language: user.language,
    status: user.account_status || user.status || 'INACTIVE', // Map account_status to status for API compatibility
    timezone: user.timezone,
    invited_by_user_id: user.invited_by_user_id ? String(user.invited_by_user_id) : null,
    // Note: is_protected and is_trashed don't exist in Prisma schema
    // Use account_status and deleted_at instead
    is_protected: false, // Legacy field, always false
    is_trashed: !!user.deleted_at, // Use deleted_at to determine if trashed
    last_sign_in_at: user.last_sign_in_at
      ? user.last_sign_in_at instanceof Date
        ? user.last_sign_in_at.toISOString()
        : user.last_sign_in_at
      : null,
    email_verified_at: user.email_verified_at
      ? user.email_verified_at instanceof Date
        ? user.email_verified_at.toISOString()
        : user.email_verified_at
      : null,
    created_at: user.created_at
      ? user.created_at instanceof Date
        ? user.created_at.toISOString()
        : user.created_at
      : null,
    last_updated: user.last_updated
      ? user.last_updated instanceof Date
        ? user.last_updated.toISOString()
        : user.last_updated
      : null,
  };
}

/**
 * Build permissions payload for tokens
 */
function buildPermissionsPayload(user: any) {
  return {
    is_active: user.is_active !== undefined ? user.is_active : true,
    is_verified: user.is_verified !== undefined ? user.is_verified : true,
  };
}

/**
 * Generate short-lived access token (1 hour)
 */
function generateAccessToken(user: any, origin: string | null = null, sessionId: string | null = null): string {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + authConfig.accessTokenExpiryMinutes * 60;

    const payload: any = {
      sub: String(user.user_id || user.uid),
      username: user.user_name,
      email: user.email,
      exp,
      iat: now,
      jti: uuidv4(),
      type: 'access',
      aud: 'authenticated',
      is_active: user.is_active !== undefined ? user.is_active : true,
      is_verified: user.is_verified !== undefined ? user.is_verified : true,
    };

    if (origin) {
      payload.origin = origin;
    }
    if (sessionId) {
      payload.session_id = sessionId;
    }

    if (!SECRET_KEY) {
      throw new Error('JWT_SECRET_KEY environment variable is not set');
    }

    return jwt.sign(payload, SECRET_KEY, { algorithm: ALGORITHM });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating access token', {
      module: 'Auth',
      extraData: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Generate long-lived refresh token (30 days)
 */
function generateRefreshToken(user: any, origin: string | null = null, sessionId: string | null = null): string {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + authConfig.refreshTokenExpiryMinutes * 60;

    const payload: any = {
      sub: String(user.user_id || user.uid),
      exp,
      iat: now,
      jti: uuidv4(),
      type: 'refresh',
      aud: 'authenticated',
    };

    if (origin) {
      payload.origin = origin;
    }
    if (sessionId) {
      payload.session_id = sessionId;
    }

    if (!SECRET_KEY) {
      throw new Error('JWT_SECRET_KEY environment variable is not set');
    }

    return jwt.sign(payload, SECRET_KEY, { algorithm: ALGORITHM });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating refresh token', {
      module: 'Auth',
      extraData: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Generate medium-lived session token (7 days) with full user profile
 */
function generateSessionToken(user: any, origin: string | null = null, sessionId: string | null = null): string {
  try {
    const userProfile = buildUserProfilePayload(user);
    const permissions = buildPermissionsPayload(user);

    const now = Math.floor(Date.now() / 1000);
    const exp = now + authConfig.sessionTokenExpiryMinutes * 60;

    const payload: any = {
      sub: String(user.user_id || user.uid),
      username: user.user_name,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      exp,
      iat: now,
      jti: uuidv4(),
      type: 'session',
      user_profile: userProfile,
      permissions,
      aud: 'authenticated',
    };

    if (origin) {
      payload.origin = origin;
    }
    if (sessionId) {
      payload.session_id = sessionId;
    }

    if (!SECRET_KEY) {
      throw new Error('JWT_SECRET_KEY environment variable is not set');
    }

    return jwt.sign(payload, SECRET_KEY, { algorithm: ALGORITHM });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating session token', {
      module: 'Auth',
      extraData: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Generate all tokens (access, refresh, session) with session_id
 */
export function generateAllTokens(user: any, origin: string | null = null, request: any = null) {
  try {
    // Generate session_id once - this will be embedded in all tokens
    const sessionId = uuidv4();

    // Generate all tokens with the same session_id
    const accessToken = generateAccessToken(user, origin, sessionId);
    const refreshToken = generateRefreshToken(user, origin, sessionId);
    const sessionToken = generateSessionToken(user, origin, sessionId);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      session_token: sessionToken,
      session_id: sessionId,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating all tokens', {
      module: 'Auth',
      extraData: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Authenticate user and return all tokens with user data
 */
export async function authenticateUserWithData(
  identifier: string,
  password: string,
  origin: string | null = null,
  request: any = null
) {
  try {
    const user = await authenticateUser(identifier, password);
    if (!user) {
      return null;
    }

    const userId = String(user.user_id);

    // Clear user-level blacklist entries BEFORE generating tokens
    try {
      await clearUserBlacklist(userId);
      await clearUserRefreshTokenBlacklist(userId);
    } catch (clearError: unknown) {
      const errorMessage = clearError instanceof Error ? clearError.message : 'Unknown error';
      logger.warning(`Failed to clear user blacklist (non-blocking): ${errorMessage}`, {
        module: 'Auth',
        extraData: { userId },
      });
    }

    // Generate all tokens and create session
    const tokens = generateAllTokens(user, origin, request);

    // Return tokens and user data
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      session_token: tokens.session_token,
      session_id: tokens.session_id,
      user,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Authentication failed', {
      module: 'Auth',
      extraData: { error: errorMessage, identifier },
    });
    return null;
  }
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const hashedPassword = hashPassword(newPassword);
    await prisma.user.update({
      where: { user_id: userId },
      data: {
        password: hashedPassword,
        last_updated: new Date(),
      },
    });
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating password', {
      module: 'Auth',
      extraData: { error: errorMessage, userId },
    });
    return false;
  }
}

/**
 * Create user in database
 */
export async function createUserInDb(payload: any): Promise<string | null> {
  try {
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();
    const hashedPassword = hashPassword(payload.password || '');

    // Build user data object
    const userData: any = {
      user_id: userId,
      password: hashedPassword,
      is_active: true,
      is_verified: true,
      // Note: is_protected and is_trashed fields don't exist in Prisma schema
      // Use account_status and deleted_at instead if needed
    };

    // Add email or phone_number
    if (payload.email) {
      userData.email = payload.email;
    }

    if (payload.phone_number) {
      userData.phone_number = payload.phone_number;
    }

    // Add optional fields (all fields now exist in Prisma schema)
    const optionalFields = [
      'auth_type',
      'profile_accessibility',
      'theme',
      'language',
      'first_name',
      'last_name',
      'user_name',
      'user_type',
      'is_email_verified',
      'is_phone_verified',
    ];
    for (const field of optionalFields) {
      if (payload[field] !== undefined) {
        userData[field] = payload[field];
      }
    }

    // Map 'status' to 'account_status' (Prisma schema uses account_status)
    if (payload.status !== undefined) {
      userData.account_status = payload.status;
    }

    // Add timestamps if provided
    if (payload.email_verified_at) {
      userData.email_verified_at =
        payload.email_verified_at === 'NOW()'
          ? new Date()
          : new Date(payload.email_verified_at);
    }

    if (payload.phone_number_verified_at) {
      userData.phone_number_verified_at =
        payload.phone_number_verified_at === 'NOW()'
          ? new Date()
          : new Date(payload.phone_number_verified_at);
    }

    const user = await prisma.user.create({
      data: userData,
    });

    // Assign groups if specified in payload
    const masterOpt = payload.master_opt === true || payload.master_option === true;
    const groupsToAssign = payload.groups;
    
    if (masterOpt || groupsToAssign) {
      try {
        const { assignGroupsToUser } = await import('@lib/middleware/permissions');
        const assignerUserId = payload.assigned_by_user_id || null;
        
        if (masterOpt) {
          // Master option: assign all groups
          const allGroups = await prisma.group.findMany({
            where: { is_active: true },
            select: { codename: true },
          });
          const allGroupCodenames = allGroups
            .map(g => g.codename)
            .filter((codename): codename is string => codename !== null);
          
          if (allGroupCodenames.length > 0) {
            await assignGroupsToUser(user.user_id, allGroupCodenames, assignerUserId);
            logger.info(`Master option used - assigned all groups to user ${user.user_id}`, {
              module: 'Auth',
              label: 'CREATE_USER',
              extraData: { 
                userId: user.user_id,
                groups: allGroupCodenames,
                assignedBy: assignerUserId
              },
            });
          }
        } else if (groupsToAssign && Array.isArray(groupsToAssign) && groupsToAssign.length > 0) {
          // Specific groups provided
          await assignGroupsToUser(user.user_id, groupsToAssign, assignerUserId);
          logger.info(`Assigned specific groups to user ${user.user_id}`, {
            module: 'Auth',
            label: 'CREATE_USER',
            extraData: { 
              userId: user.user_id,
              groups: groupsToAssign,
              assignedBy: assignerUserId
            },
          });
        }
      } catch (groupError: unknown) {
        const errorMessage = groupError instanceof Error ? groupError.message : 'Unknown error';
        logger.error(`Failed to assign groups to user ${user.user_id}`, {
          module: 'Auth',
          label: 'CREATE_USER',
          extraData: { 
            error: errorMessage,
            userId: user.user_id
          },
        });
        // Don't fail user creation if group assignment fails
      }
    } else {
      // Default: assign "user" group if no groups specified
      try {
        const { assignGroupsToUser } = await import('@lib/middleware/permissions');
        await assignGroupsToUser(user.user_id, ['user'], null);
        logger.info(`Assigned default "user" group to user ${user.user_id}`, {
          module: 'Auth',
          label: 'CREATE_USER',
          extraData: { 
            userId: user.user_id,
            groups: ['user']
          },
        });
      } catch (groupError: unknown) {
        const errorMessage = groupError instanceof Error ? groupError.message : 'Unknown error';
        logger.warning(`Failed to assign default group to user ${user.user_id}`, {
          module: 'Auth',
          label: 'CREATE_USER',
          extraData: { 
            error: errorMessage,
            userId: user.user_id
          },
        });
        // Don't fail user creation if group assignment fails
      }
    }

    // Emit WebSocket event for real-time dashboard updates
    try {
      const { emitUserCreated } = await import('@lib/websocket/emitter');
      emitUserCreated(user);
    } catch (wsError) {
      // Don't fail user creation if WebSocket fails
      logger.warning('Failed to emit user created WebSocket event', {
        module: 'Auth',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' },
      });
    }

    return user.user_id;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating user', {
      module: 'Auth',
      extraData: { error: errorMessage },
    });
    return null;
  }
}

/**
 * Serialize user data (convert dates to ISO strings)
 */
export function serializeUserData(user: any): any {
  if (!user) {
    return {};
  }

  const userDict = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };

  // Remove password field - never send password to frontend
  if ('password' in userDict) {
    delete userDict.password;
  }

  // Convert datetime fields to ISO strings
  const datetimeFields = [
    'dob',
    'last_sign_in_at',
    'email_verified_at',
    'phone_number_verified_at',
    'created_at',
    'last_updated',
  ];
  for (const field of datetimeFields) {
    if (userDict[field] && userDict[field] instanceof Date) {
      userDict[field] = userDict[field].toISOString();
    }
  }

  // Recursively convert datetime objects
  function convertDatetime(obj: any): any {
    if (obj instanceof Date) {
      return obj.toISOString();
    } else if (Array.isArray(obj)) {
      return obj.map(convertDatetime);
    } else if (obj && typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip password field in nested objects too
        if (key === 'password') {
          continue;
        }
        converted[key] = convertDatetime(value);
      }
      return converted;
    }
    return obj;
  }

  return convertDatetime(userDict);
}

/**
 * Extract origin from request
 */
export function extractOrigin(req: any): string {
  const origin = req.headers?.origin;
  if (origin) {
    try {
      const url = new URL(origin);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      // Ignore
    }
  }

  const host = req.headers?.host;
  if (host) {
    const scheme = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return `${scheme}://${host}`;
  }

  const forwardedHost = req.headers?.['x-forwarded-host'];
  if (forwardedHost) {
    const scheme = req.headers['x-forwarded-proto'] || 'https';
    return `${scheme}://${forwardedHost}`;
  }

  return 'http://localhost:3000';
}

