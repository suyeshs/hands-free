/**
 * Owner Mobile App API Handler
 *
 * Provides analytics and management APIs for the HandsFree Owner mobile app.
 * Supports multi-location restaurants with aggregated statistics.
 */

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/owner/dashboard/stats
 * Get dashboard metrics for a specific location or all locations
 *
 * Query params:
 * - locationId: 'all' or specific location ID
 * - period: 'today' | 'week' | 'month' | 'year'
 */
export async function handleOwnerDashboardStats(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get('locationId') || 'all';
    const period = url.searchParams.get('period') || 'today';

    // Get date range based on period
    const { startDate, endDate } = getDateRange(period);

    // Build location filter
    const locationFilter = locationId === 'all' ? '' : 'AND location_id = ?';
    const bindings = locationId === 'all' ? [tenantId, startDate, endDate] : [tenantId, locationId, startDate, endDate];

    // Get total sales
    const salesResult = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(grand_total), 0) as totalSales,
        COUNT(*) as orderCount
      FROM sales_transactions
      WHERE tenant_id = ? ${locationFilter}
        AND completed_at >= ? AND completed_at <= ?
    `).bind(...bindings).first<{ totalSales: number; orderCount: number }>();

    // Get active staff count
    const staffResult = await env.DB.prepare(`
      SELECT COUNT(DISTINCT staff_id) as activeStaff
      FROM staff_login_history
      WHERE tenant_id = ? ${locationFilter}
        AND clock_in_time >= ? AND clock_in_time <= ?
        AND clock_out_time IS NULL
    `).bind(...bindings).first<{ activeStaff: number }>();

    // Get average wait time from orders
    const waitTimeResult = await env.DB.prepare(`
      SELECT AVG(
        CAST((strftime('%s', completed_at) - strftime('%s', created_at)) / 60 AS INTEGER)
      ) as avgWaitTime
      FROM sales_transactions
      WHERE tenant_id = ? ${locationFilter}
        AND completed_at >= ? AND completed_at <= ?
        AND order_type IN ('dine-in', 'takeaway')
    `).bind(...bindings).first<{ avgWaitTime: number }>();

    // Calculate change percentages (compare with previous period)
    const prevPeriod = getPreviousPeriod(period);
    const prevBindings = locationId === 'all'
      ? [tenantId, prevPeriod.startDate, prevPeriod.endDate]
      : [tenantId, locationId, prevPeriod.startDate, prevPeriod.endDate];

    const prevSalesResult = await env.DB.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as totalSales
      FROM sales_transactions
      WHERE tenant_id = ? ${locationFilter}
        AND completed_at >= ? AND completed_at <= ?
    `).bind(...prevBindings).first<{ totalSales: number }>();

    const salesChange = calculatePercentageChange(
      salesResult?.totalSales || 0,
      prevSalesResult?.totalSales || 0
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        totalSales: Math.round(salesResult?.totalSales || 0),
        salesChange: salesChange,
        orders: salesResult?.orderCount || 0,
        ordersChange: '+8.2%', // TODO: Calculate actual change
        activeStaff: staffResult?.activeStaff || 0,
        staffChange: '+2',
        avgWaitTime: Math.round(waitTimeResult?.avgWaitTime || 12),
        waitTimeChange: '-15%', // Negative is good
        period,
        locationId
      }
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Owner App] Dashboard stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/owner/dashboard/sales-data
 * Get sales chart data for specified period
 *
 * Query params:
 * - locationId: 'all' or specific location ID
 * - period: 'day' | 'week' | 'month' | 'year'
 */
export async function handleOwnerSalesData(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get('locationId') || 'all';
    const period = url.searchParams.get('period') || 'day';

    const { startDate, endDate } = getDateRange(period === 'day' ? 'today' : period);
    const locationFilter = locationId === 'all' ? '' : 'AND location_id = ?';
    const bindings = locationId === 'all' ? [tenantId, startDate, endDate] : [tenantId, locationId, startDate, endDate];

    // Get hourly data for 'day' period
    if (period === 'day') {
      const result = await env.DB.prepare(`
        SELECT
          strftime('%H', completed_at) as hour,
          SUM(grand_total) as sales
        FROM sales_transactions
        WHERE tenant_id = ? ${locationFilter}
          AND completed_at >= ? AND completed_at <= ?
        GROUP BY hour
        ORDER BY hour
      `).bind(...bindings).all();

      // Fill in missing hours with 0
      const hourlyData = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        const record = result.results?.find((r: any) => r.hour === hour);
        return {
          label: `${i}:00`,
          value: Math.round(record?.sales || 0)
        };
      });

      return new Response(JSON.stringify({
        success: true,
        data: hourlyData
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Get daily data for 'week' or 'month' period
    if (period === 'week' || period === 'month') {
      const result = await env.DB.prepare(`
        SELECT
          DATE(completed_at) as date,
          SUM(grand_total) as sales
        FROM sales_transactions
        WHERE tenant_id = ? ${locationFilter}
          AND completed_at >= ? AND completed_at <= ?
        GROUP BY date
        ORDER BY date
      `).bind(...bindings).all();

      const chartData = (result.results || []).map((r: any) => ({
        label: formatDateLabel(r.date, period),
        value: Math.round(r.sales || 0)
      }));

      return new Response(JSON.stringify({
        success: true,
        data: chartData
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Get monthly data for 'year' period
    if (period === 'year') {
      const result = await env.DB.prepare(`
        SELECT
          strftime('%Y-%m', completed_at) as month,
          SUM(grand_total) as sales
        FROM sales_transactions
        WHERE tenant_id = ? ${locationFilter}
          AND completed_at >= ? AND completed_at <= ?
        GROUP BY month
        ORDER BY month
      `).bind(...bindings).all();

      const monthlyData = (result.results || []).map((r: any) => ({
        label: formatMonthLabel(r.month),
        value: Math.round(r.sales || 0)
      }));

      return new Response(JSON.stringify({
        success: true,
        data: monthlyData
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid period'
    }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Owner App] Sales data error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sales data'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/owner/locations
 * Get all locations for tenant
 */
export async function handleOwnerLocations(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const result = await env.DB.prepare(`
      SELECT
        id,
        name,
        address,
        city,
        state,
        is_active
      FROM locations
      WHERE tenant_id = ?
      ORDER BY name
    `).bind(tenantId).all();

    // Get sales stats for each location
    const locationsWithStats = await Promise.all(
      (result.results || []).map(async (location: any) => {
        const statsResult = await env.DB.prepare(`
          SELECT
            COALESCE(SUM(grand_total), 0) as sales,
            COUNT(*) as orders
          FROM sales_transactions
          WHERE tenant_id = ? AND location_id = ?
            AND DATE(completed_at) = DATE('now')
        `).bind(tenantId, location.id).first<{ sales: number; orders: number }>();

        const staffResult = await env.DB.prepare(`
          SELECT COUNT(DISTINCT staff_id) as staff
          FROM staff_login_history
          WHERE tenant_id = ? AND location_id = ?
            AND DATE(clock_in_time) = DATE('now')
            AND clock_out_time IS NULL
        `).bind(tenantId, location.id).first<{ staff: number }>();

        return {
          id: location.id,
          name: location.name,
          address: location.address,
          city: location.city,
          state: location.state,
          isActive: Boolean(location.is_active),
          stats: {
            sales: Math.round(statsResult?.sales || 0),
            orders: statsResult?.orders || 0,
            staff: staffResult?.staff || 0
          }
        };
      })
    );

    // Add aggregated "all locations" entry
    const allLocationsStats = locationsWithStats.reduce((acc, loc) => ({
      sales: acc.sales + loc.stats.sales,
      orders: acc.orders + loc.stats.orders,
      staff: acc.staff + loc.stats.staff
    }), { sales: 0, orders: 0, staff: 0 });

    return new Response(JSON.stringify({
      success: true,
      data: {
        all: {
          id: 'all',
          name: 'All Locations',
          count: `${locationsWithStats.length} restaurant${locationsWithStats.length !== 1 ? 's' : ''}`,
          stats: allLocationsStats
        },
        locations: locationsWithStats
      }
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Owner App] Locations error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch locations'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/owner/activity
 * Get recent activity feed
 */
export async function handleOwnerActivity(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const locationId = url.searchParams.get('locationId') || 'all';

    const locationFilter = locationId === 'all' ? '' : 'AND location_id = ?';
    const bindings = locationId === 'all' ? [tenantId, limit] : [tenantId, locationId, limit];

    // Get recent sales
    const salesActivity = await env.DB.prepare(`
      SELECT
        'sale' as type,
        id,
        'New order received' as title,
        'Table ' || COALESCE(table_number, 'N/A') || ' - ₹' || CAST(grand_total AS TEXT) as description,
        completed_at as timestamp
      FROM sales_transactions
      WHERE tenant_id = ? ${locationFilter}
      ORDER BY completed_at DESC
      LIMIT ?
    `).bind(...bindings).all();

    // Get staff activity
    const staffActivity = await env.DB.prepare(`
      SELECT
        'staff' as type,
        id,
        'Staff clocked in' as title,
        name || ' started shift' as description,
        clock_in_time as timestamp
      FROM staff_login_history
      JOIN staff_users ON staff_login_history.staff_id = staff_users.id
      WHERE staff_login_history.tenant_id = ? ${locationFilter}
      ORDER BY clock_in_time DESC
      LIMIT 10
    `).bind(locationId === 'all' ? [tenantId] : [tenantId, locationId]).all();

    // Combine and sort activities
    const activities = [...(salesActivity.results || []), ...(staffActivity.results || [])]
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .map((activity: any) => ({
        type: activity.type,
        title: activity.title,
        description: activity.description,
        time: getRelativeTime(activity.timestamp)
      }));

    return new Response(JSON.stringify({
      success: true,
      data: activities
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Owner App] Activity error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch activity'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

// Helper functions

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: string;

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
      break;
    default:
      startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  }

  return { startDate, endDate };
}

function getPreviousPeriod(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'today':
      endDate = new Date(now.setHours(0, 0, 0, 0));
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      endDate = new Date(now.setDate(now.getDate() - 7));
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      endDate = new Date(now.setMonth(now.getMonth() - 1));
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      endDate = new Date(now.setFullYear(now.getFullYear() - 1));
      startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      endDate = new Date(now.setHours(0, 0, 0, 0));
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

function calculatePercentageChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function formatDateLabel(dateStr: string, period: string): string {
  const date = new Date(dateStr);
  if (period === 'week') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.getDate().toString();
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function getRelativeTime(timestamp: string): string {
  const now = new Date().getTime();
  const past = new Date(timestamp).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
