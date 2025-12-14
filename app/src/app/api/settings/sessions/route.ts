import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { getUserByUserId, serializeData } from '@lib/authenticate/profile-helpers';
import { prisma } from '@lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get Sessions, Trusted Devices, and Login History
 * GET /api/settings/sessions
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_profile');
    if (permissionError) return permissionError;

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('PROFILE_NOT_FOUND', { message: 'User ID not found' });
    }

    const userData = await getUserByUserId(userId);
    if (!userData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }

    const serializedData = serializeData(userData);

    return SUCCESS.json('Sessions data fetched successfully', {
      active_sessions: serializedData.active_sessions || [],
      trusted_devices: serializedData.trusted_devices || [],
      login_history: serializedData.login_history || [],
      max_sessions: serializedData.max_sessions || 5,
      session_timeout: serializedData.session_timeout || 3600,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error fetching sessions', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'GET_SESSIONS',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}

/**
 * Revoke Session or Remove Trusted Device
 * POST /api/settings/sessions
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
    const { action, session_id, device_id, mark_as_trusted } = body;

    if (!action || !['revoke_session', 'remove_device', 'revoke_all_sessions', 'add_trusted_device'].includes(action)) {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'Invalid action. Must be: revoke_session, remove_device, revoke_all_sessions, or add_trusted_device',
      });
    }

    const userData = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        active_sessions: true,
        trusted_devices: true,
      },
    });

    if (!userData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }

    const activeSessions = (userData.active_sessions as any[]) || [];
    const trustedDevices = (userData.trusted_devices as any[]) || [];

    let updateData: any = {};

    if (action === 'revoke_all_sessions') {
      updateData.active_sessions = [];
    } else if (action === 'revoke_session' && session_id) {
      updateData.active_sessions = activeSessions.filter(
        (session: any) => session.session_id !== session_id && session.id !== session_id
      );
    } else if (action === 'remove_device' && device_id) {
      updateData.trusted_devices = trustedDevices.filter(
        (device: any) => device.device_id !== device_id && device.id !== device_id
      );
    } else if (action === 'add_trusted_device' && mark_as_trusted) {
      // Check if device already exists in trusted devices
      const deviceExists = trustedDevices.some(
        (device: any) => 
          (device.device_id === mark_as_trusted.device_id || device.id === mark_as_trusted.device_id) ||
          (device.ip_address === mark_as_trusted.ip_address && device.user_agent === mark_as_trusted.user_agent)
      );
      
      if (!deviceExists) {
        const newTrustedDevice = {
          device_id: mark_as_trusted.device_id || uuidv4(),
          ip_address: mark_as_trusted.ip_address,
          user_agent: mark_as_trusted.user_agent,
          device: mark_as_trusted.device,
          browser: mark_as_trusted.browser,
          os: mark_as_trusted.os,
          created_at: new Date().toISOString(),
        };
        updateData.trusted_devices = [...trustedDevices, newTrustedDevice];
      }
    } else {
      return ERROR.json('PROFILE_INVALID_PAYLOAD', {
        message: 'Missing required parameter: session_id, device_id, or mark_as_trusted',
      });
    }

    await prisma.user.update({
      where: { user_id: userId },
      data: updateData,
    });

    // Invalidate cache
    await invalidateAllUserRelatedCache(userId);

    // Fetch updated user data
    const updatedUserData = await getUserByUserId(userId);
    if (!updatedUserData) {
      return ERROR.json('PROFILE_NOT_FOUND', { user_id: userId });
    }
    const serializedData = serializeData(updatedUserData);

    return SUCCESS.json(
      action === 'revoke_all_sessions' 
        ? 'All sessions revoked successfully'
        : action === 'revoke_session'
        ? 'Session revoked successfully'
        : 'Device removed successfully',
      {
        active_sessions: serializedData.active_sessions || [],
        trusted_devices: serializedData.trusted_devices || [],
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error managing sessions', {
      module: 'Profile',
      extraData: {
        error: errorMessage,
        label: 'MANAGE_SESSIONS',
      },
    });
    return ERROR.json('PROFILE_PROCESSING_ERROR', {}, error);
  }
}

