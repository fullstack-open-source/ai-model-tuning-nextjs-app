import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';
import { randomBytes } from 'crypto';
import { emitNotificationToUser } from '@lib/websocket/emitter';
import { Prisma } from '@prisma/client';

/**
 * Get invitations (sent or received)
 * GET /api/account-shares/invitations
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'view_account_sharing');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'all'; // sent, received, all
    const direction = url.searchParams.get('direction'); // for access requests
    const invitationType = url.searchParams.get('invitation_type'); // share, request
    const status = url.searchParams.get('status') || 'pending';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by direction
    if (type === 'sent' || direction === 'sent') {
      where.sender_id = userId;
    } else if (type === 'received' || direction === 'received') {
      where.OR = [
        { recipient_id: userId },
        { target_owner_id: userId }
      ];
    } else {
      where.OR = [
        { sender_id: userId },
        { recipient_id: userId },
        { target_owner_id: userId }
      ];
    }

    // Filter by invitation type (share vs request)
    if (invitationType) {
      where.invitation_type = invitationType;
    }

    // Filter by status
    if (status !== 'all') {
      where.status = status;
    }

    // Get invitations with related user data
    const [invitations, total] = await Promise.all([
      prisma.accountShareInvitation.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { created_at: 'desc' },
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
          recipient: {
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
      }),
      prisma.accountShareInvitation.count({ where })
    ]);

    return SUCCESS.json('Invitations retrieved successfully', {
      invitations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting invitations', {
      module: 'AccountShares',
      label: 'GET_INVITATIONS',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Send a share invitation
 * POST /api/account-shares/invitations
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const permissionError = await checkPermissionOrReturnError(user, 'share_account');
    if (permissionError) return permissionError;

    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const body = await req.json();
    const {
      recipient_email,
      recipient_id,
      access_level = 'view_only',
      custom_permissions,
      message,
      expires_in_days = 7
    } = body;

    // Validate input
    if (!recipient_email && !recipient_id) {
      return ERROR.json('INVALID_REQUEST', {
        message: 'Either recipient_email or recipient_id is required'
      });
    }

    // Check if trying to share with self
    if (recipient_id === userId) {
      return ERROR.json('INVALID_REQUEST', {
        message: 'You cannot share your account with yourself'
      });
    }

    // Find recipient if email provided
    let recipientUserId = recipient_id;
    let recipientEmail = recipient_email;

    if (recipient_email && !recipient_id) {
      const existingUser = await prisma.user.findUnique({
        where: { email: recipient_email },
        select: { user_id: true, email: true }
      });
      if (existingUser) {
        recipientUserId = existingUser.user_id;
        if (existingUser.user_id === userId) {
          return ERROR.json('INVALID_REQUEST', {
            message: 'You cannot share your account with yourself'
          });
        }
      }
    }

    // Check if already shared
    if (recipientUserId) {
      const existingShare = await prisma.accountShare.findUnique({
        where: {
          owner_id_recipient_id: {
            owner_id: userId,
            recipient_id: recipientUserId
          }
        }
      });
      if (existingShare && existingShare.status === 'active') {
        return ERROR.json('INVALID_REQUEST', {
          message: 'You have already shared your account with this user'
        });
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.accountShareInvitation.findFirst({
      where: {
        sender_id: userId,
        OR: [
          { recipient_id: recipientUserId },
          { recipient_email: recipientEmail }
        ],
        status: 'pending',
        invitation_type: 'share'
      }
    });

    if (existingInvitation) {
      return ERROR.json('INVALID_REQUEST', {
        message: 'You already have a pending invitation for this user'
      });
    }

    // Generate invitation token
    const invitationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Create invitation
    const invitation = await prisma.accountShareInvitation.create({
      data: {
        sender_id: userId,
        invitation_type: 'share',
        recipient_email: recipientEmail,
        recipient_id: recipientUserId,
        access_level,
        custom_permissions: custom_permissions ? custom_permissions as Prisma.InputJsonValue : Prisma.JsonNull,
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
        recipient: {
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
        action: 'share_invited',
        action_detail: `Sent account share invitation to ${recipientEmail || 'user'}`,
        metadata: {
          invitation_id: invitation.invitation_id,
          recipient_email: recipientEmail,
          access_level
        }
      }
    });

    // Create notification for recipient if they have an account
    if (recipientUserId) {
      try {
        const senderName = user?.first_name 
          ? `${user.first_name} ${user.last_name || ''}`.trim()
          : user?.email || 'A user';

        const notification = await prisma.notification.create({
          data: {
            title: 'Account Share Invitation',
            message: `${senderName} wants to share their account access with you`,
            notification_type: 'account_share',
            is_read: false,
            priority: 'high',
            action_url: `/account-sharing/accept?token=${invitationToken}`,
            action_label: 'View Invitation',
            icon: 'UserPlus',
            user_id: recipientUserId,
            metadata: {
              invitation_id: invitation.invitation_id,
              invitation_type: 'share'
            }
          }
        });

        // Emit WebSocket notification
        emitNotificationToUser(recipientUserId, notification);
      } catch (notifError) {
        logger.warning('Failed to create invitation notification', {
          module: 'AccountShares',
          label: 'INVITATION_NOTIFICATION',
          extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' }
        });
      }
    }

    // TODO: Send email notification to recipient_email

    logger.info('Share invitation sent', {
      module: 'AccountShares',
      label: 'SEND_INVITATION',
      extraData: {
        senderId: userId,
        recipientId: recipientUserId,
        recipientEmail,
        invitationId: invitation.invitation_id
      }
    });

    return SUCCESS.json('Invitation sent successfully', { invitation }, {}, 201);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error sending invitation', {
      module: 'AccountShares',
      label: 'SEND_INVITATION',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

