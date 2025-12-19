/**
 * WebSocket/Polling Connection Manager
 * Manages real-time order sync using WebSocket or HTTP polling fallback
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { posWebSocketClient } from '../lib/posWebSocketClient';
import { orderPollingService } from '../lib/orderPollingService';

// Disable polling/WebSocket for now (order endpoints not yet implemented on HandsFree API)
const USE_POLLING = false;
const DISABLE_ORDER_SYNC = true;

export function WebSocketManager() {
  const { user } = useAuthStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    // Temporarily disabled until order endpoints are implemented
    if (DISABLE_ORDER_SYNC) {
      console.log('[ConnectionManager] Order sync disabled (endpoints not implemented)');
      setConnectionStatus('disconnected');
      return;
    }

    if (!user?.tenantId) {
      console.log('[ConnectionManager] No tenantId, stopping sync');
      if (USE_POLLING) {
        orderPollingService.stop();
      } else {
        posWebSocketClient.disconnect();
      }
      setConnectionStatus('disconnected');
      return;
    }

    if (USE_POLLING) {
      // Use HTTP polling for order notifications
      console.log('[ConnectionManager] Starting order polling for tenant:', user.tenantId);
      setConnectionStatus('connected'); // Polling is always "connected"

      orderPollingService.start(user.tenantId, { soundEnabled: true });

      // Cleanup on unmount
      return () => {
        console.log('[ConnectionManager] Unmounting, stopping polling');
        orderPollingService.stop();
        setConnectionStatus('disconnected');
      };
    } else {
      // Use WebSocket
      console.log('[ConnectionManager] Connecting to WebSocket for tenant:', user.tenantId);
      setConnectionStatus('connecting');

      posWebSocketClient.connect(user.tenantId, {
        onConnect: () => {
          console.log('[ConnectionManager] Connected');
          setConnectionStatus('connected');
        },
        onDisconnect: () => {
          console.log('[ConnectionManager] Disconnected');
          setConnectionStatus('disconnected');
        },
        onError: (error) => {
          console.error('[ConnectionManager] Error:', error);
        },
      });

      // Cleanup on unmount
      return () => {
        console.log('[ConnectionManager] Unmounting, disconnecting');
        posWebSocketClient.disconnect();
        setConnectionStatus('disconnected');
      };
    }
  }, [user?.tenantId]);

  // Optional: Show connection status indicator in development
  if (import.meta.env.DEV) {
    const mode = USE_POLLING ? 'POLLING' : 'WS';
    const queuedCount = USE_POLLING ? 0 : posWebSocketClient.getQueuedMessageCount();

    return (
      <div
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 9999,
          backgroundColor:
            connectionStatus === 'connected'
              ? '#10b981'
              : connectionStatus === 'connecting'
              ? '#f59e0b'
              : '#6b7280',
          color: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        {mode}: {connectionStatus.toUpperCase()}
        {queuedCount > 0 && ` (${queuedCount} queued)`}
      </div>
    );
  }

  return null;
}
