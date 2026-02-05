# Diagnostic Logging Added to Track Infinite Loop

## Summary

Added comprehensive diagnostic logging to track the infinite `save_restaurant_settings` loop issue. The guard was changed from `useState` to `useRef`, but the loop persists, so we need to understand WHY.

## What Was Added

### 1. SystemCheckScreen.tsx - handleProvisioningComplete Function

**Unique Call ID**: Each invocation gets a unique ID (timestamp + random string)

**Tracking Points**:
- 🔍 Function entry (every time it's called)
- 🔍 Guard value BEFORE the check
- 🔍 Activation code received
- 🔍 Full stack trace of the caller
- ⚠️ Guard BLOCKED message (if duplicate call detected)
- ✅ Guard PASSED message (if first/valid call)
- 🔒 Guard value AFTER setting to true
- 📝 When updateSettings is about to be called
- ✅ When updateSettings completes (with duration)

**Example Log Pattern**:
```
[SystemCheckScreen] 🔍 DIAGNOSTIC call-1234567890-abc123def: handleProvisioningComplete invoked
[SystemCheckScreen] 🔍 DIAGNOSTIC call-1234567890-abc123def: Guard value BEFORE check: false
[SystemCheckScreen] 🔍 DIAGNOSTIC call-1234567890-abc123def: Activation code: ABC-123-XYZ
[SystemCheckScreen] 🔍 DIAGNOSTIC call-1234567890-abc123def: Stack trace: ...
[SystemCheckScreen] ✅ DIAGNOSTIC call-1234567890-abc123def: GUARD PASSED! Setting guard to true...
[SystemCheckScreen] 🔒 DIAGNOSTIC call-1234567890-abc123def: Guard value AFTER setting: true
[SystemCheckScreen] 📝 DIAGNOSTIC call-1234567890-abc123def: CALLING updateSettings NOW...
[SystemCheckScreen] ✅ DIAGNOSTIC call-1234567890-abc123def: updateSettings COMPLETED in 45ms
```

### 2. restaurantSettingsStore.ts - updateSettings Method

**Unique Update ID**: Each call gets a unique ID (timestamp + random string)

**Tracking Points**:
- 🔍 Method entry (every time updateSettings is called from ANY source)
- 🔍 New settings being applied
- 🔍 Full stack trace of the caller
- 📝 When saveRestaurantSettings (Rust) is about to be called
- ✅ When saveRestaurantSettings completes (with duration)
- ❌ If save fails

**Example Log Pattern**:
```
[RestaurantSettings] 🔍 DIAGNOSTIC update-1234567890-xyz789: updateSettings CALLED
[RestaurantSettings] 🔍 DIAGNOSTIC update-1234567890-xyz789: New settings: {...}
[RestaurantSettings] 🔍 DIAGNOSTIC update-1234567890-xyz789: Stack trace: ...
[RestaurantSettings] 📝 DIAGNOSTIC update-1234567890-xyz789: CALLING saveRestaurantSettings...
[RestaurantSettings] ✅ DIAGNOSTIC update-1234567890-xyz789: saveRestaurantSettings COMPLETED in 12ms
```

## What We're Looking For

### Scenario 1: Guard is Working (Expected)

If the guard is working correctly, you should see:

```
// First call - ALLOWED
[SystemCheckScreen] 🔍 DIAGNOSTIC call-123-abc: handleProvisioningComplete invoked
[SystemCheckScreen] 🔍 DIAGNOSTIC call-123-abc: Guard value BEFORE check: false
[SystemCheckScreen] ✅ DIAGNOSTIC call-123-abc: GUARD PASSED!
[SystemCheckScreen] 🔒 DIAGNOSTIC call-123-abc: Guard value AFTER setting: true
[SystemCheckScreen] 📝 DIAGNOSTIC call-123-abc: CALLING updateSettings NOW...
[RestaurantSettings] 🔍 DIAGNOSTIC update-456-xyz: updateSettings CALLED
[RestaurantSettings] ✅ DIAGNOSTIC update-456-xyz: COMPLETED

// Second call - BLOCKED
[SystemCheckScreen] 🔍 DIAGNOSTIC call-789-def: handleProvisioningComplete invoked
[SystemCheckScreen] 🔍 DIAGNOSTIC call-789-def: Guard value BEFORE check: true
[SystemCheckScreen] ⚠️ DIAGNOSTIC call-789-def: GUARD BLOCKED!

// No more updateSettings calls!
```

**Result**: Only ONE call to `updateSettings`, infinite loop is FIXED! ✅

### Scenario 2: Guard is NOT Working (Current Bug)

If the guard is bypassed or not working:

```
// First call
[SystemCheckScreen] 🔍 DIAGNOSTIC call-123-abc: Guard BEFORE: false
[SystemCheckScreen] ✅ DIAGNOSTIC call-123-abc: GUARD PASSED!
[RestaurantSettings] 🔍 DIAGNOSTIC update-456-xyz: updateSettings CALLED

// Second call - SHOULD be blocked but isn't!
[SystemCheckScreen] 🔍 DIAGNOSTIC call-789-def: Guard BEFORE: false  ← PROBLEM!
[SystemCheckScreen] ✅ DIAGNOSTIC call-789-def: GUARD PASSED!  ← PROBLEM!
[RestaurantSettings] 🔍 DIAGNOSTIC update-012-ghi: updateSettings CALLED

// Loop continues...
```

**Possible Causes**:
- Component is being recreated (new instance, new ref)
- Guard ref is being reset somehow
- Multiple event listeners attached
- React is calling the function multiple times

### Scenario 3: updateSettings Called Directly (Bypass)

If something else is calling `updateSettings` directly, bypassing the guard:

```
// handleProvisioningComplete called once - guard works
[SystemCheckScreen] 🔍 DIAGNOSTIC call-123-abc: Guard PASSED!
[RestaurantSettings] 🔍 DIAGNOSTIC update-456-xyz: updateSettings CALLED

// BUT - updateSettings keeps being called from elsewhere!
[RestaurantSettings] 🔍 DIAGNOSTIC update-789-abc: updateSettings CALLED
[RestaurantSettings] 🔍 DIAGNOSTIC update-012-def: updateSettings CALLED
[RestaurantSettings] 🔍 DIAGNOSTIC update-345-ghi: updateSettings CALLED
```

**Check the stack traces** to see WHO is calling `updateSettings`.

## How to Test

1. **Clear all data**:
   ```bash
   rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos/
   ```

2. **Start app**:
   ```bash
   bun tauri dev
   ```

3. **Complete setup wizard**:
   - Fill out restaurant info
   - Complete all steps
   - Provisioning modal appears

4. **Click "Go to Dashboard" button**

5. **Watch the console logs carefully**:
   - Count how many times `handleProvisioningComplete` is invoked
   - Check the guard values (should stay `true` after first call)
   - Count how many times `updateSettings` is called
   - Check the stack traces to see WHO is calling it

## Expected Outcomes

### ✅ SUCCESS (Loop Fixed)
- `handleProvisioningComplete` called once
- Guard blocks subsequent calls
- `updateSettings` called exactly ONCE
- App navigates to Hub

### ❌ FAILURE (Loop Persists)
- `handleProvisioningComplete` called multiple times with guard=false
  → Component is being recreated OR guard is being reset

- `handleProvisioningComplete` called once, but `updateSettings` called 50+ times
  → Something else is calling `updateSettings` directly (check stack traces!)

## Files Modified

1. ✅ `src/components/setup/screens/SystemCheckScreen.tsx`
   - Added diagnostic logging to `handleProvisioningComplete`
   - Tracks: call ID, guard values, timing, stack trace

2. ✅ `src/stores/restaurantSettingsStore.ts`
   - Added diagnostic logging to `updateSettings`
   - Tracks: update ID, settings, timing, stack trace

3. ✅ `src/components/StoreCreationModal.tsx`
   - Already has subdomain display (previous change)

## Next Steps After Testing

Once you run the test and see the logs:

1. **If Scenario 1 (Guard Working)**:
   - Loop is FIXED! ✅
   - Remove diagnostic logs (optional cleanup)
   - Test the complete flow

2. **If Scenario 2 (Guard Not Working)**:
   - Component is being recreated - need to move guard outside component
   - OR React is re-mounting the component repeatedly

3. **If Scenario 3 (updateSettings Called Directly)**:
   - Check the stack traces in the logs
   - Find what's calling `updateSettings` repeatedly
   - Add guard there OR fix the calling code

## Debugging Tips

**Copy the full console output** and look for patterns:

1. **Count the call IDs**: How many unique calls to `handleProvisioningComplete`?
2. **Check guard transitions**: Does it go `false → true → false` (bad!) or stay `true` (good)?
3. **Match IDs**: Does each `call-XXX` have exactly one corresponding `update-YYY`?
4. **Stack traces**: Are they all from the same source or different sources?

## Why This Will Help

The original logs just showed:
```
[settings.rs] save_restaurant_settings called
[settings.rs] save_restaurant_settings called
[settings.rs] save_restaurant_settings called
... (50+ times)
```

**We couldn't tell**:
- Is `handleProvisioningComplete` being called 50 times?
- OR is `updateSettings` being called 50 times from elsewhere?
- OR is the guard not working?

**Now we can see**:
- Exactly how many times each function is called
- Whether the guard is working or being bypassed
- WHO is calling each function (stack traces)
- Timing information (to spot loops vs sequential calls)

This will pinpoint the EXACT cause of the infinite loop.
