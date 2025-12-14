import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { prisma } from '@lib/db/prisma';

interface Params {
  params: Promise<{ invitation_id: string }>;
}

/**
 * Get a specific invitation
 * GET /api/account-shares/invitations/[invitation_id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await validateRequest(req);
    const userId = user?.uid || user?.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User not found' });
    }

    const { invitation_id } = await params;

    const invitation = await prisma.accountShareInvitation.findUnique({
      where: { invitation_id },
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
    });

    if (!invitation) {
      return ERROR.json('NOT_FOUND', { message: 'Invitation not found' });
    }

    // Check if user is authorized
    const isAuthorized = invitation.sender_id === userId ||
      invitation.recipient_id === userId ||
      invitation.target_owner_id === userId;

    if (!isAuthorized) {
      return ERROR.json('FORBIDDEN', { message: 'You are not authorized to view this invitation' });
    }

    return SUCCESS.json('Invitation retrieved successfully', { invitation });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting invitation', {
      module: 'AccountShares',
      label: 'GET_INVITATION',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

/**
 * Cancel an invitation (as sender)
 * DELETE /api/account-shares/invitations/[invitation_id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
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

    // Only sender can cancel
    if (invitation.sender_id !== userId) {
      return ERROR.json('FORBIDDEN', { message: 'Only the sender can cancel this invitation' });
    }

    // Can only cancel pending invitations
    if (invitation.status !== 'pending') {
      return ERROR.json('INVALID_REQUEST', {
        message: `Cannot cancel an invitation that has been ${invitation.status}`
      });
    }

    // Update status to cancelled
    await prisma.accountShareInvitation.update({
      where: { invitation_id },
      data: { status: 'cancelled' }
    });

    logger.info('Invitation cancelled', {
      module: 'AccountShares',
      label: 'CANCEL_INVITATION',
      extraData: { invitationId: invitation_id, userId }
    });

    return SUCCESS.json('Invitation cancelled successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error cancelling invitation', {
      module: 'AccountShares',
      label: 'CANCEL_INVITATION',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

