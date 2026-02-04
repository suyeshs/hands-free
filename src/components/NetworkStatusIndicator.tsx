/**
 * NetworkStatusIndicator
 * Visual indicator showing:
 * - WiFi connection status (Staff APK)
 * - WebSocket/Real-time sales connection status (Owner devices)
 */

import { Wifi, WifiOff, RefreshCw, Radio, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import { buildConfig } from '../config/buildConfig';
import { useDeviceStore } from '../stores/deviceStore';
import { orderSyncService } from '../lib/orderSyncService';
import { cn } from '../lib/utils';

interface NetworkStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function NetworkStatusIndicator({ className, showLabel = true }: NetworkStatusIndicatorProps) {
  const { isOnRestaurantWiFi, currentSSID, isChecking, wifiCheckEnabled, refreshNetworkStatus } = useNetwork();
  const { shouldReceiveRealtimeSales } = useDeviceStore();

  // WebSocket connection status for owner devices
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [wsPath, setWsPath] = useState<'cloud' | 'lan' | 'both' | 'none'>('none');

  const isOwnerDevice = shouldReceiveRealtimeSales();

  // Poll WebSocket status for owner devices
  useEffect(() => {
    if (!isOwnerDevice) return;

    const updateWsStatus = () => {
      const status = orderSyncService.getConnectionStatus();
      const path = orderSyncService.getActiveSyncPath();
      setWsStatus(status);
      setWsPath(path);
    };

    // Initial update
    updateWsStatus();

    // Poll every 2 seconds
    const interval = setInterval(updateWsStatus, 2000);

    return () => clearInterval(interval);
  }, [isOwnerDevice]);

  // Determine what to show
  const showWiFiStatus = buildConfig.isStaffBuild && wifiCheckEnabled;
  const showWebSocketStatus = isOwnerDevice;

  // Hide if nothing to show
  if (!showWiFiStatus && !showWebSocketStatus) {
    return null;
  }

  // For owner devices, show WebSocket status
  if (showWebSocketStatus && !showWiFiStatus) {
    const isConnected = wsStatus === 'connected';
    const isConnecting = wsStatus === 'connecting';

    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
          isConnected
            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
            : isConnecting
            ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
            : 'bg-red-500/10 text-red-700 dark:text-red-400',
          className
        )}
        title={
          isConnected
            ? `Real-time sales updates active via ${wsPath === 'both' ? 'Cloud + LAN' : wsPath === 'cloud' ? 'Cloud' : wsPath === 'lan' ? 'LAN' : 'Unknown'}`
            : isConnecting
            ? 'Connecting to real-time updates...'
            : 'Disconnected - real-time updates unavailable'
        }
      >
        {isConnecting ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : isConnected ? (
          <Radio className="w-4 h-4 animate-pulse" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}

        {showLabel && (
          <span className="font-medium">
            {isConnected ? (
              <>
                <span className="text-green-600 dark:text-green-400">LIVE</span>
                {wsPath !== 'none' && <span className="text-xs ml-1 opacity-70">({wsPath})</span>}
              </>
            ) : isConnecting ? (
              'Connecting...'
            ) : (
              'Offline'
            )}
          </span>
        )}
      </div>
    );
  }

  // For staff devices, show WiFi status
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
        isOnRestaurantWiFi
          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
          : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
        className
      )}
      title={
        isOnRestaurantWiFi
          ? `Connected to ${currentSSID || 'restaurant WiFi'}`
          : 'Not on restaurant WiFi - some features restricted'
      }
    >
      {isChecking ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : isOnRestaurantWiFi ? (
        <Wifi className="w-4 h-4" />
      ) : (
        <WifiOff className="w-4 h-4" />
      )}

      {showLabel && (
        <span className="font-medium">
          {isOnRestaurantWiFi ? 'On Restaurant Network' : 'Off-Site'}
        </span>
      )}

      {/* Refresh button */}
      <button
        onClick={refreshNetworkStatus}
        className="ml-1 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        title="Refresh network status"
        disabled={isChecking}
      >
        <RefreshCw className={cn('w-3 h-3', isChecking && 'animate-spin')} />
      </button>
    </div>
  );
}

/**
 * Compact version for header/status bar
 */
export function NetworkStatusBadge({ className }: { className?: string }) {
  return <NetworkStatusIndicator className={className} showLabel={false} />;
}
