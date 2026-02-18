/**
 * Social Media Webhooks Router
 *
 * This Cloudflare Worker receives webhooks from social media platforms
 * (Instagram, TikTok, WhatsApp) and routes them to the appropriate tenant's
 * local device via cloudflared tunnel.
 *
 * IMPORTANT SECURITY NOTE:
 * This worker does NOT verify webhook signatures. All signature verification
 * happens on the local device using tenant-provided API secrets that are stored
 * encrypted and never sent to the cloud. This worker only performs routing.
 */

export interface Env {
  TENANT_TUNNELS: KVNamespace;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check endpoint
    if (path === '/health' || path === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'social-media-webhooks',
        version: '1.0.0',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Instagram webhook endpoint
    if (path === '/webhooks/instagram') {
      return handleInstagramWebhook(request, env);
    }

    // TikTok webhook endpoint
    if (path === '/webhooks/tiktok') {
      return handleTikTokWebhook(request, env);
    }

    // WhatsApp webhook endpoint
    if (path === '/webhooks/whatsapp') {
      return handleWhatsAppWebhook(request, env);
    }

    // Tunnel registration endpoint
    if (path === '/register-tunnel' && request.method === 'POST') {
      return registerTunnel(request, env);
    }

    // Tunnel status check
    if (path === '/tunnel-status' && request.method === 'GET') {
      return checkTunnelStatus(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

/**
 * Handle Instagram webhook
 * Instagram uses GET for verification and POST for events
 */
async function handleInstagramWebhook(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Verification callback (GET)
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    // We can't verify the token here (it's stored locally)
    // Just forward the verification to the device
    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      return new Response('Missing tenant_id', { status: 400 });
    }

    const tunnelUrl = await env.TENANT_TUNNELS.get(`tunnel:${tenantId}`);

    if (!tunnelUrl) {
      console.error(`[Instagram] No tunnel found for tenant ${tenantId}`);
      return new Response('Tenant not configured', { status: 503 });
    }

    try {
      // Forward verification to device
      const verifyUrl = `${tunnelUrl}/webhooks/instagram?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=${challenge}`;
      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        },
      });

      const challengeResponse = await response.text();
      return new Response(challengeResponse, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (error) {
      console.error('[Instagram] Verification forwarding failed:', error);
      return new Response('Service Unavailable', { status: 503 });
    }
  }

  // Webhook event (POST)
  if (request.method === 'POST') {
    const signature = request.headers.get('X-Hub-Signature-256');
    const body = await request.text();

    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      console.error('[Instagram] Missing tenant_id in webhook');
      return new Response('OK'); // Return OK to prevent retries
    }

    // Get tunnel URL for this tenant
    const tunnelUrl = await env.TENANT_TUNNELS.get(`tunnel:${tenantId}`);

    if (!tunnelUrl) {
      console.error(`[Instagram] No tunnel found for tenant ${tenantId}`);
      return new Response('OK'); // Return OK to prevent retries
    }

    // Forward to local device with all original headers
    // Device will verify signature using locally-stored secret
    try {
      const response = await fetch(`${tunnelUrl}/webhooks/instagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature || '',
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
          'X-Original-Timestamp': new Date().toISOString(),
          'X-Tenant-Id': tenantId,
        },
        body: body,
      });

      if (!response.ok) {
        console.error(`[Instagram] Device returned error: ${response.status}`);
      } else {
        console.log(`[Instagram] Webhook forwarded successfully to tenant ${tenantId}`);
      }
    } catch (error) {
      console.error('[Instagram] Error forwarding webhook:', error);
    }

    // Always return OK to Instagram to prevent retries
    return new Response('OK');
  }

  return new Response('Method not allowed', { status: 405 });
}

/**
 * Handle TikTok webhook
 */
async function handleTikTokWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    const url = new URL(request.url);
    const signature = request.headers.get('X-TikTok-Signature');
    const timestamp = request.headers.get('X-TikTok-Timestamp');
    const body = await request.text();

    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      console.error('[TikTok] Missing tenant_id in webhook');
      return new Response('OK');
    }

    // Get tunnel URL
    const tunnelUrl = await env.TENANT_TUNNELS.get(`tunnel:${tenantId}`);

    if (!tunnelUrl) {
      console.error(`[TikTok] No tunnel found for tenant ${tenantId}`);
      return new Response('OK');
    }

    // Forward to device
    try {
      const response = await fetch(`${tunnelUrl}/webhooks/tiktok`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TikTok-Signature': signature || '',
          'X-TikTok-Timestamp': timestamp || '',
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
          'X-Original-Timestamp': new Date().toISOString(),
          'X-Tenant-Id': tenantId,
        },
        body: body,
      });

      if (!response.ok) {
        console.error(`[TikTok] Device returned error: ${response.status}`);
      } else {
        console.log(`[TikTok] Webhook forwarded successfully to tenant ${tenantId}`);
      }
    } catch (error) {
      console.error('[TikTok] Error forwarding webhook:', error);
    }

    return new Response('OK');
  }

  return new Response('Method not allowed', { status: 405 });
}

/**
 * Handle WhatsApp Business webhook
 */
async function handleWhatsAppWebhook(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Verification callback (GET)
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      return new Response('Missing tenant_id', { status: 400 });
    }

    const tunnelUrl = await env.TENANT_TUNNELS.get(`tunnel:${tenantId}`);

    if (!tunnelUrl) {
      console.error(`[WhatsApp] No tunnel found for tenant ${tenantId}`);
      return new Response('Tenant not configured', { status: 503 });
    }

    try {
      // Forward verification to device
      const verifyUrl = `${tunnelUrl}/webhooks/whatsapp?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=${challenge}`;
      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        },
      });

      const challengeResponse = await response.text();
      return new Response(challengeResponse, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (error) {
      console.error('[WhatsApp] Verification forwarding failed:', error);
      return new Response('Service Unavailable', { status: 503 });
    }
  }

  // Webhook event (POST)
  if (request.method === 'POST') {
    const signature = request.headers.get('X-Hub-Signature-256');
    const body = await request.text();

    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      console.error('[WhatsApp] Missing tenant_id in webhook');
      return new Response('OK');
    }

    const tunnelUrl = await env.TENANT_TUNNELS.get(`tunnel:${tenantId}`);

    if (!tunnelUrl) {
      console.error(`[WhatsApp] No tunnel found for tenant ${tenantId}`);
      return new Response('OK');
    }

    try {
      const response = await fetch(`${tunnelUrl}/webhooks/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature || '',
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
          'X-Original-Timestamp': new Date().toISOString(),
          'X-Tenant-Id': tenantId,
        },
        body: body,
      });

      if (!response.ok) {
        console.error(`[WhatsApp] Device returned error: ${response.status}`);
      } else {
        console.log(`[WhatsApp] Webhook forwarded successfully to tenant ${tenantId}`);
      }
    } catch (error) {
      console.error('[WhatsApp] Error forwarding webhook:', error);
    }

    return new Response('OK');
  }

  return new Response('Method not allowed', { status: 405 });
}

/**
 * Register a tenant's tunnel URL
 * Called by device during tunnel setup
 */
async function registerTunnel(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { tenant_id: string; tunnel_url: string };
    const { tenant_id, tunnel_url } = body;

    if (!tenant_id || !tunnel_url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing tenant_id or tunnel_url',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate tunnel URL format
    if (!tunnel_url.startsWith('https://')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tunnel URL must use HTTPS',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store tunnel URL in KV
    await env.TENANT_TUNNELS.put(`tunnel:${tenant_id}`, tunnel_url);

    console.log(`[Register] Registered tunnel for tenant ${tenant_id}: ${tunnel_url}`);

    return new Response(JSON.stringify({
      success: true,
      tenant_id,
      tunnel_url,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Register] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Check tunnel status for a tenant
 */
async function checkTunnelStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant_id');

  if (!tenantId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing tenant_id',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tunnelUrl = await env.TENANT_TUNNELS.get(`tunnel:${tenantId}`);

  return new Response(JSON.stringify({
    success: true,
    tenant_id: tenantId,
    tunnel_registered: !!tunnelUrl,
    tunnel_url: tunnelUrl || null,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
