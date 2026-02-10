/**
 * Staff Mobile App API Handler
 *
 * Provides attendance tracking and manager operations APIs for the HandsFree Staff mobile app.
 * Uses Durable Objects for real-time Kitchen Display System (KDS) updates.
 */

interface Env {
  DB: D1Database;
  KDS_COORDINATOR: DurableObjectNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * POST /api/staff/attendance/clock-in
 * Clock in staff member
 */
export async function handleStaffClockIn(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      staffId: string;
      locationId?: string;
      deviceId?: string;
    };

    const now = new Date().toISOString();
    const clockInId = crypto.randomUUID();

    // Insert clock-in record
    await env.DB.prepare(`
      INSERT INTO staff_login_history (
        id,
        tenant_id,
        staff_id,
        location_id,
        device_id,
        clock_in_time
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      clockInId,
      tenantId,
      body.staffId,
      body.locationId || null,
      body.deviceId || null,
      now
    ).run();

    // Update staff last_login_at
    await env.DB.prepare(`
      UPDATE staff_users
      SET last_login_at = ?
      WHERE id = ? AND tenant_id = ?
    `).bind(
      Math.floor(Date.now() / 1000),
      body.staffId,
      tenantId
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        clockInId,
        clockInTime: now
      }
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Staff App] Clock in error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clock in'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/staff/attendance/clock-out
 * Clock out staff member
 */
export async function handleStaffClockOut(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      staffId: string;
      locationId?: string;
    };

    const now = new Date().toISOString();

    // Update most recent clock-in record
    const result = await env.DB.prepare(`
      UPDATE staff_login_history
      SET clock_out_time = ?
      WHERE tenant_id = ? AND staff_id = ?
        ${body.locationId ? 'AND location_id = ?' : ''}
        AND clock_out_time IS NULL
      ORDER BY clock_in_time DESC
      LIMIT 1
    `).bind(
      now,
      tenantId,
      body.staffId,
      ...(body.locationId ? [body.locationId] : [])
    ).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No active clock-in found'
      }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        clockOutTime: now
      }
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Staff App] Clock out error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clock out'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/staff/attendance/stats
 * Get attendance stats for staff member
 *
 * Query params:
 * - staffId: Staff ID
 * - period: 'today' | 'week' | 'month'
 */
export async function handleStaffAttendanceStats(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const staffId = url.searchParams.get('staffId');
    const period = url.searchParams.get('period') || 'today';

    if (!staffId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'staffId is required'
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const { startDate, endDate } = getDateRange(period);

    // Get current clock-in status
    const currentSession = await env.DB.prepare(`
      SELECT
        id,
        clock_in_time,
        clock_out_time
      FROM staff_login_history
      WHERE tenant_id = ? AND staff_id = ?
        AND clock_out_time IS NULL
      ORDER BY clock_in_time DESC
      LIMIT 1
    `).bind(tenantId, staffId).first<{
      id: string;
      clock_in_time: string;
      clock_out_time: string | null;
    }>();

    const isClockedIn = !!currentSession;
    let duration = '0h 0m';

    if (isClockedIn && currentSession) {
      const clockInTime = new Date(currentSession.clock_in_time).getTime();
      const now = Date.now();
      const diffMs = now - clockInTime;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      duration = `${hours}h ${minutes}m`;
    }

    // Get today's stats
    const todayStats = await env.DB.prepare(`
      SELECT
        SUM(
          CASE
            WHEN clock_out_time IS NOT NULL
            THEN (strftime('%s', clock_out_time) - strftime('%s', clock_in_time)) / 3600.0
            ELSE (strftime('%s', 'now') - strftime('%s', clock_in_time)) / 3600.0
          END
        ) as hoursWorked
      FROM staff_login_history
      WHERE tenant_id = ? AND staff_id = ?
        AND DATE(clock_in_time) = DATE('now')
    `).bind(tenantId, staffId).first<{ hoursWorked: number }>();

    // Get today's tips
    const tipsStats = await env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) as tipsEarned
      FROM tips
      WHERE tenant_id = ? AND staff_id = ?
        AND DATE(created_at) = DATE('now')
    `).bind(tenantId, staffId).first<{ tipsEarned: number }>();

    // Get today's tables served (from sales transactions)
    const tablesStats = await env.DB.prepare(`
      SELECT COUNT(DISTINCT table_number) as tablesServed
      FROM sales_transactions
      WHERE tenant_id = ? AND staff_id = ?
        AND DATE(completed_at) = DATE('now')
        AND table_number IS NOT NULL
    `).bind(tenantId, staffId).first<{ tablesServed: number }>();

    // Get weekly stats
    const weeklyStats = await env.DB.prepare(`
      SELECT
        SUM(
          CASE
            WHEN clock_out_time IS NOT NULL
            THEN (strftime('%s', clock_out_time) - strftime('%s', clock_in_time)) / 3600.0
            ELSE 0
          END
        ) as totalHours
      FROM staff_login_history
      WHERE tenant_id = ? AND staff_id = ?
        AND clock_in_time >= ? AND clock_in_time <= ?
    `).bind(tenantId, staffId, startDate, endDate).first<{ totalHours: number }>();

    const weeklyTips = await env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalTips
      FROM tips
      WHERE tenant_id = ? AND staff_id = ?
        AND created_at >= ? AND created_at <= ?
    `).bind(tenantId, staffId, startDate, endDate).first<{ totalTips: number }>();

    const weeklyTables = await env.DB.prepare(`
      SELECT COUNT(DISTINCT table_number) as totalTables
      FROM sales_transactions
      WHERE tenant_id = ? AND staff_id = ?
        AND completed_at >= ? AND completed_at <= ?
        AND table_number IS NOT NULL
    `).bind(tenantId, staffId, startDate, endDate).first<{ totalTables: number }>();

    const hours = Math.floor(todayStats?.hoursWorked || 0);
    const minutes = Math.floor(((todayStats?.hoursWorked || 0) % 1) * 60);

    return new Response(JSON.stringify({
      success: true,
      data: {
        clockState: {
          isClockedIn,
          clockInTime: currentSession?.clock_in_time || null,
          duration
        },
        today: {
          hoursWorked: `${hours}h ${minutes}m`,
          tipsEarned: Math.round(tipsStats?.tipsEarned || 0),
          tablesServed: tablesStats?.tablesServed || 0,
          rating: 4.8 // TODO: Implement actual rating system
        },
        weekly: {
          totalHours: `${Math.floor(weeklyStats?.totalHours || 0)}h ${Math.floor(((weeklyStats?.totalHours || 0) % 1) * 60)}m`,
          totalTips: Math.round(weeklyTips?.totalTips || 0),
          tablesServed: weeklyTables?.totalTables || 0,
          avgRating: 4.7
        }
      }
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Staff App] Attendance stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attendance stats'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/staff/kds/orders
 * Get active kitchen orders (Manager mode)
 *
 * Query params:
 * - locationId: Optional location filter
 */
export async function handleKDSOrders(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get('locationId');

    // Get KDS Coordinator Durable Object
    const kdsId = env.KDS_COORDINATOR.idFromName(`${tenantId}${locationId ? `-${locationId}` : ''}`);
    const kdsStub = env.KDS_COORDINATOR.get(kdsId);

    // Forward request to Durable Object
    const kdsUrl = new URL(request.url);
    kdsUrl.pathname = '/orders';

    return await kdsStub.fetch(kdsUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });
  } catch (error) {
    console.error('[Staff App] KDS orders error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch KDS orders'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/staff/kds/orders/:orderId/ready
 * Mark order as ready
 */
export async function handleKDSOrderReady(
  request: Request,
  env: Env,
  tenantId: string,
  orderId: string
): Promise<Response> {
  try {
    const body = await request.json() as { locationId?: string };

    // Get KDS Coordinator Durable Object
    const kdsId = env.KDS_COORDINATOR.idFromName(`${tenantId}${body.locationId ? `-${body.locationId}` : ''}`);
    const kdsStub = env.KDS_COORDINATOR.get(kdsId);

    // Forward to Durable Object
    return await kdsStub.fetch(new URL(request.url).origin, {
      method: 'POST',
      headers: { ...request.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-ready', orderId })
    });
  } catch (error) {
    console.error('[Staff App] Mark order ready error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark order ready'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/staff/kds/orders/:orderId/delay
 * Report order delay
 */
export async function handleKDSOrderDelay(
  request: Request,
  env: Env,
  tenantId: string,
  orderId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      locationId?: string;
      delayMinutes?: number;
      reason?: string;
    };

    // Get KDS Coordinator Durable Object
    const kdsId = env.KDS_COORDINATOR.idFromName(`${tenantId}${body.locationId ? `-${body.locationId}` : ''}`);
    const kdsStub = env.KDS_COORDINATOR.get(kdsId);

    // Forward to Durable Object
    return await kdsStub.fetch(new URL(request.url).origin, {
      method: 'POST',
      headers: { ...request.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'report-delay',
        orderId,
        delayMinutes: body.delayMinutes || 5,
        reason: body.reason
      })
    });
  } catch (error) {
    console.error('[Staff App] Report delay error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to report delay'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/staff/team/status
 * Get team member status (Manager mode)
 *
 * Query params:
 * - locationId: Optional location filter
 */
export async function handleTeamStatus(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get('locationId');

    const locationFilter = locationId ? 'AND h.location_id = ?' : '';
    const bindings = locationId ? [tenantId, locationId] : [tenantId];

    // Get active staff members
    const result = await env.DB.prepare(`
      SELECT
        s.id,
        s.name,
        s.role,
        h.clock_in_time,
        COUNT(DISTINCT st.table_number) as tables
      FROM staff_users s
      LEFT JOIN staff_login_history h ON s.id = h.staff_id
        AND h.tenant_id = s.tenant_id
        AND DATE(h.clock_in_time) = DATE('now')
        AND h.clock_out_time IS NULL
      LEFT JOIN sales_transactions st ON s.id = st.staff_id
        AND st.tenant_id = s.tenant_id
        AND DATE(st.completed_at) = DATE('now')
        AND st.table_number IS NOT NULL
      WHERE s.tenant_id = ?  ${locationFilter}
        AND s.is_active = 1
      GROUP BY s.id, s.name, s.role, h.clock_in_time
      ORDER BY s.name
    `).bind(...bindings).all();

    const teamMembers = (result.results || []).map((member: any) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      status: member.clock_in_time ? 'Active' : 'Offline',
      tables: member.tables || 0,
      clockedIn: !!member.clock_in_time
    }));

    // Get operations overview
    const opsResult = await env.DB.prepare(`
      SELECT
        COUNT(*) as activeOrders,
        SUM(grand_total) as salesTotal,
        AVG(
          CAST((strftime('%s', completed_at) - strftime('%s', created_at)) / 60 AS INTEGER)
        ) as avgPrepTime
      FROM sales_transactions
      WHERE tenant_id = ? ${locationFilter}
        AND DATE(completed_at) = DATE('now')
        AND payment_status = 'completed'
    `).bind(...bindings).first<{
      activeOrders: number;
      salesTotal: number;
      avgPrepTime: number;
    }>();

    const staffOnline = teamMembers.filter(m => m.clockedIn).length;

    return new Response(JSON.stringify({
      success: true,
      data: {
        overview: {
          activeOrders: opsResult?.activeOrders || 0,
          staffOnline,
          salesTotal: Math.round(opsResult?.salesTotal || 0),
          avgPrepTime: Math.round(opsResult?.avgPrepTime || 14)
        },
        team: teamMembers
      }
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Staff App] Team status error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch team status'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/staff/kds/ws
 * WebSocket endpoint for real-time KDS updates
 */
export async function handleKDSWebSocket(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get('locationId');

    // Upgrade to WebSocket
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // Get KDS Coordinator Durable Object
    const kdsId = env.KDS_COORDINATOR.idFromName(`${tenantId}${locationId ? `-${locationId}` : ''}`);
    const kdsStub = env.KDS_COORDINATOR.get(kdsId);

    // Forward WebSocket connection to Durable Object
    return await kdsStub.fetch(request);
  } catch (error) {
    console.error('[Staff App] KDS WebSocket error:', error);
    return new Response('Failed to establish WebSocket connection', { status: 500 });
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
    default:
      startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  }

  return { startDate, endDate };
}
