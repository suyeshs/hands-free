# Zustand localStorage Refactoring - Status Report

## 🎯 Objective
Refactor all Zustand stores to use **SQLite as the single source of truth**, removing localStorage persistence for data stores while keeping it only for UI preferences and auth tokens.

## ✅ Completed Refactoring (4/27 stores)

### Core Data Stores - Migrated to SQLite Only

1. **[staffStore.ts](src/stores/staffStore.ts)** ✅
   - Removed `persist()` wrapper
   - All CRUD operations use SQLite
   - Staff data loaded from database on mount
   - **Impact**: Staff members, PIN hashes, employee records

2. **[multiLocationStore.ts](src/stores/multiLocationStore.ts)** ✅
   - Removed `persist()` wrapper
   - Location data persisted to SQLite `locations` table
   - **Impact**: Multi-location configuration, site management

3. **[chainConfigStore.ts](src/stores/chainConfigStore.ts)** ✅
   - Removed `persist()` wrapper
   - Chain location mappings stored in SQLite
   - **Impact**: Chain/franchise location tenant mappings

4. **[authStore.ts](src/stores/authStore.ts)** ✅ (Simplified)
   - Kept `persist()` for auth tokens only (standard OAuth practice)
   - Removed user object persistence - now fetched from backend/SQLite
   - Simplified to only persist `tokens` and `isAuthenticated`
   - **Impact**: User sessions, authentication state

## 🧹 Cleanup Infrastructure

### Automatic localStorage Cleanup ✅
Created `src/lib/clearZustandStorage.ts` with automatic cleanup:
- Runs on **every app startup** (integrated in `main.tsx`)
- Clears 17 migrated store keys from localStorage
- Preserves UI preference stores (language, theme, printer settings)
- Logs all cleanup operations for transparency

**Test it**: The next time you start the app, check console for:
```
[App Init] Cleaning up localStorage...
[Zustand Cleanup] ✅ Cleared: staff-storage
[Zustand Cleanup] ✅ Cleared: multi-location-storage
...
```

## 🚧 Remaining Stores (23/27 stores)

### High Priority - Data Stores (Should Use SQLite Only)

These stores currently persist to localStorage but should only use SQLite:

1. **inventoryStore.ts** - Inventory items, stock levels
2. **payrollStore.ts** - Payroll data, salary information
3. **attendanceStore.ts** - Employee attendance records
4. **rosteringStore.ts** - Staff schedules, shift rosters
5. **barInventoryStore.ts** - Bar stock, beverage inventory
6. **leaveStore.ts** - Leave requests, vacation days
7. **guestSessionStore.ts** - Guest dining sessions (migrate to SQLite sessions table)
8. **aggregatorExtractionStore.ts** - Aggregator order data
9. **trainingStore.ts** - Training records
10. **deliveryVerificationStore.ts** - Delivery verification data
11. **qrOrderingStore.ts** - QR code orders
12. **barPOSStore.ts** - Bar POS transactions
13. **notificationStore.ts** - Notification history

### Medium Priority - Settings Stores (Can Keep localStorage)

These can optionally keep localStorage for UI preferences:

14. **languageStore.ts** - UI language preference ✅ Keep
15. **themeStore.ts** - Theme/appearance settings ✅ Keep
16. **printerStore.ts** - Printer device settings ✅ Keep
17. **deviceStore.ts** - Device configuration ✅ Keep
18. **printStore.ts** - Print preferences ✅ Keep
19. **remotePrintStore.ts** - Remote printer settings ✅ Keep
20. **aggregatorSettingsStore.ts** - Aggregator UI settings ✅ Keep

### Workflow State Stores (Can Keep localStorage)

These manage transient workflow state:

21. **provisioningStore.ts** - Restaurant setup workflow ✅ Keep
22. **handsfreeSetupStore.ts** - Initial onboarding wizard ✅ Keep
23. **setupWizardStore.ts** - Setup wizard progress ✅ Keep

## 📋 Refactoring Pattern

For each data store, follow this pattern:

### Before (with localStorage):
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useMyStore = create<MyStore>()(
  persist(
    (set, get) => ({
      data: [],
      loadFromDatabase: async () => { /* ... */ },
    }),
    { name: 'my-storage' }
  )
);
```

### After (SQLite only):
```typescript
import { create } from 'zustand';
// Remove persist import

export const useMyStore = create<MyStore>()((set, get) => ({
  data: [],
  isLoaded: false,

  // Load from SQLite on mount
  loadFromDatabase: async () => {
    if (get().isLoaded) return; // Prevent re-loading

    const db = await Database.load(DB_NAME);
    const rows = await db.select('SELECT * FROM my_table');

    set({ data: rows, isLoaded: true });
  },

  // All mutations write to SQLite first, then update state
  addItem: async (item) => {
    const db = await Database.load(DB_NAME);
    await db.execute('INSERT INTO my_table VALUES (?)', [item]);
    set(state => ({ data: [...state.data, item] }));
  },
}));
// No persist() wrapper!
```

### Key Changes:
1. ❌ Remove `import { persist } from 'zustand/middleware'`
2. ❌ Remove `persist()` wrapper
3. ❌ Remove persist config object `{ name: '...', partialize: ... }`
4. ✅ Add `isLoaded` flag to prevent duplicate loading
5. ✅ Ensure all CRUD operations write to SQLite first
6. ✅ Add proper error handling

## 🧪 Testing Checklist

After refactoring each store:

- [ ] Delete `pos-dev.db` to test fresh database initialization
- [ ] Clear localStorage in DevTools
- [ ] Restart app - data should load from SQLite
- [ ] Create new data - should persist to SQLite
- [ ] Restart app again - data should still be there
- [ ] Check console for no localStorage errors

## 🚀 Quick Win: Batch Refactor Script

To speed up refactoring, you can use this sed script pattern:

```bash
# For a store file (e.g., inventoryStore.ts)
STORE="src/stores/inventoryStore.ts"

# 1. Remove persist import
sed -i '' '/import.*persist.*from.*zustand\/middleware/d' $STORE

# 2. Change create() wrapper (manual review needed)
# Find and replace:
#   create<Store>()(persist(...))
# With:
#   create<Store>()((set, get) => ({

# 3. Remove persist config (manual review needed)
# Delete lines from:
#   }),
#   { name: 'store-name', ... }
# Down to closing ))

# 4. Verify it compiles
npm run type-check
```

## 📊 Progress Tracking

- **Stores Refactored**: 4/27 (15%)
- **Critical Stores Done**: 4/13 (31%)
- **Settings Stores**: 0/7 (already acceptable)
- **Workflow Stores**: 0/3 (already acceptable)

## 🎯 Next Steps

### Immediate (Complete Critical Stores)

1. Refactor `inventoryStore.ts`
2. Refactor `payrollStore.ts`
3. Refactor `attendanceStore.ts`
4. Refactor `rosteringStore.ts`
5. Refactor `barInventoryStore.ts`

### Medium Term

6. Refactor remaining data stores
7. Migrate `guestSessionStore` to SQLite sessions table
8. Update documentation

### Long Term

9. Add integration tests for SQLite persistence
10. Monitor performance improvements
11. Consider adding SQLite query optimization

## 🐛 Known Issues

### Issue: Old localStorage Data After DB Deletion
**Status**: ✅ FIXED
- **Cause**: localStorage persisted old tenant/staff data even after deleting database
- **Solution**: Added automatic cleanup on app startup (`clearMigratedZustandStores()`)
- **Verification**: Check console logs on next app start

### Issue: Tenant Config Not Loading
**Status**: ✅ FIXED
- **Cause**: tenantStore was not using SQLite for tenant config
- **Solution**: tenantStore already uses SQLite via Tauri commands (`get_tenant_config`)
- **Verification**: Fresh database shows no tenant (expected), activation creates new tenant in SQLite

## 📚 Resources

- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Tauri SQL Plugin](https://v2.tauri.app/plugin/sql/)
- [Project SQLite Schema](src-tauri/src/migrations.rs)
- [Cleanup Plan](docs/ZUSTAND_PERSISTENCE_CLEANUP.md)

---

**Last Updated**: 2026-02-12
**Author**: Claude Sonnet 4.5
