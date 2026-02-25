/**
 * Device Fingerprinting Library
 *
 * Uses FingerprintJS to generate a stable browser fingerprint for customer identification.
 * The fingerprint is hashed before being sent to the server for privacy.
 */

import FingerprintJS, { Agent } from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<Agent> | null = null;

/**
 * Get the device fingerprint (visitorId from FingerprintJS)
 * This is a stable identifier that persists across sessions on the same browser
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Device fingerprinting is only available in browser');
  }

  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }

  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}

/**
 * Hash the fingerprint for secure transmission to backend
 * Uses SHA-256 which is available in all modern browsers
 */
export async function hashFingerprint(fingerprint: string, tenantId: string): Promise<string> {
  const data = `${tenantId}:${fingerprint}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Parse browser name from user agent
 */
function getBrowser(ua: string): string {
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Browser';
}

/**
 * Parse OS name from user agent
 */
function getOS(ua: string): string {
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

/**
 * Get human-readable device info
 */
export function getDeviceInfo(): { name: string; type: 'mobile' | 'desktop' } {
  if (typeof window === 'undefined') {
    return { name: 'Server', type: 'desktop' };
  }

  const ua = navigator.userAgent;
  const browser = getBrowser(ua);
  const os = getOS(ua);
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);

  return {
    name: `${browser} on ${os}`,
    type: isMobile ? 'mobile' : 'desktop'
  };
}

/**
 * Get fingerprint hash ready for backend transmission
 */
export async function getDeviceFingerprintHash(tenantId: string): Promise<{
  hash: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop';
}> {
  const fingerprint = await getDeviceFingerprint();
  const hash = await hashFingerprint(fingerprint, tenantId);
  const deviceInfo = getDeviceInfo();

  return {
    hash,
    deviceName: deviceInfo.name,
    deviceType: deviceInfo.type
  };
}
