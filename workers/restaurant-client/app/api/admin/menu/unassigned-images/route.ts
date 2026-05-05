/**
 * Unassigned Images API
 * GET /api/admin/menu/unassigned-images?tenantId=xxx - Fetch all unassigned images
 * POST /api/admin/menu/unassigned-images - Assign an image to a menu item
 * DELETE /api/admin/menu/unassigned-images - Delete an unassigned image
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    MENU_DB: D1Database;
    CLOUDFLARE_API_TOKEN: string;
  }
}

interface UnassignedImage {
  id: string;
  tenant_id: string;
  cloudflare_image_id: string;
  filename: string;
  image_url: string;
  uploaded_at: string;
  uploaded_by?: string;
  notes?: string;
}

/**
 * GET /api/admin/menu/unassigned-images?tenantId=xxx
 * Fetch all unassigned images for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const db = env.MENU_DB;

    if (!db) {
      return NextResponse.json(
        { error: 'D1 database not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const result = await db
      .prepare(`
        SELECT * FROM unassigned_images
        WHERE tenant_id = ?
        ORDER BY uploaded_at DESC
      `)
      .bind(tenantId)
      .all<UnassignedImage>();

    return NextResponse.json({
      success: true,
      images: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('[Unassigned Images API] GET Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch unassigned images',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/menu/unassigned-images
 * Assign an image to a menu item or delete it
 * Body: { action: 'assign' | 'delete', tenantId, imageId, menuItemId? }
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const db = env.MENU_DB;

    if (!db) {
      return NextResponse.json(
        { error: 'D1 database not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, tenantId, imageId, menuItemId } = body as {
      action: 'assign' | 'delete';
      tenantId: string;
      imageId: string;
      menuItemId?: string;
    };

    if (!action || !tenantId || !imageId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, tenantId, imageId' },
        { status: 400 }
      );
    }

    if (action === 'assign') {
      if (!menuItemId) {
        return NextResponse.json(
          { error: 'menuItemId is required for assign action' },
          { status: 400 }
        );
      }

      // Get the unassigned image
      const imageResult = await db
        .prepare(`SELECT * FROM unassigned_images WHERE id = ? AND tenant_id = ?`)
        .bind(imageId, tenantId)
        .first<UnassignedImage>();

      if (!imageResult) {
        return NextResponse.json(
          { error: 'Unassigned image not found' },
          { status: 404 }
        );
      }

      // Update menu item with the image
      await db
        .prepare(`
          UPDATE menu_items
          SET cloudflare_image_id = ?,
              photo_url = ?,
              updated_at = datetime('now')
          WHERE tenant_id = ? AND id = ?
        `)
        .bind(
          imageResult.cloudflare_image_id,
          imageResult.image_url,
          tenantId,
          menuItemId
        )
        .run();

      // Delete from unassigned_images
      await db
        .prepare(`DELETE FROM unassigned_images WHERE id = ?`)
        .bind(imageId)
        .run();

      console.log(
        `[Unassigned Images API] Assigned image ${imageResult.filename} to menu item ${menuItemId}`
      );

      return NextResponse.json({
        success: true,
        message: 'Image assigned successfully',
        menuItemId,
        cloudflareImageId: imageResult.cloudflare_image_id,
      });
    } else if (action === 'delete') {
      // Get the unassigned image first to retrieve Cloudflare image ID
      const imageResult = await db
        .prepare(`SELECT * FROM unassigned_images WHERE id = ? AND tenant_id = ?`)
        .bind(imageId, tenantId)
        .first<UnassignedImage>();

      if (!imageResult) {
        return NextResponse.json(
          { error: 'Unassigned image not found' },
          { status: 404 }
        );
      }

      // Delete from Cloudflare Images
      try {
        const cfAccountId = '0f3287b287060e3215662501ee96292e';
        const cfApiToken = env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

        if (cfApiToken) {
          const deleteResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/images/v1/${imageResult.cloudflare_image_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${cfApiToken}`,
              },
            }
          );

          if (!deleteResponse.ok) {
            console.error(`[Unassigned Images API] Failed to delete from Cloudflare Images: ${deleteResponse.status}`);
          } else {
            console.log(`[Unassigned Images API] Deleted image ${imageResult.cloudflare_image_id} from Cloudflare Images`);
          }
        }
      } catch (cfError) {
        console.error(`[Unassigned Images API] Cloudflare delete error:`, cfError);
      }

      // Delete from unassigned_images table
      await db
        .prepare(`DELETE FROM unassigned_images WHERE id = ? AND tenant_id = ?`)
        .bind(imageId, tenantId)
        .run();

      console.log(`[Unassigned Images API] Deleted unassigned image ${imageId} from D1`);

      return NextResponse.json({
        success: true,
        message: 'Image deleted from both Cloudflare Images and database',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "assign" or "delete"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Unassigned Images API] POST Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
