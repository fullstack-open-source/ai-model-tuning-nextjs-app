# Email Service

Comprehensive email service with support for HTML, plain text, attachments, threading, bulk sending, and more.

## Installation

The service uses `nodemailer`. Install it if not already installed:

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Features

- ✅ HTML email support
- ✅ Plain text email support
- ✅ Email attachments (files, inline images)
- ✅ Email threading (In-Reply-To, References headers)
- ✅ Bulk email sending with batching
- ✅ Email validation
- ✅ Priority levels (high, normal, low)
- ✅ CC, BCC support
- ✅ Reply and Forward functionality
- ✅ Custom headers and metadata
- ✅ Comprehensive error handling and logging
- ✅ TypeScript support

## Usage

### Basic Setup

```typescript
import EmailService from '@lib/email/EmailService';

const emailService = new EmailService();
```

### Send HTML Email

```typescript
await emailService.sendHtmlEmail({
  to: 'user@example.com',
  subject: 'Welcome to Our Service',
  html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
  text: 'Welcome! Thank you for joining us.', // Plain text fallback
});
```

### Send Plain Text Email

```typescript
await emailService.sendPlainTextEmail({
  to: 'user@example.com',
  subject: 'Simple Notification',
  text: 'This is a plain text email.',
});
```

### Send Email with Attachments

```typescript
await emailService.sendEmailWithAttachments({
  to: 'user@example.com',
  subject: 'Document Attached',
  html: '<p>Please find the document attached.</p>',
  attachments: [
    {
      filename: 'document.pdf',
      path: '/path/to/document.pdf',
    },
    {
      filename: 'image.png',
      content: Buffer.from('...'), // or use path
      contentType: 'image/png',
      cid: 'unique-image-id', // For inline images
    },
  ],
});
```

### Send Reply Email (with Threading)

```typescript
await emailService.sendReply(
  'original-message-id@example.com',
  ['reference1@example.com', 'reference2@example.com'],
  {
    to: 'original-sender@example.com',
    subject: 'Re: Your Question',
    html: '<p>Here is my response...</p>',
  }
);
```

### Send Forwarded Email

```typescript
await emailService.sendForward(
  'original-message-id@example.com',
  ['reference1@example.com'],
  {
    to: 'new-recipient@example.com',
    subject: 'Fwd: Important Information',
    html: '<p>Forwarded message...</p>',
  }
);
```

### Send Bulk Emails

```typescript
const result = await emailService.sendBulkEmail({
  recipients: [
    { to: 'user1@example.com', metadata: { userId: '123' } },
    { to: 'user2@example.com', metadata: { userId: '456' } },
    { to: { name: 'User 3', email: 'user3@example.com' } },
  ],
  subject: 'Newsletter',
  html: '<h1>Monthly Newsletter</h1><p>Content here...</p>',
  batchSize: 10, // Send 10 emails per batch
  delayBetweenBatches: 1000, // 1 second delay between batches
});

console.log(`Sent: ${result.success}, Failed: ${result.failed}`);
```

### Advanced Options

```typescript
await emailService.sendHtmlEmail({
  to: [
    { name: 'John Doe', email: 'john@example.com' },
    'jane@example.com',
  ],
  cc: 'manager@example.com',
  bcc: 'archive@example.com',
  subject: 'Important Update',
  from: { name: 'Company Name', email: 'noreply@company.com' },
  replyTo: 'support@company.com',
  html: '<h1>Update</h1><p>Content...</p>',
  text: 'Update: Content...',
  priority: 'high',
  tags: ['notification', 'important'],
  metadata: { campaignId: '123', userId: '456' },
  headers: {
    'X-Custom-Header': 'value',
  },
  thread: {
    inReplyTo: 'previous-message-id@example.com',
    references: ['ref1@example.com', 'ref2@example.com'],
    subjectPrefix: 'Re:',
  },
  attachments: [
    {
      filename: 'report.pdf',
      path: '/path/to/report.pdf',
    },
  ],
});
```

## Email Threading

Email threading is handled automatically when using `sendReply()` or `sendForward()`. The service:

1. Adds `In-Reply-To` header with the original message ID
2. Adds `References` header with all previous message IDs
3. Adds subject prefix (Re: or Fwd:)

### Manual Threading

```typescript
await emailService.sendHtmlEmail({
  to: 'user@example.com',
  subject: 'Re: Your Question',
  html: '<p>Response...</p>',
  thread: {
    inReplyTo: 'original-message-id@example.com',
    references: ['ref1@example.com', 'ref2@example.com'],
    subjectPrefix: 'Re:',
  },
});
```

## Bulk Email Best Practices

1. **Batch Size**: Use reasonable batch sizes (10-50 emails per batch)
2. **Delays**: Add delays between batches to avoid rate limiting
3. **Error Handling**: Check the results array for failed emails
4. **Validation**: Validate email addresses before sending

```typescript
const result = await emailService.sendBulkEmail({
  recipients: largeRecipientList,
  subject: 'Newsletter',
  html: newsletterHtml,
  batchSize: 20,
  delayBetweenBatches: 2000, // 2 seconds
});

// Handle failures
result.results.forEach((item) => {
  if (!item.success) {
    console.error(`Failed to send to ${item.recipient}: ${item.error}`);
  }
});
```

## Configuration

The service uses configuration from `@lib/config/env`:

```typescript
import { emailConfig } from '@lib/config/env';

// Configuration includes:
// - host: SMTP host
// - user: SMTP username
// - password: SMTP password
// - port: SMTP port
// - useTLS: Use TLS encryption
```

## Error Handling

All methods throw errors that should be caught:

```typescript
try {
  await emailService.sendHtmlEmail({
    to: 'user@example.com',
    subject: 'Test',
    html: '<p>Test</p>',
  });
} catch (error) {
  console.error('Email sending failed:', error);
  // Handle error
}
```

## Service Status

Check if the service is configured:

```typescript
if (emailService.isConfigured()) {
  // Service is ready
}

const status = emailService.getConfigurationStatus();
console.log(status);
```

## Cleanup

Close the transporter when done:

```typescript
await emailService.close();
```

## TypeScript Interfaces

All interfaces are exported from `@types/email`:

```typescript
import type {
  EmailAttachment,
  EmailAddress,
  EmailThreadOptions,
  EmailSendOptions,
  HtmlEmailOptions,
  PlainTextEmailOptions,
  TemplateEmailOptions,
  BulkEmailRecipient,
  BulkEmailOptions,
  BulkEmailResult,
  BulkEmailResponse,
  EmailServiceStatus,
} from '@types/email';
```

All types are centralized in `src/types/email.ts` for better organization and reusability across the project.

## Examples

### Welcome Email

```typescript
await emailService.sendHtmlEmail({
  to: newUser.email,
  subject: 'Welcome to Our Platform',
  html: `
    <h1>Welcome, ${newUser.name}!</h1>
    <p>Thank you for joining us.</p>
    <a href="${activationLink}">Activate your account</a>
  `,
  text: `Welcome, ${newUser.name}! Thank you for joining us. Activate: ${activationLink}`,
  tags: ['welcome', 'onboarding'],
});
```

### Password Reset Email

```typescript
await emailService.sendHtmlEmail({
  to: user.email,
  subject: 'Password Reset Request',
  html: `
    <p>You requested a password reset.</p>
    <a href="${resetLink}">Reset Password</a>
    <p>This link expires in 1 hour.</p>
  `,
  priority: 'high',
  tags: ['security', 'password-reset'],
});
```

### Invoice Email with Attachment

```typescript
await emailService.sendEmailWithAttachments({
  to: customer.email,
  subject: `Invoice #${invoiceNumber}`,
  html: `
    <h1>Invoice #${invoiceNumber}</h1>
    <p>Amount: $${amount}</p>
    <p>Please find the invoice attached.</p>
  `,
  attachments: [
    {
      filename: `invoice-${invoiceNumber}.pdf`,
      path: invoicePdfPath,
    },
  ],
});
```

## OTP Email Template

The service includes a built-in OTP (One-Time Password) email template:

```typescript
await emailService.sendOtpEmail(
  'user@example.com',
  {
    userName: 'John Doe',
    otpCode: '123456',
    expiryMinutes: 10,
    companyName: 'Your Company',
    companyAddress: '123 Business Street',
    supportUrl: 'https://example.com/support',
  },
  {
    subject: 'Your Verification Code',
    priority: 'high',
  }
);
```

The OTP template includes:
- Professional responsive design
- Large, readable OTP code display
- Expiry time warning
- Company branding
- Support link

See `templates/README.md` for more details.

## Best Practices

1. **Always provide text fallback** for HTML emails
2. **Validate email addresses** before sending
3. **Use appropriate priority levels** (high for urgent, normal for regular)
4. **Add tags** for email categorization and tracking
5. **Handle errors gracefully** and log them
6. **Use threading** for replies and forwards
7. **Batch bulk emails** to avoid rate limiting
8. **Test email templates** before sending to large lists

