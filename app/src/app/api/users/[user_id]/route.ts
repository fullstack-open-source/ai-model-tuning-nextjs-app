import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { invalidateAllUserRelatedCache } from '@lib/cache/invalidation';
import { emitUserUpdated, emitUserDeleted } from '@lib/websocket/emitter';
import { activityLogService } from '@services/ActivityLogService';
import { prisma } from '@lib/db/prisma';

/**
 * Update User
 * PATCH /api/users/[user_id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'edit_user');
    if (permissionError) return permissionError;

    const { user_id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.first_name !== undefined) updateData.first_name = body.first_name;
    if (body.last_name !== undefined) updateData.last_name = body.last_name;
    if (body.user_name !== undefined) updateData.user_name = body.user_name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone_number !== undefined) updateData.phone_number = typeof body.phone_number === 'string' ? { phone: body.phone_number } : body.phone_number;
    if (body.status !== undefined) {
      updateData.status = body.status;
      // If status is being set to SUSPENDED, set suspension fields
      if (body.status === 'SUSPENDED') {
        if (body.suspension_reason !== undefined) updateData.suspension_reason = body.suspension_reason;
        if (body.suspended_at === undefined) updateData.suspended_at = new Date();
        if (body.suspended_by_id !== undefined) updateData.suspended_by_id = body.suspended_by_id;
        else updateData.suspended_by_id = user.uid || user.user_id; // Default to current admin
      }
      // If status is being changed from SUSPENDED, clear suspension fields
      else if (body.status !== 'SUSPENDED') {
        updateData.suspension_reason = null;
        updateData.suspended_at = null;
        updateData.suspended_by_id = null;
      }
    }
    if (body.suspension_reason !== undefined) updateData.suspension_reason = body.suspension_reason;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.user_type !== undefined) updateData.user_type = body.user_type;
    if (body.auth_type !== undefined) updateData.auth_type = body.auth_type;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_verified !== undefined) updateData.is_verified = body.is_verified;
    if (body.is_email_verified !== undefined) updateData.is_email_verified = body.is_email_verified;
    if (body.is_phone_verified !== undefined) updateData.is_phone_verified = body.is_phone_verified;

    updateData.last_updated = new Date();

    const updatedUser = await prisma.user.update({
      where: { user_id },
      data: updateData,
    });

    // Invalidate cache: Delete related cache keys so data updates in real time
    await invalidateAllUserRelatedCache(user_id);

    // Create activity log
    const userId = user?.uid || user?.user_id;
    await activityLogService.logUpdate(
      userId,
      'users',
      'user',
      user_id,
      {
        changes: updateData,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
      },
      { headers: req.headers, url: req.url, method: 'PATCH' }
    );

    // Emit WebSocket event for real-time updates
    try {
      emitUserUpdated(updatedUser);
    } catch (wsError) {
      logger.warning('Failed to emit user updated WebSocket event', {
        module: 'Users',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;
    return SUCCESS.json('User updated successfully', userWithoutPassword);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating user', {
      module: 'Users',
      extraData: {
        error: errorMessage,
        label: 'UPDATE_USER',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Delete User
 * DELETE /api/users/[user_id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'delete_user');
    if (permissionError) return permissionError;

    const { user_id } = await params;

    await prisma.user.delete({
      where: { user_id },
    });

    // Invalidate cache: Delete related cache keys so data updates in real time
    await invalidateAllUserRelatedCache(user_id);

    // Create activity log
    const userId = user?.uid || user?.user_id;
    await activityLogService.logDelete(
      userId,
      'users',
      'user',
      user_id,
      {},
      { headers: req.headers, url: req.url, method: 'DELETE' }
    );

    // Emit WebSocket event for real-time updates
    try {
      emitUserDeleted(user_id);
    } catch (wsError) {
      logger.warning('Failed to emit user deleted WebSocket event', {
        module: 'Users',
        extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
      });
    }

    return SUCCESS.json('User deleted successfully', null);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting user', {
      module: 'Users',
      extraData: {
        error: errorMessage,
        label: 'DELETE_USER',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

