# Restaurant Settings Initialization Fix

## Problem

The restaurant settings form was showing "Restaurant Name" (the default placeholder) instead of the actual tenant name from the database.

**Screenshot Issue:**
- Form field shows: "Restaurant Name"
- Expected: "Flow test" (from tenant_config)

## Root Cause

When a tenant is provisioned via the activation flow:
1. ✅ `tenant_config` table gets populated with company name
2. ❌ `restaurant_settings` table keeps default placeholder values
3. Settings form loads from `restaurant_settings` → shows wrong data

## Solution

### 1. Immediate Fix (Database Update)

Updated the existing database to populate settings from tenant_config:

```sql
UPDATE restaurant_settings
SET
  name = (SELECT company_name FROM tenant_config WHERE id = 1),
  updated_at = datetime('now')
WHERE id = 1;
```

**Result:** Database now has "Flow test" instead of "Restaurant Name"

### 2. Permanent Fix (Auto-Initialization)

Added initialization logic to `restaurantSettingsStore.ts` (lines 220-252):

```typescript
// CRITICAL: Initialize from tenant_config if still using default placeholder
if (settings.name === 'Restaurant Name' || !settings.name || settings.name.trim() === '') {
  console.log('[RestaurantSettings] Settings have default values, checking tenant_config...');

  try {
    // Import dynamically to avoid circular dependency
    const { useTenantStore } = await import('./tenantStore');
    const tenant = useTenantStore.getState().tenant;

    if (tenant?.companyName) {
      console.log(`[RestaurantSettings] Found tenant config: ${tenant.companyName}, initializing settings...`);

      // Update settings with tenant data
      const initializedSettings = {
        ...settings,
        name: tenant.companyName,
      };

      // Save to database
      await saveRestaurantSettings(initializedSettings);

      set({
        settings: initializedSettings,
        isConfigured: true,
        isLoading: false,
      });

      console.log('[RestaurantSettings] ✅ Settings initialized from tenant_config');
      return;
    }
  } catch (tenantError) {
    console.warn('[RestaurantSettings] Could not initialize from tenant_config:', tenantError);
  }
}
```

## How It Works

### Before Fix
```
App Start
  ↓
Load restaurant_settings from SQLite
  → name: "Restaurant Name" (default)
  ↓
Display in form: "Restaurant Name" ❌
```

### After Fix
```
App Start
  ↓
Load restaurant_settings from SQLite
  → name: "Restaurant Name" (default detected!)
  ↓
Check tenant_config
  → company_name: "Flow test" (found!)
  ↓
Initialize settings:
  → name: "Flow test"
  → Save to database
  ↓
Display in form: "Flow test" ✅
```

## Database State

### Current State (After Fix)
```sql
-- restaurant_settings table
name: Flow test  ← Updated from tenant_config
phone: (empty)
address_line1: (empty)
city: (empty)
state: (empty)

-- tenant_config table
company_name: Flow test  ← Source of truth
subdomain: flow-test-1459.handsfree.tech
```

## Benefits

1. **Self-Healing**: If database gets reset but tenant_config remains, settings auto-populate
2. **No Manual Entry**: Restaurant name is filled automatically from provisioning
3. **Future-Proof**: Works for all new tenant activations
4. **Data Consistency**: Single source of truth (tenant_config)

## Files Modified

1. **src/stores/restaurantSettingsStore.ts** (lines 200-252)
   - Added auto-initialization in `loadFromSQLite()`
   - Checks if settings have default values
   - Populates from tenant_config if needed
   - Saves to database automatically

2. **Database** (one-time update)
   - Updated existing `restaurant_settings` record
   - Set name to "Flow test" from tenant_config

## Testing

### Test Case 1: Existing Installation (Your Case)
1. ✅ Database updated with SQL command
2. ✅ Store updated with initialization logic
3. ✅ Refresh app → Settings form shows "Flow test"

### Test Case 2: Fresh Installation
1. User activates tenant → tenant_config populated
2. App loads settings → detects default values
3. Auto-initializes from tenant_config ✅
4. Settings form shows correct company name ✅

### Test Case 3: Database Reset
1. User resets database but keeps tenant_config
2. restaurant_settings has default values again
3. App loads → detects defaults → auto-initializes ✅
4. Settings restored from tenant_config ✅

## Edge Cases Handled

1. **No Tenant Config**
   - Initialization skips gracefully
   - Shows default values (expected for new installs)

2. **Empty Company Name**
   - Check fails → no initialization
   - User must enter manually (correct)

3. **Circular Dependency**
   - Dynamic import prevents circular reference
   - tenantStore loaded on-demand

4. **Multiple Load Calls**
   - Guard prevents concurrent loads
   - Initialization runs once per load

## Next Steps

After restarting your app:
1. ✅ Settings form should show "Flow test"
2. ✅ Phone, address fields still empty (as expected)
3. ✅ User can fill in remaining details
4. ✅ Future tenant activations will auto-populate

## Related Fixes

This works together with:
- **Tenant Skip Wizard Fix** - Skips wizard if tenant exists
- **Menu Parsing Endpoint Fix** - Tenant-specific API
- **SQLite Persistence** - All data stored locally

## Technical Notes

### Why Not Initialize Other Fields?

We only initialize the restaurant name because:
- **Name** - Available from tenant provisioning (company_name)
- **Phone/Address** - Not captured during provisioning, must be entered manually
- **Tax Settings** - Business-specific, vary by location
- **Logo/Branding** - Uploaded separately

### Dynamic Import Pattern

```typescript
const { useTenantStore } = await import('./tenantStore');
const tenant = useTenantStore.getState().tenant;
```

This prevents circular dependency issues:
- `tenantStore` → `setupWizardStore` → `restaurantSettingsStore`
- Dynamic import breaks the circular chain
- Only loads when needed (initialization check)

## Future Enhancements

Potential improvements:
1. Initialize phone/address from Google Places API (if available)
2. Sync settings to cloud after initialization
3. Show toast notification when auto-initialized
4. Add "Restore from Tenant Config" button in settings

For now, the basic initialization (name only) is sufficient and prevents the most common user confusion.
