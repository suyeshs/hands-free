/**
 * KDS Debug Utilities
 * Helper functions to diagnose KOT to KDS workflow issues
 */

import { useKDSStore } from '../stores/kdsStore';
import { kdsOrderService } from './kdsOrderService';
import Database from '@tauri-apps/plugin-sql';
import { isTauri } from './platform';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

/**
 * Debug utility: Check KDS Store state
 */
export function inspectKDSStore() {
  const state = useKDSStore.getState();
  console.log('=== KDS STORE STATE ===');
  console.log('Active Orders:', state.activeOrders.length);
  console.log('Completed Orders:', state.completedOrders.length);
  console.log('Selected Station:', state.selectedStation);
  console.log('\nActive Orders Details:');
  state.activeOrders.forEach((order, i) => {
    console.log(`  ${i + 1}. ${order.orderNumber} (${order.id})`);
    console.log(`     Table: ${order.tableNumber || 'N/A'}, Status: ${order.status}`);
    console.log(`     Items: ${order.items.length}, Source: ${order.source}`);
    console.log(`     Running Order: ${order.isRunningOrder ? `Yes (KOT #${order.kotSequence})` : 'No'}`);
  });
  console.log('=======================\n');

  return {
    activeCount: state.activeOrders.length,
    completedCount: state.completedOrders.length,
    activeOrders: state.activeOrders,
  };
}

/**
 * Debug utility: Check if kds_orders table exists and get row count
 */
export async function inspectKDSDatabase(tenantId: string) {
  if (!isTauri()) {
    console.warn('[KDS Debug] Not running in Tauri, skipping database inspection');
    return null;
  }

  try {
    const db = await Database.load(DB_NAME);

    console.log('=== KDS DATABASE INSPECTION ===');

    // Check if table exists
    const tables = await db.select<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='kds_orders'`
    );

    if (tables.length === 0) {
      console.error('❌ kds_orders table DOES NOT EXIST!');
      console.log('This is likely a migration issue. The table should have been created by migration 005_kds_orders.sql');
      return { tableExists: false };
    }

    console.log('✅ kds_orders table exists');

    // Get schema
    const schema = await db.select<{ name: string; type: string }[]>(
      `PRAGMA table_info(kds_orders)`
    );
    console.log('\nTable Schema:');
    schema.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}`);
    });

    // Get row counts
    const totalCount = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM kds_orders WHERE tenant_id = $1`,
      [tenantId]
    );

    const activeCount = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM kds_orders WHERE tenant_id = $1 AND status != 'completed'`,
      [tenantId]
    );

    const completedCount = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM kds_orders WHERE tenant_id = $1 AND status = 'completed'`,
      [tenantId]
    );

    console.log(`\nOrder Counts for tenant ${tenantId}:`);
    console.log(`  Total: ${totalCount[0].count}`);
    console.log(`  Active: ${activeCount[0].count}`);
    console.log(`  Completed: ${completedCount[0].count}`);

    // Get recent orders
    const recentOrders = await db.select<any[]>(
      `SELECT id, order_number, table_number, order_type, status, created_at
       FROM kds_orders
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [tenantId]
    );

    console.log('\nRecent Orders (last 10):');
    if (recentOrders.length === 0) {
      console.log('  (No orders found)');
    } else {
      recentOrders.forEach((order, i) => {
        console.log(`  ${i + 1}. ${order.order_number} - Table ${order.table_number || 'N/A'} - ${order.status} (${order.created_at})`);
      });
    }

    console.log('================================\n');

    return {
      tableExists: true,
      schema,
      counts: {
        total: totalCount[0].count,
        active: activeCount[0].count,
        completed: completedCount[0].count,
      },
      recentOrders,
    };
  } catch (error) {
    console.error('❌ Error inspecting database:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Debug utility: Load orders from database and compare with store
 */
export async function syncDebugCheck(tenantId: string) {
  console.log('=== KDS SYNC DEBUG CHECK ===');

  // Get store state
  const storeState = useKDSStore.getState();
  console.log(`Store has ${storeState.activeOrders.length} active orders`);

  // Load from database
  try {
    const dbOrders = await kdsOrderService.getActiveOrders(tenantId);
    console.log(`Database has ${dbOrders.length} active orders`);

    if (storeState.activeOrders.length !== dbOrders.length) {
      console.warn(`⚠️ MISMATCH: Store has ${storeState.activeOrders.length} orders, DB has ${dbOrders.length}`);

      // Find missing orders
      const storeIds = new Set(storeState.activeOrders.map(o => o.id));
      const dbIds = new Set(dbOrders.map(o => o.id));

      const missingInStore = dbOrders.filter(o => !storeIds.has(o.id));
      const missingInDb = storeState.activeOrders.filter(o => !dbIds.has(o.id));

      if (missingInStore.length > 0) {
        console.log('\nOrders in DB but not in Store:');
        missingInStore.forEach(o => console.log(`  - ${o.orderNumber} (${o.id})`));
      }

      if (missingInDb.length > 0) {
        console.log('\nOrders in Store but not in DB:');
        missingInDb.forEach(o => console.log(`  - ${o.orderNumber} (${o.id})`));
      }
    } else {
      console.log('✅ Store and database are in sync');
    }

    console.log('===========================\n');

    return {
      storeCount: storeState.activeOrders.length,
      dbCount: dbOrders.length,
      inSync: storeState.activeOrders.length === dbOrders.length,
    };
  } catch (error) {
    console.error('❌ Error during sync check:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Run a full diagnostic check
 */
export async function runFullDiagnostic(tenantId: string) {
  console.log('\n🔍 RUNNING FULL KDS DIAGNOSTIC 🔍\n');

  // 1. Check store state
  const storeInfo = inspectKDSStore();

  // 2. Check database
  const dbInfo = await inspectKDSDatabase(tenantId);

  // 3. Check sync
  const syncInfo = await syncDebugCheck(tenantId);

  console.log('\n📊 DIAGNOSTIC SUMMARY 📊');
  console.log('Store Active Orders:', storeInfo.activeCount);
  console.log('Database Active Orders:', dbInfo?.counts?.active ?? 'N/A');
  console.log('In Sync:', syncInfo.inSync ? '✅' : '❌');

  if (dbInfo && !dbInfo.tableExists) {
    console.error('\n🚨 CRITICAL: kds_orders table does not exist!');
    console.log('Action Required: Run database migrations');
  }

  console.log('\n');

  return {
    store: storeInfo,
    database: dbInfo,
    sync: syncInfo,
  };
}

// Make these available globally for easy debugging
if (typeof window !== 'undefined') {
  (window as any).kdsDebug = {
    inspectStore: inspectKDSStore,
    inspectDatabase: inspectKDSDatabase,
    syncCheck: syncDebugCheck,
    fullDiagnostic: runFullDiagnostic,
  };
  console.log('[KDS Debug] Debug utilities loaded. Use window.kdsDebug in console.');
}
