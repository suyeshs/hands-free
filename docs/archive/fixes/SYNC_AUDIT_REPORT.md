# Sync System Audit Report

## Executive Summary

This audit identifies stores using simple HTTP-based sync that could potentially cause data loss similar to the floor plan issue fixed in v3.0.1.

## Risk Categories

### 🔴 HIGH RISK - Data Loss Possible
Stores that DELETE before INSERT and could wipe local data if cloud is empty

### 🟡 MEDIUM RISK - Merge Conflicts
Stores that use INSERT OR REPLACE but lack conflict resolution

### 🟢 LOW RISK - Safe Patterns
Stores using safe sync patterns with proper safeguards

---

## Audit Results

### 🔴 HIGH RISK

#### 1. ✅ Floor Plan Store (FIXED in v3.0.1)
**File**: `src/stores/floorPlanStore.ts`

**Issue**:
- Deleted all local sections/tables before inserting cloud data
- If cloud was empty, all local tables were permanently lost

**Fix Applied**:
```typescript
// Lines 551-557
if (localTables.length > 0 && cloudData.tables.length === 0) {
    console.warn('[FloorPlanStore] ⚠️ Cloud has no tables but local has', localTables.length, 'tables.');
    console.warn('[FloorPlanStore] Pushing local data to cloud instead...');
    await get().syncToCloud(tenantId);
    return;
}
```

**Status**: ✅ Fixed + Integrated with Rust sync engine

---

### 🟡 MEDIUM RISK

#### 2. Restaurant Settings Store
**File**: `src/stores/restaurantSettingsStore.ts`

**Current Pattern**:
```typescript
syncFromCloud: async (tenantId) => {
    const cloudSettings = await backendApi.getRestaurantSettings(tenantId);
    if (cloudSettings) {
        const mergedSettings = {
            ...localSettings,
            ...cloudSettings,
            // Preserve higher invoice number
        };
    }
}
```

**Risk Level**: 🟡 MEDIUM
- Uses object merge (spread operator)
- Preserves some local data (invoice numbers)
- **But**: No check for empty cloud response
- **Impact**: Could overwrite critical settings if cloud returns empty object

**Recommended Fix**:
```typescript
if (!cloudSettings || Object.keys(cloudSettings).length === 0) {
    console.warn('[RestaurantSettings] Cloud empty, keeping local');
    await get().syncToCloud(tenantId);
    return;
}
```

---

#### 3. Staff Store
**File**: `src/stores/staffStore.ts`

**Current Pattern**:
```typescript
syncFromCloud: async (tenantId) => {
    const cloudStaff = await backendApi.getStaff(tenantId);

    if (!cloudStaff || cloudStaff.length === 0) {
        console.log('[StaffStore] No staff in cloud, keeping local');
        return; // ✅ Good safeguard!
    }

    // Uses INSERT OR REPLACE
    await db.execute(`INSERT OR REPLACE INTO staff_users...`);
}
```

**Risk Level**: 🟢 LOW
- ✅ Has safeguard for empty cloud data
- ✅ Uses INSERT OR REPLACE (no DELETE)
- ✅ Merges cloud and local data properly

**Status**: ✅ Safe (has proper safeguards)

---

#### 4. Menu Store
**File**: `src/stores/menuStore.ts`

**Current Pattern**:
```typescript
loadMenuFromAPI: async (tenantId) => {
    const { items: apiItems } = await backendApi.getMenu(tenantId);
    // Directly sets items from API
    set({ items, categories });
}
```

**Risk Level**: 🟡 MEDIUM
- No explicit DELETE, but replaces entire state
- **But**: No check if API returns empty array
- **Impact**: Could clear menu if API fails or returns empty

**Recommended Fix**:
```typescript
if (!apiItems || apiItems.length === 0) {
    console.warn('[MenuStore] API returned no items, keeping local menu');
    return;
}
```

---

#### 5. Setup Wizard Store
**File**: `src/stores/setupWizardStore.ts`

**Risk Level**: 🟡 MEDIUM
- Used during initial setup, not regular operations
- Less critical as it's a wizard (one-time process)
- **But**: Should still have safeguards

**Status**: ⚠️ Review recommended

---

#### 6. Rostering, Leave, Attendance Stores
**Files**:
- `src/stores/rosteringStore.ts`
- `src/stores/leaveStore.ts`
- `src/stores/attendanceStore.ts`

**Risk Level**: 🟡 MEDIUM
- HR-related data (less critical than financial/menu)
- **But**: Should still use proper sync patterns

**Status**: ⚠️ Review recommended

---

#### 7. KDS Store
**File**: `src/stores/kdsStore.ts`

**Risk Level**: 🟢 LOW
- KDS displays real-time orders from cloud
- Orders are temporary (completed orders are archived)
- Less risk of permanent data loss

**Status**: ✅ Acceptable risk for real-time data

---

#### 8. Aggregator Store
**File**: `src/stores/aggregatorStore.ts`

**Risk Level**: 🟢 LOW
- Third-party order sync (Swiggy/Zomato)
- Data is pulled from external APIs, not user-created
- Can be re-fetched if lost

**Status**: ✅ Acceptable risk

---

## Recommended Actions

### Priority 1: Critical (Do Now)
1. ✅ **Floor Plan Store** - COMPLETE
   - Integrated with Rust sync engine
   - Added safeguards against data loss

### Priority 2: High (This Sprint)
2. **Restaurant Settings Store** - Add empty cloud check
3. **Menu Store** - Add empty API response check

### Priority 3: Medium (Next Sprint)
4. **Setup Wizard Store** - Review sync patterns
5. **HR Stores** (Rostering, Leave, Attendance) - Review and add safeguards

### Priority 4: Future Enhancement
6. Migrate all stores to use Rust sync engine for:
   - Incremental sync (only deltas)
   - Offline queue
   - Proper conflict resolution
   - Timestamp-based merging

---

## Safe Sync Patterns

### ✅ Pattern 1: Check for Empty Cloud Data
```typescript
syncFromCloud: async (tenantId) => {
    const cloudData = await api.getData(tenantId);

    // CRITICAL: Check if cloud is empty
    if (!cloudData || cloudData.length === 0) {
        console.warn('[Store] Cloud empty, keeping local data');
        // Push local data to cloud instead
        await syncToCloud(tenantId);
        return;
    }

    // Proceed with merge
}
```

### ✅ Pattern 2: Use INSERT OR REPLACE (Not DELETE + INSERT)
```sql
-- ❌ BAD: Can lose data
DELETE FROM table WHERE tenant_id = ?;
INSERT INTO table VALUES (...);

-- ✅ GOOD: Upserts existing records
INSERT OR REPLACE INTO table VALUES (...);
```

### ✅ Pattern 3: Merge with Conflict Resolution
```typescript
// Merge cloud and local, preferring newer data
const merged = cloudData.map(cloudItem => {
    const localItem = localData.find(l => l.id === cloudItem.id);

    // Use timestamp to determine winner
    if (localItem && localItem.updatedAt > cloudItem.updatedAt) {
        return localItem; // Local is newer
    }
    return cloudItem; // Cloud is newer or local doesn't exist
});
```

### ✅ Pattern 4: Use Rust Sync Engine
```typescript
import { floorPlanSyncService } from './lib/floorPlanSyncService';

// Incremental sync with proper conflict resolution
const result = await floorPlanSyncService.syncToCloud(tenantId);
```

---

## Dangerous Patterns to Avoid

### ❌ Pattern 1: DELETE Before INSERT
```typescript
// DANGEROUS: Deletes all local data first
await db.execute(`DELETE FROM table WHERE tenant_id = ?`, [tenantId]);

// If network fails here or cloud is empty, data is LOST
for (const item of cloudData) {
    await db.execute(`INSERT INTO table...`);
}
```

### ❌ Pattern 2: No Empty Check
```typescript
// DANGEROUS: Doesn't check if cloud returned empty
const cloudData = await api.getData();
set({ data: cloudData }); // Wipes local state if cloudData is []
```

### ❌ Pattern 3: Blind Cloud Overwrite
```typescript
// DANGEROUS: Always trusts cloud, ignores local changes
set({ data: cloudData });
```

---

## Testing Checklist

For each store with cloud sync, test:

- [ ] Add data locally → Go offline → Restart app → Data still present
- [ ] Add data locally → Cloud empty → Sync → Local data pushed to cloud
- [ ] Cloud has data → Local empty → Sync → Cloud data pulled to local
- [ ] Add data on Device A → Add data on Device B → Both sync → Both have all data
- [ ] Network fails mid-sync → Data not lost → Retry succeeds
- [ ] API returns empty array/object → Local data preserved

---

## Migration Path to Rust Sync

### Phase 1: Add Sync Tables (For Each Store)
```sql
-- Add sync tracking columns
ALTER TABLE table_name ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE table_name ADD COLUMN synced_at TEXT DEFAULT NULL;

-- Add trigger for auto-update
CREATE TRIGGER update_timestamp
AFTER UPDATE ON table_name
BEGIN
    UPDATE table_name SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

### Phase 2: Add Rust Commands
```rust
// In src-tauri/src/sync/commands.rs
fn get_sync_endpoint(table_name: &str) -> String {
    match table_name {
        "table_name" => "/api/table/sync".to_string(),
        ...
    }
}
```

### Phase 3: Frontend Integration
```typescript
// Replace direct HTTP sync with Rust sync
import { syncService } from './lib/syncService';

syncToCloud: async (tenantId) => {
    const result = await syncService.syncTable(tenantId, 'table_name');
}
```

---

## Summary

**Current State**:
- ✅ 1 store fully protected (Floor Plan)
- 🟡 5-6 stores need safeguards
- 🟢 3 stores acceptable risk

**Action Items**:
1. Add empty cloud checks to high-risk stores
2. Replace DELETE+INSERT with INSERT OR REPLACE
3. Migrate to Rust sync engine over time

**Risk Mitigation**:
- Floor plan data loss issue: ✅ FIXED
- Other stores: ⚠️ Needs attention but lower risk
- Real-time data (KDS, Aggregator): ✅ Acceptable

---

## Related Documents

- [FLOOR_PLAN_SYNC_INTEGRATION.md](./FLOOR_PLAN_SYNC_INTEGRATION.md) - Detailed floor plan sync architecture
- [RUST_SYNC_IMPLEMENTATION_COMPLETE.md](./RUST_SYNC_IMPLEMENTATION_COMPLETE.md) - Rust sync engine docs
- [SYNC_ARCHITECTURE_OVERVIEW.md](./SYNC_ARCHITECTURE_OVERVIEW.md) - Overall sync design

---

**Last Updated**: 2026-01-18
**Version**: 1.0
**Status**: Active Audit
