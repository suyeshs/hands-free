/**
 * Platform Detection Utilities
 * Determines whether the app is running in Tauri (desktop) or Web mode
 */

export type Platform = 'web' | 'tauri';

/**
 * Check if the app is running on a specific platform
 * @param platform - The platform to check ('web' or 'tauri')
 * @returns true if running on the specified platform
 */
export function isPlatform(platform: Platform): boolean {
  const currentPlatform = getCurrentPlatform();
  return currentPlatform === platform;
}

/**
 * Get the current platform
 * @returns The current platform ('web' or 'tauri')
 */
export function getCurrentPlatform(): Platform {
  // Check environment variable first (set during build)
  const envPlatform = import.meta.env.VITE_PLATFORM;
  if (envPlatform === 'web' || envPlatform === 'tauri') {
    return envPlatform;
  }

  // Fallback: Check if Tauri APIs are available
  if (hasTauriAPI()) {
    return 'tauri';
  }

  return 'web';
}

/**
 * Check if running in Tauri mode
 * @returns true if running in Tauri desktop app
 */
export function isTauri(): boolean {
  return isPlatform('tauri');
}

/**
 * Check if running in Web mode
 * @returns true if running in web browser
 */
export function isWeb(): boolean {
  return isPlatform('web');
}

/**
 * Check if Tauri APIs are available at runtime
 * @returns true if Tauri APIs are loaded
 */
export function hasTauriAPI(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Get platform-specific features availability
 */
export const platformFeatures = {
  get hasLocalDatabase(): boolean {
    return isTauri();
  },
  get hasWebSocket(): boolean {
    return isWeb();
  },
  get hasVoiceOrdering(): boolean {
    // Available on both platforms
    return true;
  },
  get hasPrinting(): boolean {
    // Browser printing available in web
    return isWeb();
  },
  get hasNativeMenu(): boolean {
    return isTauri();
  },
};

/**
 * Platform info for debugging
 */
export function getPlatformInfo() {
  return {
    platform: getCurrentPlatform(),
    hasTauriAPI: hasTauriAPI(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    features: platformFeatures,
  };
}
