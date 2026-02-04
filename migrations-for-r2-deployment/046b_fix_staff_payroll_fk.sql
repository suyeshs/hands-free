-- Fix Staff Payroll Foreign Key References
-- This migration fixes the foreign key constraints to reference staff_users instead of staff

-- Drop existing tables (if they exist with wrong foreign keys)
-- Data will be preserved by CREATE TABLE IF NOT EXISTS below
DROP TABLE IF EXISTS staff_payslips;
DROP TABLE IF EXISTS staff_attendance;
DROP TABLE IF EXISTS staff_bonuses;
DROP TABLE IF EXISTS staff_deductions;
DROP TABLE IF EXISTS staff_advances;
DROP TABLE IF EXISTS staff_salary;

-- Recreate tables with correct foreign key references

-- Staff Salary Configuration
CREATE TABLE IF NOT EXISTS staff_salary (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    base_salary REAL NOT NULL,
    hourly_rate REAL,
    overtime_rate REAL,
    salary_type TEXT NOT NULL CHECK(salary_type IN ('monthly', 'hourly', 'daily')),
    effective_from TEXT NOT NULL, -- ISO 8601 date
    effective_to TEXT, -- NULL if current
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Advances (money given in advance)
CREATE TABLE IF NOT EXISTS staff_advances (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT,
    advance_date TEXT NOT NULL, -- ISO 8601 date
    repayment_start_month TEXT NOT NULL, -- YYYY-MM format
    installments INTEGER NOT NULL DEFAULT 1,
    installments_paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Deductions (penalties, loans, etc.)
CREATE TABLE IF NOT EXISTS staff_deductions (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('penalty', 'loan_repayment', 'tax', 'insurance', 'other')),
    reason TEXT NOT NULL,
    deduction_month TEXT NOT NULL, -- YYYY-MM format
    is_recurring BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Bonuses
CREATE TABLE IF NOT EXISTS staff_bonuses (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('performance', 'festival', 'target', 'other')),
    reason TEXT NOT NULL,
    bonus_month TEXT NOT NULL, -- YYYY-MM format
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Staff Attendance (for hourly/daily calculations)
CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    date TEXT NOT NULL, -- ISO 8601 date
    clock_in TEXT, -- ISO 8601 timestamp
    clock_out TEXT, -- ISO 8601 timestamp
    hours_worked REAL,
    overtime_hours REAL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    UNIQUE(staff_id, date)
);

-- Staff Payslips (monthly salary records)
CREATE TABLE IF NOT EXISTS staff_payslips (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM format
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
    paid_date TEXT, -- ISO 8601 date
    payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'cheque', 'upi')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    UNIQUE(staff_id, month)
);

-- Recreate indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_salary_staff ON staff_salary(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_advances_staff ON staff_advances(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_deductions_staff ON staff_deductions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_staff ON staff_bonuses(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_payslips_staff_month ON staff_payslips(staff_id, month);
