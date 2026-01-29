# Multi-Location Toggle & Editable Feature Presets - Complete

## Overview
Successfully implemented multi-location toggle and fully editable feature presets in the Restaurant Settings page. Users can now easily enable chain management and customize all 14 features based on their needs.

## New Features Implemented

### 1. Multi-Location Toggle (Basic Info Tab)

**Location:** Settings → Basic Info → Multi-Location section

**Functionality:**
```
┌─────────────────────────────────────────────────┐
│ Multi-Location                                  │
├─────────────────────────────────────────────────┤
│ ⚪ Multi-Location Business                      │
│    Enable chain management for multiple         │
│    locations                                    │
└─────────────────────────────────────────────────┘
```

**When Enabled:**
Shows three radio button options:

1. **Same Brand - Multi-Location (2-9 locations)**
   - Multiple locations of the same restaurant brand
   - Independent operations per location
   - Example: "Pizza Palace" at 5 different locations
   - Sets `restaurantType` to `FULL_SERVICE` with `chainManagement` enabled

2. **Multi-Brand Owner (Different Brands)**
   - Multiple different restaurant brands under single ownership
   - Independent operations per brand
   - Example: Italian restaurant + Cafe + Bar
   - Sets `restaurantType` to `MULTI_BRAND`

3. **Large Chain (10+ locations)**
   - Enterprise chain with 10+ locations
   - Centralized menu, pricing, and standardized operations
   - Sets `restaurantType` to `LARGE_CHAIN`

**Auto-Features:**
- Automatically enables `chainManagement` feature
- Applies appropriate feature preset for selected scale
- Shows info banner about chain management capabilities

---

### 2. Editable Feature Preset Section (Basic Info Tab)

**Location:** Settings → Basic Info → Feature Configuration

#### Feature Categories:

**Core Operations (4 features):**
- ☑️ Table Service - Enable table/floor plan management
- ☑️ Takeaway Orders - Enable takeaway/pickup orders
- ☑️ Dine-In Service - Enable dine-in service
- ☑️ Delivery Orders - Enable delivery orders

**Sales Channels (3 features):**
- ☑️ Online Orders - Enable online ordering integration
- ☑️ Aggregator Integration - Enable Swiggy/Zomato integration
- ☑️ QR Code Ordering - Enable QR code table ordering

**Specialized Features (3 features):**
- ☑️ Bar Management - Enable bar inventory, recipes, closing workflows
- ☑️ Chain Management - Enable chain/multi-location management **(Auto-enabled for multi-location)**
- ☑️ Kitchen Display System - Enable KDS

**Management Features (5 features):**
- ☑️ Inventory Management - Enable full inventory tracking
- ☑️ Staff Management - Enable staff roster, attendance, payroll
- ☑️ Customer Management - Enable customer database and loyalty
- ☑️ Advanced Reports - Enable detailed analytics and reports
- ☑️ Multi-Currency Support - Enable multi-currency pricing

#### Visual Indicators:

**Recommended Badge (Blue):**
```
┌─────────────────────────────────────┐
│ ☑️ Table Service  [Recommended]     │
│    Enable table/floor plan...       │
└─────────────────────────────────────┘
```
Shows when feature is recommended for selected restaurant type

**Auto-enabled Badge (Orange):**
```
┌─────────────────────────────────────┐
│ ☑️ Chain Management  [Auto-enabled] │
│    Enable chain/multi-location...   │
└─────────────────────────────────────┘
```
Shows when feature is automatically enabled (cannot be disabled)

---

## User Workflows

### Workflow 1: Enable Multi-Location for Single Restaurant

**Starting State:** Single-location Full-Service Restaurant

**Steps:**
1. Go to Settings → Basic Info
2. Scroll to "Multi-Location" section
3. Toggle "Multi-Location Business" to **ON**
4. Select scale:
   - **Multi-Location (2-9 locations)** for independent operations
   - **Large Chain (10+ locations)** for centralized operations
5. Review Feature Configuration section
6. Customize features as needed
7. Click "Save Settings"

**Result:**
- Restaurant type changes to MULTI_BRAND or LARGE_CHAIN
- chainManagement feature auto-enabled
- Feature preset applied (customizable)
- Chain Management page becomes available
- Settings UI updates to show chain-specific options

---

### Workflow 2: Customize Features for Dark Kitchen

**Starting State:** Dark Kitchen restaurant type

**Steps:**
1. Go to Settings → Basic Info
2. Scroll to "Feature Configuration"
3. Review recommended features (marked with blue badge)
4. Customize as needed:
   - ✅ Keep: Delivery Orders, Aggregator Integration (recommended)
   - ✅ Enable: Online Orders (optional, but useful)
   - ❌ Disable: Table Service, Dine-In (not applicable)
5. Click "Save Settings"

**Result:**
- Custom feature set for dark kitchen
- Only relevant features enabled
- System adapts to feature availability

---

### Workflow 3: Switch from Multi-Location to Single Location

**Starting State:** Multi-Location business (5 locations)

**Steps:**
1. Go to Settings → Basic Info
2. Scroll to "Multi-Location" section
3. Toggle "Multi-Location Business" to **OFF**
4. Confirm the change (future enhancement: add confirmation dialog)
5. Review Feature Configuration - chainManagement will be disabled
6. Adjust other features as needed
7. Click "Save Settings"

**Result:**
- Restaurant type changes to FULL_SERVICE (or previous single type)
- chainManagement feature disabled
- Chain Management page no longer accessible
- Single-location feature preset applied

---

## Technical Implementation

### Files Modified:

1. **src/components/admin/RestaurantSettingsInline.tsx**
   - Added Multi-Location toggle section
   - Added Feature Configuration section with all 14 features
   - Updated `handleTypeChange()` to apply feature presets
   - Auto-enable chainManagement for multi-location types
   - Added visual badges for recommended and auto-enabled features

### Key Functions:

**handleTypeChange():**
```typescript
const handleTypeChange = (newType: RestaurantType) => {
  // Apply the feature preset for the selected type
  const featurePreset = getFeaturePreset(newType);

  // Ensure chainManagement is enabled for multi-location types
  if (newType === RestaurantType.MULTI_BRAND || newType === RestaurantType.LARGE_CHAIN) {
    featurePreset.chainManagement = true;
  }

  setFormData((prev) => ({
    ...prev,
    restaurantType: newType,
    features: featurePreset,
  }));

  setShowTypeDropdown(false);
};
```

### Feature Structure:

Each feature toggle follows this pattern:
```tsx
<label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100">
  <div className="flex items-center gap-3 flex-1">
    <input
      type="checkbox"
      checked={formData.features?.featureName ?? false}
      onChange={(e) => handleInputChange('features.featureName', e.target.checked)}
      className="w-4 h-4"
      disabled={/* if auto-enabled */}
    />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span>Feature Name</span>
        {typeConfig.featurePreset.featureName && (
          <span className="bg-blue-100 text-blue-700">Recommended</span>
        )}
      </div>
      <span className="text-xs">Feature description</span>
    </div>
  </div>
</label>
```

---

## Feature Presets by Restaurant Type

### Full-Service Restaurant
**Recommended Features:**
- ✅ Table Service, Takeaway, Dine-In, Delivery
- ✅ Online Orders, Aggregator Integration, QR Ordering
- ✅ Kitchen Display System
- ✅ Inventory, Staff, Customer, Advanced Reports
- ❌ Bar Management (optional)
- ❌ Chain Management (disabled)

### Dark Kitchen
**Recommended Features:**
- ✅ Delivery, Aggregator Integration
- ✅ Kitchen Display System
- ✅ Inventory, Staff, Advanced Reports
- ❌ Table Service, Dine-In, Takeaway (no dine-in)
- ❌ QR Ordering, Bar Management (not applicable)

### Bar/Lounge
**Recommended Features:**
- ✅ Table Service, Dine-In, QR Ordering
- ✅ **Bar Management** (critical)
- ✅ Inventory, Staff, Customer, Advanced Reports
- ❌ Delivery, Aggregator Integration (not typical)

### Food Truck
**Minimal Features:**
- ✅ Takeaway Orders
- ⚠️ Most features optional (simplified operations)
- ❌ Table Service, Bar Management, Chain Management

### Multi-Brand Owner
**Enterprise Features:**
- ✅ All core operations
- ✅ All sales channels
- ✅ **Chain Management** (auto-enabled)
- ✅ All management features

### Large Chain (10+ locations)
**Enterprise Features:**
- ✅ All features enabled
- ✅ **Chain Management** (auto-enabled)
- ✅ Multi-Currency Support
- ✅ Advanced Reports (critical)

---

## Benefits

### For Restaurant Operators:
1. **Easy Setup**: One-click enable multi-location
2. **Clear Guidance**: Visual badges show recommended features
3. **Full Control**: All features are individually toggleable
4. **Logical Grouping**: Features organized by category
5. **Smart Defaults**: Presets match business type

### For Multi-Location Businesses:
1. **Scale Selection**: Choose between multi-location and large chain
2. **Automatic Setup**: Chain management auto-enabled
3. **Feature Inheritance**: Preset applies but remains customizable
4. **Clear Communication**: Info banner explains capabilities

### For Developers:
1. **Centralized Logic**: Feature presets in one location
2. **Type Safety**: TypeScript ensures consistency
3. **Extensible**: Easy to add new features
4. **Clean UI**: Consistent design pattern

---

## Testing Scenarios

### Test 1: Enable Multi-Location
- [ ] Toggle multi-location ON
- [ ] Verify radio options appear
- [ ] Select "Multi-Location (2-9 locations)"
- [ ] Verify chainManagement auto-enabled
- [ ] Verify "Auto-enabled" badge shows
- [ ] Save and verify persistence

### Test 2: Disable Multi-Location
- [ ] Toggle multi-location OFF
- [ ] Verify radio options disappear
- [ ] Verify chainManagement disabled
- [ ] Verify restaurant type changes to single-location
- [ ] Save and verify persistence

### Test 3: Switch Between Scales
- [ ] Enable multi-location
- [ ] Select "Multi-Location"
- [ ] Switch to "Large Chain"
- [ ] Verify feature preset updates
- [ ] Verify multi-currency support enabled for large chain

### Test 4: Customize Features
- [ ] Select any restaurant type
- [ ] Toggle individual features
- [ ] Verify recommendations show correctly
- [ ] Save and reload
- [ ] Verify custom selections persist

### Test 5: Feature Dependencies
- [ ] Enable chain management manually (for single-location)
- [ ] Verify it can be enabled
- [ ] Enable multi-location
- [ ] Verify chainManagement becomes locked (auto-enabled)
- [ ] Disable multi-location
- [ ] Verify chainManagement can be toggled again

---

## Future Enhancements

1. **Confirmation Dialog**: Warn when disabling multi-location with existing locations
2. **Feature Dependencies**: Show which features depend on others
3. **Usage Analytics**: Track which features are most commonly enabled
4. **Feature Previews**: Show screenshots/demos of each feature
5. **Onboarding Tours**: Guide new users through feature selection
6. **Bulk Apply**: Apply feature set to all locations in chain
7. **Feature Limits**: Restrict features based on subscription plan

---

## Documentation

- Main Implementation: [CONTEXTUAL_SETTINGS_IMPLEMENTATION.md](CONTEXTUAL_SETTINGS_IMPLEMENTATION.md)
- Restaurant Type System: [src/types/restaurantTypes.ts](src/types/restaurantTypes.ts)
- Settings Component: [src/components/admin/RestaurantSettingsInline.tsx](src/components/admin/RestaurantSettingsInline.tsx)

---

**Status:** ✅ Complete - Ready for Testing
**Date:** 2026-01-26
