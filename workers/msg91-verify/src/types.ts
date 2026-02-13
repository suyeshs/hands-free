/**
 * Type definitions for MSG91 Verify Worker
 */

export interface Env {
  // Environment variables
  MSG91_AUTH_KEY: string;
  MSG91_TEMPLATE_ID: string;
  SERVICE_VERSION?: string;

  // KV for rate limiting
  VERIFY_RATE_LIMIT: KVNamespace;
}

export type VerificationChannel = 'sms' | 'whatsapp';

export interface StartVerificationRequest {
  to: string;
  channel?: VerificationChannel;
  locale?: string;
}

export interface StartVerificationResponse {
  success: boolean;
  verificationSid?: string;
  requestId?: string;
  channel?: VerificationChannel;
  to?: string;
  status?: string;
  message?: string;
  error?: string;
  code?: string;
}

export interface CheckVerificationRequest {
  to: string;
  code: string;
}

export interface CheckVerificationResponse {
  success: boolean;
  valid?: boolean;
  status?: 'pending' | 'approved' | 'canceled' | 'max_attempts_reached';
  to?: string;
  channel?: VerificationChannel;
  message?: string;
  error?: string;
  code?: string;
}

export interface MSG91SendOTPRequest {
  mobile: string;
  template_id: string;
  otp_expiry?: number;
  otp_length?: number;
  realTimeResponse: 1;
}

export interface MSG91SendOTPResponse {
  type: 'success' | 'error';
  request_id?: string;
  message?: string;
}

export interface MSG91VerifyOTPResponse {
  type: 'success' | 'error';
  message: string;
  code?: string;
}

export interface RateLimitInfo {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  attemptsRemaining?: {
    hourly: number;
    daily: number;
  };
}
