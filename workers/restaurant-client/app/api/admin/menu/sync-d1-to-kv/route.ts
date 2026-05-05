/**
 * Sync D1 Menu to KV Storage
 * POST /api/admin/menu/sync-d1-to-kv
 *
 * Reads menu from D1 database and syncs to KV for edge access
 * Used by voice ordering and manual workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    MENU_DB: D1Database;
    TENANT_METADATA: KVNamespace;
  }
}

interface MenuItem {
  id: string;
  name: string;
  name_hindi?: string;
  name_local?: string;
  category: string;
  description?: string;
  price: number;
  photo_url?: string;
  cloudflare_image_id?: string;
  available: number;
  is_vegetarian: number;
  is_vegan: number;
  spice_level?: string;
  allergens?: string;
  tags?: string;
  choices?: string;
  choice_required?: number;
  display_order?: number;
}

/**
 * POST /api/admin/menu/sync-d1-to-kv
 * Body: { tenantId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const db = env.MENU_DB;
    const kv = env.TENANT_METADATA;

    if (!db) {
      return NextResponse.json(
        { error: 'D1 database not configured' },
        { status: 500 }
      );
    }

    if (!kv) {
      return NextResponse.json(
        { error: 'KV namespace not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { tenantId } = body as { tenantId: string };

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing required field: tenantId' },
        { status: 400 }
      );
    }

    console.log(`[D1→KV Sync] Starting sync for tenant: ${tenantId}`);

    // Step 1: Fetch all menu items from D1
    const result = await db
      .prepare(`
        SELECT
          id, name, name_hindi, name_local, category, description, price,
          photo_url, cloudflare_image_id, available, is_vegetarian, is_vegan,
          spice_level, allergens, tags, choices, choice_required, display_order
        FROM menu_items
        WHERE tenant_id = ? AND available = 1
        ORDER BY category, display_order, name
      `)
      .bind(tenantId)
      .all<MenuItem>();

    const menuItems = result.results || [];

    if (menuItems.length === 0) {
      return NextResponse.json(
        { error: 'No menu items found for tenant', tenantId },
        { status: 404 }
      );
    }

    console.log(`[D1→KV Sync] Found ${menuItems.length} items in D1`);

    // Step 2: Build category hierarchy
    const categoryHierarchy: Record<string, any> = {};
    const itemsByCategory: Record<string, any[]> = {};

    for (const item of menuItems) {
      const category = item.category || 'Uncategorized';

      if (!itemsByCategory[category]) {
        itemsByCategory[category] = [];
        categoryHierarchy[category] = {
          name: category,
          items: [],
          count: 0,
        };
      }

      // Format item for KV storage
      const formattedItem = {
        id: item.id,
        name: item.name,
        nameHindi: item.name_hindi,
        nameLocal: item.name_local,
        category: item.category,
        description: item.description,
        price: item.price,
        imageUrl: item.photo_url,
        cloudflareImageId: item.cloudflare_image_id,
        available: item.available === 1,
        isVegetarian: item.is_vegetarian === 1,
        isVegan: item.is_vegan === 1,
        spiceLevel: item.spice_level,
        allergens: item.allergens,
        tags: item.tags ? JSON.parse(item.tags) : [],
        choices: item.choices ? JSON.parse(item.choices) : null,
        choiceRequired: item.choice_required === 1,
      };

      itemsByCategory[category].push(formattedItem);
      categoryHierarchy[category].items.push(formattedItem);
      categoryHierarchy[category].count++;
    }

    // Step 3: Build menu data JSON
    const menuData = {
      metadata: {
        tenantId,
        processedAt: new Date().toISOString(),
        stats: {
          totalItems: menuItems.length,
          categories: Object.keys(categoryHierarchy).length,
          itemsWithImages: menuItems.filter(i => i.cloudflare_image_id).length,
          vegetarianItems: menuItems.filter(i => i.is_vegetarian === 1).length,
          itemsWithChoices: menuItems.filter(i => i.choice_required === 1).length,
        },
      },
      categoryHierarchy,
      tier1Metadata: Object.entries(categoryHierarchy).map(([name, data]: [string, any]) => ({
        name,
        count: data.count,
        displayOrder: 0,
      })),
      items: menuItems.map(item => ({
        id: item.id,
        name: item.name,
        nameHindi: item.name_hindi,
        nameLocal: item.name_local,
        category: item.category,
        description: item.description,
        price: item.price,
        imageUrl: item.photo_url,
        cloudflareImageId: item.cloudflare_image_id,
        available: item.available === 1,
        isVegetarian: item.is_vegetarian === 1,
        isVegan: item.is_vegan === 1,
        spiceLevel: item.spice_level,
        allergens: item.allergens,
        tags: item.tags ? JSON.parse(item.tags) : [],
        choices: item.choices ? JSON.parse(item.choices) : null,
        choiceRequired: item.choice_required === 1,
      })),
    };

    // Step 4: Upload to KV
    console.log(`[D1→KV Sync] Uploading menu data to KV...`);

    // Upload main menu data
    await kv.put(`menu:${tenantId}:data`, JSON.stringify(menuData));

    // Upload metadata (for quick access)
    await kv.put(
      `menu:${tenantId}:metadata`,
      JSON.stringify({
        tenantId: menuData.metadata.tenantId,
        processedAt: menuData.metadata.processedAt,
        stats: menuData.metadata.stats,
        tier1Metadata: menuData.tier1Metadata,
      })
    );

    // Upload category hierarchy
    await kv.put(`menu:${tenantId}:categories`, JSON.stringify(menuData.categoryHierarchy));

    console.log(`[D1→KV Sync] ✅ Successfully synced to KV`);

    return NextResponse.json({
      success: true,
      tenantId,
      sync: {
        itemsSynced: menuItems.length,
        categories: Object.keys(categoryHierarchy).length,
        itemsWithImages: menuData.metadata.stats.itemsWithImages,
        itemsWithChoices: menuData.metadata.stats.itemsWithChoices,
        syncedAt: menuData.metadata.processedAt,
        kvKeys: [
          `menu:${tenantId}:data`,
          `menu:${tenantId}:metadata`,
          `menu:${tenantId}:categories`,
        ],
      },
    });
  } catch (error) {
    console.error('[D1→KV Sync] Error:', error);
    return NextResponse.json(
      {
        error: 'D1 to KV sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
