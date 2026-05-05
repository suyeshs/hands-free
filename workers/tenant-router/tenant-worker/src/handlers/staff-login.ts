/**
 * Staff Login History Handler
 * Manages staff login audit trail in D1
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Sync configuration for staff_login_history table
const staffLoginHistorySyncConfig: SyncTableConfig = {
  tableName: 'staff_login_history',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'login_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'staffId', target: 'staff_id', type: 'TEXT', required: true },
    { source: 'loginAt', target: 'login_at', type: 'TEXT', required: true },
    { source: 'deviceId', target: 'device_id', type: 'TEXT' },
    {
      source: 'success',
      target: 'success',
      type: 'INTEGER',
      required: true,
      transform: (val) => val ? 1 : 0
    },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[StaffLogin] Synced ${result.synced}/${result.totalRecords} login records in ${result.duration}ms`);
    }
  }
};

/**
 * POST /staff/login-history/sync - Sync staff login history from POS to D1 using SyncEngine
 */
export async function handleStaffLoginHistorySync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { loginHistory: any[] };
    const loginHistory = body.loginHistory || [];

    if (loginHistory.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(staffLoginHistorySyncConfig, loginHistory);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[StaffLogin] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync staff login history',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
