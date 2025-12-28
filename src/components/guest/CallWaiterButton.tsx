/**
 * Call Waiter Button
 * Floating action button for guests to request waiter assistance
 */

import { useState, useEffect } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { sendServiceRequest } from '../../lib/guestOrderApi';
import { SERVICE_REQUEST_COOLDOWN_MS } from '../../types/guest-order';

interface CallWaiterButtonProps {
  tenantId: string;
  tableId: string;
}

export function CallWaiterButton({ tenantId, tableId }: CallWaiterButtonProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'cooldown'>('idle');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Handle cooldown timer
  useEffect(() => {
    if (status !== 'cooldown') return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          setStatus('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const handleCallWaiter = async () => {
    if (status !== 'idle') return;

    setStatus('sending');
    setError(null);

    try {
      await sendServiceRequest(tenantId, tableId, 'call_waiter');

      setStatus('sent');

      // Show success state briefly, then start cooldown
      setTimeout(() => {
        setStatus('cooldown');
        setCooldownRemaining(Math.ceil(SERVICE_REQUEST_COOLDOWN_MS / 1000));
      }, 2000);
    } catch (err) {
      console.error('[CallWaiterButton] Failed to send request:', err);
      setError(err instanceof Error ? err.message : 'Failed to call waiter');
      setStatus('idle');

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className="fixed bottom-20 left-4 z-40">
      <button
        onClick={handleCallWaiter}
        disabled={status !== 'idle'}
        className={`
          flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all
          ${
            status === 'idle'
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              : status === 'sending'
              ? 'bg-blue-500 text-white cursor-wait'
              : status === 'sent'
              ? 'bg-green-500 text-white'
              : 'bg-gray-400 text-white cursor-not-allowed'
          }
        `}
      >
        {status === 'idle' && (
          <>
            <Bell className="w-5 h-5" />
            <span className="font-medium">Call Waiter</span>
          </>
        )}
        {status === 'sending' && (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Calling...</span>
          </>
        )}
        {status === 'sent' && (
          <>
            <Check className="w-5 h-5" />
            <span>Waiter Notified!</span>
          </>
        )}
        {status === 'cooldown' && (
          <>
            <Bell className="w-5 h-5" />
            <span>Wait {cooldownRemaining}s</span>
          </>
        )}
      </button>

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
