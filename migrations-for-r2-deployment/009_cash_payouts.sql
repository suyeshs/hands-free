-- Cash Payouts table for tracking cash withdrawals, expenses, and bank deposits
-- These affect the Daily Sales Report cash reconciliation

CREATE TABLE IF NOT EXISTS cash_payouts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    business_date TEXT NOT NULL,

    -- Payout details
    amount REAL NOT NULL,
    payout_type TEXT NOT NULL, -- 'withdrawal', 'expense', 'petty_cash', 'bank_deposit', 'vendor_payment'
    category TEXT, -- 'utilities', 'supplies', 'salary', 'misc', etc.
    description TEXT,
    reference_number TEXT, -- Receipt/invoice number if applicable

    -- Authorization
    recorded_by TEXT NOT NULL, -- Staff who recorded
    authorized_by TEXT, -- Manager who approved (if different)

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'

    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cash_payouts_tenant_date ON cash_payouts(tenant_id, business_date);
CREATE INDEX IF NOT EXISTS idx_cash_payouts_type ON cash_payouts(payout_type);
CREATE INDEX IF NOT EXISTS idx_cash_payouts_status ON cash_payouts(status);
