# Location-Specific Settings Specification

## Overview
This document defines how each settings section behaves when viewing a **location tenant** (branch) vs a **master tenant** (headquarters).

**Key Principle**: Locations have autonomy for operational settings but inherit brand/menu from master.

---

## Settings Behavior Matrix

### 1. Business Setup

#### Restaurant Information - Basics Tab
**Component**: `RestaurantSettingsInline` (basics tab)

| Setting | Master | Location | Rationale |
|---------|--------|----------|-----------|
| Restaurant Name | ✏️ Editable | 🔒 Read-only | Name is set during provisioning |
| Owner Name | ✏️ Editable | ✏️ Editable | Each location may have different owner |
| Address | 🔒 Read-only | 🔒 Read-only | Address is set during provisioning |
| Phone | ✏️ Editable | ✏️ Editable | Each location has its own phone |
| Email | ✏️ Editable | ✏️ Editable | Each location has its own email |
| Website | ✏️ Editable | 🔒 Read-only | Corporate website, same for all |

**Implementation**:
- Show `LocationTenantBanner` at top
- Disable name and address fields
- Show info tooltip: "Name and address are managed during location provisioning"

---

#### Restaurant Information - Tax Tab
**Component**: `RestaurantSettingsInline` (tax tab)

| Setting | Master | Location | Rationale |
|---------|--------|----------|-----------|
| Tax Enabled | ✏️ Editable | ✏️ Editable | Locations may have different tax rules |
| CGST/SGST Rates | ✏️ Editable | ✏️ Editable | Tax rates vary by jurisdiction |
| Service Charge | ✏️ Editable | ✏️ Editable | Locations can set their own rates |
| Tax Included in Price | ✏️ Editable | ✏️ Editable | Display preference per location |

**Implementation**:
- Show `LocationTenantBanner` at top
- All fields editable (tax varies by jurisdiction)
- Add note: "Tax settings are location-specific due to varying tax jurisdictions"

---

#### Restaurant Information - Legal Tab
**Component**: `RestaurantSettingsInline` (legal tab)

| Setting | Master | Location | Rationale |
|---------|--------|----------|-----------|
| GST Number | ✏️ Editable | ✏️ Editable | Each location has its own GST |
| FSSAI Number | ✏️ Editable | ✏️ Editable | Each location has its own FSSAI |
| PAN Number | ✏️ Editable | 🔒 Read-only | Corporate PAN, same for all |
| CIN Number | ✏️ Editable | 🔒 Read-only | Corporate CIN, same for all |

**Implementation**:
- Show `LocationTenantBanner` at top
- Disable PAN and CIN fields for locations
- GST and FSSAI remain editable

---

#### Restaurant Information - Invoice Tab
**Component**: `RestaurantSettingsInline` (invoice tab)

| Setting | Master | Location | Rationale |
|---------|--------|----------|-----------|
| Invoice Prefix | ✏️ Editable | ✏️ Editable | Each location needs unique prefix |
| Invoice Start Number | ✏️ Editable | ✏️ Editable | Each location has own numbering |
| Footer Note | ✏️ Editable | 🔒 Inherit from Master | Corporate messaging |
| Invoice Terms | ✏️ Editable | 🔒 Inherit from Master | Legal terms, same for all |

**Implementation**:
- Show `LocationTenantBanner` at top
- Disable footer note and terms for locations
- Show inherited values with "Inherited from Master" badge

---

#### Restaurant Information - Print Tab
**Component**: `RestaurantSettingsInline` (print tab)

| Setting | Master | Location | Rationale |
|---------|--------|----------|-----------|
| Logo URL | ✏️ Editable | 🔒 Inherit from Master | Brand consistency |
| Print Logo | ✏️ Editable | 🔒 Inherit from Master | Brand consistency |
| QR Code URL | ✏️ Editable | 🔒 Read-only | Corporate QR |
| Paper Width | ✏️ Editable | ✏️ Editable | Hardware-specific |
| Show Itemwise Tax | ✏️ Editable | ✏️ Editable | Presentation preference |

**Implementation**:
- Show `LocationTenantBanner` at top
- Disable logo and QR fields for locations
- Hardware settings remain editable

---

### 2. Menu & Products

#### Menu Management
**Component**: `MenuOnboarding`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Upload Menu | ✅ Yes | ❌ No | Master controls menu |
| Sync from Master | N/A | ✅ Yes | Locations sync menu |
| Edit Items | ✅ Yes | ❌ No | Master controls menu |
| View Menu | ✅ Yes | ✅ Yes | Both can view |

**Implementation**:
- Show `LocationTenantBanner` at top
- Replace "Upload Menu" button with "Sync from Master" button for locations
- Disable editing for locations
- Add banner: "Menu is managed by your master tenant. Use Sync to get latest updates."

---

#### Daily Specials
**Component**: `SpecialsManager`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Create Specials | ✅ Yes | ✅ Yes | Location-specific promotions |
| Edit Specials | ✅ Yes | ✅ Yes | Full control |
| View Master Specials | N/A | ✅ Yes (read-only) | Locations can see corporate specials |

**Implementation**:
- Show `LocationTenantBanner` at top
- Full editing for locations (specials are location-specific)
- **Optional Enhancement**: Show master's specials in separate "Corporate Specials" section (read-only)

---

#### Dine-In Pricing
**Component**: `DineInPricingManager`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Set Base Prices | ✅ Yes | 🔒 Inherit from Master | Menu sync |
| Override Prices | N/A | ✅ Yes | Market-specific pricing |
| Disable Overrides | ✅ Yes | ❌ No | Master controls policy |

**Implementation**:
- Show `LocationTenantBanner` at top
- Locations can override prices for their market
- Show base price from master and override price side by side
- Add note: "Base prices are from master menu. You can set location-specific overrides."

---

### 3. Operations

#### Staff Management
**Component**: `StaffManager`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Add Staff | ✅ Yes | ✅ Yes | Each location manages staff |
| Edit Staff | ✅ Yes | ✅ Yes | Full control |
| Assign to Location | ✅ Yes | N/A | Master assigns staff to locations |

**Implementation**:
- No restrictions for locations (full access)
- **Optional Enhancement**: Master can see all staff across locations

---

#### Floor Plan
**Component**: `FloorPlanManager`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Create/Edit Tables | ✅ Yes | ✅ Yes | Each location has unique layout |

**Implementation**:
- No restrictions for locations (full access)

---

#### QR Ordering
**Component**: `QROrderingSettings`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Enable/Disable | ✅ Yes | ✅ Yes | Operational decision |
| Configure Settings | ✅ Yes | ✏️ Editable | Location-specific config |

**Implementation**:
- No restrictions for locations (full access)

---

#### Customers
**Component**: `CustomerManager`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| View Customers | ✅ Yes | ✅ Yes | Location sees its customers |
| Add/Edit Customers | ✅ Yes | ✅ Yes | Location-specific |

**Implementation**:
- No restrictions for locations (full access)
- **Optional Enhancement**: Master can see consolidated customer database

---

### 4. Hardware & Printing

#### Printer Setup
**Component**: `PrinterSettingsInline`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Configure Printers | ✅ Yes | ✅ Yes | Hardware is location-specific |
| Add/Remove Printers | ✅ Yes | ✅ Yes | Full control |

**Implementation**:
- No restrictions for locations (full access)
- Each location has its own printers

---

#### Device Configuration
**Component**: `DeviceSettings`

| Action | Master | Location | Rationale |
|--------|--------|----------|-----------|
| Device Mode | ✅ Yes | ✅ Yes | Location-specific |
| Sync Settings | ✅ Yes | ✅ Yes | Location-specific |

**Implementation**:
- No restrictions for locations (full access)

---

### 5. Chain Management

**Component**: `MultiLocationManager`

| Visibility | Master | Location |
|------------|--------|----------|
| Visible | ✅ Yes | ❌ Hidden |

**Implementation**:
- Completely hide "Chain Management" category for locations
- Only master can create/manage chains and locations

---

### 6. System & Training

All system settings remain fully accessible to locations:
- Training Mode
- Cloud Sync
- Migrations
- Handsfree Setup

**Implementation**:
- No restrictions for locations (full access)

---

## Implementation Checklist

### Phase 1: Core Infrastructure ✅
- [x] Create `useIsLocationTenant()` hook
- [x] Create `get_restaurant_settings_location_info` Rust command
- [x] Create `LocationTenantBanner` component
- [x] Create this specification document

### Phase 2: UI Adaptations
- [ ] **RestaurantSettingsInline**
  - [ ] Add LocationTenantBanner
  - [ ] Disable name/address in basics tab
  - [ ] Disable PAN/CIN in legal tab
  - [ ] Disable footer/terms in invoice tab
  - [ ] Disable logo/QR in print tab
  - [ ] Add "Inherited" badges

- [ ] **MenuOnboarding**
  - [ ] Add LocationTenantBanner
  - [ ] Replace "Upload" with "Sync from Master" button
  - [ ] Disable menu editing for locations

- [ ] **SpecialsManager**
  - [ ] Add LocationTenantBanner
  - [ ] Keep full editing (location-specific)

- [ ] **DineInPricingManager**
  - [ ] Add LocationTenantBanner
  - [ ] Show base price vs override price
  - [ ] Enable price overrides for locations

- [ ] **SettingsPage** (Category level)
  - [ ] Hide "Chain Management" category for locations

### Phase 3: Testing
- [ ] Test master tenant (all features accessible)
- [ ] Test location tenant (restricted features work correctly)
- [ ] Test tenant switching (UI updates correctly)
- [ ] Test read-only fields (cannot be edited)
- [ ] Test inherited values display correctly

---

## Summary

**Locations Have Full Access To**:
- Staff Management
- Floor Plan
- Customers
- Printer Setup
- Device Settings
- QR Ordering
- Daily Specials (location-specific)
- Tax Settings (jurisdiction-specific)
- Dine-In Pricing (with overrides)

**Locations Have Limited Access To**:
- Restaurant Basics (name/address read-only)
- Legal Info (PAN/CIN read-only)
- Invoice Settings (footer/terms inherited)
- Print Settings (logo/QR inherited)
- Menu Management (sync-only, no upload)

**Locations Cannot Access**:
- Chain Management (hidden completely)

This ensures locations have operational autonomy while maintaining brand consistency and menu centralization.
