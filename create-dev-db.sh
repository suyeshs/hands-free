#!/bin/bash

# Coorg Food Company - Create Development Database
# Creates pos-dev.db with v3.1.4 schema and production data for testing

set -e

SOURCE_DB="/Users/stonepot-tech/projects/restaurant-pos-ai/pos.db"
TARGET_DB="/Users/stonepot-tech/projects/restaurant-pos-ai/pos-dev.db"

echo "🔧 Coorg Food Company - Development Database Setup"
echo "=================================================="
echo ""

# Check if source exists
if [ ! -f "$SOURCE_DB" ]; then
    echo "❌ Error: Source database not found at $SOURCE_DB"
    exit 1
fi

# Stage 1: Analyze source
echo "📊 Stage 1: Analyzing source database..."
existing_sales=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM sales_transactions")
old_sessions=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM table_sessions WHERE status='closed'")
menu_categories=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM menu_categories")
menu_items=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM menu_items")
staff_users=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM staff_users")

echo "   Found in pos.db:"
echo "   - sales_transactions: $existing_sales records"
echo "   - table_sessions (closed): $old_sessions records"
echo "   - menu_categories: $menu_categories"
echo "   - menu_items: $menu_items"
echo "   - staff_users: $staff_users"
echo ""

# Stage 2: Remove old dev database if it exists
echo "🔨 Stage 2: Creating fresh pos-dev.db..."
if [ -f "$TARGET_DB" ]; then
    rm "$TARGET_DB"
    echo "   ✅ Removed existing pos-dev.db"
fi

# Create minimal v3.1.4 schema (core tables)
sqlite3 "$TARGET_DB" << 'SCHEMA_EOF'
-- Core tables from existing database
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
    completed_at TEXT NOT NULL,
    synced_at TEXT,
    synced_to_cloud INTEGER DEFAULT 0,
    cloud_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    permissions TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT,
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS menu_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    icon TEXT,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    name_translations TEXT
);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    preparation_time INTEGER NOT NULL DEFAULT 15,
    allergens TEXT,
    dietary_tags TEXT,
    name_translations TEXT,
    description_translations TEXT,
    is_combo INTEGER DEFAULT 0
);

-- NEW v3.1.4 tables
CREATE TABLE IF NOT EXISTS tenant_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    tenant_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    api_base_url TEXT NOT NULL,
    orders_endpoint TEXT DEFAULT '/api/orders',
    menu_endpoint TEXT DEFAULT '/api/menu',
    primary_color TEXT DEFAULT '#FF6B35',
    currency TEXT DEFAULT 'INR',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    created_at TEXT DEFAULT (datetime('now')),
    activated_at TEXT,
    d1_database_id TEXT,
    features_enabled TEXT DEFAULT '{}',
    subscription_tier TEXT DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    tenant_id TEXT,
    restaurant_name TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    fssai_number TEXT,
    currency TEXT DEFAULT 'INR',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    device_role TEXT DEFAULT 'standalone',
    operational_scale TEXT DEFAULT 'single-location',
    activate_online INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Plugin system tables
CREATE TABLE IF NOT EXISTS plugin_metadata (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL,
    author TEXT,
    description TEXT,
    install_date TEXT DEFAULT (datetime('now')),
    enabled INTEGER DEFAULT 1,
    config_schema TEXT,
    dependencies TEXT
);

CREATE TABLE IF NOT EXISTS plugin_cache (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    cache_value TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(plugin_id, cache_key)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT DEFAULT 'system',
    checksum TEXT,
    applied_at TEXT DEFAULT (datetime('now')),
    app_version TEXT
);

-- Initialize tenant config for development
INSERT INTO tenant_config (
    id, tenant_id, company_name, subdomain,
    api_base_url, d1_database_id, created_at, activated_at
) VALUES (
    1, 'coorg-food-company-6163', 'Coorg Food Company', 'coorg-food-company',
    'https://coorg-food-company.handsfree.tech',
    'ad7d6f69-594d-4651-8250-4ec3fdb28435',
    datetime('now'), datetime('now')
);

-- Initialize restaurant settings for development
INSERT INTO restaurant_settings (
    id, tenant_id, restaurant_name, currency, timezone,
    device_role, operational_scale, created_at, updated_at
) VALUES (
    1, 'coorg-food-company-6163', 'Coorg Food Company', 'INR', 'Asia/Kolkata',
    'standalone', 'single-location', datetime('now'), datetime('now')
);

-- Mark migration as applied
INSERT INTO schema_migrations (version, name, source, app_version)
VALUES (1, 'create_dev_database', 'dev-script', '3.1.4');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales_transactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales_transactions(tenant_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_unsynced ON sales_transactions(synced_at) WHERE synced_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_categories_active ON menu_categories(active);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(active);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff_users(is_active);
SCHEMA_EOF

echo "✅ Schema created with v3.1.4 tables"
echo ""

# Stage 3: Copy existing data
echo "📥 Stage 3: Copying production data..."

# Copy existing sales_transactions
echo "   Copying sales_transactions..."
sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;
INSERT INTO sales_transactions (
    id, tenant_id, invoice_number, order_number, order_type, table_number, source,
    subtotal, service_charge, cgst, sgst, discount, round_off, grand_total,
    payment_method, payment_status, items_json, cashier_name, staff_id,
    created_at, completed_at, synced_at
)
SELECT
    id, tenant_id, invoice_number, order_number, order_type, table_number, source,
    subtotal, service_charge, cgst, sgst, discount, round_off, grand_total,
    payment_method, payment_status, items_json, cashier_name, staff_id,
    created_at, completed_at, synced_at
FROM source.sales_transactions;
DETACH DATABASE source;
EOF
copied_sales=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sales_transactions")
echo "   ✅ Copied $copied_sales sales_transactions"

# Copy menu categories
echo "   Copying menu categories..."
sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;
INSERT INTO menu_categories (id, name, sort_order, active, icon)
SELECT id, name, sort_order, active, icon FROM source.menu_categories;
DETACH DATABASE source;
EOF
echo "   ✅ Copied $menu_categories menu categories"

# Copy menu items
echo "   Copying menu items..."
sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;
INSERT INTO menu_items (id, category_id, name, description, price, image, active, preparation_time, allergens, dietary_tags, is_combo)
SELECT id, category_id, name, description, price, image, active, preparation_time, allergens, dietary_tags, is_combo
FROM source.menu_items;
DETACH DATABASE source;
EOF
echo "   ✅ Copied $menu_items menu items"

# Copy staff users (if any)
if [ "$staff_users" -gt 0 ]; then
    echo "   Copying staff users..."
    sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;
INSERT INTO staff_users SELECT * FROM source.staff_users;
DETACH DATABASE source;
EOF
    echo "   ✅ Copied $staff_users staff users"
fi

echo ""

# Stage 4: Migrate old table_sessions (if any)
if [ "$old_sessions" -gt 0 ]; then
    echo "🔄 Stage 4: Migrating $old_sessions old table_sessions to sales_transactions..."

    sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;

INSERT INTO sales_transactions (
    id,
    tenant_id,
    invoice_number,
    order_type,
    table_number,
    source,
    subtotal,
    service_charge,
    cgst,
    sgst,
    discount,
    round_off,
    grand_total,
    payment_method,
    payment_status,
    items_json,
    cashier_name,
    created_at,
    completed_at
)
SELECT
    ts.id,
    ts.tenant_id,
    'MIG-' || substr('000000' || (SELECT COUNT(*) + 1 FROM sales_transactions), -6) as invoice_number,
    COALESCE(json_extract(ts.order_data, '$.orderType'), 'dine-in') as order_type,
    ts.table_number,
    'migration' as source,
    CAST(COALESCE(json_extract(ts.order_data, '$.subtotal'), json_extract(ts.order_data, '$.total'), 0) as REAL) as subtotal,
    0.0 as service_charge,
    CAST(COALESCE(json_extract(ts.order_data, '$.subtotal'), json_extract(ts.order_data, '$.total'), 0) as REAL) * 0.025 as cgst,
    CAST(COALESCE(json_extract(ts.order_data, '$.subtotal'), json_extract(ts.order_data, '$.total'), 0) as REAL) * 0.025 as sgst,
    CAST(COALESCE(json_extract(ts.order_data, '$.discount'), 0) as REAL) as discount,
    0.0 as round_off,
    CAST(COALESCE(json_extract(ts.order_data, '$.total'), 0) as REAL) as grand_total,
    'cash' as payment_method,
    'completed' as payment_status,
    COALESCE(json_extract(ts.order_data, '$.items'), '[]') as items_json,
    ts.server_name as cashier_name,
    ts.started_at as created_at,
    ts.closed_at as completed_at
FROM source.table_sessions ts
WHERE ts.status = 'closed'
ORDER BY ts.closed_at;

DETACH DATABASE source;
EOF

    migrated=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sales_transactions WHERE source='migration'")
    echo "   ✅ Migrated $migrated table_sessions"
else
    echo "⏭️  Stage 4: No table_sessions to migrate"
fi
echo ""

# Stage 5: Validation
echo "✅ Stage 5: Validation"
total_sales=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sales_transactions")
total_revenue=$(sqlite3 "$TARGET_DB" "SELECT printf('%.2f', SUM(grand_total)) FROM sales_transactions")
categories=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM menu_categories")
items=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM menu_items")
staff=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM staff_users")

echo "   Final counts in pos-dev.db:"
echo "   - Sales transactions: $total_sales (expected: $((existing_sales + old_sessions)))"
echo "   - Total revenue: ₹$total_revenue"
echo "   - Menu categories: $categories"
echo "   - Menu items: $items"
echo "   - Staff users: $staff"

# Verify plugin tables
plugin_tables=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('tenant_config', 'restaurant_settings', 'plugin_metadata', 'plugin_cache', 'schema_migrations')")
echo "   - v3.1.4 tables created: $plugin_tables/5"

# Check tenant config
tenant_id=$(sqlite3 "$TARGET_DB" "SELECT tenant_id FROM tenant_config WHERE id=1")
d1_db_id=$(sqlite3 "$TARGET_DB" "SELECT d1_database_id FROM tenant_config WHERE id=1")
echo "   - Tenant ID: $tenant_id"
echo "   - D1 Database ID: $d1_db_id"

echo ""
echo "🎉 Development Database Created!"
echo ""
echo "Summary:"
echo "  ✅ Source: $SOURCE_DB"
echo "  ✅ Target: $TARGET_DB"
echo "  ✅ Sales: $total_sales records (₹$total_revenue)"
echo "  ✅ Menu: $categories categories, $items items"
echo "  ✅ Staff: $staff users"
echo "  ✅ Plugin system: Ready for v3.1.4"
echo ""
echo "Next steps:"
echo "  1. Launch development build (uses pos-dev.db automatically)"
echo "  2. Test all features with production data"
echo "  3. Verify sales history displays correctly"
echo "  4. Test creating new sales"
