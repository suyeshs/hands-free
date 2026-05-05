/**
 * MSG91 OTP Service Client
 * Handles OTP generation and verification via MSG91 API
 */

import type {
  Env,
  MSG91SendOTPRequest,
  MSG91SendOTPResponse,
  MSG91VerifyOTPResponse,
  VerificationChannel,
} from './types';

const MSG91_BASE_URL = 'https://control.msg91.com/api/v5/otp';

export class MSG91Client {
  private authKey: string;
  private templateId: string;

  constructor(env: Env) {
    this.authKey = env.MSG91_AUTH_KEY;
    this.templateId = env.MSG91_TEMPLATE_ID;

    if (!this.authKey) {
      throw new Error('MSG91_AUTH_KEY is not configured');
    }
    if (!this.templateId) {
      throw new Error('MSG91_TEMPLATE_ID is not configured');
    }
  }

  /**
   * Send OTP to a phone number
   * @param phoneNumber - Phone number in E.164 format (e.g., +919876543210)
   * @param channel - SMS or WhatsApp (MSG91 supports both)
   * @param locale - Optional locale for message (not used in MSG91 but kept for compatibility)
   */
  async sendOTP(
    phoneNumber: string,
    channel: VerificationChannel = 'sms',
    locale?: string
  ): Promise<{ requestId: string; channel: string; to: string; status: string }> {
    try {
      // Remove the + prefix from phone number for MSG91 API
      const mobile = phoneNumber.replace(/^\+/, '');

      const requestBody: MSG91SendOTPRequest = {
        mobile,
        template_id: this.templateId,
        otp_expiry: 10, // 10 minutes
        otp_length: 4, // 4-digit OTP
        realTimeResponse: 1,
      };

      const url = `${MSG91_BASE_URL}?authkey=${this.authKey}`;

      console.log('[MSG91] Sending OTP to:', mobile);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: MSG91SendOTPResponse = await response.json();

      console.log('[MSG91] Send OTP response:', data);

      if (data.type === 'error' || !response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      if (!data.request_id) {
        throw new Error('No request_id received from MSG91');
      }

      return {
        requestId: data.request_id,
        channel: channel,
        to: phoneNumber,
        status: 'pending',
      };
    } catch (error) {
      console.error('[MSG91] Error sending OTP:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to send OTP via MSG91'
      );
    }
  }

  /**
   * Verify OTP code
   * @param phoneNumber - Phone number in E.164 format
   * @param code - OTP code to verify
   */
  async verifyOTP(
    phoneNumber: string,
    code: string
  ): Promise<{ valid: boolean; status: string; to: string; channel: string }> {
    try {
      // Remove the + prefix from phone number for MSG91 API
      const mobile = phoneNumber.replace(/^\+/, '');

      const url = `${MSG91_BASE_URL}/verify?otp=${code}&mobile=${mobile}`;

      console.log('[MSG91] Verifying OTP for:', mobile);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authkey: this.authKey,
        },
      });

      const data: MSG91VerifyOTPResponse = await response.json();

      console.log('[MSG91] Verify OTP response:', data);

      const isValid = data.type === 'success';

      return {
        valid: isValid,
        status: isValid ? 'approved' : 'canceled',
        to: phoneNumber,
        channel: 'sms',
      };
    } catch (error) {
      console.error('[MSG91] Error verifying OTP:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to verify OTP via MSG91'
      );
    }
  }
}
