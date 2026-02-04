/**
 * Simplified KOT Diagnostic - One command to rule them all
 * Run: window.kotDiag() in console
 */

import { useKDSStore } from '../stores/kdsStore';
import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';
// import { kdsOrderService } from './kdsOrderService';
import Database from '@tauri-apps/plugin-sql';
import { isTauri } from './platform';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

async function quickDiagnose() {
  console.clear(); // Clear the noise!
  console.log('🔍 KOT → KDS Quick Diagnostic\n');

  // 1. Check authentication
  const tenantId = useAuthStore.getState().user?.tenantId;
  if (!tenantId) {
    console.error('❌ NOT LOGGED IN - No tenant ID found');
    console.log('Action: Please log in first');
    return { error: 'Not logged in' };
  }
  console.log('✅ Logged in - Tenant ID:', tenantId);

  // 2. Check if we're in Tauri
  if (!isTauri()) {
    console.error('❌ NOT IN TAURI - SQLite won\'t work');
    console.log('Action: Run the app via Tauri, not web browser');
    return { error: 'Not in Tauri' };
  }
  console.log('✅ Running in Tauri');

  // 3. Check database table
  try {
    const db = await Database.load(DB_NAME);
    const tables = await db.select<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='kds_orders'`
    );

    if (tables.length === 0) {
      console.error('❌ DATABASE TABLE MISSING - kds_orders table does not exist');
      console.log('Action: Run database migrations or create table manually');
      console.log('Copy this command to create the table:');
      console.log(`
const db = await Database.load(DB_NAME);
await db.execute(\`CREATE TABLE IF NOT EXISTS kds_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    table_number INTEGER,
    order_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_running_order INTEGER NOT NULL DEFAULT 0,
    kot_sequence INTEGER,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    completed_at TEXT,
    elapsed_minutes INTEGER DEFAULT 0,
    estimated_prep_time INTEGER DEFAULT 15,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    tenant_id TEXT NOT NULL,
    UNIQUE(order_number, tenant_id)
)\`);
console.log('✅ Table created');
      `);
      return { error: 'Table missing' };
    }
    console.log('✅ kds_orders table exists');

    // Check row count
    const countResult = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM kds_orders WHERE tenant_id = $1 AND status != 'completed'`,
      [tenantId]
    );
    const dbCount = countResult[0]?.count || 0;
    console.log(`📊 Database: ${dbCount} active orders`);

    // 4. Check KDS Store
    const storeOrders = useKDSStore.getState().activeOrders;
    console.log(`📊 KDS Store: ${storeOrders.length} active orders`);

    // 5. Check POS Store
    const activeTables = usePOSStore.getState().activeTables;
    const tableCount = Object.keys(activeTables).length;
    console.log(`📊 POS Store: ${tableCount} active tables`);

    // 6. Sync check
    if (dbCount !== storeOrders.length) {
      console.warn(`⚠️ SYNC MISMATCH - Store: ${storeOrders.length}, DB: ${dbCount}`);

      if (dbCount > storeOrders.length) {
        console.log('Action: KDS Store needs to load orders from database');
        console.log('Run: await useKDSStore.getState().loadOrdersFromDb("' + tenantId + '")');
      } else if (storeOrders.length > dbCount) {
        console.log('Action: Orders in store but not persisted to database');
        console.log('This usually means SQLite writes are failing');
      }
    } else if (dbCount === 0 && storeOrders.length === 0) {
      console.log('\n💡 No orders found. Try:');
      console.log('1. Go to POS Dashboard');
      console.log('2. Add items to cart');
      console.log('3. Select a table');
      console.log('4. Click SEND KOT');
      console.log('5. Run this diagnostic again');
    } else {
      console.log('✅ Store and database are in sync');
    }

    // 7. Show latest order if any
    if (storeOrders.length > 0) {
      const latest = storeOrders[0];
      console.log('\n📋 Latest order:');
      console.log(`   ${latest.orderNumber} - Table ${latest.tableNumber || 'N/A'}`);
      console.log(`   Status: ${latest.status}`);
      console.log(`   Items: ${latest.items.length}`);
      console.log(`   Source: ${latest.source}`);
    }

    console.log('\n✅ Diagnostic complete\n');

    return {
      success: true,
      tenantId,
      database: { count: dbCount },
      store: { count: storeOrders.length },
      pos: { activeTables: tableCount },
      inSync: dbCount === storeOrders.length,
    };
  } catch (error) {
    console.error('❌ Database error:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  (window as any).kotDiag = quickDiagnose;
  console.log('[KOT Diagnostic] Type kotDiag() in console for quick check');
}

export { quickDiagnose };
