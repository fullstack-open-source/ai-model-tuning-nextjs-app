import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { checkPermissionOrReturnError } from '@lib/middleware/permission-check';
import { prisma } from '@lib/db/prisma';

/**
 * Get account share statistics for current user
 * GET /api/account-shares/statistics
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

    // Get all statistics in parallel
    const [
      totalSharesOwned,
      totalSharesReceived,
      activeSharesOwned,
      activeSharesReceived,
      pendingInvitationsSent,
      pendingInvitationsReceived,
      pendingAccessRequests,
      expiredShares
    ] = await Promise.all([
      // Total shares I've given
      prisma.accountShare.count({
        where: { owner_id: userId }
      }),
      // Total shares I've received
      prisma.accountShare.count({
        where: { recipient_id: userId }
      }),
      // Active shares I've given
      prisma.accountShare.count({
        where: { owner_id: userId, status: 'active' }
      }),
      // Active shares I've received
      prisma.accountShare.count({
        where: { recipient_id: userId, status: 'active' }
      }),
      // Pending invitations I've sent (share type)
      prisma.accountShareInvitation.count({
        where: {
          sender_id: userId,
          invitation_type: 'share',
          status: 'pending'
        }
      }),
      // Pending invitations I've received (share type)
      prisma.accountShareInvitation.count({
        where: {
          OR: [
            { recipient_id: userId },
            // Include email-based invitations that match user's email
            { recipient_email: user?.email || '' }
          ],
          invitation_type: 'share',
          status: 'pending'
        }
      }),
      // Pending access requests to my account (as target owner)
      prisma.accountShareInvitation.count({
        where: {
          target_owner_id: userId,
          invitation_type: 'request',
          status: 'pending'
        }
      }),
      // Expired shares
      prisma.accountShare.count({
        where: {
          owner_id: userId,
          status: 'expired'
        }
      })
    ]);

    const statistics = {
      total_shares_owned: totalSharesOwned,
      total_shares_received: totalSharesReceived,
      active_shares_owned: activeSharesOwned,
      active_shares_received: activeSharesReceived,
      pending_invitations_sent: pendingInvitationsSent,
      pending_invitations_received: pendingInvitationsReceived,
      pending_access_requests: pendingAccessRequests,
      active_shares: activeSharesOwned + activeSharesReceived,
      expired_shares: expiredShares
    };

    return SUCCESS.json('Statistics retrieved successfully', statistics);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting share statistics', {
      module: 'AccountShares',
      label: 'GET_STATISTICS',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

