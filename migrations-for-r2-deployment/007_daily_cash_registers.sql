-- Daily Cash Registers Table
-- Tracks opening/closing cash for daily reconciliation
CREATE TABLE IF NOT EXISTS daily_cash_registers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    business_date TEXT NOT NULL,
    opening_cash REAL NOT NULL DEFAULT 0,
    opened_at TEXT NOT NULL,
    opened_by TEXT,
    expected_closing_cash REAL,
    actual_closing_cash REAL,
    cash_variance REAL,
    closed_at TEXT,
    closed_by TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Unique register per business date per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_register_date ON daily_cash_registers(tenant_id, business_date);
-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_cash_register_status ON daily_cash_registers(tenant_id, status);
