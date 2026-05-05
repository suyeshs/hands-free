/**
 * Cash Management Handler
 * Manages cash registers and payouts in D1
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

// Sync configuration for daily_cash_registers table
const dailyCashRegistersSyncConfig: SyncTableConfig = {
  tableName: 'daily_cash_registers',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['business_date'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'businessDate', target: 'business_date', type: 'TEXT', required: true },
    { source: 'openingCash', target: 'opening_cash', type: 'REAL', required: true },
    { source: 'openedAt', target: 'opened_at', type: 'TEXT', required: true },
    { source: 'openedBy', target: 'opened_by', type: 'TEXT' },
    { source: 'expectedClosingCash', target: 'expected_closing_cash', type: 'REAL' },
    { source: 'actualClosingCash', target: 'actual_closing_cash', type: 'REAL' },
    { source: 'cashVariance', target: 'cash_variance', type: 'REAL' },
    { source: 'closedAt', target: 'closed_at', type: 'TEXT' },
    { source: 'closedBy', target: 'closed_by', type: 'TEXT' },
    { source: 'status', target: 'status', type: 'TEXT', required: true },
    { source: 'notes', target: 'notes', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 50,
  hooks: {
    afterSync: async (result) => {
      console.log(`[CashRegisters] Synced ${result.synced}/${result.totalRecords} cash registers in ${result.duration}ms`);
    }
  }
};

// Sync configuration for cash_payouts table
const cashPayoutsSyncConfig: SyncTableConfig = {
  tableName: 'cash_payouts',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'businessDate', target: 'business_date', type: 'TEXT', required: true },
    { source: 'amount', target: 'amount', type: 'REAL', required: true },
    { source: 'payoutType', target: 'payout_type', type: 'TEXT', required: true },
    { source: 'category', target: 'category', type: 'TEXT' },
    { source: 'description', target: 'description', type: 'TEXT' },
    { source: 'referenceNumber', target: 'reference_number', type: 'TEXT' },
    { source: 'recordedBy', target: 'recorded_by', type: 'TEXT', required: true },
    { source: 'authorizedBy', target: 'authorized_by', type: 'TEXT' },
    { source: 'status', target: 'status', type: 'TEXT', required: true },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[CashPayouts] Synced ${result.synced}/${result.totalRecords} payouts in ${result.duration}ms`);
    }
  }
};

/**
 * POST /cash-registers/sync - Sync daily cash registers from POS to D1 using SyncEngine
 */
export async function handleCashRegistersSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { cashRegisters: any[] };
    const cashRegisters = body.cashRegisters || [];

    if (cashRegisters.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(dailyCashRegistersSyncConfig, cashRegisters);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[CashRegisters] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync cash registers',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /cash-payouts/sync - Sync cash payouts from POS to D1 using SyncEngine
 */
export async function handleCashPayoutsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { payouts: any[] };
    const payouts = body.payouts || [];

    if (payouts.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(cashPayoutsSyncConfig, payouts);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[CashPayouts] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync cash payouts',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
