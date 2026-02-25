'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDeviceFingerprintHash } from '@/lib/device-fingerprint';
import {
  getVerifiedCustomer,
  setVerifiedCustomer,
  clearVerifiedCustomer
} from '@/lib/verified-customer';
import { getCustomerHashFromUrl, clearRefFromUrl } from '@/lib/url-customer-context';
import {
  startVerification,
  checkVerification,
  formatToE164,
  type VerificationChannel
} from '@/lib/phone-verification';

export type VerificationState =
  | 'loading'
  | 'verified'
  | 'needs_phone'
  | 'needs_otp'
  | 'error';

export interface CustomerInfo {
  id?: string;
  phone: string;
  name?: string;
  email?: string;
}

interface UseCustomerVerificationResult {
  state: VerificationState;
  customer: CustomerInfo | null;
  phone: string;
  error: string | null;
  isLoading: boolean;

  // Actions
  setPhone: (phone: string) => void;
  startOTP: (channel?: VerificationChannel) => Promise<void>;
  verifyOTP: (code: string) => Promise<boolean>;
  setCustomerDetails: (name: string, email?: string) => void;
  reset: () => void;
  skipVerification: (customerInfo: CustomerInfo) => void;
}

/**
 * Get the customer verification API URL for a tenant
 * Customer endpoints (verify-device, by-fingerprint, etc.) are on the handsfree-restaurant worker.
 * In the browser, use the current origin so requests stay on the same tenant domain
 * (e.g. coorg-food-company-6943.handsfree.tech) and avoid CORS issues.
 */
function getCustomerApiUrl(_tenantId: string): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';
}

/**
 * Hook for managing customer verification flow
 *
 * Flow:
 * 1. Check URL for customer hash (referral link)
 * 2. Check device fingerprint for returning customer
 * 3. If not found, collect phone and verify via OTP
 * 4. Store verified customer in localStorage and backend
 */
export function useCustomerVerification(
  tenantId: string,
  _backendUrl?: string // Deprecated - customer endpoints now use Cloudflare Workers URL
): UseCustomerVerificationResult {
  // Customer verification endpoints are on Cloudflare Workers, not the legacy backend
  const backendUrl = getCustomerApiUrl(tenantId);
  const [state, setState] = useState<VerificationState>('loading');
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [phone, setPhone] = useState('');
  const [e164Phone, setE164Phone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fingerprintHash, setFingerprintHash] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>('Unknown device');
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');

  // Initialize verification on mount
  useEffect(() => {
    initializeVerification();
  }, [tenantId]);

  const initializeVerification = async () => {
    try {
      setState('loading');
      setError(null);

      // 1. Get device fingerprint first
      const fpResult = await getDeviceFingerprintHash(tenantId);
      setFingerprintHash(fpResult.hash);
      setDeviceName(fpResult.deviceName);
      setDeviceType(fpResult.deviceType);

      // 2. Check URL for customer hash (referral link)
      const urlHash = getCustomerHashFromUrl();
      if (urlHash) {
        const urlCustomer = await lookupByPhoneHash(urlHash);
        if (urlCustomer) {
          setCustomer(urlCustomer);
          setState('verified');
          clearRefFromUrl();
          return;
        }
      }

      // 3. Check localStorage for verified customer on this device
      const verified = getVerifiedCustomer(tenantId);
      if (verified && verified.fingerprintHash === fpResult.hash) {
        // Verify with backend that this device is still trusted
        const serverCustomer = await lookupByFingerprint(fpResult.hash);
        if (serverCustomer) {
          setCustomer(serverCustomer);
          setState('verified');
          return;
        } else {
          // Device trust expired or removed, clear local storage
          clearVerifiedCustomer();
        }
      }

      // 4. New device - needs phone verification
      setState('needs_phone');
    } catch (err) {
      console.error('[useCustomerVerification] Initialization error:', err);
      setError('Failed to initialize verification');
      setState('needs_phone'); // Fallback to phone entry
    }
  };

  const lookupByFingerprint = async (hash: string): Promise<CustomerInfo | null> => {
    try {
      const response = await fetch(
        `${backendUrl}/api/customers/by-fingerprint?hash=${encodeURIComponent(hash)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId,
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json() as { success: boolean; customer: CustomerInfo | null };
      return data.customer;
    } catch (err) {
      console.error('[useCustomerVerification] Fingerprint lookup error:', err);
      return null;
    }
  };

  const lookupByPhoneHash = async (hash: string): Promise<CustomerInfo | null> => {
    try {
      const response = await fetch(
        `${backendUrl}/api/customers/by-phone-hash?hash=${encodeURIComponent(hash)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId,
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json() as { success: boolean; customer: CustomerInfo | null };
      return data.customer;
    } catch (err) {
      console.error('[useCustomerVerification] Phone hash lookup error:', err);
      return null;
    }
  };

  /**
   * Lookup customer by phone number (E.164 format)
   * Used for auto-login when phone number already exists in database
   */
  const lookupByPhone = async (phoneNumber: string): Promise<CustomerInfo | null> => {
    try {
      const response = await fetch(
        `${backendUrl}/api/customers/phone/${encodeURIComponent(phoneNumber)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId,
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json() as { success: boolean; customer: CustomerInfo | null };
      return data.customer;
    } catch (err) {
      console.error('[useCustomerVerification] Phone lookup error:', err);
      return null;
    }
  };

  const registerDevice = async (
    phoneNumber: string,
    customerName?: string,
    customerEmail?: string
  ): Promise<CustomerInfo> => {
    if (!fingerprintHash) {
      throw new Error('Fingerprint not available');
    }

    const response = await fetch(`${backendUrl}/api/customers/verify-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({
        phone: phoneNumber,
        name: customerName,
        email: customerEmail,
        fingerprintHash,
        deviceName,
        deviceType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error: string };
      throw new Error(errorData.error || 'Failed to register device');
    }

    const data = await response.json() as { success: boolean; customer: CustomerInfo };
    return data.customer;
  };

  const startOTP = useCallback(async (channel: VerificationChannel = 'sms') => {
    setIsLoading(true);
    setError(null);

    try {
      // Format phone to E.164
      const formatted = formatToE164(phone, '+91');
      setE164Phone(formatted);

      // Check if customer already exists in database - auto-login if found
      const existingCustomer = await lookupByPhone(formatted);
      if (existingCustomer) {
        console.log('[useCustomerVerification] Existing customer found, auto-logging in');

        // Register this device for the existing customer (no OTP needed)
        const registeredCustomer = await registerDevice(
          formatted,
          existingCustomer.name,
          existingCustomer.email
        );

        // Store in localStorage for future visits
        setVerifiedCustomer({
          fingerprintHash: fingerprintHash!,
          phone: formatted,
          name: existingCustomer.name,
          email: existingCustomer.email,
          tenantId,
          verifiedAt: Date.now(),
        });

        setCustomer(registeredCustomer);
        setState('verified');
        return;
      }

      // Customer not found - proceed with OTP verification
      await startVerification(formatted, channel);
      setState('needs_otp');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [phone, fingerprintHash, tenantId]);

  const verifyOTP = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await checkVerification(e164Phone, code);

      if (result.valid) {
        // Register device with customer
        const registeredCustomer = await registerDevice(e164Phone, name, email);

        // Store in localStorage for future visits
        setVerifiedCustomer({
          fingerprintHash: fingerprintHash!,
          phone: e164Phone,
          name: name || undefined,
          email: email || undefined,
          tenantId,
          verifiedAt: Date.now(),
        });

        setCustomer(registeredCustomer);
        setState('verified');
        return true;
      } else {
        setError('Invalid verification code');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [e164Phone, name, email, fingerprintHash, tenantId]);

  const setCustomerDetails = useCallback((customerName: string, customerEmail?: string) => {
    setName(customerName);
    if (customerEmail) setEmail(customerEmail);
  }, []);

  const reset = useCallback(() => {
    setState('needs_phone');
    setCustomer(null);
    setPhone('');
    setE164Phone('');
    setName('');
    setEmail('');
    setError(null);
    setIsLoading(false);
  }, []);

  // Skip verification (for testing or when verification is optional)
  const skipVerification = useCallback((customerInfo: CustomerInfo) => {
    setCustomer(customerInfo);
    setState('verified');
  }, []);

  return {
    state,
    customer,
    phone,
    error,
    isLoading,
    setPhone,
    startOTP,
    verifyOTP,
    setCustomerDetails,
    reset,
    skipVerification,
  };
}
