import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';
import { whatsappApi } from '../../lib/whatsappApi';

interface Props {
  pollIntervalMs?: number;
  onClick?: () => void;
}

/**
 * Floating WhatsApp unread-count badge.
 *
 * Designed to be mounted once at the app-shell level, gated on the
 * whatsapp-business plugin being installed+enabled. Polls the conversations
 * endpoint at a configurable interval (default 30s) and shows a small toast
 * with the total unread count. Clicking it fires `onClick` which the host can
 * wire to open the WhatsApp Settings → Inbox tab.
 */
export function WhatsAppNotificationWidget({
  pollIntervalMs = 30_000,
  onClick,
}: Props) {
  const tenantId = useTenantStore((s) => s.getTenantId()) || '';
  const [unread, setUnread] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!tenantId || !available) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const rows = await whatsappApi.listConversations(tenantId);
        if (cancelled) return;
        const total = rows.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
        setUnread(total);
      } catch {
        // Silently fall back to "backend unavailable" — widget hides itself.
        if (!cancelled) setAvailable(false);
      }
    };

    tick();
    const id = window.setInterval(tick, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tenantId, pollIntervalMs, available]);

  if (!available || dismissed || unread === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg bg-green-600 text-white text-sm hover:bg-green-700 transition-colors"
    >
      <MessageCircle className="w-4 h-4" />
      <span>
        {unread} new {unread === 1 ? 'message' : 'messages'}
      </span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="ml-1 p-0.5 hover:bg-white/20 rounded-full"
      >
        <X className="w-3 h-3" />
      </span>
    </button>
  );
}

export default WhatsAppNotificationWidget;
