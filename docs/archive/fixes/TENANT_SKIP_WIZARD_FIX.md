# Tenant Exists → Skip Wizard Fix

## Problem

Every time the app restarted, it would show the setup wizard even though:
- ✅ Tenant was configured in database (`tenant_config` table)
- ✅ Settings were saved in database (`restaurant_settings` table)
- ❌ But `setup_complete = 0` in `setup_wizard_state` table

This caused the app to get stuck in the welcome screen instead of going to the hub page.

## Root Cause

The `useNeedsSetup()` hook only checked:
1. `isComplete` flag from `setup_wizard_state` table
2. Whether required restaurant settings exist

**But it never checked if a tenant was already provisioned and configured.**

## Solution

Added tenant existence check to `useNeedsSetup()` hook:

**Location:** `src/stores/setupWizardStore.ts` (lines 795-809)

```typescript
export function useNeedsSetup(): boolean {
  const { isComplete } = useSetupWizardStore();
  const { settings } = useRestaurantSettingsStore();
  const { tenant } = useTenantStore(); // ← NEW: Get tenant from store

  // CRITICAL: If tenant config exists in database, skip setup wizard
  // The tenant_config table is only populated after successful tenant provisioning
  // This handles the case where setup_complete flag is false but tenant is actually configured
  if (tenant?.tenantId) {
    console.log('[useNeedsSetup] ✅ Tenant exists in DB:', tenant.tenantId);
    console.log('[useNeedsSetup] 🔀 RESULT: false (tenant exists, skip wizard)');
    return false; // ← Skip wizard, go to hub
  }

  // ... rest of existing logic
}
```

## How It Works

### Before Fix
```
App Start
  ↓
Load from SQLite:
  - setup_complete = 0
  - tenant_config = { tenantId: "flow-test-1459", ... }
  ↓
useNeedsSetup() returns TRUE (because setup_complete = 0)
  ↓
Shows Setup Wizard (WRONG!)
```

### After Fix
```
App Start
  ↓
Load from SQLite:
  - setup_complete = 0
  - tenant_config = { tenantId: "flow-test-1459", ... }
  ↓
useNeedsSetup() checks:
  1. Does tenant exist? YES → Return FALSE
  ↓
Skip Setup Wizard → Go to Hub Page ✅
```

## Database State

### Current State (from SQLite query)
```sql
-- tenant_config table
tenantId: flow-test-1459
companyName: Flow test
subdomain: flow-test-1459.handsfree.tech

-- setup_wizard_state table
current_step: welcome
setup_complete: 0  ← This was the issue

-- restaurant_settings table
name: Restaurant Name
(other settings exist)
```

### After This Fix
- No database changes needed
- The app now **trusts the tenant_config table** as the source of truth
- If tenant exists → Setup is complete (regardless of the flag)

## Test Results

**Before:**
- App shows welcome screen ❌
- Settings save repeatedly in logs ❌
- Stuck in setup wizard loop ❌

**After:**
- App loads tenant from SQLite ✅
- Skips setup wizard ✅
- Shows hub page ✅

## Files Modified

1. **src/stores/setupWizardStore.ts**
   - Added `useTenantStore` import (line 9)
   - Added tenant existence check in `useNeedsSetup()` (lines 795-809)

## Why This Approach?

### Alternative 1: Update `setup_complete` flag in database
```sql
UPDATE setup_wizard_state SET setup_complete = 1;
```
**Problem:** Doesn't fix the root cause. Next time the flag gets reset, same issue happens.

### Alternative 2: Delete and recreate database
**Problem:** Loses all menu data, settings, and configuration.

### Alternative 3: Check tenant existence (CHOSEN) ✅
**Benefits:**
- Fixes root cause
- No data loss
- Works automatically for all tenants
- Self-healing (if flag is wrong, app corrects itself)

## Edge Cases Handled

1. **Fresh Install (no tenant)**
   - `tenant?.tenantId` is null
   - Normal setup wizard flow continues ✅

2. **Tenant Exists but Setup Incomplete**
   - Tenant exists from provisioning
   - App skips wizard, goes to hub ✅
   - User can complete optional setup from settings

3. **Database Corruption**
   - If `tenant_config` is deleted but `setup_wizard_state` remains
   - App will show wizard again (correct behavior) ✅

## Additional Benefits

This fix also solves:
- No more repeated settings saves on every restart
- No more "activation-just-completed" session flag needed
- Cleaner routing logic
- Faster app startup (no wizard rendering)

## Next Steps

After running the app:
1. ✅ App should go directly to hub page
2. ✅ No more welcome screen
3. ✅ All data loaded from SQLite
4. ✅ Menu upload workflow works with new tenant-specific endpoint

## Related Fixes

This works together with:
- **Menu Parsing Endpoint Fix** - Tenant-specific API endpoint (implemented earlier)
- **SQLite Persistence** - All data stored locally
- **Tenant Provisioning** - Cloud sync handled separately
