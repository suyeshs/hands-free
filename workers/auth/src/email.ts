/**
 * Email Service using Cloudflare Workers + MailChannels
 * Robust, production-ready email sending
 */

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FROM_EMAIL = 'noreply@handsfree.tech';
const FROM_NAME = 'Stonepot Admin';

/**
 * Send email using MailChannels API (free for Cloudflare Workers)
 * https://support.mailchannels.com/hc/en-us/articles/4565898358413-Sending-Email-from-Cloudflare-Workers-using-MailChannels-Send-API
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to }],
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        subject: options.subject,
        content: [
          {
            type: 'text/plain',
            value: options.text,
          },
          {
            type: 'text/html',
            value: options.html,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] MailChannels error:', error);
      return false;
    }

    console.log('[Email] Sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

/**
 * Generate magic link email HTML template
 */
export function generateMagicLinkEmail(
  magicLink: string,
  email: string
): { subject: string; text: string; html: string } {
  const subject = 'Sign in to Stonepot Admin';

  const text = `
Hello,

Click the link below to sign in to your Stonepot Admin account:

${magicLink}

This link will expire in 15 minutes for security.

If you didn't request this, you can safely ignore this email.

---
Stonepot Admin
https://admin.handsfree.tech
`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Stonepot Admin</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;">Sign in to Stonepot Admin</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                Hello,
              </p>
              
              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                Click the button below to sign in to your account. This link will expire in <strong>15 minutes</strong> for security.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${magicLink}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Sign In to Admin Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; color: #2563eb; font-size: 14px; word-break: break-all;">
                ${magicLink}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                If you didn't request this email, you can safely ignore it.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © 2025 Stonepot Admin. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Security Notice -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                🔒 This is an automated email from a secure system. Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return { subject, text, html };
}

/**
 * Send magic link email
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<boolean> {
  const { subject, text, html } = generateMagicLinkEmail(magicLink, email);
  
  return await sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

