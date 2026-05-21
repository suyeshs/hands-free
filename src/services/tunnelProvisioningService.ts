/**
 * Tunnel Provisioning Service
 *
 * Handles named tunnel provisioning for restaurants during setup
 */

import { invoke } from '@tauri-apps/api/core';
import { useTenantStore } from '../stores/tenantStore';

interface TunnelProvisioningResult {
  success: boolean;
  tunnelId: string;
  tunnelName: string;
  url: string;
  credentials: string; // JSON string
}

interface TunnelStatusResponse {
  provisioned: boolean;
  tunnelId?: string;
  tunnelName?: string;
  url?: string;
  message?: string;
}

/**
 * Generate a URL-safe slug from restaurant name
 */
export function generateRestaurantSlug(restaurantName: string): string {
  return restaurantName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Provision a named tunnel for the restaurant during setup
 */
export async function provisionTunnel(restaurantSlug: string): Promise<TunnelProvisioningResult> {
  const tenantId = useTenantStore.getState().tenantId;

  if (!tenantId) {
    throw new Error('No tenant ID available. Complete activation first.');
  }

  // Call backend API to provision tunnel
  const response = await fetch(`https://api.handsfree.com/api/provision-tunnel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
    },
    body: JSON.stringify({ restaurantSlug }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to provision tunnel');
  }

  const result: TunnelProvisioningResult = await response.json();

  // Store credentials in local database
  await storeTunnelCredentials(result);

  return result;
}

/**
 * Check if tunnel is already provisioned for this tenant
 */
export async function checkTunnelStatus(): Promise<TunnelStatusResponse> {
  const tenantId = useTenantStore.getState().tenantId;

  if (!tenantId) {
    return { provisioned: false, message: 'No tenant ID' };
  }

  try {
    const response = await fetch(`https://api.handsfree.com/api/tunnel-status`, {
      method: 'GET',
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    if (!response.ok) {
      console.error('[Tunnel] Status check failed:', response.status);
      return { provisioned: false, message: 'Status check failed' };
    }

    return await response.json();
  } catch (error) {
    console.error('[Tunnel] Status check error:', error);
    return { provisioned: false, message: 'Network error' };
  }
}

/**
 * Store tunnel credentials in local SQLite database
 */
async function storeTunnelCredentials(result: TunnelProvisioningResult): Promise<void> {
  const tenantId = useTenantStore.getState().tenantId;

  if (!tenantId) {
    throw new Error('No tenant ID available');
  }

  // Store in tenant_config table
  const query = `
    INSERT INTO tenant_config
      (tenant_id, tunnel_id, tunnel_name, tunnel_url, tunnel_credentials, updated_at)
    VALUES
      (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id) DO UPDATE SET
      tunnel_id = excluded.tunnel_id,
      tunnel_name = excluded.tunnel_name,
      tunnel_url = excluded.tunnel_url,
      tunnel_credentials = excluded.tunnel_credentials,
      updated_at = CURRENT_TIMESTAMP
  `;

  await invoke('execute_query', {
    query,
    params: [
      tenantId,
      result.tunnelId,
      result.tunnelName,
      result.url,
      result.credentials,
    ],
  });

  console.log('[Tunnel] Credentials stored locally:', result.url);
}

/**
 * Retrieve stored tunnel credentials from local database
 */
export async function getStoredTunnelCredentials(): Promise<{
  tunnelId: string;
  tunnelName: string;
  tunnelUrl: string;
  credentials: string;
} | null> {
  const tenantId = useTenantStore.getState().tenantId;

  if (!tenantId) {
    return null;
  }

  try {
    const result = await invoke<any>('query_first', {
      query: `
        SELECT tunnel_id, tunnel_name, tunnel_url, tunnel_credentials
        FROM tenant_config
        WHERE tenant_id = ?
      `,
      params: [tenantId],
    });

    if (!result || !result.tunnel_id) {
      return null;
    }

    return {
      tunnelId: result.tunnel_id,
      tunnelName: result.tunnel_name,
      tunnelUrl: result.tunnel_url,
      credentials: result.tunnel_credentials,
    };
  } catch (error) {
    console.error('[Tunnel] Failed to retrieve credentials:', error);
    return null;
  }
}

/**
 * Start the named tunnel using stored credentials
 */
export async function startNamedTunnel(): Promise<string> {
  const credentials = await getStoredTunnelCredentials();

  if (!credentials) {
    throw new Error('No tunnel credentials found. Provision tunnel first.');
  }

  try {
    const url = await invoke<string>('start_named_tunnel', {
      tunnelName: credentials.tunnelName,
      credentialsJson: credentials.credentials,
      tunnelUrl: credentials.tunnelUrl,
    });

    console.log('[Tunnel] Named tunnel started:', url);
    return url;
  } catch (error) {
    console.error('[Tunnel] Failed to start named tunnel:', error);
    throw error;
  }
}
