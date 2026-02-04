/**
 * Quick D1 Sync Test Script
 * Run with: bun run test-d1-sync.ts
 *
 * Generates mock sales data and tests D1 synchronization
 */

import Database from '@tauri-apps/plugin-sql';

// You'll need to set this to your actual tenant ID
const TENANT_ID = process.env.TENANT_ID || 'your-tenant-id-here';
const D1_ENDPOINT = process.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-orders.suyesh.workers.dev';

// Use dev database for testing
const DB_NAME = "sqlite:pos-dev.db";

interface MockSale {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
}

async function generateMockSales(count: number = 5): Promise<MockSale[]> {
  console.log(`\n📝 Generating ${count} mock sales...`);

  const db = await Database.load(DB_NAME);
  const sales: MockSale[] = [];

  for (let i = 0; i < count; i++) {
    const id = `test-sale-${Date.now()}-${i}`;
    const invoiceNumber = `TEST-${Date.now()}-${i}`;
    const subtotal = Math.floor(Math.random() * 1000) + 200;
    const tax = subtotal * 0.05;
    const grandTotal = subtotal + tax;
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO sales_transactions (
        id, tenant_id, invoice_number, order_number, order_type, table_number,
        source, subtotal, service_charge, cgst, sgst, discount, round_off,
        grand_total, payment_method, payment_status, items_json, cashier_name,
        staff_id, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        TENANT_ID,
        invoiceNumber,
        `ORD-${Date.now()}-${i}`,
        'dine-in',
        Math.floor(Math.random() * 20) + 1,
        'pos',
        subtotal,
        0,
        tax / 2,
        tax / 2,
        0,
        0,
        grandTotal,
        'cash',
        'completed',
        JSON.stringify([{
          id: `item-${i}`,
          menuItem: { name: `Test Item ${i}`, price: subtotal },
          quantity: 1,
          subtotal: subtotal,
        }]),
        'CLI Test',
        'test-staff',
        now,
        now,
      ]
    );

    sales.push({ id, invoiceNumber, grandTotal });
    console.log(`  ✅ Created sale: ${invoiceNumber} - Rs.${grandTotal.toFixed(2)}`);
  }

  return sales;
}

async function syncToD1(sales: MockSale[]): Promise<void> {
  console.log(`\n🔄 Syncing ${sales.length} sales to D1...`);

  try {
    const response = await fetch(`${D1_ENDPOINT}/api/sync/${TENANT_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataType: 'sales',
        records: sales.map(s => ({
          id: s.id,
          invoice_number: s.invoiceNumber,
          grand_total: s.grandTotal,
          tenant_id: TENANT_ID,
          // ... other fields would be here in real sync
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`  ✅ Sync successful:`, result);

  } catch (error) {
    console.error(`  ❌ Sync failed:`, error);
    throw error;
  }
}

async function checkLocalSales(): Promise<void> {
  console.log(`\n📊 Checking local database...`);

  const db = await Database.load(DB_NAME);

  const total = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM sales_transactions WHERE tenant_id = ?`,
    [TENANT_ID]
  );

  const testSales = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM sales_transactions WHERE id LIKE 'test-sale-%'`
  );

  const recent = await db.select<any[]>(
    `SELECT invoice_number, grand_total, completed_at
     FROM sales_transactions
     WHERE tenant_id = ?
     ORDER BY completed_at DESC
     LIMIT 5`,
    [TENANT_ID]
  );

  console.log(`  📈 Total sales: ${total[0]?.count || 0}`);
  console.log(`  🧪 Test sales: ${testSales[0]?.count || 0}`);
  console.log(`  📝 Recent sales:`);
  recent.forEach((sale: any) => {
    console.log(`     ${sale.invoice_number}: Rs.${sale.grand_total} (${new Date(sale.completed_at).toLocaleString()})`);
  });
}

async function cleanupTestData(): Promise<void> {
  console.log(`\n🧹 Cleaning up test data...`);

  const db = await Database.load(DB_NAME);

  const result = await db.execute(
    `DELETE FROM sales_transactions WHERE id LIKE 'test-sale-%' OR invoice_number LIKE 'TEST-%'`
  );

  console.log(`  ✅ Deleted ${result.rowsAffected || 0} test records`);
}

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║       D1 Sync Quick Test Script           ║
╚════════════════════════════════════════════╝
  `);

  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`Database: ${DB_NAME}`);
  console.log(`D1 Endpoint: ${D1_ENDPOINT}`);

  const args = process.argv.slice(2);
  const command = args[0] || 'test';

  try {
    switch (command) {
      case 'test':
        console.log(`\n🚀 Running full test...`);
        await checkLocalSales();
        const sales = await generateMockSales(5);
        await syncToD1(sales);
        await checkLocalSales();
        console.log(`\n✅ Test complete! Check your D1 database to verify sync.`);
        break;

      case 'generate':
        const count = parseInt(args[1]) || 5;
        await generateMockSales(count);
        console.log(`\n✅ Generated ${count} mock sales.`);
        break;

      case 'check':
        await checkLocalSales();
        break;

      case 'cleanup':
        await cleanupTestData();
        break;

      case 'sync':
        console.log(`\n🔄 Syncing existing test sales...`);
        const db = await Database.load(DB_NAME);
        const testSales = await db.select<any[]>(
          `SELECT id, invoice_number, grand_total
           FROM sales_transactions
           WHERE id LIKE 'test-sale-%'`
        );
        if (testSales.length === 0) {
          console.log(`  ⚠️  No test sales found. Run 'generate' first.`);
        } else {
          await syncToD1(testSales);
        }
        break;

      default:
        console.log(`
Available commands:
  test      - Generate mock sales and sync to D1 (default)
  generate  - Generate mock sales only (optionally specify count)
  check     - Check local database stats
  sync      - Sync existing test sales to D1
  cleanup   - Delete all test data

Examples:
  bun run test-d1-sync.ts test
  bun run test-d1-sync.ts generate 10
  bun run test-d1-sync.ts cleanup

Environment variables:
  TENANT_ID           - Your tenant ID (required)
  VITE_ORDERS_ENDPOINT - D1 sync endpoint URL
        `);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
