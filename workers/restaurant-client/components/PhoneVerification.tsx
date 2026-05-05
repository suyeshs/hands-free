'use client';

import React, { useState } from 'react';
import {
  startVerification,
  checkVerification,
  checkRateLimit,
  formatToE164,
  isValidE164PhoneNumber,
  PhoneVerificationError,
  type VerificationChannel,
} from '@/lib/phone-verification';

interface PhoneVerificationProps {
  onVerified: (phoneNumber: string) => void;
  onCancel?: () => void;
  defaultChannel?: VerificationChannel;
  title?: string;
  description?: string;
}

export function PhoneVerification({
  onVerified,
  onCancel,
  defaultChannel = 'sms',
  title = 'Verify Your Phone Number',
  description = 'We need to verify your phone number before activating your restaurant.',
}: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [channel, setChannel] = useState<VerificationChannel>(defaultChannel);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    attemptsRemaining?: { hourly: number; daily: number };
  } | null>(null);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhoneNumber(value);
    setError(null);

    // Auto-format to E.164 if it looks like a valid number
    if (value.length >= 10) {
      const formatted = formatToE164(value);
      if (formatted !== value && isValidE164PhoneNumber(formatted)) {
        setPhoneNumber(formatted);
      }
    }
  };

  const handleSendCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Format to E.164
      const formattedPhone = formatToE164(phoneNumber);

      // Validate format
      if (!isValidE164PhoneNumber(formattedPhone)) {
        throw new Error('Please enter a valid phone number with country code (e.g., +14155551234)');
      }

      // Check rate limit
      const rateLimitResult = await checkRateLimit(formattedPhone);
      setRateLimitInfo({
        attemptsRemaining: rateLimitResult.attemptsRemaining,
      });

      if (!rateLimitResult.allowed) {
        throw new Error(rateLimitResult.reason || 'Rate limit exceeded. Please try again later.');
      }

      // Start verification
      await startVerification(formattedPhone, channel);

      // Move to code entry step
      setPhoneNumber(formattedPhone); // Use formatted version
      setStep('code');
    } catch (err) {
      const errorMessage = err instanceof PhoneVerificationError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Failed to send verification code';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await checkVerification(phoneNumber, code);

      if (result.valid) {
        onVerified(phoneNumber);
      } else {
        throw new Error('Invalid verification code. Please try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof PhoneVerificationError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Failed to verify code';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCode('');
    setError(null);
    await handleSendCode();
  };

  const handleBack = () => {
    setStep('phone');
    setCode('');
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2 text-gray-900">{title}</h2>
      <p className="text-gray-600 mb-6">{description}</p>

      {step === 'phone' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="+1 (415) 555-1234"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verification Method
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="sms"
                  checked={channel === 'sms'}
                  onChange={(e) => setChannel(e.target.value as VerificationChannel)}
                  className="mr-2"
                  disabled={isLoading}
                />
                <span className="text-gray-700">SMS</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="whatsapp"
                  checked={channel === 'whatsapp'}
                  onChange={(e) => setChannel(e.target.value as VerificationChannel)}
                  className="mr-2"
                  disabled={isLoading}
                />
                <span className="text-gray-700">WhatsApp</span>
              </label>
            </div>
          </div>

          {rateLimitInfo?.attemptsRemaining && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              Attempts remaining: {rateLimitInfo.attemptsRemaining.hourly}/hour, {rateLimitInfo.attemptsRemaining.daily}/day
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSendCode}
              disabled={isLoading || !phoneNumber}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Sending...' : `Send Code via ${channel === 'sms' ? 'SMS' : 'WhatsApp'}`}
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-800">
              We sent a 6-digit code to <strong>{phoneNumber}</strong> via {channel === 'sms' ? 'SMS' : 'WhatsApp'}.
            </p>
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
                setError(null);
              }}
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest text-gray-900"
              disabled={isLoading}
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500 text-center">
              Enter the 6-digit code
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleVerifyCode}
              disabled={isLoading || code.length !== 6}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <button
              onClick={handleResendCode}
              disabled={isLoading}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Resend Code
            </button>
            <button
              onClick={handleBack}
              disabled={isLoading}
              className="block w-full text-sm text-gray-600 hover:text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Change Phone Number
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhoneVerification;
