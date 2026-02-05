# SQLite-Based Setup Wizard State Implementation

## Problem

The current implementation uses Zustand persist → localStorage, which has fundamental race conditions with `window.location.reload()`:

1. `setState()` updates in-memory state immediately
2. Zustand persist middleware DEBOUNCES the write (100-300ms)
3. `window.location.reload()` is called before persist completes
4. On reload, localStorage still has stale state
5. → Infinite routing loop

## Solution

Move wizard state to SQLite, eliminating localStorage entirely.

## Implementation Status

### ✅ Completed

1. **Migration**: `src-tauri/migrations/025_setup_wizard_state.sql`
   - Creates `setup_wizard_state` table (singleton pattern, id=1)
   - Stores all wizard state as JSON columns

2. **Rust Commands**: `src-tauri/src/commands/wizard.rs`
   - `get_setup_wizard_state()` - Read from SQLite
   - `save_setup_wizard_state()` - Write to SQLite (atomic)
   - `reset_setup_wizard_state()` - Reset to defaults

3. **Registration**: Updated `lib.rs` and `mod.rs`
   - Commands registered with Tauri
   - Ready to invoke from TypeScript

4. **TypeScript Service**: `src/services/tauriSetupWizard.ts`
   - Wrapper functions for Rust commands
   - Handles JSON serialization/deserialization

### 🔨 Next Steps

1. **Update setupWizardStore.ts**:
   ```typescript
   - Remove persist() wrapper
   - Add loadFromSQLite() method
   - Add saveToSQLite() method (call after every state change)
   - Auto-save on all actions (setState, markComplete, etc.)
   ```

2. **Update SystemCheckScreen.tsx**:
   ```typescript
   - After setting isComplete=true, await saveToSQLite()
   - Verify save completed before reload
   - No more waiting for persist middleware
   ```

3. **Update App.tsx**:
   ```typescript
   - Call loadFromSQLite() on app init
   - Ensure wizard state is loaded before routing
   ```

4. **Remove localStorage flags**:
   - `activation-just-completed` no longer needed
   - Auto-reset check can rely on SQLite data accuracy

## Benefits

1. ✅ **No race conditions** - Atomic writes, no debounce
2. ✅ **Synchronous guarantee** - Can await write completion
3. ✅ **Single source of truth** - All state in SQLite
4. ✅ **More reliable** - Survives crashes, no localStorage limits
5. ✅ **Consistent architecture** - Matches restaurant settings pattern

## Testing Plan

1. **Fresh setup flow**:
   - Clear database
   - Complete wizard
   - Verify routing to hub (no loop)

2. **Reload during setup**:
   - Start wizard
   - Reload page mid-setup
   - Verify state persists correctly

3. **Corrupted state recovery**:
   - Complete setup
   - Delete restaurant settings
   - Verify auto-reset still works

## Files Modified

- ✅ `src-tauri/migrations/025_setup_wizard_state.sql`
- ✅ `src-tauri/src/commands/wizard.rs`
- ✅ `src-tauri/src/commands/mod.rs`
- ✅ `src-tauri/src/lib.rs`
- ✅ `src/services/tauriSetupWizard.ts`
- 🔨 `src/stores/setupWizardStore.ts` (next)
- 🔨 `src/components/setup/screens/SystemCheckScreen.tsx` (next)
- 🔨 `src/App.tsx` (next)
- 🔨 `src/stores/setupWizardStore.ts` - Remove localStorage auto-reset check (next)

## Breaking Changes

None - this is a drop-in replacement. The store API remains the same, only the persistence mechanism changes.

## Rollback Plan

If issues arise, can revert to localStorage by:
1. Re-add persist() wrapper to setupWizardStore
2. Remove SQLite calls
3. Drop migration 025

But the goal is to eliminate localStorage entirely for critical state.
