/**
 * Phone Verification Library
 *
 * Client library for phone verification
 * DEV MODE: Uses MSG91/WhatsApp Verify worker with 4-digit bypass
 * PROD MODE: Uses MSG91, Twilio, or WhatsApp for real OTP
 */

// Verification provider selection
export type VerificationProvider = 'msg91' | 'whatsapp' | 'twilio';

// Default to MSG91 (can be overridden via env var)
const PROVIDER: VerificationProvider = (process.env.NEXT_PUBLIC_VERIFY_PROVIDER as VerificationProvider) || 'msg91';

// Provider-specific API URLs
const PROVIDER_URLS = {
  msg91: process.env.NEXT_PUBLIC_MSG91_VERIFY_URL || 'https://msg91-verify.handsfree.tech',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_VERIFY_URL || 'https://handsfree-whatsapp-verify-prod.suyesh.workers.dev',
  twilio: process.env.NEXT_PUBLIC_TWILIO_VERIFY_URL || 'https://twilio-verify.handsfree.tech',
};

const VERIFY_API_URL = PROVIDER_URLS[PROVIDER];

// DEV MODE: Accept 4-digit codes instead of 6-digit
const DEV_MODE = true;

export type VerificationChannel = 'sms' | 'whatsapp';

export interface StartVerificationRequest {
  to: string;
  channel: VerificationChannel;
  locale?: string;
}

export interface StartVerificationResponse {
  success: boolean;
  sid?: string;
  channel?: string;
  to?: string;
  status?: string;
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
  status?: string;
  to?: string;
  channel?: string;
  error?: string;
  code?: string;
}

export interface RateLimitResponse {
  success: boolean;
  allowed?: boolean;
  reason?: string;
  retryAfter?: number;
  attemptsRemaining?: {
    hourly: number;
    daily: number;
  };
  error?: string;
  code?: string;
}

export class PhoneVerificationError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'PhoneVerificationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Validate E.164 phone number format
 */
export function isValidE164PhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Format phone number to E.164 format
 * This is a simple formatter - in production you'd want to use libphonenumber-js
 */
export function formatToE164(phoneNumber: string, defaultCountryCode: string = '+1'): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');

  // If it already starts with country code
  if (phoneNumber.startsWith('+')) {
    return '+' + digits;
  }

  // If it's a US number without country code
  if (digits.length === 10) {
    return defaultCountryCode + digits;
  }

  // If it already has country code but no +
  if (digits.length === 11) {
    return '+' + digits;
  }

  return phoneNumber;
}

/**
 * Check rate limit for a phone number
 */
export async function checkRateLimit(phoneNumber: string): Promise<RateLimitResponse> {
  try {
    const encodedPhone = encodeURIComponent(phoneNumber);
    const response = await fetch(`${VERIFY_API_URL}/verify/rate-limit?phone=${encodedPhone}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as RateLimitResponse;

    if (!response.ok) {
      throw new PhoneVerificationError(
        data.error || 'Failed to check rate limit',
        data.code || 'RATE_LIMIT_CHECK_FAILED',
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof PhoneVerificationError) {
      throw error;
    }

    throw new PhoneVerificationError(
      'Network error checking rate limit',
      'NETWORK_ERROR',
      error
    );
  }
}

/**
 * Start phone verification
 * Sends a verification code via SMS or WhatsApp
 * In DEV MODE, no actual message is sent - any 4-digit code works
 */
export async function startVerification(
  phoneNumber: string,
  _channel: VerificationChannel = 'whatsapp',
  locale?: string
): Promise<StartVerificationResponse> {
  try {
    // Validate phone number format
    if (!isValidE164PhoneNumber(phoneNumber)) {
      throw new PhoneVerificationError(
        'Invalid phone number format. Must be in E.164 format (e.g., +14155551234)',
        'INVALID_PHONE_FORMAT'
      );
    }

    // In DEV MODE, skip rate limit check
    if (!DEV_MODE) {
      const rateLimit = await checkRateLimit(phoneNumber);
      if (!rateLimit.allowed) {
        throw new PhoneVerificationError(
          rateLimit.reason || 'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          { retryAfter: rateLimit.retryAfter }
        );
      }
    }

    const response = await fetch(`${VERIFY_API_URL}/verify/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        locale,
      }),
    });

    const data = await response.json() as StartVerificationResponse;

    if (!response.ok) {
      throw new PhoneVerificationError(
        data.error || 'Failed to start verification',
        data.code || 'VERIFICATION_START_FAILED',
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof PhoneVerificationError) {
      throw error;
    }

    throw new PhoneVerificationError(
      'Network error starting verification',
      'NETWORK_ERROR',
      error
    );
  }
}

/**
 * Check verification code
 * Validates the code sent to the user's phone
 * In DEV MODE, any 4-digit code is accepted
 */
export async function checkVerification(
  phoneNumber: string,
  code: string
): Promise<CheckVerificationResponse> {
  try {
    // Validate phone number format
    if (!isValidE164PhoneNumber(phoneNumber)) {
      throw new PhoneVerificationError(
        'Invalid phone number format. Must be in E.164 format (e.g., +14155551234)',
        'INVALID_PHONE_FORMAT'
      );
    }

    // Validate code format (4 digits in DEV MODE, 6 digits in production)
    const codePattern = DEV_MODE ? /^\d{4}$/ : /^\d{6}$/;
    const expectedDigits = DEV_MODE ? 4 : 6;
    if (!codePattern.test(code)) {
      throw new PhoneVerificationError(
        `Invalid verification code format. Must be ${expectedDigits} digits`,
        'INVALID_CODE_FORMAT'
      );
    }

    const response = await fetch(`${VERIFY_API_URL}/verify/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        code,
      }),
    });

    const data = await response.json() as CheckVerificationResponse;

    if (!response.ok) {
      throw new PhoneVerificationError(
        data.error || 'Failed to check verification',
        data.code || 'VERIFICATION_CHECK_FAILED',
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof PhoneVerificationError) {
      throw error;
    }

    throw new PhoneVerificationError(
      'Network error checking verification',
      'NETWORK_ERROR',
      error
    );
  }
}

/**
 * React hook for phone verification
 * Usage example in a component:
 *
 * ```tsx
 * const {
 *   sendCode,
 *   verifyCode,
 *   isLoading,
 *   error,
 *   isVerified
 * } = usePhoneVerification();
 * ```
 */
export function usePhoneVerification() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isVerified, setIsVerified] = React.useState(false);
  const [verificationSid, setVerificationSid] = React.useState<string | null>(null);

  const sendCode = async (phoneNumber: string, channel: VerificationChannel = 'sms') => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await startVerification(phoneNumber, channel);
      setVerificationSid(result.sid || null);
      return result;
    } catch (err) {
      const errorMessage = err instanceof PhoneVerificationError
        ? err.message
        : 'Failed to send verification code';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (phoneNumber: string, code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await checkVerification(phoneNumber, code);
      if (result.valid) {
        setIsVerified(true);
      } else {
        setError('Invalid verification code');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof PhoneVerificationError
        ? err.message
        : 'Failed to verify code';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setIsLoading(false);
    setError(null);
    setIsVerified(false);
    setVerificationSid(null);
  };

  return {
    sendCode,
    verifyCode,
    reset,
    isLoading,
    error,
    isVerified,
    verificationSid,
  };
}

// Need to import React for the hook
import React from 'react';
