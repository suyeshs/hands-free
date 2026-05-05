'use client';

/**
 * TOTP Setup Component
 * Displays QR code for scanning with authenticator app
 * Shows backup codes for account recovery
 * Handles verification of first TOTP code
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface TOTPSetupData {
  qrCode: string;
  secret: string;
  backupCodes: string[];
  otpauthUrl: string;
}

interface TOTPSetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function TOTPSetup({ onComplete, onSkip }: TOTPSetupProps) {
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'initialize' | 'scan' | 'verify'>('initialize');
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);

  // Initialize TOTP setup
  useEffect(() => {
    if (step === 'initialize') {
      initializeTOTPSetup();
    }
  }, [step]);

  const initializeTOTPSetup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/admin/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json() as any;

      if (response.ok && data.success) {
        setSetupData(data.data);
        setStep('scan');
      } else {
        setError(data.error || 'Failed to initialize TOTP setup');
      }
    } catch (err) {
      console.error('TOTP setup error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/admin/totp/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await response.json() as any;

      if (response.ok && data.success) {
        // TOTP enabled successfully!
        onComplete();
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch (err) {
      console.error('TOTP verification error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const text = `Handsfree Admin - Backup Codes\n\nSave these codes in a secure place. Each code can only be used once.\n\n${setupData.backupCodes.map((code, i) => `${i + 1}. ${code.slice(0, 4)}-${code.slice(4)}`).join('\n')}\n\nGenerated: ${new Date().toLocaleString()}`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'handsfree-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setBackupCodesSaved(true);
  };

  const copyBackupCodes = () => {
    if (!setupData) return;

    const text = setupData.backupCodes.map((code, i) => `${i + 1}. ${code.slice(0, 4)}-${code.slice(4)}`).join('\n');
    navigator.clipboard.writeText(text);
    setBackupCodesSaved(true);
  };

  if (step === 'initialize' || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
        <p className="text-gray-600">Initializing 2FA setup...</p>
      </div>
    );
  }

  if (!setupData) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 mb-4">{error || 'Failed to load setup data'}</p>
        <button
          onClick={() => setStep('initialize')}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">
        Set Up Two-Factor Authentication
      </h2>
      <p className="text-gray-600 mb-6">
        Protect your account with an authenticator app
      </p>

      {/* Step 1: Scan QR Code */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
            1
          </span>
          Scan QR Code
        </h3>

        <p className="text-gray-600 mb-4">
          Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan this QR code:
        </p>

        <div className="flex justify-center mb-4">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            {setupData.qrCode && (
              <Image
                src={setupData.qrCode}
                alt="TOTP QR Code"
                width={300}
                height={300}
                className="rounded"
              />
            )}
          </div>
        </div>

        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">
            Can't scan? Enter manually
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded border">
            <p className="font-mono text-xs break-all">{setupData.secret}</p>
          </div>
        </details>
      </div>

      {/* Step 2: Save Backup Codes */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
            2
          </span>
          Save Backup Codes
        </h3>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> Save these backup codes in a secure place. You can use them to access your account if you lose your phone.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 p-4 bg-gray-50 rounded border font-mono text-sm">
          {setupData.backupCodes.map((code, index) => (
            <div key={index} className="p-2">
              {index + 1}. {code.slice(0, 4)}-{code.slice(4)}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={downloadBackupCodes}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
          >
            Download
          </button>
          <button
            onClick={copyBackupCodes}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
          >
            Copy
          </button>
        </div>

        {backupCodesSaved && (
          <p className="text-green-600 text-sm mt-2 text-center">
            ✓ Backup codes saved
          </p>
        )}
      </div>

      {/* Step 3: Verify */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
            3
          </span>
          Verify Setup
        </h3>

        <p className="text-gray-600 mb-4">
          Enter the 6-digit code from your authenticator app to complete setup:
        </p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              maxLength={6}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || verificationCode.length !== 6}
            className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
          >
            {isLoading ? 'Verifying...' : 'Complete Setup'}
          </button>
        </form>

        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full mt-3 px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
