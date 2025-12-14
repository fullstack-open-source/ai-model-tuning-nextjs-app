import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { prisma } from '@lib/db/prisma';

interface Params {
  params: Promise<{ token: string }>;
}

/**
 * Get invitation by token (public endpoint for accept page)
 * GET /api/account-shares/invitations/token/[token]
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    if (!token) {
      return ERROR.json('INVALID_REQUEST', { message: 'Token is required' });
    }

    // Find invitation by token
    const invitation = await prisma.accountShareInvitation.findUnique({
      where: { invitation_token: token },
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
      return ERROR.json('NOT_FOUND', { message: 'Invitation not found or has expired' });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status to expired if not already
      if (invitation.status === 'pending') {
        await prisma.accountShareInvitation.update({
          where: { invitation_id: invitation.invitation_id },
          data: { status: 'expired' }
        });
        invitation.status = 'expired';
      }
    }

    // Hide sensitive fields
    const safeInvitation = {
      ...invitation,
      invitation_token: undefined // Don't expose the full token in response
    };

    return SUCCESS.json('Invitation retrieved successfully', { invitation: safeInvitation });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting invitation by token', {
      module: 'AccountShares',
      label: 'GET_INVITATION_BY_TOKEN',
      extraData: { error: errorMessage }
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

