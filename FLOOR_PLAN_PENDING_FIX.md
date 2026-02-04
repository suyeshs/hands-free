# Floor Plan Status "Pending" on Reload - FIXED

## Problem

Even though the floor plan was active/completed, it showed as "pending" on app reload.

## Root Cause

**Two separate stores tracking the same state without synchronization:**

1. **`setupWizardStore`** (SQLite-backed)
   - Tracks floor plan in `completedScreens` Set
   - Loads from SQLite on app start
   - Location: `src/stores/setupWizardStore.ts`

2. **`provisioningStore`** (localStorage-backed)
   - Tracks floor plan in `optionalConfigCompleted.floor_plan`
   - Uses Zustand persist middleware
   - Location: `src/stores/provisioningStore.ts`

**The Issue:**
- When floor plan is completed, it's saved to `setupWizardStore` (SQLite)
- But `provisioningStore` is not updated
- On app reload, both stores load independently
- `provisioningStore.optionalConfigCompleted.floor_plan` remains `false`
- UI uses `provisioningStore.getStepStatus('floor_plan')` → returns `'pending'`

## Solution

### 1. Created Store Synchronization Utility ✅

**File**: `src/lib/storeSynchronization.ts`

```typescript
export async function syncStoresBidirectional(): Promise<void> {
  // Sync wizard state to provisioning
  if (setupWizard.completedScreens.has('floor_plan')) {
    provisioning.markOptionalComplete('floor_plan');
  }

  // Also sync other optional items (staff, printer, etc.)
  // Bidirectional to handle both directions
}
```

**Features:**
- Syncs `floor_plan` completion status
- Syncs `staff` completion status
- Syncs `printer_settings` completion status
- Bidirectional - handles both stores as source of truth
- Logging for debugging

### 2. Integrated with App Initialization ✅

**File**: `src/App.tsx` (line 384-391)

```typescript
// After loading both stores from persistence
await useSetupWizardStore.getState().loadFromSQLite();
await useRestaurantSettingsStore.getState().loadFromSQLite();

// NEW: Sync stores to fix "pending" status
const { syncStoresBidirectional } = await import('./lib/storeSynchronization');
await syncStoresBidirectional();
```

**Execution Order:**
1. Load wizard state from SQLite ✅
2. Load tenant config from SQLite ✅
3. Load restaurant settings from SQLite ✅
4. **Sync stores bidirectionally** ✅ (NEW)
5. Load device settings ✅
6. Mark as loaded ✅

## How It Works

### Before Fix ❌

```
App Startup
├─ setupWizardStore loads from SQLite
│  └─ completedScreens: Set(['floor_plan', ...])
│
├─ provisioningStore loads from localStorage
│  └─ optionalConfigCompleted: { floor_plan: false }
│
└─ UI checks getStepStatus('floor_plan')
   └─ Returns 'pending' (because optionalConfigCompleted.floor_plan === false)
```

### After Fix ✅

```
App Startup
├─ setupWizardStore loads from SQLite
│  └─ completedScreens: Set(['floor_plan', ...])
│
├─ provisioningStore loads from localStorage
│  └─ optionalConfigCompleted: { floor_plan: false }
│
├─ syncStoresBidirectional() runs
│  ├─ Checks: setupWizard has 'floor_plan' completed?
│  │  └─ YES! completedScreens.has('floor_plan') === true
│  ├─ Checks: provisioning has floor_plan completed?
│  │  └─ NO! optionalConfigCompleted.floor_plan === false
│  └─ Syncs: provisioning.markOptionalComplete('floor_plan')
│     └─ optionalConfigCompleted: { floor_plan: true } ✅
│
└─ UI checks getStepStatus('floor_plan')
   └─ Returns 'complete' ✅
```

## Testing

### Verify the Fix

1. **Complete floor plan setup**
   - Go through setup wizard
   - Complete floor plan (demo data or manual)
   - Check it shows as "complete"

2. **Reload the app**
   - Refresh the browser or restart the Tauri app
   - Check console logs:
   ```
   [App] 🔄 Syncing setup wizard and provisioning stores...
   [StoreSync] Starting bidirectional store sync...
   [StoreSync] Floor plan completed in wizard but pending in provisioning - syncing
   [StoreSync] Bidirectional sync complete
   [App] ✅ Store synchronization complete
   ```

3. **Verify status**
   - Floor plan should show as "complete" (not "pending")
   - No status mismatch after reload

### Check Synchronization

```typescript
// In browser console or diagnostics:
const setupWizard = useSetupWizardStore.getState();
const provisioning = useProvisioningStore.getState();

console.log('Setup Wizard - Floor Plan:', setupWizard.completedScreens.has('floor_plan'));
console.log('Provisioning - Floor Plan:', provisioning.optionalConfigCompleted.floor_plan);

// Both should be true if floor plan is completed
```

## Benefits

1. **No More "Pending" on Reload** - Status persists correctly
2. **Automatic Sync** - No manual intervention needed
3. **Bidirectional** - Handles both stores as source of truth
4. **Extensible** - Easy to add more optional items
5. **Logged** - Console logs show what's being synced

## Future Improvements

### Option A: Consolidate Stores
Eliminate duplication by using a single source of truth:
- Keep only `setupWizardStore` (SQLite-backed)
- Remove `provisioningStore.optionalConfigCompleted`
- Update UI to read from `setupWizardStore`

### Option B: Auto-sync on Completion
When floor plan is marked complete, immediately update both stores:
```typescript
// In FloorPlanSetupScreen or wherever completion happens
await setupWizard.markScreenComplete('floor_plan');
provisioning.markOptionalComplete('floor_plan'); // Add this
```

### Option C: Shared State Manager
Create a single state manager that updates both stores atomically:
```typescript
// New abstraction
const setupStateManager = {
  async markOptionalComplete(item: OptionalItem) {
    await setupWizard.markScreenComplete(item);
    provisioning.markOptionalComplete(item);
  }
};
```

## Related Issues

This fix also resolves similar issues for:
- ✅ Staff setup showing as "pending" after reload
- ✅ Printer setup showing as "pending" after reload
- ✅ Any optional item showing wrong status after reload

## Files Modified

1. **Created**: `src/lib/storeSynchronization.ts`
   - Store sync utility with bidirectional sync

2. **Modified**: `src/App.tsx`
   - Added sync call after store initialization

## Verification Checklist

- [x] Created synchronization utility
- [x] Integrated with app initialization
- [x] Handles floor_plan status
- [x] Handles staff status
- [x] Handles printer_settings status
- [x] Bidirectional sync (wizard → provisioning and vice versa)
- [x] Console logging for debugging
- [x] Documentation

## Summary

**Before**: Floor plan status was tracked in two separate stores that never synced, causing "pending" status on reload.

**After**: Stores sync automatically on app startup, ensuring status consistency across reloads.

**Impact**: Users will see the correct "complete" status for floor plan (and other optional items) after reloading the app.

🎉 **Status: FIXED**
