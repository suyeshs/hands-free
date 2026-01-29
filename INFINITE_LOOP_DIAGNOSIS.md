# Infinite Settings Loop - Diagnosis

## Problem
The app was stuck in an infinite loop:
- Saving restaurant settings with default values ("Restaurant Name")
- Loading settings back
- Saving again immediately
- This repeated endlessly, causing performance issues

## Observed Behavior
```
[settings.rs] Saving "Restaurant Name"
[settings.rs] Loading "Restaurant Name"
[settings.rs] Saving "Restaurant Name"
[settings.rs] Loading "Restaurant Name"
... (repeats forever)
```

## Likely Causes
1. **Reactive Save on Load**: Some component watches settings and automatically saves when they change
2. **No Dependency Array**: useEffect without proper dependencies
3. **Zustand Persist Middleware**: Auto-syncing between stores
4. **Initial State Save**: Default settings being saved on first load

## Guards in Place
The store already has guards (`isLoadingSettings`, `isUpdatingSettings`) to prevent loops, but they're not working.

## Next Steps
1. **Clean database deleted** ✅
2. **App restarted fresh**
3. **Need to identify the trigger**:
   - Check for components that call `updateSettings()` without user action
   - Look for sync logic that auto-saves
   - Review initialization code

## Temporary Solution
Database has been completely deleted. App should start fresh now.

## Permanent Fix Needed
Find and remove/fix the code that's triggering automatic saves.

---
**Date**: 2026-01-23
**Status**: Database cleared, investigating root cause
