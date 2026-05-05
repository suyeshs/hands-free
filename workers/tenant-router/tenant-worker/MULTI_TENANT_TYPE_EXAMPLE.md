# Multi-Tenant Type Support - Example Implementation

## Overview

The tenant worker can support different business types (Restaurant, Pharmacy, Retail, etc.) using a configuration-based approach. Each tenant gets the same worker code, but features are enabled/disabled based on their `business_category`.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         Tenant Worker (Single Codebase)             │
├─────────────────────────────────────────────────────┤
│  1. Load Tenant Config (from KV or DB)              │
│     - businessType: RESTAURANT | PHARMACY | RETAIL  │
│     - features: { ... }                              │
├─────────────────────────────────────────────────────┤
│  2. Conditional Route Registration                   │
│     - Restaurant routes: /menu, /tables, /kitchen   │
│     - Pharmacy routes: /prescriptions, /drugs       │
│     - Retail routes: /inventory, /products          │
│     - Common routes: /orders, /customers            │
├─────────────────────────────────────────────────────┤
│  3. Feature Checks in Handlers                       │
│     - if (!config.features.tableManagement) 404     │
│     - if (!config.features.prescriptions) 404       │
└─────────────────────────────────────────────────────┘
```

## Example: Restaurant vs Pharmacy

### Restaurant Tenant (business_category = 'RESTAURANT')

**Enabled Routes:**
- `/menu` - Menu management
- `/categories` - Menu categories
- `/tables` - Table management
- `/floor-plan` - Floor plan configuration
- `/kitchen` - Kitchen display orders
- `/reservations` - Table reservations
- `/orders` - Order management (common)
- `/customers` - Customer management (common)

**API Example:**
```bash
# Works for restaurant
curl https://restaurant-tenant.handsfree.tech/api/menu

# Works for restaurant
curl https://restaurant-tenant.handsfree.tech/api/tables

# Returns 404 (not enabled for restaurants)
curl https://restaurant-tenant.handsfree.tech/api/prescriptions
```

### Pharmacy Tenant (business_category = 'PHARMACY')

**Enabled Routes:**
- `/products` - Drug/medicine catalog
- `/prescriptions` - Prescription management
- `/prescriptions/:id/fill` - Fill prescription
- `/drugs` - Drug inventory
- `/medication-reminders` - Patient reminders
- `/orders` - Order management (common)
- `/customers` - Customer/patient management (common)

**API Example:**
```bash
# Works for pharmacy
curl https://pharmacy-tenant.handsfree.tech/api/products

# Works for pharmacy
curl https://pharmacy-tenant.handsfree.tech/api/prescriptions

# Returns 404 (not enabled for pharmacies)
curl https://pharmacy-tenant.handsfree.tech/api/menu
```

## Implementation Example

### Step 1: Update Tenant Metadata

When provisioning a pharmacy tenant:

```typescript
// In restaurant-provisioning-service.ts
const tenantMetadata = {
  tenantId: request.tenantId,
  subdomain: subdomain,
  fullDomain: fullDomain,
  storeUrl: storeUrl,
  d1_database_id: storageConfig.resources.d1DatabaseId,
  d1_database_name: storageConfig.resources.d1DatabaseName,
  companyName: request.companyName,
  businessType: 'PHARMACY', // ← Set the business type
  status: 'active',
  provisioningStatus: 'complete',
  createdAt: now,
};
```

### Step 2: Conditional Routes in Tenant Worker

```typescript
// In tenant-worker/src/index.ts
import { getTenantConfig, isFeatureEnabled } from './lib/tenant-config';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const tenantId = request.headers.get('X-Tenant-Id') || 'unknown';

    // Load tenant configuration
    const config = await getTenantConfig(tenantId, env.TENANTS_DB, env.TENANT_METADATA);
    console.log(`[TenantWorker] Tenant type: ${config.tenantType}`);

    // ==================== RESTAURANT-SPECIFIC ROUTES ====================
    if (isFeatureEnabled(config, 'menuManagement')) {
      if (url.pathname === '/menu' && request.method === 'GET') {
        return handleListMenu(request, env, tenantId);
      }

      if (url.pathname === '/categories' && request.method === 'GET') {
        return handleListCategories(request, env, tenantId);
      }
    }

    if (isFeatureEnabled(config, 'tableManagement')) {
      if (url.pathname === '/tables' && request.method === 'GET') {
        return handleListTables(request, env, tenantId);
      }

      if (url.pathname === '/floor-plan' && request.method === 'GET') {
        return handleGetFloorPlan(request, env, tenantId);
      }
    }

    // ==================== PHARMACY-SPECIFIC ROUTES ====================
    if (isFeatureEnabled(config, 'prescriptionManagement')) {
      if (url.pathname === '/prescriptions' && request.method === 'GET') {
        return handleListPrescriptions(request, env, tenantId);
      }

      if (url.pathname === '/prescriptions' && request.method === 'POST') {
        return handleCreatePrescription(request, env, tenantId);
      }

      const prescriptionMatch = url.pathname.match(/^\/prescriptions\/([^/]+)$/);
      if (prescriptionMatch && request.method === 'GET') {
        return handleGetPrescription(request, env, tenantId, prescriptionMatch[1]);
      }

      const fillMatch = url.pathname.match(/^\/prescriptions\/([^/]+)\/fill$/);
      if (fillMatch && request.method === 'POST') {
        return handleFillPrescription(request, env, tenantId, fillMatch[1]);
      }
    }

    if (isFeatureEnabled(config, 'drugInventory')) {
      if (url.pathname === '/drugs' && request.method === 'GET') {
        return handleListDrugs(request, env, tenantId);
      }
    }

    // ==================== COMMON ROUTES (ALL TENANTS) ====================
    if (url.pathname === '/orders' && request.method === 'GET') {
      return handleListOrders(request, env, tenantId);
    }

    if (url.pathname === '/customers' && request.method === 'GET') {
      return handleListCustomers(request, env, tenantId);
    }

    // Route not found or not enabled for this tenant type
    return Response.json(
      {
        error: 'Not found',
        path: url.pathname,
        tenantType: config.tenantType,
        message: 'This endpoint is not available for your business type'
      },
      { status: 404 }
    );
  }
};
```

### Step 3: Create Pharmacy-Specific Handlers

```typescript
// tenant-worker/src/handlers/prescriptions.ts
export async function handleListPrescriptions(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    const status = url.searchParams.get('status');

    let query = `
      SELECT * FROM prescriptions
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` AND patient_id = ?`;
      params.push(patientId);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      prescriptions: result.results || [],
      total: result.results?.length || 0,
    });

  } catch (error: any) {
    console.error('[Prescriptions] List error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list prescriptions',
    }, { status: 500 });
  }
}

export async function handleFillPrescription(
  request: Request,
  env: Env,
  tenantId: string,
  prescriptionId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Update prescription status
    await env.DB.prepare(`
      UPDATE prescriptions
      SET status = 'filled',
          filled_at = datetime('now'),
          filled_by = ?,
          notes = ?
      WHERE id = ?
    `).bind(body.filledBy, body.notes || null, prescriptionId).run();

    // Create inventory transaction for dispensed drugs
    // ... pharmacy-specific logic ...

    return Response.json({
      success: true,
      message: 'Prescription filled successfully',
    });

  } catch (error: any) {
    console.error('[Prescriptions] Fill error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to fill prescription',
    }, { status: 500 });
  }
}
```

## Database Schema Differences

### Restaurant Tables
```sql
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  table_number INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT DEFAULT 'available'
);
```

### Pharmacy Tables
```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT,
  form TEXT, -- tablet, capsule, syrup, etc.
  price REAL NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  requires_prescription INTEGER DEFAULT 0
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  prescription_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, filled, cancelled
  filled_at TEXT,
  filled_by TEXT,
  notes TEXT
);

CREATE TABLE prescription_items (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  dosage_instructions TEXT,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

## Benefits of Configuration-Based Approach

### ✅ Advantages
1. **Single Codebase** - Easier to maintain and deploy
2. **Shared Infrastructure** - Common code for orders, customers, payments
3. **Feature Flags** - Easy to enable/disable features per tenant
4. **Fast Deployment** - One build, deploy to all tenants
5. **Gradual Rollout** - Test new features with specific tenants

### ⚠️ Considerations
1. **Code Size** - Worker includes all feature code (but unused code is tree-shaken)
2. **Schema Compatibility** - Must handle different table structures
3. **Testing** - Need to test all tenant types
4. **Documentation** - Clear docs on which features are available

## Alternative Approaches

### Approach 2: Separate Worker Templates

**Structure:**
```
platform/workers/tenant-router/
├── restaurant-worker/    # Restaurant-specific worker
├── pharmacy-worker/      # Pharmacy-specific worker
└── retail-worker/        # Retail-specific worker
```

**Pros:**
- Fully isolated code
- Smaller bundle sizes
- Type-specific optimizations

**Cons:**
- Code duplication
- Multiple deployments
- Harder to maintain shared features

### Approach 3: Plugin System

**Structure:**
```typescript
// Core worker with pluggable modules
const worker = new TenantWorker({
  modules: [
    new CommonModule(),
    config.tenantType === 'RESTAURANT' ? new RestaurantModule() : null,
    config.tenantType === 'PHARMACY' ? new PharmacyModule() : null,
  ].filter(Boolean)
});
```

**Pros:**
- Very flexible
- Dynamic loading
- Best code organization

**Cons:**
- Complex architecture
- Requires significant refactoring
- Performance overhead

## Recommendation

**Use Approach 1 (Configuration-Based)** because:
- Simplest to implement
- Easiest to maintain
- Works with current architecture
- Can migrate to plugins later if needed

## Next Steps

1. Update provisioning to set `businessType` in metadata ✅ (Already done via `business_category`)
2. Create `tenant-config.ts` module ✅ (Just created)
3. Add conditional routes in tenant worker index.ts
4. Create pharmacy-specific handlers (when needed)
5. Update database migrations to include pharmacy tables
6. Test with both restaurant and pharmacy tenants
