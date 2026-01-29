# Activation Flow Test Steps

## Current Status
✅ Provisioning completed successfully
✅ Activation code generated: 6ZYC-3ZBM-7BSC-GEN3
✅ is_restaurant_owner flag should be set to 'true'

## Next Steps to Test

### Step 1: Verify Flag is Set
Before proceeding, check in browser console:
```javascript
localStorage.getItem('is_restaurant_owner')
// Should return: "true"

localStorage.getItem('pos_activation_code')
// Should return: "6ZYC-3ZBM-7BSC-GEN3"
```

### Step 2: Proceed to Activation
1. Click the "Proceed to Activation" or "Continue" button on the StoreCreationModal
2. You should be taken to the TenantActivation screen
3. The activation code should be auto-filled into the input fields

### Step 3: Watch Terminal BEFORE Clicking Activate
Before clicking "Activate POS", the terminal should show:
```
[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] Restaurant name: Restaurant Name
```
This is NORMAL - these are the default values loaded on app startup.

### Step 4: Click "Activate POS" and Watch Terminal
After clicking "Activate POS", you should see in the terminal (IN THIS ORDER):

```
[TenantActivation] ===== PRE-ACTIVATION STATE =====
[TenantActivation] is_restaurant_owner BEFORE clear: true
[TenantActivation] Clearing device registration...
[TenantActivation] Device registration cleared
[TenantActivation] Keeping setup wizard data: <some key name>
[TenantActivation] All old data cleared, activating new tenant
[TenantActivation] is_restaurant_owner AFTER clear: true
[TenantActivation] Calling activateTenant with code: 6ZYC-3ZBM-7BSC-GEN3
[TenantStore] Activating with code: 6ZYC****
[TenantStore] Activation successful: <tenant-id>
[TenantActivation] activateTenant returned success: true
[TenantActivation] Activation successful
[TenantActivation] ===== POST-ACTIVATION PROCESSING =====
[TenantActivation] is_restaurant_owner flag: true
[TenantActivation] isNewRestaurant: true
[TenantActivation] NEW restaurant - saving settings BEFORE reload
[TenantActivation] isComplete: true
[TenantActivation] hasRestaurantInfo: true
[TenantActivation] Wizard data available: {"restaurantInfo":{"name":"..."}}
[TenantActivation] Building settings object from wizard data...
[TenantActivation] Saving settings to SQLite...
[TenantActivation] Restaurant name: <YOUR RESTAURANT NAME>
[TenantActivation] Settings object: {...}

[settings.rs] ===== save_restaurant_settings called =====
[settings.rs] Restaurant name: <YOUR RESTAURANT NAME>  ← ACTUAL NAME!
[settings.rs] Database path: "/.../pos.db"
[settings.rs] Database exists: true
[settings.rs] Database connection opened successfully
[settings.rs] restaurant_settings table exists: true
[settings.rs] Executing INSERT OR REPLACE query...
[settings.rs] ✅ Query succeeded, rows affected: 1
[settings.rs] ✅ Settings saved to SQLite successfully

[TenantActivation] ✅ Settings save command completed
[TenantActivation] Validating save...

[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] ✅ Settings retrieved successfully
[settings.rs] Restaurant name: <YOUR RESTAURANT NAME>  ← ACTUAL NAME!

[TenantActivation] ✅ Settings saved and validated successfully
[TenantActivation] Device registered successfully
[TenantActivation] Navigating to hub
```

### Step 5: After Reload
After the app reloads, terminal should show:
```
[settings.rs] ===== get_restaurant_settings called =====
[settings.rs] Restaurant name: <YOUR RESTAURANT NAME>  ← NOT "Restaurant Name"!
[settings.rs] Address: <city>, <state>, <pincode>
[settings.rs] Phone: <phone>

[useNeedsSetup] ===== SETUP CHECK =====
[useNeedsSetup] settings.name: "<YOUR RESTAURANT NAME>"
[useNeedsSetup] hasRequiredData: true
[useNeedsSetup] 🔀 RESULT: false (no setup needed)

[App] needsSetup: false
[App] Showing main app with routes
```

## What to Look For

### ✅ Success Indicators:
1. `[TenantActivation] is_restaurant_owner flag: true`
2. `[TenantActivation] hasRestaurantInfo: true`
3. `[settings.rs] Restaurant name: <ACTUAL NAME>` (not "Restaurant Name")
4. `[settings.rs] ✅ Query succeeded, rows affected: 1`
5. `[TenantActivation] ✅ Settings saved and validated successfully`
6. After reload: Hub page loads (NOT setup wizard)

### ❌ Failure Indicators:
1. `[TenantActivation] is_restaurant_owner flag: null` or `false`
2. `[TenantActivation] ❌ No wizard data available!`
3. `[settings.rs] Restaurant name: Restaurant Name` (default)
4. After reload: Setup wizard shows again (loop)

## If Activation Logs Don't Show:

If you click "Activate POS" and don't see the TenantActivation logs, check:

1. **Are you on the TenantActivation screen?**
   - Should have 4 input boxes for activation code
   - Should have "Activate POS" button

2. **Is the activation code filled in?**
   - All 4 boxes should have 4 characters each

3. **Is the button enabled?**
   - Button should not be grayed out

4. **Check browser console for errors**
   - Press F12 to open DevTools
   - Look for any JavaScript errors

5. **Check if activation is being called**
   - Add this in browser console before clicking:
   ```javascript
   console.log('TEST: is_restaurant_owner =', localStorage.getItem('is_restaurant_owner'));
   ```

## Current Log Analysis

The log you showed:
```
[settings.rs] Restaurant name: Restaurant Name
[settings.rs] Address: , ,
```

This is from App.tsx loading settings on startup. This is EXPECTED before activation.

You haven't shown any TenantActivation logs yet, which means you probably haven't clicked "Activate POS" yet.

## Next Action

Please:
1. Proceed to the TenantActivation screen (from StoreCreationModal)
2. Verify activation code is filled in
3. Click "Activate POS"
4. **Copy and paste ALL terminal output** that appears
5. Share the full terminal log here

This will help me see exactly where the flow is breaking.
