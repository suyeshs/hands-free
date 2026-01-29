export type OSType = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';
export type Architecture = 'arm64' | 'x64' | 'x86' | 'unknown';

export interface OSInfo {
  type: OSType;
  name: string;
  version?: string;
  architecture?: Architecture;
  isAppleSilicon?: boolean;
}

/**
 * Detects the operating system of the user's device
 * @returns The detected OS type
 */
export const detectOS = (): OSType => {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;

  // Check for mobile first
  if (/Android/i.test(userAgent)) {
    return 'android';
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'ios';
  }

  // Check desktop platforms
  if (/Win/i.test(platform)) {
    return 'windows';
  }

  if (/Mac/i.test(platform)) {
    return 'macos';
  }

  if (/Linux/i.test(platform)) {
    return 'linux';
  }

  return 'unknown';
};

/**
 * Detects the CPU architecture
 * @returns The detected architecture
 */
export const detectArchitecture = (): Architecture => {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const userAgent = window.navigator.userAgent;

  // Check for ARM64/Apple Silicon
  if (userAgent.includes('ARM64') || userAgent.includes('aarch64')) {
    return 'arm64';
  }

  // Check for x64
  if (userAgent.includes('x86_64') || userAgent.includes('Win64') || userAgent.includes('WOW64')) {
    return 'x64';
  }

  // Check for x86
  if (userAgent.includes('x86') || userAgent.includes('i686')) {
    return 'x86';
  }

  // Additional check for modern browsers
  // @ts-ignore - userAgentData is experimental
  if (window.navigator.userAgentData?.platform) {
    // @ts-ignore
    const platform = window.navigator.userAgentData.platform.toLowerCase();
    if (platform.includes('arm') || platform.includes('aarch64')) {
      return 'arm64';
    }
  }

  return 'unknown';
};

/**
 * Checks if the Mac is using Apple Silicon
 * @returns True if running on Apple Silicon
 */
export const isAppleSilicon = (): boolean => {
  if (detectOS() !== 'macos') {
    return false;
  }

  const arch = detectArchitecture();
  return arch === 'arm64';
};

/**
 * Gets detailed OS information including name and version
 * @returns Detailed OS information
 */
export const getOSInfo = (): OSInfo => {
  const osType = detectOS();
  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';

  const osInfo: OSInfo = {
    type: osType,
    name: getOSName(osType),
    architecture: detectArchitecture(),
  };

  // Add Apple Silicon detection for macOS
  if (osType === 'macos') {
    osInfo.isAppleSilicon = isAppleSilicon();
  }

  // Try to extract version information
  if (osType === 'android') {
    const match = userAgent.match(/Android\s+([\d.]+)/);
    if (match) {
      osInfo.version = match[1];
    }
  } else if (osType === 'ios') {
    const match = userAgent.match(/OS\s+([\d_]+)/);
    if (match) {
      osInfo.version = match[1].replace(/_/g, '.');
    }
  } else if (osType === 'windows') {
    if (userAgent.includes('Windows NT 10.0')) {
      osInfo.version = '10/11';
    } else if (userAgent.includes('Windows NT 6.3')) {
      osInfo.version = '8.1';
    } else if (userAgent.includes('Windows NT 6.2')) {
      osInfo.version = '8';
    } else if (userAgent.includes('Windows NT 6.1')) {
      osInfo.version = '7';
    }
  } else if (osType === 'macos') {
    const match = userAgent.match(/Mac OS X\s+([\d_]+)/);
    if (match) {
      osInfo.version = match[1].replace(/_/g, '.');
    }
  }

  return osInfo;
};

/**
 * Gets the human-readable name for an OS type
 * @param osType - The OS type
 * @returns The human-readable name
 */
export const getOSName = (osType: OSType): string => {
  const names: Record<OSType, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    android: 'Android',
    ios: 'iOS',
    unknown: 'Unknown',
  };

  return names[osType] || 'Unknown';
};

/**
 * Checks if the current OS matches a specific type
 * @param osType - The OS type to check against
 * @returns True if the current OS matches
 */
export const isOS = (osType: OSType): boolean => {
  return detectOS() === osType;
};

/**
 * Checks if the current device is mobile (Android or iOS)
 * @returns True if the device is mobile
 */
export const isMobile = (): boolean => {
  const os = detectOS();
  return os === 'android' || os === 'ios';
};

/**
 * Checks if the current device is desktop (Windows, macOS, or Linux)
 * @returns True if the device is desktop
 */
export const isDesktop = (): boolean => {
  const os = detectOS();
  return os === 'windows' || os === 'macos' || os === 'linux';
};
