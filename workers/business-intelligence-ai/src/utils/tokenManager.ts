/**
 * Token Manager Integration
 * Fetch secrets from the token-manager service
 */

import { Env } from '../types';

/**
 * Fetch a token from the token-manager service
 */
export async function getTokenFromManager(
  tokenKey: string,
  env: Env
): Promise<string> {
  // Use Service Binding for worker-to-worker communication
  console.log(`Fetching token: ${tokenKey}`);

  const response = await env.TOKEN_MANAGER.fetch(
    new Request(`https://handsfree-token-manager/api/tokens/${encodeURIComponent(tokenKey)}`, {
      headers: {
        'X-Worker-Name': 'business-intelligence-ai'
      }
    })
  );

  console.log(`Token fetch response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token fetch failed: ${response.status} - ${errorText}`);
    throw new Error(`Failed to fetch token ${tokenKey}: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.data.value;
}
