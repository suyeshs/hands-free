import { useState } from 'react';
import { managerLoginStart, managerLoginVerify, managerTotpVerify } from '../../services/tauriAuth';

interface ManagerLoginFormProps {
  onSuccess: () => void;
}

type LoginStep = 'phone' | 'code' | 'totp';

export function ManagerLoginForm({ onSuccess }: ManagerLoginFormProps) {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [verificationSid, setVerificationSid] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Manager Login] Starting verification for:', phone);
      const response = await managerLoginStart(phone);

      if (response.success && response.verificationSid) {
        setVerificationSid(response.verificationSid);
        setStep('code');
        console.log('[Manager Login] SMS code sent');
      } else {
        setError(response.error || 'Failed to send verification code');
      }
    } catch (err) {
      console.error('[Manager Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Manager Login] Verifying code...');
      const response = await managerLoginVerify(phone, code, verificationSid);
      console.log('[Manager Login] Verify response:', response);

      if (response.success) {
        if (response.requiresTotp && response.tempToken) {
          // TOTP required
          setTempToken(response.tempToken);
          setStep('totp');
          console.log('[Manager Login] TOTP required');
        } else {
          // Login successful
          console.log('[Manager Login] Login successful');
          onSuccess();
        }
      } else {
        console.log('[Manager Login] Verification failed:', response.error);
        setError(response.error || 'Invalid verification code');
      }
    } catch (err) {
      console.error('[Manager Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Manager Login] Verifying TOTP...');
      const response = await managerTotpVerify(totpCode, tempToken);

      if (response.success) {
        console.log('[Manager Login] TOTP verified, login successful');
        onSuccess();
      } else {
        setError(response.error || 'Invalid TOTP code');
      }
    } catch (err) {
      console.error('[Manager Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify TOTP');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 'totp') {
      setStep('code');
      setTotpCode('');
    } else if (step === 'code') {
      setStep('phone');
      setCode('');
      setVerificationSid('');
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Phone Step */}
      {step === 'phone' && (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter phone number with country code (e.g., +1 for US)
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !phone}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>

          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
            <p className="font-medium">Test Numbers (Bypass Mode)</p>
            <p className="text-xs mt-1">
              Use any +1 or +91 number with any 6-digit code (e.g., 123456)
            </p>
          </div>
        </form>
      )}

      {/* SMS Code Step */}
      {step === 'code' && (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-2xl tracking-widest"
              required
              disabled={loading}
              autoFocus
              maxLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the 6-digit code sent to {phone}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        </form>
      )}

      {/* TOTP Step */}
      {step === 'totp' && (
        <form onSubmit={handleVerifyTotp} className="space-y-4">
          <div>
            <label htmlFor="totp" className="block text-sm font-medium text-gray-700 mb-1">
              Authenticator Code
            </label>
            <input
              id="totp"
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-2xl tracking-widest"
              required
              disabled={loading}
              autoFocus
              maxLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify TOTP'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
