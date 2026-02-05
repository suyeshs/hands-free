# Coorg Migration Tool - Implementation Status

## ✅ Completed

### 1. Project Structure
- ✅ Created `apps/coorg-migration-tool/` directory
- ✅ Set up package.json with all dependencies
- ✅ Created TypeScript configuration files
- ✅ Set up Vite build configuration
- ✅ Created HTML entry point

### 2. Frontend (React + TypeScript)
- ✅ Created `src/main.tsx` - React entry point
- ✅ Created `src/App.tsx` - Main application component with basic UI
- ✅ Created `src/types.ts` - Complete TypeScript interfaces
- ✅ Created `src/styles.css` - Basic styling
- ✅ Implemented basic state machine (idle → running → success → error)

### 3. Documentation
- ✅ Created `README.md` - Complete user and developer guide
- ✅ Created comprehensive plan in `/Users/stonepot-tech/.claude/plans/joyful-petting-umbrella.md`

## 🚧 In Progress / Not Started

### 1. Tauri Configuration (**CRITICAL - Next Step**)

**Files Needed**:
- `src-tauri/Cargo.toml` - Rust dependencies
- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/build.rs` - Build script
- `src-tauri/.gitignore` - Git ignore rules

**Dependencies Required** (Cargo.toml):
```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
chrono = { version = "0.4", features = ["serde"] }
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
```

---

### 2. Rust Backend (**CRITICAL**)

**Module Structure Required**:
```
src-tauri/src/
├── main.rs                 # Tauri entry point
├── lib.rs                  # Library root
├── migration/
│   ├── mod.rs             # Module exports
│   ├── detect.rs          # Database detection (150 lines)
│   ├── export.rs          # Export v1.0 data (200 lines)
│   ├── backup.rs          # Create backups (100 lines)
│   ├── transform.rs       # Transform data (200 lines)
│   ├── import.rs          # Import to guanix.db (300 lines)
│   ├── validate.rs        # Validate migration (150 lines)
│   └── commit.rs          # Finalize migration (100 lines)
└── d1_sync/
    ├── mod.rs             # Module exports
    ├── provision.rs       # D1 provisioning
    ├── sync.rs            # Data sync
    └── schema.rs          # Schema extraction
```

**Estimated Lines of Code**: ~1200 lines of Rust

**Key Commands to Implement**:
```rust
#[tauri::command]
async fn detect_v1_database() -> Result<DetectionResult, String>

#[tauri::command]
async fn run_full_migration() -> Result<ValidationResult, String>

#[tauri::command]
async fn rollback_migration(backup_path: String) -> Result<(), String>
```

---

### 3. Migration Files to Copy

**From Main App**:
- `../../src-tauri/resources/migrations/*.sql` - All 60 migration files
- `../../src-tauri/src/commands/d1_sync.rs` - D1 sync logic
- `../../src-tauri/src/commands/d1_provision.rs` - D1 provisioning

**Destination**:
- `src-tauri/resources/migrations/` - Copy all SQL files
- `src-tauri/src/d1_sync/` - Adapt D1 code for migration tool

---

### 4. Enhanced UI Components

While the basic App.tsx works, these components would improve UX:

**Optional Enhancements**:
- `src/components/WelcomeScreen.tsx` - Polished intro screen
- `src/components/MigrationProgress.tsx` - Real-time progress with animations
- `src/components/ValidationScreen.tsx` - Detailed validation review
- `src/components/SuccessScreen.tsx` - Success with confetti animation

**Dependencies for Enhanced UI**:
```json
{
  "framer-motion": "^12.23.26",
  "lucide-react": "^0.554.0"
}
```

---

### 5. Testing

**Unit Tests Needed**:
- Rust transformation logic tests
- Tax calculation tests
- Data validation tests

**Integration Tests Needed**:
- Full migration flow with sample v1.0 database
- D1 sync with test worker
- Rollback functionality

**Test Database**:
- Create `tests/fixtures/sample-v1.db` with realistic data
- 100 sales records over 30 days
- 5 staff users
- 2 active sessions

---

### 6. Build & Distribution

**Build Commands**:
```bash
# Install dependencies
cd apps/coorg-migration-tool
npm install

# Development
npm run tauri dev

# Production build
npm run tauri build
```

**Expected Output**:
- Windows: `coorg-migration-tool_1.0.0_x64-setup.exe` (~15MB)
- macOS: `Coorg Migration Tool.dmg` (~20MB)
- Linux: `coorg-migration-tool_1.0.0_amd64.AppImage` (~18MB)

---

## Critical Next Steps

### Step 1: Set Up Tauri Configuration (30 minutes)

Create `src-tauri/Cargo.toml`:
```toml
[package]
name = "coorg-migration-tool"
version = "1.0.0"
description = "Migration tool for Coorg Food Company"
authors = ["Your Team"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["protocol-asset", "shell-open"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
chrono = { version = "0.4", features = ["serde"] }
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
anyhow = "1"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

Create `src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Coorg Migration Tool",
  "version": "1.0.0",
  "identifier": "com.coorg.migration",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg", "appimage"],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    },
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "app": {
    "windows": [
      {
        "title": "Coorg Migration Tool",
        "width": 800,
        "height": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

---

### Step 2: Create Minimal Rust Backend (2-3 hours)

Start with a working minimal version:

**`src-tauri/src/main.rs`** (50 lines):
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod migration;

use migration::{detect_v1_database, DetectionResult};

#[tauri::command]
async fn detect_database() -> Result<DetectionResult, String> {
    detect_v1_database().await
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![detect_database])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**`src-tauri/src/migration/mod.rs`** (Minimal detection logic first):
```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectionResult {
    pub found: bool,
    pub path: String,
    pub sales_count: i32,
    pub staff_count: i32,
}

pub async fn detect_v1_database() -> Result<DetectionResult, String> {
    // Find app data directory
    let data_dir = dirs::data_local_dir()
        .ok_or("Could not find app data directory")?;

    let pos_db_path = data_dir.join("restaurant-pos-ai").join("pos.db");

    if !pos_db_path.exists() {
        return Err("pos.db not found".to_string());
    }

    // Open database and check schema
    let conn = rusqlite::Connection::open(&pos_db_path)
        .map_err(|e| e.to_string())?;

    // Check if sales_transactions table exists
    let has_sales_table: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sales_transactions'",
            [],
            |row| row.get(0)
        )
        .map(|count: i32| count > 0)
        .map_err(|e| e.to_string())?;

    if has_sales_table {
        return Err("Database already migrated".to_string());
    }

    // Get counts
    let sales_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM table_sessions WHERE status = 'closed'",
            [],
            |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    let staff_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM staff_users",
            [],
            |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;

    Ok(DetectionResult {
        found: true,
        path: pos_db_path.to_string_lossy().to_string(),
        sales_count,
        staff_count,
    })
}
```

---

### Step 3: Copy Migration Files from Main App (30 minutes)

```bash
# From project root
cd apps/coorg-migration-tool

# Create directories
mkdir -p src-tauri/resources/migrations
mkdir -p src-tauri/src/d1_sync

# Copy migrations
cp -r ../../src-tauri/resources/migrations/*.sql src-tauri/resources/migrations/

# Copy D1 sync code (will need adaptation)
cp ../../src-tauri/src/commands/d1_sync.rs src-tauri/src/d1_sync/sync.rs
cp ../../src-tauri/src/commands/d1_provision.rs src-tauri/src/d1_sync/provision.rs
```

---

### Step 4: Iterative Development (Days 2-10)

Build incrementally:

**Day 1-2**: Detection + Export + Backup
- Get database detection working
- Implement export logic
- Create backup functionality
- Test with sample database

**Day 3-4**: Transform + Import
- Implement transformation logic
- Create guanix.db with migrations
- Import transformed data
- Test data integrity

**Day 5-6**: Validation + Commit
- Implement validation checks
- Add commit logic
- Test rollback functionality

**Day 7-8**: D1 Sync Integration
- Adapt D1 sync code
- Test provisioning
- Test full sync
- Handle errors

**Day 9-10**: UI Polish + Testing
- Enhance UI components
- Add progress events
- Integration testing
- Build distributables

---

## Development Workflow

### Quick Start (After Tauri Setup)

```bash
# Terminal 1: Frontend dev server
cd apps/coorg-migration-tool
npm run dev

# Terminal 2: Tauri dev
npm run tauri dev
```

This will:
1. Start Vite dev server on http://localhost:5173
2. Launch Tauri window with hot reload
3. Show any Rust compile errors

### Testing

```bash
# Rust tests
cd src-tauri
cargo test

# Build for production
cd ..
npm run tauri build
```

---

## Estimated Timeline

- **Tauri Setup**: 30 minutes
- **Minimal Rust Backend**: 2-3 hours
- **Full Migration Logic**: 2-3 days
- **D1 Sync Integration**: 2 days
- **UI Polish**: 1 day
- **Testing**: 2-3 days
- **Documentation**: 1 day

**Total**: ~10-12 days (as estimated in plan)

---

## Resources

### Tauri Documentation
- Tauri 2.0 Guides: https://v2.tauri.app/start/
- Command System: https://v2.tauri.app/develop/calling-rust/
- Events: https://v2.tauri.app/develop/calling-frontend/

### Rust SQLite
- rusqlite docs: https://docs.rs/rusqlite/latest/rusqlite/
- SQLite tutorial: https://www.sqlite.org/lang.html

### Testing
- cargo test: https://doc.rust-lang.org/cargo/commands/cargo-test.html
- Integration tests: https://doc.rust-lang.org/book/ch11-03-test-organization.html

---

## Summary

**✅ Foundation Complete**: Project structure, TypeScript types, basic React UI
**🚧 Critical Path**: Need Tauri configuration + Rust backend implementation
**📦 Dependencies**: All migration SQL files from main app + D1 sync code
**⏱️ Timeline**: ~10-12 days for full implementation
**🎯 Goal**: Standalone .exe/.dmg/.appimage for production migration

The next critical step is setting up Tauri configuration and creating the minimal Rust backend with database detection working. From there, we can build incrementally.
