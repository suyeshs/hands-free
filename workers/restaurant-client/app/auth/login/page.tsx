'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminAuth } from '@/components/auth/AuthProvider';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession } = useAdminAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'totp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [verificationSid, setVerificationSid] = useState('');
  const [tempAccessToken, setTempAccessToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get tenant ID from subdomain or query param
  useState(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');

      // Extract from subdomain (e.g., khao-piyo-7766.handsfree.tech)
      if (!hostname.includes('localhost') && parts.length >= 3) {
        setTenantId(parts[0]);
      } else {
        // Fallback to query param or default
        setTenantId(searchParams.get('tenant') || 'demo');
      }
    }
  });

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Call auth worker instead of local API route
      const response = await fetch('https://auth.handsfree.tech/auth/login/start', {
        method: 'POST',
        credentials: 'include', // Important: Send/receive cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          tenantId: tenantId
        })
      });

      const data = await response.json() as any;

      if (response.ok && data.success) {
        setVerificationSid(data.verificationSid);
        setStep('otp');
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('[Login] Send code error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    console.log('[Login] Starting verification...', { phone, code, tenantId, verificationSid });

    try {
      // Call auth worker instead of local API route
      const response = await fetch('https://auth.handsfree.tech/auth/login/verify', {
        method: 'POST',
        credentials: 'include', // Important: Send/receive cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          code,
          tenantId: tenantId,
          verificationSid
        })
      });

      console.log('[Login] Response status:', response.status);
      console.log('[Login] Response ok:', response.ok);

      const data = await response.json() as any;
      console.log('[Login] Response data:', data);

      if (response.ok && data.success) {
        // Check if TOTP is required
        if (data.totpRequired) {
          console.log('[Login] TOTP required, showing 2FA step');
          // Store temp token for TOTP verification
          setTempAccessToken(data.tempAccessToken);
          setStep('totp');
        } else {
          console.log('[Login] Verification successful, cookies set by auth worker');
          // Auth worker has set httpOnly cookies - refresh session to update local state
          await refreshSession();
          console.log('[Login] Redirecting to /admin');
          // Successfully logged in, redirect to admin dashboard
          router.push('/admin');
        }
      } else {
        console.error('[Login] Verification failed:', data);
        setError(data.error || 'Invalid verification code');
      }
    } catch (err) {
      console.error('[Login] Verify code error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    console.log('[Login] Verifying TOTP...');

    try {
      // Call auth worker instead of local API route
      const response = await fetch('https://auth.handsfree.tech/auth/totp/verify', {
        method: 'POST',
        credentials: 'include', // Important: Send/receive cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: totpCode,
          isBackupCode: useBackupCode,
          tempAccessToken: tempAccessToken, // Send temp token from SMS verification
        }),
      });

      const data = await response.json() as any;
      console.log('[Login] TOTP response:', data);

      if (response.ok && data.success) {
        console.log('[Login] TOTP verified, cookies set by auth worker');
        // Auth worker has set httpOnly cookies - refresh session to update local state
        await refreshSession();
        console.log('[Login] Redirecting to /admin');
        // Navigate to admin dashboard
        router.push('/admin');
      } else {
        console.error('[Login] TOTP verification failed:', data);
        setError(data.error || 'Invalid verification code');
      }
    } catch (err) {
      console.error('[Login] TOTP verify error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCode('');
    setError(null);
    setStep('phone');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-orange-500 rounded-full flex items-center justify-center">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Admin Login
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {step === 'phone' && 'Enter your phone number to receive a verification code'}
            {step === 'otp' && 'Enter the 6-digit code sent to your phone'}
            {step === 'totp' && 'Enter the code from your authenticator app'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Phone Input Form */}
        {step === 'phone' && (
          <form onSubmit={handleSendCode} className="mt-8 space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={isLoading}
                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-gray-500">
                Enter your phone number in international format (e.g., +14155551234)
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !phone}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>
        )}

        {/* OTP Input Form */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyCode} className="mt-8 space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                disabled={isLoading}
                autoFocus
                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-gray-500 text-center">
                Code sent to {phone}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Verify & Login'
                )}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="w-full text-center py-2 px-4 text-sm text-orange-600 hover:text-orange-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Didn't receive code? Try again
              </button>
            </div>
          </form>
        )}

        {/* TOTP Input Form */}
        {step === 'totp' && (
          <form onSubmit={handleVerifyTOTP} className="mt-8 space-y-6">
            <div>
              <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700 mb-2">
                {useBackupCode ? 'Backup Code' : 'Authenticator Code'}
              </label>
              <input
                id="totpCode"
                name="totpCode"
                type="text"
                required
                maxLength={useBackupCode ? 9 : 6}
                value={totpCode}
                onChange={(e) => {
                  if (useBackupCode) {
                    // Allow alphanumeric + dash for backup codes
                    setTotpCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                  } else {
                    // Only digits for TOTP
                    setTotpCode(e.target.value.replace(/\D/g, ''));
                  }
                }}
                placeholder={useBackupCode ? 'XXXX-XXXX' : '123456'}
                disabled={isLoading}
                autoFocus
                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-gray-500 text-center">
                {useBackupCode
                  ? 'Enter one of your backup codes'
                  : 'Open your authenticator app for the code'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading || (!useBackupCode && totpCode.length !== 6) || (useBackupCode && totpCode.length < 8)}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Verify & Login'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setTotpCode('');
                  setError(null);
                }}
                disabled={isLoading}
                className="w-full text-center py-2 px-4 text-sm text-orange-600 hover:text-orange-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {useBackupCode ? 'Use authenticator code instead' : 'Use backup code'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8">
          <p>Secure authentication powered by Twilio Verify</p>
        </div>
      </div>
    </div>
  );
}
