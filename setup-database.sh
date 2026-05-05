#!/bin/bash
# Comprehensive Database Setup Script
# Runs all core migrations and sets up initial data

DB_FILE="pos-dev.db"
MIGRATIONS_DIR="migrations-for-r2-deployment"

echo "========================================="
echo "  POS Database Setup"
echo "========================================="
echo ""
echo "Database: $DB_FILE"
echo ""

# Remove old empty database
if [ -f "$DB_FILE" ] && [ ! -s "$DB_FILE" ]; then
    echo "🗑️  Removing empty database file..."
    rm "$DB_FILE"
fi

# Create database and migrations table
echo "📋 Creating schema_migrations tracking table..."
sqlite3 "$DB_FILE" <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL CHECK(source IN ('built-in', 'cloud')),
    checksum TEXT NOT NULL,
    applied_at INTEGER NOT NULL,
    app_version TEXT NOT NULL
);
EOF

# Core migrations in correct order
migrations=(
    # === CORE AUTHENTICATION ===
    "001:staff_users"

    # === CORE POS OPERATIONS ===
    "002:table_sessions"
    "003:aggregator_orders"
    "004:table_session_kot_records"
    "005:kds_orders"
    "006:sales_transactions"
    "007:daily_cash_registers"
    "009:cash_payouts"

    # === INVENTORY ===
    "010:inventory"
    "011:aggregator_picked_up"
    "012:aggregator_archived"
    "013:out_of_stock"

    # === MENU MANAGEMENT ===
    "021:menu_categories"
    "022:menu_items"
    "023:recipes"

    # === SETTINGS ===
    "024:restaurant_settings"
    "025:setup_wizard_state"

    # === FLOOR PLAN ===
    "026:floor_tables"
    "027:floor_sections"
    "028:floor_staff_assignments"

    # === TRANSLATIONS ===
    "029:translations"
    "030:tenant_translation_overrides"

    # === CLOUD SYNC ===
    "031:add_online_sync_columns"

    # === BAR FEATURES ===
    "032:bar_inventory"
    "033:bar_recipes"

    # === PROVISIONING ===
    "034:wizard_provisioning_data"
    "035:wizard_owner_flag"
    "036:guest_orders"

    # === SETTINGS ENHANCEMENTS ===
    "042:add_owner_name"
    "044:restaurant_settings_missing_columns"
    "047:combo_filter_keywords"

    # === DEVICE MANAGEMENT ===
    "048:device_settings"
    "049:user_device_alignment"
    "051:add_wifi_settings"

    # === MENU UPLOAD ===
    "052:menu_upload_sessions"

    # === TENANT CONFIG (MUST BE LAST) ===
    "053:minimal_tenant_config"
)

echo ""
echo "📦 Applying ${#migrations[@]} core migrations..."
echo ""

migration_count=0
failed_count=0

for migration in "${migrations[@]}"; do
    version="${migration%%:*}"
    name="${migration##*:}"
    file="$MIGRATIONS_DIR/${version}_${name}.sql"

    if [ -f "$file" ]; then
        echo -n "  [$((migration_count + 1))/${#migrations[@]}] Migration $version ($name)... "

        if sqlite3 "$DB_FILE" < "$file" 2>/dev/null; then
            # Mark as applied
            sqlite3 "$DB_FILE" <<EOF 2>/dev/null
INSERT OR REPLACE INTO schema_migrations (version, name, description, source, checksum, applied_at, app_version)
VALUES ($version, '$name', 'Core migration', 'built-in', 'core-$name', strftime('%s', 'now'), '3.1.4');
EOF
            echo "✅"
            ((migration_count++))
        else
            echo "⚠️  (may already exist)"
            ((failed_count++))
        fi
    else
        echo "  ⚠️  Warning: Migration file not found: $file"
        ((failed_count++))
    fi
done

echo ""
echo "✅ Core migrations complete: $migration_count applied"
if [ $failed_count -gt 0 ]; then
    echo "⚠️  $failed_count migrations skipped (already applied or missing)"
fi

# Create default tenant configuration
echo ""
echo "🏢 Creating default tenant configuration..."

TENANT_ID="demo-$(date +%s)"
sqlite3 "$DB_FILE" <<EOF
INSERT OR REPLACE INTO tenant_config (
    id,
    tenant_id,
    company_name,
    subdomain,
    api_base_url,
    orders_endpoint,
    menu_endpoint,
    primary_color,
    secondary_color,
    currency,
    timezone,
    activated_at
) VALUES (
    1,
    '$TENANT_ID',
    'My Restaurant',
    'demo',
    'https://api.handsfree.restaurant',
    '/api/orders',
    '/api/menu',
    '#d97542',
    '#1a1612',
    'INR',
    'Asia/Kolkata',
    strftime('%s', 'now') || '000'
);
EOF

# Verify setup
echo ""
echo "========================================="
echo "  Database Setup Complete"
echo "========================================="
echo ""

TENANT_INFO=$(sqlite3 "$DB_FILE" "SELECT 'Tenant: ' || tenant_id || ' | Company: ' || company_name FROM tenant_config WHERE id = 1;" 2>/dev/null)
TABLE_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
MIGRATION_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null)

if [ -n "$TENANT_INFO" ]; then
    echo "✅ $TENANT_INFO"
    echo "📊 Database: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
    echo "📋 Tables: $TABLE_COUNT"
    echo "🔄 Migrations: $MIGRATION_COUNT"
    echo ""
    echo "========================================="
    echo "  Next Steps"
    echo "========================================="
    echo ""
    echo "1. Start the app:"
    echo "   npm run tauri dev"
    echo ""
    echo "2. Optional - Install subscription plugin:"
    echo "   - Go to Settings > Plugins"
    echo "   - Install 'subscription-meals' plugin"
    echo ""
    echo "3. Complete restaurant setup in the app"
    echo ""
else
    echo "❌ Failed to create tenant configuration"
    exit 1
fi
EOF

chmod +x setup-database.sh