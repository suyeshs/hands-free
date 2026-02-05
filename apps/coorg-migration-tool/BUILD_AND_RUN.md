# Build and Run Guide - Coorg Migration Tool

## ✅ Backend Complete!

The complete Rust backend with migration logic is now implemented and ready to use.

---

## What's Included

### ✅ Tauri Configuration
- `src-tauri/Cargo.toml` - All Rust dependencies
- `src-tauri/tauri.conf.json` - App configuration
- `src-tauri/build.rs` - Build script

### ✅ Rust Backend (~800 lines)
- `src-tauri/src/main.rs` - Tauri entry point with commands
- `src-tauri/src/types.rs` - Type definitions
- `src-tauri/src/migration.rs` - Complete migration logic:
  - ✅ Database detection
  - ✅ Data export from v1.0
  - ✅ Automatic backup creation
  - ✅ Data transformation (JSON → SQL)
  - ✅ Import to new database
  - ✅ Validation with counts
  - ✅ Commit & rollback support
  - ✅ Progress events

### ✅ React Frontend
- Modern UI with state machine
- Real-time progress tracking
- Event listener for backend updates
- Success/error handling

---

## Quick Start

### Prerequisites

Install if not already present:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js/npm (or use Bun)
# Visit: https://nodejs.org/

# Install Tauri CLI
cargo install tauri-cli --version "^2.0.0"
```

### Step 1: Install Dependencies

```bash
cd apps/coorg-migration-tool
npm install
```

### Step 2: Run in Development

```bash
# Start development server
npm run tauri dev
```

This will:
1. Start Vite dev server on http://localhost:5173
2. Compile Rust backend
3. Launch the migration tool window
4. Enable hot reload for frontend changes

**First run will take 2-3 minutes** to download and compile Rust dependencies.

---

## Building for Production

### Build Executables

```bash
cd apps/coorg-migration-tool
npm run tauri build
```

### Output Locations

After building, find executables here:

**Windows**:
```
src-tauri/target/release/bundle/nsis/
  └── Coorg Migration Tool_1.0.0_x64-setup.exe
```

**macOS**:
```
src-tauri/target/release/bundle/dmg/
  └── Coorg Migration Tool_1.0.0_x64.dmg
```

**Linux**:
```
src-tauri/target/release/bundle/appimage/
  └── coorg-migration-tool_1.0.0_amd64.AppImage
```

---

## Usage

### For Development/Testing

1. **Run the tool**:
   ```bash
   npm run tauri dev
   ```

2. **Detection**: Tool automatically searches for `pos.db` in:
   - `~/.local/share/restaurant-pos-ai/` (Linux)
   - `~/Library/Application Support/restaurant-pos-ai/` (macOS)
   - `C:\Users\<user>\AppData\Local\restaurant-pos-ai\` (Windows)

3. **Start Migration**: Click the button and wait for completion

4. **Review Results**: Check the validation summary

### For Production

1. **Close** existing POS app (if running)

2. **Run** the migration tool executable

3. **Follow** on-screen instructions

4. **Wait** for completion (~5-10 minutes depending on data size)

5. **Verify** success message and data counts

6. **Install** new POS version with `guanix.db`

---

## What the Tool Does

### Step-by-Step Process

1. **Detect** (5%)
   - Finds `pos.db` in app data directory
   - Verifies it's v1.0 (no `sales_transactions` table)
   - Counts sales and staff records

2. **Export** (10%)
   - Reads closed sales from `table_sessions`
   - Reads active sessions
   - Reads staff users with credentials

3. **Backup** (20%)
   - Creates `pos-v1-backup-{timestamp}.db`
   - Saves `migration-export-{timestamp}.json`

4. **Create** (25%)
   - Creates `guanix.db` with new schema
   - Applies essential table migrations

5. **Import** (30-70%)
   - Imports staff users
   - Transforms sales (JSON → structured SQL)
   - Calculates taxes (2.5% CGST + 2.5% SGST)
   - Generates invoice numbers (`MIG-000001`, etc.)
   - Imports active sessions
   - Initializes restaurant_settings
   - Creates tenant_config

6. **Validate** (80%)
   - Counts staff (expected vs actual)
   - Counts sales (expected vs actual)
   - Calculates total revenue
   - Gets date range

7. **Commit** (90%)
   - Archives `pos.db` → `pos-v1-archive-{timestamp}.db`
   - Marks migration complete

8. **Complete** (100%)
   - Shows success message
   - Displays validation results

---

## Data Transformation

### Before (v1.0)
```sql
table_sessions.order_data = '{"subtotal": 500, "discount": 0, "items": [...]}'
```

### After (Current)
```sql
INSERT INTO sales_transactions (
  subtotal = 500,
  cgst = 12.5,     -- 2.5%
  sgst = 12.5,     -- 2.5%
  grand_total = 525,
  invoice_number = 'MIG-000001',
  ...
)
```

---

## Troubleshooting

### Build Errors

**Error**: "rustc not found"
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Error**: "tauri command not found"
```bash
# Install Tauri CLI
cargo install tauri-cli --version "^2.0.0"
```

### Runtime Errors

**Error**: "pos.db not found"
- **Solution**: Ensure v1.0 database exists in app data directory
- **Manual Path**: You can modify `get_db_dir()` in `migration.rs` to use a custom path

**Error**: "Database already migrated"
- **Solution**: The database has `sales_transactions` table, meaning it's already been migrated
- **Check**: Look for `guanix.db` - if it exists, migration was completed previously

**Error**: "Validation failed"
- **Solution**: Check console logs for specific mismatches
- **Action**: Rollback using backup file and retry
- **Backup Location**: Look for `pos-v1-backup-{timestamp}.db` in same directory as `pos.db`

---

## File Locations

### During Development
- Working directory: `apps/coorg-migration-tool/`
- Rust source: `src-tauri/src/`
- Frontend source: `src/`

### At Runtime
- Database directory: Platform-specific app data directory
- Backup files: Same directory as `pos.db`
- Export JSON: Same directory as `pos.db`

**Example paths**:
- macOS: `~/Library/Application Support/restaurant-pos-ai/`
- Linux: `~/.local/share/restaurant-pos-ai/`
- Windows: `C:\Users\<user>\AppData\Local\restaurant-pos-ai\`

---

## Development Workflow

### Hot Reload

Frontend changes (TypeScript/React) hot reload automatically.

Rust changes require recompilation:
1. Save Rust file
2. Tauri CLI detects change
3. Recompiles (~10-30 seconds)
4. Restarts app

### Debugging

**Frontend**:
- Open DevTools in the Tauri window (Cmd+Option+I / Ctrl+Shift+I)
- Console shows JavaScript logs and errors

**Backend**:
- Rust `println!` output appears in terminal running `tauri dev`
- Add `#[cfg(debug_assertions)]` for debug-only code

### Testing

**Manual Testing**:
1. Create test `pos.db` with sample data
2. Place in expected directory
3. Run migration tool
4. Verify `guanix.db` created correctly
5. Check backup files created
6. Validate data integrity

**Unit Testing** (future):
```bash
cd src-tauri
cargo test
```

---

## Next Steps

### Optional Enhancements

1. **D1 Cloud Sync** (~2 days)
   - Copy D1 sync code from main app
   - Add provisioning logic
   - Sync migrated data to cloud

2. **Enhanced UI** (~1 day)
   - Add framer-motion animations
   - Improve progress visualization
   - Add confetti on success

3. **Menu Migration** (~1 day)
   - Handle menu_items and menu_categories
   - Migrate menu images

4. **Rollback UI** (~0.5 day)
   - Add rollback button in error state
   - Allow user to select backup file

---

## Current Limitations

1. **Basic Schema**: Only essential tables created (staff, sales, settings, tenant_config)
   - **Impact**: New POS needs full 60 migrations for complete schema
   - **Solution**: Copy all migration SQL files from main app

2. **No D1 Sync**: Migration doesn't sync to cloud yet
   - **Impact**: User must manually sync or wait for next POS app sync
   - **Solution**: Add D1 sync module (see IMPLEMENTATION_STATUS.md)

3. **Hardcoded Tenant**: Only works for `coorg-food-company-6163`
   - **Impact**: Not reusable for other tenants
   - **Solution**: Make tenant_id configurable or auto-detect

4. **No Menu Migration**: Doesn't copy menu_items if they exist in v1.0
   - **Impact**: User must re-upload menu in new POS
   - **Solution**: Add menu table export/import logic

---

## Production Checklist

Before distributing to production:

- [ ] Test with real v1.0 database (not just sample data)
- [ ] Verify staff can login with existing PINs
- [ ] Check sales data accuracy and totals
- [ ] Confirm tax calculations are correct
- [ ] Test rollback functionality
- [ ] Validate invoice numbering
- [ ] Check backup files created properly
- [ ] Test on all target platforms (Windows/Mac/Linux)
- [ ] Sign executables (for production distribution)
- [ ] Create user documentation

---

## Summary

**✅ Complete**: Rust backend with full migration logic
**✅ Complete**: React frontend with progress tracking
**✅ Complete**: Tauri configuration and build setup
**🚧 Optional**: D1 cloud sync, enhanced UI, menu migration

**Ready to Use**: Run `npm run tauri dev` to start development!

**Build for Production**: Run `npm run tauri build` to create executables!

The core migration functionality is complete and functional. Optional enhancements can be added as needed.
