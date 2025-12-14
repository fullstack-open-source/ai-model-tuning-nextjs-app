import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { validateRequest } from '@lib/middleware/auth';
import { prisma } from '@lib/db/prisma';

/**
 * Contact Admin (for suspended users)
 * POST /api/auth/contact-admin
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest(req);
    const body = await req.json();
    const { subject, message } = body;

    if (!message || !message.trim()) {
      return ERROR.json('INVALID_PAYLOAD', { message: 'Message is required' });
    }

    const userId = user.uid || user.user_id;
    if (!userId) {
      return ERROR.json('UNAUTHORIZED', { message: 'User ID not found' });
    }

    // Get user details
    const userData = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        email: true,
        first_name: true,
        last_name: true,
        account_status: true,
      },
    });

    if (!userData) {
      return ERROR.json('USER_NOT_FOUND', { message: 'User not found' });
    }

    // Log the contact request (you can also store this in a database table if needed)
    logger.info('Suspended user contacted admin', {
      module: 'Auth',
      label: 'CONTACT_ADMIN',
      extraData: {
        user_id: userId,
        user_email: userData.email,
        subject: subject || 'Account Suspension Inquiry',
        message: message,
        status: userData.account_status,
      },
    });

    // TODO: Send email notification to admin
    // You can implement email sending here using your email service
    // Example:
    // await sendEmail({
    //   to: adminEmail,
    //   subject: `Account Suspension Inquiry from ${userData.email}`,
    //   body: `User: ${userData.first_name} ${userData.last_name} (${userData.email})\nStatus: ${userData.status}\nSubject: ${subject || 'Account Suspension Inquiry'}\n\nMessage:\n${message}`,
    // });

    return SUCCESS.json('Message sent successfully. We will review your request shortly.', {
      message_id: `contact-${Date.now()}`,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error processing contact admin request', {
      module: 'Auth',
      extraData: {
        error: errorMessage,
        label: 'CONTACT_ADMIN',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

