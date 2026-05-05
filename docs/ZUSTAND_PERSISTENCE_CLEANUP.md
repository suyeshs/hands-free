# Zustand Persistence Cleanup Plan

## Problem
27 Zustand stores are using `persist()` middleware to save data to localStorage, creating data duplication and staleness issues. SQLite should be the single source of truth for all persistent data.

## Architecture Principle
**SQLite = Single Source of Truth**
- Zustand stores should be **in-memory only** for reactive UI updates
- All data should be loaded from SQLite on mount
- All mutations should be written to SQLite immediately
- Zustand should only cache/mirror SQLite state for performance

## Stores to Fix (Remove persist())

### Critical - Data Stores (Use SQLite Only)
1. **staffStore.ts** - Already has SQLite methods, remove persist
2. **payrollStore.ts** - Remove persist
3. **attendanceStore.ts** - Remove persist
4. **rosteringStore.ts** - Remove persist
5. **inventoryStore.ts** - Remove persist
6. **barInventoryStore.ts** - Remove persist
7. **leaveStore.ts** - Remove persist
8. **multiLocationStore.ts** - Remove persist
9. **chainConfigStore.ts** - Remove persist
10. **guestSessionStore.ts** - Move to SQLite sessions table
11. **aggregatorExtractionStore.ts** - Use SQLite
12. **trainingStore.ts** - Use SQLite
13. **deliveryVerificationStore.ts** - Use SQLite
14. **qrOrderingStore.ts** - Use SQLite
15. **barPOSStore.ts** - Use SQLite
16. **notificationStore.ts** - Use SQLite

### Keep persist() - UI Preferences Only
These can keep localStorage for user preferences:
- **languageStore.ts** - UI language (OK)
- **themeStore.ts** - Theme preferences (OK)
- **printerStore.ts** - Printer settings (OK)
- **deviceStore.ts** - Device config (OK)
- **printStore.ts** - Print preferences (OK)
- **remotePrintStore.ts** - Remote print settings (OK)
- **aggregatorSettingsStore.ts** - Aggregator UI settings (OK)

### Keep for Auth/Session
- **authStore.ts** - Keep for auth tokens, but clear on logout
- **provisioningStore.ts** - Keep for setup workflow state
- **handsfreeSetupStore.ts** - Keep for onboarding state
- **setupWizardStore.ts** - Keep for wizard state

### Transient State (sessionStorage OK)
- **posStore.ts** - Uses sessionStorage for current order (OK)

## Implementation Pattern

### Before (with persist):
```typescript
export const useStaffStore = create<StaffStore>()(
  persist(
    (set, get) => ({
      staff: [],
      loadStaffFromDatabase: async (tenantId) => {
        // Load from SQLite...
      },
      // ...
    }),
    { name: 'staff-storage' }
  )
);
```

### After (SQLite only):
```typescript
export const useStaffStore = create<StaffStore>()((set, get) => ({
  staff: [],
  isLoaded: false,

  // Auto-load on first access
  loadStaffFromDatabase: async (tenantId) => {
    if (get().isLoaded) return; // Prevent re-loading

    const db = await Database.load(DB_NAME);
    const rows = await db.select(
      'SELECT * FROM staff WHERE tenant_id = ?',
      [tenantId]
    );

    set({
      staff: rows.map(mapRowToStaff),
      isLoaded: true
    });
  },

  addStaff: async (staff, tenantId) => {
    // 1. Write to SQLite
    const db = await Database.load(DB_NAME);
    await db.execute(
      'INSERT INTO staff (...) VALUES (...)',
      [...]
    );

    // 2. Update Zustand (for reactive UI)
    set(state => ({
      staff: [...state.staff, newStaff]
    }));
  },

  // NO persist() middleware!
}));
```

## Benefits
1. **Single source of truth** - No data duplication
2. **No stale data** - Deleting DB = truly fresh start
3. **Better sync** - Multi-device sync only needs to sync SQLite
4. **Simpler debugging** - One place to check data
5. **Better performance** - No serialization/deserialization overhead

## Migration Steps
1. Remove `persist()` wrapper from data stores
2. Add `isLoaded` flag to prevent re-fetching
3. Ensure all CRUD operations write to SQLite first
4. Clear localStorage keys from old stores
5. Test fresh install flow

## localStorage Cleanup Script
Add to app startup:
```typescript
// Clear old localStorage from migrated stores
const storesToClear = [
  'staff-storage',
  'payroll-storage',
  'attendance-storage',
  // ... add all migrated stores
];

storesToClear.forEach(key => {
  localStorage.removeItem(key);
});
```
