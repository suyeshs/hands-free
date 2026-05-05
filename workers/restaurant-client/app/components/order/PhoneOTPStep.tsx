'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MessageSquare, Smartphone, Loader2 } from 'lucide-react';

interface PhoneOTPStepProps {
  phone: string;
  onVerify: (code: string) => Promise<boolean>;
  onBack: () => void;
  onResend: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// DEV MODE: Use 4-digit codes instead of 6-digit
const CODE_LENGTH = 4;

export function PhoneOTPStep({
  phone,
  onVerify,
  onBack,
  onResend,
  isLoading,
  error
}: PhoneOTPStepProps) {
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        onVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);

    if (pastedData.length === CODE_LENGTH) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[CODE_LENGTH - 1]?.focus();
      onVerify(pastedData);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      await onResend();
      setResendCooldown(30);
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = () => {
    const fullCode = code.join('');
    if (fullCode.length === CODE_LENGTH) {
      onVerify(fullCode);
    }
  };

  // Mask phone number for display (show last 4 digits)
  const maskedPhone = phone.length > 4
    ? `${phone.slice(0, -4).replace(/./g, '*')}${phone.slice(-4)}`
    : phone;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-2xl font-light neu-text tracking-tight">Verify Phone</h2>
        </div>
        <p className="text-sm neu-text-secondary opacity-60">
          Enter any {CODE_LENGTH}-digit code to verify
        </p>
      </div>

      {/* OTP Input */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="flex justify-center gap-3 my-8" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className={`
                w-12 h-14 text-center text-2xl font-semibold
                bg-white/60 backdrop-blur-sm rounded-xl border-2
                ${error ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}
                focus:border-orange-400 focus:ring-2 focus:ring-orange-100
                transition-all outline-none disabled:opacity-50
              `}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/60 backdrop-blur-sm rounded-xl p-4 border border-red-200/50 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Resend Option */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-2">Didn't receive the code?</p>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || isResending}
            className={`
              flex items-center gap-2 mx-auto text-sm font-medium
              ${resendCooldown > 0 || isResending
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-orange-600 hover:text-orange-700'}
              transition-colors
            `}
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : resendCooldown > 0 ? (
              <>Resend in {resendCooldown}s</>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                Resend Code
              </>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="bg-green-50/60 backdrop-blur-sm rounded-xl p-4 border border-green-200/50">
          <p className="text-sm text-green-700">
            DEV MODE: Enter any {CODE_LENGTH}-digit code (e.g., 1234) to continue.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200/50">
        <button
          onClick={handleSubmit}
          disabled={code.join('').length !== CODE_LENGTH || isLoading}
          className={`
            w-full font-semibold py-4 rounded-xl shadow-lg transition-all
            flex items-center justify-center gap-2
            ${code.join('').length === CODE_LENGTH && !isLoading
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white hover:shadow-xl'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </button>
      </div>
    </div>
  );
}
