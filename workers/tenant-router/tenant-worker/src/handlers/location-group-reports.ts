/**
 * Chain Reporting Handler (Updated)
 * Consolidated reports across all chain locations using REAL DATA
 *
 * This file replaces the mock data implementation in:
 * handsfree-restaurant-new/platform/workers/tenant-router/tenant-worker/src/handlers/location-group-reports.ts
 */

interface Env {
  DB: D1Database;
  TENANTS_DB?: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
};

/**
 * GET /chains/:chainId/reports/sales - Consolidated sales report (REAL DATA)
 */
export async function handleLocationGroupSalesReport(
  request: Request,
  env: Env,
  chainId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Chain reporting not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = url.searchParams.get('endDate') || new Date().toISOString();

    // Get chain and locations
    const chain = await env.TENANTS_DB.prepare(`
      SELECT id, location_group_name FROM location_groups WHERE location_group_id = ?
    `).bind(chainId).first();

    if (!chain) {
      return Response.json({
        success: false,
        error: 'Chain not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    const locations = await env.TENANTS_DB.prepare(`
      SELECT tenant_id, location_name
      FROM location_group_locations
      WHERE location_group_id = ? AND status = 'active'
    `).bind(chain.id).all();

    // Check if chain_sales_aggregated table exists
    const tableCheck = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='chain_sales_aggregated'
    `).first();

    if (!tableCheck) {
      // Fallback to mock data if table doesn't exist yet
      console.warn('[ChainReports] chain_sales_aggregated table not found, using mock data');
      return generateMockSalesReport(chainId, startDate, endDate, locations.results);
    }

    // REAL DATA QUERY
    const summaryResult = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as total_orders,
        COUNT(DISTINCT location_tenant_id) as active_locations
      FROM chain_sales_aggregated
      WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
    `).bind(chainId, startDate, endDate).first();

    const locationBreakdown = await env.DB.prepare(`
      SELECT
        location_tenant_id,
        location_name,
        COUNT(*) as orders,
        COALESCE(SUM(grand_total), 0) as sales,
        COALESCE(AVG(grand_total), 0) as avg_order_value
      FROM chain_sales_aggregated
      WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
      GROUP BY location_tenant_id, location_name
      ORDER BY sales DESC
    `).bind(chainId, startDate, endDate).all();

    const totalSales = (summaryResult?.total_sales as number) || 0;
    const totalOrders = (summaryResult?.total_orders as number) || 0;
    const activeLocations = (summaryResult?.active_locations as number) || 0;

    // Find top performing location
    const topLocation = locationBreakdown.results.length > 0
      ? locationBreakdown.results[0]
      : null;

    const report = {
      chainId,
      chainName: chain.location_group_name,
      startDate,
      endDate,
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      averageSalesPerLocation: activeLocations > 0 ? totalSales / activeLocations : 0,
      activeLocations,
      topLocation: topLocation ? {
        tenantId: topLocation.location_tenant_id,
        locationName: topLocation.location_name,
        sales: topLocation.sales,
        orders: topLocation.orders,
        averageOrderValue: topLocation.avg_order_value,
      } : null,
      locationBreakdown: locationBreakdown.results.map((loc: any) => ({
        tenantId: loc.location_tenant_id,
        locationName: loc.location_name,
        sales: loc.sales,
        orders: loc.orders,
        averageOrderValue: loc.avg_order_value,
        percentageOfTotal: totalSales > 0 ? (loc.sales / totalSales) * 100 : 0,
      })),
      dataSource: 'real', // Indicate this is real data, not mock
    };

    return Response.json({
      success: true,
      report,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainReports] Sales report error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to generate sales report'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * Fallback mock data generator (used when table doesn't exist)
 */
function generateMockSalesReport(
  chainId: string,
  startDate: string,
  endDate: string,
  locations: any[]
): Response {
  const mockReport = {
    chainId,
    startDate,
    endDate,
    totalSales: 125000.00,
    totalOrders: 1250,
    averageOrderValue: 100.00,
    averageSalesPerLocation: 25000.00,
    activeLocations: locations.length,
    topLocation: locations.length > 0 ? {
      tenantId: locations[0]?.tenant_id || 'unknown',
      locationName: locations[0]?.location_name || 'Unknown',
      sales: 45000.00,
      orders: 450,
      averageOrderValue: 100.00,
    } : null,
    locationBreakdown: locations.map((loc: any, idx: number) => ({
      tenantId: loc.tenant_id,
      locationName: loc.location_name,
      sales: 25000.00 - (idx * 2000),
      orders: 250 - (idx * 20),
      averageOrderValue: 100.00,
      percentageOfTotal: idx === 0 ? 36 : 20 - (idx * 2),
    })),
    dataSource: 'mock', // Indicate this is mock data
    message: 'Using mock data - chain_sales_aggregated table not found. Run migration 050 and sync sales from locations.',
  };

  return Response.json({
    success: true,
    report: mockReport,
  }, { headers: CORS_HEADERS });
}

/**
 * GET /chains/:chainId/reports/menu - Menu analytics across locations (REAL DATA)
 */
export async function handleLocationGroupMenuAnalytics(
  request: Request,
  env: Env,
  chainId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Chain reporting not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = url.searchParams.get('endDate') || new Date().toISOString();

    // Get chain
    const chain = await env.TENANTS_DB.prepare(`
      SELECT id, location_group_name FROM location_groups WHERE location_group_id = ?
    `).bind(chainId).first();

    if (!chain) {
      return Response.json({
        success: false,
        error: 'Chain not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Check if chain_sales_aggregated table exists
    const tableCheck = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='chain_sales_aggregated'
    `).first();

    if (!tableCheck) {
      // Fallback to mock data
      return generateMockMenuAnalytics(chainId, startDate, endDate);
    }

    // REAL DATA QUERY: Aggregate items across all sales
    const itemsResult = await env.DB.prepare(`
      SELECT items_json, location_tenant_id
      FROM chain_sales_aggregated
      WHERE location_group_id = ? AND completed_at >= ? AND completed_at <= ?
    `).bind(chainId, startDate, endDate).all();

    // Parse and aggregate items
    const itemStats = new Map<string, {
      itemName: string;
      quantitySold: number;
      revenue: number;
      locations: Set<string>;
    }>();

    for (const row of itemsResult.results) {
      const items = JSON.parse((row.items_json as string) || '[]');
      const locationId = row.location_tenant_id as string;

      for (const item of items) {
        const existing = itemStats.get(item.name) || {
          itemName: item.name,
          quantitySold: 0,
          revenue: 0,
          locations: new Set(),
        };

        existing.quantitySold += item.quantity;
        existing.revenue += item.subtotal;
        existing.locations.add(locationId);

        itemStats.set(item.name, existing);
      }
    }

    // Convert to array and sort by revenue
    const topSellingItems = Array.from(itemStats.values())
      .map(item => ({
        itemName: item.itemName,
        quantitySold: item.quantitySold,
        revenue: item.revenue,
        locations: item.locations.size,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 items

    const analytics = {
      chainId,
      chainName: chain.location_group_name,
      startDate,
      endDate,
      topSellingItems,
      totalUniqueItems: itemStats.size,
      dataSource: 'real',
    };

    return Response.json({
      success: true,
      analytics,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainReports] Menu analytics error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to generate menu analytics'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * Fallback mock menu analytics
 */
function generateMockMenuAnalytics(
  chainId: string,
  startDate: string,
  endDate: string
): Response {
  const mockAnalytics = {
    chainId,
    startDate,
    endDate,
    topSellingItems: [
      { itemName: 'Butter Chicken', quantitySold: 450, revenue: 13500.00, locations: 5 },
      { itemName: 'Paneer Tikka', quantitySold: 380, revenue: 11400.00, locations: 5 },
      { itemName: 'Naan', quantitySold: 650, revenue: 6500.00, locations: 5 },
      { itemName: 'Biryani', quantitySold: 320, revenue: 12800.00, locations: 4 },
      { itemName: 'Samosa', quantitySold: 520, revenue: 5200.00, locations: 5 },
    ],
    totalUniqueItems: 45,
    dataSource: 'mock',
    message: 'Using mock data - chain_sales_aggregated table not found',
  };

  return Response.json({
    success: true,
    analytics: mockAnalytics,
  }, { headers: CORS_HEADERS });
}

/**
 * GET /chains/:chainId/reports/staff - Staff report across locations
 * (This already uses real data from location_group_staff_access table)
 */
export async function handleLocationGroupStaffReport(
  request: Request,
  env: Env,
  chainId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Chain reporting not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Get chain
    const chain = await env.TENANTS_DB.prepare(`
      SELECT id, location_group_name FROM location_groups WHERE location_group_id = ?
    `).bind(chainId).first();

    if (!chain) {
      return Response.json({
        success: false,
        error: 'Chain not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Get chain staff access records (REAL DATA - already implemented)
    const staffResult = await env.TENANTS_DB.prepare(`
      SELECT
        id, staff_name, role, can_access_all_locations,
        accessible_location_ids, is_active, created_at
      FROM location_group_staff_access
      WHERE location_group_id = ?
      ORDER BY staff_name ASC
    `).bind(chain.id).all();

    const staff = staffResult.results.map((row: any) => ({
      id: row.id,
      staffName: row.staff_name,
      role: row.role,
      canAccessAllLocations: row.can_access_all_locations === 1,
      accessibleLocations: row.accessible_location_ids ? JSON.parse(row.accessible_location_ids) : [],
      isActive: row.is_active === 1,
      createdAt: row.created_at,
    }));

    return Response.json({
      success: true,
      chainName: chain.location_group_name,
      staff,
      totalStaff: staff.length,
      activeStaff: staff.filter((s: any) => s.isActive).length,
      dataSource: 'real',
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[ChainReports] Staff report error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to generate staff report'
    }, { status: 500, headers: CORS_HEADERS });
  }
}
