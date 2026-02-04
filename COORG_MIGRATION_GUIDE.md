# Coorg Food Company Migration Guide

## Overview

This guide covers migrating the `coorg-food-company-6163` tenant from v1.0 database to the current system.

## What Gets Migrated

### Data Migrated:
- ✅ **Sales Transactions** - All closed orders from `table_sessions`
- ✅ **Staff Accounts** - All staff users with credentials preserved
- ✅ **Active Sessions** - Any in-progress orders
- ✅ **Menu Items** - If they exist in v1.0 database

### Data Transformation:
- **Sales Format**: JSON in `table_sessions.order_data` → Structured `sales_transactions` table
- **Taxes**: Calculated as 2.5% CGST + 2.5% SGST (5% total GST)
- **Invoice Numbers**: Generated as `MIG-000001`, `MIG-000002`, etc.
- **Payment Method**: Defaults to "cash" (v1.0 didn't track payment methods)

### Data Preserved:
- Original `tenant_id`: `coorg-food-company-6163`
- Staff PINs and credentials
- Order timestamps
- Table numbers
- Guest counts

## Migration Methods

### Method 1: Command Line Script (Recommended for Testing)

**Prerequisites:**
- Bun installed
- v1.0 database file (`pos.db`) in the project directory

**Steps:**

```bash
# Navigate to project directory
cd /Users/stonepot-tech/projects/restaurant-pos-ai

# Run migration script
bun run migrate:coorg
```

**Output:**
- Creates backup: `pos-v1-backup-{timestamp}.db`
- Creates export: `migration-export-{timestamp}.json`
- Displays validation results
- Archives old database: `pos-v1-archive-{timestamp}.db`

### Method 2: In-App UI

**Prerequisites:**
- Development server running

**Steps:**

1. Start the dev server:
   ```bash
   bun run dev
   ```

2. Navigate to migration page:
   ```
   http://localhost:5173/#/coorg-migration
   ```

3. Click "Start Migration" and wait for completion

4. Review validation results

5. Reload application when complete

### Method 3: Programmatic API

```typescript
import { runFullMigration } from './services/coorgMigrationService';

// Run migration with progress callback
const validation = await runFullMigration((progress) => {
  console.log(`${progress.step}: ${progress.message} (${progress.progress}%)`);
});

console.log('Migration complete:', validation);
```

## Migration Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. EXPORT                                                   │
│    - Connect to pos.db                                      │
│    - Export closed sales (table_sessions)                   │
│    - Export staff users                                     │
│    - Export active sessions                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BACKUP                                                   │
│    - Copy pos.db → pos-v1-backup-{timestamp}.db            │
│    - Save export → migration-export-{timestamp}.json        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. IMPORT                                                   │
│    - Connect to guanix.db (new database)                    │
│    - Import staff users                                     │
│    - Transform & import sales transactions                  │
│    - Import active sessions                                 │
│    - Initialize restaurant_settings                         │
│    - Ensure tenant_config exists                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. VALIDATE                                                 │
│    - Count staff (expected vs actual)                       │
│    - Count sales (expected vs actual)                       │
│    - Calculate total revenue                                │
│    - Get date range                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. COMMIT (if validation passes)                            │
│    - Rename pos.db → pos-v1-archive-{timestamp}.db         │
│    - Mark migration complete in localStorage                │
│    - App now uses guanix.db                                 │
└─────────────────────────────────────────────────────────────┘
```

## Validation Checks

After migration, the following are validated:

1. **Staff Count Match**
   - Expected: Number of staff in v1.0 database
   - Actual: Number of staff in new database
   - Must match exactly

2. **Sales Count Match**
   - Expected: Number of closed orders in v1.0
   - Actual: Number of sales_transactions in new database
   - Must match exactly

3. **Data Integrity**
   - Revenue total calculated
   - Date range verified (oldest to newest sale)
   - Tenant ID preserved

## Safety Features

### Automatic Backups
- Original database copied before any changes
- Export saved as JSON for data recovery
- No destructive operations until validation passes

### Rollback Capability
If something goes wrong:

```typescript
import { rollbackMigration } from './services/coorgMigrationService';

// Restore from backup
await rollbackMigration('pos-v1-backup-{timestamp}.db');
```

### Validation Before Commit
- Data counts verified
- Revenue calculated
- User can review before finalizing

## Expected Results

### Sample Output

```
╔════════════════════════════════════════════════════════╗
║   V1.0 to Current System Migration                    ║
║   Tenant: coorg-food-company-6163                      ║
╚════════════════════════════════════════════════════════╝

ℹ️  Step 1: Exporting v1.0 data
ℹ️  Connecting to v1.0 database...
ℹ️  Found 1,234 closed sales
ℹ️  Found 2 active sessions
ℹ️  Found 5 staff users

ℹ️  Step 2: Creating backup
✅ Database backed up to: pos-v1-backup-2026-02-04T12-30-00.db
✅ Export data saved to: migration-export-2026-02-04T12-30-00.json

ℹ️  Step 3: Importing to new database
✅ Imported 5 staff users
✅ Imported 1,234 sales transactions
✅ Imported 2 active sessions
✅ Restaurant settings initialized

ℹ️  Step 4: Validating migration

=== VALIDATION RESULTS ===
Staff Users:
  Expected: 5
  Actual: 5
  Match: ✅

Sales Transactions:
  Expected: 1234
  Actual: 1234
  Match: ✅

Revenue:
  Total: ₹245,678.00

Date Range:
  Oldest: 2024-01-15
  Newest: 2026-02-04

Overall Success: ✅
========================

╔════════════════════════════════════════════════════════╗
║   ✅ MIGRATION COMPLETED SUCCESSFULLY                  ║
╚════════════════════════════════════════════════════════╝

Backup files:
  - Database: pos-v1-backup-2026-02-04T12-30-00.db
  - Export JSON: migration-export-2026-02-04T12-30-00.json

Next steps:
  1. Review the validation results above
  2. Test the new database with the application
  3. If everything looks good, archive the old database
  4. Trigger D1 sync to push data to cloud
```

## Troubleshooting

### Error: "No tenant_id found"

**Cause**: v1.0 database doesn't have tenant_id in table_sessions

**Solution**:
- Check if database is actually v1.0
- Manually add tenant_id if needed:
  ```sql
  UPDATE table_sessions SET tenant_id = 'coorg-food-company-6163';
  ```

### Error: "sales_transactions table already exists"

**Cause**: Database is not v1.0, already migrated

**Solution**:
- Verify database version
- Check if migration already completed
- Use a different database file if testing

### Error: "Validation failed - data mismatch"

**Cause**: Some records failed to import

**Solution**:
- Check migration logs for specific errors
- Review export JSON file
- Retry migration with fixed data

### Error: "Database file not found"

**Cause**: pos.db not in expected location

**Solution**:
- Ensure pos.db is in project directory (for script)
- Or in app data directory (for Tauri app)
- Check file permissions

## Post-Migration Steps

### 1. Verify Application Works

```bash
# Start dev server
bun run dev

# Test:
# - Staff can login with existing PINs
# - Sales reports show historical data
# - Active orders still visible
# - Invoice numbering starts correctly
```

### 2. Review Restaurant Settings

Navigate to Settings → Restaurant Details and verify:
- Restaurant name: "Coorg Food Company"
- Tax rates: 2.5% CGST, 2.5% SGST
- Invoice prefix: "MIG"
- Invoice numbering starts after last migrated invoice

### 3. Sync to Cloud (if using D1)

```typescript
import { D1SyncService } from './services/sync/D1SyncService';

const syncService = new D1SyncService();

// Mark all records as needing sync
await db.execute(
  'UPDATE sales_transactions SET synced_at = NULL WHERE tenant_id = ?',
  ['coorg-food-company-6163']
);

// Trigger full sync
await syncService.syncAllData();
```

### 4. Archive Old Database

Once verified, the old database is safely archived:
- Location: `pos-v1-archive-{timestamp}.db`
- Keep for at least 30 days as backup
- Export JSON also available for reference

## Files Created

### Migration Script
- `scripts/migrate-coorg-food-company.ts` - Standalone CLI script

### Service Module
- `src/services/coorgMigrationService.ts` - Reusable migration functions

### UI Component
- `src/pages/CoorgMigrationPage.tsx` - Interactive migration UI

### Documentation
- `COORG_MIGRATION_GUIDE.md` - This file

## Technical Details

### Database Schema Changes

**v1.0 table_sessions:**
```sql
CREATE TABLE table_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  table_number INTEGER,
  guest_count INTEGER,
  server_name TEXT,
  started_at TEXT,
  closed_at TEXT,
  status TEXT,
  order_data TEXT -- JSON with items, subtotal, etc.
);
```

**Current sales_transactions:**
```sql
CREATE TABLE sales_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
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
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
```

### Tax Calculation

```typescript
const subtotal = orderData.subtotal;
const cgst = subtotal * 0.025; // 2.5%
const sgst = subtotal * 0.025; // 2.5%
const total = subtotal + cgst + sgst - discount;
const grandTotal = Math.round(total);
const roundOff = grandTotal - total;
```

## Support

If you encounter issues during migration:

1. **Check Logs**: Look for detailed error messages in console
2. **Review Export**: Check `migration-export-{timestamp}.json` for data
3. **Verify Backup**: Ensure `pos-v1-backup-{timestamp}.db` was created
4. **Rollback**: Use rollback function if needed
5. **Contact Support**: Provide error logs and export file

## Timeline

- **Export & Backup**: ~30 seconds
- **Import & Transform**: ~2-5 minutes (depends on data volume)
- **Validation**: ~10 seconds
- **Total**: ~3-6 minutes for typical restaurant

## FAQ

**Q: Will my original data be deleted?**
A: No, the original database is backed up automatically before migration.

**Q: Can I undo the migration?**
A: Yes, use the rollback function or manually restore from backup.

**Q: What happens to active orders?**
A: Active table sessions are preserved and will continue working after migration.

**Q: Will staff need new PINs?**
A: No, all credentials are preserved exactly as they were.

**Q: What if validation fails?**
A: The migration will not commit. Original database remains untouched. Check logs for specific issues.

**Q: Do I need internet for migration?**
A: No, migration is entirely local. Cloud sync is a separate optional step afterward.

**Q: How long should I keep backups?**
A: Keep for at least 30 days. After that, they can be archived or deleted if everything works well.
