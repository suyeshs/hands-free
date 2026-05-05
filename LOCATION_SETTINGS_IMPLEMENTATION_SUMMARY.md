# Location-Specific Settings - Implementation Summary

## Context
The user asked: **"what about the settings, special, dine-in overrides, printer, tax info and all the other settings"**

This refers to how different settings sections should behave when viewing a **location tenant** (branch) vs **master tenant** (HQ).

---

## What Has Been Implemented ✅

### 1. Core Infrastructure (COMPLETE)
- ✅ **Hook**: `useIsLocationTenant()` - Detects if current tenant is a location
  - Returns `isLocation` boolean
  - Returns `locationMetadata` with chain info
  - Listens for tenant-switched events

- ✅ **Rust Command**: `get_restaurant_settings_location_info`
  - Reads `is_location` flag from restaurant_settings
  - Returns location_group_id, master_tenant_id, current_location_name
  - Registered in lib.rs invoke_handler

- ✅ **UI Component**: `LocationTenantBanner`
  - Info banner showing "You are viewing a location"
  - Displays location name
  - Can be added to any settings page

- ✅ **Specification**: `LOCATION_SETTINGS_SPECIFICATION.md`
  - Complete matrix of what locations can/cannot edit
  - Covers all settings sections mentioned by user

---

## What Needs Implementation 🔨

### Answer to User's Question

For each setting type the user asked about:

#### 1. **Tax Info** (RestaurantSettingsInline - Tax Tab)
**Status**: Needs Implementation
**Behavior**:
- ✅ **Fully editable for locations** (tax varies by jurisdiction)
- Add `LocationTenantBanner` at top
- Add note: "Tax settings are location-specific"
- No field restrictions (CGST, SGST, service charge all editable)

**Why**: Different locations may be in different tax jurisdictions with different rates.

---

#### 2. **Specials** (SpecialsManager)
**Status**: Needs Implementation
**Behavior**:
- ✅ **Fully editable for locations** (specials are location-specific)
- Add `LocationTenantBanner` at top
- No restrictions (locations can create their own daily specials/promotions)

**Why**: Daily specials and promotions vary by location based on local preferences, inventory, and market conditions.

---

#### 3. **Dine-In Overrides** (DineInPricingManager)
**Status**: Needs Implementation
**Behavior**:
- ✅ **Locations can override master prices** (market-specific pricing)
- Add `LocationTenantBanner` at top
- Show base price from master + override price side by side
- Add note: "Base prices from master menu. Set location-specific overrides."

**Why**: Different markets have different price sensitivities. A downtown location may charge more than a suburban location.

---

#### 4. **Printer** (PrinterSettingsInline)
**Status**: Needs Implementation
**Behavior**:
- ✅ **Fully editable for locations** (hardware is location-specific)
- Add `LocationTenantBanner` at top (optional, for awareness)
- No restrictions (each location has its own printers)

**Why**: Printers are physical hardware at each location. Fully independent.

---

#### 5. **Settings** (General - RestaurantSettingsInline)
**Status**: Needs Implementation
**Behavior varies by tab**:

**Basics Tab**:
- 🔒 Restaurant Name: Read-only (set during provisioning)
- 🔒 Address: Read-only (set during provisioning)
- ✏️ Owner Name: Editable
- ✏️ Phone: Editable
- ✏️ Email: Editable
- 🔒 Website: Read-only (corporate)

**Legal Tab**:
- ✏️ GST Number: Editable (location-specific)
- ✏️ FSSAI Number: Editable (location-specific)
- 🔒 PAN Number: Read-only (corporate)
- 🔒 CIN Number: Read-only (corporate)

**Invoice Tab**:
- ✏️ Invoice Prefix: Editable (unique per location)
- ✏️ Invoice Start Number: Editable
- 🔒 Footer Note: Read-only (inherited from master)
- 🔒 Invoice Terms: Read-only (corporate legal)

**Print Tab**:
- 🔒 Logo URL: Read-only (brand consistency)
- 🔒 Print Logo: Read-only (brand consistency)
- ✏️ Paper Width: Editable (hardware-specific)
- ✏️ Show Itemwise Tax: Editable (presentation preference)

**Why**: Locations need operational flexibility but must maintain brand consistency and corporate compliance.

---

#### 6. **All Other Settings**
Most other settings are **fully accessible** to locations:
- Staff Management ✅ (each location manages its own staff)
- Floor Plan ✅ (each location has unique layout)
- Customers ✅ (location-specific customer database)
- Device Settings ✅ (hardware-specific)
- QR Ordering ✅ (operational decision)
- Attendance & Rostering ✅ (location-specific)
- Training & System ✅ (operational tools)

**Exception**: Chain Management ❌ (completely hidden for locations)

---

## Implementation Priority

### Phase 1: Quick Wins (User's Specific Questions) 🎯
1. **Tax Info** - Add banner, document that it's fully editable
2. **Specials** - Add banner, document that it's fully editable
3. **Printer** - Add banner, document that it's fully editable
4. **Dine-In Pricing** - Add banner + override UI
5. **Hide Chain Management** - Add conditional rendering in SettingsPage.tsx

### Phase 2: Restaurant Settings (Most Complex)
6. **RestaurantSettingsInline** - Add read-only fields based on spec
   - Disable name/address in Basics
   - Disable PAN/CIN in Legal
   - Disable footer/terms in Invoice
   - Disable logo/QR in Print

### Phase 3: Menu Management
7. **MenuOnboarding** - Replace "Upload" with "Sync from Master"

---

## Code Changes Summary

### Files to Modify

1. **src/components/admin/RestaurantSettingsInline.tsx**
   - Import `useIsLocationTenant()` and `LocationTenantBanner`
   - Add banner at top of each tab content
   - Add `disabled` prop to read-only fields
   - Add "Inherited" badges for read-only fields

2. **src/components/admin/SpecialsManager.tsx**
   - Import `useIsLocationTenant()` and `LocationTenantBanner`
   - Add banner at top (informational only, no restrictions)

3. **src/components/admin/DineInPricingManager.tsx**
   - Import `useIsLocationTenant()` and `LocationTenantBanner`
   - Add banner at top
   - Show base price + override UI for locations

4. **src/components/admin/PrinterSettingsInline.tsx**
   - Import `useIsLocationTenant()` and `LocationTenantBanner`
   - Add banner at top (informational only, no restrictions)

5. **src/components/admin/MenuOnboarding.tsx**
   - Import `useIsLocationTenant()` and `LocationTenantBanner`
   - Add banner at top
   - Replace "Upload Menu" button with "Sync from Master" for locations

6. **src/pages-v2/SettingsPage.tsx**
   - Import `useIsLocationTenant()`
   - Filter out 'business-setup' category for locations (contains Chain Management)

---

## Testing Checklist

### As Master Tenant
- [ ] All settings fully editable
- [ ] Chain Management visible
- [ ] Menu Upload button visible
- [ ] No location banners shown

### As Location Tenant
- [ ] Location banner appears on all relevant pages
- [ ] Tax settings fully editable
- [ ] Specials fully editable
- [ ] Printer settings fully editable
- [ ] Dine-in pricing shows override UI
- [ ] Restaurant name/address read-only
- [ ] PAN/CIN read-only in legal tab
- [ ] Logo/QR read-only in print tab
- [ ] Chain Management hidden
- [ ] Menu "Sync from Master" button shown (not "Upload")

### Tenant Switching
- [ ] Switch master → location: UI updates correctly
- [ ] Switch location → master: UI updates correctly
- [ ] Location banner appears/disappears correctly

---

## Quick Reference: User's Questions Answered

| User Asked | Answer | Full Access? |
|-----------|--------|-------------|
| **Tax info** | Fully editable (jurisdiction-specific) | ✅ Yes |
| **Specials** | Fully editable (location-specific) | ✅ Yes |
| **Dine-in overrides** | Can override master prices | ✅ Yes (with overrides) |
| **Printer** | Fully editable (hardware-specific) | ✅ Yes |
| **Settings (general)** | Mixed (some read-only, most editable) | ⚠️ Partial |
| **All other settings** | Mostly full access | ✅ Yes (except Chain Mgmt) |

**Bottom Line**: Locations have extensive operational autonomy. Only brand/menu/corporate settings are restricted.

---

## Next Steps

1. Implement Phase 1 (tax, specials, printer, dine-in, hide chain)
2. Implement Phase 2 (restaurant settings read-only fields)
3. Implement Phase 3 (menu sync vs upload)
4. Test all scenarios
5. Update documentation

The infrastructure is ready. Now it's just about adding the hooks and conditional rendering to each component.
