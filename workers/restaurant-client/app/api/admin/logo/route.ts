/**
 * Logo Upload API Route
 * Uploads restaurant logo to Cloudflare Images and saves URL to D1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
  }
}

// Cloudflare Images configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0f3287b287060e3215662501ee96292e';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'PEjPQStb94cuLh-Wor0yG59NCLE5WS6Js5DrBsfi';
const CLOUDFLARE_IMAGE_BASE_URL = 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for logos

/**
 * POST /api/admin/logo
 * Upload a new logo
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

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

    console.log(`[Logo Upload] Uploading logo for tenant: ${tenantId}`);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${file.type}. Only JPEG, PNG, WebP, and SVG are allowed.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File size exceeds maximum of 5MB` },
        { status: 400 }
      );
    }

    console.log(`[Logo Upload] Uploading file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Upload to Cloudflare Images
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('metadata', JSON.stringify({
      tenantId,
      type: 'logo',
      uploadedAt: new Date().toISOString(),
    }));

    const uploadResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: uploadFormData,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Logo Upload] Cloudflare upload failed:', errorText);
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadResponse.status}` },
        { status: 500 }
      );
    }

    const result = await uploadResponse.json() as any;
    const cloudflareId = result.result?.id;

    if (!cloudflareId) {
      return NextResponse.json(
        { success: false, error: 'Failed to get image ID from Cloudflare' },
        { status: 500 }
      );
    }

    // Generate public URL
    const logoUrl = `${CLOUDFLARE_IMAGE_BASE_URL}/${cloudflareId}/public`;
    console.log(`[Logo Upload] Successfully uploaded. URL: ${logoUrl}`);

    // Save to D1 database
    if (TENANTS_DB) {
      try {
        await TENANTS_DB.prepare(`
          UPDATE restaurant_theme_configs
          SET logo_url = ?, updated_at = ?
          WHERE tenant_id = ?
        `).bind(logoUrl, new Date().toISOString(), tenantId).run();

        console.log(`[Logo Upload] Saved logo URL to D1 for tenant: ${tenantId}`);
      } catch (dbError) {
        console.error('[Logo Upload] D1 update failed:', dbError);
        // Don't fail the request - logo was uploaded successfully
      }
    }

    return NextResponse.json({
      success: true,
      logoUrl,
      cloudflareId,
    });

  } catch (error) {
    console.error('[Logo Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/logo
 * Get current logo URL
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

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

    if (!TENANTS_DB) {
      return NextResponse.json(
        { success: true, logoUrl: null },
        { status: 200 }
      );
    }

    const result = await TENANTS_DB.prepare(`
      SELECT logo_url FROM restaurant_theme_configs WHERE tenant_id = ?
    `).bind(tenantId).first() as { logo_url?: string } | null;

    return NextResponse.json({
      success: true,
      logoUrl: result?.logo_url || null,
    });

  } catch (error) {
    console.error('[Logo Upload] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get logo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/logo
 * Remove current logo
 */
export async function DELETE(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const TENANTS_DB = env.TENANTS_DB;

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

    if (TENANTS_DB) {
      await TENANTS_DB.prepare(`
        UPDATE restaurant_theme_configs
        SET logo_url = NULL, updated_at = ?
        WHERE tenant_id = ?
      `).bind(new Date().toISOString(), tenantId).run();

      console.log(`[Logo Upload] Removed logo for tenant: ${tenantId}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Logo Upload] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to remove logo' },
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
