/**
 * Twilio Verify API Client
 * Handles communication with Twilio Verify API v2
 */

import type {
  Env,
  VerificationChannel,
  TwilioVerifyResponse,
  TwilioErrorResponse,
} from './types';
import { TwilioTokenClient } from './token-client';

export class TwilioVerifyClient {
  private accountSid?: string;
  private authToken?: string;
  private apiKeySid?: string;
  private apiKeySecret?: string;
  private serviceSid?: string;
  private baseUrl?: string;
  private tokenClient: TwilioTokenClient;
  private initialized: boolean = false;

  constructor(env: Env) {
    // Initialize token client
    this.tokenClient = new TwilioTokenClient();

    // Legacy: Fall back to environment variables if token manager is not available
    if (env.TWILIO_VERIFY_SERVICE_SID) {
      this.accountSid = env.TWILIO_ACCOUNT_SID;
      this.authToken = env.TWILIO_AUTH_TOKEN;
      this.apiKeySid = env.TWILIO_API_KEY_SID;
      this.apiKeySecret = env.TWILIO_API_KEY_SECRET;
      this.serviceSid = env.TWILIO_VERIFY_SERVICE_SID;
      this.baseUrl = `https://verify.twilio.com/v2/Services/${this.serviceSid}`;
      this.initialized = true;
    }
  }

  /**
   * Initialize credentials from Token Manager
   * Called lazily on first API call
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Fetch credentials from Token Manager
      this.serviceSid = await this.tokenClient.getVerifyServiceSid();
      this.accountSid = await this.tokenClient.getAccountSid();
      this.apiKeySid = await this.tokenClient.getApiKeySid();
      this.apiKeySecret = await this.tokenClient.getApiKeySecret();
      this.baseUrl = `https://verify.twilio.com/v2/Services/${this.serviceSid}`;
      this.initialized = true;

      console.log('[Twilio Client] Initialized with credentials from Token Manager');
    } catch (error) {
      console.error('[Twilio Client] Failed to initialize from Token Manager:', error);
      throw new Error('Failed to load Twilio credentials from Token Manager');
    }
  }

  /**
   * Get authorization header for Twilio API
   * Uses API Key if available, otherwise uses Account SID + Auth Token
   */
  private getAuthHeader(): string {
    if (this.apiKeySid && this.apiKeySecret) {
      // Use API Key authentication (recommended for production)
      const credentials = btoa(`${this.apiKeySid}:${this.apiKeySecret}`);
      return `Basic ${credentials}`;
    } else {
      // Use Account SID + Auth Token authentication
      const credentials = btoa(`${this.accountSid}:${this.authToken}`);
      return `Basic ${credentials}`;
    }
  }

  /**
   * Start a verification
   * Sends verification code via SMS or WhatsApp
   */
  async startVerification(
    to: string,
    channel: VerificationChannel,
    locale?: string
  ): Promise<TwilioVerifyResponse> {
    await this.initialize();
    const url = `${this.baseUrl}/Verifications`;

    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('Channel', channel);
    if (locale) {
      formData.append('Locale', locale);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as TwilioErrorResponse).message || 'Twilio API error');
    }

    return data as TwilioVerifyResponse;
  }

  /**
   * Check a verification code
   * Verifies the code entered by the user
   */
  async checkVerification(
    to: string,
    code: string
  ): Promise<TwilioVerifyResponse> {
    await this.initialize();
    const url = `${this.baseUrl}/VerificationCheck`;

    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('Code', code);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as TwilioErrorResponse).message || 'Twilio API error');
    }

    return data as TwilioVerifyResponse;
  }

  /**
   * Cancel a pending verification
   */
  async cancelVerification(sid: string): Promise<TwilioVerifyResponse> {
    await this.initialize();
    const url = `${this.baseUrl}/Verifications/${sid}`;

    const formData = new URLSearchParams();
    formData.append('Status', 'canceled');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as TwilioErrorResponse).message || 'Twilio API error');
    }

    return data as TwilioVerifyResponse;
  }
}
