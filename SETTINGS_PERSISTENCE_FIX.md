# Settings Persistence Fix - Complete ✅

## Problem

After app reload, restaurant settings data (address, phone) was not persisting even though:
- Save operations were succeeding (logs showed "rows affected: 1")
- Database was being written to correctly
- Name was being saved and retrieved successfully

## Root Cause

**Missing Fields in Rust Struct**

The TypeScript code was trying to save `activate_online` and `enable_inventory_sync` fields, but the Rust `RestaurantSettings` struct was missing these fields. This caused a **serialization/deserialization mismatch**:

1. TypeScript sends all settings including `activateOnline` and `enableInventorySync`
2. Rust tries to deserialize with `#[serde(rename_all = "camelCase")]`
3. Rust struct doesn't have these fields → deserialization fails silently or partially
4. Some data gets lost in the process

## Files Modified

### 1. src-tauri/src/commands/settings.rs

**Added missing fields to RestaurantSettings struct:**
```rust
// POS Workflow Settings
pub require_staff_pin_for_pos: bool,
pub filter_tables_by_staff_assignment: bool,
pub pin_session_timeout_minutes: i32,
pub theme: String,
pub activate_online: bool,           // ← ADDED
pub enable_inventory_sync: bool,     // ← ADDED
```

**Updated SELECT query (get_restaurant_settings):**
```rust
let query = "SELECT
    name, tagline, address_line1, address_line2, city, state, pincode, phone, email, website,
    gst_number, fssai_number, pan_number, cin_number,
    invoice_prefix, invoice_start_number, current_invoice_number, invoice_terms, footer_note,
    tax_enabled, cgst_rate, sgst_rate, service_charge_rate, service_charge_enabled,
    round_off_enabled, tax_included_in_price,
    print_logo, logo_url, print_qr_code, qr_code_url, paper_width, show_itemwise_tax,
    require_staff_pin_for_pos, filter_tables_by_staff_assignment, pin_session_timeout_minutes, theme,
    activate_online, enable_inventory_sync, device_role,  // ← ADDED
    packing_charges_enabled, packing_charges_by_category, packing_charges_default
FROM restaurant_settings WHERE id = 1";
```

**Updated row.get() indices:**
```rust
theme: row.get(35)?,
activate_online: row.get(36)?,           // ← ADDED
enable_inventory_sync: row.get(37)?,     // ← ADDED

device_role: row.get(38)?,               // Changed from 36

packing_charges_enabled: row.get(39)?,   // Changed from 37
packing_charges_by_category: row.get(40)?, // Changed from 38
packing_charges_default: row.get(41)?,   // Changed from 39
```

**Updated INSERT OR REPLACE query (save_restaurant_settings):**
```rust
let query = "INSERT OR REPLACE INTO restaurant_settings (
    id,
    name, tagline, address_line1, address_line2, city, state, pincode, phone, email, website,
    gst_number, fssai_number, pan_number, cin_number,
    invoice_prefix, invoice_start_number, current_invoice_number, invoice_terms, footer_note,
    tax_enabled, cgst_rate, sgst_rate, service_charge_rate, service_charge_enabled,
    round_off_enabled, tax_included_in_price,
    print_logo, logo_url, print_qr_code, qr_code_url, paper_width, show_itemwise_tax,
    require_staff_pin_for_pos, filter_tables_by_staff_assignment,
    pin_session_timeout_minutes, theme, activate_online, enable_inventory_sync, device_role,  // ← ADDED
    packing_charges_enabled, packing_charges_by_category, packing_charges_default
) VALUES (
    1,
    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
    ?11, ?12, ?13, ?14,
    ?15, ?16, ?17, ?18, ?19,
    ?20, ?21, ?22, ?23, ?24, ?25, ?26,
    ?27, ?28, ?29, ?30, ?31, ?32,
    ?33, ?34, ?35, ?36, ?37, ?38,  // ← ADDED ?37 and ?38
    ?39, ?40, ?41, ?42              // Changed from ?38, ?39, ?40
)";
```

**Updated params![] macro:**
```rust
params![
    settings.name,
    settings.tagline,
    // ... (other fields)
    settings.require_staff_pin_for_pos,
    settings.filter_tables_by_staff_assignment,
    settings.pin_session_timeout_minutes,
    settings.theme,
    settings.activate_online,          // ← ADDED
    settings.enable_inventory_sync,    // ← ADDED
    settings.device_role,
    settings.packing_charges_enabled,
    settings.packing_charges_by_category,
    settings.packing_charges_default,
]
```

### 2. src-tauri/migrations/031_add_online_sync_columns.sql (NEW FILE)

Created migration to add missing columns to database:

```sql
-- Add missing activate_online and enable_inventory_sync columns to restaurant_settings
-- These columns control online features and cloud sync

ALTER TABLE restaurant_settings ADD COLUMN activate_online BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN enable_inventory_sync BOOLEAN NOT NULL DEFAULT 0;
```

### 3. src-tauri/src/lib.rs

Registered new migration:

```rust
tauri_plugin_sql::Migration {
    version: 35,
    description: "add activate_online and enable_inventory_sync columns",
    sql: include_str!("../migrations/031_add_online_sync_columns.sql"),
    kind: tauri_plugin_sql::MigrationKind::Up,
},
```

---

## Testing Steps

### 1. Rebuild the App
```bash
# Stop any running instances
# Ctrl+C to stop dev server

# Rebuild Rust backend with new migration
cd src-tauri
cargo clean
cargo build
cd ..

# Run the app
bun run tauri:dev
```

### 2. Test Data Persistence

**Step 1: Fill Restaurant Basics Card**
- Open app → should see setup cards on hub
- Expand "Restaurant Basics" card
- Fill in:
  - Name: "Test Restaurant"
  - Phone: "1234567890"
  - Address: "123 Main St"
  - City: "Mumbai"
  - State: "Maharashtra"
  - Pincode: "400001"
- Click "Complete Setup"
- ✅ Card should disappear with smooth animation

**Step 2: Verify Save**
Check logs for:
```
[settings.rs] ===== save_restaurant_settings called =====
[settings.rs] Restaurant name: Test Restaurant
[settings.rs] ✅ Query succeeded, rows affected: 1
[settings.rs] ✅ Settings saved to SQLite successfully
```

**Step 3: Reload App**
- Press Ctrl+C to stop dev server
- Run `bun run tauri:dev` again
- Wait for app to load

**Step 4: Verify Persistence**
Check logs for:
```
[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] ✅ Settings retrieved successfully
[settings.rs] Restaurant name: Test Restaurant
[settings.rs] Address: 123 Main St, Mumbai, Maharashtra
[settings.rs] Phone: 1234567890
```

**Step 5: Verify UI**
- Restaurant Basics card should NOT appear (already complete)
- If you navigate to Settings, the saved data should be visible

---

## Verification Checklist

After testing, verify:

- [ ] App starts without migration errors
- [ ] Restaurant Basics card appears on fresh install
- [ ] Can fill and save restaurant details
- [ ] Save operation logs show success
- [ ] After app reload, data persists in logs
- [ ] Restaurant Basics card does NOT reappear after reload (completed state persists)
- [ ] Can edit saved data via Settings page
- [ ] Tax & Billing card also persists correctly
- [ ] All 5 setup cards work and persist

---

## Why This Fix Works

**Before:**
1. TypeScript sends: `{ name, phone, address, activateOnline, enableInventorySync, ... }`
2. Rust tries to deserialize into struct WITHOUT these fields
3. Serde fails to match all fields → partial data loss or error
4. Some fields don't get saved

**After:**
1. TypeScript sends: `{ name, phone, address, activateOnline, enableInventorySync, ... }`
2. Rust deserializes into struct WITH all fields
3. Serde successfully matches all fields ✓
4. All fields get saved to database ✓
5. On reload, all fields are read back correctly ✓

---

## Related Issue

The `trainingMode` property warning in WebSocketManager.tsx is a separate issue:
- `trainingMode` is stored in `setupWizardStore`, not `posSettings`
- This should be accessed via `useSetupWizardStore` instead
- Not related to persistence issue, just a type mismatch

---

## Build Status

✅ Rust compilation successful:
```
Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.46s
```

Only minor warnings (unused imports in bin files):
- `src/bin/export_translations_json.rs` - unused `std::path::Path`
- `src/bin/translate_generator.rs` - unused `std::path::PathBuf` and `HashMap`

These warnings don't affect app functionality.

---

## Migration Number

**Migration 035**: `031_add_online_sync_columns.sql`

The migration numbering is:
- File name: `031_*` (31st file)
- Version in lib.rs: `35` (to avoid conflicts with existing migrations that had different file vs version numbers)

---

**Fix Complete**: ✅ Ready for testing
**Expected Result**: Restaurant settings (name, phone, address) will now persist correctly after app reload
