/**
 * Theme Configuration API Route
 * Saves theme preset and customization to TENANTS_DB
 *
 * Updates restaurant_theme_configs table with theme preset and colors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
  }
}

interface ThemeConfig {
  preset: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  tagline?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get Cloudflare context with D1 bindings
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

    if (!TENANTS_DB) {
      console.error('[Theme Setup API] TENANTS_DB D1 binding not found');
      return NextResponse.json(
        { success: false, error: 'D1 binding not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const config: ThemeConfig = await request.json();
    console.log('[Theme Setup API] Received config:', {
      preset: config.preset,
      hasColors: !!(config.primaryColor || config.secondaryColor),
    });

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

    console.log('[Theme Setup API] Saving theme for tenant:', tenantId);

    // Add theme_preset column if it doesn't exist (for backwards compatibility)
    try {
      await TENANTS_DB.prepare(`
        ALTER TABLE restaurant_theme_configs ADD COLUMN theme_preset TEXT
      `).run();
      console.log('[Theme Setup API] Added theme_preset column');
    } catch (error) {
      // Column might already exist, that's okay
    }

    // Update restaurant_theme_configs table
    const updateResult = await TENANTS_DB.prepare(`
      UPDATE restaurant_theme_configs
      SET
        theme_preset = ?,
        primary_color = COALESCE(?, primary_color),
        secondary_color = COALESCE(?, secondary_color),
        logo_url = COALESCE(?, logo_url),
        tagline = COALESCE(?, tagline),
        updated_at = ?
      WHERE tenant_id = ?
    `).bind(
      config.preset,
      config.primaryColor || null,
      config.secondaryColor || null,
      config.logoUrl || null,
      config.tagline || null,
      new Date().toISOString(),
      tenantId
    ).run();

    console.log('[Theme Setup API] Updated restaurant_theme_configs:', updateResult);

    if (updateResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Theme configuration saved successfully',
        theme: {
          preset: config.preset,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update theme configuration' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Theme Setup API] Error:', error);
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
 * Get current theme configuration
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

    // Fetch theme config
    const result = await TENANTS_DB.prepare(`
      SELECT theme_preset, primary_color, secondary_color, logo_url, tagline
      FROM restaurant_theme_configs
      WHERE tenant_id = ?
    `).bind(tenantId).first();

    if (result) {
      return NextResponse.json({
        success: true,
        theme: {
          preset: result.theme_preset || 'grab-food-default',
          primaryColor: result.primary_color,
          secondaryColor: result.secondary_color,
          logoUrl: result.logo_url,
          tagline: result.tagline,
        },
      });
    } else {
      // Return default theme if no config exists
      return NextResponse.json({
        success: true,
        theme: {
          preset: 'grab-food-default',
          primaryColor: '#00B14F',
          secondaryColor: '#FFA500',
        },
      });
    }

  } catch (error) {
    console.error('[Theme Setup API] GET Error:', error);
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
