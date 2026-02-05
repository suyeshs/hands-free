# Multi-App Architecture Proposal
## Handsfree Restaurant Platform - App Separation Strategy

## Executive Summary

The current monorepo contains POS, Owner, and Staff functionalities in one codebase (~160k lines). This proposal outlines splitting into three separate applications while maintaining shared packages for:
- Independent deployment and scaling
- Better separation of concerns
- Cleaner maintenance boundaries
- Shared Cloudflare/Durable Objects infrastructure
- Offline-first capability with D1 sync when away from restaurant WiFi

---

## Current State Analysis

### Existing Structure
```
restaurant-pos-ai/
├── src/                      # Frontend (React/TypeScript) - 160k+ LOC
│   ├── components/           # UI components (mixed concerns)
│   ├── pages/                # Route pages (mixed concerns)
│   ├── stores/               # Zustand stores (shared state)
│   ├── services/             # Business logic (API, sync, plugins)
│   ├── lib/                  # Utilities
│   └── config/buildConfig.ts # Build-time variant switching
├── src-tauri/                # Rust backend (Tauri commands)
│   ├── commands/             # Tauri commands (mixed concerns)
│   └── database/             # SQLite management
├── packages/
│   └── plugin-sdk/           # Plugin system SDK
└── workers/                  # Cloudflare Workers (shared backend)
    └── plugin-registry/
```

### Current Build Variants
- **Staff Build**: Limited features (attendance, payroll, KDS, POS)
- **Owner Build**: Full features (settings, plugins, chain management, reports)
- Both share same codebase with compile-time feature flags

### Issues with Current Approach
1. **Tight coupling**: All features bundled together
2. **Large bundle size**: Staff app includes unused owner code
3. **Deployment complexity**: Can't deploy apps independently
4. **Scaling limitations**: Can't scale apps differently
5. **Security concerns**: Staff builds contain owner code paths
6. **Maintenance overhead**: Changes risk breaking multiple variants

---

## Proposed Architecture

### 1. Monorepo Structure (Bun Workspaces)

```
handsfree-restaurant/
│
├── apps/
│   ├── owner/                    # Owner Dashboard App
│   │   ├── src/
│   │   │   ├── pages/            # Owner-specific pages
│   │   │   │   ├── SettingsPage.tsx
│   │   │   │   ├── ChainManagement.tsx
│   │   │   │   ├── PluginsPage.tsx
│   │   │   │   ├── SalesReports.tsx
│   │   │   │   └── UserManagement.tsx
│   │   │   ├── components/       # Owner-specific components
│   │   │   │   ├── CloudSyncSettings/
│   │   │   │   ├── D1ProvisionButton/
│   │   │   │   ├── ChainLocationManager/
│   │   │   │   └── PluginStore/
│   │   │   └── stores/           # Owner-specific stores
│   │   │       ├── chainConfigStore.ts
│   │   │       ├── provisioningStore.ts
│   │   │       └── settingsStore.ts
│   │   ├── src-tauri/            # Owner Tauri backend
│   │   │   ├── commands/
│   │   │   │   ├── settings.rs
│   │   │   │   ├── d1_provision.rs
│   │   │   │   ├── wizard.rs
│   │   │   │   └── tenant.rs
│   │   │   └── tauri.conf.json
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── staff/                    # Staff Self-Service App
│   │   ├── src/
│   │   │   ├── pages/            # Staff-specific pages
│   │   │   │   ├── AttendancePage.tsx
│   │   │   │   ├── PayrollPage.tsx
│   │   │   │   ├── AdvancesPage.tsx
│   │   │   │   └── HubPage.tsx
│   │   │   ├── components/       # Staff-specific components
│   │   │   │   ├── ClockInOutWidget/
│   │   │   │   ├── PayrollSummary/
│   │   │   │   └── AdvanceRequest/
│   │   │   └── stores/           # Staff-specific stores
│   │   │       ├── attendanceStore.ts
│   │   │       └── payrollStore.ts
│   │   ├── src-tauri/            # Staff Tauri backend
│   │   │   ├── commands/
│   │   │   │   ├── attendance.rs
│   │   │   │   └── payroll.rs
│   │   │   └── tauri.conf.json
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── pos/                      # Point of Sale / Kitchen Apps
│       ├── src/
│       │   ├── pages/            # POS-specific pages
│       │   │   ├── POSPage.tsx
│       │   │   ├── KDSPage.tsx
│       │   │   ├── BDSPage.tsx
│       │   │   ├── TableOrderPage.tsx
│       │   │   └── FloorPlanPage.tsx
│       │   ├── components/       # POS-specific components
│       │   │   ├── Cart/
│       │   │   ├── KDS/
│       │   │   ├── BDS/
│       │   │   ├── FloorPlan/
│       │   │   └── TableSelector/
│       │   └── stores/           # POS-specific stores
│       │       ├── posStore.ts
│       │       ├── cartStore.ts
│       │       └── orderStore.ts
│       ├── src-tauri/            # POS Tauri backend
│       │   ├── commands/
│       │   │   ├── pos.rs
│       │   │   ├── orders.rs
│       │   │   ├── printer.rs
│       │   │   └── table_tokens.rs
│       │   └── tauri.conf.json
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   ├── shared-ui/                # Shared UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/           # shadcn/ui components
│   │   │   │   ├── NetworkStatusIndicator.tsx
│   │   │   │   ├── WebSocketManager.tsx
│   │   │   │   └── TrainingModeToggle.tsx
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── shared-lib/               # Shared utilities
│   │   ├── src/
│   │   │   ├── database.ts       # Database helpers
│   │   │   ├── utils.ts          # Common utilities
│   │   │   ├── sync/             # Sync services
│   │   │   │   ├── D1SyncService.ts
│   │   │   │   ├── TieredSyncManager.ts
│   │   │   │   └── InitialD1Sync.ts
│   │   │   ├── r2Uploader.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── shared-types/             # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── database.ts       # Database types
│   │   │   ├── api.ts            # API types
│   │   │   ├── tenant.ts         # Tenant types
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── shared-stores/            # Shared Zustand stores
│   │   ├── src/
│   │   │   ├── tenantStore.ts    # Tenant config (shared)
│   │   │   ├── deviceStore.ts    # Device settings (shared)
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── tauri-commands/           # Shared Tauri Rust commands
│   │   ├── src/
│   │   │   ├── database/         # Database operations
│   │   │   ├── network/          # Network operations
│   │   │   ├── storage/          # Secure storage
│   │   │   ├── utils/            # Utilities
│   │   │   └── lib.rs
│   │   ├── Cargo.toml
│   │   └── package.json
│   │
│   └── plugin-sdk/               # Plugin system SDK (existing)
│       ├── src/
│       └── package.json
│
├── workers/                      # Cloudflare Workers (shared backend)
│   ├── tenant-router/            # Multi-tenant routing
│   ├── domain-service/           # Domain operations
│   ├── restaurant-provisioning/  # Provisioning service
│   ├── plugin-registry/          # Plugin management
│   └── durable-objects/          # Durable Objects for state
│       ├── OrderCoordinator.ts   # Real-time order sync
│       ├── KitchenSync.ts        # Kitchen display sync
│       └── TenantSession.ts      # Tenant session management
│
├── global/                       # Global plugins (WASM)
│   └── plugins/
│
├── scripts/                      # Build and deployment scripts
│   ├── build-all.sh
│   ├── deploy-owner.sh
│   ├── deploy-staff.sh
│   └── deploy-pos.sh
│
├── package.json                  # Root workspace config
├── bun.lockb
└── README.md
```

---

## 2. App Responsibilities

### Owner App (Owner/Manager Dashboard)
**Users**: Restaurant owners, managers, administrators

**Features**:
- Restaurant settings & configuration
- Chain/multi-location management
- Cloud sync & D1 provisioning
- Plugin management & installation
- Menu management & pricing
- Inventory management
- Sales reports & analytics
- Staff scheduling & roster
- User/role management
- Aggregator integrations (Swiggy, Zomato)
- Image/asset management

**Bundle Size**: ~500KB (gzipped)
**Platforms**: Desktop (Windows/Mac/Linux), Web (PWA)

---

### Staff App (Employee Self-Service)
**Users**: Restaurant staff (servers, cooks, helpers)

**Features**:
- Clock in/out (attendance tracking)
- View payroll & tips
- Request salary advances
- View work schedule
- Submit leave requests
- Personal dashboard

**Bundle Size**: ~200KB (gzipped) - minimal, fast
**Platforms**: Android (primary), iOS, Web (PWA)

---

### POS App (Point of Sale & Kitchen)
**Users**: Servers, kitchen staff, bar staff, aggregator operators

**Features**:
- Point of Sale (POS) - order taking, checkout
- Kitchen Display System (KDS)
- Bar Display System (BDS)
- Table ordering & floor plan
- Phone order entry
- Aggregator order management
- Print service (KOT, bills, labels)
- Real-time order sync (WebSocket/Durable Objects)
- Offline mode with local SQLite

**Bundle Size**: ~600KB (gzipped)
**Platforms**: Android (tablets), Windows (desktop), Web (kiosk mode)

---

## 3. Shared Infrastructure

### Cloudflare Workers (Backend)
All three apps connect to the same Cloudflare infrastructure:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Owner App  │  │  Staff App  │  │   POS App   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
            ┌─────────────────────┐
            │  Tenant Router      │ (Routes by domain/activation code)
            │  (Cloudflare Worker)│
            └──────────┬──────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Domain  │   │ Provisio│   │ Plugin  │
   │ Service │   │  ning   │   │ Registry│
   └────┬────┘   └────┬────┘   └────┬────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
         ┌──────────────────────────┐
         │   Durable Objects        │
         │  (Real-time State)       │
         ├──────────────────────────┤
         │ • OrderCoordinator       │
         │ • KitchenSync            │
         │ • TenantSession          │
         │ • TableOrdering          │
         └──────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │   D1   │  │   R2   │  │   KV   │
    │Database│  │ Storage│  │  Cache │
    └────────┘  └────────┘  └────────┘
```

### Data Sync Strategy

**Online (Restaurant WiFi)**:
- Direct WebSocket to Durable Objects
- Real-time sync via Workers
- Immediate consistency

**Offline (Away from Restaurant)**:
- Local SQLite database
- D1 sync when reconnected
- Background sync queue
- Conflict resolution via timestamps

### Authentication & Authorization
- Single JWT-based auth system
- Role-based access control (RBAC)
- Activation codes for tenant linking
- Shared across all apps

---

## 4. Shared Packages

### `@handsfree/shared-ui`
- **Purpose**: Common UI components
- **Exports**: shadcn/ui components, NetworkStatusIndicator, WebSocketManager
- **Used by**: All apps
- **Size**: ~150KB

### `@handsfree/shared-lib`
- **Purpose**: Business logic and utilities
- **Exports**: Database helpers, sync services, R2 uploader, utils
- **Used by**: All apps
- **Size**: ~200KB

### `@handsfree/shared-types`
- **Purpose**: TypeScript type definitions
- **Exports**: Database types, API types, tenant types
- **Used by**: All apps
- **Size**: ~10KB (types only)

### `@handsfree/shared-stores`
- **Purpose**: Shared Zustand stores
- **Exports**: tenantStore, deviceStore, restaurantSettingsStore
- **Used by**: All apps
- **Size**: ~30KB

### `@handsfree/tauri-commands`
- **Purpose**: Shared Tauri Rust commands
- **Exports**: Database operations, network, storage, utils
- **Used by**: All Tauri apps (as Rust crate)
- **Size**: ~500KB (compiled)

### `@handsfree/plugin-sdk`
- **Purpose**: Plugin development SDK (existing)
- **Exports**: Plugin types, runtime, utilities
- **Used by**: Owner app (plugin management), POS app (plugin execution)
- **Size**: ~50KB

---

## 5. Migration Strategy

### Phase 1: Package Extraction (Week 1-2)
1. Create `packages/shared-ui` and move common components
2. Create `packages/shared-lib` and move utilities
3. Create `packages/shared-types` and move types
4. Create `packages/shared-stores` and move shared stores
5. Create `packages/tauri-commands` and move Rust code
6. Update imports in existing codebase to use packages
7. Verify existing app still works

### Phase 2: App Scaffolding (Week 3)
1. Create `apps/owner`, `apps/staff`, `apps/pos` directories
2. Copy Tauri configs and customize (identifiers, permissions)
3. Set up Vite configs for each app
4. Create minimal entry points (App.tsx, main.tsx)
5. Set up routing structure for each app

### Phase 3: Code Migration (Week 4-6)
1. **Owner App**:
   - Move settings, chain, plugin, inventory, reports pages
   - Move admin components
   - Move provisioning, chain, settings stores
   - Move Tauri commands: settings, d1_provision, wizard, tenant
2. **Staff App**:
   - Move attendance, payroll, advances pages
   - Move staff-specific components
   - Move attendance, payroll stores
   - Move Tauri commands: attendance
3. **POS App**:
   - Move POS, KDS, BDS, table order pages
   - Move cart, kitchen, floor components
   - Move POS, cart, order stores
   - Move Tauri commands: pos, orders, printer, table_tokens

### Phase 4: Shared Backend Verification (Week 7)
1. Test all three apps against Cloudflare Workers
2. Verify D1 sync works from all apps
3. Test Durable Objects connectivity
4. Verify plugin system works (Owner installs, POS executes)
5. Test offline mode for each app

### Phase 5: Build & Deployment Automation (Week 8)
1. Create build scripts for each app
2. Set up CI/CD pipelines (GitHub Actions)
3. Configure separate deployments:
   - Owner: Desktop installers + Web PWA
   - Staff: Android APK + iOS + Web PWA
   - POS: Android APK + Windows installer + Web kiosk
4. Test independent deployments

### Phase 6: Testing & Optimization (Week 9-10)
1. Bundle size optimization for each app
2. Performance testing
3. Cross-app integration testing
4. User acceptance testing
5. Documentation updates

---

## 6. Benefits

### Technical Benefits
- **Independent Scaling**: Deploy and scale each app separately
- **Smaller Bundle Sizes**: Staff app ~200KB vs current 800KB+
- **Faster Builds**: Build only what changed
- **Better Security**: Staff app doesn't include owner code paths
- **Cleaner Code**: Clear boundaries between concerns
- **Easier Testing**: Test apps in isolation

### Business Benefits
- **Faster Releases**: Deploy Staff app updates without touching Owner/POS
- **Better User Experience**: Lightweight staff app for mobile
- **Reduced Costs**: Smaller bundles = less bandwidth
- **Independent Versioning**: Apps can have different release cycles
- **Easier Onboarding**: New developers can focus on one app

### Operational Benefits
- **Shared Infrastructure**: All apps use same Cloudflare backend
- **Consistent Data**: D1 sync ensures consistency across apps
- **Offline Support**: Each app can work offline with local SQLite
- **Plugin Ecosystem**: Plugins work across apps seamlessly

---

## 7. Deployment Architecture

### Owner App Deployment
- **Desktop**: Tauri native (Windows .msi, Mac .dmg, Linux .deb)
- **Web**: Cloudflare Pages (PWA)
- **Target Users**: Owners at home/office
- **Update Frequency**: Monthly

### Staff App Deployment
- **Mobile**: Android APK (Google Play), iOS (App Store)
- **Web**: Cloudflare Pages (PWA fallback)
- **Target Users**: Staff on personal phones
- **Update Frequency**: Bi-weekly

### POS App Deployment
- **Tablets**: Android APK (sideloaded to restaurant tablets)
- **Desktop**: Tauri native (Windows for front desk)
- **Web**: Cloudflare Pages (kiosk mode)
- **Target Users**: Restaurant terminals
- **Update Frequency**: Weekly

---

## 8. Workspace Configuration Examples

### Root `package.json`
```json
{
  "name": "handsfree-restaurant",
  "version": "4.0.0",
  "workspaces": [
    "apps/*",
    "packages/*",
    "workers/*"
  ],
  "scripts": {
    "dev": "bun run --filter './apps/*' dev",
    "dev:owner": "bun run --filter '@handsfree/owner' dev",
    "dev:staff": "bun run --filter '@handsfree/staff' dev",
    "dev:pos": "bun run --filter '@handsfree/pos' dev",
    "build": "bun run build:packages && bun run build:apps",
    "build:packages": "bun run --filter './packages/*' build",
    "build:apps": "bun run --filter './apps/*' build",
    "build:owner": "bun run --filter '@handsfree/owner' build",
    "build:staff": "bun run --filter '@handsfree/staff' build",
    "build:pos": "bun run --filter '@handsfree/pos' build"
  }
}
```

### App `package.json` Example
```json
{
  "name": "@handsfree/staff",
  "version": "4.0.0",
  "dependencies": {
    "@handsfree/shared-ui": "workspace:*",
    "@handsfree/shared-lib": "workspace:*",
    "@handsfree/shared-types": "workspace:*",
    "@handsfree/shared-stores": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  }
}
```

---

## Conclusion

This multi-app architecture provides clear separation of concerns while maintaining shared infrastructure. The phased migration approach minimizes risk and allows for continuous operation during the transition. All apps will continue to share the same Cloudflare Workers, Durable Objects, and D1 database, ensuring data consistency and offline capabilities.

**Recommendation**: Proceed with Phase 1 (Package Extraction) as a proof of concept to validate the approach.
