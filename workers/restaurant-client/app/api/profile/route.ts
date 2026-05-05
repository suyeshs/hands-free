/**
 * Restaurant Profile API Route
 * Reads profile data from D1 database (restaurant_tenants + restaurant_theme_configs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get Cloudflare context with D1 bindings (explicit async mode)
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

    if (!TENANTS_DB) {
      console.error('[Profile API] TENANTS_DB D1 binding not found');
      return NextResponse.json(
        { success: false, error: 'D1 binding not configured' },
        { status: 500 }
      );
    }

    // Get tenant ID from query parameter first (passed explicitly during SSR)
    const url = new URL(request.url);
    let tenantId = url.searchParams.get('tenantId');
    console.log(`[Profile API] Tenant ID from query param: ${tenantId}`);

    // Fallback 1: middleware header (set by middleware.ts)
    if (!tenantId) {
      tenantId = request.headers.get('x-tenant-id');
      console.log(`[Profile API] Tenant ID from middleware header: ${tenantId}`);
    }

    // Fallback 2: parse from hostname
    if (!tenantId) {
      const hostname = request.headers.get('host') || '';
      console.log(`[Profile API] Received hostname: ${hostname}`);
      tenantId = getTenantIdFromHostname(hostname);
      console.log(`[Profile API] Parsed tenant ID from hostname: ${tenantId}`);
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Could not determine tenant from hostname' },
        { status: 400 }
      );
    }

    // Read tenant data from D1
    const tenantResult = await TENANTS_DB.prepare(
      `SELECT * FROM restaurant_tenants WHERE tenant_id = ?`
    ).bind(tenantId).first();

    if (!tenantResult) {
      console.log(`[Profile API] Tenant not found: ${tenantId}`);
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Read theme config from D1
    const themeResult = await TENANTS_DB.prepare(
      `SELECT * FROM restaurant_theme_configs WHERE tenant_id = ?`
    ).bind(tenantId).first();

    if (!themeResult) {
      console.log(`[Profile API] Theme config not found for tenant: ${tenantId}`);
      return NextResponse.json(
        { success: false, error: 'Theme config not found' },
        { status: 404 }
      );
    }

    // Parse cuisine JSON if it exists
    const cuisineArray = themeResult.cuisine ? JSON.parse(themeResult.cuisine as string) : ['Multi-cuisine'];

    // Build profile from D1 data
    const profile = {
      tenantId,
      name: (tenantResult.company_name as string) || (themeResult.name as string) || 'Restaurant',
      cuisine: cuisineArray.join(', '),
      address: 'Address not configured',
      phone: tenantResult.phone || '+1234567890',
      hours: '10 AM - 10 PM',
      about: themeResult.description || 'Welcome to our restaurant',
      brandIdentity: {
        primaryColor: themeResult.primary_color || '#FFA000',
        logo: themeResult.logo_url || null,
        tagline: themeResult.tagline || null,
      },
      status: tenantResult.status || 'active',
      createdAt: tenantResult.created_at || new Date().toISOString(),
      updatedAt: tenantResult.updated_at || new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      profile,
    });

  } catch (error) {
    console.error('[Profile API] Error:', error);
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
 * Examples:
 *   - khao-piyo-5621.handsfree.tech -> khao-piyo-5621
 *   - localhost:3000 -> demo
 */
function getTenantIdFromHostname(hostname: string): string | null {
  // Local development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'demo';
  }

  // Workers dev (*.workers.dev)
  if (hostname.includes('.workers.dev')) {
    return 'demo';
  }

  // Production: Extract subdomain
  // Example: khao-piyo-5621.handsfree.tech -> khao-piyo-5621
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}
