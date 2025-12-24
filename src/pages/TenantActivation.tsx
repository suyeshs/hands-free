/**
 * Tenant Activation Screen
 * First screen shown when POS app is launched without an activated tenant
 */

import { useState, useRef, useEffect } from 'react';
import { useTenantStore } from '../stores/tenantStore';

interface TenantActivationProps {
  onActivated: () => void;
}

export function TenantActivation({ onActivated }: TenantActivationProps) {
  const { activateTenant, isActivating, activationError, setActivationError } = useTenantStore();

  // 8 character code split into 2 groups of 4
  const [codeSegments, setCodeSegments] = useState(['', '']);
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Focus first input on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    // Only allow alphanumeric characters
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

    const newSegments = [...codeSegments];
    newSegments[index] = sanitized;
    setCodeSegments(newSegments);
    setActivationError(null);

    // Auto-focus next input when current is full
    if (sanitized.length === 4 && index < inputRefs.length - 1) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && codeSegments[index] === '' && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    // Submit on Enter if code is complete
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (pasted.length >= 8) {
      setCodeSegments([pasted.slice(0, 4), pasted.slice(4, 8)]);
      inputRefs[1].current?.focus();
    } else if (pasted.length >= 4) {
      setCodeSegments([pasted.slice(0, 4), pasted.slice(4, 8) || '']);
      if (pasted.length > 4) {
        inputRefs[1].current?.focus();
      }
    } else {
      setCodeSegments([pasted, '']);
    }
    setActivationError(null);
  };

  const getFullCode = () => codeSegments.join('');
  const isCodeComplete = () => getFullCode().length === 8;

  const handleSubmit = async () => {
    if (!isCodeComplete()) {
      setActivationError('Please enter the complete 8-character code');
      return;
    }

    const code = `${codeSegments[0]}-${codeSegments[1]}`;
    const success = await activateTenant(code);

    if (success) {
      onActivated();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider mb-2">
            HandsFree POS
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your activation code to get started
          </p>
        </div>

        {/* Activation Form */}
        <div className="glass-panel rounded-2xl border border-border p-8">
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Activation Code
            </label>

            {/* Code Input */}
            <div className="flex items-center justify-center gap-3">
              {codeSegments.map((segment, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    ref={inputRefs[index]}
                    type="text"
                    value={segment}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-24 h-14 text-center text-2xl font-mono font-bold uppercase bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                    maxLength={4}
                    placeholder="XXXX"
                    disabled={isActivating}
                  />
                  {index < codeSegments.length - 1 && (
                    <span className="text-2xl text-muted-foreground font-bold">-</span>
                  )}
                </div>
              ))}
            </div>

            {/* Error Message */}
            {activationError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                <p className="text-red-400 text-sm">{activationError}</p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isActivating || !isCodeComplete()}
            className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest text-sm shadow-lg shadow-accent/20 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3"
          >
            {isActivating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Activating...
              </>
            ) : (
              'Activate POS'
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground text-xs">
            Don't have an activation code?{' '}
            <a
              href="https://handsfree.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>

        {/* Version */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground/50 text-xs">
            HandsFree POS v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}

export default TenantActivation;
