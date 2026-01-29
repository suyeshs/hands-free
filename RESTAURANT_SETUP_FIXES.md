# Restaurant Setup & Validation Fixes

## Issues Reported

1. **Restaurant setup showing as incomplete** on startup
2. **Phone number not being saved**
3. **Floor plan showing incomplete** despite having tables added
4. **Address not getting stored**
5. **Tax & billing not completing after setup**

## Root Causes Identified

### 1. RestaurantDetailsForm Using Deprecated Service

**File:** `src/components/settings/RestaurantDetailsForm.tsx`

**Problem:**
- Form was using `getTenantMetadata()` and `updateRestaurantDetails()` from `tenantProvisioning.ts`
- These functions are DEPRECATED (line 131-134 of tenantProvisioning.ts returns null)
- Old system used `restaurant_settings` key-value table
- New system uses `tenant_config` table via Tauri commands

**Impact:**
- Form couldn't load existing data (getTenantMetadata returns null)
- Form couldn't save data (updateRestaurantDetails uses deprecated table)
- **Phone number field was completely missing from the form**
- Address was not being saved to the correct location

### 2. Data Model Mismatch

**Old Structure (tenantProvisioning.ts):**
```typescript
{
  address: string,
  city: string,
  state: string,
  postalCode: string,
  // No phone field!
}
```

**New Structure (restaurantSettingsStore.ts):**
```typescript
{
  name: string,
  phone: string,  // ✓ Has phone
  address: {
    line1: string,
    line2: string,
    city: string,
    state: string,
    pincode: string,  // Note: pincode not postalCode
  }
}
```

### 3. Validation Hooks vs Actual Data Storage

**Validation Location:** `src/stores/setupWizardStore.ts`

**`useHasRestaurantBasics()` (lines 918-932):**
Requires:
- ✓ name (not default "Restaurant Name")
- ✓ phone (10 digits)
- ✓ address.line1
- ✓ address.city
- ✓ address.state
- ✓ address.pincode (6 digits)

**`useHasTaxBillingSetup()` (lines 935-957):**
Requires:
- ✓ Tax config: `taxEnabled !== undefined`
- ✓ Invoice config: `invoicePrefix` (min 2 chars), `currentInvoiceNumber`, `invoiceStartNumber`
- ⚠️ **GST number required if `taxEnabled === true`**

**Problem:** Default settings have:
- `taxEnabled: true`
- `gstNumber: ''` (empty!)

This causes validation to fail unless user enters GST number during setup.

**`useHasFloorPlan()` (lines 966-969):**
Requires:
- ✓ At least 1 section
- ✓ At least 2 tables

## Fixes Applied

### Fix 1: Update RestaurantDetailsForm to Use Correct Store

**Changed:**
- Import from `useRestaurantSettingsStore` instead of `tenantProvisioning`
- Use `settings` and `updateSettings()` from the store
- Match new data structure with nested `address` object

**Added Fields:**
1. Restaurant Name (required)
2. **Phone Number (required, 10 digits)** ← NEW
3. Address Line 1 (required)
4. Address Line 2 (optional) ← NEW
5. City (required)
6. State (required)
7. Pincode (required, 6 digits)
8. Website (optional)

**Removed Fields:**
- Country (not in new structure)
- Description (not in basic restaurant details)
- Google Place ID (internal, not user-facing)
- Cuisine (moved to separate config)

**Form Submission:**
```typescript
await updateSettings({
  name: formData.name,
  phone: formData.phone,
  address: formData.address,
  website: formData.website,
});
```

### Fix 2: Google Maps Extraction Updated

Updated to populate new data structure:
```typescript
setFormData({
  name: placeDetails.name || formData.name,
  phone: placeDetails.phone || formData.phone,
  address: {
    line1: placeDetails.address || '',
    line2: '',
    city: placeDetails.city || '',
    state: placeDetails.state || '',
    pincode: placeDetails.postalCode || '',
  },
  website: placeDetails.website || '',
});
```

## Remaining Issues to Investigate

### 1. Tax & Billing Validation

**Issue:** Validation fails if `taxEnabled: true` but `gstNumber` is empty.

**Possible Solutions:**
a) Make GST number optional (change validation)
b) Ensure setup wizard always sets GST number when tax is enabled
c) Default `taxEnabled` to `false` for new installs

**Recommendation:** Option (a) - Make GST number optional with a warning.

Many small restaurants don't have GST registration (threshold is ₹40 lakh turnover). They can still use GST calculations for accounting without having a GST number.

**Suggested Fix:**
```typescript
// In setupWizardStore.ts, line 954
const hasGSTIfRequired = settings.taxEnabled
  ? Boolean(settings.gstNumber?.trim()) || confirm('No GST number set. Continue anyway?')
  : true;
```

Or simpler:
```typescript
// Make GST number optional - just a warning, not blocking
const hasGSTIfRequired = true; // Remove requirement
```

### 2. Floor Plan Validation

**Current Logic:** Requires 1+ sections AND 2+ tables

**User Report:** "the floow plan has tables added"

**Need to Verify:**
1. Are tables being saved to SQLite correctly?
2. Are tables being loaded on app startup?
3. Is the validation running before data loads?

**Diagnostic Steps:**
1. Check console for floor plan load logs
2. Verify `floorPlanStore.sections.length` and `floorPlanStore.tables.length`
3. Check SQLite database directly: `SELECT * FROM floor_tables;`

## Testing Checklist

After these fixes, test the following flow:

### Fresh Setup Test
1. Clear all data: `rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos/`
2. Start app: `bun tauri dev`
3. Complete setup wizard:
   - Enter restaurant name ✓
   - Enter phone number (10 digits) ✓
   - Enter address ✓
   - Select tax mode (simple or GST) ✓
   - Enter GST number (if GST mode) ✓
   - Add menu items (3+) ✓
   - Add floor plan (1 section, 2+ tables) ✓
   - Add staff (2+) ✓
4. Navigate to Settings → Restaurant Details
5. Verify all fields populated correctly ✓
6. Edit and save - verify persistence ✓

### Validation Test
After setup completion, check:
```
useHasRestaurantBasics() === true
useHasTaxBillingSetup() === true
useHasMinimumMenu() === true
useHasFloorPlan() === true
useHasStaff() === true
```

## Files Modified

1. `src/components/settings/RestaurantDetailsForm.tsx`
   - Complete rewrite to use `restaurantSettingsStore`
   - Added phone number field
   - Fixed address structure
   - Removed deprecated service calls

## Next Steps

1. **Immediate:** Test the RestaurantDetailsForm fix
2. **High Priority:** Fix tax/billing validation (make GST optional)
3. **High Priority:** Investigate floor plan validation issue
4. **Medium Priority:** Add validation feedback in UI (show which fields are missing)
5. **Low Priority:** Migrate any old data from deprecated `tenant_metadata` to new structure

## Migration Considerations

**For existing users with data in old structure:**

Need a migration script to copy:
- `tenant_metadata.address` → `restaurant_settings.address.line1`
- `tenant_metadata.city` → `restaurant_settings.address.city`
- `tenant_metadata.state` → `restaurant_settings.address.state`
- `tenant_metadata.postalCode` → `restaurant_settings.address.pincode`
- `tenant_metadata.phone` → `restaurant_settings.phone`

**Location:** Create `src/services/settingsMigration.ts` with migration logic.
