/**
 * Payment Configuration API Route
 * Saves payment gateway configuration to TENANTS_DB
 *
 * Note: Payment keys should be encrypted before storage
 * Currently stores in plaintext - TODO: Add encryption
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
  }
}

interface PaymentConfig {
  useHandsfreeAccount: boolean;
  porterApiKey?: string;
  porterSecretKey?: string;
  razorpayKeyId?: string;
  razorpaySecretKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get Cloudflare context with D1 bindings
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

    if (!TENANTS_DB) {
      console.error('[Payment Setup API] TENANTS_DB D1 binding not found');
      return NextResponse.json(
        { success: false, error: 'D1 binding not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const config: PaymentConfig = await request.json();
    console.log('[Payment Setup API] Received config (keys hidden)');

    // Get tenant ID from request
    let tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      const hostname = request.headers.get('host') || '';
      tenantId = getTenantIdFromHostname(hostname);
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Could not determine tenant ID' },
        { status: 400 }
      );
    }

    console.log('[Payment Setup API] Saving config for tenant:', tenantId);

    // Create payment_configs table if it doesn't exist
    await TENANTS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS payment_configs (
        tenant_id TEXT PRIMARY KEY,
        use_handsfree_account INTEGER NOT NULL DEFAULT 1,
        porter_api_key TEXT,
        porter_secret_key TEXT,
        razorpay_key_id TEXT,
        razorpay_secret_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES restaurant_tenants(tenant_id) ON DELETE CASCADE
      )
    `).run();

    // Upsert payment configuration
    const result = await TENANTS_DB.prepare(`
      INSERT INTO payment_configs (
        tenant_id,
        use_handsfree_account,
        porter_api_key,
        porter_secret_key,
        razorpay_key_id,
        razorpay_secret_key,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        use_handsfree_account = excluded.use_handsfree_account,
        porter_api_key = excluded.porter_api_key,
        porter_secret_key = excluded.porter_secret_key,
        razorpay_key_id = excluded.razorpay_key_id,
        razorpay_secret_key = excluded.razorpay_secret_key,
        updated_at = excluded.updated_at
    `).bind(
      tenantId,
      config.useHandsfreeAccount ? 1 : 0,
      config.porterApiKey || null,
      config.porterSecretKey || null,
      config.razorpayKeyId || null,
      config.razorpaySecretKey || null,
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    console.log('[Payment Setup API] Saved payment config:', result);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Payment configuration saved successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to save payment configuration' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Payment Setup API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get payment configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

    if (!TENANTS_DB) {
      return NextResponse.json(
        { success: false, error: 'D1 binding not configured' },
        { status: 500 }
      );
    }

    // Get tenant ID
    let tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      const hostname = request.headers.get('host') || '';
      tenantId = getTenantIdFromHostname(hostname);
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Could not determine tenant ID' },
        { status: 400 }
      );
    }

    // Fetch payment config
    const result = await TENANTS_DB.prepare(`
      SELECT * FROM payment_configs WHERE tenant_id = ?
    `).bind(tenantId).first();

    if (result) {
      return NextResponse.json({
        success: true,
        config: {
          useHandsfreeAccount: result.use_handsfree_account === 1,
          porterApiKey: result.porter_api_key,
          porterSecretKey: result.porter_secret_key,
          razorpayKeyId: result.razorpay_key_id,
          razorpaySecretKey: result.razorpay_secret_key,
        },
      });
    } else {
      // Return default config if none exists
      return NextResponse.json({
        success: true,
        config: {
          useHandsfreeAccount: true,
        },
      });
    }

  } catch (error) {
    console.error('[Payment Setup API] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract tenant ID from hostname
 */
function getTenantIdFromHostname(hostname: string): string | null {
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'demo';
  }

  if (hostname.includes('.workers.dev')) {
    return 'demo';
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}
