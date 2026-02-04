# Multi-App Architecture - Step-by-Step Implementation Guide

This guide provides detailed, actionable steps to migrate from the current monolith to a multi-app architecture.

---

## Prerequisites

- [x] Bun installed (for workspaces)
- [x] Tauri CLI installed
- [x] Git branch created: `feature/multi-app-architecture`
- [ ] All tests passing in current monolith
- [ ] Backup/snapshot of current working state

---

## Phase 1: Setup Workspace Structure (Day 1-2)

### Step 1.1: Create Root Workspace Config

```bash
# Update root package.json to enable workspaces
```

**File: `package.json`** (update)
```json
{
  "name": "handsfree-restaurant",
  "version": "4.0.0",
  "private": true,
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
    "build:packages": "bun run --filter './packages/*' build",
    "build:apps": "bun run --filter './apps/*' build",
    "build": "bun run build:packages && bun run build:apps"
  }
}
```

### Step 1.2: Create Directory Structure

```bash
# Create directory structure
mkdir -p apps/{owner,staff,pos}
mkdir -p packages/{shared-ui,shared-lib,shared-types,shared-stores,tauri-commands}

# Keep existing packages
# packages/plugin-sdk already exists

# Workers already exist
# workers/ already exists
```

---

## Phase 2: Extract Shared Packages (Day 3-7)

### Step 2.1: Create `@handsfree/shared-types`

```bash
cd packages/shared-types
```

**File: `packages/shared-types/package.json`**
```json
{
  "name": "@handsfree/shared-types",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./database": "./src/database.ts",
    "./api": "./src/api.ts",
    "./tenant": "./src/tenant.ts"
  }
}
```

**File: `packages/shared-types/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Move Types:**
```bash
# Copy type definitions
cp ../../src/types/* ./src/

# Create index.ts
cat > ./src/index.ts << 'EOF'
export * from './database';
export * from './api';
export * from './tenant';
export * from './plugin';
EOF
```

### Step 2.2: Create `@handsfree/shared-lib`

```bash
cd packages/shared-lib
```

**File: `packages/shared-lib/package.json`**
```json
{
  "name": "@handsfree/shared-lib",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./database": "./src/database.ts",
    "./utils": "./src/utils.ts",
    "./sync": "./src/sync/index.ts"
  },
  "dependencies": {
    "@handsfree/shared-types": "workspace:*",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-sql": "^2.3.1",
    "date-fns": "^4.1.0"
  },
  "scripts": {
    "build": "tsc",
    "type": "tsc --noEmit"
  }
}
```

**File: `packages/shared-lib/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared-types" }
  ]
}
```

**Move Files:**
```bash
mkdir -p src/sync

# Move utilities
cp ../../src/lib/database.ts ./src/
cp ../../src/lib/utils.ts ./src/
cp ../../src/lib/r2Uploader.ts ./src/
cp ../../src/lib/storeSynchronization.ts ./src/

# Move sync services
cp ../../src/services/sync/D1SyncService.ts ./src/sync/
cp ../../src/services/sync/TieredSyncManager.ts ./src/sync/
cp ../../src/services/orderSyncService.ts ./src/sync/
cp ../../src/services/salesTransactionService.ts ./src/sync/

# Create index
cat > ./src/index.ts << 'EOF'
export * from './database';
export * from './utils';
export * from './r2Uploader';
export * from './storeSynchronization';
EOF

cat > ./src/sync/index.ts << 'EOF'
export * from './D1SyncService';
export * from './TieredSyncManager';
export * from './orderSyncService';
export * from './salesTransactionService';
EOF
```

### Step 2.3: Create `@handsfree/shared-ui`

```bash
cd packages/shared-ui
```

**File: `packages/shared-ui/package.json`**
```json
{
  "name": "@handsfree/shared-ui",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./components": "./src/components/index.ts"
  },
  "dependencies": {
    "@handsfree/shared-types": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "lucide-react": "^0.554.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.4.0"
  },
  "peerDependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "scripts": {
    "build": "tsc",
    "type": "tsc --noEmit"
  }
}
```

**Move Files:**
```bash
mkdir -p src/components

# Move UI components
cp -r ../../src/components/ui ./src/components/

# Move shared components
cp ../../src/components/NetworkStatusIndicator.tsx ./src/components/
cp ../../src/components/WebSocketManager.tsx ./src/components/

# Move auth components
cp -r ../../src/components/auth ./src/components/

# Create index
cat > ./src/components/index.ts << 'EOF'
export * from './ui';
export * from './NetworkStatusIndicator';
export * from './WebSocketManager';
export * from './auth';
EOF

cat > ./src/index.ts << 'EOF'
export * from './components';
EOF
```

### Step 2.4: Create `@handsfree/shared-stores`

```bash
cd packages/shared-stores
```

**File: `packages/shared-stores/package.json`**
```json
{
  "name": "@handsfree/shared-stores",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@handsfree/shared-types": "workspace:*",
    "zustand": "^5.0.8"
  },
  "scripts": {
    "build": "tsc",
    "type": "tsc --noEmit"
  }
}
```

**Move Files:**
```bash
# Move shared stores
cp ../../src/stores/tenantStore.ts ./src/
cp ../../src/stores/deviceStore.ts ./src/

# Create index
cat > ./src/index.ts << 'EOF'
export * from './tenantStore';
export * from './deviceStore';
EOF
```

### Step 2.5: Create `@handsfree/tauri-commands`

```bash
cd packages/tauri-commands
```

**File: `packages/tauri-commands/Cargo.toml`**
```toml
[package]
name = "handsfree-tauri-commands"
version = "1.0.0"
edition = "2021"

[dependencies]
tauri = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio"] }

[lib]
name = "handsfree_tauri_commands"
crate-type = ["lib"]
```

**Move Files:**
```bash
mkdir -p src

# Move shared Rust code
cp -r ../../src-tauri/src/database ./src/
cp -r ../../src-tauri/src/network ./src/
cp -r ../../src-tauri/src/storage ./src/
cp -r ../../src-tauri/src/utils ./src/
cp -r ../../src-tauri/src/lan_sync ./src/

# Create lib.rs
cat > ./src/lib.rs << 'EOF'
pub mod database;
pub mod network;
pub mod storage;
pub mod utils;
pub mod lan_sync;
EOF
```

### Step 2.6: Update Root Workspace Lock

```bash
cd ../..
bun install
```

**Verify packages are linked:**
```bash
bun run build:packages
```

---

## Phase 3: Create App Scaffolds (Day 8-10)

### Step 3.1: Create Owner App

```bash
cd apps/owner
```

**File: `apps/owner/package.json`**
```json
{
  "name": "@handsfree/owner",
  "version": "4.0.0",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "vite build && tauri build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@handsfree/shared-ui": "workspace:*",
    "@handsfree/shared-lib": "workspace:*",
    "@handsfree/shared-types": "workspace:*",
    "@handsfree/shared-stores": "workspace:*",
    "@handsfree/plugin-sdk": "workspace:*",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-sql": "^2.3.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.1.1",
    "zustand": "^5.0.8"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@vitejs/plugin-react": "^4.6.0",
    "typescript": "~5.8.3",
    "vite": "^7.0.4"
  }
}
```

**File: `apps/owner/vite.config.ts`**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

**File: `apps/owner/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../packages/shared-ui" },
    { "path": "../../packages/shared-lib" },
    { "path": "../../packages/shared-types" },
    { "path": "../../packages/shared-stores" }
  ]
}
```

**File: `apps/owner/src-tauri/Cargo.toml`**
```toml
[package]
name = "handsfree-owner"
version = "4.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
handsfree-tauri-commands = { path = "../../../packages/tauri-commands" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2" }
```

**File: `apps/owner/src-tauri/tauri.conf.json`**
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "HandsFree Owner",
  "version": "4.0.0",
  "identifier": "com.stonepot-tech.handsfree.owner",
  "build": {
    "beforeDevCommand": "bun run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "bun run build",
    "frontendDist": "../dist"
  }
}
```

**File: `apps/owner/src/main.tsx`**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**File: `apps/owner/src/App.tsx`**
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Owner App - Coming Soon</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Step 3.2: Create Staff App

```bash
cd ../staff
```

**Similar structure to Owner app, with:**
- `identifier`: `com.stonepot-tech.handsfree.staff`
- `productName`: `HandsFree Staff`
- Server port: `1421`

### Step 3.3: Create POS App

```bash
cd ../pos
```

**Similar structure to Owner app, with:**
- `identifier`: `com.stonepot-tech.handsfree.pos`
- `productName`: `HandsFree POS`
- Server port: `1422`

### Step 3.4: Install Dependencies

```bash
cd ../..
bun install
```

### Step 3.5: Test App Scaffolds

```bash
# Test each app in separate terminals
bun run dev:owner   # Terminal 1
bun run dev:staff   # Terminal 2
bun run dev:pos     # Terminal 3
```

**Expected**: Each app should launch with minimal UI showing "Coming Soon"

---

## Phase 4: Migrate Components (Day 11-20)

### Step 4.1: Migrate Owner App Components

```bash
cd apps/owner
```

**Create directory structure:**
```bash
mkdir -p src/{pages,components,stores}
mkdir -p src/components/{admin,analytics,inventory,plugins,settings,setup,provisioning}
```

**Copy components from root:**
```bash
# Admin components
cp ../../src/components/admin/CloudSyncSettings.tsx ./src/components/admin/
cp ../../src/components/admin/D1ProvisionButton.tsx ./src/components/admin/
cp ../../src/components/admin/DeviceSettings.tsx ./src/components/admin/
# ... (continue for all owner components)

# Pages
cp ../../src/pages-v2/SettingsPage.tsx ./src/pages/
cp ../../src/pages-v2/SettingsApp.tsx ./src/pages/
cp ../../src/pages-v2/ChainManagementPage.tsx ./src/pages/
# ... (continue for all owner pages)

# Stores
cp ../../src/stores/chainConfigStore.ts ./src/stores/
cp ../../src/stores/provisioningStore.ts ./src/stores/
# ... (continue for all owner stores)
```

**Update imports:**
```bash
# Find and replace imports across all copied files
# Old: import { ... } from '@/lib/database'
# New: import { ... } from '@handsfree/shared-lib/database'

# Use sed or manual find-replace in your editor
find ./src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  's|from "@/lib/database"|from "@handsfree/shared-lib/database"|g'

find ./src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  's|from "@/components/ui/|from "@handsfree/shared-ui/components/ui/|g'
```

**Update routing:**
```typescript
// apps/owner/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SettingsPage from './pages/SettingsPage';
import ChainManagementPage from './pages/ChainManagementPage';
import PluginsPage from './pages/PluginsPage';
// ... import all pages

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HubPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/chain" element={<ChainManagementPage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        {/* ... all owner routes */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Migrate Tauri commands:**
```bash
cd src-tauri
mkdir -p src/commands

# Copy owner-specific commands
cp ../../../../src-tauri/src/commands/settings.rs ./src/commands/
cp ../../../../src-tauri/src/commands/d1_provision.rs ./src/commands/
cp ../../../../src-tauri/src/commands/wizard.rs ./src/commands/
cp ../../../../src-tauri/src/commands/tenant.rs ./src/commands/
```

**File: `apps/owner/src-tauri/src/main.rs`**
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use handsfree_tauri_commands::{database, network, storage};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // Owner-specific commands
            commands::settings::get_restaurant_settings,
            commands::settings::update_restaurant_settings,
            commands::d1_provision::provision_d1_database,
            commands::wizard::complete_setup_wizard,
            commands::tenant::get_tenant_config,

            // Shared commands from package
            database::query,
            network::fetch,
            storage::secure_read,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Step 4.2: Migrate Staff App Components

**Similar process but with staff-specific components:**
```bash
cd apps/staff

# Copy components
cp ../../src/components/attendance/ClockInOutWidget.tsx ./src/components/
# ... (staff components only)

# Pages (create new minimal pages)
# AttendancePage.tsx
# PayrollPage.tsx
# AdvancesPage.tsx
```

### Step 4.3: Migrate POS App Components

**Similar process but with POS-specific components:**
```bash
cd apps/pos

# Copy POS components
cp -r ../../src/components/pos ./src/components/
cp -r ../../src/components/kds ./src/components/
cp -r ../../src/components/bds ./src/components/
cp -r ../../src/components/cart ./src/components/
# ... (all POS components)
```

---

## Phase 5: Update Current Monolith to Use Shared Packages (Day 21-25)

**This ensures the old app keeps working during migration**

```bash
cd /path/to/root
```

**Update `package.json` dependencies:**
```json
{
  "dependencies": {
    "@handsfree/shared-ui": "workspace:*",
    "@handsfree/shared-lib": "workspace:*",
    "@handsfree/shared-types": "workspace:*",
    "@handsfree/shared-stores": "workspace:*"
  }
}
```

**Update imports across entire codebase:**
```bash
# Example: Update database imports
find src -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs sed -i '' \
  's|from "@/lib/database"|from "@handsfree/shared-lib/database"|g'

# Update UI component imports
find src -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs sed -i '' \
  's|from "@/components/ui/|from "@handsfree/shared-ui/components/ui/|g'
```

**Test monolith still works:**
```bash
bun run dev
bun run build
```

---

## Phase 6: Testing & Validation (Day 26-30)

### Step 6.1: Test Each App Independently

```bash
# Test Owner App
cd apps/owner
bun run dev
# Verify: Settings, Cloud Sync, Plugins, Chain Management all work

# Test Staff App
cd apps/staff
bun run dev
# Verify: Clock in/out, Payroll view, Advances all work

# Test POS App
cd apps/pos
bun run dev
# Verify: POS, KDS, BDS, Orders all work
```

### Step 6.2: Test Shared Backend Connectivity

**Test D1 Sync from all apps:**
```bash
# In each app, test D1 sync
# Owner: Provision D1, then sync
# Staff: Clock in, verify syncs to D1
# POS: Create order, verify syncs to D1
```

**Test Durable Objects:**
```bash
# POS: Create order, verify real-time sync
# KDS: Verify order appears immediately
```

### Step 6.3: Test Offline Mode

**Test each app offline:**
```bash
# Disconnect from network
# Verify: Local SQLite still works
# Reconnect
# Verify: Background sync catches up
```

### Step 6.4: Build All Apps

```bash
# Build packages first
bun run build:packages

# Build all apps
bun run build:apps

# Or individually
bun run build:owner
bun run build:staff
bun run build:pos
```

---

## Phase 7: Deployment Setup (Day 31-35)

### Step 7.1: Create Build Scripts

**File: `scripts/build-all.sh`**
```bash
#!/bin/bash
set -e

echo "Building shared packages..."
bun run build:packages

echo "Building Owner app..."
cd apps/owner
bun run build
cd ../..

echo "Building Staff app..."
cd apps/staff
bun run build
cd ../..

echo "Building POS app..."
cd apps/pos
bun run build
cd ../..

echo "All apps built successfully!"
```

### Step 7.2: Create Deployment Scripts

**File: `scripts/deploy-owner.sh`**
```bash
#!/bin/bash
set -e

echo "Deploying Owner app..."
cd apps/owner

# Build desktop installers
cargo tauri build

# Build web version
bun run build
wrangler pages deploy dist --project-name handsfree-owner

echo "Owner app deployed!"
```

**Similar scripts for Staff and POS**

### Step 7.3: Update CI/CD (GitHub Actions)

**File: `.github/workflows/build-apps.yml`**
```yaml
name: Build All Apps

on:
  push:
    branches: [main, feature/multi-app-architecture]
  pull_request:
    branches: [main]

jobs:
  build-packages:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build:packages

  build-owner:
    needs: build-packages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build:owner

  build-staff:
    needs: build-packages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build:staff

  build-pos:
    needs: build-packages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build:pos
```

---

## Phase 8: Documentation & Cleanup (Day 36-40)

### Step 8.1: Update README Files

**File: `apps/owner/README.md`**
```markdown
# HandsFree Owner App

Owner/Manager dashboard for restaurant management.

## Features
- Restaurant settings & configuration
- Multi-location/chain management
- Plugin installation & management
- Sales reports & analytics
- Staff scheduling & roster
- Menu & inventory management

## Development
```bash
bun run dev
```

## Build
```bash
bun run build
```
```

**Similar READMEs for Staff and POS**

### Step 8.2: Archive Old Code

```bash
# Move old monolith code to archive
mkdir -p archive/monolith
git mv src archive/monolith/src
git mv src-tauri archive/monolith/src-tauri
```

**Note**: Only do this after new apps are fully validated and deployed

---

## Rollback Plan

If issues arise during migration:

### Quick Rollback
```bash
# Revert to previous commit
git reset --hard HEAD~1

# Or revert to specific tag
git checkout v3.1.0
```

### Gradual Rollback
```bash
# Keep new apps but restore old imports
find src -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs sed -i '' \
  's|from "@handsfree/shared-lib/database"|from "@/lib/database"|g'
```

---

## Success Criteria

- [ ] All three apps build successfully
- [ ] Owner app: All admin features work
- [ ] Staff app: Clock in/out, payroll view work
- [ ] POS app: Orders, KDS, printing work
- [ ] All apps connect to Cloudflare Workers
- [ ] D1 sync works from all apps
- [ ] Offline mode works in all apps
- [ ] Bundle sizes meet targets (Owner: ~500KB, Staff: ~200KB, POS: ~600KB)
- [ ] No regressions in existing functionality
- [ ] CI/CD pipelines pass for all apps

---

## Post-Migration Tasks

1. Monitor bundle sizes and optimize
2. Set up separate deployment schedules (Owner: monthly, Staff: bi-weekly, POS: weekly)
3. Update user documentation
4. Train team on new structure
5. Archive old monolith code
6. Celebrate! 🎉

---

## Troubleshooting

### Issue: Workspace packages not resolving
**Solution**: Run `bun install` from root directory

### Issue: Type errors after migration
**Solution**: Ensure all `tsconfig.json` files have correct `references`

### Issue: Tauri commands not found
**Solution**: Verify `handsfree-tauri-commands` is in `Cargo.toml` dependencies

### Issue: Build fails for specific app
**Solution**: Check `vite.config.ts` and ensure all imports are correct

---

## Next Steps

Ready to begin? Start with **Phase 1: Setup Workspace Structure**

Questions or issues? Refer to:
- `MULTI_APP_ARCHITECTURE_PROPOSAL.md` - Architecture overview
- `APP_DEPENDENCY_MAPPING.md` - Component mapping
- This guide - Step-by-step implementation

Good luck! 🚀
