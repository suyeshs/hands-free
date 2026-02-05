# Schema Sync Process - Keep SQLite and D1 in Sync

## Overview

When adding new features to the POS system, database schema changes must be synchronized between:
1. **Local SQLite** (Tauri app - source of truth)
2. **D1 Database** (Cloudflare cloud sync - must match exactly)

This document outlines the process to keep them in sync.

## Schema Sync Workflow

### Step 1: Create Local SQLite Migration

When adding a new feature (e.g., Bar Management), create a migration in the local SQLite:

```bash
# Create new migration file
touch src-tauri/migrations/032_bar_orders.sql
```

Example structure:
```sql
-- Migration 032: Bar Orders Table
-- Mirrors kds_orders structure but for bar/beverage orders
-- Created: 2026-01-23

CREATE TABLE IF NOT EXISTS bar_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    -- ... other columns
);

CREATE INDEX IF NOT EXISTS idx_bar_orders_tenant_status
    ON bar_orders(tenant_id, status);
```

**Rules for SQLite Migrations:**
- Number migrations sequentially (032, 033, etc.)
- Include descriptive comments
- Use `IF NOT EXISTS` for idempotency
- Add appropriate indexes
- Follow existing naming conventions (snake_case)

### Step 2: Register Migration in Tauri

Add the migration to `src-tauri/src/lib.rs`:

```rust
// In the migrations array
include_str!("../migrations/032_bar_orders.sql"),
include_str!("../migrations/033_bar_inventory.sql"),
```

**Test locally:**
```bash
cd src-tauri
cargo build
```

### Step 3: Extract Schema for D1

Use the schema extraction tool:

```bash
# Option 1: Manual extraction
sqlite3 /path/to/local.db ".schema bar_orders" > /tmp/bar_orders_schema.sql

# Option 2: Extract all new tables
cd src-tauri/migrations
cat 032_*.sql 033_*.sql > /tmp/new_bar_tables.sql
```

### Step 4: Update D1 Migration

Add the new tables to `docs/d1-complete-migration.sql`:

```bash
# Append new tables to D1 migration
cat >> docs/d1-complete-migration.sql << 'EOF'

-- =========================================
-- BAR MANAGEMENT TABLES (7 tables)
-- Added: 2026-01-23
-- =========================================

-- [Paste schema from Step 3]
EOF
```

**Important:**
- Update the total table count in header comment
- Update the footer comment
- Maintain exact schema match with SQLite

### Step 5: Verify Schema Match

Run the schema comparison tool:

```bash
# Compare local SQLite schema with D1 migration
node scripts/compare-schemas.js
```

Or manually verify:
```bash
# Check SQLite schema
sqlite3 /path/to/local.db ".schema bar_orders"

# Check D1 migration
grep -A 30 "CREATE TABLE.*bar_orders" docs/d1-complete-migration.sql
```

**They must be identical** - same columns, types, defaults, constraints.

### Step 6: Apply D1 Migration

Apply the updated migration to your D1 database:

```bash
# Apply complete migration (safe with IF NOT EXISTS)
wrangler d1 execute direct-test-2026_db --remote --file=./docs/d1-complete-migration.sql

# Verify table count
wrangler d1 execute direct-test-2026_db --remote --command="SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
# Should show 44 tables (37 core + 7 bar)

# Verify specific table exists
wrangler d1 execute direct-test-2026_db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='bar_orders'"
```

### Step 7: Update Sync Endpoints

Add new sync endpoints to Cloudflare Worker:

```typescript
// POST /api/bar/:tenantId/orders/sync
app.post('/api/bar/:tenantId/orders/sync', async (c) => {
  const { tenantId } = c.req.param();
  const { orders } = await c.req.json();

  const db = c.env.DB;

  if (orders && orders.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO bar_orders
      (id, order_number, table_number, order_type, source, status, items_json, created_at, tenant_id)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `);

    const batch = orders.map((order: any) =>
      stmt.bind(
        order.id,
        order.order_number,
        order.table_number,
        order.order_type,
        order.source,
        order.status,
        order.items_json,
        order.created_at,
        tenantId
      )
    );

    await db.batch(batch);
  }

  return c.json({
    success: true,
    synced: orders?.length || 0
  });
});
```

### Step 8: Update Service Worker Sync

Add new data types to sync intervals in `src/services/sync/TieredSyncManager.ts`:

```typescript
// Add to SYNC_INTERVALS
barOrders: {
  name: 'barOrders',
  interval: 60000, // 1 minute (Tier 1 - critical)
  enabled: true,
},
barInventory: {
  name: 'barInventory',
  interval: 180000, // 3 minutes (Tier 2)
  enabled: true,
},
```

And add sync functions:

```typescript
private getSyncFunction(name: string): (() => Promise<void>) | null {
  const syncFunctions: Record<string, () => Promise<void>> = {
    // ... existing functions
    barOrders: () => this.syncBarOrders(),
    barInventory: () => this.syncBarInventory(),
  };

  return syncFunctions[name] || null;
}

private async syncBarOrders(): Promise<void> {
  // Implement bar orders sync logic
  console.log('[TieredSync] Syncing bar orders...');
  // Query local DB for pending bar orders
  // Call /api/bar/:tenantId/orders/sync endpoint
}
```

### Step 9: Update Documentation

Update schema documentation:

1. **SYNC_TRIGGERS.md**
   - Add new tables to "What Gets Synced" section
   - Update total table count (44 instead of 37)
   - Add bar sync intervals if different

2. **D1_COMPLETE_MIGRATION.md**
   - Add bar tables to the table list
   - Add bar endpoints to the endpoint list
   - Update total count (44 tables)

3. **MENU_SYNC_FIX.md** or create **BAR_SYNC.md**
   - Document bar-specific sync flow
   - Document any special considerations

### Step 10: Test End-to-End

Test the complete sync flow:

```bash
# 1. Test local SQLite
# - Create a bar order in the app
# - Verify it appears in local SQLite

# 2. Test Service Worker sync
# - Check DevTools → Application → IndexedDB → sync-queue
# - Verify bar order is queued

# 3. Wait for automatic sync or trigger manual sync
# - Settings → System & Training → Cloud Sync → Sync Now

# 4. Verify D1 sync
wrangler d1 execute direct-test-2026_db --remote --command="SELECT * FROM bar_orders LIMIT 5"

# 5. Test multi-device
# - Create order on Device A
# - Wait for sync
# - Verify appears on Device B
```

## Automation Tools

### Schema Comparison Script

Create `scripts/compare-schemas.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Extract CREATE TABLE statements from both sources
function extractTables(sqlContent) {
  const tables = new Map();
  const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\);/g;
  let match;

  while ((match = tableRegex.exec(sqlContent)) !== null) {
    tables.set(match[1], match[2].trim());
  }

  return tables;
}

// Compare local SQLite migrations with D1 migration
const migrationsDir = path.join(__dirname, '../src-tauri/migrations');
const d1Migration = path.join(__dirname, '../docs/d1-complete-migration.sql');

// Read all local migrations
const localTables = new Map();
fs.readdirSync(migrationsDir).forEach(file => {
  if (file.endsWith('.sql')) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const tables = extractTables(content);
    tables.forEach((schema, name) => localTables.set(name, schema));
  }
});

// Read D1 migration
const d1Content = fs.readFileSync(d1Migration, 'utf8');
const d1Tables = extractTables(d1Content);

// Compare
console.log('Schema Comparison Report\n');
console.log(`Local SQLite tables: ${localTables.size}`);
console.log(`D1 tables: ${d1Tables.size}\n`);

// Find missing in D1
const missingInD1 = [];
localTables.forEach((schema, name) => {
  if (!d1Tables.has(name)) {
    missingInD1.push(name);
  }
});

if (missingInD1.length > 0) {
  console.log('❌ Tables missing in D1:');
  missingInD1.forEach(name => console.log(`  - ${name}`));
  console.log('');
}

// Find schema mismatches
const mismatches = [];
localTables.forEach((localSchema, name) => {
  const d1Schema = d1Tables.get(name);
  if (d1Schema && localSchema !== d1Schema) {
    mismatches.push(name);
  }
});

if (mismatches.length > 0) {
  console.log('⚠️  Tables with schema mismatches:');
  mismatches.forEach(name => console.log(`  - ${name}`));
  console.log('');
}

if (missingInD1.length === 0 && mismatches.length === 0) {
  console.log('✅ All schemas match perfectly!');
} else {
  process.exit(1);
}
```

Usage:
```bash
node scripts/compare-schemas.js
```

### Migration Generator

Create `scripts/generate-d1-migration.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read all local migrations and generate D1 migration
const migrationsDir = path.join(__dirname, '../src-tauri/migrations');
const outputFile = path.join(__dirname, '../docs/d1-complete-migration.sql');

let allTables = [];
let tableCount = 0;

// Read migrations in order
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

files.forEach(file => {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Skip local-only tables
  if (content.includes('-- LOCAL_ONLY')) {
    return;
  }

  allTables.push(`-- From ${file}`);
  allTables.push(content);
  allTables.push('');

  // Count tables in this migration
  const matches = content.match(/CREATE TABLE IF NOT EXISTS/g);
  if (matches) tableCount += matches.length;
});

// Generate complete migration
const header = `-- =========================================
-- COMPREHENSIVE D1 DATABASE MIGRATION
-- Restaurant POS AI - ALL TABLES
-- =========================================
--
-- This migration creates ALL tables needed for cloud sync
-- Schema MUST match local SQLite exactly for sync to work
--
-- Total: ${tableCount} tables requiring D1 sync
-- Generated: ${new Date().toISOString()}
-- =========================================

`;

const footer = `
-- =========================================
-- MIGRATION COMPLETE
-- =========================================
--
-- Total Tables Created: ${tableCount}
--
-- Next Steps:
-- 1. Apply this migration using Wrangler CLI
-- 2. Update Cloudflare Worker with sync endpoints
-- 3. Test sync from POS to D1
-- 4. Verify data appears in D1 database
--
-- For schema sync process, see: SCHEMA_SYNC_PROCESS.md
-- =========================================
`;

const fullMigration = header + allTables.join('\n') + footer;

fs.writeFileSync(outputFile, fullMigration);

console.log(`✅ Generated D1 migration with ${tableCount} tables`);
console.log(`📄 Output: ${outputFile}`);
```

Usage:
```bash
# Regenerate D1 migration from all local migrations
node scripts/generate-d1-migration.js
```

## Quick Reference

### Adding a New Feature with Database Tables

1. **Create SQLite migration** → `src-tauri/migrations/XXX_feature.sql`
2. **Register in Tauri** → `src-tauri/src/lib.rs`
3. **Test locally** → `cargo build`
4. **Update D1 migration** → `docs/d1-complete-migration.sql`
5. **Apply to D1** → `wrangler d1 execute ... --file=...`
6. **Add sync endpoint** → Cloudflare Worker
7. **Update Service Worker** → Add sync interval
8. **Update docs** → Update table counts
9. **Test end-to-end** → Verify sync works

### Table Count Tracking

Current tables (as of 2026-01-23):
- **Core POS**: 37 tables
- **Bar Management**: 7 tables
- **Total**: 44 tables

When adding new tables, update:
- `docs/d1-complete-migration.sql` (header and footer)
- `docs/D1_COMPLETE_MIGRATION.md` (table list)
- `SYNC_TRIGGERS.md` (sync intervals)
- `src/components/home/D1StatusCard.tsx` (requiredTables count)

## Common Issues

### Schema Mismatch

**Problem**: Sync fails with "column not found" or "table not found"

**Solution**:
1. Run `node scripts/compare-schemas.js`
2. Identify the mismatch
3. Update D1 migration to match SQLite exactly
4. Re-apply migration

### Forgotten Table

**Problem**: New table works locally but doesn't sync

**Solution**:
1. Check if table is in D1 migration
2. If not, add it following Step 4
3. Apply D1 migration
4. Add sync endpoint (Step 7)
5. Update Service Worker (Step 8)

### Wrong Data Type

**Problem**: Sync works but data is corrupted

**Solution**:
1. Check column data types match exactly
2. SQLite uses: TEXT, INTEGER, REAL, BLOB
3. D1 uses: TEXT, INTEGER, REAL
4. Boolean in SQLite = INTEGER (0/1)
5. JSON in SQLite = TEXT (use JSON.stringify/parse)

## Best Practices

1. **Always use IF NOT EXISTS** - Migrations should be idempotent
2. **Match schemas exactly** - Column order, types, defaults must match
3. **Test locally first** - Verify SQLite migration works before D1
4. **Document changes** - Update all relevant documentation
5. **Version migrations** - Number them sequentially
6. **Sync incrementally** - Add tables one feature at a time
7. **Monitor sync** - Check D1StatusCard after adding tables

## Related Files

- **Local Migrations**: `src-tauri/migrations/*.sql`
- **D1 Migration**: `docs/d1-complete-migration.sql`
- **D1 Docs**: `docs/D1_COMPLETE_MIGRATION.md`
- **Sync Triggers**: `SYNC_TRIGGERS.md`
- **Service Worker**: `src/services/sync/TieredSyncManager.ts`
- **D1 Status Card**: `src/components/home/D1StatusCard.tsx`

---

**Last Updated**: 2026-01-23
**Current Table Count**: 44 tables (37 core + 7 bar)
**Version**: v3.1.0
