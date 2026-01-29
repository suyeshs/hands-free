# Contextual Restaurant Settings Implementation

## Overview
Successfully implemented contextual restaurant settings that dynamically show/hide tabs and fields based on the selected restaurant type. Settings now include visual indicators (badges) showing which configurations are critical vs recommended for each type.

## Implementation Summary

### 1. Restaurant Type Criticality Matrix
**File:** [src/types/restaurantTypes.ts](src/types/restaurantTypes.ts:313-566)

Added comprehensive criticality matrix for all 8 restaurant types:

#### New Types & Enums:
- `SettingCriticality` enum: CRITICAL, RECOMMENDED, OPTIONAL, HIDDEN
- `RestaurantTypeSettingsCriticality` interface: Defines tab and field criticality
- `SETTINGS_CRITICALITY` constant: Matrix for all 8 restaurant types

#### Restaurant Types Covered:
1. **Full-Service Restaurant**: All features enabled, table service critical
2. **Cafe/Bakery**: Simplified POS, no table filtering
3. **Dark Kitchen**: No print/POS tabs (delivery-only focus)
4. **Bar/Lounge**: Service charge recommended, staff PIN critical
5. **QSR/Fast Food**: Streamlined settings, no table filtering
6. **Food Truck**: Minimal requirements, optional legal
7. **Multi-Brand**: All critical features for enterprise management
8. **Large Chain**: Everything critical for centralized operations

#### Utility Function:
```typescript
getSettingCriticality(type: RestaurantType, category: 'tabs' | 'fields', key: string): SettingCriticality
```

### 2. RestaurantSettingsInline Component Refactor
**File:** [src/components/admin/RestaurantSettingsInline.tsx](src/components/admin/RestaurantSettingsInline.tsx)

#### New Components Added:

**CriticalityBadge Component:**
- Orange badge with "Required" label for CRITICAL settings
- Blue badge with "Recommended" label for RECOMMENDED settings
- No badge for OPTIONAL/HIDDEN settings

**TabBadge Component:**
- Orange dot indicator for CRITICAL tabs
- Blue dot indicator for RECOMMENDED tabs
- No indicator for OPTIONAL tabs

#### Restaurant Type Selector Banner:
```
┌─────────────────────────────────────────────────────────┐
│ 🏪 Full-Service Restaurant                 [Change Type]│
│ Traditional dine-in restaurant with table service       │
└─────────────────────────────────────────────────────────┘
```

Features:
- Shows current restaurant type with icon and description
- Dropdown menu with all 8 restaurant types
- Click "Change Type" to switch restaurant type
- UI automatically refreshes to show/hide relevant settings

#### Dynamic Tab Filtering:
Tabs are filtered based on criticality:
- ✓ CRITICAL/RECOMMENDED/OPTIONAL tabs are visible
- ✗ HIDDEN tabs are completely removed from view

**Example - Dark Kitchen:**
- Shows: Basic Info, Legal, Invoice, Tax
- Hides: Print, POS (not applicable for delivery-only)

#### Conditional Field Rendering:

**Basic Info Tab:**
- Restaurant Name: Always required
- Owner Name: Conditional (CRITICAL for chains, OPTIONAL for cafes)
- Tagline: Conditional (HIDDEN for dark kitchens)
- Email: Conditional (CRITICAL for dark kitchens, RECOMMENDED for full-service)
- **Multi-Location Toggle**: Enable/disable multi-location business
  - When enabled, shows options to select:
    - Multi-Location (2-9 locations): Independent operations per location
    - Large Chain (10+ locations): Centralized menu and pricing
  - Automatically enables chainManagement feature when toggled on
  - Switching between scales updates feature presets accordingly

**Legal & Tax IDs Tab:**
- GST Number: Conditional criticality based on type
- FSSAI Number: CRITICAL for full-service, RECOMMENDED for food trucks
- PAN Number: CRITICAL for chains, RECOMMENDED for others

**Tax & Charges Tab:**
- Service Charge: HIDDEN for cafes/QSR/food trucks (no table service)
- Tax Settings: CRITICAL for most types

**Print Tab:**
- Print Logo: Conditional (HIDDEN for dark kitchens)
- Print QR Code: Conditional (HIDDEN for dark kitchens)
- Completely hidden for dark kitchens

**POS & Theme Tab:**
- Staff PIN: CRITICAL for bars, RECOMMENDED for full-service, HIDDEN for dark kitchens
- Table Filtering: HIDDEN for non-table-service types
- Completely hidden for dark kitchens

## Examples of Type-Specific Behavior

### Dark Kitchen (Cloud Kitchen)
**Visible Tabs:**
- ✓ Basic Info (CRITICAL)
- ✓ Legal & Tax IDs (RECOMMENDED)
- ✓ Invoice (OPTIONAL)
- ✓ Tax & Charges (CRITICAL)
- ✗ Print (HIDDEN - no customer receipts)
- ✗ POS & Theme (HIDDEN - no table service)

**Hidden Fields:**
- Tagline (not customer-facing)
- Service Charge (no dine-in)
- Print settings (no receipts)
- Staff PIN settings (minimal POS)
- Table filtering (no tables)

### Bar/Lounge
**Critical Settings:**
- Table service features
- Staff PIN (liquor license compliance)
- GST Number (legal requirement)

**Recommended Settings:**
- Service charge (common in bars)
- FSSAI Number (if serving food)
- QR ordering

### Food Truck
**Minimal Requirements:**
- Basic restaurant details
- Optional legal compliance
- Simplified tax settings
- No POS/table management

## Technical Details

### State Management:
- Restaurant type stored in `formData.restaurantType`
- Changes trigger immediate UI refresh via React state
- Type persists in SQLite via `updateSettings()`

### Conditional Rendering Pattern:
```typescript
{getSettingCriticality(restaurantType, 'fields', 'fieldName') !== SettingCriticality.HIDDEN && (
  <div>
    <label className="flex items-center gap-2">
      Field Label
      {criticality === CRITICAL && ' *'}
      <CriticalityBadge level={criticality} />
    </label>
    <input ... />
  </div>
)}
```

### Visual Indicators:
- **Orange Badge**: Required settings (must configure)
- **Blue Badge**: Recommended settings (should configure)
- **Orange Dot on Tab**: Tab contains critical settings
- **Blue Dot on Tab**: Tab contains recommended settings
- **No Badge**: Optional settings

## New Feature: Editable Feature Presets

Added a comprehensive "Feature Configuration" section in the Basic Info tab that allows users to:

### Feature Categories:
1. **Core Operations** (4 features)
   - Table Service, Takeaway Orders, Dine-In Service, Delivery Orders
2. **Sales Channels** (3 features)
   - Online Orders, Aggregator Integration, QR Code Ordering
3. **Specialized Features** (3 features)
   - Bar Management, Chain Management, Kitchen Display System
4. **Management Features** (5 features)
   - Inventory, Staff, Customer, Advanced Reports, Multi-Currency

### Key Features:
- ✓ All 14 features are individually toggleable
- ✓ "Recommended" badge shows preset suggestions for each type
- ✓ "Auto-enabled" badge for mandatory features (e.g., chainManagement for multi-location)
- ✓ Chain Management is disabled (grayed out) when multi-location is enabled
- ✓ Features are organized into logical groups
- ✓ Changing restaurant type applies preset but can be customized

### Multi-Location Toggle:
- Single toggle in Basic Info enables/disables multi-location business
- When enabled, shows three radio options:
  - **Same Brand - Multi-Location (2-9 locations)**: Same brand at multiple locations with independent operations
  - **Multi-Brand Owner (Different Brands)**: Different brands under single ownership (e.g., Italian + Cafe + Bar)
  - **Large Chain (10+ locations)**: Enterprise chain with centralized operations
- Automatically enables chainManagement feature for all options
- Info banner explains chain management capabilities

## User Experience Flow

1. **Initial State**: Settings show based on current restaurant type (default: Full-Service)
2. **Change Type**: User clicks "Change Type" in banner
3. **Select New Type**: Dropdown shows all 8 types with descriptions
4. **Auto-Refresh**: UI immediately updates:
   - Tabs filter based on new type
   - Fields show/hide based on new type
   - Badges update to show new criticality levels
   - Feature preset applies (but remains customizable)
5. **Customize Features**: User can toggle individual features on/off
6. **Enable Multi-Location**: Toggle multi-location to enable chain management
7. **Save**: User saves settings with new type and custom features applied

## Benefits

### For Restaurant Operators:
- ✓ See only relevant settings for their business type
- ✓ Clear visual indicators for what's required vs optional
- ✓ Reduced complexity for simple setups (food trucks, cafes)
- ✓ Comprehensive controls for complex setups (chains, multi-brand)

### For Development:
- ✓ Centralized criticality matrix (easy to update)
- ✓ Reusable badge components
- ✓ Type-safe implementation with TypeScript
- ✓ No breaking changes to existing settings storage

### For Scalability:
- ✓ Easy to add new restaurant types
- ✓ Easy to adjust criticality levels
- ✓ Extensible to add more fields
- ✓ Supports future feature toggles

## Testing Checklist

- [ ] Select Dark Kitchen type → verify Print/POS tabs hidden
- [ ] Select Bar/Lounge → verify service charge visible and recommended
- [ ] Select Food Truck → verify simplified settings
- [ ] Select Full-Service → verify all tabs visible
- [ ] Change from Dark Kitchen to Full-Service → verify tabs appear
- [ ] Verify badges show correctly (orange for critical, blue for recommended)
- [ ] Verify tab dots show correctly
- [ ] Verify settings save correctly when changing types
- [ ] Test dropdown closes when selecting a type
- [ ] Verify all 8 restaurant types work correctly

## Files Modified

1. **src/types/restaurantTypes.ts** (NEW CODE: 254 lines)
   - Added `SettingCriticality` enum
   - Added `RestaurantTypeSettingsCriticality` interface
   - Added `SETTINGS_CRITICALITY` matrix for all 8 types
   - Added `getSettingCriticality()` utility function

2. **src/components/admin/RestaurantSettingsInline.tsx** (REFACTORED: ~600 lines)
   - Added `CriticalityBadge` component
   - Added `TabBadge` component
   - Added restaurant type selector banner with dropdown
   - Added dynamic tab filtering
   - Added conditional field rendering for all 6 tabs
   - Added badges to all applicable fields

## Status

✅ **Complete** - All features implemented and ready for testing

## Next Steps

1. Test in development environment with all 8 restaurant types
2. Verify settings persistence across type changes
3. Test with real restaurant data
4. Gather user feedback on criticality levels
5. Adjust criticality matrix based on feedback

---

**Implementation Date:** 2026-01-26
**Status:** Complete - Ready for Testing
