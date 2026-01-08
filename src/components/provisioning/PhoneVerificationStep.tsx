/**
 * Phone Verification Step
 * First step in provisioning - verify phone number via SMS
 */

import { useState, useRef, useEffect } from 'react';
import { useProvisioningStore } from '../../stores/provisioningStore';
import { useTenantStore } from '../../stores/tenantStore';
import { WizardNavigation } from './WizardNavigation';

type VerificationStep = 'phone' | 'code';

// Get admin panel URL from env
const ADMIN_PANEL_URL = import.meta.env.VITE_ADMIN_PANEL_URL || 'https://handsfree-admin.pages.dev';

export function PhoneVerificationStep() {
  const { markStepComplete, setVerifiedPhone, nextStep } = useProvisioningStore();
  const { tenant } = useTenantStore();

  const [step, setStep] = useState<VerificationStep>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationSid, setVerificationSid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const codeInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Focus phone input on mount
  useEffect(() => {
    if (step === 'phone') {
      phoneInputRef.current?.focus();
    }
  }, [step]);

  // Focus first code input when entering code step
  useEffect(() => {
    if (step === 'code') {
      codeInputRefs[0].current?.focus();
    }
  }, [step]);

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      console.log('[PhoneVerification] Sending verification code to:', phone);

      // Format phone number (ensure it starts with +)
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

      // DEV MODE: Skip API call and go directly to code entry
      if (import.meta.env.DEV) {
        console.log('[PhoneVerification] DEV MODE: Bypassing API call');
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate loading
        setVerificationSid('dev-mode-bypass');
        setStep('code');
        setLoading(false);
        return;
      }

      // Call the provisioning API to send verification code
      const response = await fetch(`${ADMIN_PANEL_URL}/api/provisioning/verify-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formattedPhone,
          tenantId: tenant?.tenantId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send verification code');
      }

      console.log('[PhoneVerification] Code sent successfully');
      setVerificationSid(result.verificationSid);
      setStep('code');
    } catch (err) {
      console.error('[PhoneVerification] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      console.log('[PhoneVerification] Verifying code...');

      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

      // DEV MODE: Accept any 6-digit code (or specifically 123456)
      if (import.meta.env.DEV) {
        console.log('[PhoneVerification] DEV MODE: Bypassing verification');
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate loading

        // In dev mode, accept any 6-digit code
        console.log('[PhoneVerification] DEV MODE: Verification successful');
        setVerifiedPhone(formattedPhone, 'dev-mode-bypass');
        markStepComplete('phone_verification');
        nextStep();
        return;
      }

      // Call the provisioning API to verify code
      const response = await fetch(`${ADMIN_PANEL_URL}/api/provisioning/confirm-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formattedPhone,
          code,
          verificationSid,
          tenantId: tenant?.tenantId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Invalid verification code');
      }

      console.log('[PhoneVerification] Verification successful');
      setVerifiedPhone(formattedPhone, verificationSid);
      markStepComplete('phone_verification');
      nextStep();
    } catch (err) {
      console.error('[PhoneVerification] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    // Update code string
    const newCode = code.split('');
    newCode[index] = digit;
    setCode(newCode.join(''));

    // Auto-focus next input
    if (digit && index < 5) {
      codeInputRefs[index + 1].current?.focus();
    }

    // Clear error on input
    if (error) setError('');
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      codeInputRefs[index - 1].current?.focus();
    } else if (e.key === 'Enter' && code.length === 6) {
      handleVerifyCode();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setCode(pasted);
    if (pasted.length === 6) {
      codeInputRefs[5].current?.focus();
    } else if (pasted.length > 0) {
      codeInputRefs[pasted.length - 1].current?.focus();
    }
  };

  const handleBack = () => {
    setStep('phone');
    setCode('');
    setError('');
  };

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">{step === 'phone' ? '📱' : '🔐'}</span>
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          {step === 'phone' ? 'Verify Your Phone' : 'Enter Verification Code'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {step === 'phone'
            ? "We'll send a verification code to confirm your identity"
            : `Enter the 6-digit code sent to ${phone}`}
        </p>
      </div>

      {/* Phone Input Step */}
      {step === 'phone' && (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Phone Number
            </label>
            <input
              ref={phoneInputRef}
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendCode();
              }}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter your phone number with country code (e.g., +1 for US, +91 for India)
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <WizardNavigation
            onNext={handleSendCode}
            canGoNext={phone.trim().length > 0}
            nextLabel="Send Code"
            isLoading={loading}
            hideBack
          />
        </div>
      )}

      {/* Code Input Step */}
      {step === 'code' && (
        <div className="space-y-6">
          {/* Code inputs */}
          <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                ref={codeInputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={code[index] || ''}
                onChange={(e) => handleCodeInput(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-mono font-bold bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                disabled={loading}
              />
            ))}
          </div>

          {/* Resend option */}
          <div className="text-center">
            <button
              onClick={handleSendCode}
              disabled={loading}
              className="text-accent text-sm hover:underline disabled:opacity-50"
            >
              Didn't receive the code? Resend
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <WizardNavigation
            onBack={handleBack}
            onNext={handleVerifyCode}
            canGoNext={code.length === 6}
            nextLabel="Verify"
            isLoading={loading}
          />
        </div>
      )}

      {/* Dev mode bypass hint */}
      {import.meta.env.DEV && (
        <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-blue-400 text-xs text-center">
            <strong>Dev Mode:</strong> Use any phone number with code 123456 to bypass verification
          </p>
        </div>
      )}
    </div>
  );
}

export default PhoneVerificationStep;
