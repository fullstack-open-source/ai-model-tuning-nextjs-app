import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { prisma } from '@lib/db/prisma';
import { emitNotificationToUser } from '@lib/websocket/emitter';

interface Params {
  params: Promise<{ share_id: string }>;
}

/**
 * Leave a shared account (as the shared user)
 * POST /api/account-shares/[share_id]/leave
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { user } = await validateRequest(req);
    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const { share_id } = await params;

    // Get existing share
    const existingShare = await prisma.accountShare.findUnique({
      where: { share_id }
    });

    if (!existingShare) {
      return ERROR.json('NOT_FOUND', { message: 'Share not found' });
    }

    // Only shared user can leave
    if (existingShare.recipient_id !== userId) {
      return ERROR.json('FORBIDDEN', { message: 'You are not authorized to leave this share' });
    }

    // Update share status
    await prisma.accountShare.update({
      where: { share_id },
      data: {
        status: 'revoked'
      }
    });

    // Log activity
    await prisma.accountShareActivity.create({
      data: {
        share_id,
        user_id: userId,
        action: 'share_revoked',
        action_detail: 'User left the shared account'
      }
    });

    // Notify owner about the user leaving
    try {
      const userName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.email || 'A user';

      const notification = await prisma.notification.create({
        data: {
          title: 'User Left Shared Account',
          message: `${userName} has left your shared account`,
          notification_type: 'account_share',
          is_read: false,
          priority: 'normal',
          action_url: '/account-sharing',
          action_label: 'View Details',
          icon: 'UserMinus',
          user_id: existingShare.owner_id,
          metadata: { share_id }
        }
      });

      emitNotificationToUser(existingShare.owner_id, notification);
    } catch (notifError) {
      logger.warning('Failed to create leave notification', {
        module: 'AccountShares',
        label: 'LEAVE_NOTIFICATION',
        extraData: { error: notifError instanceof Error ? notifError.message : 'Unknown error' }
      });
    }

    logger.info('User left shared account', {
      module: 'AccountShares',
      label: 'LEAVE_SHARE',
      extraData: { shareId: share_id, userId }
    });

    return SUCCESS.json('You have left the shared account');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error leaving share', {
      module: 'AccountShares',
      label: 'LEAVE_SHARE',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

