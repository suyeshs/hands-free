/**
 * Device Authentication Service
 * Uses device biometrics (fingerprint, face ID) for secure authentication
 */

import { invoke } from '@tauri-apps/api/core';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  registered: boolean;
}

/**
 * Get device ID (unique identifier for this device)
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get from Tauri
    const deviceId = await invoke<string>('get_device_id');
    return deviceId;
  } catch (error) {
    console.warn('[DeviceAuth] Tauri get_device_id not available, generating fallback');
    // Fallback: generate from browser/device info
    const fallbackId = await generateFallbackDeviceId();
    return fallbackId;
  }
}

/**
 * Get device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  try {
    const deviceInfo = await invoke<DeviceInfo>('get_device_info');
    return deviceInfo;
  } catch (error) {
    console.warn('[DeviceAuth] Tauri get_device_info not available, using fallback');

    // Fallback device info
    const deviceId = await getDeviceId();
    return {
      deviceId,
      deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop',
      platform: navigator.platform,
      registered: false,
    };
  }
}

/**
 * Check if biometric authentication is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const available = await invoke<boolean>('is_biometric_available');
    return available;
  } catch (error) {
    console.warn('[DeviceAuth] Biometric check failed, assuming not available');
    return false;
  }
}

/**
 * Authenticate with biometrics
 * @returns true if authentication successful
 */
export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await invoke<boolean>('authenticate_with_biometric', {
      reason: 'Authenticate to access the app'
    });
    return result;
  } catch (error) {
    console.error('[DeviceAuth] Biometric authentication failed:', error);
    throw new Error('Biometric authentication failed');
  }
}

/**
 * Generate fallback device ID from browser fingerprint
 */
async function generateFallbackDeviceId(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '',
    screen.colorDepth.toString(),
    screen.width.toString() + 'x' + screen.height.toString(),
  ];

  const fingerprint = components.join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return 'device_' + Math.abs(hash).toString(36);
}

/**
 * Store device registration locally
 */
export function storeDeviceRegistration(deviceId: string, staffId: string, staffName: string): void {
  const registration = {
    deviceId,
    staffId,
    staffName,
    registeredAt: new Date().toISOString(),
  };

  localStorage.setItem('device_registration', JSON.stringify(registration));
}

/**
 * Get stored device registration
 */
export function getStoredDeviceRegistration(): {
  deviceId: string;
  staffId: string;
  staffName: string;
  registeredAt: string;
} | null {
  const stored = localStorage.getItem('device_registration');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear device registration
 */
export function clearDeviceRegistration(): void {
  localStorage.removeItem('device_registration');
}
