/**
 * Token Manager Integration for Orders Worker
 *
 * Fetches tokens from the centralized Token Manager service.
 */

/**
 * Fetch token from Token Manager using service binding
 */
export async function fetchToken(env: any, tokenKey: string): Promise<string> {
  console.log(`[TokenManager] Fetching token: ${tokenKey}`);

  if (!env.TOKEN_MANAGER) {
    throw new Error('TOKEN_MANAGER service binding not available');
  }

  try {
    const response = await env.TOKEN_MANAGER.fetch(
      new Request(`https://token-manager/api/tokens/${encodeURIComponent(tokenKey)}`, {
        headers: {
          'X-Worker-Name': 'handsfree-orders',
        },
      })
    );

    console.log(`[TokenManager] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TokenManager] Token fetch failed: ${errorText}`);
      throw new Error(`Token fetch failed: ${response.status}`);
    }

    const result = await response.json() as any;

    if (!result.success) {
      console.error(`[TokenManager] Token fetch failed:`, result.error);
      throw new Error(`Token fetch failed: ${result.error}`);
    }

    const tokenValue = result.data.value;
    console.log(`[TokenManager] ✅ Token fetched successfully`);

    return tokenValue;
  } catch (error) {
    console.error('[TokenManager] ❌ Service binding fetch failed:', error);
    throw error;
  }
}

/**
 * Get Cloudflare API token for D1 provisioning
 */
export async function getCloudflareApiToken(env: any): Promise<string> {
  console.log(`[TokenManager] Getting Cloudflare API token for D1 provisioning`);
  return fetchToken(env, 'cloudflare:d1_provisioning_token');
}
