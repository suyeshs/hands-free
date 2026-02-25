/**
 * Restaurant Setup API Route
 * Saves restaurant data to TENANTS_DB (D1 database)
 *
 * Updates two tables:
 * 1. restaurant_tenants - Basic tenant info (phone, email)
 * 2. restaurant_theme_configs - Branding (name, cuisine, description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
    FIRESTORE_SERVICE_URL?: string;
  }
}

interface RestaurantData {
  name: string;
  cuisine: string;
  address: string;
  phone: string;
  email: string;
  hours?: string;
  about?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get Cloudflare context with D1 bindings
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

    if (!TENANTS_DB) {
      console.error('[Restaurant Setup API] TENANTS_DB D1 binding not found');
      return NextResponse.json(
        { success: false, error: 'D1 binding not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const data: RestaurantData = await request.json();
    console.log('[Restaurant Setup API] Received data:', data);

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

    console.log('[Restaurant Setup API] Saving data for tenant:', tenantId);

    // Update restaurant_tenants table (phone, email)
    const updateTenantResult = await TENANTS_DB.prepare(`
      UPDATE restaurant_tenants
      SET phone = ?, email = ?, updated_at = ?
      WHERE tenant_id = ?
    `).bind(
      data.phone || '',
      data.email || '',
      new Date().toISOString(),
      tenantId
    ).run();

    console.log('[Restaurant Setup API] Updated restaurant_tenants:', updateTenantResult);

    // Convert cuisine to JSON array format
    const cuisineArray = data.cuisine ? [data.cuisine] : ['Multi-cuisine'];
    const cuisineJson = JSON.stringify(cuisineArray);

    // Update restaurant_theme_configs table (name, cuisine, description)
    const updateThemeResult = await TENANTS_DB.prepare(`
      UPDATE restaurant_theme_configs
      SET name = ?, cuisine = ?, description = ?, updated_at = ?
      WHERE tenant_id = ?
    `).bind(
      data.name || 'Restaurant',
      cuisineJson,
      data.about || '',
      new Date().toISOString(),
      tenantId
    ).run();

    console.log('[Restaurant Setup API] Updated restaurant_theme_configs:', updateThemeResult);

    // Check if updates were successful
    if (updateTenantResult.success && updateThemeResult.success) {
      // Sync to Firestore if needed
      await syncToFirestore(tenantId, data, env);

      return NextResponse.json({
        success: true,
        message: 'Restaurant data saved successfully',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update database' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Restaurant Setup API] Error:', error);
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
 * Sync critical data to Firestore
 */
async function syncToFirestore(tenantId: string, data: RestaurantData, env: CloudflareEnv) {
  try {
    const firestoreUrl = env.FIRESTORE_SERVICE_URL;

    if (!firestoreUrl) {
      console.log('[Restaurant Setup API] Firestore sync skipped - no service URL configured');
      return;
    }

    // Sync restaurant profile to Firestore
    const syncData = {
      tenantId,
      name: data.name,
      cuisine: data.cuisine,
      phone: data.phone,
      email: data.email,
      about: data.about,
      updatedAt: new Date().toISOString(),
    };

    console.log('[Restaurant Setup API] Syncing to Firestore:', syncData);

    const response = await fetch(`${firestoreUrl}/tenants/${tenantId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(syncData),
    });

    if (response.ok) {
      console.log('[Restaurant Setup API] Firestore sync successful');
    } else {
      console.error('[Restaurant Setup API] Firestore sync failed:', await response.text());
    }
  } catch (error) {
    console.error('[Restaurant Setup API] Firestore sync error:', error);
    // Don't throw - Firestore sync failure shouldn't block the main operation
  }
}

/**
 * Extract tenant ID from hostname
 */
function getTenantIdFromHostname(hostname: string): string | null {
  // Local development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'demo';
  }

  // Workers dev
  if (hostname.includes('.workers.dev')) {
    return 'demo';
  }

  // Production: Extract subdomain (khao-piyo-5621.handsfree.tech -> khao-piyo-5621)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}
