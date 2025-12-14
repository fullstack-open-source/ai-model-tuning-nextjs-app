/**
 * Email Service Types
 * All TypeScript interfaces and types for the Email Service
 */

/**
 * Email Attachment Interface
 */
export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: string | Buffer;
  contentType?: string;
  cid?: string; // Content ID for inline images
}

/**
 * Email Address Interface
 */
export interface EmailAddress {
  name?: string;
  email: string;
}

/**
 * Email Threading Options
 */
export interface EmailThreadOptions {
  inReplyTo?: string; // Message-ID of the email being replied to
  references?: string | string[]; // Message-IDs of previous emails in thread
  subjectPrefix?: string; // Prefix like "Re:" or "Fwd:"
}

/**
 * Email Send Options (Base)
 */
export interface EmailSendOptions {
  to: string | string[] | EmailAddress | EmailAddress[];
  cc?: string | string[] | EmailAddress | EmailAddress[];
  bcc?: string | string[] | EmailAddress | EmailAddress[];
  subject: string;
  from?: string | EmailAddress;
  replyTo?: string | EmailAddress;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  thread?: EmailThreadOptions;
  tags?: string[]; // For email categorization/tracking
  metadata?: Record<string, any>; // Custom metadata
}

/**
 * HTML Email Options (extends EmailSendOptions)
 */
export interface HtmlEmailOptions extends EmailSendOptions {
  html: string;
  text?: string; // Plain text fallback
}

/**
 * Plain Text Email Options
 */
export interface PlainTextEmailOptions extends EmailSendOptions {
  text: string;
}

/**
 * Template Email Options
 */
export interface TemplateEmailOptions extends EmailSendOptions {
  template: string; // Template name or path
  templateData?: Record<string, any>; // Data to inject into template
  html?: string; // Override template HTML
  text?: string; // Override template text
}

/**
 * Bulk Email Recipient
 */
export interface BulkEmailRecipient {
  to: string | EmailAddress;
  subject?: string; // Override default subject
  templateData?: Record<string, any>; // Per-recipient template data
  metadata?: Record<string, any>;
}

/**
 * Bulk Email Options
 */
export interface BulkEmailOptions {
  recipients: BulkEmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>; // Default template data
  from?: string | EmailAddress;
  cc?: string | string[] | EmailAddress | EmailAddress[];
  bcc?: string | string[] | EmailAddress | EmailAddress[];
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  batchSize?: number; // Number of emails to send per batch
  delayBetweenBatches?: number; // Delay in milliseconds between batches
}

/**
 * Bulk Email Result
 */
export interface BulkEmailResult {
  recipient: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Bulk Email Response
 */
export interface BulkEmailResponse {
  success: number;
  failed: number;
  results: BulkEmailResult[];
}

/**
 * Email Service Configuration Status
 */
export interface EmailServiceStatus {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  useTLS: boolean;
}

