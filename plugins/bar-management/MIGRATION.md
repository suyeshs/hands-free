# Bar Management Plugin - Migration Guide

This guide explains how to migrate from the built-in bar management code to the WASM plugin.

## Overview

The bar plugin replaces business logic from:
- `src/lib/barClosingService.ts` (180 lines)
- `src/lib/barRecipeService.ts` (317 lines)
- Business logic in `src/stores/barStore.ts`

## Migration Strategy

### Phase 1: Install Plugin (No Breaking Changes)
Install the plugin alongside existing code. The plugin is optional at this stage.

```typescript
// In app initialization
import { usePluginStore } from '@/stores/pluginStore';

const pluginStore = usePluginStore();
await pluginStore.install('bar-management', '1.0.0');
```

### Phase 2: Update Components to Use Plugin

#### Before (Using Built-in Service):

```typescript
// src/pages-v2/BarClosing.tsx
import { barRecipeService } from '@/lib/barRecipeService';
import { barClosingService } from '@/lib/barClosingService';

function BarClosing() {
  const calculatePourCost = async (recipe: Recipe, items: InventoryItem[]) => {
    const cost = barRecipeService.calculatePourCost(recipe, items);
    setPourCost(cost);
  };

  const calculateVariance = (item: InventoryItem, expected, actual) => {
    const variance = barClosingService.calculateVariance(item, expected, actual);
    setVariance(variance);
  };

  // ... rest of component
}
```

#### After (Using Plugin):

```typescript
// src/pages-v2/BarClosing.tsx
import { useWasm } from '@/hooks/useWasm';

function BarClosing() {
  const { instance, loading, error, invoke } = useWasm('bar-management');

  const calculatePourCost = async (recipe: Recipe, items: InventoryItem[]) => {
    if (!instance) return;

    const result = await invoke<string>(
      'calculate_pour_cost',
      JSON.stringify(recipe),
      JSON.stringify(items)
    );

    const data = JSON.parse(result);
    setPourCost(data.totalCost);
  };

  const calculateVariance = async (item: InventoryItem, expected, actual) => {
    if (!instance) return;

    const input = {
      expectedFullBottles: expected.fullBottles,
      expectedPartialMl: expected.partialMl,
      actualFullBottles: actual.fullBottles,
      actualPartialMl: actual.partialMl,
      containerSizeMl: item.containerSizeMl,
      costPerContainer: item.costPerContainer,
    };

    const result = await invoke<string>('calculate_variance', JSON.stringify(input));
    const variance = JSON.parse(result);
    setVariance(variance);
  };

  if (loading) return <div>Loading bar plugin...</div>;
  if (error) return <div>Error loading plugin: {error.message}</div>;

  // ... rest of component
}
```

### Phase 3: Replace Worker-Side Logic

#### Before (Using Built-in Service):

```typescript
// src/lib/barClosingService.ts
async getOpeningStock(tenantId: string, sessionDate: string) {
  // Query SQLite locally
  const previousSessions = await barInventoryService.getClosingSessions(...);
  // ... complex logic
}
```

#### After (Using Worker Plugin):

```typescript
// Call worker plugin API
async getOpeningStock(tenantId: string, sessionDate: string) {
  const response = await fetch(
    `/api/plugin/bar-management/${tenantId}/opening-stock`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, sessionDate }),
    }
  );

  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}
```

## Detailed Migration by File

### 1. BarDashboard.tsx

**Before:**
```typescript
import { useBDSStore } from '../stores/barStore';

const {
  activeOrders,
  fetchOrders,
  markItemReady,
} = useBDSStore();
```

**After:**
```typescript
import { useBDSStore } from '../stores/barStore';
import { useWasm } from '@/hooks/useWasm';

const barPlugin = useWasm('bar-management');

const {
  activeOrders,
  fetchOrders,
  markItemReady,
} = useBDSStore();

// Use plugin for calculations
const calculateIngredientCosts = async (order) => {
  if (!barPlugin.instance) return;

  const result = await barPlugin.invoke(
    'calculate_pour_cost',
    JSON.stringify(order.recipe),
    JSON.stringify(inventory)
  );

  return JSON.parse(result);
};
```

### 2. Bar Recipe Service Migration

**File to migrate:** `src/lib/barRecipeService.ts`

**Functions to replace with client WASM:**
- `calculatePourCost()` → `calculate_pour_cost()`
- `checkIngredientAvailability()` → `check_ingredient_availability()`
- `calculatePriceWithMarkup()` → `calculate_drink_price()`

**Functions to replace with worker API:**
- `deductIngredientsForOrder()` → Worker handles via event
- `getTotalUsage()` → Worker API endpoint

**Migration steps:**
1. Create wrapper functions that call plugin
2. Keep old functions as fallback
3. Test thoroughly
4. Remove old functions after validation

**Example wrapper:**
```typescript
// New: src/lib/barPluginWrapper.ts
import { getPluginManager } from '@/services/plugins/pluginManager';

export async function calculatePourCost(
  recipe: BarRecipe,
  items: BarInventoryItem[]
): Promise<number> {
  const manager = getPluginManager(tenantId);

  try {
    // Try plugin first
    const instance = await manager.loadWasm('bar-management');
    const fn = instance.exports.calculate_pour_cost as CallableFunction;
    const result = await fn(JSON.stringify(recipe), JSON.stringify(items));
    const data = JSON.parse(result as string);
    return data.totalCost;
  } catch (error) {
    // Fallback to built-in (for backwards compatibility)
    console.warn('Bar plugin not available, using built-in logic');
    return barRecipeService.calculatePourCost(recipe, items);
  }
}
```

### 3. Bar Closing Service Migration

**File to migrate:** `src/lib/barClosingService.ts`

**Functions to replace with worker API:**
- `getOpeningStock()` → `POST /api/plugin/bar-management/{tenantId}/opening-stock`
- `calculateExpectedInventory()` → `POST /api/plugin/bar-management/{tenantId}/expected-inventory`
- `generateUsageSummary()` → `POST /api/plugin/bar-management/{tenantId}/usage-summary`
- `finalizeClosingSession()` → `POST /api/plugin/bar-management/{tenantId}/finalize-session`

**Functions to replace with client WASM:**
- `calculateVariance()` → `calculate_variance()`

**Example wrapper:**
```typescript
// New: src/lib/barClosingPluginWrapper.ts

export async function getOpeningStock(
  tenantId: string,
  sessionDate: string
): Promise<Map<string, OpeningStock>> {
  try {
    // Call worker plugin
    const response = await fetch(
      `/api/plugin/bar-management/${tenantId}/opening-stock`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, sessionDate }),
      }
    );

    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    // Convert array to Map
    const map = new Map();
    for (const item of result.data) {
      map.set(item.itemId, item);
    }
    return map;
  } catch (error) {
    // Fallback to built-in
    console.warn('Bar plugin worker not available, using built-in logic');
    return barClosingService.getOpeningStock(tenantId, sessionDate);
  }
}
```

## Testing Strategy

### 1. Parallel Testing (Recommended)
Run both old and new implementations side-by-side and compare results.

```typescript
async function testPourCostCalculation(recipe: Recipe, items: InventoryItem[]) {
  // Old method
  const oldResult = barRecipeService.calculatePourCost(recipe, items);

  // New method (plugin)
  const manager = getPluginManager(tenantId);
  const instance = await manager.loadWasm('bar-management');
  const fn = instance.exports.calculate_pour_cost as CallableFunction;
  const pluginResult = await fn(JSON.stringify(recipe), JSON.stringify(items));
  const newResult = JSON.parse(pluginResult as string).totalCost;

  // Compare
  const diff = Math.abs(oldResult - newResult);
  if (diff > 0.01) {
    console.error('Calculation mismatch!', { oldResult, newResult, diff });
  } else {
    console.log('✅ Results match!', { oldResult, newResult });
  }
}
```

### 2. Unit Tests
Create unit tests for plugin functions:

```typescript
// tests/plugins/barManagement.test.ts
import { describe, it, expect } from 'bun:test';
import { getPluginManager } from '@/services/plugins/pluginManager';

describe('Bar Management Plugin', () => {
  it('should calculate pour cost correctly', async () => {
    const manager = getPluginManager('test-tenant');
    await manager.install('bar-management');
    const instance = await manager.loadWasm('bar-management');

    const recipe = {
      id: 'recipe-1',
      drinkName: 'Mojito',
      ingredients: [
        { inventoryItemId: 'rum', quantityMl: 60, isOptional: false },
      ],
    };

    const items = [
      {
        id: 'rum',
        name: 'White Rum',
        costPerContainer: 1500,
        containerSizeMl: 750,
      },
    ];

    const fn = instance.exports.calculate_pour_cost as CallableFunction;
    const result = await fn(JSON.stringify(recipe), JSON.stringify(items));
    const data = JSON.parse(result as string);

    expect(data.totalCost).toBeCloseTo(120, 2); // 60ml * (1500/750) = 120
  });

  it('should detect missing ingredients', async () => {
    const manager = getPluginManager('test-tenant');
    const instance = await manager.loadWasm('bar-management');

    const recipe = {
      id: 'recipe-1',
      drinkName: 'Mojito',
      ingredients: [
        { inventoryItemId: 'mint', quantityMl: 30, isOptional: false },
      ],
    };

    const items = [
      {
        id: 'mint',
        name: 'Mint Leaves',
        fullContainers: 0,
        partialContainerMl: 10,
        containerSizeMl: 100,
      },
    ];

    const fn = instance.exports.check_ingredient_availability as CallableFunction;
    const result = await fn(JSON.stringify(recipe), JSON.stringify(items), 1);
    const data = JSON.parse(result as string);

    expect(data.available).toBe(false);
    expect(data.missingItems).toHaveLength(1);
    expect(data.missingItems[0].shortageMl).toBe(20);
  });
});
```

### 3. Integration Tests
Test full workflows:

```typescript
describe('Bar Closing Workflow', () => {
  it('should complete full closing process', async () => {
    // 1. Get opening stock
    const openingStock = await getOpeningStock('tenant-123', '2026-01-29');
    expect(openingStock.size).toBeGreaterThan(0);

    // 2. Calculate expected inventory
    const expected = await calculateExpectedInventory(...);
    expect(expected).toBeDefined();

    // 3. Calculate variance
    const variance = await calculateVariance(...);
    expect(variance.varianceMl).toBeDefined();

    // 4. Finalize session
    const summary = await finalizeClosingSession('session-123', 'tenant-123');
    expect(summary.itemsCounted).toBeGreaterThan(0);
  });
});
```

## Performance Comparison

### Benchmark Results (Expected)

| Operation | Built-in (JS) | Plugin (WASM) | Improvement |
|-----------|---------------|---------------|-------------|
| Pour cost calc | 0.2ms | 0.1ms | 2x faster |
| Ingredient check | 0.5ms | 0.3ms | 1.7x faster |
| Variance calc | 0.1ms | 0.05ms | 2x faster |
| Opening stock | 150ms | 120ms | 1.25x faster |
| Usage summary | 500ms | 350ms | 1.4x faster |

### Memory Usage

| Scenario | Built-in | Plugin | Reduction |
|----------|----------|--------|-----------|
| Plugin loaded | N/A | 2MB | N/A |
| Calculations | 1.5MB | 0.5MB | 67% less |
| Reports | 5MB | 3MB | 40% less |

## Rollout Plan

### Stage 1: Dev/Staging (Week 1)
- Install plugin in dev environment
- Test all bar features
- Compare results with built-in code
- Fix any discrepancies

### Stage 2: Beta (Week 2)
- Deploy to 5-10 friendly restaurants
- Monitor performance and errors
- Collect feedback
- Make adjustments

### Stage 3: Gradual Production (Weeks 3-4)
- Week 3: 10% of tenants
- Week 3.5: 25% of tenants
- Week 4: 50% of tenants
- Week 4.5: 100% of tenants

### Stage 4: Cleanup (Week 5)
- Remove old barRecipeService.ts
- Remove old barClosingService.ts
- Update documentation
- Celebrate 🎉

## Rollback Plan

If issues arise:

1. **Feature flag off:**
   ```typescript
   const USE_BAR_PLUGIN = false; // Set to false to disable

   if (USE_BAR_PLUGIN && pluginAvailable) {
     // Use plugin
   } else {
     // Use built-in
   }
   ```

2. **Graceful degradation:**
   Plugin wrappers already have fallback to built-in code

3. **Emergency rollback:**
   - Disable plugin in KV registry
   - Plugin manager will return null
   - App falls back to built-in code

## Success Metrics

- ✅ All bar features work identically
- ✅ No performance regression (target: 0-20% improvement)
- ✅ No user-reported bugs
- ✅ 5MB app size reduction after removing built-in code
- ✅ Can update bar logic without app rebuild

## Support

- **Issues:** https://github.com/handsfree/restaurant-pos-ai/issues
- **Slack:** #bar-plugin-migration
- **Docs:** https://docs.handsfree.com/plugins/bar-management

## FAQ

**Q: What happens if the plugin fails to load?**
A: The wrapper functions fall back to built-in code automatically.

**Q: Will offline mode still work?**
A: Yes! Client WASM is cached in SQLite and works offline. Worker API calls will queue and sync when online.

**Q: Can I customize the plugin for my restaurant?**
A: Yes! Create a tenant-specific plugin in your tenant registry with custom logic.

**Q: What's the performance impact?**
A: WASM is typically 10-50% faster than JavaScript for calculations. Worker API calls add network latency (~50ms) but handle complex queries better.

**Q: How do I test locally?**
A: Build the plugin with `./build.sh`, then load it in the POS app. See README.md for detailed instructions.
