/**
 * Passcode Dialog Component
 * Simple passcode entry dialog for protecting sensitive operations
 */

import { useState, useEffect, useRef } from 'react';
import { Lock, X } from 'lucide-react';

interface PasscodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  passcode?: string; // Default: "6163"
}

export function PasscodeDialog({
  isOpen,
  onClose,
  onSuccess,
  title = "Enter Passcode",
  description = "Enter the passcode to continue",
  passcode = "6163"
}: PasscodeDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setError('');
      // Focus input after a brief delay to ensure dialog is rendered
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputValue === passcode) {
      setError('');
      onSuccess();
      setInputValue('');
    } else {
      setError('Incorrect passcode. Please try again.');
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel rounded-2xl border border-border shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/20 flex items-center justify-center">
              <Lock size={20} className="text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Passcode Input */}
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">
              Passcode
            </label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter 4-digit passcode"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
            />
            {error && (
              <p className="mt-2 text-sm text-red-400 font-medium">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white text-sm font-bold transition-colors shadow-lg shadow-accent/20"
            >
              Unlock
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="px-6 pb-6 pt-0">
          <p className="text-xs text-muted-foreground text-center">
            Contact your administrator if you don't know the passcode
          </p>
        </div>
      </div>
    </div>
  );
}
