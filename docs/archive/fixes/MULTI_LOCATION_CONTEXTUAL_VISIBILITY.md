# Multi Location Contextual Visibility Implementation

## Summary

Made "Multi Location" (formerly "Chain Management") contextually visible only for multi-location restaurant types (Multi-Brand and Large Chain).

## Changes Made

### 1. Renamed "Chain Management" to "Multi Location" ✅
**Rationale:** "Multi Location" is clearer and more descriptive of what the feature does.

### 2. Made Multi Location Contextually Visible ✅
**File:** `src/pages-v2/SettingsApp.tsx`

**What Changed:**
- ✅ Added `useRestaurantSettingsStore` import
- ✅ Added `RestaurantType` import
- ✅ Modified `getSettingsCategories()` to accept `restaurantType` parameter
- ✅ Added conditional rendering logic: Multi Location only shows for `MULTI_BRAND` and `LARGE_CHAIN` types
- ✅ Updated function call to pass restaurant type
- ✅ Changed ID from `chain-management` to `multi-location`
- ✅ Changed label from "Chain Management" to "Multi Location"

**Code:**
```typescript
const getSettingsCategories = (tenantId: string, restaurantType: RestaurantType): SettingCategory[] => {
  // Determine if multi-location management should be visible
  const isMultiLocation = restaurantType === RestaurantType.MULTI_BRAND || restaurantType === RestaurantType.LARGE_CHAIN;

  return [
    {
      id: 'business',
      label: 'Business Setup',
      icon: Store,
      description: 'Restaurant details, ownership, and legal information',
      items: [
        {
          id: 'restaurant-details',
          label: 'Restaurant Details',
          // ...
        },
        // Multi Location Management - Only visible for MULTI_BRAND and LARGE_CHAIN
        ...(isMultiLocation ? [{
          id: 'multi-location',
          label: 'Multi Location',
          description: 'Manage multiple locations and franchises',
          icon: Building2,
          component: ChainManagementPage,
          searchTerms: ['chain', 'locations', 'franchise', 'multi-location', 'branches'],
        }] : []),
      ],
    },
    // ... other categories
  ];
};
```

### 3. Updated Route Path ✅
**File:** `src/App.tsx`

**Changed:**
- Old: `/chain-management`
- New: `/multi-location`

**Code:**
```typescript
{/* Protected Routes - Multi Location Management */}
<Route
  path="/multi-location"
  element={
    <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
      <AppLayout>
        // ...
      </AppLayout>
    </ProtectedRoute>
  }
/>
```

## How It Works

### Visibility Logic:
1. **User selects restaurant type** in Settings (Step 1)
2. **Settings page saves** restaurant type to SQLite
3. **SettingsApp loads** and reads restaurant type from store
4. **getSettingsCategories()** filters settings based on type:
   - `MULTI_BRAND` → Multi Location visible ✅
   - `LARGE_CHAIN` → Multi Location visible ✅
   - All other types → Multi Location hidden ❌

### Restaurant Type → Multi Location Visibility:

| Restaurant Type | Multi Location Visible? | Reason |
|----------------|------------------------|--------|
| Full Service Restaurant | ❌ No | Single location focused |
| Cafe & Bakery | ❌ No | Typically single location |
| Dark Kitchen (Cloud Kitchen) | ❌ No | Usually standalone |
| Bar & Lounge | ❌ No | Single venue |
| QSR (Quick Service) | ❌ No | Default single location |
| Food Truck | ❌ No | Mobile, single unit |
| **Multi-Brand** | **✅ Yes** | **Multiple concepts/locations** |
| **Large Chain** | **✅ Yes** | **Multiple franchise locations** |

## Testing

### Test Visibility:
1. Open Settings page
2. Select "Full Service Restaurant" type
3. Click "Back to Hub" → Navigate to Settings App
4. Expected: Multi Location option should NOT appear in sidebar ❌

5. Go back to Settings page
6. Select "Multi-Brand" or "Large Chain" type
7. Save settings
8. Click "Back to Hub" → Navigate to Settings App
9. Expected: Multi Location option should appear in "Business Setup" section ✅

### Test Functionality:
1. With Multi Location visible, click on "Multi Location"
2. Expected: ChainManagementPage loads correctly
3. Verify you can manage multiple locations/franchises

### Test Persistence:
1. Select "Large Chain" type
2. Save and reload page
3. Navigate to Settings App
4. Expected: Multi Location still visible (persisted)

## Breaking Changes

### URL Changes:
- Old URL: `/chain-management`
- New URL: `/multi-location`

**Migration:** No automatic redirect needed. Users who had bookmarks will need to update them, but this is acceptable as it's an admin feature.

### Setting ID Changes:
- Old ID: `chain-management`
- New ID: `multi-location`

**Impact:** URL query params like `?setting=chain-management` will not work. Will default to `restaurant-details`.

**Fix (if needed):** Can add backward compatibility:
```typescript
// In SettingsApp.tsx
const urlSetting = searchParams.get('setting');
const legacySetting = urlSetting === 'chain-management' ? 'multi-location' : urlSetting;
const [activeSetting, setActiveSetting] = useState<string>(
  legacySetting || 'restaurant-details'
);
```

## Files Modified

1. **src/pages-v2/SettingsApp.tsx**
   - Added imports for restaurant settings and types
   - Modified `getSettingsCategories()` to accept restaurant type
   - Added conditional visibility logic
   - Renamed from "Chain Management" to "Multi Location"
   - Changed ID from `chain-management` to `multi-location`

2. **src/App.tsx**
   - Updated route path from `/chain-management` to `/multi-location`
   - Updated comment to reflect new name

## Feature Behavior

### Before:
- ❌ "Chain Management" always visible in settings sidebar
- ❌ Visible even for single-location restaurants
- ❌ Cluttered UI for users who don't need it

### After:
- ✅ "Multi Location" only visible for MULTI_BRAND and LARGE_CHAIN types
- ✅ Clean, contextual UI
- ✅ Settings adapt to business needs
- ✅ Clear naming ("Multi Location" vs "Chain Management")

## Related Features

The following features work together with Multi Location:
- **Restaurant Type Selector** (Step 1 in Settings) - Controls visibility
- **Feature Presets** - Multi Location feature enabled for MULTI_BRAND and LARGE_CHAIN
- **Operational Scale** - Works with `multi-location` scale setting

## Future Enhancements (Optional)

1. **Add Visual Indicator** when Multi Location becomes available:
   - Show toast notification when changing type to MULTI_BRAND/LARGE_CHAIN
   - "Multi Location management is now available!"

2. **Add Onboarding Flow** for multi-location setup:
   - Guide users through adding first location
   - Explain location hierarchy

3. **Add Analytics** for multi-location usage:
   - Track how many locations are managed
   - Identify power users

## Notes

- ✅ Feature flag `chainManagement` in types remains unchanged (no breaking change)
- ✅ ChainManagementPage component unchanged (still works)
- ✅ Backend logic unchanged (only UI visibility changed)
- ✅ No database migrations needed
- ✅ Backward compatible with existing data
