# App Dependency Mapping
## Component & Module Distribution Across Apps

This document maps the current codebase components to their target apps in the multi-app architecture.

---

## Legend
- **Owner**: Owner/Manager Dashboard App
- **Staff**: Staff Self-Service App
- **POS**: Point of Sale/Kitchen App
- **Shared**: Shared packages (used by multiple apps)

---

## Frontend Components (`src/components/`)

### `admin/` - **Owner Only**
```
CloudSyncSettings.tsx         → Owner
D1ProvisionButton.tsx         → Owner
DeviceSettings.tsx            → Owner
LANDevicesPanel.tsx           → Owner
MenuUploadSession.tsx         → Owner
PrinterSettingsInline.tsx     → Owner
RestaurantSettingsInline.tsx  → Owner
ChainLocationManager.tsx      → Owner
VisionAISettings.tsx          → Owner
WiFiAttendanceSettings.tsx    → Owner
```

### `aggregator/` - **POS Only**
```
AggregatorDashboard.tsx       → POS
OrderCard.tsx                 → POS
OrderDetails.tsx              → POS
```

### `alerts/` - **Shared**
```
AlertsPanel.tsx               → @handsfree/shared-ui
```

### `analytics/` - **Owner Only**
```
ReportsPanel.tsx              → Owner
SalesChart.tsx                → Owner
```

### `attendance/` - **Staff + Owner**
```
ClockInOutWidget.tsx          → Staff (primary) + Owner (view)
AttendanceHistory.tsx         → Staff
AttendanceReport.tsx          → Owner
```

### `auth/` - **Shared**
```
LoginForm.tsx                 → @handsfree/shared-ui
ProtectedRoute.tsx            → @handsfree/shared-ui
```

### `bds/` - **POS Only**
```
BDSDisplay.tsx                → POS
BeverageOrderCard.tsx         → POS
```

### `cart/` - **POS Only**
```
Cart.tsx                      → POS
CartItem.tsx                  → POS
CheckoutButton.tsx            → POS
```

### `floor/` - **POS Only**
```
FloorPlan.tsx                 → POS
TableLayout.tsx               → POS
```

### `home/` - **Mixed**
```
CloudSyncBanner.tsx           → Owner
D1StatusCard.tsx              → Owner
DashboardCard.tsx             → Shared (different cards per app)
ProvisioningStatusPill.tsx    → Owner
FirstTimeSetupWalkthrough.tsx → Owner
```

### `inventory/` - **Owner Only**
```
InventoryList.tsx             → Owner
StockManagement.tsx           → Owner
```

### `kds/` - **POS Only**
```
KDSDisplay.tsx                → POS
OrderQueue.tsx                → POS
OrderTicket.tsx               → POS
```

### `plugins/` - **Owner + POS**
```
PluginStore.tsx               → Owner (install/manage)
PluginUpdateNotification.tsx  → Owner
PluginUninstallModal.tsx      → Owner
PluginRuntime.tsx             → POS (execute)
```

### `pos/` - **POS Only**
```
POSDashboard.tsx              → POS
MenuGrid.tsx                  → POS
CategoryTabs.tsx              → POS
TableSelectorModal.tsx        → POS
```

### `provisioning/` - **Owner Only**
```
TrainingModeToggle.tsx        → Owner
TenantActivation.tsx          → Owner
```

### `settings/` - **Owner Only**
```
ActivationCodeCard.tsx        → Owner
RestaurantDetailsForm.tsx     → Owner
```

### `setup/` - **Owner Only**
```
cards/RestaurantBasicsCard.tsx    → Owner
screens/RestaurantBasicsScreen.tsx → Owner
screens/TrainingModeScreen.tsx     → Owner
```

### `staff/` - **Staff Only**
```
PayrollSummary.tsx            → Staff
AdvanceRequest.tsx            → Staff
LeaveRequest.tsx              → Staff
```

### `ui/` - **Shared**
```
button.tsx                    → @handsfree/shared-ui
card.tsx                      → @handsfree/shared-ui
dialog.tsx                    → @handsfree/shared-ui
input.tsx                     → @handsfree/shared-ui
... (all shadcn components)   → @handsfree/shared-ui
```

### Root Components - **Shared**
```
NetworkStatusIndicator.tsx    → @handsfree/shared-ui
WebSocketManager.tsx          → @handsfree/shared-ui
```

---

## Pages (`src/pages/` and `src/pages-v2/`)

### Owner-Only Pages
```
SettingsPage.tsx              → Owner
SettingsApp.tsx               → Owner
ChainManagementPage.tsx       → Owner
ChainSalesDashboard.tsx       → Owner
ImageManagement.tsx           → Owner
InventoryDashboard.tsx        → Owner
DailySalesReport.tsx          → Owner
TenantActivation.tsx          → Owner
```

### Staff-Only Pages
```
AttendancePage.tsx            → Staff (create)
PayrollPage.tsx               → Staff (create)
AdvancesPage.tsx              → Staff (create)
```

### POS-Only Pages
```
POSDashboard.tsx              → POS
KDSPage.tsx                   → POS (create)
BDSPage.tsx                   → POS (create)
TableOrderPage.tsx            → POS (create)
AggregatorPage.tsx            → POS (create)
CameraFeedPage.tsx            → POS (create)
```

### Shared Pages
```
HubPage.tsx                   → All apps (different content per app)
LoginPage.tsx                 → @handsfree/shared-ui
```

---

## Stores (`src/stores/`)

### Owner-Only Stores
```
chainConfigStore.ts           → Owner
chainStore.ts                 → Owner
provisioningStore.ts          → Owner
setupWizardStore.ts           → Owner
restaurantSettingsStore.ts    → Owner (but types shared)
dailySalesStore.ts            → Owner
multiLocationStore.ts         → Owner
```

### Staff-Only Stores
```
attendanceStore.ts            → Staff
payrollStore.ts               → Staff (create)
```

### POS-Only Stores
```
posStore.ts                   → POS
cartStore.ts                  → POS (extract from posStore)
orderStore.ts                 → POS (extract from posStore)
```

### Shared Stores
```
tenantStore.ts                → @handsfree/shared-stores
deviceStore.ts                → @handsfree/shared-stores
authStore.ts                  → @handsfree/shared-stores (create)
```

---

## Services (`src/services/`)

### Owner-Only Services
```
d1Provision.ts                → Owner
d1ProvisioningService.ts      → Owner
sync/InitialD1Sync.ts         → Owner
multiLocationSyncService.ts   → Owner
```

### POS-Only Services
```
plugins/pluginManager.ts      → POS (execution) + Owner (management)
plugins/pluginRegistry.ts     → POS
reCameraDetectionService.ts   → POS
reCameraDiscoveryService.ts   → POS
backgroundOperationsCoordinator.ts → POS
```

### Shared Services
```
sync/D1SyncService.ts         → @handsfree/shared-lib
sync/TieredSyncManager.ts     → @handsfree/shared-lib
orderSyncService.ts           → @handsfree/shared-lib
salesTransactionService.ts    → @handsfree/shared-lib
multiLocationWebSocketManager.ts → @handsfree/shared-lib
```

---

## Lib (`src/lib/`)

### Shared Utilities
```
database.ts                   → @handsfree/shared-lib
utils.ts                      → @handsfree/shared-lib
r2Uploader.ts                 → @handsfree/shared-lib
storeSynchronization.ts       → @handsfree/shared-lib
databasePath.ts               → @handsfree/shared-lib
cityStateMapping.ts           → @handsfree/shared-lib
getActivationCode.ts          → @handsfree/shared-lib
```

### POS-Only Utilities
```
kotDiagnostic.ts              → POS
kdsDebugUtils.ts              → POS
```

### Owner-Only Utilities
```
pluginSettingsMap.tsx         → Owner
```

---

## Tauri Commands (`src-tauri/src/commands/`)

### Owner-Only Commands
```
settings.rs                   → Owner
d1_provision.rs               → Owner
wizard.rs                     → Owner
tenant.rs                     → Owner
device_settings.rs            → Owner
```

### Staff-Only Commands
```
attendance.rs                 → Staff (keep) + Owner (keep for viewing)
payroll.rs                    → Staff (create) + Owner (create for management)
```

### POS-Only Commands
```
pos.rs                        → POS (create from existing)
orders.rs                     → POS (create from existing)
printer.rs                    → POS (extract from print_service)
table_tokens.rs               → POS
recamera.rs                   → POS
```

### Shared Commands
```
database/mod.rs               → @handsfree/tauri-commands
network/mod.rs                → @handsfree/tauri-commands
storage/mod.rs                → @handsfree/tauri-commands
utils/mod.rs                  → @handsfree/tauri-commands
lan_sync/                     → @handsfree/tauri-commands
```

---

## Types (`src/types/` and `src/vite-env.d.ts`)

All types should move to `@handsfree/shared-types`:
```
database.ts                   → @handsfree/shared-types
api.ts                        → @handsfree/shared-types
tenant.ts                     → @handsfree/shared-types
plugin.ts                     → @handsfree/shared-types
```

---

## Workers (Shared Backend)

### All Workers Remain Shared
```
workers/tenant-router/        → Shared (routes all apps)
workers/domain-service/       → Shared (serves all apps)
workers/restaurant-provisioning/ → Shared (used by Owner)
workers/plugin-registry/      → Shared (used by Owner + POS)
```

**Note**: Workers are already multi-tenant and app-agnostic. No changes needed.

---

## Migration Checklist by Component

### Phase 1: Extract Shared Packages

#### `@handsfree/shared-ui`
- [ ] Move `src/components/ui/*` (shadcn components)
- [ ] Move `src/components/NetworkStatusIndicator.tsx`
- [ ] Move `src/components/WebSocketManager.tsx`
- [ ] Move `src/components/alerts/AlertsPanel.tsx`
- [ ] Move `src/components/auth/*`
- [ ] Create `package.json` with React dependencies
- [ ] Set up build config (Vite library mode)

#### `@handsfree/shared-lib`
- [ ] Move `src/lib/database.ts`
- [ ] Move `src/lib/utils.ts`
- [ ] Move `src/lib/r2Uploader.ts`
- [ ] Move `src/lib/storeSynchronization.ts`
- [ ] Move `src/services/sync/*`
- [ ] Move `src/services/orderSyncService.ts`
- [ ] Move `src/services/salesTransactionService.ts`
- [ ] Create `package.json`
- [ ] Set up build config

#### `@handsfree/shared-types`
- [ ] Move `src/types/*`
- [ ] Move relevant type definitions from stores
- [ ] Create `package.json` (types only, no dependencies)
- [ ] Set up TypeScript config

#### `@handsfree/shared-stores`
- [ ] Move `src/stores/tenantStore.ts`
- [ ] Move `src/stores/deviceStore.ts`
- [ ] Create `src/stores/authStore.ts` (extract from mixed stores)
- [ ] Create `package.json` with Zustand dependency
- [ ] Set up build config

#### `@handsfree/tauri-commands`
- [ ] Move `src-tauri/src/database/`
- [ ] Move `src-tauri/src/network/`
- [ ] Move `src-tauri/src/storage/`
- [ ] Move `src-tauri/src/utils/`
- [ ] Move `src-tauri/src/lan_sync/`
- [ ] Create `Cargo.toml` for shared Rust crate
- [ ] Update dependencies

---

### Phase 2: Create App Scaffolds

#### Owner App
- [ ] Create `apps/owner/` directory
- [ ] Create `apps/owner/package.json` with shared package dependencies
- [ ] Create `apps/owner/vite.config.ts`
- [ ] Create `apps/owner/src-tauri/tauri.conf.json` (identifier: `com.stonepot-tech.handsfree.owner`)
- [ ] Create minimal `apps/owner/src/App.tsx`
- [ ] Create routing structure

#### Staff App
- [ ] Create `apps/staff/` directory
- [ ] Create `apps/staff/package.json` with shared package dependencies
- [ ] Create `apps/staff/vite.config.ts`
- [ ] Create `apps/staff/src-tauri/tauri.conf.json` (identifier: `com.stonepot-tech.handsfree.staff`)
- [ ] Create minimal `apps/staff/src/App.tsx`
- [ ] Create routing structure

#### POS App
- [ ] Create `apps/pos/` directory
- [ ] Create `apps/pos/package.json` with shared package dependencies
- [ ] Create `apps/pos/vite.config.ts`
- [ ] Create `apps/pos/src-tauri/tauri.conf.json` (identifier: `com.stonepot-tech.handsfree.pos`)
- [ ] Create minimal `apps/pos/src/App.tsx`
- [ ] Create routing structure

---

### Phase 3: Migrate Components

#### Owner App Migration
- [ ] Move admin components
- [ ] Move settings components
- [ ] Move provisioning components
- [ ] Move analytics components
- [ ] Move inventory components
- [ ] Move plugin management components
- [ ] Move chain management components
- [ ] Move Owner pages
- [ ] Move Owner stores
- [ ] Move Owner Tauri commands

#### Staff App Migration
- [ ] Move attendance components (staff-facing)
- [ ] Move payroll components
- [ ] Move advance request components
- [ ] Create Staff pages
- [ ] Move Staff stores
- [ ] Keep necessary Tauri commands

#### POS App Migration
- [ ] Move POS components
- [ ] Move KDS components
- [ ] Move BDS components
- [ ] Move floor plan components
- [ ] Move cart components
- [ ] Move aggregator components
- [ ] Move POS pages
- [ ] Move POS stores
- [ ] Create POS Tauri commands

---

## Bundle Size Projections

### Current Monolith
- **Total Bundle**: ~1.2MB (minified), ~800KB (gzipped)
- **Contains**: Everything
- **Used by**: All users (wasteful)

### After Split

#### Owner App
- **Bundle Size**: ~500KB (gzipped)
- **Includes**: Admin UI, Settings, Reports, Plugins, Chain Management
- **Shared Packages**: ~400KB (cached)
- **Total First Load**: ~900KB (with cache: ~500KB)

#### Staff App
- **Bundle Size**: ~200KB (gzipped)
- **Includes**: Attendance, Payroll, Advances
- **Shared Packages**: ~400KB (cached)
- **Total First Load**: ~600KB (with cache: ~200KB)
- **Savings**: 75% reduction vs monolith

#### POS App
- **Bundle Size**: ~600KB (gzipped)
- **Includes**: POS, KDS, BDS, Floor Plan, Cart
- **Shared Packages**: ~400KB (cached)
- **Total First Load**: ~1000KB (with cache: ~600KB)
- **Savings**: 25% reduction vs monolith

**Total Bandwidth Savings**: ~60% for staff, ~30% for POS, ~40% for owner

---

## Dependency Graph

```
┌─────────────────┐
│   Owner App     │
│  (~500KB gz)    │
└────────┬────────┘
         │
         ├─────> @handsfree/shared-ui (~150KB)
         ├─────> @handsfree/shared-lib (~200KB)
         ├─────> @handsfree/shared-types (~10KB)
         ├─────> @handsfree/shared-stores (~30KB)
         ├─────> @handsfree/plugin-sdk (~50KB)
         └─────> @handsfree/tauri-commands (Rust)

┌─────────────────┐
│   Staff App     │
│  (~200KB gz)    │
└────────┬────────┘
         │
         ├─────> @handsfree/shared-ui (~150KB)
         ├─────> @handsfree/shared-lib (~200KB)
         ├─────> @handsfree/shared-types (~10KB)
         ├─────> @handsfree/shared-stores (~30KB)
         └─────> @handsfree/tauri-commands (Rust)

┌─────────────────┐
│    POS App      │
│  (~600KB gz)    │
└────────┬────────┘
         │
         ├─────> @handsfree/shared-ui (~150KB)
         ├─────> @handsfree/shared-lib (~200KB)
         ├─────> @handsfree/shared-types (~10KB)
         ├─────> @handsfree/shared-stores (~30KB)
         ├─────> @handsfree/plugin-sdk (~50KB)
         └─────> @handsfree/tauri-commands (Rust)

All apps connect to:
┌─────────────────────────┐
│  Cloudflare Workers     │
│  (Shared Backend)       │
├─────────────────────────┤
│ • tenant-router         │
│ • domain-service        │
│ • provisioning          │
│ • plugin-registry       │
│ • Durable Objects       │
│   - OrderCoordinator    │
│   - KitchenSync         │
│   - TenantSession       │
└─────────────────────────┘
```

---

## Next Steps

1. Review this dependency mapping for accuracy
2. Identify any missed components or misclassifications
3. Proceed with Phase 1 (Package Extraction) as POC
4. Validate approach with minimal working example
5. Execute full migration plan

---

## Notes

- **Shared packages** are cached by browsers, so after first load, subsequent apps load faster
- **Plugin SDK** is only needed by Owner (management) and POS (execution), not Staff
- **Tauri commands** crate is compiled into each app binary, but shared source reduces duplication
- **Workers** remain completely shared - no changes needed to backend infrastructure
