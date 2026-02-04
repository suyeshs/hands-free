# Android Mobile Apps Architecture
## Owner App & Staff App Separation Strategy

## Executive Summary

This plan focuses on splitting the current monolith into **two separate Android mobile applications**:
1. **Owner App** - Full-featured management dashboard for owners/managers
2. **Staff App** - Lightweight self-service app for restaurant employees

Both apps share the same Cloudflare backend infrastructure and sync data via D1 when connected to internet.

---

## Current State

### Existing Android Builds
You already have build variants configured:
- `src-tauri/tauri.conf.owner.json` - Owner build config
- `src-tauri/tauri.conf.staff.json` - Staff build config
- `src/config/buildConfig.ts` - Feature flags for staff vs owner

**Current Problem**: Both variants share the entire codebase, leading to:
- Large APK sizes (~50-80MB for both)
- Staff app includes unused owner code
- Security concerns (staff build contains owner features)
- Difficult to maintain separate release cycles

---

## Proposed Solution: Two Separate Android Apps

### 1. Architecture Overview

```
handsfree-restaurant/
│
├── apps/
│   ├── owner-mobile/              # Android Owner App
│   │   ├── src/
│   │   │   ├── pages/             # Owner-specific pages
│   │   │   ├── components/        # Owner-specific components
│   │   │   ├── stores/            # Owner-specific stores
│   │   │   └── App.tsx
│   │   ├── src-tauri/
│   │   │   ├── gen/android/       # Android project
│   │   │   ├── Cargo.toml
│   │   │   └── tauri.conf.json
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── staff-mobile/              # Android Staff App
│       ├── src/
│       │   ├── pages/             # Staff-specific pages
│       │   ├── components/        # Staff-specific components
│       │   ├── stores/            # Staff-specific stores
│       │   └── App.tsx
│       ├── src-tauri/
│       │   ├── gen/android/       # Android project
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   ├── shared-ui/                 # Shared UI components
│   ├── shared-lib/                # Shared utilities & services
│   ├── shared-types/              # TypeScript types
│   ├── shared-stores/             # Shared Zustand stores
│   ├── tauri-commands/            # Shared Rust commands
│   └── plugin-sdk/                # Plugin SDK (existing)
│
└── workers/                       # Cloudflare Workers (shared)
    ├── tenant-router/
    ├── domain-service/
    └── plugin-registry/
```

---

## 2. App Specifications

### Owner Mobile App

**Package Name**: `com.stonepot_tech.handsfree_pos.owner`
**App Name**: HandsFree Owner
**Target**: Restaurant owners, managers
**APK Size Target**: ~25-30MB (50% reduction)

**Features**:
- ✅ Restaurant settings & configuration
- ✅ Chain/multi-location management
- ✅ Cloud sync & D1 provisioning
- ✅ Plugin management
- ✅ Menu & inventory management
- ✅ Sales reports & analytics
- ✅ Staff roster & scheduling
- ✅ Aggregator settings
- ✅ Device provisioning
- ✅ Training mode controls

**Screens**:
- Hub/Dashboard
- Settings (restaurant, cloud sync, devices)
- Chain Management
- Plugin Store
- Sales Reports
- Inventory Dashboard
- Menu Management
- Staff Roster
- Tenant Activation

**Technologies**:
- React + TypeScript
- Tauri Android
- SQLite (local database)
- Zustand (state management)
- React Router (navigation)

---

### Staff Mobile App

**Package Name**: `com.stonepot_tech.handsfree_pos.staff`
**App Name**: HandsFree Staff
**Target**: Restaurant employees
**APK Size Target**: ~8-12MB (85% reduction)

**Features**:
- ✅ Clock in/out (attendance)
- ✅ View payroll & tips
- ✅ Request salary advances
- ✅ View work schedule
- ✅ Submit leave requests
- ✅ Personal dashboard

**Screens**:
- Hub/Dashboard (simplified)
- Attendance (clock in/out)
- Payroll (view only)
- Advances (request)
- Schedule (view only)
- Profile

**Technologies**:
- React + TypeScript
- Tauri Android
- SQLite (local database)
- Zustand (state management)
- React Router (navigation)

---

## 3. Shared Infrastructure

### Shared Backend (Cloudflare)

Both apps connect to the same Cloudflare infrastructure:

```
┌──────────────┐     ┌──────────────┐
│  Owner App   │     │  Staff App   │
│  (Android)   │     │  (Android)   │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────────┬───────────┘
                │
                ▼
    ┌────────────────────────┐
    │   Tenant Router        │
    │  (Cloudflare Worker)   │
    └───────────┬────────────┘
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
    ┌──────┐ ┌──────┐ ┌──────┐
    │Domain│ │Provis│ │Plugin│
    │Service│ │ioning│ │ Reg  │
    └───┬──┘ └───┬──┘ └───┬──┘
        │        │        │
        └────────┼────────┘
                 ▼
        ┌────────────────┐
        │ Durable Objects│
        │ D1 Database    │
        │ R2 Storage     │
        │ KV Cache       │
        └────────────────┘
```

### Data Sync Strategy

**Connected to Internet**:
- Both apps sync to D1 database
- Real-time updates via Durable Objects
- Immediate data consistency

**Offline (No Internet)**:
- Local SQLite database
- Queue changes locally
- Auto-sync when reconnected

**Conflict Resolution**:
- Last-write-wins (timestamp-based)
- Owner app has priority for settings
- Staff app read-only for most data

---

## 4. Component Distribution

### Owner Mobile App Components

**Pages** (`apps/owner-mobile/src/pages/`):
```
HubPage.tsx                    # Owner dashboard
SettingsPage.tsx               # Restaurant settings
ChainManagementPage.tsx        # Multi-location management
PluginsPage.tsx                # Plugin management
SalesReportPage.tsx            # Sales analytics
InventoryPage.tsx              # Inventory management
MenuManagementPage.tsx         # Menu editing
StaffRosterPage.tsx            # Staff scheduling
TenantActivationPage.tsx       # Activation/provisioning
ImageManagementPage.tsx        # Asset management
```

**Components** (`apps/owner-mobile/src/components/`):
```
admin/
  ├── CloudSyncSettings.tsx
  ├── D1ProvisionButton.tsx
  ├── DeviceSettings.tsx
  ├── RestaurantSettingsInline.tsx
  ├── ChainLocationManager.tsx
  └── WiFiAttendanceSettings.tsx

analytics/
  ├── SalesChart.tsx
  └── ReportsPanel.tsx

plugins/
  ├── PluginStore.tsx
  ├── PluginCard.tsx
  └── PluginUninstallModal.tsx

inventory/
  └── InventoryList.tsx

setup/
  ├── RestaurantBasicsCard.tsx
  └── TrainingModeScreen.tsx
```

**Stores** (`apps/owner-mobile/src/stores/`):
```
chainConfigStore.ts            # Chain configuration
provisioningStore.ts           # D1 provisioning state
setupWizardStore.ts            # Setup wizard state
restaurantSettingsStore.ts     # Restaurant settings
dailySalesStore.ts             # Sales data
multiLocationStore.ts          # Multi-location state
```

**Tauri Commands** (`apps/owner-mobile/src-tauri/src/commands/`):
```rust
settings.rs                    // Restaurant settings CRUD
d1_provision.rs                // D1 database provisioning
wizard.rs                      // Setup wizard
tenant.rs                      // Tenant configuration
device_settings.rs             // Device management
network.rs                     // Network operations
```

---

### Staff Mobile App Components

**Pages** (`apps/staff-mobile/src/pages/`):
```
HubPage.tsx                    # Staff dashboard (simplified)
AttendancePage.tsx             # Clock in/out
PayrollPage.tsx                # View payroll & tips
AdvancesPage.tsx               # Request advances
SchedulePage.tsx               # View work schedule
ProfilePage.tsx                # Personal profile
```

**Components** (`apps/staff-mobile/src/components/`):
```
attendance/
  ├── ClockInOutWidget.tsx     # Main clock in/out UI
  ├── AttendanceHistory.tsx    # Personal attendance history
  └── AttendanceTimer.tsx      # Active shift timer

payroll/
  ├── PayrollSummary.tsx       # Salary summary
  ├── TipsSummary.tsx          # Tips earned
  └── PayrollHistory.tsx       # Payment history

advances/
  ├── AdvanceRequestForm.tsx   # Request form
  └── AdvanceHistory.tsx       # Past advances

schedule/
  └── WeeklySchedule.tsx       # Work schedule view
```

**Stores** (`apps/staff-mobile/src/stores/`):
```
attendanceStore.ts             # Attendance state
payrollStore.ts                # Payroll data (read-only)
advancesStore.ts               # Advance requests
scheduleStore.ts               # Work schedule
```

**Tauri Commands** (`apps/staff-mobile/src-tauri/src/commands/`):
```rust
attendance.rs                  // Clock in/out operations
payroll.rs                     // Fetch payroll data
advances.rs                    // Request advances
schedule.rs                    // Fetch work schedule
```

---

### Shared Packages

#### `@handsfree/shared-ui`
**Size**: ~100KB
**Contents**:
- All shadcn/ui components (button, card, input, etc.)
- NetworkStatusIndicator
- WebSocketManager
- Auth components (LoginForm, ProtectedRoute)

#### `@handsfree/shared-lib`
**Size**: ~150KB
**Contents**:
- Database utilities (`database.ts`)
- Common utilities (`utils.ts`)
- D1 Sync Service
- R2 Uploader
- Order sync service
- Sales transaction service

#### `@handsfree/shared-types`
**Size**: ~5KB (types only)
**Contents**:
- Database types
- API types
- Tenant types
- Plugin types

#### `@handsfree/shared-stores`
**Size**: ~20KB
**Contents**:
- `tenantStore.ts` (tenant config - shared)
- `deviceStore.ts` (device settings - shared)
- `authStore.ts` (authentication state - shared)

#### `@handsfree/tauri-commands`
**Size**: ~300KB (compiled Rust)
**Contents**:
- Database operations (SQLite helpers)
- Network operations (HTTP client)
- Secure storage (credentials)
- LAN sync (local network sync)
- Utilities

---

## 5. Bundle Size Analysis

### Current State (Monolith)
```
Owner Build APK:    ~60MB
Staff Build APK:    ~55MB  (includes unused owner code!)
```

### After Separation
```
Owner Mobile APK:   ~30MB  (50% reduction)
  - App Code:       ~25MB
  - Shared Libs:    ~5MB

Staff Mobile APK:   ~12MB  (78% reduction)
  - App Code:       ~7MB
  - Shared Libs:    ~5MB

Total Savings:      ~73MB
```

**Breakdown**:
- **Shared Libraries**: Both apps share React, Tauri runtime (~5MB)
- **Owner Code**: Settings, analytics, plugins (~20MB)
- **Staff Code**: Minimal UI, attendance only (~2MB)

---

## 6. Android-Specific Configuration

### Owner App - `tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "HandsFree Owner",
  "version": "4.0.0",
  "identifier": "com.stonepot_tech.handsfree_pos.owner",
  "build": {
    "beforeDevCommand": "bun run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "bun run build",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["android"],
    "icon": [
      "icons/owner-icon.png"
    ],
    "android": {
      "minSdkVersion": 24,
      "versionCode": 1
    }
  },
  "plugins": {
    "sql": {
      "preload": ["sqlite:handsfree_owner.db"]
    }
  }
}
```

### Staff App - `tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "HandsFree Staff",
  "version": "4.0.0",
  "identifier": "com.stonepot_tech.handsfree_pos.staff",
  "build": {
    "beforeDevCommand": "bun run dev",
    "devUrl": "http://localhost:1421",
    "beforeBuildCommand": "bun run build",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["android"],
    "icon": [
      "icons/staff-icon.png"
    ],
    "android": {
      "minSdkVersion": 24,
      "versionCode": 1
    }
  },
  "plugins": {
    "sql": {
      "preload": ["sqlite:handsfree_staff.db"]
    }
  }
}
```

### Android Permissions

**Owner App** (needs more permissions):
```xml
<!-- apps/owner-mobile/src-tauri/gen/android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" /> <!-- For QR scanning -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

**Staff App** (minimal permissions):
```xml
<!-- apps/staff-mobile/src-tauri/gen/android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" /> <!-- For WiFi attendance -->
```

---

## 7. Migration Plan

### Phase 1: Setup (Day 1-3)

**Step 1: Create Workspace**
```bash
# Update root package.json for workspaces
# Create apps/ and packages/ directories
mkdir -p apps/{owner-mobile,staff-mobile}
mkdir -p packages/{shared-ui,shared-lib,shared-types,shared-stores,tauri-commands}
```

**Step 2: Extract Shared Packages**
```bash
# Move common code to packages/
# See detailed steps in IMPLEMENTATION_GUIDE.md
```

**Step 3: Create App Scaffolds**
```bash
cd apps/owner-mobile
bun create vite . --template react-ts
bun add @tauri-apps/api @tauri-apps/cli

cargo tauri init
cargo tauri android init
```

### Phase 2: Migrate Owner App (Day 4-10)

**Step 1: Copy Owner Components**
```bash
# Copy all owner-specific pages, components, stores
cp ../../src/pages-v2/SettingsPage.tsx ./src/pages/
cp ../../src/components/admin/* ./src/components/admin/
# ... etc
```

**Step 2: Update Imports**
```bash
# Replace @/ imports with @handsfree/* imports
find ./src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  's|from "@/lib/database"|from "@handsfree/shared-lib/database"|g'
```

**Step 3: Configure Android**
```bash
# Update tauri.conf.json
# Update AndroidManifest.xml
# Set app icons
```

**Step 4: Build & Test**
```bash
bun run build
cargo tauri android build --apk
```

### Phase 3: Migrate Staff App (Day 11-15)

**Step 1: Copy Staff Components**
```bash
# Copy minimal staff components
# Create new simplified pages
```

**Step 2: Remove Owner Features**
```bash
# Ensure no owner code is included
# Verify bundle size is minimal
```

**Step 3: Build & Test**
```bash
bun run build
cargo tauri android build --apk
```

### Phase 4: Testing (Day 16-20)

**Test Owner App**:
- [ ] Settings CRUD works
- [ ] D1 provisioning works
- [ ] Plugin installation works
- [ ] Sales reports load
- [ ] Chain management works
- [ ] Offline mode works
- [ ] Background sync works

**Test Staff App**:
- [ ] Clock in/out works
- [ ] Payroll view loads
- [ ] Advance requests work
- [ ] Schedule view works
- [ ] Offline mode works
- [ ] Background sync works

**Cross-App Testing**:
- [ ] Both apps sync to same D1 database
- [ ] Changes in Owner app reflect in Staff app
- [ ] Attendance from Staff app visible in Owner app

### Phase 5: Deployment (Day 21-25)

**Step 1: Build Release APKs**
```bash
# Owner App
cd apps/owner-mobile
./build-android-variants-fixed.sh owner

# Staff App
cd apps/staff-mobile
./build-android-variants-fixed.sh staff
```

**Step 2: Sign APKs**
```bash
# Use existing keystore
jarsigner -keystore handsfree.keystore owner.apk handsfree
jarsigner -keystore handsfree.keystore staff.apk handsfree
```

**Step 3: Distribute**
- Upload Owner APK to Google Play (or distribute via MDM)
- Upload Staff APK to Google Play
- Send download links to users

---

## 8. Build Scripts

### Root `package.json`
```json
{
  "name": "handsfree-restaurant",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:owner": "bun run --filter '@handsfree/owner-mobile' dev",
    "dev:staff": "bun run --filter '@handsfree/staff-mobile' dev",

    "build:owner": "bun run --filter '@handsfree/owner-mobile' build",
    "build:staff": "bun run --filter '@handsfree/staff-mobile' build",

    "android:owner": "cd apps/owner-mobile && cargo tauri android build --apk",
    "android:staff": "cd apps/staff-mobile && cargo tauri android build --apk",

    "android:both": "bun run android:owner && bun run android:staff"
  }
}
```

### Owner App `package.json`
```json
{
  "name": "@handsfree/owner-mobile",
  "version": "4.0.0",
  "dependencies": {
    "@handsfree/shared-ui": "workspace:*",
    "@handsfree/shared-lib": "workspace:*",
    "@handsfree/shared-types": "workspace:*",
    "@handsfree/shared-stores": "workspace:*",
    "@handsfree/plugin-sdk": "workspace:*",
    "react": "^19.1.0",
    "react-router-dom": "^7.1.1",
    "zustand": "^5.0.8"
  },
  "scripts": {
    "dev": "cargo tauri android dev",
    "build": "vite build",
    "android:build": "cargo tauri android build --apk"
  }
}
```

### Staff App `package.json`
```json
{
  "name": "@handsfree/staff-mobile",
  "version": "4.0.0",
  "dependencies": {
    "@handsfree/shared-ui": "workspace:*",
    "@handsfree/shared-lib": "workspace:*",
    "@handsfree/shared-types": "workspace:*",
    "@handsfree/shared-stores": "workspace:*",
    "react": "^19.1.0",
    "react-router-dom": "^7.1.1",
    "zustand": "^5.0.8"
  },
  "scripts": {
    "dev": "cargo tauri android dev",
    "build": "vite build",
    "android:build": "cargo tauri android build --apk"
  }
}
```

---

## 9. Benefits Summary

### For Owners
- Full-featured app with all management tools
- ~50% smaller APK (30MB vs 60MB)
- Faster updates and better performance

### For Staff
- Extremely lightweight app (12MB vs 55MB)
- Simple, focused UI (only attendance/payroll)
- Faster downloads and updates
- Better security (no owner features)

### For Development Team
- Clear code separation
- Independent release cycles
- Easier to maintain
- Better security isolation

### For Business
- Independent versioning (Owner: v4.x, Staff: v1.x)
- Different update frequencies (Owner: monthly, Staff: bi-weekly)
- Better analytics (separate install tracking)
- Reduced support complexity

---

## 10. Next Steps

Ready to start? Here's the action plan:

**Option 1: Quick POC (Recommended)**
1. Extract shared packages (Day 1-3)
2. Build minimal Staff app first (simpler, Day 4-7)
3. Validate approach with pilot users
4. Then migrate Owner app (Day 8-15)

**Option 2: Full Migration**
1. Follow complete Phase 1-5 plan (25 days)
2. Parallel development (Owner + Staff together)

**Option 3: Incremental**
1. Extract shared packages
2. Keep building new features in monolith
3. Gradually move components to separate apps

Which approach would you prefer?
