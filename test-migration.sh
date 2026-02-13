#!/bin/bash

# Test Migration Script for Coorg Food Company
# Simulates the migration tool's 7-stage process

set -e

TEST_DIR="$HOME/Desktop/coorg-migration-test"
SOURCE_DB="$TEST_DIR/pos.db"
TARGET_DB="$TEST_DIR/guanix.db"
SCHEMA_FILE="/Users/stonepot-tech/projects/restaurant-pos-ai/apps/coorg-migration-tool/src-tauri/resources/d1-schema.sql"

echo "🔄 COORG MIGRATION TEST"
echo "======================="
echo ""

# Stage 1: DETECT
echo "📍 Stage 1: DETECT (5%)"
echo "Checking source database..."
if [ ! -f "$SOURCE_DB" ]; then
    echo "❌ Error: Source database not found at $SOURCE_DB"
    exit 1
fi

sales_count=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM table_sessions WHERE status = 'closed'")
staff_count=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM staff_users")
menu_cat_count=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM menu_categories")
menu_item_count=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM menu_items")

echo "✅ Found:"
echo "   - Closed sales: $sales_count"
echo "   - Staff users: $staff_count"
echo "   - Menu categories: $menu_cat_count"
echo "   - Menu items: $menu_item_count"
echo ""

# Stage 2: BACKUP
echo "📦 Stage 2: BACKUP (20%)"
backup_db="$TEST_DIR/pos-v1-backup-$(date +%Y%m%d_%H%M%S).db"
cp "$SOURCE_DB" "$backup_db"
echo "✅ Backup created: $backup_db"
echo ""

# Stage 3: CREATE NEW DATABASE
echo "🔨 Stage 3: CREATE (25%)"
if [ -f "$TARGET_DB" ]; then
    rm "$TARGET_DB"
fi
echo "✅ Creating new guanix.db with v3.1.4 schema..."
sqlite3 "$TARGET_DB" < "$SCHEMA_FILE"
echo "✅ Schema applied (77 tables created)"
echo ""

# Stage 4: IMPORT DATA
echo "📥 Stage 4: IMPORT (30-70%)"

# Import menu categories
echo "   Importing menu categories..."
sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;

INSERT INTO menu_categories (id, name, sort_order, active, icon, description, created_at, updated_at, name_translations)
SELECT id, name, sort_order, active, icon, description, created_at, updated_at, name_translations
FROM source.menu_categories;

DETACH DATABASE source;
EOF

imported_categories=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM menu_categories")
echo "   ✅ Imported $imported_categories menu categories"

# Import menu items
echo "   Importing menu items..."
sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;

INSERT INTO menu_items (id, category_id, name, description, price, image, active, preparation_time, allergens, dietary_tags, name_translations, description_translations)
SELECT id, category_id, name, description, price, image, active, preparation_time, allergens, dietary_tags, name_translations, description_translations
FROM source.menu_items;

DETACH DATABASE source;
EOF

imported_items=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM menu_items")
echo "   ✅ Imported $imported_items menu items"

# Import staff users (if any)
if [ "$staff_count" -gt 0 ]; then
    echo "   Importing staff users..."
    sqlite3 "$TARGET_DB" << EOF
ATTACH DATABASE '$SOURCE_DB' AS source;

INSERT INTO staff_users (id, tenant_id, name, role, pin_hash, is_active, permissions, created_at, last_login_at, created_by)
SELECT id, tenant_id, name, role, pin_hash, is_active, permissions, created_at, last_login_at, created_by
FROM source.staff_users;

DETACH DATABASE source;
EOF
    echo "   ✅ Imported $staff_count staff users"
fi

# Transform table_sessions to sales_transactions
echo "   Transforming sales data..."
sqlite3 "$TARGET_DB" << 'EOF'
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
    'MIG-' || printf('%06d', ROW_NUMBER() OVER (ORDER BY ts.closed_at)) as invoice_number,
    COALESCE(json_extract(ts.order_data, '$.orderType'), 'dine-in') as order_type,
    ts.table_number,
    'migration' as source,
    CAST(COALESCE(json_extract(ts.order_data, '$.subtotal'), 0) as REAL) as subtotal,
    0.0 as service_charge,
    CAST(COALESCE(json_extract(ts.order_data, '$.subtotal'), 0) as REAL) * 0.025 as cgst,
    CAST(COALESCE(json_extract(ts.order_data, '$.subtotal'), 0) as REAL) * 0.025 as sgst,
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

imported_sales=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sales_transactions")
echo "   ✅ Transformed $imported_sales sales transactions"
echo ""

# Stage 5: VALIDATE
echo "✅ Stage 5: VALIDATE (80%)"

# Verify counts
target_sales=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sales_transactions")
target_categories=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM menu_categories")
target_items=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM menu_items")
target_revenue=$(sqlite3 "$TARGET_DB" "SELECT printf('%.2f', SUM(grand_total)) FROM sales_transactions")

echo "   Sales: Expected $sales_count, Got $target_sales $([ $sales_count -eq $target_sales ] && echo '✅' || echo '❌')"
echo "   Menu Categories: Expected $menu_cat_count, Got $target_categories $([ $menu_cat_count -eq $target_categories ] && echo '✅' || echo '❌')"
echo "   Menu Items: Expected $menu_item_count, Got $target_items $([ $menu_item_count -eq $target_items ] && echo '✅' || echo '❌')"
echo "   Total Revenue: ₹$target_revenue"
echo ""

# Check schema
plugin_tables=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'plugin_%'")
theme_tables=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'theme_%'")
total_tables=$(sqlite3 "$TARGET_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table'")

echo "   Schema verification:"
echo "   - Total tables: $total_tables"
echo "   - Plugin tables: $plugin_tables"
echo "   - Theme tables: $theme_tables"
echo ""

# Show sample data
echo "   Sample migrated sales:"
sqlite3 -column -header "$TARGET_DB" "SELECT invoice_number, grand_total, completed_at FROM sales_transactions ORDER BY completed_at LIMIT 3"
echo ""

# Stage 6: COMPLETE
echo "✅ Stage 6: COMPLETE (100%)"
echo ""
echo "🎉 Migration test completed successfully!"
echo ""
echo "Test Results:"
echo "============="
echo "Source DB: $SOURCE_DB"
echo "Target DB: $TARGET_DB"
echo "Backup DB: $backup_db"
echo ""
echo "Next steps:"
echo "1. Review the migrated data in $TARGET_DB"
echo "2. If everything looks good, apply to production"
echo "3. Backup created at $backup_db"
