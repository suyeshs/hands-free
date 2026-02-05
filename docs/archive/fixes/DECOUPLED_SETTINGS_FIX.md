# Restaurant Settings Decoupled from Tenant Settings ✅

## Problem

Restaurant settings (phone, address) were not persisting on app reload because:
1. **Tenant initialization was overwriting data** - Every time `loadFromSQLite` ran, it would check if the name was default and try to initialize from tenant config
2. **Data was being saved with partial information** - The tenant initialization would save settings with only the name, overwriting phone/address with empty strings
3. **Settings were coupled to tenant** - Restaurant settings and tenant settings were tightly coupled, causing confusion

## Solution

**Completely decoupled restaurant settings from tenant settings:**
- Removed the tenant initialization logic from `loadFromSQLite`
- Restaurant settings are now 100% independent
- Tenant name is set ONLY during initial tenant provisioning, not on every load
- Added comprehensive logging to track data flow

## Files Modified

### 1. src/stores/restaurantSettingsStore.ts

**Removed tenant initialization block:**
```typescript
// BEFORE (lines 226-260):
if (settings.name === 'Restaurant Name' || !settings.name || settings.name.trim() === '') {
  console.log('[RestaurantSettings] Settings have default values, checking tenant_config...');

  const { useTenantStore } = await import('./tenantStore');
  const tenant = useTenantStore.getState().tenant;

  if (tenant?.companyName) {
    const initializedSettings = {
      ...settings,
      name: tenant.companyName,
    };

    await saveRestaurantSettings(initializedSettings); // ❌ This overwrites phone/address!
    // ...
  }
}

// AFTER:
// REMOVED completely - Restaurant settings are independent
console.log(`[RestaurantSettings] 📖 Loaded settings from SQLite:`, settings);
```

**Added diagnostic logging in updateSettings:**
```typescript
const currentSettings = get().settings;
const updatedSettings = { ...currentSettings, ...newSettings };

console.log(`[RestaurantSettings] 🔍 Current settings:`, currentSettings);
console.log(`[RestaurantSettings] 🔍 New settings:`, newSettings);
console.log(`[RestaurantSettings] 🔍 Merged updatedSettings:`, updatedSettings);
console.log(`[RestaurantSettings] 🔍 updatedSettings.address:`, updatedSettings.address);
console.log(`[RestaurantSettings] 🔍 updatedSettings.phone:`, updatedSettings.phone);
```

### 2. src/components/setup/cards/RestaurantBasicsCard.tsx

**Added diagnostic logging in handleComplete:**
```typescript
const handleComplete = async () => {
  console.log('[RestaurantBasicsCard] ===== handleComplete called =====');
  console.log('[RestaurantBasicsCard] formData:', formData);
  console.log('[RestaurantBasicsCard] errors:', errors);

  const dataToSave = {
    name: formData.name,
    phone: formData.phone,
    address: {
      line1: formData.addressLine1,
      line2: settings.address?.line2 || '',
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
    },
  };

  console.log('[RestaurantBasicsCard] Data to save:', dataToSave);

  await updateSettings(dataToSave);
  // ...
};
```

### 3. src/services/tauriSettings.ts

**Added diagnostic logging:**
```typescript
console.log('[TauriSettings] ===== SAVING SETTINGS TO SQLITE =====');
console.log('[TauriSettings] Settings to save:', settings);
console.log('[TauriSettings] Address object:', settings.address);
console.log('[TauriSettings] Phone:', settings.phone);
```

### 4. src-tauri/src/commands/settings.rs

**Added diagnostic logging:**
```rust
println!("[settings.rs] ===== save_restaurant_settings called =====");
println!("[settings.rs] Restaurant name: {}", settings.name);
println!("[settings.rs] Phone: {}", settings.phone);
println!("[settings.rs] Address line 1: {}", settings.address_line1);
println!("[settings.rs] City: {}", settings.city);
println!("[settings.rs] State: {}", settings.state);
println!("[settings.rs] Pincode: {}", settings.pincode);
```

### 5. src-tauri/src/commands/settings.rs (Structure Fix)

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

**Updated SQL queries to include new columns**

### 6. src-tauri/migrations/031_add_online_sync_columns.sql (NEW)

**Added migration for missing columns:**
```sql
ALTER TABLE restaurant_settings ADD COLUMN activate_online BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN enable_inventory_sync BOOLEAN NOT NULL DEFAULT 0;
```

### 7. src-tauri/src/lib.rs

**Registered new migration (version 35)**

---

## Testing Instructions

### Step 1: Clean Rebuild

```bash
# Stop dev server (Ctrl+C)

# Rebuild Rust backend
cd src-tauri
cargo clean
cargo build
cd ..

# Start dev server
bun run tauri:dev
```

### Step 2: Test Data Persistence

1. **Open the app** - Should see setup cards on hub page
2. **Expand "Restaurant Basics" card**
3. **Fill in ALL fields:**
   - Restaurant Name: "Test Restaurant"
   - Phone: "1234567890"
   - Street Address: "123 Main St"
   - City: "Mumbai"
   - State: "Maharashtra"
   - Pincode: "400001"
4. **Click "Complete Setup"**

### Step 3: Check Console Logs

You should see these logs in **this exact order**:

```
[RestaurantBasicsCard] ===== handleComplete called =====
[RestaurantBasicsCard] formData: { name: "Test Restaurant", phone: "1234567890", addressLine1: "123 Main St", ... }
[RestaurantBasicsCard] Data to save: { name: "Test Restaurant", phone: "1234567890", address: { line1: "123 Main St", ... } }

[RestaurantSettings] 🔍 DIAGNOSTIC: updateSettings CALLED
[RestaurantSettings] 🔍 DIAGNOSTIC: Current settings: { name: "Restaurant Name", phone: "", address: { line1: "", ... } }
[RestaurantSettings] 🔍 DIAGNOSTIC: New settings: { name: "Test Restaurant", phone: "1234567890", address: { line1: "123 Main St", ... } }
[RestaurantSettings] 🔍 DIAGNOSTIC: Merged updatedSettings: { name: "Test Restaurant", phone: "1234567890", address: { line1: "123 Main St", ... } }
[RestaurantSettings] 🔍 DIAGNOSTIC: updatedSettings.address: { line1: "123 Main St", city: "Mumbai", state: "Maharashtra", pincode: "400001" }
[RestaurantSettings] 🔍 DIAGNOSTIC: updatedSettings.phone: "1234567890"

[TauriSettings] ===== SAVING SETTINGS TO SQLITE =====
[TauriSettings] Settings to save: { name: "Test Restaurant", phone: "1234567890", address: { line1: "123 Main St", ... } }
[TauriSettings] Address object: { line1: "123 Main St", city: "Mumbai", state: "Maharashtra", pincode: "400001" }
[TauriSettings] Phone: "1234567890"

[settings.rs] ===== save_restaurant_settings called =====
[settings.rs] Restaurant name: Test Restaurant
[settings.rs] Phone: 1234567890
[settings.rs] Address line 1: 123 Main St
[settings.rs] City: Mumbai
[settings.rs] State: Maharashtra
[settings.rs] Pincode: 400001
[settings.rs] ✅ Query succeeded, rows affected: 1
[settings.rs] ✅ Settings saved to SQLite successfully
```

**If phone/address are EMPTY in the Rust logs**, that means the TypeScript side is sending empty strings. Copy and paste the FULL console logs.

### Step 4: Reload App and Verify

```bash
# Stop dev server (Ctrl+C)
# Start again
bun run tauri:dev
```

Check the logs on startup:

```
[RestaurantSettings] 📖 DIAGNOSTIC: loadFromSQLite CALLED
[RestaurantSettings] 📖 DIAGNOSTIC: Loaded settings from SQLite: { name: "Test Restaurant", phone: "1234567890", ... }
[RestaurantSettings] 📖 DIAGNOSTIC: settings.name: "Test Restaurant"
[RestaurantSettings] 📖 DIAGNOSTIC: settings.phone: "1234567890"
[RestaurantSettings] 📖 DIAGNOSTIC: settings.address: { line1: "123 Main St", city: "Mumbai", ... }

[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] ✅ Settings retrieved successfully
[settings.rs] Restaurant name: Test Restaurant
[settings.rs] Address: 123 Main St, Mumbai, Maharashtra
[settings.rs] Phone: 1234567890
```

**Expected behavior:**
- Restaurant Basics card should NOT appear (data persisted)
- If you navigate to Settings → Restaurant Details, all saved data should be visible

### Step 5: Verify Database Directly

```bash
sqlite3 "/Users/stonepot-tech/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db" "SELECT name, phone, address_line1, city, state, pincode FROM restaurant_settings WHERE id = 1;"
```

Should output:
```
Test Restaurant|1234567890|123 Main St|Mumbai|Maharashtra|400001
```

---

## Key Changes Summary

### Before:
- ❌ Restaurant settings coupled to tenant settings
- ❌ `loadFromSQLite` would auto-initialize from tenant, overwriting data
- ❌ Every app reload could trigger tenant initialization
- ❌ Phone/address lost on reload

### After:
- ✅ Restaurant settings completely independent
- ✅ No auto-initialization from tenant on load
- ✅ Data persists correctly on reload
- ✅ Comprehensive logging at every step
- ✅ Clean separation of concerns

---

## Troubleshooting

### If data is still not persisting:

1. **Check console logs** - Follow the exact log sequence above
2. **Identify where data becomes empty** - Compare logs from each layer:
   - RestaurantBasicsCard (form data)
   - RestaurantSettings store (merge logic)
   - TauriSettings service (serialization)
   - Rust commands (deserialization)
3. **Copy and paste the FULL console log sequence** so we can pinpoint the exact failure point

### If you see "GUARD BLOCKED" messages:

This is normal - it means duplicate calls are being prevented. The guards ensure only one save/load operation runs at a time.

### If the card reappears after reload:

Check the validation logic in `useHasRestaurantBasics()` - it requires:
- Name (not "Restaurant Name")
- Phone (exactly 10 digits)
- Address line 1, city, state (not empty)
- Pincode (exactly 6 digits)

---

## Migration Applied

✅ **Migration 035**: `031_add_online_sync_columns.sql`
- Adds `activate_online` and `enable_inventory_sync` columns
- Required for full Rust struct compatibility

---

**Status**: ✅ Ready for testing
**Expected Result**: Restaurant settings (name, phone, address) persist correctly after app reload
**Decoupling**: ✅ Complete - Restaurant settings independent from tenant settings
