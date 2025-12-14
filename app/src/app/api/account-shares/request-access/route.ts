import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';
import { randomBytes } from 'crypto';
import { emitNotificationToUser } from '@lib/websocket/emitter';

/**
 * Request access to another user's account
 * POST /api/account-shares/request-access
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'request_account_access');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const body = await req.json();
    const {
      target_owner_email,
      target_owner_id,
      message,
      requested_access_level = 'view_only'
    } = body;

    // Validate input
    if (!target_owner_email && !target_owner_id) {
      return ERROR.json('INVALID_REQUEST', {
        message: 'Either target_owner_email or target_owner_id is required'
      });
    }

    // Find target owner
    let targetOwnerId = target_owner_id;
    let targetOwnerEmail = target_owner_email;

    if (target_owner_email && !target_owner_id) {
      const targetUser = await prisma.user.findUnique({
        where: { email: target_owner_email },
        select: { user_id: true, email: true, first_name: true, last_name: true }
      });
      if (!targetUser) {
        return ERROR.json('NOT_FOUND', {
          message: 'User with this email not found'
        });
      }
      targetOwnerId = targetUser.user_id;
      targetOwnerEmail = targetUser.email;
    }

    // Check if trying to request access to own account
    if (targetOwnerId === userId) {
      return ERROR.json('INVALID_REQUEST', {
        message: 'You cannot request access to your own account'
      });
    }

    // Check if already has access
    const existingShare = await prisma.accountShare.findUnique({
      where: {
        owner_id_recipient_id: {
          owner_id: targetOwnerId,
          recipient_id: userId
        }
      }
    });

    if (existingShare && existingShare.status === 'active') {
      return ERROR.json('INVALID_REQUEST', {
        message: 'You already have access to this account'
      });
    }

    // Check for existing pending request
    const existingRequest = await prisma.accountShareInvitation.findFirst({
      where: {
        sender_id: userId,
        target_owner_id: targetOwnerId,
        status: 'pending',
        invitation_type: 'request'
      }
    });

    if (existingRequest) {
      return ERROR.json('INVALID_REQUEST', {
        message: 'You already have a pending access request for this account'
      });
    }

    // Generate invitation token
    const invitationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create access request invitation
    const invitation = await prisma.accountShareInvitation.create({
      data: {
        sender_id: userId,
        invitation_type: 'request',
        target_owner_id: targetOwnerId,
        access_level: requested_access_level,
        invitation_token: invitationToken,
        message: message || null,
        status: 'pending',
        expires_at: expiresAt
      },
      include: {
        sender: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true
          }
        },
        targetOwner: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_picture_url: true
          }
        }
      }
    });

    // Log activity
    await prisma.accountShareActivity.create({
      data: {
        user_id: userId,
        action: 'access_request_sent',
        action_detail: `Access request sent to account owner`,
        metadata: {
          invitation_id: invitation.invitation_id,
          requested_access_level,
          target_owner_id: targetOwnerId
        }
      }
    });

    // Create notification for target owner
    try {
      const requesterName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.email || 'A user';

      const notification = await prisma.notification.create({
        data: {
          title: 'Account Access Request',
          message: `${requesterName} is requesting access to your account`,
          notification_type: 'account_share',
          is_read: false,
          priority: 'high',
          action_url: `/account-sharing?tab=requests`,
          action_label: 'Review Request',
          icon: 'UserPlus',
          user_id: targetOwnerId,
          metadata: {
            invitation_id: invitation.invitation_id,
            invitation_type: 'request'
          }
        }
      });

      emitNotificationToUser(targetOwnerId, notification);
    } catch (notifError) {
      logger.warning('Failed to create access request notification', {
        module: 'AccountShares',
        label: 'ACCESS_REQUEST_NOTIFICATION',
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' }
      });
    }

    logger.info('Access request sent', {
      module: 'AccountShares',
      label: 'REQUEST_ACCESS',
      extraData: {
        senderId: userId,
        targetOwnerId,
        invitationId: invitation.invitation_id
      }
    });

    return SUCCESS.json('Access request sent successfully', { invitation }, {}, 201);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error sending access request', {
      module: 'AccountShares',
      label: 'REQUEST_ACCESS',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

