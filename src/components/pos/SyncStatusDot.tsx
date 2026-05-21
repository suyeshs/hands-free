import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { orderSyncService } from '../../lib/orderSyncService';
import { useOnlineOrderStore } from '../../stores/onlineOrderStore';
import { cn } from '../../lib/utils';

interface SyncStatusDotProps {
  className?: string;
}

export function SyncStatusDot({ className }: SyncStatusDotProps) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [path, setPath] = useState<'cloud' | 'lan' | 'both' | 'none'>('none');

  const pendingOnlineOrders = useOnlineOrderStore((s) => {
    const cutoff = Date.now() - 8 * 60 * 60 * 1000;
    return s.orders.filter((o) => o.status === 'pending' && new Date(o.createdAt).getTime() >= cutoff).length;
  });

  useEffect(() => {
    const update = () => {
      setStatus(orderSyncService.getConnectionStatus());
      setPath(orderSyncService.getActiveSyncPath());
    };
    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, []);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  const pathLabel = path === 'both' ? 'Cloud+LAN' : path === 'cloud' ? 'Cloud' : path === 'lan' ? 'LAN' : null;

  const tooltip = isConnected
    ? `Online sync active${pathLabel ? ` via ${pathLabel}` : ''}${pendingOnlineOrders > 0 ? ` · ${pendingOnlineOrders} pending web order${pendingOnlineOrders > 1 ? 's' : ''}` : ''}`
    : isConnecting
    ? 'Connecting to sync service...'
    : 'Offline — web orders will not arrive';

  return (
    <div
      title={tooltip}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-colors select-none',
        isConnected
          ? 'text-emerald-500'
          : isConnecting
          ? 'text-amber-500'
          : 'text-red-500',
        className
      )}
    >
      {isConnecting ? (
        <RefreshCw size={13} className="animate-spin" />
      ) : isConnected ? (
        <Wifi size={13} />
      ) : (
        <WifiOff size={13} />
      )}

      <span>
        {isConnected ? 'LIVE' : isConnecting ? 'SYNC…' : 'OFFLINE'}
      </span>

      {/* Pending web orders badge */}
      {pendingOnlineOrders > 0 && (
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
          {pendingOnlineOrders}
        </span>
      )}
    </div>
  );
}
