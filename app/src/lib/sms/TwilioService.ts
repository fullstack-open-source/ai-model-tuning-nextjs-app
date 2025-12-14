import twilio, { Twilio } from 'twilio';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import type { CallInstance } from 'twilio/lib/rest/api/v2010/account/call';
import { twilioConfig } from '@lib/config/env';
import { logger } from '@lib/logger/logger';

/**
 * Twilio Service
 * Handles SMS, WhatsApp, and Voice call functionality
 */
class TwilioService {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly smsFrom: string;
  private readonly whatsappFrom: string;
  private readonly callFrom: string;
  private readonly client: Twilio;

  constructor() {
    // Validate required configuration
    if (!twilioConfig.accountSid || !twilioConfig.authToken) {
      throw new Error('Twilio account SID and auth token are required');
    }

    this.accountSid = twilioConfig.accountSid;
    this.authToken = twilioConfig.authToken;
    this.smsFrom = twilioConfig.phoneNumber;
    this.whatsappFrom = twilioConfig.whatsappNumber;
    this.callFrom = twilioConfig.callerId;
    
    // Initialize Twilio client
    this.client = twilio(this.accountSid, this.authToken);
  }

  /**
   * Send SMS message
   * @param to - Recipient phone number (E.164 format, e.g., +1234567890)
   * @param message - Message body to send
   * @returns Promise with Twilio message response
   * @throws Error if SMS sending fails
   */
  async sendSMS(to: string, message: string): Promise<MessageInstance> {
    if (!this.smsFrom) {
      throw new Error('Twilio phone number not configured');
    }

    if (!to || !message) {
      throw new Error('Recipient phone number and message are required');
    }

    try {
      const response = await this.client.messages.create({
        body: message,
        from: this.smsFrom,
        to: to,
      });

      logger.info('SMS sent successfully', {
        module: 'TwilioService',
        extraData: {
          to,
          messageSid: response.sid,
        },
      });

      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('SMS sending failed', {
        module: 'TwilioService',
        extraData: {
          error: errorMessage,
          to,
        },
      });
      throw error;
    }
  }

  /**
   * Send WhatsApp message
   * @param to - Recipient phone number (E.164 format, e.g., +1234567890)
   * @param message - Message body to send
   * @returns Promise with Twilio message response
   * @throws Error if WhatsApp message sending fails
   */
  async sendWhatsApp(to: string, message: string): Promise<MessageInstance> {
    if (!this.whatsappFrom) {
      throw new Error('Twilio WhatsApp number not configured');
    }

    if (!to || !message) {
      throw new Error('Recipient phone number and message are required');
    }

    try {
      const response = await this.client.messages.create({
        body: message,
        from: `whatsapp:${this.whatsappFrom}`,
        to: `whatsapp:${to}`,
      });

      logger.info('WhatsApp message sent successfully', {
        module: 'TwilioService',
        extraData: {
          to,
          messageSid: response.sid,
        },
      });

      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WhatsApp message sending failed', {
        module: 'TwilioService',
        extraData: {
          error: errorMessage,
          to,
        },
      });
      throw error;
    }
  }

  /**
   * Make a voice call
   * @param to - Recipient phone number (E.164 format, e.g., +1234567890)
   * @param twimlUrl - URL containing TwiML instructions for the call
   * @returns Promise with Twilio call response
   * @throws Error if call creation fails
   */
  async makeCall(to: string, twimlUrl: string): Promise<CallInstance> {
    if (!this.callFrom) {
      throw new Error('Twilio caller ID not configured');
    }

    if (!to || !twimlUrl) {
      throw new Error('Recipient phone number and TwiML URL are required');
    }

    // Validate URL format
    try {
      new URL(twimlUrl);
    } catch {
      throw new Error('Invalid TwiML URL format');
    }

    try {
      const response = await this.client.calls.create({
        url: twimlUrl,
        from: this.callFrom,
        to: to,
      });

      logger.info('Voice call initiated successfully', {
        module: 'TwilioService',
        extraData: {
          to,
          callSid: response.sid,
        },
      });

      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Voice call creation failed', {
        module: 'TwilioService',
        extraData: {
          error: errorMessage,
          to,
        },
      });
      throw error;
    }
  }

  /**
   * Check if Twilio service is properly configured
   * @returns boolean indicating if service is configured
   */
  isConfigured(): boolean {
    return !!(
      this.accountSid &&
      this.authToken &&
      (this.smsFrom || this.whatsappFrom || this.callFrom)
    );
  }

  /**
   * Get service configuration status
   * @returns Object with configuration status for each service
   */
  getConfigurationStatus(): {
    sms: boolean;
    whatsapp: boolean;
    voice: boolean;
  } {
    return {
      sms: !!this.smsFrom,
      whatsapp: !!this.whatsappFrom,
      voice: !!this.callFrom,
    };
  }
}

export default TwilioService;
