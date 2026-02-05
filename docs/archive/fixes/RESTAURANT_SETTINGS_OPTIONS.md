# Restaurant Settings Configuration - Implementation Guide

## Overview

Two approaches are now available for restaurant settings configuration:

1. **RestaurantDetailsForm.tsx** (Updated) - Tabbed inline form
2. **RestaurantDetailsWizard.tsx** (New) - Full-screen multi-step wizard with save/sync status

---

## ✅ What Was Added

### 1. Feature Flags System

Added to **RestaurantDetails** interface in [restaurantSettingsStore.ts](src/stores/restaurantSettingsStore.ts):

```typescript
features: {
  // Operational Mode (mutually exclusive)
  operationalMode: 'single-location' | 'multi-location' | 'chain';

  // Core Features
  barManagement: boolean;               // Enable bar inventory, recipes, closing workflows
  chainManagement: boolean;             // Enable chain/multi-location management
  tableService: boolean;                // Enable table/floor plan management
  takeawayOrders: boolean;              // Enable takeaway/pickup orders
  onlineOrders: boolean;                // Enable online ordering integration
  aggregatorIntegration: boolean;       // Enable Swiggy/Zomato integration

  // Advanced Features
  inventoryManagement: boolean;         // Enable full inventory tracking
  staffManagement: boolean;             // Enable staff roster, attendance, payroll
  customerManagement: boolean;          // Enable customer database and loyalty
  qrOrdering: boolean;                  // Enable QR code table ordering
  kitchenDisplay: boolean;              // Enable KDS (Kitchen Display System)

  // Analytics & Reporting
  advancedReports: boolean;             // Enable detailed analytics and reports
  multiCurrencySupport: boolean;        // Enable multi-currency pricing
}
```

### 2. Default Feature Configuration

All features default to sensible values:
- **operationalMode**: `'single-location'`
- **tableService**: `true` (dine-in enabled by default)
- **takeawayOrders**: `true` (takeaway enabled by default)
- All other features: `false` (opt-in)

---

## 📋 Option 1: RestaurantDetailsForm (Updated)

**File**: [src/components/settings/RestaurantDetailsForm.tsx](src/components/settings/RestaurantDetailsForm.tsx)

### Features:
- ✅ Tabbed interface (Details / Features)
- ✅ Compact design in a card/box
- ✅ Google Maps auto-extract
- ✅ Operational mode selection
- ✅ Feature toggles (Core + Advanced)
- ✅ Single save button for both sections
- ✅ Success/error notifications

### Usage:
```tsx
import { RestaurantDetailsForm } from './components/settings/RestaurantDetailsForm';

<RestaurantDetailsForm />
```

### Pros:
- Familiar form interface
- Compact, fits in settings page
- Quick tab switching

### Cons:
- All settings in one card/box
- Less emphasis on save status
- No step-by-step guidance

---

## 📋 Option 2: RestaurantDetailsWizard (New) ⭐ RECOMMENDED

**File**: [src/components/settings/RestaurantDetailsWizard.tsx](src/components/settings/RestaurantDetailsWizard.tsx)

### Features:
- ✅ **Full-screen steps** (not in a box)
- ✅ **Progress bar** with visual indicators
- ✅ **Save/Sync status bar** showing:
  - 🟡 Unsaved changes
  - 🟢 All changes saved
  - ☁️ Sync status (Tauri only)
- ✅ **Persistent save button** (always visible)
- ✅ **Step navigation** (Previous/Next)
- ✅ **Change detection** (auto-marks unsaved)
- ✅ **Smooth animations** (Framer Motion)
- ✅ Beautiful gradient background

### Usage:
```tsx
import { RestaurantDetailsWizard } from './components/settings/RestaurantDetailsWizard';

<RestaurantDetailsWizard />
```

### Pros:
- ✅ Each step gets full screen (as requested)
- ✅ Clear save/sync status indicators (as requested)
- ✅ Better UX for onboarding/setup
- ✅ Visual progress tracking
- ✅ Change detection and status persistence
- ✅ Professional wizard flow

### Cons:
- Takes more screen space
- Requires navigation between steps

---

## 🚀 Integration Guide (Using Bun)

### Step 1: Install Dependencies (if needed)

```bash
# Framer Motion (for animations)
bun add framer-motion

# Lucide React (icons - already installed)
# bun add lucide-react
```

### Step 2: Choose Your Approach

#### Option A: Use New Wizard (Recommended)

Replace in your settings page or onboarding flow:

```tsx
// Before
import { RestaurantDetailsForm } from './components/settings/RestaurantDetailsForm';

// After
import { RestaurantDetailsWizard } from './components/settings/RestaurantDetailsWizard';

// In your component
<RestaurantDetailsWizard />
```

#### Option B: Keep Updated Form

Continue using the updated form with new features tab:

```tsx
import { RestaurantDetailsForm } from './components/settings/RestaurantDetailsForm';

<RestaurantDetailsForm />
```

### Step 3: Rebuild & Test

```bash
# Development mode
bun run tauri dev

# Build for production
bun run tauri build
```

---

## 🎯 Recommended Usage by Context

### For Onboarding/Setup Wizard:
**Use:** `RestaurantDetailsWizard`
- Full-screen steps guide new users
- Clear progress and save indicators
- Professional first-time experience

### For Settings Page:
**Use:** `RestaurantDetailsForm` OR `RestaurantDetailsWizard`
- Form: Compact, fits in settings section
- Wizard: Better UX but takes full screen

### For Admin Panel:
**Use:** Either, based on preference
- Form: Quick access to specific settings
- Wizard: Guided configuration flow

---

## 📊 Feature Flag Usage Examples

### Example 1: Show Chain Management Menu

```tsx
import { useRestaurantSettingsStore } from './stores/restaurantSettingsStore';

function Navigation() {
  const { settings } = useRestaurantSettingsStore();

  return (
    <nav>
      {/* Always visible */}
      <NavItem href="/pos">POS</NavItem>
      <NavItem href="/menu">Menu</NavItem>

      {/* Conditional based on features */}
      {settings.features.chainManagement && (
        <NavItem href="/chain-management">Chain Management</NavItem>
      )}

      {settings.features.barManagement && (
        <NavItem href="/bar">Bar</NavItem>
      )}

      {settings.features.inventoryManagement && (
        <NavItem href="/inventory">Inventory</NavItem>
      )}
    </nav>
  );
}
```

### Example 2: Operational Mode Routing

```tsx
import { useRestaurantSettingsStore } from './stores/restaurantSettingsStore';

function Dashboard() {
  const { settings } = useRestaurantSettingsStore();

  if (settings.features.operationalMode === 'chain') {
    return <ChainDashboard />;
  } else if (settings.features.operationalMode === 'multi-location') {
    return <MultiLocationDashboard />;
  } else {
    return <SingleLocationDashboard />;
  }
}
```

### Example 3: Feature-Gated Components

```tsx
import { useRestaurantSettingsStore } from './stores/restaurantSettingsStore';

function POSDashboard() {
  const { settings } = useRestaurantSettingsStore();

  return (
    <div>
      {/* Core POS functionality */}
      <OrderEntry />

      {/* Feature-gated */}
      {settings.features.tableService && <FloorPlan />}
      {settings.features.qrOrdering && <QRCodeDisplay />}
      {settings.features.kitchenDisplay && <KDSLink />}
    </div>
  );
}
```

---

## 🔧 Bun Commands Reference

```bash
# Development
bun run tauri dev              # Start dev server with hot reload
bun run dev                    # Vite dev server only

# Building
bun run tauri build           # Build production app
bun run build                 # Build web assets only

# Dependencies
bun add <package>             # Add dependency
bun add -d <package>          # Add dev dependency
bun remove <package>          # Remove dependency
bun install                   # Install all dependencies

# Scripts
bunx <command>                # Run a package binary (like npx)
bun run <script>              # Run package.json script

# Testing (if configured)
bun test                      # Run tests
```

---

## 📝 Migration Checklist

- [x] Add `features` field to RestaurantDetails interface
- [x] Add default feature configuration
- [x] Update RestaurantDetailsForm with Features tab
- [x] Create RestaurantDetailsWizard with full-screen steps
- [ ] Choose which component to use (Form or Wizard)
- [ ] Update setup/onboarding flow to use chosen component
- [ ] Test feature flag conditionals in UI
- [ ] Test save/sync status indicators (Wizard)
- [ ] Build and test production app

---

## 🎨 Visual Comparison

### RestaurantDetailsForm (Updated)
```
┌─────────────────────────────────────┐
│ 🏪 Restaurant Details        Details│Features
│                                      │
│ [Restaurant Name]                    │
│ [Phone]          [Website]           │
│ [Address...]                         │
│                                      │
│ OR switch to Features tab →          │
│ - Operational Mode: ○○○              │
│ - Feature Checkboxes                 │
│                                      │
│           [Save Details]             │
└─────────────────────────────────────┘
```

### RestaurantDetailsWizard (New)
```
Full Screen with Gradient Background
┌─────────────────────────────────────┐
│ ●──────●─────○    Progress Bar      │
│                                      │
│ ⚠️ Unsaved changes        [Save]    │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ STEP 1: Restaurant Details      │ │
│ │                                 │ │
│ │ [Full screen form fields...]    │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [← Previous]         [Next →]        │
└─────────────────────────────────────┘
```

---

## 💡 Recommendation

**For your use case** (wanting each setting on its own screen with save/sync status):

✅ **Use RestaurantDetailsWizard**
- Full-screen dedicated pages
- Clear save/sync status indicators
- Professional wizard experience
- Better for onboarding

**Quick Start:**
```bash
# No new dependencies needed (Framer Motion likely already installed)

# Just import and use:
import { RestaurantDetailsWizard } from './components/settings/RestaurantDetailsWizard';
```

---

Ready to use! 🚀
