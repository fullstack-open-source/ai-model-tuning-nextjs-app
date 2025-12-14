import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { prisma } from '@lib/db/prisma';
import { emitNotificationToUser } from '@lib/websocket/emitter';
import { Prisma } from '@prisma/client';

/**
 * Respond to an invitation (accept or decline)
 * POST /api/account-shares/invitations/respond
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'You must be logged in to respond to invitations' });
    }

    const body = await req.json();
    const { invitation_token, accept, response_note, access_level } = body;

    if (!invitation_token) {
      return ERROR.json('INVALID_REQUEST', { message: 'Invitation token is required' });
    }

    if (typeof accept !== 'boolean') {
      return ERROR.json('INVALID_REQUEST', { message: 'Accept must be a boolean' });
    }

    // Find invitation
    const invitation = await prisma.accountShareInvitation.findUnique({
      where: { invitation_token },
      include: {
        sender: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    if (!invitation) {
      return ERROR.json('NOT_FOUND', { message: 'Invitation not found' });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return ERROR.json('INVALID_REQUEST', {
        message: `This invitation has already been ${invitation.status}`
      });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      await prisma.accountShareInvitation.update({
        where: { invitation_id: invitation.invitation_id },
        data: { status: 'expired' }
      });
      return ERROR.json('INVALID_REQUEST', { message: 'This invitation has expired' });
    }

    // Determine if this is a share invitation or access request
    const isAccessRequest = invitation.invitation_type === 'request';

    // Verify the user is authorized to respond
    if (isAccessRequest) {
      // For access requests, only the target owner can respond
      if (invitation.target_owner_id !== userId) {
        return ERROR.json('FORBIDDEN', {
          message: 'You are not authorized to respond to this access request'
        });
      }
    } else {
      // For share invitations, only the recipient can respond
      // Check if user matches recipient_id or recipient_email
      const userEmail = user?.email;
      const isRecipient = invitation.recipient_id === userId ||
        (invitation.recipient_email && userEmail && invitation.recipient_email.toLowerCase() === userEmail.toLowerCase());

      if (!isRecipient) {
        return ERROR.json('FORBIDDEN', {
          message: 'You are not authorized to respond to this invitation'
        });
      }
    }

    const now = new Date();
    let share = null;

    if (accept) {
      // Determine owner and shared user based on invitation type
      let ownerId: string;
      let recipientId: string;
      let shareAccessLevel: string;

      if (isAccessRequest) {
        // Access request: sender wants access to target_owner's account
        ownerId = invitation.target_owner_id!;
        recipientId = invitation.sender_id;
        shareAccessLevel = access_level || invitation.access_level;
      } else {
        // Share invitation: sender is sharing their account with recipient
        ownerId = invitation.sender_id;
        recipientId = userId;
        shareAccessLevel = invitation.access_level;
      }

      // Check if share already exists
      const existingShare = await prisma.accountShare.findUnique({
        where: {
          owner_id_recipient_id: {
            owner_id: ownerId,
            recipient_id: recipientId
          }
        }
      });

      if (existingShare) {
        // Reactivate if it was revoked
        share = await prisma.accountShare.update({
          where: { share_id: existingShare.share_id },
          data: {
            status: 'active',
            access_level: shareAccessLevel,
            custom_permissions: invitation.custom_permissions ? invitation.custom_permissions as Prisma.InputJsonValue : Prisma.JsonNull
          },
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
            }
          }
        });
      } else {
        // Create new share
        share = await prisma.accountShare.create({
          data: {
            owner_id: ownerId,
            recipient_id: recipientId,
            access_level: shareAccessLevel,
            custom_permissions: invitation.custom_permissions ? invitation.custom_permissions as Prisma.InputJsonValue : Prisma.JsonNull,
            status: 'active'
          },
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
            }
          }
        });
      }

      // Update invitation recipient_id if it was an email-only invitation
      if (!isAccessRequest && !invitation.recipient_id) {
        await prisma.accountShareInvitation.update({
          where: { invitation_id: invitation.invitation_id },
          data: { recipient_id: userId }
        });
      }
    }

    // Update invitation status
    await prisma.accountShareInvitation.update({
      where: { invitation_id: invitation.invitation_id },
      data: {
        status: accept ? 'accepted' : 'declined',
        responded_at: now,
        response_note: response_note || null
      }
    });

    // Log activity
    const actionVerb = accept ? 'accepted' : 'declined';
    const actorId = userId;
    const ownerId = isAccessRequest ? invitation.target_owner_id! : invitation.sender_id;

    await prisma.accountShareActivity.create({
      data: {
        share_id: share?.share_id || null,
        user_id: actorId,
        action: isAccessRequest
          ? (accept ? 'access_request_accepted' : 'access_request_declined')
          : (accept ? 'share_accepted' : 'share_declined'),
        action_detail: `${isAccessRequest ? 'Access request' : 'Share invitation'} ${actionVerb}`,
        metadata: {
          invitation_id: invitation.invitation_id,
          response_note,
          owner_id: ownerId
        }
      }
    });

    // Notify the sender about the response
    try {
      const responderName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.email || 'A user';

      const notificationRecipientId = isAccessRequest ? invitation.sender_id : invitation.sender_id;

      const notification = await prisma.notification.create({
        data: {
          title: accept ? 'Invitation Accepted' : 'Invitation Declined',
          message: accept
            ? `${responderName} has accepted your ${isAccessRequest ? 'access request' : 'account share invitation'}`
            : `${responderName} has declined your ${isAccessRequest ? 'access request' : 'account share invitation'}`,
          notification_type: 'account_share',
          is_read: false,
          priority: accept ? 'normal' : 'low',
          action_url: '/account-sharing',
          action_label: 'View Account Sharing',
          icon: accept ? 'UserCheck' : 'UserX',
          user_id: notificationRecipientId,
          metadata: {
            invitation_id: invitation.invitation_id,
            accepted: accept
          }
        }
      });

      emitNotificationToUser(notificationRecipientId, notification);
    } catch (notifError) {
      logger.warning('Failed to create response notification', {
        module: 'AccountShares',
        label: 'RESPONSE_NOTIFICATION',
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' }
      });
    }

    logger.info(`Invitation ${actionVerb}`, {
      module: 'AccountShares',
      label: 'RESPOND_INVITATION',
      extraData: {
        invitationId: invitation.invitation_id,
        userId,
        accept,
        shareId: share?.share_id
      }
    });

    const message = accept
      ? `Invitation accepted successfully${share ? '. You now have access to the shared account.' : ''}`
      : 'Invitation declined';

    return SUCCESS.json(message, { share, accepted: accept });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error responding to invitation', {
      module: 'AccountShares',
      label: 'RESPOND_INVITATION',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

