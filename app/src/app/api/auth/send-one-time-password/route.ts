import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { setOtp } from '@lib/authenticate/otp-cache';
import EmailService from '@lib/email/EmailService';
import TwilioService from '@lib/sms/TwilioService';
import { prisma } from '@lib/db/prisma';

/**
 * Send One-Time Password
 * POST /api/auth/send-one-time-password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, channel } = body;

    // Validation
    if (!user_id) {
      return ERROR.json('AUTH_INVALID_PAYLOAD', { message: 'user_id is required' });
    }

    if (!channel || !['email', 'sms', 'whatsapp'].includes(channel)) {
      return ERROR.json('AUTH_CHANNEL_UNSUPPORTED', { channel, message: 'channel must be email, sms, or whatsapp' });
    }

    // Check if user exists (optional - can be used for validation)
    let user = null;
    try {
      if (user_id.includes('@')) {
        // Email lookup
        user = await prisma.user.findUnique({
          where: { email: user_id.toLowerCase() },
          select: { user_id: true, email: true, first_name: true, last_name: true },
        });
      } else {
        // Phone lookup (if phone_number is stored as JSON)
        user = await prisma.user.findFirst({
          where: {
            phone_number: {
              path: ['number'],
              equals: user_id,
            },
          },
          select: { user_id: true, email: true, first_name: true, last_name: true },
        });
      }
    } catch (error) {
      // User lookup is optional - continue even if user doesn't exist
      logger.info('User lookup failed (optional)', {
        module: 'Auth',
        extraData: { user_id, error: error instanceof Error ? error.message : 'Unknown' },
      });
    }

    // Generate and store OTP (10 minutes = 600 seconds)
    const otp = await setOtp(user_id, 600);

    if (!otp) {
      logger.error('Failed to generate OTP', {
        module: 'Auth',
        extraData: { user_id },
      });
      return ERROR.json('AUTH_OTP_SEND_FAILED', { user_id });
    }

    // Send OTP via selected channel
    let sendResult = false;

    if (channel === 'email') {
      try {
        const emailService = new EmailService();
        const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user_id : user_id;
        
        await emailService.sendOtpEmail(
          user_id,
          {
            userName: userName || user_id,
            otpCode: otp,
            expiryMinutes: 10,
            companyName: process.env.COMPANY_NAME || 'Our Company',
            companyAddress: process.env.COMPANY_ADDRESS || '',
            supportUrl: process.env.SUPPORT_URL || process.env.NEXT_PUBLIC_API_URL || '',
          }
        );
        sendResult = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to send OTP email', {
          module: 'Auth',
          extraData: { user_id, error: errorMessage },
        });
        sendResult = false;
      }
    } else if (channel === 'sms') {
      try {
        const twilioService = new TwilioService();
        await twilioService.sendSMS(user_id, `Your OTP is ${otp}. It is valid for 10 minutes.`);
        sendResult = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to send OTP SMS', {
          module: 'Auth',
          extraData: { user_id, error: errorMessage },
        });
        sendResult = false;
      }
    } else if (channel === 'whatsapp') {
      try {
        const twilioService = new TwilioService();
        await twilioService.sendWhatsApp(user_id, `Your OTP is: ${otp}`);
        sendResult = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to send OTP WhatsApp', {
          module: 'Auth',
          extraData: { user_id, error: errorMessage },
        });
        sendResult = false;
      }
    }

    if (!sendResult) {
      return ERROR.json('AUTH_OTP_SEND_FAILED', { user_id, channel });
    }

    logger.info('OTP sent successfully', {
      module: 'Auth',
      extraData: { user_id, channel },
    });

    return SUCCESS.json('OTP sent successfully', { message: 'OTP sent successfully' });
  } catch (error: unknown) {
    logger.error('Error in send_one_time_password', {
      module: 'Auth',
      extraData: {
        error: error instanceof Error ? error.message : 'Unknown error',
        label: 'SEND_OTP',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}

