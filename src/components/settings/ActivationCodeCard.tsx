/**
 * Activation Code Card
 * Displays the tenant's activation code for sharing with other devices/staff
 */

import { useState } from 'react';
import { Copy, Check, Key } from 'lucide-react';
import { useSetupWizardStore } from '../../stores/setupWizardStore';

export function ActivationCodeCard() {
  const activationCode = useSetupWizardStore((state) => state.activationCode);
  const [copied, setCopied] = useState(false);

  if (!activationCode) {
    return null; // Don't show card if no activation code available
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy activation code:', err);
    }
  };

  return (
    <div className="glass-panel-dark rounded-2xl p-6 border border-white/10">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-orange-500 to-amber-500">
          <Key className="w-6 h-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-2">Activation Code</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Use this code to activate additional POS terminals or share with staff
          </p>

          {/* Code Display */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-black/40 px-4 py-3 border border-white/10">
              <code className="text-orange-400 font-mono text-lg tracking-wider">
                {activationCode}
              </code>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"
              title="Copy activation code"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-zinc-400" />
                  <span className="text-sm text-zinc-300 font-medium">Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Warning */}
          <p className="text-xs text-amber-400/80 mt-3">
            ⚠️ Keep this code secure. Anyone with this code can access your restaurant's POS system.
          </p>
        </div>
      </div>
    </div>
  );
}
