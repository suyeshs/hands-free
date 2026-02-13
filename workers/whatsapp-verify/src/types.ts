/**
 * Types for WhatsApp Verify Worker
 */

export interface Env {
  // KV Namespace
  VERIFICATION_STORE: KVNamespace;

  // Meta API credentials (secrets)
  META_ACCESS_TOKEN: string;
  META_PHONE_NUMBER_ID: string;
  META_WABA_ID: string;
  AUTH_TEMPLATE_NAME: string;

  // Environment variables
  SERVICE_VERSION: string;
  VERIFICATION_CODE_LENGTH: string;
  VERIFICATION_EXPIRY_SECONDS: string;
  META_API_VERSION: string;
}

export interface StartVerificationRequest {
  to: string;
  locale?: string;
}

export interface StartVerificationResponse {
  success: boolean;
  verificationId?: string;
  to?: string;
  status?: string;
  message?: string;
  error?: string;
  expiresAt?: string;
}

export interface CheckVerificationRequest {
  to: string;
  code: string;
}

export interface CheckVerificationResponse {
  success: boolean;
  valid?: boolean;
  status?: 'pending' | 'approved' | 'expired' | 'max_attempts';
  to?: string;
  message?: string;
  error?: string;
}

export interface VerificationRecord {
  code: string;
  phone: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  messageId?: string;
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

export interface MetaMessageResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}
