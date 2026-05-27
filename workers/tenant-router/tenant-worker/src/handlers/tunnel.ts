/**
 * Tunnel Provisioning Handlers
 *
 * Manages Cloudflare tunnel creation/deletion for restaurants
 */

import { createTunnelService } from '../services/cloudflare-tunnel';

/**
 * POST /api/provision-tunnel
 * Create a named tunnel for a restaurant during setup
 */
export async function handleProvisionTunnel(
  request: Request,
  env: any,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json();
    const { restaurantSlug } = body;

    if (!restaurantSlug || typeof restaurantSlug !== 'string') {
      return new Response(
        JSON.stringify({ error: 'restaurantSlug is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    if (!/^[a-z0-9-]+$/.test(restaurantSlug)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Tunnel] Provisioning tunnel for tenant: ${tenantId}, slug: ${restaurantSlug}`);

    // Create tunnel service
    const tunnelService = createTunnelService(env);

    // Check if tunnel already exists
    const exists = await tunnelService.tunnelExists(restaurantSlug);
    if (exists) {
      return new Response(
        JSON.stringify({
          error: 'Tunnel already exists for this slug. Please choose a different name.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create the tunnel
    const result = await tunnelService.createTunnel(restaurantSlug);

    // Store tunnel credentials in tenant config
    await storeTunnelCredentials(env, tenantId, result);

    console.log(`[Tunnel] ✅ Provisioned tunnel: ${result.url}`);

    return new Response(
      JSON.stringify({
        success: true,
        tunnelId: result.tunnelId,
        tunnelName: result.tunnelName,
        url: result.url,
        // Send credentials to be stored in POS app
        credentials: JSON.stringify(result.credentials),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[Tunnel] Provisioning failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to provision tunnel',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/tunnel-status
 * Check tunnel status for current tenant
 */
export async function handleGetTunnelStatus(
  request: Request,
  env: any,
  tenantId: string
): Promise<Response> {
  try {
    const db = env.DB;

    // Query tunnel info from tenant config
    const result = await db
      .prepare(
        `SELECT tunnel_id, tunnel_name, tunnel_url
         FROM tenant_config
         WHERE tenant_id = ?`
      )
      .bind(tenantId)
      .first();

    if (!result || !result.tunnel_id) {
      return new Response(
        JSON.stringify({
          provisioned: false,
          message: 'No tunnel provisioned for this tenant',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        provisioned: true,
        tunnelId: result.tunnel_id,
        tunnelName: result.tunnel_name,
        url: result.tunnel_url,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Tunnel] Status check failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check tunnel status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/tunnel
 * Delete tunnel for current tenant (when restaurant is closed)
 */
export async function handleDeleteTunnel(
  request: Request,
  env: any,
  tenantId: string
): Promise<Response> {
  try {
    const db = env.DB;

    // Get tunnel info
    const result = await db
      .prepare(
        `SELECT tunnel_id, tunnel_name
         FROM tenant_config
         WHERE tenant_id = ?`
      )
      .bind(tenantId)
      .first();

    if (!result || !result.tunnel_id) {
      return new Response(
        JSON.stringify({ error: 'No tunnel found for this tenant' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete tunnel from Cloudflare
    const tunnelService = createTunnelService(env);
    await tunnelService.deleteTunnel(result.tunnel_id, result.tunnel_name);

    // Clear tunnel info from database
    await db
      .prepare(
        `UPDATE tenant_config
         SET tunnel_id = NULL,
             tunnel_name = NULL,
             tunnel_url = NULL,
             tunnel_credentials = NULL
         WHERE tenant_id = ?`
      )
      .bind(tenantId)
      .run();

    console.log(`[Tunnel] Deleted tunnel for tenant: ${tenantId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Tunnel deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Tunnel] Deletion failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete tunnel', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Store tunnel credentials in tenant config
 */
async function storeTunnelCredentials(env: any, tenantId: string, tunnelData: any): Promise<void> {
  const db = env.DB;

  // Encrypt credentials before storing (base64 encode for now, upgrade to KV later)
  const encryptedCredentials = btoa(JSON.stringify(tunnelData.credentials));

  await db
    .prepare(
      `INSERT INTO tenant_config
       (tenant_id, tunnel_id, tunnel_name, tunnel_url, tunnel_credentials, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(tenant_id) DO UPDATE SET
         tunnel_id = excluded.tunnel_id,
         tunnel_name = excluded.tunnel_name,
         tunnel_url = excluded.tunnel_url,
         tunnel_credentials = excluded.tunnel_credentials,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(
      tenantId,
      tunnelData.tunnelId,
      tunnelData.tunnelName,
      tunnelData.url,
      encryptedCredentials
    )
    .run();
}
