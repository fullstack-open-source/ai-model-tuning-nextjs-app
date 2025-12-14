import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { emailConfig } from '@lib/config/env';
import { logger } from '@lib/logger/logger';
import type {
  EmailAttachment,
  EmailAddress,
  EmailThreadOptions,
  EmailSendOptions,
  HtmlEmailOptions,
  PlainTextEmailOptions,
  TemplateEmailOptions,
  BulkEmailOptions,
  BulkEmailResponse,
  BulkEmailResult,
  EmailServiceStatus,
} from '../../types/email';
import { generateOtpEmailHtml, generateOtpEmailText, type OtpEmailData } from './templates/otp-helpers';

/**
 * Email Service
 * Comprehensive email service with support for HTML, plain text, attachments, threading, and bulk sending
 */
class EmailService {
  private readonly transporter: Transporter;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo?: string;

  constructor() {
    // Validate required configuration
    if (!emailConfig.host || !emailConfig.user || !emailConfig.password) {
      throw new Error('Email configuration is incomplete. Host, user, and password are required.');
    }

    this.defaultFrom = emailConfig.user;
    this.defaultReplyTo = emailConfig.user;

    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465, // true for 465, false for other ports
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
      tls: {
        rejectUnauthorized: false, // For self-signed certificates
      },
    });

    // Verify connection asynchronously (don't block constructor)
    // This allows the service to be created even if SMTP server is temporarily unavailable
    this.verifyConnection().catch((error) => {
      // Log but don't throw - connection will be verified on first send attempt
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warning('Email service connection verification failed (will retry on send)', {
        module: 'EmailService',
        extraData: { error: errorMessage },
      });
    });
  }

  /**
   * Verify SMTP connection
   * This is called asynchronously and errors are logged but don't prevent service creation
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified', {
        module: 'EmailService',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Email service connection verification failed', {
        module: 'EmailService',
        extraData: { error: errorMessage },
      });
      // Don't throw - let it fail on actual send attempt for better error handling
    }
  }

  /**
   * Normalize email address to string format
   */
  private normalizeEmailAddress(
    address: string | EmailAddress | (string | EmailAddress)[]
  ): string | string[] {
    if (Array.isArray(address)) {
      return address.map((addr) => this.normalizeEmailAddress(addr) as string);
    }

    if (typeof address === 'string') {
      return address;
    }

    return address.name ? `${address.name} <${address.email}>` : address.email;
  }

  /**
   * Build email headers with threading support
   */
  private buildHeaders(options: EmailSendOptions): Record<string, string> {
    const headers: Record<string, string> = {
      ...options.headers,
    };

    // Add threading headers
    if (options.thread) {
      if (options.thread.inReplyTo) {
        headers['In-Reply-To'] = options.thread.inReplyTo;
      }

      if (options.thread.references) {
        const references = Array.isArray(options.thread.references)
          ? options.thread.references.join(' ')
          : options.thread.references;
        headers['References'] = references;
      }

      // Add subject prefix if provided
      if (options.thread.subjectPrefix && !options.subject.startsWith(options.thread.subjectPrefix)) {
        options.subject = `${options.thread.subjectPrefix} ${options.subject}`;
      }
    }

    // Add priority header
    if (options.priority) {
      const priorityMap: Record<string, string> = {
        high: '1',
        normal: '3',
        low: '5',
      };
      headers['X-Priority'] = priorityMap[options.priority] || '3';
      headers['Priority'] = options.priority;
    }

    // Add custom tags as headers (useful for email providers like SendGrid, Mailgun)
    if (options.tags && options.tags.length > 0) {
      headers['X-Tags'] = options.tags.join(',');
    }

    return headers;
  }

  /**
   * Validate email address format
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate email addresses
   */
  private validateEmailAddresses(addresses: string | string[] | EmailAddress | EmailAddress[]): void {
    const normalize = (addr: string | EmailAddress): string => {
      return typeof addr === 'string' ? addr : addr.email;
    };

    const addressArray = Array.isArray(addresses) ? addresses : [addresses];
    const invalidEmails: string[] = [];

    addressArray.forEach((addr) => {
      const email = normalize(addr);
      if (!this.validateEmail(email)) {
        invalidEmails.push(email);
      }
    });

    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }
  }

  /**
   * Send HTML email
   */
  async sendHtmlEmail(options: HtmlEmailOptions): Promise<nodemailer.SentMessageInfo> {
    // Validate email addresses
    this.validateEmailAddresses(options.to);
    if (options.cc) this.validateEmailAddresses(options.cc);
    if (options.bcc) this.validateEmailAddresses(options.bcc);

    const mailOptions: SendMailOptions = {
      from: options.from ? (typeof options.from === 'string' ? options.from : options.from.email) : this.defaultFrom,
      to: this.normalizeEmailAddress(options.to),
      cc: options.cc ? this.normalizeEmailAddress(options.cc) : undefined,
      bcc: options.bcc ? this.normalizeEmailAddress(options.bcc) : undefined,
      replyTo: options.replyTo ? (typeof options.replyTo === 'string' ? options.replyTo : options.replyTo.email) : this.defaultReplyTo,
      subject: options.subject,
      html: options.html,
      text: options.text, // Plain text fallback
      attachments: options.attachments,
      headers: this.buildHeaders(options),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('HTML email sent successfully', {
        module: 'EmailService',
        extraData: {
          to: Array.isArray(options.to) ? options.to.map(t => typeof t === 'string' ? t : t.email).join(', ') : (typeof options.to === 'string' ? options.to : options.to.email),
          subject: options.subject,
          messageId: info.messageId,
        },
      });

      return info;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('HTML email sending failed', {
        module: 'EmailService',
        extraData: {
          error: errorMessage,
          to: Array.isArray(options.to) ? options.to.map(t => typeof t === 'string' ? t : t.email).join(', ') : (typeof options.to === 'string' ? options.to : options.to.email),
          subject: options.subject,
        },
      });
      throw error;
    }
  }

  /**
   * Send plain text email
   */
  async sendPlainTextEmail(options: PlainTextEmailOptions): Promise<nodemailer.SentMessageInfo> {
    // Validate email addresses
    this.validateEmailAddresses(options.to);
    if (options.cc) this.validateEmailAddresses(options.cc);
    if (options.bcc) this.validateEmailAddresses(options.bcc);

    const mailOptions: SendMailOptions = {
      from: options.from ? (typeof options.from === 'string' ? options.from : options.from.email) : this.defaultFrom,
      to: this.normalizeEmailAddress(options.to),
      cc: options.cc ? this.normalizeEmailAddress(options.cc) : undefined,
      bcc: options.bcc ? this.normalizeEmailAddress(options.bcc) : undefined,
      replyTo: options.replyTo ? (typeof options.replyTo === 'string' ? options.replyTo : options.replyTo.email) : this.defaultReplyTo,
      subject: options.subject,
      text: options.text,
      attachments: options.attachments,
      headers: this.buildHeaders(options),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Plain text email sent successfully', {
        module: 'EmailService',
        extraData: {
          to: Array.isArray(options.to) ? options.to.map(t => typeof t === 'string' ? t : t.email).join(', ') : (typeof options.to === 'string' ? options.to : options.to.email),
          subject: options.subject,
          messageId: info.messageId,
        },
      });

      return info;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Plain text email sending failed', {
        module: 'EmailService',
        extraData: {
          error: errorMessage,
          to: Array.isArray(options.to) ? options.to.map(t => typeof t === 'string' ? t : t.email).join(', ') : (typeof options.to === 'string' ? options.to : options.to.email),
          subject: options.subject,
        },
      });
      throw error;
    }
  }

  /**
   * Send email with attachments
   */
  async sendEmailWithAttachments(options: HtmlEmailOptions | PlainTextEmailOptions): Promise<nodemailer.SentMessageInfo> {
    if (!options.attachments || options.attachments.length === 0) {
      throw new Error('No attachments provided');
    }

    // Validate attachments
    options.attachments.forEach((attachment) => {
      if (!attachment.filename) {
        throw new Error('Attachment filename is required');
      }
      if (!attachment.path && !attachment.content) {
        throw new Error('Attachment must have either path or content');
      }
    });

    if ('html' in options && options.html) {
      return this.sendHtmlEmail(options as HtmlEmailOptions);
    } else if ('text' in options && options.text) {
      return this.sendPlainTextEmail(options as PlainTextEmailOptions);
    } else {
      throw new Error('Email must have either HTML or text content');
    }
  }

  /**
   * Send reply email (with threading)
   */
  async sendReply(
    originalMessageId: string,
    originalReferences: string | string[],
    options: HtmlEmailOptions | PlainTextEmailOptions
  ): Promise<nodemailer.SentMessageInfo> {
    const threadOptions: EmailThreadOptions = {
      inReplyTo: originalMessageId,
      references: Array.isArray(originalReferences) 
        ? [...originalReferences, originalMessageId]
        : [originalReferences, originalMessageId],
      subjectPrefix: 'Re:',
    };

    const replyOptions = {
      ...options,
      thread: threadOptions,
    };

    if ('html' in options && options.html) {
      return this.sendHtmlEmail(replyOptions as HtmlEmailOptions);
    } else {
      return this.sendPlainTextEmail(replyOptions as PlainTextEmailOptions);
    }
  }

  /**
   * Send forwarded email (with threading)
   */
  async sendForward(
    originalMessageId: string,
    originalReferences: string | string[],
    options: HtmlEmailOptions | PlainTextEmailOptions
  ): Promise<nodemailer.SentMessageInfo> {
    const threadOptions: EmailThreadOptions = {
      references: Array.isArray(originalReferences) 
        ? [...originalReferences, originalMessageId]
        : [originalReferences, originalMessageId],
      subjectPrefix: 'Fwd:',
    };

    const forwardOptions = {
      ...options,
      thread: threadOptions,
    };

    if ('html' in options && options.html) {
      return this.sendHtmlEmail(forwardOptions as HtmlEmailOptions);
    } else {
      return this.sendPlainTextEmail(forwardOptions as PlainTextEmailOptions);
    }
  }

  /**
   * Send bulk emails (with batching and rate limiting)
   */
  async sendBulkEmail(options: BulkEmailOptions): Promise<BulkEmailResponse> {
    const batchSize = options.batchSize || 10;
    const delayBetweenBatches = options.delayBetweenBatches || 1000;
    const results: BulkEmailResult[] = [];

    let successCount = 0;
    let failedCount = 0;

    // Process recipients in batches
    for (let i = 0; i < options.recipients.length; i += batchSize) {
      const batch = options.recipients.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (recipient) => {
        const recipientEmail = typeof recipient.to === 'string' ? recipient.to : recipient.to.email;
        const recipientName = typeof recipient.to === 'string' ? undefined : recipient.to.name;

        try {
          // Build email options for this recipient
          let emailOptions: HtmlEmailOptions | PlainTextEmailOptions;

          // Add content (template or direct)
          if (options.html) {
            emailOptions = {
              to: recipientName ? { name: recipientName, email: recipientEmail } : recipientEmail,
              subject: recipient.subject || options.subject,
              from: options.from ? (typeof options.from === 'string' ? options.from : options.from.email) : this.defaultFrom,
              cc: options.cc,
              bcc: options.bcc,
              attachments: options.attachments,
              headers: options.headers,
              metadata: recipient.metadata,
              html: options.html,
              text: options.text,
            } as HtmlEmailOptions;
          } else if (options.text) {
            emailOptions = {
              to: recipientName ? { name: recipientName, email: recipientEmail } : recipientEmail,
              subject: recipient.subject || options.subject,
              from: options.from ? (typeof options.from === 'string' ? options.from : options.from.email) : this.defaultFrom,
              cc: options.cc,
              bcc: options.bcc,
              attachments: options.attachments,
              headers: options.headers,
              metadata: recipient.metadata,
              text: options.text,
            } as PlainTextEmailOptions;
          } else {
            throw new Error('Either HTML or text content must be provided');
          }

          // Send email
          const info = await (options.html 
            ? this.sendHtmlEmail(emailOptions as HtmlEmailOptions)
            : this.sendPlainTextEmail(emailOptions as PlainTextEmailOptions));

          successCount++;
          results.push({
            recipient: recipientEmail,
            success: true,
            messageId: info.messageId,
          });

          return { success: true, recipient: recipientEmail, messageId: info.messageId };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failedCount++;
          results.push({
            recipient: recipientEmail,
            success: false,
            error: errorMessage,
          });

          logger.error('Bulk email sending failed for recipient', {
            module: 'EmailService',
            extraData: {
              recipient: recipientEmail,
              error: errorMessage,
            },
          });

          return { success: false, recipient: recipientEmail, error: errorMessage };
        }
      });

      await Promise.all(batchPromises);

      // Delay between batches (except for the last batch)
      if (i + batchSize < options.recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    logger.info('Bulk email sending completed', {
      module: 'EmailService',
      extraData: {
        total: options.recipients.length,
        success: successCount,
        failed: failedCount,
      },
    });

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * Send email using template (placeholder - implement template engine integration)
   */
  async sendTemplateEmail(options: TemplateEmailOptions): Promise<nodemailer.SentMessageInfo> {
    // TODO: Integrate with template engine (e.g., Handlebars, EJS, React Email)
    // For now, this is a placeholder that uses provided HTML/text
    
    if (options.html) {
      return this.sendHtmlEmail({
        ...options,
        html: options.html,
        text: options.text,
      });
    } else if (options.text) {
      return this.sendPlainTextEmail({
        ...options,
        text: options.text,
      });
    } else {
      throw new Error('Template email requires either HTML or text content, or template engine integration');
    }
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      emailConfig.host &&
      emailConfig.user &&
      emailConfig.password &&
      emailConfig.port
    );
  }

  /**
   * Get email service configuration status
   */
  getConfigurationStatus(): EmailServiceStatus {
    return {
      configured: this.isConfigured(),
      host: emailConfig.host,
      port: emailConfig.port,
      user: emailConfig.user,
      useTLS: emailConfig.useTLS,
    };
  }

  /**
   * Send OTP (One-Time Password) email
   * @param to - Recipient email address
   * @param otpData - OTP email data (userName, otpCode, expiryMinutes, etc.)
   * @param options - Additional email options (subject, from, etc.)
   * @returns Promise with email send result
   */
  async sendOtpEmail(
    to: string | EmailAddress,
    otpData: OtpEmailData,
    options?: {
      subject?: string;
      from?: string | EmailAddress;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<nodemailer.SentMessageInfo> {
    // Generate HTML and text content
    const html = generateOtpEmailHtml(otpData);
    const text = generateOtpEmailText(otpData);

    // Build email options
    const emailOptions: HtmlEmailOptions = {
      to,
      subject: options?.subject || `Your Verification Code - ${otpData.otpCode}`,
      from: options?.from,
      html,
      text,
      priority: options?.priority || 'high',
      tags: ['otp', 'verification', 'security'],
      metadata: {
        type: 'otp',
        userName: otpData.userName,
        expiryMinutes: otpData.expiryMinutes,
      },
    };

    return this.sendHtmlEmail(emailOptions);
  }

  /**
   * Close transporter connection
   */
  async close(): Promise<void> {
    this.transporter.close();
    logger.info('Email service transporter closed', {
      module: 'EmailService',
    });
  }
}

export default EmailService;

