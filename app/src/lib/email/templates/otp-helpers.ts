/**
 * OTP Email Template Helpers
 * Utility functions for generating OTP email content
 */

import fs from 'fs';
import path from 'path';

/**
 * OTP Email Template Data
 */
export interface OtpEmailData {
  userName: string;
  otpCode: string;
  expiryMinutes: number;
  companyName?: string;
  companyAddress?: string;
  supportUrl?: string;
  currentYear?: number;
}

/**
 * Default OTP email template data
 */
const defaultOtpData: Partial<OtpEmailData> = {
  companyName: 'Your Company',
  companyAddress: '123 Business Street, City, Country',
  supportUrl: 'https://example.com/support',
  currentYear: new Date().getFullYear(),
};

/**
 * Replace template variables in HTML string
 */
function replaceTemplateVariables(template: string, data: OtpEmailData): string {
  const mergedData = { ...defaultOtpData, ...data };
  
  let html = template;
  
  // Replace all template variables
  Object.entries(mergedData).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, String(value ?? ''));
  });
  
  return html;
}

/**
 * Generate OTP email HTML from template
 */
export function generateOtpEmailHtml(data: OtpEmailData): string {
  // Try to load template file
  const templatePath = path.join(process.cwd(), 'src/lib/email/templates/otp.html');
  
  let template: string;
  
  try {
    template = fs.readFileSync(templatePath, 'utf-8');
  } catch {
    // Fallback to inline template if file not found
    template = getInlineOtpTemplate();
  }
  
  return replaceTemplateVariables(template, data);
}

/**
 * Generate plain text version of OTP email
 */
export function generateOtpEmailText(data: OtpEmailData): string {
  const mergedData = { ...defaultOtpData, ...data };
  
  return `
Hello ${mergedData.userName},

We received a request to verify your account. Use the following one-time password (OTP) to complete your verification:

Your Verification Code: ${mergedData.otpCode}

IMPORTANT: This code will expire in ${mergedData.expiryMinutes} minutes. Do not share this code with anyone.

If you didn't request this code, please ignore this email or contact our support team if you have concerns.

This is an automated message. Please do not reply to this email.

---
${mergedData.companyName}
${mergedData.companyAddress}

© ${mergedData.currentYear} ${mergedData.companyName}. All rights reserved.

Need help? Contact Support: ${mergedData.supportUrl}
  `.trim();
}

/**
 * Inline OTP template (fallback if file not found)
 */
function getInlineOtpTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>One-Time Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Verification Code</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 30px;">
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 24px;">Hello {{userName}},</p>
                            <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 24px;">We received a request to verify your account. Use the following one-time password (OTP) to complete your verification:</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px 40px;">
                                                    <div style="text-align: center;">
                                                        <p style="margin: 0 0 10px; color: #ffffff; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                                                        <p style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">{{otpCode}}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px; padding: 15px 20px;">
                                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 20px;"><strong style="color: #333333;">Important:</strong> This code will expire in <strong style="color: #667eea;">{{expiryMinutes}} minutes</strong>. Do not share this code with anyone.</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 20px; color: #666666; font-size: 14px; line-height: 20px;">If you didn't request this code, please ignore this email or contact our support team if you have concerns.</p>
                            <p style="margin: 0; color: #999999; font-size: 12px; line-height: 18px;">This is an automated message. Please do not reply to this email.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0; color: #666666; font-size: 14px;"><strong>{{companyName}}</strong></p>
                                        <p style="margin: 5px 0 0; color: #999999; font-size: 12px;">{{companyAddress}}</p>
                                        <p style="margin: 15px 0 0; padding-top: 15px; border-top: 1px solid #e9ecef; color: #999999; font-size: 11px;">© {{currentYear}} {{companyName}}. All rights reserved.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

