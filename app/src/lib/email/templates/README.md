# Email Templates

This directory contains HTML email templates and helper functions for generating email content.

## OTP Email Template

### Files
- `otp.html` - HTML template for one-time password emails
- `otp-helpers.ts` - Helper functions for generating OTP email content

### Usage

```typescript
import EmailService from '@lib/email/EmailService';
import type { OtpEmailData } from '@lib/email/templates/otp-helpers';

const emailService = new EmailService();

// Send OTP email
await emailService.sendOtpEmail(
  'user@example.com',
  {
    userName: 'John Doe',
    otpCode: '123456',
    expiryMinutes: 10,
    companyName: 'Your Company',
    companyAddress: '123 Business Street, City, Country',
    supportUrl: 'https://example.com/support',
  },
  {
    subject: 'Your Verification Code',
    priority: 'high',
  }
);
```

### Template Variables

The OTP template supports the following variables:

- `{{userName}}` - Recipient's name
- `{{otpCode}}` - The one-time password code
- `{{expiryMinutes}}` - Code expiration time in minutes
- `{{companyName}}` - Your company name
- `{{companyAddress}}` - Your company address
- `{{supportUrl}}` - Support/help URL
- `{{currentYear}}` - Current year (auto-filled)

### Customization

You can customize the template by:

1. Editing `otp.html` directly
2. Modifying default values in `otp-helpers.ts`
3. Passing custom values when calling `sendOtpEmail()`

### Template Features

- ✅ Responsive design (works on mobile and desktop)
- ✅ Professional gradient header
- ✅ Large, readable OTP code display
- ✅ Expiry time warning
- ✅ Company branding section
- ✅ Support link
- ✅ Plain text fallback

