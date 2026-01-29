# Reinstall & Upgrade Guide

## How Reinstalls Are Handled

The HandsFree POS app is designed to handle reinstalls gracefully without data loss.

### Data Persistence Locations

#### 1. SQLite Database (`pos.db`)
**Location**: `%APPDATA%\com.coorgfood.tauri\pos.db` (Windows)

**Contains**:
- Menu items and categories
- Floor plan (tables, sections, assignments)
- Staff members and permissions
- Orders and order history
- Sales transactions
- Inventory data

**Persistence**: ✅ Survives reinstall (stored in AppData, not removed by uninstaller)

#### 2. LocalStorage (Zustand Persist)
**Location**: Browser localStorage in Tauri WebView

**Contains**:
- Restaurant settings (name, address, tax rates, etc.)
- Setup wizard completion flag
- Tenant activation status
- User preferences

**Persistence**: ✅ Survives reinstall (part of Tauri's persistent storage)

#### 3. Tauri Encrypted Storage
**Location**: OS-specific secure storage

**Contains**:
- Manager authentication session
- API tokens

**Persistence**: ✅ Survives reinstall

---

## Reinstall Scenarios

### Scenario 1: Update/Upgrade (In-Place)
**User Action**: Install new version over existing installation

**What Happens**:
1. ✅ All data persists (SQLite + localStorage)
2. ✅ Database migrations run automatically
3. ✅ Setup wizard is skipped (existing data detected)
4. ✅ User continues where they left off

**Expected Behavior**: Seamless update, no data loss

---

### Scenario 2: Reinstall (Uninstall → Reinstall)
**User Action**: Uninstall app, then reinstall

#### If User Keeps App Data (Default)
**What Happens**:
1. ✅ SQLite database preserved in AppData
2. ✅ LocalStorage preserved
3. ✅ Setup wizard is skipped (legacy migration detects existing data)
4. ✅ User sees all their data

**Expected Behavior**: Same as upgrade, data persists

#### If User Deletes App Data
**What Happens**:
1. ❌ Local SQLite database deleted
2. ❌ LocalStorage cleared
3. ⚠️ Setup wizard runs (no local data detected)
4. ✅ If tenant has cloud data, it syncs down
5. ⚠️ If no cloud data, starts fresh

**Expected Behavior**: Fresh start or cloud restore

---

### Scenario 3: Fresh Install on New Device
**User Action**: Install on a device that never had the app

**What Happens**:
1. ❌ No local data
2. ✅ Setup wizard runs
3. ✅ User enters tenant credentials
4. ✅ Cloud data syncs down (if available)

**Expected Behavior**: Guided setup with cloud restore

---

## Setup Wizard Detection Logic

The app uses smart detection to skip setup when appropriate:

```typescript
// From: src/stores/setupWizardStore.ts:631-661

useNeedsSetup() {
  // 1. Check if wizard completion flag is set
  if (isComplete) return false;

  // 2. Check if minimum required data exists (legacy migration)
  const hasRequiredData =
    settings.name?.trim() &&
    settings.address?.line1?.trim() &&
    settings.phone?.trim() &&
    settings.taxEnabled !== undefined;

  // 3. Auto-mark complete for existing setups
  if (hasRequiredData && !isComplete) {
    console.log('[SetupWizard] Legacy setup detected, marking as complete');
    useSetupWizardStore.getState().completeSetup();
    return false;  // Skip setup wizard
  }

  // 4. Only show setup if no data exists
  return !hasRequiredData;
}
```

**Key Points**:
- ✅ If `isComplete` flag exists → Skip setup
- ✅ If restaurant settings exist → Skip setup + auto-mark complete
- ❌ Only shows setup if truly needed

---

## Data Sync Safeguards (v3.0+)

### Protection Against Data Loss

As of v3.0.1, the app includes safeguards to prevent cloud sync from wiping local data:

#### Floor Plan Store
```typescript
if (localTables.length > 0 && cloudData.tables.length === 0) {
    // Cloud is empty but we have local tables
    // Push local data to cloud instead of wiping it
    await syncToCloud(tenantId);
    return;
}
```

#### Restaurant Settings Store (v3.1)
```typescript
if (!hasCloudData) {
    const hasLocalData = /* check local settings */;
    if (hasLocalData) {
        // Push local settings to cloud
        await syncToCloud(tenantId);
    }
    return; // Don't wipe local data
}
```

#### Menu Store (v3.1)
```typescript
if (!apiItems || apiItems.length === 0) {
    if (currentItems.length > 0) {
        // Keep local menu if API returns nothing
        return;
    }
}
```

**Result**: Even if cloud has no data, local data is preserved and pushed to cloud.

---

## What Users Should Know

### For Restaurant Owners/Managers

**Updating the App (Recommended Method)**:
1. Download latest version from GitHub releases
2. Run installer
3. Select "Update" (default)
4. ✅ All data preserved automatically

**If App Stops Working**:
1. Uninstall app
2. Reinstall latest version
3. ✅ Data should still be there (unless AppData was manually deleted)
4. If data missing → Check cloud backup (contact support)

### For IT/Support Staff

**Troubleshooting Data Issues**:

1. **Check if setup wizard appears**:
   - If yes → Local data missing, cloud restore will happen
   - If no → Local data exists, working normally

2. **Verify data locations**:
   ```
   Windows:
   - Database: %APPDATA%\com.coorgfood.tauri\pos.db
   - LocalStorage: %APPDATA%\com.coorgfood.tauri\Local Storage
   ```

3. **Force cloud restore**:
   - Delete local `pos.db` file
   - Restart app
   - App will sync from cloud

4. **Manual data recovery**:
   - Check `pos.db` backup (created on each migration)
   - Located in same directory as `pos.db`
   - Named: `pos.db.backup.YYYY-MM-DD-HH-MM-SS`

---

## Database Migrations

### Automatic Migration on Startup

```typescript
// From: src/App.tsx:143-156

useEffect(() => {
  const runMigrations = async () => {
    console.log('[App] Running database migrations...');
    const result = await runPendingMigrations();
    if (result.success) {
      console.log('[App] ✅ Migrations completed');
    }
  };
  runMigrations();
}, []);
```

**Migration Process**:
1. ✅ Runs automatically on app start
2. ✅ Creates backup before migration (`pos.db.backup.*`)
3. ✅ Applies only pending migrations (tracked in `migrations` table)
4. ✅ Idempotent (safe to run multiple times)

**Migration Files**: `src-tauri/migrations/*.sql`

---

## Testing Reinstall Behavior

### Test Checklist

**Before Releasing New Version**:

1. **Update Test** (Most Common)
   - [ ] Install version N
   - [ ] Add test data (menu items, tables, settings)
   - [ ] Install version N+1 over it
   - [ ] Verify all data present
   - [ ] Verify setup wizard not shown

2. **Reinstall Test** (With Data Preservation)
   - [ ] Install version N
   - [ ] Add test data
   - [ ] Uninstall (keep app data)
   - [ ] Reinstall version N
   - [ ] Verify all data present
   - [ ] Verify setup wizard not shown

3. **Fresh Install Test**
   - [ ] Install on clean machine
   - [ ] Verify setup wizard appears
   - [ ] Complete setup
   - [ ] Verify data persists after restart

4. **Cloud Restore Test**
   - [ ] Install on machine A, add data, sync to cloud
   - [ ] Install on machine B
   - [ ] Verify cloud data syncs down

5. **Data Loss Prevention Test**
   - [ ] Have local data but cloud is empty
   - [ ] Trigger sync
   - [ ] Verify local data is NOT wiped
   - [ ] Verify local data is pushed to cloud

---

## Known Issues & Workarounds

### Issue: Setup Wizard Appears After Reinstall

**Cause**: `setup-wizard` localStorage entry was cleared

**Solution**: App detects existing restaurant settings and auto-marks setup complete

**Status**: ✅ Fixed in v3.0+ (legacy migration path)

### Issue: Tables/Menu Missing After Update

**Cause**: Cloud sync wiped local data when cloud was empty

**Solution**: Safeguards added in v3.0.1

**Status**: ✅ Fixed in v3.0.1

### Issue: Manager Session Lost After Reinstall

**Cause**: Tauri secure storage cleared

**Solution**: User re-logs in, session is restored

**Status**: Expected behavior (security measure)

---

## For Developers

### Adding New Persistent Data

When adding new data that should survive reinstalls:

1. **Use SQLite for transactional data**:
   ```typescript
   const db = await Database.load('sqlite:pos.db');
   // Data automatically persists in AppData
   ```

2. **Use Zustand Persist for settings**:
   ```typescript
   create(persist((set) => ({...}), { name: 'my-store' }));
   // Data stored in localStorage (persists)
   ```

3. **Add Cloud Sync with Safeguards**:
   ```typescript
   syncFromCloud: async () => {
     const cloudData = await api.getData();

     // SAFEGUARD: Check if cloud is empty
     if (!cloudData || cloudData.length === 0) {
       if (localData.length > 0) {
         await syncToCloud(); // Push local to cloud
       }
       return; // Don't wipe local
     }

     // Proceed with merge
   }
   ```

4. **Add Database Migration**:
   - Create `src-tauri/migrations/NNN_description.sql`
   - Migration runs automatically on app start

---

## Support Resources

**For Users**:
- GitHub Issues: https://github.com/suyeshs/handsfree-restaurant-pos/issues
- Documentation: See README.md

**For Developers**:
- Sync Architecture: See SYNC_ARCHITECTURE_OVERVIEW.md
- Floor Plan Sync: See FLOOR_PLAN_SYNC_INTEGRATION.md
- Sync Audit: See SYNC_AUDIT_REPORT.md
- Fix Summary: See SYNC_FIX_SUMMARY.md

---

**Last Updated**: 2026-01-18
**Version**: v3.1
**Status**: Reinstalls Handled Correctly ✅
