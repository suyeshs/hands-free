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
    <div className="glass-panel-dark rounded-2xl p-5 border border-white/10">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
          <Key className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-base font-bold text-white mb-1">Activation Code</h3>
          <p className="text-sm text-zinc-400 mb-3">
            Share this code with staff to activate additional devices
          </p>

          {/* Code Display */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black/40 px-3 py-2.5 border border-white/10 rounded">
              <code className="text-orange-400 font-mono text-base tracking-wide">
                {activationCode}
              </code>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="px-3 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded flex items-center gap-2"
              title="Copy activation code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-400" />
              )}
            </button>
          </div>

          {/* Info */}
          <p className="text-xs text-zinc-500 mt-2">
            Keep this code secure - it grants access to your POS system
          </p>
        </div>
      </div>
    </div>
  );
}
