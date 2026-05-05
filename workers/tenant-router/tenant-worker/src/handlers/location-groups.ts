/**
 * LocationGroup Management Handler
 * Handles locationGroup and location operations
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
 * GET /locationGroups/:locationGroupId - Get locationGroup details
 */
export async function handleGetLocationGroup(
  request: Request,
  env: Env,
  locationGroupId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'LocationGroup management not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    const locationGroup = await env.TENANTS_DB.prepare(`
      SELECT
        id, location_group_id, location_group_name, owner_admin_user_id,
        has_master_menu, master_menu_tenant_id, menu_sync_strategy,
        headquarters_place_id, headquarters_address, headquarters_city, headquarters_state,
        status, created_at, updated_at
      FROM location_groups
      WHERE location_group_id = ? AND status != 'deleted'
    `).bind(locationGroupId).first();

    if (!locationGroup) {
      return Response.json({
        success: false,
        error: 'LocationGroup not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Get location count
    const locationCount = await env.TENANTS_DB.prepare(`
      SELECT COUNT(*) as count
      FROM location_group_locations
      WHERE location_group_id = ? AND status = 'active'
    `).bind(locationGroup.id).first();

    return Response.json({
      success: true,
      locationGroup: {
        id: locationGroup.id,
        locationGroupId: locationGroup.location_group_id,
        locationGroupName: locationGroup.location_group_name,
        ownerAdminUserId: locationGroup.owner_admin_user_id,
        hasMasterMenu: locationGroup.has_master_menu === 1,
        masterMenuTenantId: locationGroup.master_menu_tenant_id,
        menuSyncStrategy: locationGroup.menu_sync_strategy,
        headquarters: {
          placeId: locationGroup.headquarters_place_id,
          address: locationGroup.headquarters_address,
          city: locationGroup.headquarters_city,
          state: locationGroup.headquarters_state,
        },
        status: locationGroup.status,
        locationCount: locationCount?.count || 0,
        createdAt: locationGroup.created_at,
        updatedAt: locationGroup.updated_at,
      },
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[LocationGroups] Get locationGroup error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get locationGroup'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /locationGroups - Create new locationGroup
 */
export async function handleCreateLocationGroup(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'LocationGroup management not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    const body = await request.json() as {
      locationGroupId: string;
      locationGroupName: string;
      ownerAdminUserId: string;
      masterMenuTenantId?: string;
      menuSyncStrategy?: 'push' | 'pull';
      headquarters?: {
        placeId?: string;
        address?: string;
        city?: string;
        state?: string;
      };
    };

    // Validate required fields
    if (!body.locationGroupId || !body.locationGroupName || !body.ownerAdminUserId) {
      return Response.json({
        success: false,
        error: 'locationGroupId, locationGroupName, and ownerAdminUserId are required'
      }, { status: 400, headers: CORS_HEADERS });
    }

    // Check if locationGroup ID already exists
    const existing = await env.TENANTS_DB.prepare(`
      SELECT id FROM location_groups WHERE location_group_id = ?
    `).bind(body.locationGroupId).first();

    if (existing) {
      return Response.json({
        success: false,
        error: 'LocationGroup ID already exists'
      }, { status: 409, headers: CORS_HEADERS });
    }

    // Insert locationGroup
    const result = await env.TENANTS_DB.prepare(`
      INSERT INTO location_groups (
        location_group_id, location_group_name, owner_admin_user_id,
        has_master_menu, master_menu_tenant_id, menu_sync_strategy,
        headquarters_place_id, headquarters_address, headquarters_city, headquarters_state,
        status
      )
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'active')
      RETURNING id
    `).bind(
      body.locationGroupId,
      body.locationGroupName,
      body.ownerAdminUserId,
      body.masterMenuTenantId || null,
      body.menuSyncStrategy || 'push',
      body.headquarters?.placeId || null,
      body.headquarters?.address || null,
      body.headquarters?.city || null,
      body.headquarters?.state || null
    ).first();

    // Cache in KV
    if (env.TENANT_METADATA && result) {
      await env.TENANT_METADATA.put(`locationGroup:${body.locationGroupId}:owner`, body.ownerAdminUserId);
      if (body.masterMenuTenantId) {
        await env.TENANT_METADATA.put(`locationGroup:${body.locationGroupId}:master_menu`, body.masterMenuTenantId);
      }
    }

    return Response.json({
      success: true,
      message: 'LocationGroup created successfully',
      locationGroupId: body.locationGroupId,
      id: result?.id,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[LocationGroups] Create locationGroup error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to create locationGroup'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /locationGroups/:locationGroupId/locations - List locationGroup locations
 */
export async function handleListLocationGroupLocations(
  request: Request,
  env: Env,
  locationGroupId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'LocationGroup management not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Get locationGroup internal ID
    const locationGroup = await env.TENANTS_DB.prepare(`
      SELECT id FROM location_groups WHERE location_group_id = ?
    `).bind(locationGroupId).first();

    if (!locationGroup) {
      return Response.json({
        success: false,
        error: 'LocationGroup not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    const result = await env.TENANTS_DB.prepare(`
      SELECT
        id, tenant_id, location_name, location_code,
        place_id, place_name, formatted_address, latitude, longitude,
        city, state, pincode, phone_number,
        inherits_master_menu, allow_price_overrides, allow_availability_overrides, allow_custom_items,
        status, created_at, updated_at
      FROM location_group_locations
      WHERE location_group_id = ?
      ORDER BY location_name ASC
    `).bind(locationGroup.id).all();

    const locations = result.results.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      locationName: row.location_name,
      locationCode: row.location_code,
      place: {
        placeId: row.place_id,
        placeName: row.place_name,
        formattedAddress: row.formatted_address,
        latitude: row.latitude,
        longitude: row.longitude,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        phoneNumber: row.phone_number,
      },
      menuSettings: {
        inheritsMasterMenu: row.inherits_master_menu === 1,
        allowPriceOverrides: row.allow_price_overrides === 1,
        allowAvailabilityOverrides: row.allow_availability_overrides === 1,
        allowCustomItems: row.allow_custom_items === 1,
      },
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return Response.json({
      success: true,
      locations,
      totalLocations: locations.length,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[LocationGroups] List locations error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list locations'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /locationGroups/:locationGroupId/locations - Add location to locationGroup
 */
export async function handleAddLocationGroupLocation(
  request: Request,
  env: Env,
  locationGroupId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'LocationGroup management not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    const body = await request.json() as {
      tenantId: string;
      locationName: string;
      locationCode?: string;
      placeId: string;
      placeName?: string;
      formattedAddress?: string;
      latitude?: number;
      longitude?: number;
      city?: string;
      state?: string;
      pincode?: string;
      phoneNumber?: string;
      inheritsMasterMenu?: boolean;
      allowPriceOverrides?: boolean;
      allowAvailabilityOverrides?: boolean;
      allowCustomItems?: boolean;
    };

    // Validate required fields
    if (!body.tenantId || !body.locationName || !body.placeId) {
      return Response.json({
        success: false,
        error: 'tenantId, locationName, and placeId are required'
      }, { status: 400, headers: CORS_HEADERS });
    }

    // Get locationGroup internal ID
    const locationGroup = await env.TENANTS_DB.prepare(`
      SELECT id FROM location_groups WHERE location_group_id = ?
    `).bind(locationGroupId).first();

    if (!locationGroup) {
      return Response.json({
        success: false,
        error: 'LocationGroup not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Check if tenant already assigned to a locationGroup
    const existingLocation = await env.TENANTS_DB.prepare(`
      SELECT id FROM location_group_locations WHERE tenant_id = ?
    `).bind(body.tenantId).first();

    if (existingLocation) {
      return Response.json({
        success: false,
        error: 'Tenant already assigned to a locationGroup location'
      }, { status: 409, headers: CORS_HEADERS });
    }

    // Insert location
    await env.TENANTS_DB.prepare(`
      INSERT INTO location_group_locations (
        location_group_id, tenant_id, location_name, location_code,
        place_id, place_name, formatted_address, latitude, longitude,
        city, state, pincode, phone_number,
        inherits_master_menu, allow_price_overrides, allow_availability_overrides, allow_custom_items,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      locationGroup.id,
      body.tenantId,
      body.locationName,
      body.locationCode || null,
      body.placeId,
      body.placeName || null,
      body.formattedAddress || null,
      body.latitude || null,
      body.longitude || null,
      body.city || null,
      body.state || null,
      body.pincode || null,
      body.phoneNumber || null,
      body.inheritsMasterMenu !== false ? 1 : 0,
      body.allowPriceOverrides !== false ? 1 : 0,
      body.allowAvailabilityOverrides !== false ? 1 : 0,
      body.allowCustomItems !== false ? 1 : 0
    ).run();

    // Update restaurant_tenants table
    await env.TENANTS_DB.prepare(`
      UPDATE restaurant_tenants
      SET location_group_id = ?, is_locationGroup_location = 1
      WHERE tenant_id = ?
    `).bind(locationGroup.id, body.tenantId).run();

    // Cache in KV
    if (env.TENANT_METADATA) {
      await env.TENANT_METADATA.put(`tenant:${body.tenantId}:locationGroup`, locationGroupId);
      await env.TENANT_METADATA.put(`tenant:${body.tenantId}:is_locationGroup_location`, 'true');

      // Update locationGroup locations list
      const locationsKey = `locationGroup:${locationGroupId}:locations`;
      const existingLocations = await env.TENANT_METADATA.get(locationsKey, 'json') || [];
      existingLocations.push(body.tenantId);
      await env.TENANT_METADATA.put(locationsKey, JSON.stringify(existingLocations));
    }

    return Response.json({
      success: true,
      message: 'Location added to locationGroup',
      tenantId: body.tenantId,
      locationName: body.locationName,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[LocationGroups] Add location error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to add location'
    }, { status: 500, headers: CORS_HEADERS });
  }
}
