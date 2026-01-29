/**
 * Utility helpers for plugin development
 */

/**
 * Create a versioned API path
 * Ensures consistency in plugin API endpoints
 */
export function createApiPath(
  pluginId: string,
  endpoint: string,
  version: string = 'v1'
): string {
  return `/api/plugin/${pluginId}/${version}${endpoint}`;
}

/**
 * Parse plugin version string
 * Supports semver format
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
} {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version string: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

/**
 * Check if a version satisfies a range
 * Simple implementation of semver range checking
 */
export function satisfiesVersion(version: string, range: string): boolean {
  // Handle simple cases: ">=3.0.0", "^1.0.0", "~1.2.3"
  const v = parseVersion(version);

  if (range.startsWith('>=')) {
    const minVersion = parseVersion(range.slice(2));
    return (
      v.major > minVersion.major ||
      (v.major === minVersion.major && v.minor > minVersion.minor) ||
      (v.major === minVersion.major &&
        v.minor === minVersion.minor &&
        v.patch >= minVersion.patch)
    );
  }

  if (range.startsWith('^')) {
    const baseVersion = parseVersion(range.slice(1));
    return v.major === baseVersion.major && v.minor >= baseVersion.minor;
  }

  if (range.startsWith('~')) {
    const baseVersion = parseVersion(range.slice(1));
    return (
      v.major === baseVersion.major &&
      v.minor === baseVersion.minor &&
      v.patch >= baseVersion.patch
    );
  }

  // Exact match
  return version === range;
}

/**
 * Generate plugin checksum
 * SHA-256 hash of WASM file
 */
export async function generateChecksum(wasmBytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', wasmBytes as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}

/**
 * Verify plugin checksum
 */
export async function verifyChecksum(
  wasmBytes: Uint8Array,
  expectedChecksum: string
): Promise<boolean> {
  const actualChecksum = await generateChecksum(wasmBytes);
  return actualChecksum === expectedChecksum;
}

/**
 * Create a scoped logger for plugins
 */
export function createLogger(pluginId: string) {
  const prefix = `[Plugin:${pluginId}]`;

  return {
    debug: (...args: unknown[]) => console.debug(prefix, ...args),
    log: (...args: unknown[]) => console.log(prefix, ...args),
    info: (...args: unknown[]) => console.info(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/**
 * Sleep helper for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }
  }

  throw lastError;
}
