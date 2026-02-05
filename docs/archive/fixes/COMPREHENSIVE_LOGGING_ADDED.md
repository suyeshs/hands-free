# Comprehensive Logging Added - Terminal Debugging

## Overview

Added extensive logging throughout the activation and setup flow to debug the routing loop issue. All logs will appear in:
- **Browser Console**: Frontend logs (JavaScript/TypeScript)
- **Terminal**: Rust backend logs (Tauri commands)

## Rust Backend Logging (Terminal)

### File: `src-tauri/src/commands/settings.rs`

#### `get_restaurant_settings` Command

**When called**: When frontend loads restaurant settings from database

**Terminal logs**:
```
[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] Database path: "/Users/.../pos.db"
[settings.rs] Database exists: true
[settings.rs] Database connection opened successfully
[settings.rs] ✅ Settings retrieved successfully
[settings.rs] Restaurant name: My Restaurant
[settings.rs] Address: City, State, 123456
[settings.rs] Phone: 1234567890
[settings.rs] Tax enabled: true
```

**If error**:
```
[settings.rs] ❌ Failed to get app_data_dir: ...
[settings.rs] ❌ Failed to open database: ...
[settings.rs] ❌ Failed to query settings: ...
```

#### `save_restaurant_settings` Command

**When called**: When frontend saves settings to database (during setup completion)

**Terminal logs**:
```
[settings.rs] ===== save_restaurant_settings called =====
[settings.rs] Restaurant name: My Restaurant
[settings.rs] Database path: "/Users/.../pos.db"
[settings.rs] Database exists: true
[settings.rs] Database connection opened successfully
[settings.rs] restaurant_settings table exists: true
[settings.rs] Executing INSERT OR REPLACE query...
[settings.rs] ✅ Query succeeded, rows affected: 1
[settings.rs] ✅ Settings saved to SQLite successfully
```

**If errors**:
```
[settings.rs] ❌ Failed to get app_data_dir: ...
[settings.rs] ❌ Failed to open database: ...
[settings.rs] ❌ Table does not exist - migration may not have run
[settings.rs] ❌ Query execution failed: ...
[settings.rs] ⚠️ WARNING: No rows were affected!
```

## Frontend Logging (Browser Console)

### File: `src/App.tsx`

#### Routing Decision Logs

**When app initializes**:
```javascript
[App] ===== ROUTING DECISION VARIABLES =====
[App] needsActivation: false
[App] needsSetup: true  // ← Key indicator
[App] needsProvisioning: false
[App] isActivated: true
[App] tenant: {...}
[App] awaitingActivation: false

// Session flags
[App] activation-in-progress: true  // ← Should be true after activation
[App] activation-needs-setup-completion: true
[App] activation-needs-cloud-push: true
[App] setup-just-completed: null
[App] skip-initial-sync: null
[App] ========================================

[App] ===== SETUP CHECK =====
[App] needsSetup: true
[App] activationInProgress: true  // ← Should be true
[App] Will show setup wizard: false  // ← Should be false
```

**If showing setup wizard** (wrong - indicates routing loop):
```javascript
[App] 🔀 ROUTING: Showing setup wizard
```

**If continuing to hub** (correct):
```javascript
[App] 🔀 Post-activation processing detected
[App] Completing setup wizard...
[App] ✅ Setup completed and saved to database
[App] Showing main app with routes
```

### File: `src/stores/setupWizardStore.ts`

#### `useNeedsSetup()` Hook

**Called by**: App.tsx routing logic to determine if setup is needed

**Browser console logs**:
```javascript
[useNeedsSetup] ===== SETUP CHECK =====
[useNeedsSetup] isComplete: false  // ← Key: Should be true after activation
[useNeedsSetup] settings.name: undefined  // ← Key: Should have restaurant name
[useNeedsSetup] settings.address: undefined
[useNeedsSetup] settings.phone: undefined
[useNeedsSetup] settings.taxEnabled: undefined
[useNeedsSetup] hasRequiredData: false  // ← Key indicator

// Decision logic
[useNeedsSetup] 🔀 RESULT: true (needs setup - no required data)
```

**Expected after activation** (correct):
```javascript
[useNeedsSetup] ===== SETUP CHECK =====
[useNeedsSetup] isComplete: true
[useNeedsSetup] settings.name: "My Restaurant"
[useNeedsSetup] settings.address: {line1: "...", city: "...", ...}
[useNeedsSetup] settings.phone: "1234567890"
[useNeedsSetup] settings.taxEnabled: true
[useNeedsSetup] hasRequiredData: true
[useNeedsSetup] ✅ Setup complete and data exists
[useNeedsSetup] 🔀 RESULT: false (no setup needed)
```

## How to Use This Logging

### Step 1: Clear Console and Terminal

Before testing, clear both outputs:
- **Browser**: `console.clear()`
- **Terminal**: `clear` command

### Step 2: Complete Activation Flow

1. Start app: `bun tauri dev`
2. Complete setup wizard
3. Provision restaurant
4. Click "Activate POS"
5. **Watch both terminal and browser console**

### Step 3: Identify the Problem

After clicking "Activate POS" and app reloads, check logs:

#### Check 1: Session Flags (Browser Console)

Look for:
```javascript
[App] activation-in-progress: true  // Should be "true"
```

**If "null"**: Flag wasn't set or was cleared prematurely → Check TenantActivation.tsx

#### Check 2: Setup Wizard State (Browser Console)

Look for:
```javascript
[useNeedsSetup] isComplete: false  // Should be true after activation
```

**If false**: Setup wasn't marked complete → Post-activation processing didn't run

#### Check 3: Restaurant Settings (Browser Console)

Look for:
```javascript
[useNeedsSetup] settings.name: undefined  // Should have restaurant name
```

**If undefined**: Settings weren't loaded from database → Check next step

#### Check 4: Database Save (Terminal)

Look for:
```
[settings.rs] ===== save_restaurant_settings called =====
[settings.rs] ✅ Settings saved to SQLite successfully
```

**If missing**: `completeSetup()` never called `save_restaurant_settings`

**If present but error**: Database issue (table missing, locked, etc.)

#### Check 5: Database Read (Terminal)

Look for:
```
[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] ✅ Settings retrieved successfully
[settings.rs] Restaurant name: My Restaurant
```

**If missing**: Settings never loaded from database

**If "Restaurant name: Restaurant Name"**: Default values returned (save didn't work)

## Common Issues and What Logs Show

### Issue 1: Flag Not Set

**Symptom**: App shows setup wizard after activation

**Logs**:
```javascript
// Browser Console
[App] activation-in-progress: null  ← Should be "true"
[App] Will show setup wizard: true  ← Wrong!
[App] 🔀 ROUTING: Showing setup wizard  ← Wrong!
```

**Cause**: TenantActivation didn't set the flag

**Fix**: Check TenantActivation.tsx line 210

### Issue 2: Post-Activation Processing Didn't Run

**Symptom**: Setup not marked complete

**Logs**:
```javascript
// Browser Console
[App] activation-in-progress: true
[App] activation-needs-setup-completion: true
// But no logs showing:
[App] 🔄 Post-activation processing detected  ← Missing!
[App] Completing setup wizard...  ← Missing!
```

**Cause**: Post-activation processing code not executing

**Fix**: Check App.tsx checkAuth() function

### Issue 3: Database Save Failed

**Symptom**: Settings not saved to database

**Logs**:
```
// Terminal
[settings.rs] ===== save_restaurant_settings called =====
[settings.rs] ❌ Table does not exist - migration may not have run
```

**Cause**: Migration 024_restaurant_settings.sql hasn't run

**Fix**: Check migrations in lib.rs, restart app to run migrations

### Issue 4: Database Read Returns Defaults

**Symptom**: Settings show default values instead of saved data

**Logs**:
```
// Terminal
[settings.rs] ✅ Settings retrieved successfully
[settings.rs] Restaurant name: Restaurant Name  ← Default, not saved name!

// Browser Console
[useNeedsSetup] settings.name: "Restaurant Name"  ← Default
[useNeedsSetup] hasRequiredData: false  ← Fails check
```

**Cause**: Data wasn't actually saved (INSERT OR REPLACE failed silently)

**Fix**: Check terminal for save errors

### Issue 5: Flag Cleared Too Early

**Symptom**: Setup wizard shows even though processing should happen

**Logs**:
```javascript
// First render
[App] activation-in-progress: true  ← Good

// Few milliseconds later
[App] activation-in-progress: null  ← Bad! Cleared too early
[App] Will show setup wizard: true
```

**Cause**: Flag cleared before routing decision

**Fix**: Move flag clearing to later in the flow

## Expected Log Sequence (Success)

### Terminal (Rust):
```
[settings.rs] ===== save_restaurant_settings called =====
[settings.rs] Restaurant name: My Restaurant
[settings.rs] Database path: "/Users/.../pos.db"
[settings.rs] Database exists: true
[settings.rs] Database connection opened successfully
[settings.rs] restaurant_settings table exists: true
[settings.rs] Executing INSERT OR REPLACE query...
[settings.rs] ✅ Query succeeded, rows affected: 1
[settings.rs] ✅ Settings saved to SQLite successfully

[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] Database path: "/Users/.../pos.db"
[settings.rs] Database exists: true
[settings.rs] Database connection opened successfully
[settings.rs] ✅ Settings retrieved successfully
[settings.rs] Restaurant name: My Restaurant
[settings.rs] Address: Bangalore, Karnataka, 560001
[settings.rs] Phone: 9876543210
[settings.rs] Tax enabled: true
```

### Browser Console:
```javascript
// After activation click
[TenantActivation] Activation successful
[TenantActivation] Marking as new restaurant for post-reload processing
[TenantActivation] Device registered successfully
[TenantActivation] Navigating to hub

// After reload
[App] ===== ROUTING DECISION VARIABLES =====
[App] needsActivation: false
[App] needsSetup: true
[App] activation-in-progress: true
[App] activation-needs-setup-completion: true
[App] activation-needs-cloud-push: true
[App] ========================================

[App] ===== SETUP CHECK =====
[App] needsSetup: true
[App] activationInProgress: true
[App] Will show setup wizard: false  ← Correct!

[App] 🔄 Post-activation processing detected
[App] Completing setup wizard...

[useNeedsSetup] ===== SETUP CHECK =====
[useNeedsSetup] isComplete: false
[useNeedsSetup] settings.name: undefined
[useNeedsSetup] hasRequiredData: false
[useNeedsSetup] 🔀 RESULT: true (needs setup - no required data)

[SetupWizard] ===== STARTING SETUP COMPLETION =====
[App] ✅ Setup completed and saved to database
[App] Pushing local data to cloud...
[App] ✅ Local data pushed to cloud successfully
[App] Post-activation processing complete, flags cleared

// Settings now loaded
[useNeedsSetup] ===== SETUP CHECK =====
[useNeedsSetup] isComplete: true
[useNeedsSetup] settings.name: "My Restaurant"
[useNeedsSetup] hasRequiredData: true
[useNeedsSetup] ✅ Setup complete and data exists
[useNeedsSetup] 🔀 RESULT: false (no setup needed)

[App] Showing main app with routes
```

## How to Report Findings

When reporting the issue, include:

1. **Complete terminal output** from app start to after activation
2. **Complete browser console output** from activation click to after reload
3. **Which logs appear and which are missing**
4. **Specific error messages** (❌ markers in logs)
5. **Values of key variables**:
   - `activation-in-progress`
   - `isComplete`
   - `settings.name`
   - `hasRequiredData`

This will pinpoint exactly where the flow breaks!

## Files Modified

1. **src-tauri/src/commands/settings.rs**: Added terminal logging
   - Lines 72-93: `get_restaurant_settings` logging
   - Lines 156-277: `save_restaurant_settings` logging

2. **src/App.tsx**: Added browser console logging
   - Lines 319-329: Session flags and routing variables
   - Lines 834-838: Setup check decision

3. **src/stores/setupWizardStore.ts**: Added setup check logging
   - Lines 744-765: `useNeedsSetup()` detailed logging
   - Lines 766-792: Decision path logging

All logging uses clear prefixes:
- `[settings.rs]` - Rust backend
- `[App]` - App.tsx routing
- `[useNeedsSetup]` - Setup check logic
- `[SetupWizard]` - Setup wizard operations

Look for emoji indicators:
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 🔀 Decision point
- 🔄 Processing
