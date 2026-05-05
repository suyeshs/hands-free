/**
 * Activation Code Input Component
 * Used by location managers to activate their device with a code
 */

import { useState, useRef, useEffect } from 'react';
import { MapPin, ArrowRight, AlertCircle, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatActivationCode, isValidActivationCodeFormat } from '../../lib/activationCode';

interface ActivationCodeInputProps {
  onActivate: (code: string) => Promise<void>;
  onBack?: () => void;
}

export function ActivationCodeInput({ onActivate, onBack }: ActivationCodeInputProps) {
  const [code, setCode] = useState('');
  const [formattedCode, setFormattedCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (value: string) => {
    setCode(value);
    setError(null);

    // Auto-format as user types
    const formatted = formatActivationCode(value);
    setFormattedCode(formatted);
  };

  const handleActivate = async () => {
    const finalCode = formattedCode.toUpperCase().trim();

    // Validate format
    if (!isValidActivationCodeFormat(finalCode)) {
      setError('Invalid code format. Expected: XXXX-XXXX-9999');
      return;
    }

    setIsActivating(true);
    setError(null);
    setProgress([]);

    try {
      // Progress updates
      setProgress(['✓ Validating activation code...']);
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(prev => [...prev, '✓ Retrieving location metadata...']);
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(prev => [...prev, '⏳ Configuring device...']);

      // Call the activation handler (will invoke Rust commands)
      await onActivate(finalCode);

      setProgress(prev => [...prev.filter(p => !p.includes('⏳')), '✓ Configuration complete!']);
      setProgress(prev => [...prev, '⏳ Syncing menu from master...']);

      // Success handled by parent component (will navigate to POS)

    } catch (err) {
      console.error('[Activation] Failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Parse error messages for better UX
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setError('Activation code not found. Please check the code and try again.');
      } else if (errorMessage.includes('already used') || errorMessage.includes('used_at')) {
        setError('This activation code has already been used. Please contact your administrator for a new code.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(errorMessage);
      }

      setProgress([]);
    } finally {
      setIsActivating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && formattedCode.length === 14 && !isActivating) {
      handleActivate();
    }
  };

  const isValidFormat = formattedCode.length === 14 && isValidActivationCodeFormat(formattedCode);

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <MapPin size={40} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Activate Location</h1>
          <p className="text-muted-foreground">
            Enter the activation code provided by your master location to set up this device
          </p>
        </div>
      </div>

      {/* Input Card */}
      <div className="neo-raised bg-card p-8 rounded-2xl space-y-6">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Activation Code
          </label>
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="XXXX-XXXX-9999"
            maxLength={14}
            disabled={isActivating}
            className={cn(
              "w-full px-6 py-4 text-center text-2xl font-mono font-bold tracking-wider uppercase",
              "bg-surface-1 border-2 rounded-xl transition-all",
              "focus:outline-none focus:ring-4 focus:ring-primary/20",
              error
                ? "border-destructive"
                : isValidFormat
                ? "border-success"
                : "border-border",
              isActivating && "opacity-50 cursor-not-allowed"
            )}
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Format: XXXX-XXXX-9999 (hyphens optional)
          </p>
        </div>

        {/* Formatted Preview */}
        {formattedCode && formattedCode !== code && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Formatted as:</p>
            <p className="text-lg font-mono font-semibold text-foreground">{formattedCode}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="status-error p-4 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">Activation Failed</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        {progress.length > 0 && (
          <div className="space-y-2">
            {progress.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-sm text-foreground animate-fade-in"
              >
                {step.includes('⏳') ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <Check size={16} className="text-success" />
                )}
                <span>{step.replace('✓ ', '').replace('⏳ ', '')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {onBack && (
            <button
              onClick={onBack}
              disabled={isActivating}
              className="flex-1 px-6 py-3 bg-surface-3 hover:bg-surface-2 text-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
          )}
          <button
            onClick={handleActivate}
            disabled={!isValidFormat || isActivating}
            className={cn(
              "flex-1 px-6 py-3 font-semibold rounded-lg transition-all",
              "flex items-center justify-center gap-2",
              isValidFormat && !isActivating
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg"
                : "bg-surface-3 text-muted-foreground cursor-not-allowed"
            )}
          >
            {isActivating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Activating...
              </>
            ) : (
              <>
                Activate Location
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="status-info p-4 rounded-xl text-center">
        <p className="text-sm">
          <strong>Need help?</strong> Contact your master location administrator if you don't have
          an activation code or if you encounter any issues.
        </p>
      </div>
    </div>
  );
}
