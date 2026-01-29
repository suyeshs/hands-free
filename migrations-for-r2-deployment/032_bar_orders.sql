-- Migration 032: Bar Orders Table
-- Mirrors kds_orders structure but for bar/beverage orders
-- Created: 2026-01-23

CREATE TABLE IF NOT EXISTS bar_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    table_number INTEGER,
    order_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_running_order INTEGER NOT NULL DEFAULT 0,
    bot_sequence INTEGER,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    accepted_at TEXT,
    ready_at TEXT,
    completed_at TEXT,
    elapsed_minutes INTEGER DEFAULT 0,
    estimated_prep_time INTEGER DEFAULT 5,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    tenant_id TEXT NOT NULL,
    UNIQUE(order_number, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_orders_tenant_status
    ON bar_orders(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bar_orders_table
    ON bar_orders(table_number);

CREATE INDEX IF NOT EXISTS idx_bar_orders_created
    ON bar_orders(created_at);
