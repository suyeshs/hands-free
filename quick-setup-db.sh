#!/bin/bash
# Quick Database Setup Script
# Runs the exact migrations that Rust expects

DB_FILE="pos-dev.db"
MIGRATIONS_DIR="migrations-for-r2-deployment"

echo "🚀 Setting up database: $DB_FILE"
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

# Run migrations in order (matching migrations.rs)
echo "📦 Applying core migrations..."

migrations=(
    "001:staff_users"
    "024:restaurant_settings"
    "025:setup_wizard_state"
    "031:add_online_sync_columns"
    "034:wizard_provisioning_data"
    "035:wizard_owner_flag"
    "042:add_owner_name"
    "044:restaurant_settings_missing_columns"
    "048:device_settings"
    "049:user_device_alignment"
    "053:minimal_tenant_config"
)

for migration in "${migrations[@]}"; do
    version="${migration%%:*}"
    name="${migration##*:}"
    file="$MIGRATIONS_DIR/${version}_${name}.sql"

    if [ -f "$file" ]; then
        echo "  ▶ Running migration $version: $name"
        sqlite3 "$DB_FILE" < "$file"

        # Mark as applied
        sqlite3 "$DB_FILE" <<EOF
INSERT OR REPLACE INTO schema_migrations (version, name, description, source, checksum, applied_at, app_version)
VALUES ($version, '$name', 'Core migration', 'built-in', 'core-$name', strftime('%s', 'now'), '3.1.4');
EOF
    else
        echo "  ⚠️  Warning: Migration file not found: $file"
    fi
done

echo ""
echo "✅ Core migrations complete"

# Insert basic tenant configuration
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
echo "🔍 Verifying database setup..."
RESULT=$(sqlite3 "$DB_FILE" "SELECT 'Tenant: ' || tenant_id || ' | Company: ' || company_name FROM tenant_config WHERE id = 1;")

if [ -n "$RESULT" ]; then
    echo "✅ $RESULT"
    echo ""
    echo "🎉 Database setup complete!"
    echo "📊 Database: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
    echo "📝 Migrations applied: $(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM schema_migrations;")"
    echo ""
    echo "Next steps:"
    echo "1. Run: npm run tauri dev"
    echo "2. The app should now start with tenant data"
    echo "3. Complete your restaurant setup"
else
    echo "❌ Tenant configuration not found"
    exit 1
fi
