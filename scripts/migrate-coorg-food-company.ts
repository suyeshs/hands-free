#!/usr/bin/env bun
/**
 * Migration Script for coorg-food-company-6163
 *
 * Migrates v1.0 database to current schema:
 * - Exports sales data from table_sessions (JSON format)
 * - Transforms to structured sales_transactions
 * - Imports staff, menu, and sales data
 * - Creates backup before committing
 *
 * Usage:
 *   bun scripts/migrate-coorg-food-company.ts
 */

import Database from "@tauri-apps/plugin-sql";
import { readFileSync, writeFileSync, existsSync, copyFileSync, renameSync } from "fs";
import { join } from "path";

// Constants
const TENANT_ID = "coorg-food-company-6163";
const OLD_DB_NAME = "sqlite:pos.db"; // v1.0 database
const NEW_DB_NAME = "sqlite:guanix.db"; // Current database

// Types
interface V1TableSession {
  id: string;
  tenant_id: string;
  table_number: number;
  guest_count: number;
  server_name: string;
  started_at: string;
  closed_at: string;
  status: string;
  order_data: string; // JSON
}

interface V1StaffUser {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  pin_hash: string;
  is_active: number;
  permissions: string;
  created_at: string;
  last_login_at: string;
  created_by: string;
}

interface SalesTransaction {
  id: string;
  tenant_id: string;
  invoice_number: string;
  order_type: string;
  table_number: number;
  source: string;
  subtotal: number;
  service_charge: number;
  cgst: number;
  sgst: number;
  discount: number;
  round_off: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  items_json: string;
  cashier_name: string;
  created_at: string;
  completed_at: string;
}

interface ExportData {
  version: string;
  exportDate: string;
  tenantId: string;
  closedSales: V1TableSession[];
  activeSessions: V1TableSession[];
  staff: V1StaffUser[];
  metadata: {
    totalSales: number;
    totalStaff: number;
    oldestSale?: string;
    newestSale?: string;
  };
}

// Helper Functions
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function transformTableSessionToSalesTransaction(
  session: V1TableSession,
  invoiceCounter: number
): SalesTransaction {
  const orderData = JSON.parse(session.order_data || '{}');

  // Generate invoice number
  const invoiceNumber = `MIG-${String(invoiceCounter).padStart(6, '0')}`;

  // Calculate taxes (2.5% CGST + 2.5% SGST = 5% GST)
  const subtotal = orderData.subtotal || 0;
  const cgst = subtotal * 0.025;
  const sgst = subtotal * 0.025;
  const serviceCharge = 0; // v1.0 didn't have service charge

  // Calculate round-off
  const beforeRound = subtotal + cgst + sgst + serviceCharge - (orderData.discount || 0);
  const grandTotal = Math.round(beforeRound);
  const roundOff = grandTotal - beforeRound;

  return {
    id: session.id,
    tenant_id: TENANT_ID,
    invoice_number: invoiceNumber,
    order_type: orderData.orderType || 'dine-in',
    table_number: session.table_number,
    source: 'pos',
    subtotal,
    service_charge: serviceCharge,
    cgst,
    sgst,
    discount: orderData.discount || 0,
    round_off: roundOff,
    grand_total: grandTotal,
    payment_method: 'cash', // v1.0 default
    payment_status: 'completed',
    items_json: JSON.stringify(orderData.items || []),
    cashier_name: session.server_name || '',
    created_at: session.started_at,
    completed_at: session.closed_at,
  };
}

// Main Migration Functions
async function exportV1Data(): Promise<ExportData> {
  log('Connecting to v1.0 database...');
  const db = await Database.load(OLD_DB_NAME);

  try {
    log('Exporting sales data (closed orders)...');
    const closedSales = await db.select<V1TableSession[]>(
      'SELECT * FROM table_sessions WHERE status = "closed" ORDER BY closed_at'
    );

    log(`Found ${closedSales.length} closed sales`);

    log('Exporting active sessions...');
    const activeSessions = await db.select<V1TableSession[]>(
      'SELECT * FROM table_sessions WHERE status = "active"'
    );

    log(`Found ${activeSessions.length} active sessions`);

    log('Exporting staff users...');
    const staff = await db.select<V1StaffUser[]>(
      'SELECT * FROM staff_users ORDER BY created_at'
    );

    log(`Found ${staff.length} staff users`);

    const exportData: ExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      tenantId: TENANT_ID,
      closedSales,
      activeSessions,
      staff,
      metadata: {
        totalSales: closedSales.length,
        totalStaff: staff.length,
        oldestSale: closedSales[0]?.started_at,
        newestSale: closedSales[closedSales.length - 1]?.closed_at,
      },
    };

    return exportData;
  } finally {
    await db.close();
  }
}

async function createBackup(exportData: ExportData): Promise<{ dbPath: string; jsonPath: string }> {
  log('Creating backup...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

  // Note: This assumes running in Node/Bun environment, not Tauri
  // For Tauri, use appDataDir() from @tauri-apps/api/path
  const backupDbPath = `pos-v1-backup-${timestamp}.db`;
  const exportJsonPath = `migration-export-${timestamp}.json`;

  // Copy database file
  if (existsSync('pos.db')) {
    copyFileSync('pos.db', backupDbPath);
    log(`Database backed up to: ${backupDbPath}`, 'success');
  } else {
    log('Warning: pos.db not found for backup', 'warn');
  }

  // Save export JSON
  writeFileSync(exportJsonPath, JSON.stringify(exportData, null, 2));
  log(`Export data saved to: ${exportJsonPath}`, 'success');

  return { dbPath: backupDbPath, jsonPath: exportJsonPath };
}

async function importToNewDatabase(exportData: ExportData): Promise<void> {
  log('Connecting to new database...');
  const db = await Database.load(NEW_DB_NAME);

  const result = { staffImported: 0, salesImported: 0, sessionsImported: 0 };

  try {
    log('Starting import...');

    // 1. Import staff users
    log('Importing staff users...');
    for (const user of exportData.staff) {
      await db.execute(
        `INSERT INTO staff_users (
          id, tenant_id, name, role, pin_hash, is_active,
          permissions, created_at, last_login_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          TENANT_ID,
          user.name,
          user.role,
          user.pin_hash,
          user.is_active,
          user.permissions,
          user.created_at,
          user.last_login_at,
          user.created_by,
        ]
      );
      result.staffImported++;
    }
    log(`Imported ${result.staffImported} staff users`, 'success');

    // 2. Transform and import sales
    log('Transforming and importing sales...');
    let invoiceNumber = 1;

    for (const session of exportData.closedSales) {
      try {
        const transaction = transformTableSessionToSalesTransaction(session, invoiceNumber++);

        await db.execute(
          `INSERT INTO sales_transactions (
            id, tenant_id, invoice_number, order_type, table_number,
            source, subtotal, service_charge, cgst, sgst, discount,
            round_off, grand_total, payment_method, payment_status,
            items_json, cashier_name, created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transaction.id,
            transaction.tenant_id,
            transaction.invoice_number,
            transaction.order_type,
            transaction.table_number,
            transaction.source,
            transaction.subtotal,
            transaction.service_charge,
            transaction.cgst,
            transaction.sgst,
            transaction.discount,
            transaction.round_off,
            transaction.grand_total,
            transaction.payment_method,
            transaction.payment_status,
            transaction.items_json,
            transaction.cashier_name,
            transaction.created_at,
            transaction.completed_at,
          ]
        );
        result.salesImported++;
      } catch (error) {
        log(`Error importing sale ${session.id}: ${error}`, 'error');
      }
    }
    log(`Imported ${result.salesImported} sales transactions`, 'success');

    // 3. Import active sessions
    log('Importing active sessions...');
    for (const session of exportData.activeSessions) {
      await db.execute(
        `INSERT INTO table_sessions (
          id, table_number, guest_count, server_name, started_at,
          status, order_data, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.table_number,
          session.guest_count,
          session.server_name,
          session.started_at,
          'active',
          session.order_data,
          TENANT_ID,
        ]
      );
      result.sessionsImported++;
    }
    log(`Imported ${result.sessionsImported} active sessions`, 'success');

    // 4. Initialize restaurant_settings
    log('Initializing restaurant settings...');
    try {
      await db.execute(
        `INSERT INTO restaurant_settings (
          id, name, invoice_prefix, current_invoice_number,
          cgst_rate, sgst_rate, device_role, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Coorg Food Company',
          'MIG',
          invoiceNumber,
          2.5,
          2.5,
          'server',
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
      log('Restaurant settings initialized', 'success');
    } catch (error) {
      log(`Restaurant settings may already exist: ${error}`, 'warn');
    }

    // 5. Ensure tenant_config exists
    log('Checking tenant configuration...');
    const existingTenantConfig = await db.select(
      'SELECT * FROM tenant_config WHERE tenant_id = ?',
      [TENANT_ID]
    );

    if (existingTenantConfig.length === 0) {
      await db.execute(
        `INSERT INTO tenant_config (
          id, tenant_id, company_name, subdomain, activated_at
        ) VALUES (1, ?, ?, ?, ?)`,
        [TENANT_ID, 'Coorg Food Company', 'coorg-food-company', new Date().toISOString()]
      );
      log('Tenant config created', 'success');
    } else {
      log('Tenant config already exists', 'info');
    }

  } finally {
    await db.close();
  }
}

async function validateMigration(exportData: ExportData): Promise<void> {
  log('Validating migration...');
  const db = await Database.load(NEW_DB_NAME);

  try {
    // Count migrated records
    const staffCount = await db.select<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM staff_users WHERE tenant_id = ?',
      [TENANT_ID]
    );

    const salesCount = await db.select<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM sales_transactions WHERE tenant_id = ?',
      [TENANT_ID]
    );

    const revenue = await db.select<Array<{ total: number }>>(
      'SELECT SUM(grand_total) as total FROM sales_transactions WHERE tenant_id = ?',
      [TENANT_ID]
    );

    const dateRange = await db.select<Array<{ oldest: string; newest: string }>>(
      'SELECT MIN(completed_at) as oldest, MAX(completed_at) as newest FROM sales_transactions WHERE tenant_id = ?',
      [TENANT_ID]
    );

    // Display validation results
    console.log('\n=== VALIDATION RESULTS ===');
    console.log(`Staff Users:`);
    console.log(`  Expected: ${exportData.staff.length}`);
    console.log(`  Actual: ${staffCount[0].count}`);
    console.log(`  Match: ${staffCount[0].count === exportData.staff.length ? '✅' : '❌'}`);

    console.log(`\nSales Transactions:`);
    console.log(`  Expected: ${exportData.closedSales.length}`);
    console.log(`  Actual: ${salesCount[0].count}`);
    console.log(`  Match: ${salesCount[0].count === exportData.closedSales.length ? '✅' : '❌'}`);

    console.log(`\nRevenue:`);
    console.log(`  Total: ₹${(revenue[0]?.total || 0).toFixed(2)}`);

    console.log(`\nDate Range:`);
    console.log(`  Oldest: ${dateRange[0]?.oldest || 'N/A'}`);
    console.log(`  Newest: ${dateRange[0]?.newest || 'N/A'}`);

    const overallSuccess = staffCount[0].count === exportData.staff.length &&
                          salesCount[0].count === exportData.closedSales.length;

    console.log(`\nOverall Success: ${overallSuccess ? '✅' : '❌'}`);
    console.log('========================\n');

    if (overallSuccess) {
      log('Migration validation passed!', 'success');
    } else {
      log('Migration validation failed - data mismatch detected', 'error');
      throw new Error('Validation failed');
    }

  } finally {
    await db.close();
  }
}

// Main Execution
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   V1.0 to Current System Migration                    ║');
  console.log('║   Tenant: coorg-food-company-6163                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Export v1.0 data
    log('Step 1: Exporting v1.0 data', 'info');
    const exportData = await exportV1Data();

    // Step 2: Create backup
    log('Step 2: Creating backup', 'info');
    const backup = await createBackup(exportData);

    // Step 3: Import to new database
    log('Step 3: Importing to new database', 'info');
    await importToNewDatabase(exportData);

    // Step 4: Validate migration
    log('Step 4: Validating migration', 'info');
    await validateMigration(exportData);

    // Success!
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   ✅ MIGRATION COMPLETED SUCCESSFULLY                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('Backup files:');
    console.log(`  - Database: ${backup.dbPath}`);
    console.log(`  - Export JSON: ${backup.jsonPath}`);
    console.log('\nNext steps:');
    console.log('  1. Review the validation results above');
    console.log('  2. Test the new database with the application');
    console.log('  3. If everything looks good, archive the old database');
    console.log('  4. Trigger D1 sync to push data to cloud\n');

  } catch (error) {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   ❌ MIGRATION FAILED                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    log(`Error: ${error}`, 'error');
    console.log('\nThe original database (pos.db) has NOT been modified.');
    console.log('Backup files were created for safety.\n');

    process.exit(1);
  }
}

// Run migration
main();
