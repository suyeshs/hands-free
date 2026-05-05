/**
 * Token Manager Integration
 * Fetches Google Maps API key from handsfree-token-manager service
 */

import { Env } from '../types';

/**
 * Fetch token from Token Manager service
 */
async function fetchToken(tokenKey: string, env: Env): Promise<string> {
  console.log(`[TokenManager] Fetching token: ${tokenKey}`);

  if (!env.TOKEN_MANAGER) {
    throw new Error('TOKEN_MANAGER service binding not available');
  }

  try {
    const response = await env.TOKEN_MANAGER.fetch(
      new Request(`https://token-manager/api/tokens/${tokenKey}`, {
        headers: {
          'X-Worker-Name': 'handsfree-google-places',
        },
      })
    );

    console.log(`[TokenManager] Response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`Token fetch failed: ${response.status}`);
    }

    const result = (await response.json()) as any;
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

/**
 * Get Google Maps API key
 * Uses the same key as the address verification service
 * Fallback: If token manager is unavailable, use GOOGLE_MAPS_API_KEY env var
 */
export async function getGoogleMapsApiKey(env: Env): Promise<string> {
  console.log(`[TokenManager] Getting Google Maps API key`);

  try {
    return await fetchToken('google:maps_api_key', env);
  } catch (error) {
    console.warn('[TokenManager] Failed to fetch from token manager:', error);

    // Fallback to direct environment variable
    if ((env as any).GOOGLE_MAPS_API_KEY) {
      console.log('[TokenManager] Using fallback GOOGLE_MAPS_API_KEY env variable');
      return (env as any).GOOGLE_MAPS_API_KEY;
    }

    throw new Error('Google Maps API key not available. Configure token manager access or set GOOGLE_MAPS_API_KEY env variable.');
  }
}
