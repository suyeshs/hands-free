# Production Migration Strategy & Breaking Change Framework

## Current Crisis: v3.0 → v3.1 Migration Conflict

### The Problem

**v3.0 (Shipped to Production)**:
- Migration 15: `014_sync_tables.sql` (WIP feature - floor plan sync)
- Migration 16: `021_i18n_support.sql` (WIP feature - i18n)
- Migration 17: `022_seed_translations.sql` (WIP feature - i18n)

**v3.1 (Current)**:
- Migration 15: `014_sales_sync.sql` (Different content!)
- Migration 16: `015_order_mappings.sql`
- Migration 17: `016_attendance_records.sql`

**Result**: When users upgrade from v3.0 → v3.1:
```
error: migration 15 was previously applied but has been modified
```

### Impact Assessment

**At Risk**:
- ✅ Sales transactions (local only, not cloud synced)
- ✅ Order history
- ✅ KOT records
- ✅ Cash register data
- ✅ Inventory adjustments
- ✅ Staff attendance records

**Safe (Cloud Synced)**:
- ✅ Menu items
- ✅ Staff users
- ✅ Restaurant settings
- ✅ Floor plans (if sync worked)

---

## Immediate Solution for v3.1

### Option 1: Skip Conflicting Migration Numbers (RECOMMENDED)

Renumber migrations in v3.1 to avoid conflict:

```typescript
// src-tauri/src/lib.rs
tauri_plugin_sql::Migration {
    version: 14,
    description: "create out of stock items table",
    sql: include_str!("../migrations/013_out_of_stock.sql"),
    kind: tauri_plugin_sql::MigrationKind::Up,
},
// Skip 15-17 (already used by WIP features in v3.0)
// Start production migrations at 18
tauri_plugin_sql::Migration {
    version: 18,
    description: "create sales sync metadata tables",
    sql: include_str!("../migrations/014_sales_sync.sql"),
    kind: tauri_plugin_sql::MigrationKind::Up,
},
tauri_plugin_sql::Migration {
    version: 19,
    description: "create order mappings table",
    sql: include_str!("../migrations/015_order_mappings.sql"),
    kind: tauri_plugin_sql::MigrationKind::Up,
},
// ... continue numbering
```

**Why This Works**:
- v3.0 users have migrations 1-14, then 15-17 (WIP)
- v3.1 users get migrations 1-14, skip 15-17, then 18+ (production)
- No conflict because we're not modifying existing migrations
- Tauri SQL plugin is happy

**Downside**: Gap in migration numbers (15-17 missing)

---

### Option 2: Database Reset with Cloud Backup/Restore

Add migration detection on app startup:

```typescript
// src/lib/migrationGuard.ts
export async function checkMigrationCompatibility() {
  const db = await Database.load('sqlite:pos.db');

  // Check if conflicting migrations exist
  const conflictingMigrations = await db.select(`
    SELECT version, checksum FROM migrations
    WHERE version IN (15, 16, 17)
  `);

  if (conflictingMigrations.length > 0) {
    // User has v3.0 WIP migrations
    console.warn('[Migration] Detected v3.0 WIP migrations, need to migrate');

    // Backup critical data to cloud
    await backupCriticalData();

    // Rename old database
    await renameDatabase('pos.db', 'pos.db.v3.0.backup');

    // Create fresh database (migrations run automatically)
    // Restore data from cloud
    await restoreFromCloud();
  }
}
```

**Pros**:
- Clean slate for v3.1
- No migration conflicts
- Cloud data is restored

**Cons**:
- Requires cloud sync to be working
- Unsync'd local data is lost (sales transactions, KOT records)

---

## Long-Term Framework: Handling Breaking Changes

### 1. Migration Best Practices

#### Rule 1: Migrations Are Append-Only

```
✅ GOOD: Add new migrations with incrementing numbers
❌ BAD: Modify existing migration files
❌ BAD: Reuse migration numbers
```

#### Rule 2: Never Ship WIP Migrations to Production

```typescript
// ✅ GOOD: Use feature flags for WIP code
if (featureFlags.i18nEnabled) {
  // Use i18n features
}

// ❌ BAD: Include WIP migrations in production builds
tauri_plugin_sql::Migration {
    version: 15,
    sql: include_str!("../migrations/021_i18n_support.sql"), // Not ready!
}
```

#### Rule 3: Test Migration Paths Before Release

```bash
# Before releasing v3.X:
1. Install v3.(X-1) on clean machine
2. Add test data (orders, sales, etc.)
3. Upgrade to v3.X
4. Verify all data is preserved
5. Check migrations table for conflicts
```

---

### 2. Version Compatibility Matrix

Maintain a compatibility matrix:

| From Version | To Version | Migration Path | Data Loss Risk | Notes |
|-------------|------------|---------------|----------------|-------|
| v3.0        | v3.1       | Skip 15-17    | Medium         | Unsync'd sales at risk |
| v3.1        | v3.2       | Direct        | None           | Clean migration path |
| v2.x        | v3.x       | Reset + Cloud | High           | Major schema changes |

---

### 3. Pre-Upgrade Backup Strategy

**Auto-Backup on Startup** (before migrations run):

```typescript
// src-tauri/src/lib.rs - setup()
async fn create_backup_before_migration() {
    let db_path = app.path().app_data_dir().unwrap().join("pos.db");
    let backup_path = app.path().app_data_dir().unwrap()
        .join(format!("pos.db.backup.{}", chrono::Utc::now().format("%Y%m%d-%H%M%S")));

    if db_path.exists() {
        std::fs::copy(&db_path, &backup_path)?;
        println!("[Backup] Created backup at {:?}", backup_path);
    }
}
```

**Cloud Sync Critical Data**:

```typescript
// Before migrations run
await syncCriticalDataToCloud([
  'sales_transactions',
  'kds_orders',
  'table_sessions',
  'cash_registers',
  'inventory_adjustments'
]);
```

---

### 4. Migration Conflict Detection

Add startup check:

```typescript
// src/App.tsx - useEffect
useEffect(() => {
  const checkMigrations = async () => {
    try {
      const conflicts = await detectMigrationConflicts();

      if (conflicts.length > 0) {
        // Show user dialog
        const userChoice = await showMigrationDialog({
          title: 'Database Update Required',
          message: 'Your database needs to be updated. Choose an option:',
          options: [
            { label: 'Backup & Continue', value: 'backup' },
            { label: 'Restore from Cloud', value: 'cloud' },
            { label: 'Cancel (Exit App)', value: 'cancel' }
          ]
        });

        if (userChoice === 'backup') {
          await handleMigrationWithBackup();
        } else if (userChoice === 'cloud') {
          await handleMigrationFromCloud();
        } else {
          await exit(1);
        }
      }

      // Proceed with normal migrations
      await runPendingMigrations();
    } catch (error) {
      console.error('[Migration] Failed:', error);
      // Don't let app start with broken database
      await exit(1);
    }
  };

  checkMigrations();
}, []);
```

---

### 5. Release Checklist Template

Before releasing any version:

```markdown
## Pre-Release Migration Checklist

### Schema Changes
- [ ] All migrations are new (no modifications to existing)
- [ ] Migration numbers are sequential (no gaps or reuse)
- [ ] Migration files exist in git
- [ ] No WIP/experimental migrations included

### Testing
- [ ] Tested upgrade path from previous version
- [ ] Verified data preservation (sales, orders, etc.)
- [ ] Checked migration table for conflicts
- [ ] Tested on fresh install
- [ ] Tested on existing install with data

### Backup Strategy
- [ ] Auto-backup implemented before migrations
- [ ] Cloud sync for critical tables enabled
- [ ] Rollback procedure documented
- [ ] User communication prepared (if data loss possible)

### Documentation
- [ ] CHANGELOG updated with breaking changes
- [ ] Migration strategy documented
- [ ] User upgrade guide written
- [ ] Rollback instructions provided
```

---

## Recommended Action for v3.1 Release

### Immediate Fix (Next 1 Hour)

1. **Renumber migrations in v3.1** to skip 15-17:
   ```typescript
   // Change version: 15 → 18
   // Change version: 16 → 19
   // Change version: 17 → 20
   // etc.
   ```

2. **Update `src-tauri/src/lib.rs`** with new numbering

3. **Test clean install** (should work)

4. **Test upgrade from v3.0** (should work because no conflict)

### Short-Term (This Week)

1. **Implement auto-backup** before migrations run

2. **Add migration conflict detection** on startup

3. **Create rollback guide** for users if upgrade fails

### Long-Term (Next Release)

1. **Never ship WIP migrations** to production again

2. **Use feature flags** for experimental features

3. **Follow migration best practices** documented here

---

## User Communication Template

For v3.1 release notes:

```markdown
### ⚠️ Important Upgrade Information

**For users upgrading from v3.0**:

This version includes important database updates. Your data is safe, but please:

1. **Before upgrading**:
   - Ensure all pending orders are completed
   - Sync to cloud (Settings → Sync Now)
   - Close the app completely

2. **During upgrade**:
   - A backup of your database will be created automatically
   - Located at: `%APPDATA%\com.stonepot-tech.handsfree-pos\pos.db.backup.YYYYMMDD`

3. **After upgrade**:
   - Verify your sales data is present
   - Check that all menu items are visible
   - Test creating a new order

4. **If something goes wrong**:
   - Contact support immediately
   - Keep the backup file (don't delete it)
   - We can restore your data from the backup
```

---

## Future-Proof Architecture

### Versioned Schemas

Instead of sequential migrations, use versioned schemas:

```typescript
const SCHEMA_VERSION = 'v3.1.0';

interface SchemaVersion {
  version: string;
  migrations: Migration[];
  compatibleFrom: string[]; // Which versions can upgrade
  dataTransforms: DataTransform[]; // How to migrate data
}
```

### Schema Compatibility Layer

```typescript
async function canUpgradeFrom(currentVersion: string, targetVersion: string): boolean {
  const compatibility = await getCompatibilityMatrix();
  return compatibility[currentVersion]?.includes(targetVersion) ?? false;
}
```

---

## Summary

**Immediate Problem**: v3.0 users can't upgrade to v3.1 due to migration conflict

**Root Cause**: WIP migrations shipped to production, then repurposed

**Solution**: Skip migration numbers 15-17 in v3.1, start at 18

**Prevention**:
- Never ship WIP migrations
- Use feature flags
- Test upgrade paths
- Auto-backup before migrations

**Framework Established**: ✅ Best practices, testing checklist, user communication template

---

**Next Steps**:
1. Implement migration renumbering fix
2. Add auto-backup mechanism
3. Test upgrade path from v3.0 → v3.1
4. Document in release notes
5. Apply this framework to all future releases
