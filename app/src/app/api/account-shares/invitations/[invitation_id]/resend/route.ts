import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { prisma } from '@lib/db/prisma';
import { emitNotificationToUser } from '@lib/websocket/emitter';

interface Params {
  params: Promise<{ invitation_id: string }>;
}

/**
 * Resend an invitation
 * POST /api/account-shares/invitations/[invitation_id]/resend
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { user } = await validateRequest(req);
    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const { invitation_id } = await params;

    const invitation = await prisma.accountShareInvitation.findUnique({
      where: { invitation_id }
    });

    if (!invitation) {
      return ERROR.json('NOT_FOUND', { message: 'Invitation not found' });
    }

    // Only sender can resend
    if (invitation.sender_id !== userId) {
      return ERROR.json('FORBIDDEN', { message: 'Only the sender can resend this invitation' });
    }

    // Can only resend pending invitations
    if (invitation.status !== 'pending') {
      return ERROR.json('INVALID_REQUEST', {
        message: `Cannot resend an invitation that has been ${invitation.status}`
      });
    }

    // Extend expiration by 7 days from now
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await prisma.accountShareInvitation.update({
      where: { invitation_id },
      data: { expires_at: newExpiresAt }
    });

    // Resend notification if recipient has an account
    if (invitation.recipient_id) {
      try {
        const senderName = user?.first_name
          ? `${user.first_name} ${user.last_name || ''}`.trim()
          : user?.email || 'A user';

        const notification = await prisma.notification.create({
          data: {
            title: 'Account Share Reminder',
            message: `${senderName} has reminded you about their account share invitation`,
            notification_type: 'account_share',
            is_read: false,
            priority: 'normal',
            action_url: `/account-sharing/accept?token=${invitation.invitation_token}`,
            action_label: 'View Invitation',
            icon: 'Bell',
            user_id: invitation.recipient_id,
            metadata: {
              invitation_id: invitation.invitation_id,
              invitation_type: invitation.invitation_type,
              resent: true
            }
          }
        });

        emitNotificationToUser(invitation.recipient_id, notification);
      } catch (notifError) {
        logger.warning('Failed to create resend notification', {
          module: 'AccountShares',
          label: 'RESEND_NOTIFICATION',
          extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' }
        });
      }
    }

    // TODO: Resend email notification

    logger.info('Invitation resent', {
      module: 'AccountShares',
      label: 'RESEND_INVITATION',
      extraData: { invitationId: invitation_id, userId }
    });

    return SUCCESS.json('Invitation resent successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error resending invitation', {
      module: 'AccountShares',
      label: 'RESEND_INVITATION',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

