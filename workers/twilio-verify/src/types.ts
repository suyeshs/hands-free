/**
 * Twilio Verify Worker Types
 * Types for verification service supporting SMS and WhatsApp
 */

export interface Env {
  // Twilio credentials
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_API_KEY_SID?: string;
  TWILIO_API_KEY_SECRET?: string;
  TWILIO_VERIFY_SERVICE_SID: string;

  // KV namespace for rate limiting
  VERIFICATION_ATTEMPTS: KVNamespace;

  // Configuration
  SERVICE_VERSION: string;
  VERIFICATION_CODE_LENGTH: string;
  VERIFICATION_EXPIRY_SECONDS: string;
}

export type VerificationChannel = 'sms' | 'whatsapp';

export interface StartVerificationRequest {
  to: string; // Phone number in E.164 format (e.g., +14155551234)
  channel: VerificationChannel;
  locale?: string; // Optional locale for verification message (e.g., 'en', 'es')
}

export interface StartVerificationResponse {
  success: boolean;
  verificationSid?: string;
  channel?: VerificationChannel;
  to?: string;
  status?: string;
  message?: string;
  error?: string;
}

export interface CheckVerificationRequest {
  to: string; // Phone number in E.164 format
  code: string; // Verification code entered by user
}

export interface CheckVerificationResponse {
  success: boolean;
  status?: 'pending' | 'approved' | 'canceled' | 'max_attempts_reached';
  valid?: boolean;
  to?: string;
  channel?: VerificationChannel;
  message?: string;
  error?: string;
}

export interface TwilioVerifyResponse {
  sid: string;
  service_sid: string;
  account_sid: string;
  to: string;
  channel: string;
  status: string;
  valid: boolean;
  lookup?: {
    carrier?: {
      mobile_country_code?: string;
      type?: string;
      error_code?: string | null;
      mobile_network_code?: string;
      name?: string;
    };
  };
  amount?: string | null;
  payee?: string | null;
  date_created: string;
  date_updated: string;
  url: string;
}

export interface TwilioErrorResponse {
  code: number;
  message: string;
  more_info: string;
  status: number;
}

export interface RateLimitInfo {
  attempts: number;
  lastAttempt: number;
  blocked: boolean;
  blockedUntil?: number;
}
