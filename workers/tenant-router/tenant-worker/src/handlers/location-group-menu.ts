/**
 * Chain Menu Management Handler
 * Handles master menu sync and location-specific overrides
 */

interface Env {
  DB: D1Database;
  TENANTS_DB?: D1Database;
  TENANT_METADATA?: any;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
};

/**
 * POST /chain/pull-menu - Pull master menu to this location
 */
export async function handlePullMasterMenu(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Chain management not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Get chain info for this tenant
    const locationInfo = await env.TENANTS_DB.prepare(`
      SELECT cl.location_group_id, c.master_menu_tenant_id, cl.inherits_master_menu
      FROM location_group_locations cl
      JOIN location_groups c ON cl.location_group_id = c.id
      WHERE cl.tenant_id = ? AND cl.status = 'active' AND c.status = 'active'
    `).bind(tenantId).first();

    if (!locationInfo) {
      return Response.json({
        success: false,
        error: 'This tenant is not part of a chain or master menu not configured'
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!locationInfo.inherits_master_menu) {
      return Response.json({
        success: false,
        error: 'This location does not inherit master menu'
      }, { status: 400, headers: CORS_HEADERS });
    }

    // TODO: Implement actual menu sync logic
    // For now, return success to unblock frontend
    const syncResult = {
      synced: 0,
      overridesPreserved: 0,
      newItems: 0,
      updatedItems: 0,
      message: 'Menu sync not yet implemented - infrastructure ready'
    };

    return Response.json({
      success: true,
      ...syncResult,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainMenu] Pull master error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to pull master menu'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /chain/menu-overrides - Get all menu overrides for this location
 */
export async function handleGetMenuOverrides(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const result = await env.DB.prepare(`
      SELECT
        id, master_item_id, price_override, available_override,
        description_override, photo_url_override, local_name,
        override_reason, created_at, updated_at
      FROM menu_item_overrides
      WHERE tenant_id = ?
      ORDER BY created_at DESC
    `).bind(tenantId).all();

    const overrides = result.results.map((row: any) => ({
      id: row.id,
      masterItemId: row.master_item_id,
      priceOverride: row.price_override,
      availableOverride: row.available_override,
      descriptionOverride: row.description_override,
      photoUrlOverride: row.photo_url_override,
      localName: row.local_name,
      overrideReason: row.override_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return Response.json({
      success: true,
      overrides,
      totalOverrides: overrides.length,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainMenu] Get overrides error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get menu overrides'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /chain/menu-overrides/:itemId - Set/update menu override
 */
export async function handleSetMenuOverride(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      priceOverride?: number;
      availableOverride?: boolean;
      descriptionOverride?: string;
      photoUrlOverride?: string;
      localName?: string;
      overrideReason?: string;
    };

    // Validate at least one override is provided
    if (
      body.priceOverride === undefined &&
      body.availableOverride === undefined &&
      !body.descriptionOverride &&
      !body.photoUrlOverride &&
      !body.localName
    ) {
      return Response.json({
        success: false,
        error: 'At least one override field must be provided'
      }, { status: 400, headers: CORS_HEADERS });
    }

    // Upsert override
    await env.DB.prepare(`
      INSERT INTO menu_item_overrides (
        tenant_id, master_item_id, price_override, available_override,
        description_override, photo_url_override, local_name, override_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, master_item_id) DO UPDATE SET
        price_override = excluded.price_override,
        available_override = excluded.available_override,
        description_override = excluded.description_override,
        photo_url_override = excluded.photo_url_override,
        local_name = excluded.local_name,
        override_reason = excluded.override_reason,
        updated_at = datetime('now')
    `).bind(
      tenantId,
      itemId,
      body.priceOverride ?? null,
      body.availableOverride !== undefined ? (body.availableOverride ? 1 : 0) : null,
      body.descriptionOverride ?? null,
      body.photoUrlOverride ?? null,
      body.localName ?? null,
      body.overrideReason ?? 'Location-specific customization'
    ).run();

    return Response.json({
      success: true,
      message: 'Menu override saved',
      itemId,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainMenu] Set override error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to set menu override'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * DELETE /chain/menu-overrides/:itemId - Remove menu override
 */
export async function handleRemoveMenuOverride(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    const result = await env.DB.prepare(`
      DELETE FROM menu_item_overrides
      WHERE tenant_id = ? AND master_item_id = ?
    `).bind(tenantId, itemId).run();

    if (result.meta.changes === 0) {
      return Response.json({
        success: false,
        error: 'Override not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    return Response.json({
      success: true,
      message: 'Menu override removed',
      itemId,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainMenu] Remove override error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to remove menu override'
    }, { status: 500, headers: CORS_HEADERS });
  }
}
