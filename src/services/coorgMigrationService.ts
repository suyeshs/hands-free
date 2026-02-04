/**
 * Migration Service for coorg-food-company-6163
 *
 * Provides migration functions for use within the Tauri app
 * Can be called from UI or CLI
 */

import Database from "@tauri-apps/plugin-sql";
import { appDataDir } from "@tauri-apps/api/path";
import { copyFile, exists, rename, writeTextFile } from "@tauri-apps/plugin-fs";

// Constants
const TENANT_ID = "coorg-food-company-6163";
const OLD_DB_NAME = "sqlite:pos.db";
const NEW_DB_NAME = "sqlite:guanix.db";

// Types
export interface V1TableSession {
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

export interface V1StaffUser {
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

export interface SalesTransaction {
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

export interface ExportData {
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

export interface ValidationResult {
  staff: {
    expected: number;
    actual: number;
    match: boolean;
  };
  sales: {
    expected: number;
    actual: number;
    match: boolean;
  };
  revenue: number;
  dateRange: {
    oldest?: string;
    newest?: string;
  };
  overallSuccess: boolean;
}

export interface MigrationProgress {
  step: string;
  progress: number; // 0-100
  message: string;
}

// Transformation Logic
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
export async function exportV1Data(
  onProgress?: (progress: MigrationProgress) => void
): Promise<ExportData> {
  onProgress?.({ step: 'export', progress: 10, message: 'Connecting to v1.0 database...' });

  const db = await Database.load(OLD_DB_NAME);

  try {
    onProgress?.({ step: 'export', progress: 20, message: 'Exporting sales data...' });

    const closedSales = await db.select<V1TableSession[]>(
      'SELECT * FROM table_sessions WHERE status = "closed" ORDER BY closed_at'
    );

    onProgress?.({ step: 'export', progress: 40, message: `Found ${closedSales.length} sales` });

    const activeSessions = await db.select<V1TableSession[]>(
      'SELECT * FROM table_sessions WHERE status = "active"'
    );

    onProgress?.({ step: 'export', progress: 60, message: 'Exporting staff users...' });

    const staff = await db.select<V1StaffUser[]>(
      'SELECT * FROM staff_users ORDER BY created_at'
    );

    onProgress?.({ step: 'export', progress: 80, message: `Found ${staff.length} staff` });

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

    onProgress?.({ step: 'export', progress: 100, message: 'Export complete' });

    return exportData;
  } finally {
    await db.close();
  }
}

export async function createBackup(
  exportData: ExportData,
  onProgress?: (progress: MigrationProgress) => void
): Promise<{ dbPath: string; jsonPath: string }> {
  onProgress?.({ step: 'backup', progress: 10, message: 'Creating backup...' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const dataDir = await appDataDir();

  const sourcePath = `${dataDir}pos.db`;
  const backupDbPath = `${dataDir}pos-v1-backup-${timestamp}.db`;
  const exportJsonPath = `${dataDir}migration-export-${timestamp}.json`;

  onProgress?.({ step: 'backup', progress: 30, message: 'Backing up database...' });

  // Copy database file
  if (await exists(sourcePath)) {
    await copyFile(sourcePath, backupDbPath);
  }

  onProgress?.({ step: 'backup', progress: 60, message: 'Saving export JSON...' });

  // Save export JSON
  await writeTextFile(exportJsonPath, JSON.stringify(exportData, null, 2));

  onProgress?.({ step: 'backup', progress: 100, message: 'Backup complete' });

  return { dbPath: backupDbPath, jsonPath: exportJsonPath };
}

export async function importToNewDatabase(
  exportData: ExportData,
  onProgress?: (progress: MigrationProgress) => void
): Promise<void> {
  onProgress?.({ step: 'import', progress: 5, message: 'Connecting to new database...' });

  const db = await Database.load(NEW_DB_NAME);

  try {
    // 1. Import staff users
    onProgress?.({ step: 'import', progress: 10, message: 'Importing staff users...' });

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
    }

    onProgress?.({
      step: 'import',
      progress: 30,
      message: `Imported ${exportData.staff.length} staff users`,
    });

    // 2. Transform and import sales
    onProgress?.({ step: 'import', progress: 40, message: 'Importing sales transactions...' });

    let invoiceNumber = 1;

    for (let i = 0; i < exportData.closedSales.length; i++) {
      const session = exportData.closedSales[i];
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

      // Update progress every 10%
      if (i % Math.ceil(exportData.closedSales.length / 10) === 0) {
        const progress = 40 + Math.floor((i / exportData.closedSales.length) * 40);
        onProgress?.({
          step: 'import',
          progress,
          message: `Imported ${i}/${exportData.closedSales.length} sales`,
        });
      }
    }

    onProgress?.({
      step: 'import',
      progress: 80,
      message: `Imported ${exportData.closedSales.length} sales transactions`,
    });

    // 3. Import active sessions
    onProgress?.({ step: 'import', progress: 85, message: 'Importing active sessions...' });

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
    }

    // 4. Initialize restaurant_settings
    onProgress?.({ step: 'import', progress: 90, message: 'Initializing settings...' });

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
    } catch (error) {
      console.log('[Migration] Restaurant settings may already exist:', error);
    }

    // 5. Ensure tenant_config exists
    const existingTenantConfig = await db.select(
      'SELECT * FROM tenant_config WHERE tenant_id = ?',
      [TENANT_ID]
    ) as unknown[];

    if (existingTenantConfig.length === 0) {
      await db.execute(
        `INSERT INTO tenant_config (
          id, tenant_id, company_name, subdomain, activated_at
        ) VALUES (1, ?, ?, ?, ?)`,
        [TENANT_ID, 'Coorg Food Company', 'coorg-food-company', new Date().toISOString()]
      );
    }

    onProgress?.({ step: 'import', progress: 100, message: 'Import complete' });
  } finally {
    await db.close();
  }
}

export async function validateMigration(
  exportData: ExportData,
  onProgress?: (progress: MigrationProgress) => void
): Promise<ValidationResult> {
  onProgress?.({ step: 'validate', progress: 10, message: 'Validating migration...' });

  const db = await Database.load(NEW_DB_NAME);

  try {
    onProgress?.({ step: 'validate', progress: 30, message: 'Counting staff...' });

    const staffCount = await db.select<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM staff_users WHERE tenant_id = ?',
      [TENANT_ID]
    );

    onProgress?.({ step: 'validate', progress: 50, message: 'Counting sales...' });

    const salesCount = await db.select<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM sales_transactions WHERE tenant_id = ?',
      [TENANT_ID]
    );

    onProgress?.({ step: 'validate', progress: 70, message: 'Calculating revenue...' });

    const revenue = await db.select<Array<{ total: number }>>(
      'SELECT SUM(grand_total) as total FROM sales_transactions WHERE tenant_id = ?',
      [TENANT_ID]
    );

    const dateRange = await db.select<Array<{ oldest: string; newest: string }>>(
      'SELECT MIN(completed_at) as oldest, MAX(completed_at) as newest FROM sales_transactions WHERE tenant_id = ?',
      [TENANT_ID]
    );

    const result: ValidationResult = {
      staff: {
        expected: exportData.staff.length,
        actual: staffCount[0].count,
        match: staffCount[0].count === exportData.staff.length,
      },
      sales: {
        expected: exportData.closedSales.length,
        actual: salesCount[0].count,
        match: salesCount[0].count === exportData.closedSales.length,
      },
      revenue: revenue[0]?.total || 0,
      dateRange: {
        oldest: dateRange[0]?.oldest,
        newest: dateRange[0]?.newest,
      },
      overallSuccess: staffCount[0].count === exportData.staff.length &&
                     salesCount[0].count === exportData.closedSales.length,
    };

    onProgress?.({ step: 'validate', progress: 100, message: 'Validation complete' });

    return result;
  } finally {
    await db.close();
  }
}

export async function commitMigration(
  onProgress?: (progress: MigrationProgress) => void
): Promise<void> {
  onProgress?.({ step: 'commit', progress: 10, message: 'Archiving old database...' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const dataDir = await appDataDir();

  const oldPath = `${dataDir}pos.db`;
  const archivePath = `${dataDir}pos-v1-archive-${timestamp}.db`;

  if (await exists(oldPath)) {
    await rename(oldPath, archivePath);
  }

  onProgress?.({ step: 'commit', progress: 50, message: 'Marking migration complete...' });

  // Mark migration complete
  localStorage.setItem('v1-migration-complete', 'true');
  localStorage.setItem('migrated-tenant-id', TENANT_ID);

  onProgress?.({ step: 'commit', progress: 100, message: 'Migration committed' });
}

export async function rollbackMigration(
  backupDbPath: string,
  onProgress?: (progress: MigrationProgress) => void
): Promise<void> {
  onProgress?.({ step: 'rollback', progress: 10, message: 'Rolling back...' });

  const dataDir = await appDataDir();
  const activePath = `${dataDir}pos.db`;
  const newDbPath = `${dataDir}guanix.db`;

  // Delete new database if it exists
  if (await exists(newDbPath)) {
    // Note: Tauri doesn't have a direct delete function, need to use remove from plugin-fs
    console.log('[Rollback] Would delete guanix.db - implement with remove() from plugin-fs');
  }

  onProgress?.({ step: 'rollback', progress: 50, message: 'Restoring backup...' });

  // Restore backup
  await copyFile(backupDbPath, activePath);

  onProgress?.({ step: 'rollback', progress: 80, message: 'Clearing migration flags...' });

  // Clear migration flags
  localStorage.removeItem('v1-migration-complete');
  localStorage.removeItem('migrated-tenant-id');

  onProgress?.({ step: 'rollback', progress: 100, message: 'Rollback complete' });
}

// Convenience function to run full migration
export async function runFullMigration(
  onProgress?: (progress: MigrationProgress) => void
): Promise<ValidationResult> {
  // Step 1: Export
  const exportData = await exportV1Data(onProgress);

  // Step 2: Backup
  await createBackup(exportData, onProgress);

  // Step 3: Import
  await importToNewDatabase(exportData, onProgress);

  // Step 4: Validate
  const validation = await validateMigration(exportData, onProgress);

  if (!validation.overallSuccess) {
    throw new Error('Migration validation failed - data mismatch detected');
  }

  // Step 5: Commit (only if validation passed)
  await commitMigration(onProgress);

  return validation;
}
