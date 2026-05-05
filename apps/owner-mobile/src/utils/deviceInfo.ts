/**
 * Device Information Utilities
 * Generate unique device ID and fingerprint
 */

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  deviceOs: string;
  deviceFingerprint: string;
}

// Generate SHA-256 hash
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get or create device ID (stored in localStorage)
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }

  return deviceId;
}

// Get device model/name
export function getDeviceModel(): string {
  const ua = navigator.userAgent;

  // Try to extract device model from user agent
  // Android
  if (/Android/.test(ua)) {
    const match = ua.match(/Android.*?;\s*([^)]+)\)/);
    if (match) return match[1];
  }

  // iPhone
  if (/iPhone/.test(ua)) {
    const match = ua.match(/iPhone\s*(\w+)/);
    return match ? `iPhone ${match[1]}` : 'iPhone';
  }

  // iPad
  if (/iPad/.test(ua)) {
    return 'iPad';
  }

  return 'Unknown Device';
}

// Get device name (user-friendly)
export function getDeviceName(): string {
  const model = getDeviceModel();
  const os = getDeviceOS();

  return `${model} (${os})`;
}

// Get OS version
export function getDeviceOS(): string {
  const ua = navigator.userAgent;

  // Android
  if (/Android/.test(ua)) {
    const match = ua.match(/Android\s+([\d.]+)/);
    return match ? `Android ${match[1]}` : 'Android';
  }

  // iOS
  if (/iPhone|iPad/.test(ua)) {
    const match = ua.match(/OS\s+([\d_]+)/);
    if (match) {
      const version = match[1].replace(/_/g, '.');
      return `iOS ${version}`;
    }
    return 'iOS';
  }

  // Windows
  if (/Windows/.test(ua)) {
    return 'Windows';
  }

  // macOS
  if (/Mac OS/.test(ua)) {
    const match = ua.match(/Mac OS X\s+([\d_]+)/);
    if (match) {
      const version = match[1].replace(/_/g, '.');
      return `macOS ${version}`;
    }
    return 'macOS';
  }

  return 'Unknown OS';
}

// Generate device fingerprint (hardware-based)
export async function generateDeviceFingerprint(): Promise<string> {
  const components = [];

  // User agent
  components.push(navigator.userAgent);

  // Screen resolution
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language);

  // Platform
  components.push(navigator.platform);

  // Hardware concurrency (CPU cores)
  components.push((navigator.hardwareConcurrency || 0).toString());

  // Device memory (if available)
  if ('deviceMemory' in navigator) {
    components.push((navigator as any).deviceMemory.toString());
  }

  // Canvas fingerprint (more unique)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('handsfree', 2, 15);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    // Canvas fingerprinting blocked
  }

  // Combine all components and hash
  const fingerprint = components.join('|');
  return await sha256(fingerprint);
}

// Get complete device info
export async function getDeviceInfo(): Promise<DeviceInfo> {
  return {
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    deviceModel: getDeviceModel(),
    deviceOs: getDeviceOS(),
    deviceFingerprint: await generateDeviceFingerprint(),
  };
}
