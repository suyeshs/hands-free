/**
 * Sync Metrics Handler
 *
 * Provides observability into sync engine performance across all tables.
 * Tracks metrics like sync duration, error rates, and throughput.
 */

import { createSyncEngine } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /sync/metrics - Get sync health metrics
 */
export async function handleSyncMetrics(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const syncEngine = createSyncEngine(env.DB, tenantId);
    const metrics = syncEngine.getMetrics();

    // Calculate aggregates
    const totalSyncs = metrics.length;
    const avgDuration = totalSyncs > 0
      ? metrics.reduce((sum, m) => sum + m.totalDuration, 0) / totalSyncs
      : 0;
    const avgErrorRate = totalSyncs > 0
      ? metrics.reduce((sum, m) => sum + m.errorRate, 0) / totalSyncs
      : 0;

    // Group by table
    const byTable: Record<string, any> = {};
    metrics.forEach(m => {
      if (!byTable[m.tableName]) {
        byTable[m.tableName] = {
          tableName: m.tableName,
          totalRecords: 0,
          totalSynced: 0,
          totalFailed: 0,
          avgDuration: 0,
          avgBatchTime: 0,
          syncs: 0,
          errorRate: 0,
        };
      }
      byTable[m.tableName].totalRecords += m.recordsProcessed;
      byTable[m.tableName].totalSynced += m.recordsSynced;
      byTable[m.tableName].totalFailed += m.recordsFailed;
      byTable[m.tableName].avgDuration += m.totalDuration;
      byTable[m.tableName].avgBatchTime += m.averageBatchTime;
      byTable[m.tableName].syncs++;
    });

    // Calculate averages for each table
    Object.values(byTable).forEach((table: any) => {
      table.avgDuration = Math.round(table.avgDuration / table.syncs);
      table.avgBatchTime = Math.round(table.avgBatchTime / table.syncs);
      table.errorRate = table.totalRecords > 0
        ? (table.totalFailed / table.totalRecords).toFixed(4)
        : '0.0000';
    });

    return Response.json({
      success: true,
      metrics: {
        totalSyncs,
        averageDuration: Math.round(avgDuration),
        averageErrorRate: avgErrorRate.toFixed(4),
        byTable: Object.values(byTable),
        recentSyncs: metrics.slice(-10).map(m => ({
          timestamp: m.timestamp,
          tableName: m.tableName,
          recordsProcessed: m.recordsProcessed,
          recordsSynced: m.recordsSynced,
          recordsFailed: m.recordsFailed,
          duration: m.totalDuration,
          errorRate: m.errorRate.toFixed(4),
        })),
      },
    }, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[SyncMetrics] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get sync metrics',
    }, {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * DELETE /sync/metrics - Clear sync metrics
 */
export async function handleSyncMetricsClear(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const syncEngine = createSyncEngine(env.DB, tenantId);
    syncEngine.clearMetrics();

    return Response.json({
      success: true,
      message: 'Sync metrics cleared',
    }, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[SyncMetrics] Clear error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to clear sync metrics',
    }, {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
}
