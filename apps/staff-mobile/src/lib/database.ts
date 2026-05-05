/**
 * Database initialization and configuration
 */

import Database from '@tauri-apps/plugin-sql';

// Database name based on environment
export const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

// Singleton database instance
let dbInstance: Database | null = null;

/**
 * Get database instance (singleton)
 */
export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME);
    console.log('[Database] Loaded:', DB_NAME);
  }
  return dbInstance;
}

/**
 * Initialize database schema
 * Creates essential tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  console.log('[Database] Initializing schema...');

  // Create staff_users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('cashier', 'waiter', 'kitchen', 'manager')),
      pin_hash TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
      permissions TEXT,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER,
      created_by TEXT,
      photo_url TEXT,
      aadhaar_number TEXT,
      aadhaar_image_url TEXT,
      pan_number TEXT,
      bank_account_number TEXT,
      bank_ifsc_code TEXT,
      bank_name TEXT,
      bank_branch TEXT,
      preferred_language TEXT DEFAULT 'en',
      UNIQUE(tenant_id, name)
    )
  `);

  // Create indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff_users(tenant_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_staff_active ON staff_users(is_active)');

  // Create attendance_records table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      clock_in_at INTEGER NOT NULL,
      clock_out_at INTEGER,
      scheduled_start INTEGER,
      scheduled_end INTEGER,
      break_duration_minutes INTEGER DEFAULT 0,
      breaks_json TEXT,
      shift_date TEXT NOT NULL,
      shift_type TEXT DEFAULT 'regular',
      roster_assignment_id TEXT,
      total_hours REAL,
      regular_hours REAL,
      overtime_hours REAL,
      status TEXT NOT NULL DEFAULT 'active',
      late_by_minutes INTEGER DEFAULT 0,
      early_departure_minutes INTEGER DEFAULT 0,
      notes TEXT,
      device_id TEXT,
      clock_in_method TEXT DEFAULT 'manual',
      clock_in_device_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
    )
  `);

  // Create attendance indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance_records(tenant_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance_records(staff_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(shift_date)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance_records(staff_id, shift_date)');

  // Create unique index for active attendance (only one active per staff)
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active
    ON attendance_records(staff_id, tenant_id)
    WHERE clock_out_at IS NULL
  `);

  // Create staff_salary table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff_salary (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      base_salary REAL NOT NULL,
      hourly_rate REAL,
      overtime_rate REAL,
      salary_type TEXT NOT NULL CHECK(salary_type IN ('monthly', 'hourly', 'daily')),
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
    )
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_staff_salary_staff ON staff_salary(staff_id)');

  // Create staff_advances table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff_advances (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      advance_date TEXT NOT NULL,
      repayment_start_month TEXT NOT NULL,
      installments INTEGER NOT NULL DEFAULT 1,
      installments_paid INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
    )
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_staff_advances_staff ON staff_advances(staff_id)');

  // Create staff_payslips table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff_payslips (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      month TEXT NOT NULL,
      base_salary REAL NOT NULL,
      overtime_pay REAL DEFAULT 0,
      bonuses REAL DEFAULT 0,
      advances_deducted REAL DEFAULT 0,
      other_deductions REAL DEFAULT 0,
      gross_salary REAL NOT NULL,
      net_salary REAL NOT NULL,
      days_worked INTEGER,
      hours_worked REAL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'processed', 'paid')) DEFAULT 'draft',
      paid_date TEXT,
      payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'cheque', 'upi')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
      UNIQUE(staff_id, month)
    )
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_staff_payslips_staff_month ON staff_payslips(staff_id, month)');

  // Create device_settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS device_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      tenant_id TEXT NOT NULL,
      assigned_staff_id TEXT,
      device_mode TEXT DEFAULT 'staff',
      auto_clock_in_enabled INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (assigned_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
    )
  `);

  // Create device_registrations table (for device passkey authentication)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS device_registrations (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL UNIQUE,
      staff_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      device_name TEXT,
      platform TEXT,
      registered_at INTEGER NOT NULL,
      last_used_at INTEGER,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
    )
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_device_reg_device ON device_registrations(device_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_device_reg_staff ON device_registrations(staff_id)');

  console.log('[Database] Schema initialized successfully');
}

/**
 * Check if database is initialized
 */
export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const result = await db.select<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='staff_users'`
    );
    return result.length > 0;
  } catch (error) {
    console.error('[Database] Error checking initialization:', error);
    return false;
  }
}
