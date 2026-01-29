# Address Save/Load Investigation & Fixes

## Issue Report
**User Report:** "address is not getting saved to db, on reload the form is not displaying the saved address."

## Investigation Results

### 1. Database Verification ✅
**Status:** Address data IS being saved correctly to SQLite

```bash
sqlite3 "/Users/stonepot-tech/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db" \
"SELECT address_line1, address_line2, city, state, pincode FROM restaurant_settings WHERE id = 1;"
```

**Result:**
```
test|Test|MUMBAI|MAHARASHTRA|400071
```

✅ **Conclusion:** The SAVE operation is working correctly. Data exists in the database.

### 2. Code Path Analysis

#### Save Flow (Working ✓)
1. **Frontend:** `RestaurantSettingsInline.tsx` → `handleSave()` → `updateSettings(formData)`
2. **Store:** `restaurantSettingsStore.ts` → `updateSettings()` → `saveRestaurantSettings()`
3. **Service:** `tauriSettings.ts` → Maps `address.line1` → `addressLine1` (camelCase)
4. **Rust:** `settings.rs` → `save_restaurant_settings()` → SQLite INSERT

#### Load Flow (Issue suspected here)
1. **Rust:** `settings.rs` → `get_restaurant_settings()` → Reads from SQLite
2. **Service:** `tauriSettings.ts` → Maps `address_line1` → `address.line1` (nested object)
3. **Store:** `restaurantSettingsStore.ts` → `loadFromSQLite()` → Sets store state
4. **Frontend:** `RestaurantSettingsInline.tsx` → Reads from store → Displays in form inputs

### 3. Potential Issues Found & Fixed

#### Issue #1: Shallow Merge in updateSettings (FIXED)
**Location:** `src/stores/restaurantSettingsStore.ts:304`

**Problem:**
```typescript
const updatedSettings = { ...currentSettings, ...newSettings };
```

This shallow merge would replace entire nested objects (like `address`) instead of merging them.

**Fix Applied:**
```typescript
const updatedSettings = {
  ...currentSettings,
  ...newSettings,
  // Deep merge for nested objects
  address: newSettings.address
    ? { ...currentSettings.address, ...newSettings.address }
    : currentSettings.address,
  posSettings: newSettings.posSettings
    ? { ...currentSettings.posSettings, ...newSettings.posSettings }
    : currentSettings.posSettings,
  // ... other nested objects
};
```

### 4. Diagnostic Logging Added

Added comprehensive logging to trace data flow:

#### A. `src/services/tauriSettings.ts` (getRestaurantSettings)
- Logs raw address data from Rust
- Logs mapped address object before returning

#### B. `src/stores/restaurantSettingsStore.ts` (loadFromSQLite)
- Logs address in validated settings
- Logs address in store after set()

#### C. `src/components/admin/RestaurantSettingsInline.tsx`
- Logs address when settings prop changes
- Logs formData.address when it changes

### 5. Schema Verification ✅

**Table Schema:**
```sql
address_line1 TEXT NOT NULL DEFAULT ''
address_line2 TEXT
city TEXT NOT NULL DEFAULT ''
state TEXT NOT NULL DEFAULT ''
pincode TEXT NOT NULL DEFAULT ''
```

✅ All address columns exist and have correct types

**Rust Struct Mapping:** ✅ Correct
```rust
pub struct RestaurantSettings {
    pub address_line1: String,    // Column 5, row.get(5)
    pub address_line2: Option<String>,  // Column 6, row.get(6)
    pub city: String,             // Column 7, row.get(7)
    pub state: String,            // Column 8, row.get(8)
    pub pincode: String,          // Column 9, row.get(9)
}
```

**TypeScript Mapping:** ✅ Correct
```typescript
address: {
  line1: settings.address_line1,
  line2: settings.address_line2 || undefined,
  city: settings.city,
  state: settings.state,
  pincode: settings.pincode,
}
```

## Testing Instructions

### Method 1: Use Diagnostic Test Page
1. Open the app in Tauri dev mode: `bun run tauri dev`
2. Navigate to the test page (you may need to add it to your routing)
3. Open [test-address-load.html](./test-address-load.html) in the Tauri webview
4. Click "Test Address Load from Database"
5. Check the output to see if address data is being loaded correctly

### Method 2: Check Browser Console
1. Open the app: `bun run tauri dev`
2. Open DevTools console (Right-click → Inspect → Console)
3. Navigate to Settings page
4. Look for log messages with these prefixes:
   - `[settings.rs]` - Rust backend logs
   - `[TauriSettings]` - Service layer logs
   - `[RestaurantSettings]` - Store logs
   - `[RestaurantSettingsInline]` - Component logs
5. Specifically check for:
   - 🏠 ADDRESS DATA FROM RUST
   - 📦 MAPPED ADDRESS OBJECT
   - 🏠 ADDRESS IN VALIDATED SETTINGS
   - 📦 ADDRESS IN STORE AFTER SET
   - 🏠 ADDRESS IN SETTINGS (component)
   - 🔍 FORMDATA.ADDRESS CHANGED

### Method 3: Test Save/Reload Flow
1. Open Settings page
2. Enter address data:
   - Line 1: "123 Test Street"
   - Line 2: "Apt 4B"
   - City: "Mumbai"
   - State: "Maharashtra"
   - Pincode: "400001"
3. Click Save button
4. Check console for save confirmation logs
5. Reload the page (Cmd+R / Ctrl+R)
6. Check if address fields are populated
7. **Check console logs** to see where the data flow breaks

## Expected Console Output

If everything works correctly, you should see:

```
[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] 🏠 ADDRESS DATA:
[settings.rs]   address_line1: "123 Test Street"
[settings.rs]   city: "Mumbai"
...
[TauriSettings] 🏠 ADDRESS DATA FROM RUST:
[TauriSettings]   address_line1: "123 Test Street"
...
[TauriSettings] 📦 MAPPED ADDRESS OBJECT: {line1: "123 Test Street", line2: "Apt 4B", ...}
[RestaurantSettings] 🏠 ADDRESS IN VALIDATED SETTINGS: {line1: "123 Test Street", ...}
[RestaurantSettings] 📦 ADDRESS IN STORE AFTER SET: {line1: "123 Test Street", ...}
[RestaurantSettingsInline] 🏠 ADDRESS IN SETTINGS: {line1: "123 Test Street", ...}
[RestaurantSettingsInline] 🔍 FORMDATA.ADDRESS CHANGED: {line1: "123 Test Street", ...}
```

If the address data is EMPTY at any stage, that's where the problem is!

## Next Steps

1. **Run the tests above** and check where the address data disappears in the console logs
2. **Report back** with the console logs showing where the issue occurs
3. If the data is present in all logs but still not displaying, the issue is in the form rendering
4. If the data disappears at a specific stage, we'll debug that specific layer

## Files Modified

1. **src/services/tauriSettings.ts** - Added diagnostic logging
2. **src/stores/restaurantSettingsStore.ts** - Fixed shallow merge, added logging
3. **src/components/admin/RestaurantSettingsInline.tsx** - Added diagnostic logging
4. **test-address-load.html** - Created diagnostic test page

## Summary

- ✅ Database contains correct address data
- ✅ Save flow is working
- ✅ Schema and mappings are correct
- ⚠️ Load/display flow needs testing with diagnostic logs
- 🔧 Fixed potential shallow merge issue
- 📊 Added comprehensive logging to trace data flow
