# Restaurant Type Selector Enhancement

## Summary

Enhanced the Restaurant Type selector in the Settings page to make it more prominent and clearly show that it controls contextual settings visibility.

## Changes Made

### 1. Fixed Address Loading Bug ✅
**File:** `src/services/tauriSettings.ts`

**Issue:** Address fields (`line1`, `line2`) were not loading from database because Rust serializes with `camelCase` due to `#[serde(rename_all = "camelCase")]`, but TypeScript was expecting `snake_case`.

**Fix:** Updated all field mappings from snake_case to camelCase:
```typescript
// Before (❌ Wrong)
address: {
  line1: settings.address_line1,  // undefined!
  line2: settings.address_line2,  // undefined!
}

// After (✅ Correct)
address: {
  line1: settings.addressLine1,   // Works!
  line2: settings.addressLine2,   // Works!
}
```

Updated all 40+ field mappings to use camelCase consistently.

### 2. Enhanced Restaurant Type Selector UI ✅
**File:** `src/components/admin/RestaurantSettingsInline.tsx`

**Changes:**
- ✅ Added "Step 1" badge with clear heading "Choose Your Restaurant Type"
- ✅ Added help text explaining what this selector affects
- ✅ Made current selection more prominent with card styling
- ✅ Improved dropdown UI with better borders and highlighting
- ✅ Added "Step 2" badge to Essential Settings section
- ✅ Added info box explaining what changes when type is selected
- ✅ Auto-close dropdown after selection
- ✅ Mark as "unsaved changes" when type changes

### 3. Fixed Shallow Merge Bug in Store ✅
**File:** `src/stores/restaurantSettingsStore.ts`

**Issue:** Shallow merge was replacing entire nested objects instead of merging them.

**Fix:**
```typescript
// Before (❌ Bug)
const updatedSettings = { ...currentSettings, ...newSettings };

// After (✅ Fixed)
const updatedSettings = {
  ...currentSettings,
  ...newSettings,
  address: newSettings.address
    ? { ...currentSettings.address, ...newSettings.address }
    : currentSettings.address,
  // ... same for other nested objects
};
```

## Wiring Verification

The Restaurant Type selector IS properly wired to contextual settings:

### Flow:
1. **User selects type** → Dropdown shows all available types
2. **handleTypeChange()** → Updates `formData.restaurantType` and applies feature preset
3. **Component re-renders** → Tabs and fields recalculate based on new type
4. **Tab filtering** → `visibleEssentialTabs` and `visibleAdvancedTabs` filter out hidden tabs
5. **Field filtering** → Each field checks `getSettingCriticality(restaurantType, 'fields', fieldName)`

### Example:
- **Full Service Restaurant**: Shows all settings tabs
- **Dark Kitchen**: Hides table service settings, shows delivery/aggregator settings
- **Bar & Lounge**: Shows alcohol inventory, hides food-specific settings
- **Food Truck**: Simplified settings, mobile-focused

### Visual Indicators:
- ✅ Tab count shows in section headers: "Essential Settings (3 tabs)"
- ✅ Criticality badges (Required/Recommended) adjust per type
- ✅ Info box explains what changes
- ✅ Console logs show type change and feature updates

## Testing

### Test Address Loading:
1. Open Settings page
2. Check that address fields are populated (they were saved in DB)
3. Expected: All address fields show correctly ✅

### Test Restaurant Type Selector:
1. Open Settings page
2. See "Step 1: Choose Your Restaurant Type" section at top
3. Click "Change Type" button
4. Select different type (e.g., "Dark Kitchen")
5. Expected outcomes:
   - ✅ Current type updates immediately
   - ✅ Info box shows what's affected
   - ✅ Tab visibility changes (some tabs may hide/show)
   - ✅ "Unsaved changes" indicator appears
   - ✅ Console shows: `[RestaurantSettings] Restaurant type changed to: Dark Kitchen`

### Test Contextual Settings:
1. Select "Full Service Restaurant"
   - Expected: All tabs visible
2. Select "Dark Kitchen"
   - Expected: Table service settings less prominent, delivery/aggregator more prominent
3. Select "Bar & Lounge"
   - Expected: Bar management emphasized
4. Save settings
5. Reload page
6. Verify type persists and settings remain contextual

## Files Modified

1. **src/services/tauriSettings.ts** - Fixed camelCase mapping for address and all fields
2. **src/stores/restaurantSettingsStore.ts** - Fixed shallow merge bug, added diagnostic logging
3. **src/components/admin/RestaurantSettingsInline.tsx** - Enhanced UI for type selector

## Before & After

### Before:
- Restaurant type selector was subtle, easily missed
- Not clear that it affected which settings were shown
- Address fields not loading from database

### After:
- ✅ Prominent "Step 1" section with clear heading
- ✅ Info box explains what selector controls
- ✅ Visual feedback when type changes
- ✅ Address fields load correctly
- ✅ Tab counts show in section headers
- ✅ Step numbers guide users through setup

## Remaining Items

None - all requirements met:
- ✅ Address save/load fixed
- ✅ Restaurant type selector enhanced and prominently displayed
- ✅ Clear indication that type affects contextual settings
- ✅ Proper wiring verified
- ✅ Visual feedback added
