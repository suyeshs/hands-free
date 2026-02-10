/**
 * Token Manager Integration
 *
 * Provides helper functions to fetch tokens from the centralized Token Manager service.
 * Uses service bindings for worker-to-worker communication when available.
 */

// Store env for service binding access
let envInstance: any = null;

export function initTokenManager(env: any) {
  envInstance = env;
}

/**
 * Fetch token using service binding or fallback to HTTP
 * Exported for use by tenant secrets manager
 */
export async function fetchToken(tokenKey: string): Promise<string> {
  console.log(`[TokenManager] Fetching token: ${tokenKey}`);

  // Try service binding first (preferred for worker-to-worker communication)
  if (envInstance?.TOKEN_MANAGER) {
    console.log(`[TokenManager] Using service binding for token: ${tokenKey}`);
    try {
      const response = await envInstance.TOKEN_MANAGER.fetch(
        new Request(`https://token-manager/api/tokens/${tokenKey}`, {
          headers: {
            'X-Worker-Name': 'handsfree-domain-service',
          },
        })
      );

      console.log(`[TokenManager] Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Token fetch failed: ${response.status}`);
      }

      const result = await response.json() as any;
      console.log(`[TokenManager] Response success: ${result.success}`);

      if (!result.success) {
        console.error(`[TokenManager] Token fetch failed:`, result.error);
        throw new Error(`Token fetch failed: ${result.error}`);
      }

      const tokenValue = result.data.value;
      console.log(`[TokenManager] ✅ Token fetched successfully (first 10 chars): ${tokenValue?.substring(0, 10)}...`);

      return tokenValue;
    } catch (error) {
      console.error('[TokenManager] ❌ Service binding fetch failed:', error);
      throw error;
    }
  }

  // Fallback to HTTP (won't work in all contexts due to Cloudflare restrictions)
  console.error('[TokenManager] ❌ TOKEN_MANAGER service binding not available');
  throw new Error('TOKEN_MANAGER service binding not available');
}

/**
 * Get Cloudflare DNS API token
 * Used for DNS record management
 */
export async function getCloudflareApiToken(): Promise<string> {
  console.log(`[TokenManager] Getting Cloudflare DNS API token`);
  return fetchToken('cloudflare:dns_token');
}

/**
 * Get Cloudflare Storage API token
 * Used for KV, D1, R2 operations
 */
export async function getCloudflareStorageToken(): Promise<string> {
  console.log(`[TokenManager] Getting Cloudflare Storage API token`);

  // Use environment variable/secret directly for restaurant provisioning
  if (envInstance?.CLOUDFLARE_STORAGE_TOKEN) {
    console.log(`[TokenManager] Using CLOUDFLARE_STORAGE_TOKEN from environment`);
    return envInstance.CLOUDFLARE_STORAGE_TOKEN;
  }

  if (envInstance?.CLOUDFLARE_API_TOKEN) {
    console.log(`[TokenManager] Using CLOUDFLARE_API_TOKEN from environment as fallback`);
    return envInstance.CLOUDFLARE_API_TOKEN;
  }

  // Fallback to TOKEN_MANAGER service binding
  return fetchToken('cloudflare:storage_token');
}

/**
 * Get multiple tokens in parallel
 * Useful when you need both tokens at once
 */
export async function getCloudflareTokens(): Promise<{ dnsToken: string; storageToken: string }> {
  const [dnsToken, storageToken] = await Promise.all([
    getCloudflareApiToken(),
    getCloudflareStorageToken(),
  ]);

  return { dnsToken, storageToken };
}
