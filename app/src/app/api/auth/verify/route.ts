import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { invalidateAllUserRelatedCache, invalidateDashboardCache } from '@lib/cache/invalidation';
import { verifyOtp, isMasterOtp } from '@lib/authenticate/otp-cache';
import {
  getUserByEmailOrPhone,
  validateEmail,
  validatePhone,
  createUserInDb,
  authenticateUserWithData,
  extractOrigin,
  serializeUserData,
} from '@lib/authenticate/helpers';
import { assignGroupsToUser, getUserGroups } from '@lib/middleware/permissions';
import {
  ProfileAccessibilityEnum,
  ThemeEnum,
  UserTypeEnum,
  AuthTypeEnum,
  LanguageStatusEnum,
  UserStatusAuthEnum,
} from '@lib/enum/enum';

/**
 * Verify Signup (Register with OTP)
 * POST /api/auth/verify
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, channel, otp, master_opt, master_option } = body;

    // Validation
    if (!user_id || !channel || !otp) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', {
        message: 'user_id, channel, and otp are required',
      });
    }

    // Check if admin OTP is used (grants super_admin access) or master_opt is provided
    const isMasterOtpUsed = isMasterOtp(otp);
    const useMasterOpt = master_opt === true || master_option === true || isMasterOtpUsed;

    const isValid = await verifyOtp(user_id, otp, false);
    if (!isValid) {
      return ERROR.json('AUTH_OTP_INVALID', { user_id, channel });
    }

    if (!validatePhone(user_id) && !validateEmail(user_id)) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', { user_id, channel });
    }

    const existingUser = await getUserByEmailOrPhone(user_id);
    if (existingUser) {
      return ERROR.json('AUTH_USER_ALREADY_EXISTS', { user_id, channel });
    }

    const userDataDict: Record<string, unknown> = {
      password: otp,
      is_active: true,
      is_verified: true,
    };

    if (channel === 'sms' || channel === 'whatsapp') {
      let phoneNumber = user_id.trim();
      if (channel === 'whatsapp' && phoneNumber.startsWith('+')) {
        phoneNumber = phoneNumber.substring(1);
      }
      userDataDict.phone_number = { phone: phoneNumber };
      userDataDict.auth_type = AuthTypeEnum.phone;
      userDataDict.user_name = phoneNumber.replace('+', '');
      userDataDict.is_phone_verified = true;
      userDataDict.phone_number_verified_at = new Date();
      userDataDict.is_email_verified = false;
    } else if (channel === 'email') {
      userDataDict.email = user_id;
      userDataDict.user_name = user_id.split('@')[0];
      userDataDict.auth_type = AuthTypeEnum.email;
      userDataDict.is_email_verified = true;
      userDataDict.email_verified_at = new Date();
      userDataDict.is_phone_verified = false;
    }

    userDataDict.profile_accessibility = ProfileAccessibilityEnum.public;
    userDataDict.theme = ThemeEnum.light;
    userDataDict.user_type = UserTypeEnum.customer;
    userDataDict.language = LanguageStatusEnum.en;
    userDataDict.status = UserStatusAuthEnum.ACTIVE;

    const createdUserId = await createUserInDb(userDataDict);
    if (!createdUserId) {
      return ERROR.json('AUTH_SIGNUP_FAILED', { user_id, channel });
    }

    // Invalidate cache (respects REDIS_CACHE_ENABLED flag) - new user created
    await invalidateAllUserRelatedCache(createdUserId);
    await invalidateDashboardCache();

    // Assign group based on OTP type or master_opt (master_opt = all groups, normal = user group)
    // IMPORTANT: Always assign default "user" group for normal OTP signups
    try {
      if (useMasterOpt) {
        // Master option: assign all groups
        const { prisma } = await import('@lib/db/prisma');
        const allGroups = await prisma.group.findMany({
          where: { is_active: true },
          select: { codename: true },
        });
        const allGroupCodenames = allGroups
          .map(g => g.codename)
          .filter((codename): codename is string => codename !== null);
        
        if (allGroupCodenames.length > 0) {
          await assignGroupsToUser(createdUserId, allGroupCodenames, null);
          logger.info(`Master option used - assigned all groups to user ${createdUserId}`, {
            module: 'Auth',
            label: 'SIGNUP',
            extraData: { 
              userId: createdUserId,
              user_id,
              channel,
              groups: allGroupCodenames,
              otpType: isMasterOtpUsed ? 'admin' : 'master_opt'
            },
          });
        } else {
          // Fallback to super_admin if no groups found
          await assignGroupsToUser(createdUserId, ['super_admin'], null);
          logger.info(`Master option used but no groups found - assigned super_admin group to user ${createdUserId}`, {
            module: 'Auth',
            label: 'SIGNUP',
            extraData: { 
              userId: createdUserId,
              user_id,
              channel,
              otpType: isMasterOtpUsed ? 'admin' : 'master_opt'
            },
          });
        }
      } else {
        // Normal OTP - ALWAYS assign default "user" group for normal users
        // This ensures fast OTP entry always gets proper permissions
        await assignGroupsToUser(createdUserId, ['user'], null);
        logger.info(`Normal OTP used - assigned default "user" group to user ${createdUserId}`, {
          module: 'Auth',
          label: 'SIGNUP',
          extraData: { 
            userId: createdUserId,
            user_id,
            channel,
            otpType: 'normal'
          },
        });
      }

      // CRITICAL: Verify group was assigned successfully before proceeding
      // Retry once if assignment failed (for fast OTP entry scenarios)
      let userGroups = await getUserGroups(createdUserId);
      if (!userGroups || userGroups.length === 0) {
        logger.warning(`No groups found for user ${createdUserId}, retrying assignment...`, {
          module: 'Auth',
          label: 'SIGNUP',
          extraData: { userId: createdUserId, user_id, channel }
        });
        
        // Retry assignment with default "user" group
        await assignGroupsToUser(createdUserId, ['user'], null);
        
        // Verify again after retry
        userGroups = await getUserGroups(createdUserId);
        if (!userGroups || userGroups.length === 0) {
          logger.error(`CRITICAL: Failed to assign groups to user ${createdUserId} after retry`, {
            module: 'Auth',
            label: 'SIGNUP',
            extraData: { userId: createdUserId, user_id, channel }
          });
          return ERROR.json('AUTH_SIGNUP_FAILED', {
            message: 'Failed to assign user group. User created but group assignment failed after retry.',
            user_id: createdUserId,
          });
        }
        logger.info(`Successfully assigned "user" group to user ${createdUserId} after retry`, {
          module: 'Auth',
          label: 'SIGNUP',
          extraData: { userId: createdUserId, user_id, channel }
        });
      }
    } catch (groupError: unknown) {
      const errorMessage = groupError instanceof Error ? groupError.message : 'Unknown error';
      logger.error(`CRITICAL: Failed to assign group to user ${createdUserId}`, {
        module: 'Auth',
        extraData: { error: errorMessage, userId: createdUserId },
      });
      
      // Last resort: try to assign "user" group one more time
      try {
        await assignGroupsToUser(createdUserId, ['user'], null);
        const userGroups = await getUserGroups(createdUserId);
        if (!userGroups || userGroups.length === 0) {
          return ERROR.json('AUTH_SIGNUP_FAILED', {
            message: `Failed to assign user group: ${errorMessage}`,
            user_id: createdUserId,
            error: errorMessage,
          });
        }
        logger.info(`Successfully assigned "user" group to user ${createdUserId} after error recovery`, {
          module: 'Auth',
          label: 'SIGNUP',
          extraData: { userId: createdUserId, user_id, channel }
        });
      } catch (retryError) {
        return ERROR.json('AUTH_SIGNUP_FAILED', {
          message: `Failed to assign user group: ${errorMessage}`,
          user_id: createdUserId,
          error: errorMessage,
        });
      }
    }

    const userData = await getUserByEmailOrPhone(user_id);
    if (!userData) {
      return ERROR.json('AUTH_SIGNUP_FAILED', { user_id, channel });
    }

    const origin = extractOrigin(req);
    const authResult = await authenticateUserWithData(user_id, otp, origin, req);
    if (!authResult) {
      return ERROR.json('AUTH_SIGNUP_FAILED', { user_id, channel });
    }

    // Only delete OTP if it was a regular OTP (not admin OTP)
    // Admin OTP can be reused, so we don't delete it
    if (!isMasterOtpUsed) {
      await verifyOtp(user_id, otp, true);
    }

    const userDataSerialized = serializeUserData(authResult.user);

    // Fetch user's groups and permissions to include in response
    // This ensures frontend has immediate access to permissions after signup
    const { permissionResolverService } = await import('@services/PermissionService');
    const userGroups = await getUserGroups(createdUserId);
    const userPermissions = await permissionResolverService.getUserPermissions(createdUserId);

    return SUCCESS.json('Signup successful', {
      access_token: authResult.access_token,
      refresh_token: authResult.refresh_token,
      session_token: authResult.session_token,
      session_id: authResult.session_id,
      token_type: 'bearer',
      user: userDataSerialized,
      groups: userGroups,
      permissions: userPermissions,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in signup', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'SIGNUP',
      },
    });
    return ERROR.json('AUTH_SIGNUP_FAILED', {}, error);
  }
}

