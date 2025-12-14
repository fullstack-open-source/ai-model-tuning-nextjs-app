import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';
import { emitNotificationToUser } from '@lib/websocket/emitter';
import { Prisma } from '@prisma/client';

interface Params {
  params: Promise<{ share_id: string }>;
}

/**
 * Get a specific share
 * GET /api/account-shares/[share_id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_account_sharing');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const { share_id } = await params;

    const share = await prisma.accountShare.findUnique({
      where: { share_id },
      include: {
        owner: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true
          }
        },
        recipient: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true
          }
        } as any
      } as any
    });

    if (!share) {
      return ERROR.json('NOT_FOUND', { message: 'Share not found' });
    }

    // Check if user is authorized to view this share
    const shareWithRecipient = share as typeof share & { recipient_id: string };
    if (shareWithRecipient.owner_id !== userId && shareWithRecipient.recipient_id !== userId) {
      return ERROR.json('FORBIDDEN', { message: 'You are not authorized to view this share' });
    }

    return SUCCESS.json('Share retrieved successfully', { share });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting share', {
      module: 'AccountShares',
      label: 'GET_SHARE',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Update share settings (as owner)
 * PUT /api/account-shares/[share_id]
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'share_account');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const { share_id } = await params;
    const body = await req.json();
    const { access_level, custom_permissions, notes, expires_at } = body;

    // Get existing share
    const existingShare = await prisma.accountShare.findUnique({
      where: { share_id }
    }) as { share_id: string; owner_id: string; recipient_id: string; status: string } | null;

    if (!existingShare) {
      return ERROR.json('NOT_FOUND', { message: 'Share not found' });
    }

    // Only owner can update share settings
    if (existingShare.owner_id !== userId) {
      return ERROR.json('FORBIDDEN', { message: 'Only the account owner can update share settings' });
    }

    // Build update data
    const updateData: Prisma.AccountShareUpdateInput = {};
    if (access_level) updateData.access_level = access_level;
    if (custom_permissions !== undefined) updateData.custom_permissions = custom_permissions ? custom_permissions as Prisma.InputJsonValue : Prisma.JsonNull;
    if (notes !== undefined) updateData.notes = notes;
    if (expires_at !== undefined) updateData.expires_at = expires_at ? new Date(expires_at) : null;

    // Update share
    const share = await prisma.accountShare.update({
      where: { share_id },
      data: updateData,
      include: {
        owner: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true
          }
        },
        recipient: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true
          }
        } as any
      } as any
    });

    // Log activity
    await prisma.accountShareActivity.create({
      data: {
        share_id: share_id,
        user_id: userId,
        action: 'permissions_updated',
        action_detail: 'Share settings updated',
        metadata: { updated_fields: Object.keys(updateData) } as Prisma.InputJsonValue
      } as any
    });

    // Notify shared user about the update
    try {
      const ownerName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.email || 'Account owner';

      const notification = await prisma.notification.create({
        data: {
          title: 'Account Share Updated',
          message: `${ownerName} has updated your access settings`,
          notification_type: 'account_share',
          is_read: false,
          priority: 'normal',
          action_url: '/account-sharing',
          action_label: 'View Details',
          icon: 'Settings',
          user_id: (existingShare as any).recipient_id,
          metadata: { share_id } as Prisma.InputJsonValue
        } as any
      });

      emitNotificationToUser((existingShare as any).recipient_id, notification);
    } catch (notifError) {
      logger.warning('Failed to create share update notification', {
        module: 'AccountShares',
        label: 'SHARE_UPDATE_NOTIFICATION',
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' }
      });
    }

    logger.info('Share updated', {
      module: 'AccountShares',
      label: 'UPDATE_SHARE',
      extraData: { shareId: share_id, userId, updatedFields: Object.keys(updateData) }
    });

    return SUCCESS.json('Share updated successfully', { share });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating share', {
      module: 'AccountShares',
      label: 'UPDATE_SHARE',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Revoke share (as owner)
 * DELETE /api/account-shares/[share_id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'revoke_account_share');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const { share_id } = await params;

    // Get existing share
    const existingShare = await prisma.accountShare.findUnique({
      where: { share_id }
    }) as { share_id: string; owner_id: string; recipient_id: string; status: string } | null;

    if (!existingShare) {
      return ERROR.json('NOT_FOUND', { message: 'Share not found' });
    }

    // Only owner can revoke share
    if (existingShare.owner_id !== userId) {
      return ERROR.json('FORBIDDEN', { message: 'Only the account owner can revoke this share' });
    }

    // Update share status to revoked
    await prisma.accountShare.update({
      where: { share_id },
      data: {
        status: 'revoked'
      }
    });

    // Log activity
    await prisma.accountShareActivity.create({
      data: {
        share_id: share_id,
        user_id: userId,
        action: 'share_revoked',
        action_detail: 'Account share access revoked'
      } as any
    });

    // Notify shared user about revocation
    try {
      const ownerName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.email || 'Account owner';

      const notification = await prisma.notification.create({
        data: {
          title: 'Account Access Revoked',
          message: `${ownerName} has revoked your access to their account`,
          notification_type: 'account_share',
          is_read: false,
          priority: 'high',
          action_url: '/account-sharing',
          action_label: 'View Details',
          icon: 'UserX',
          user_id: (existingShare as any).recipient_id,
          metadata: { share_id } as Prisma.InputJsonValue
        } as any
      });

      emitNotificationToUser((existingShare as any).recipient_id, notification);
    } catch (notifError) {
      logger.warning('Failed to create share revocation notification', {
        module: 'AccountShares',
        label: 'SHARE_REVOKE_NOTIFICATION',
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' }
      });
    }

    logger.info('Share revoked', {
      module: 'AccountShares',
      label: 'REVOKE_SHARE',
      extraData: { shareId: share_id, userId }
    });

    return SUCCESS.json('Share revoked successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error revoking share', {
      module: 'AccountShares',
      label: 'REVOKE_SHARE',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

