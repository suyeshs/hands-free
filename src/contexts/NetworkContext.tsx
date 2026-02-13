/**
 * NetworkContext
 * Tracks WiFi network status and determines if user is on restaurant WiFi
 * Used for enforcing network-based access controls (Staff APK only)
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { buildConfig } from '../config/buildConfig';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { isTauri } from '../lib/platform';

interface NetworkContextType {
  isOnRestaurantWiFi: boolean;
  currentSSID: string | null;
  isChecking: boolean;
  lastChecked: Date | null;
  wifiCheckEnabled: boolean;
  allowedSSIDs: string[];
  refreshNetworkStatus: () => Promise<void>;
  onWiFiConnected: (callback: () => void) => () => void; // Subscribe to WiFi connection events, returns unsubscribe function
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [isOnRestaurantWiFi, setIsOnRestaurantWiFi] = useState(false);
  const [previousWiFiStatus, setPreviousWiFiStatus] = useState(false);
  const [currentSSID, setCurrentSSID] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [wifiConnectedCallbacks, setWifiConnectedCallbacks] = useState<Array<() => void>>([]);
  const { settings } = useRestaurantSettingsStore();

  // Get WiFi settings from restaurant settings - memoized to prevent unnecessary re-renders
  const wifiCheckEnabled = useMemo(() => settings?.wifi_check_enabled === 1, [settings?.wifi_check_enabled]);
  const allowedSSIDs = useMemo(
    () => settings?.restaurant_wifi_ssid
      ? settings.restaurant_wifi_ssid.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : [],
    [settings?.restaurant_wifi_ssid]
  );

  // Check network status - memoized to prevent infinite loops
  const refreshNetworkStatus = useCallback(async () => {
    // If not in Tauri (web mode), skip WiFi detection entirely
    if (!isTauri()) {
      setIsOnRestaurantWiFi(true); // Web - always allow
      setCurrentSSID(null);
      return;
    }

    // Skip WiFi checking if not configured yet (no allowed SSIDs)
    if (!wifiCheckEnabled || allowedSSIDs.length === 0) {
      setIsOnRestaurantWiFi(true); // Always allow if WiFi check not configured
      setCurrentSSID(null);
      return;
    }

    setIsChecking(true);

    try {
      // Get current WiFi SSID from Tauri
      const networkInfo = await invoke<{ ssid: string | null; is_connected: boolean }>('get_current_wifi_ssid');

      setCurrentSSID(networkInfo.ssid);
      setLastChecked(new Date());

      // Owner build: always allow access
      if (!buildConfig.isStaffBuild) {
        setIsOnRestaurantWiFi(true);
        return;
      }

      // Staff build with WiFi check enabled: enforce access control
      if (!networkInfo.is_connected || !networkInfo.ssid) {
        setIsOnRestaurantWiFi(false);
        return;
      }

      // Check if current SSID matches any allowed SSID
      const isAllowed = allowedSSIDs.some(allowed => allowed === networkInfo.ssid);
      setIsOnRestaurantWiFi(isAllowed);
    } catch (error) {
      // Silently fail - allow access on error until WiFi is configured
      console.warn('[NetworkContext] WiFi check failed (allowing access):', error);
      setIsOnRestaurantWiFi(true); // Allow access on error
      setCurrentSSID(null);
    } finally {
      setIsChecking(false);
    }
  }, [wifiCheckEnabled, allowedSSIDs]); // Dependencies for useCallback

  // Check network status on mount and every 30 seconds
  useEffect(() => {
    // Only run WiFi check if we're in Tauri environment
    if (!isTauri()) {
      return;
    }

    refreshNetworkStatus();

    const interval = setInterval(() => {
      refreshNetworkStatus();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - refreshNetworkStatus is stable due to useCallback

  // Detect WiFi connection transitions (disconnected → connected)
  useEffect(() => {
    if (isOnRestaurantWiFi && !previousWiFiStatus) {
      // TRANSITION DETECTED: Just connected to restaurant WiFi
      console.log('[NetworkContext] WiFi connected - triggering callbacks');
      wifiConnectedCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('[NetworkContext] WiFi connected callback error:', error);
        }
      });
    }
    setPreviousWiFiStatus(isOnRestaurantWiFi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnRestaurantWiFi]); // Only trigger on WiFi status changes, not callback/previous status changes

  // Subscribe to WiFi connection events - memoized to prevent context value changes
  const onWiFiConnected = useCallback((callback: () => void) => {
    setWifiConnectedCallbacks(prev => [...prev, callback]);

    // Return unsubscribe function
    return () => {
      setWifiConnectedCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  }, []); // No dependencies needed as we use functional state updates

  const value: NetworkContextType = {
    isOnRestaurantWiFi,
    currentSSID,
    isChecking,
    lastChecked,
    wifiCheckEnabled,
    allowedSSIDs,
    refreshNetworkStatus,
    onWiFiConnected,
  };

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

/**
 * Hook to check if sensitive feature should be enabled
 * Returns true if:
 * - Owner build (no restrictions)
 * - WiFi check disabled in settings
 * - On allowed restaurant WiFi
 */
export function useSensitiveFeatureAccess(): boolean {
  const { isOnRestaurantWiFi, wifiCheckEnabled } = useNetwork();

  // Owner build - always allow
  if (!buildConfig.isStaffBuild) {
    return true;
  }

  // WiFi check disabled - allow
  if (!wifiCheckEnabled) {
    return true;
  }

  // Staff build with WiFi check enabled - only allow on restaurant WiFi
  return isOnRestaurantWiFi;
}
