-- Sales Transactions Table
-- Records all completed sales for daily reporting and analytics
CREATE TABLE IF NOT EXISTS sales_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    order_number TEXT,
    order_type TEXT NOT NULL,
    table_number INTEGER,
    source TEXT NOT NULL DEFAULT 'pos',
    subtotal REAL NOT NULL,
    service_charge REAL NOT NULL DEFAULT 0,
    cgst REAL NOT NULL DEFAULT 0,
    sgst REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    round_off REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'completed',
    items_json TEXT NOT NULL,
    cashier_name TEXT,
    staff_id TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT NOT NULL
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales_transactions(tenant_id, created_at);
-- Index for payment method analysis
CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales_transactions(payment_method);
-- Unique invoice number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_invoice ON sales_transactions(tenant_id, invoice_number);
