# Quick Start Guide - Coorg Migration Tool

## For Developers

### Test the Tool Locally

```bash
cd apps/coorg-migration-tool
npm install
npm run tauri dev
```

**What happens:**
1. First run compiles Rust (2-3 minutes)
2. App window opens
3. Automatically detects `pos.db` in:
   - macOS: `~/Library/Application Support/restaurant-pos-ai/`
   - Windows: `%APPDATA%/restaurant-pos-ai/`
   - Linux: `~/.local/share/restaurant-pos-ai/`

### Build Production Executable

```bash
npm run tauri build
```

**Output location:** `src-tauri/target/release/bundle/`

**File sizes:**
- macOS: `Coorg Migration Tool.dmg` (~25MB)
- Windows: Setup exe (~18MB)
- Linux: `.AppImage` (~20MB)

---

## For Production Use

### Prerequisites

✅ Close the old POS application completely
✅ Ensure `pos.db` exists in the app data directory
✅ Have 50MB free disk space
✅ 5-10 minutes of downtime

### Step-by-Step

1. **Download** the migration tool executable
   - macOS: `.dmg` file
   - Windows: `.exe` installer
   - Linux: `.AppImage` file

2. **Close** the old POS application
   - Important: Must not be running during migration

3. **Run** the migration tool
   - macOS: Open `.dmg`, drag to Applications, launch
   - Windows: Run `.exe`, follow installer, launch
   - Linux: Make executable (`chmod +x`), run

4. **Detection Screen**
   - Tool automatically finds `pos.db`
   - Shows: Staff count, Sales count
   - If not found, check app data directory

5. **Start Migration**
   - Click "Start Migration" button
   - Watch progress bar (8 steps)
   - Takes 1-3 minutes depending on data size

6. **Progress Steps**
   ```
   [5%]  Detecting database...
   [10%] Exporting data...
   [20%] Creating backup...
   [25%] Creating new database...
   [70%] Importing data...
   [80%] Validating...
   [90%] Committing...
   [100%] Complete!
   ```

7. **Validation Screen**
   - Shows counts: Staff, Sales, Revenue
   - Verify numbers match expectations
   - If errors, contact support

8. **Success!**
   - `guanix.db` created successfully
   - Old `pos.db` archived as `pos-v1-archived-{date}.db`
   - Backup created: `pos-v1-backup-{date}.db`
   - JSON export: `migration-export-{date}.json`

9. **Install New POS**
   - Close migration tool
   - Install latest POS version
   - Launch POS app
   - Login with existing credentials
   - Verify data is present

---

## What Gets Migrated

### ✅ Migrated
- **Staff accounts** - All users with PIN hashes (no re-login needed)
- **Sales history** - All closed orders from v1.0
- **Active orders** - In-progress orders preserved
- **Settings** - Restaurant name, tenant ID

### ✅ Transformed
- **JSON orders** → Structured SQL records
- **Taxes** → Calculated (2.5% CGST + 2.5% SGST)
- **Invoice numbers** → Generated (`MIG-000001`, etc.)
- **Payment method** → Defaults to "cash"

### ❌ Not Migrated (Must Re-Upload)
- Menu items/categories (if any in v1.0)
- Custom printer configurations
- Custom tax rules

---

## Troubleshooting

### "Database not found"
**Problem**: Tool can't find `pos.db`
**Solution**:
- Verify old POS was installed
- Check app data directory manually
- Ensure POS created `pos.db` (not still in memory)

### "Already migrated"
**Problem**: Database has `sales_transactions` table
**Solution**:
- This database was already migrated
- Delete `guanix.db` to retry
- Or use backup to restore v1.0

### "Validation failed"
**Problem**: Counts don't match after import
**Solution**:
- Check error messages
- Verify JSON format in `migration-export-{date}.json`
- Contact support with backup files

### App won't open
**Problem**: Double-clicking does nothing
**Solution**:
- macOS: Right-click → Open (bypass Gatekeeper)
- Windows: Click "More info" → "Run anyway"
- Linux: `chmod +x` the AppImage

---

## Backup Files Created

All created in the app data directory:

1. **`pos-v1-backup-{timestamp}.db`**
   - Complete copy of original database
   - Created before any changes
   - Use this to rollback if needed

2. **`migration-export-{timestamp}.json`**
   - JSON export of all data
   - Audit trail
   - Human-readable

3. **`pos-v1-archived-{timestamp}.db`**
   - Original database after successful migration
   - Renamed from `pos.db`
   - Keep for 30 days, then delete

4. **`guanix.db`** (new)
   - Current system database
   - 37 tables created
   - Contains migrated data
   - Used by new POS app

---

## Data Verification Checklist

After migration, verify in new POS:

- [ ] Can login with existing staff credentials
- [ ] Sales reports show historical data
- [ ] Revenue totals match expectations
- [ ] Active orders (if any) are visible
- [ ] Staff list is complete
- [ ] Settings are preserved (restaurant name, etc.)

---

## Support

### Check Logs
- macOS: Console app → Filter "coorg-migration"
- Windows: Event Viewer
- Linux: Terminal output

### Files to Share with Support
1. `migration-export-{timestamp}.json` (data)
2. `pos-v1-backup-{timestamp}.db` (database)
3. Screenshots of error messages
4. Log files

### Contact
- Create issue: [GitHub Issues](https://github.com/anthropics/restaurant-pos-ai/issues)
- Email: support@guanix.com
- Include: Database backup, export JSON, screenshots

---

## FAQ

**Q: Can I run migration multiple times?**
A: Yes, but it will overwrite `guanix.db`. Use rollback feature if needed.

**Q: What happens to active orders?**
A: They're preserved in the `table_sessions` table and continue working in new POS.

**Q: Do staff need to re-login?**
A: No, PIN hashes are preserved. Existing credentials work.

**Q: Can I rollback the migration?**
A: Yes, use the backup files or the rollback command in the tool.

**Q: How long does migration take?**
A: 1-3 minutes for typical restaurant (100-1000 sales). Progress bar shows status.

**Q: Is the tool offline-capable?**
A: Yes, completely offline. No internet required.

**Q: What if migration fails halfway?**
A: Original `pos.db` is untouched. Backups exist. Safe to retry.

**Q: Can I delete old POS after migration?**
A: Yes, after verifying new POS works for 7-14 days.

**Q: What about cloud sync?**
A: New POS will sync to D1 cloud on first run. No action needed.

---

## Success Criteria

✅ Migration tool detected database
✅ Progress completed to 100%
✅ Validation passed (green checkmarks)
✅ Success screen shown
✅ `guanix.db` created
✅ New POS app opens without errors
✅ Staff can login
✅ Sales data visible in reports
✅ Active orders (if any) show correctly

---

**Status**: Ready for production use
**Version**: 1.0.0
**Tenant**: coorg-food-company-6163
**Schema**: 37 tables (complete)
