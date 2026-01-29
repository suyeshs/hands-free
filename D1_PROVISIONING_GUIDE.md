# D1 Database Provisioning Guide

## Quick Start for Current Tenant

This guide will help you provision the D1 database with the complete schema for your restaurant tenant.

## Prerequisites

- Cloudflare account with Wrangler CLI installed
- Access to your Cloudflare D1 database
- Your tenant ID (from `tenant_config` table in local SQLite)

## Step 1: Find Your Tenant ID

```bash
# Option A: Check local SQLite database
cd /path/to/your/app/data
sqlite3 restaurant-pos.db "SELECT tenant_id FROM tenant_config"

# Option B: Check from running app
# Open DevTools → Console in the POS app and run:
# localStorage.getItem('tenantId')
```

Save this tenant ID - you'll need it for worker configuration.

## Step 2: Check Existing D1 Database

```bash
# List your D1 databases
wrangler d1 list

# If you don't have a database, create one:
wrangler d1 create handsfree-pos-db

# Note the database ID from the output
```

## Step 3: Apply Complete Schema Migration

```bash
# Navigate to your project
cd /Users/stonepot-tech/projects/restaurant-pos-ai

# Apply the complete 37-table migration
wrangler d1 execute handsfree-pos-db --file=./docs/d1-complete-migration.sql

# You should see output like:
# ✅ Successfully executed SQL
# 🎉 37 tables created
```

## Step 4: Verify Tables Were Created

```bash
# Count tables (should show 37)
wrangler d1 execute handsfree-pos-db --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"

# List all table names
wrangler d1 execute handsfree-pos-db --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# Expected output (37 tables):
# aggregator_orders
# attendance_records
# daily_cash_registers
# cash_payouts
# delivery_verification_sessions
# floor_sections
# floor_staff_assignments
# floor_tables
# inventory_barcode_mappings
# inventory_documents
# inventory_items
# inventory_transactions
# kds_orders
# leave_balances
# leave_requests
# menu_categories
# menu_items
# out_of_stock_items
# recipe_ingredients
# restaurant_settings
# roster_assignments
# sales_transactions
# staff_advances
# staff_attendance
# staff_bonuses
# staff_deductions
# staff_login_history
# staff_payslips
# staff_salary
# staff_users
# suppliers
# table_sessions
# tenant_settings
# tenant_translation_overrides
# tips
# translation_keys
# translations
# weekly_rosters
```

## Step 5: Update Cloudflare Worker

### 5.1: Get Your Worker Name

```bash
# List your workers
wrangler whoami

# If you don't have a worker yet, create one:
wrangler init handsfree-orders
cd handsfree-orders
```

### 5.2: Update wrangler.toml

Add D1 database binding:

```toml
name = "handsfree-orders"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Add D1 binding
[[d1_databases]]
binding = "DB"
database_name = "handsfree-pos-db"
database_id = "<YOUR_DATABASE_ID_HERE>"
```

Replace `<YOUR_DATABASE_ID_HERE>` with the ID from Step 2.

### 5.3: Add Environment Variables

```toml
[vars]
ALLOWED_ORIGINS = "*"
TENANT_ID = "<YOUR_TENANT_ID_HERE>"
```

Replace `<YOUR_TENANT_ID_HERE>` with your tenant ID from Step 1.

## Step 6: Implement Worker Endpoints

Create a minimal worker with sync endpoints. Here's a starter template:

### src/index.ts

```typescript
export interface Env {
  DB: D1Database;
  TENANT_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Menu sync endpoint
      if (pathname.match(/^\/api\/menu\/[^\/]+\/sync$/)) {
        return await handleMenuSync(request, env, corsHeaders);
      }

      // Sales sync endpoint
      if (pathname.match(/^\/api\/sales\/[^\/]+\/sync$/)) {
        return await handleSalesSync(request, env, corsHeaders);
      }

      // Tips sync endpoint
      if (pathname.match(/^\/api\/tips\/[^\/]+\/sync$/)) {
        return await handleTipsSync(request, env, corsHeaders);
      }

      // Staff sync endpoint
      if (pathname.match(/^\/api\/staff\/[^\/]+\/sync$/)) {
        return await handleStaffSync(request, env, corsHeaders);
      }

      // Floor plan sync endpoint
      if (pathname.match(/^\/api\/floor-plan\/[^\/]+\/sync$/)) {
        return await handleFloorPlanSync(request, env, corsHeaders);
      }

      // Settings sync endpoint
      if (pathname.match(/^\/api\/settings\/[^\/]+\/sync$/)) {
        return await handleSettingsSync(request, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};

// Menu sync handler
async function handleMenuSync(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const { categories, menuItems } = await request.json();
  const db = env.DB;

  // Sync categories
  if (categories && categories.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO menu_categories
      (id, name, sort_order, active, icon, description, created_at, updated_at, name_translations)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `);

    const batch = categories.map((cat: any) =>
      stmt.bind(
        cat.id,
        cat.name,
        cat.sort_order || 0,
        cat.active ? 1 : 0,
        cat.icon || null,
        cat.description || '',
        cat.created_at || new Date().toISOString(),
        cat.updated_at || new Date().toISOString(),
        cat.name_translations || null
      )
    );

    await db.batch(batch);
  }

  // Sync menu items
  if (menuItems && menuItems.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO menu_items
      (id, category_id, name, description, price, image, active, preparation_time,
       allergens, dietary_tags, name_translations, description_translations)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `);

    const batch = menuItems.map((item: any) =>
      stmt.bind(
        item.id,
        item.category_id,
        item.name,
        item.description || '',
        item.price,
        item.image || null,
        item.active ? 1 : 0,
        item.preparation_time || 15,
        JSON.stringify(item.allergens || []),
        JSON.stringify(item.dietary_tags || []),
        item.name_translations || null,
        item.description_translations || null
      )
    );

    await db.batch(batch);
  }

  return new Response(
    JSON.stringify({
      success: true,
      synced: {
        categories: categories?.length || 0,
        menuItems: menuItems?.length || 0,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Sales sync handler
async function handleSalesSync(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const { transactions } = await request.json();
  const db = env.DB;

  if (transactions && transactions.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sales_transactions
      (id, tenant_id, invoice_number, order_number, order_type, table_number, source,
       subtotal, service_charge, cgst, sgst, discount, round_off, grand_total,
       payment_method, payment_status, items_json, cashier_name, staff_id,
       created_at, completed_at, synced_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)
    `);

    const batch = transactions.map((txn: any) =>
      stmt.bind(
        txn.id,
        txn.tenant_id,
        txn.invoice_number,
        txn.order_number || null,
        txn.order_type,
        txn.table_number || null,
        txn.source || 'pos',
        txn.subtotal,
        txn.service_charge || 0,
        txn.cgst || 0,
        txn.sgst || 0,
        txn.discount || 0,
        txn.round_off || 0,
        txn.grand_total,
        txn.payment_method,
        txn.payment_status || 'completed',
        txn.items_json,
        txn.cashier_name || null,
        txn.staff_id || null,
        txn.created_at,
        txn.completed_at,
        new Date().toISOString()
      )
    );

    await db.batch(batch);
  }

  return new Response(
    JSON.stringify({
      success: true,
      synced: transactions?.length || 0,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Tips sync handler
async function handleTipsSync(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const { tips } = await request.json();
  const db = env.DB;

  if (tips && tips.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO tips
      (id, tenant_id, invoice_number, order_number, table_number, order_type,
       tip_amount, staff_id, server_name, entered_by_staff_id, entered_by_name,
       entry_method, created_at, tip_date, synced_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
    `);

    const batch = tips.map((tip: any) =>
      stmt.bind(
        tip.id,
        tip.tenant_id,
        tip.invoice_number,
        tip.order_number || null,
        tip.table_number || null,
        tip.order_type,
        tip.tip_amount,
        tip.staff_id || null,
        tip.server_name || null,
        tip.entered_by_staff_id || null,
        tip.entered_by_name || null,
        tip.entry_method || 'manual',
        tip.created_at,
        tip.tip_date,
        new Date().toISOString()
      )
    );

    await db.batch(batch);
  }

  return new Response(
    JSON.stringify({
      success: true,
      synced: tips?.length || 0,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Staff sync handler
async function handleStaffSync(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const { staff } = await request.json();
  const db = env.DB;

  if (staff && staff.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO staff_users
      (id, tenant_id, name, role, pin_hash, is_active, permissions,
       created_at, last_login_at, created_by, preferred_language)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `);

    const batch = staff.map((s: any) =>
      stmt.bind(
        s.id,
        s.tenant_id,
        s.name,
        s.role,
        s.pin_hash,
        s.is_active ? 1 : 0,
        s.permissions || null,
        s.created_at,
        s.last_login_at || null,
        s.created_by || null,
        s.preferred_language || 'en'
      )
    );

    await db.batch(batch);
  }

  return new Response(
    JSON.stringify({
      success: true,
      synced: staff?.length || 0,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Floor plan sync handler
async function handleFloorPlanSync(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const { sections, tables, assignments } = await request.json();
  const db = env.DB;

  // Sync sections
  if (sections && sections.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO floor_sections
      (id, tenant_id, name, is_active, created_at, updated_at, synced_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `);

    const batch = sections.map((s: any) =>
      stmt.bind(
        s.id,
        s.tenant_id,
        s.name,
        s.is_active || 1,
        s.created_at || new Date().toISOString(),
        s.updated_at || new Date().toISOString(),
        new Date().toISOString()
      )
    );

    await db.batch(batch);
  }

  // Sync tables
  if (tables && tables.length > 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO floor_tables
      (id, tenant_id, section_id, table_number, capacity, qr_code_url, status,
       assigned_staff_id, current_order_id, last_active_at, created_at, updated_at, synced_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
    `);

    const batch = tables.map((t: any) =>
      stmt.bind(
        t.id,
        t.tenant_id,
        t.section_id,
        t.table_number,
        t.capacity || 4,
        t.qr_code_url || null,
        t.status || 'available',
        t.assigned_staff_id || null,
        t.current_order_id || null,
        t.last_active_at || null,
        t.created_at || new Date().toISOString(),
        t.updated_at || new Date().toISOString(),
        new Date().toISOString()
      )
    );

    await db.batch(batch);
  }

  return new Response(
    JSON.stringify({
      success: true,
      synced: {
        sections: sections?.length || 0,
        tables: tables?.length || 0,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Settings sync handler
async function handleSettingsSync(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const { settings } = await request.json();
  const db = env.DB;

  if (settings) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO restaurant_settings
      (id, name, tagline, address_line1, address_line2, city, state, pincode,
       phone, email, website, gst_number, fssai_number, pan_number, cin_number,
       invoice_prefix, invoice_start_number, current_invoice_number, invoice_terms,
       footer_note, tax_enabled, cgst_rate, sgst_rate, service_charge_rate,
       service_charge_enabled, round_off_enabled, tax_included_in_price, print_logo,
       logo_url, print_qr_code, qr_code_url, paper_width, show_itemwise_tax,
       require_staff_pin_for_pos, filter_tables_by_staff_assignment, pin_session_timeout_minutes,
       theme, device_role, packing_charges_enabled, packing_charges_by_category,
       packing_charges_default, activate_online, enable_inventory_sync, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
              ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28,
              ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41,
              ?42, ?43, ?44, ?45)
    `);

    await stmt.bind(
      1, // Singleton ID
      settings.name || 'Restaurant Name',
      settings.tagline || null,
      settings.address_line1 || '',
      settings.address_line2 || null,
      settings.city || '',
      settings.state || '',
      settings.pincode || '',
      settings.phone || '',
      settings.email || null,
      settings.website || null,
      settings.gst_number || null,
      settings.fssai_number || null,
      settings.pan_number || null,
      settings.cin_number || null,
      settings.invoice_prefix || 'INV',
      settings.invoice_start_number || 1,
      settings.current_invoice_number || 1,
      settings.invoice_terms || null,
      settings.footer_note || null,
      settings.tax_enabled ? 1 : 0,
      settings.cgst_rate || 2.5,
      settings.sgst_rate || 2.5,
      settings.service_charge_rate || 0,
      settings.service_charge_enabled ? 1 : 0,
      settings.round_off_enabled ? 1 : 0,
      settings.tax_included_in_price ? 1 : 0,
      settings.print_logo ? 1 : 0,
      settings.logo_url || null,
      settings.print_qr_code ? 1 : 0,
      settings.qr_code_url || null,
      settings.paper_width || '80mm',
      settings.show_itemwise_tax ? 1 : 0,
      settings.require_staff_pin_for_pos ? 1 : 0,
      settings.filter_tables_by_staff_assignment ? 1 : 0,
      settings.pin_session_timeout_minutes || 0,
      settings.theme || 'dark',
      settings.device_role || 'client',
      settings.packing_charges_enabled ? 1 : 0,
      settings.packing_charges_by_category || null,
      settings.packing_charges_default || 5,
      settings.activate_online ? 1 : 0,
      settings.enable_inventory_sync ? 1 : 0,
      settings.created_at || new Date().toISOString(),
      settings.updated_at || new Date().toISOString()
    ).run();
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## Step 7: Deploy Worker

```bash
# Build and deploy
cd /path/to/handsfree-orders
npm install
wrangler publish

# You should see output like:
# ✨ Built successfully
# ✨ Uploaded successfully
# ✨ Published handsfree-orders
#    https://handsfree-orders.<your-subdomain>.workers.dev
```

## Step 8: Test Sync from POS

### 8.1: Enable Online Sync in POS

1. Open POS app
2. Go to Settings → Restaurant Settings
3. Enable "Activate Online"
4. Save settings

### 8.2: Test Menu Sync

1. Upload a menu file
2. Review and confirm items
3. Open DevTools → Console
4. You should see logs like:
   ```
   [ExcelUploader] Menu saved locally. Background sync to D1 will happen automatically.
   [ServiceWorker] Syncing pending menu items...
   [ServiceWorker] Synced 42 menu items
   ```

### 8.3: Verify D1 Database

```bash
# Check if menu items were synced
wrangler d1 execute handsfree-pos-db --command="SELECT COUNT(*) as item_count FROM menu_items"

# Should show the number of items you uploaded

# Check if categories were synced
wrangler d1 execute handsfree-pos-db --command="SELECT COUNT(*) as category_count FROM menu_categories"

# View sample menu items
wrangler d1 execute handsfree-pos-db --command="SELECT id, name, price FROM menu_items LIMIT 5"
```

## Step 9: Monitor Sync

### Check Worker Logs

```bash
# Tail worker logs in real-time
wrangler tail handsfree-orders

# You'll see sync requests like:
# POST /api/menu/<tenant-id>/sync
# Response: {"success":true,"synced":{"categories":8,"menuItems":42}}
```

### Check D1 Database Size

```bash
# Get database info
wrangler d1 info handsfree-pos-db

# Sample output:
# Database: handsfree-pos-db
# Size: 2.4 MB
# Tables: 37
# Rows: ~500
```

## Troubleshooting

### Sync Not Working

1. **Check Service Worker is running**:
   - DevTools → Application → Service Workers
   - Should show "activated and is running"

2. **Check IndexedDB queue**:
   - DevTools → Application → IndexedDB → sync-queue
   - Look for `pending-menu-items` store
   - Should have records waiting to sync

3. **Check network requests**:
   - DevTools → Network tab
   - Filter: `api/menu`
   - Look for POST requests to your worker

4. **Check worker logs**:
   ```bash
   wrangler tail handsfree-orders
   ```
   - Should show incoming requests and responses

### D1 Errors

1. **"Table not found"**:
   - Re-apply migration: `wrangler d1 execute handsfree-pos-db --file=./docs/d1-complete-migration.sql`

2. **"Column not found"**:
   - Schema mismatch - verify local SQLite matches D1
   - Compare: `sqlite3 local.db ".schema menu_items"` vs D1 schema

3. **"UNIQUE constraint failed"**:
   - Duplicate primary keys - check your data
   - Worker uses `INSERT OR REPLACE` to handle duplicates

## Next Steps

After successful provisioning:

1. ✅ Monitor sync for 24 hours
2. ✅ Test multi-device sync (if you have multiple POS terminals)
3. ✅ Set up automated backups for D1
4. ✅ Implement additional sync endpoints (inventory, payroll, etc.)
5. ✅ Add authentication to worker endpoints
6. ✅ Set up rate limiting
7. ✅ Configure monitoring and alerts

## Support

If you encounter issues:

1. Check Cloudflare D1 status: https://www.cloudflarestatus.com/
2. Review worker logs: `wrangler tail`
3. Check D1 documentation: https://developers.cloudflare.com/d1/
4. Verify schema matches: Compare local SQLite with D1

---

**Status**: Ready for provisioning
**Database**: D1 (37 tables)
**Worker**: Cloudflare Workers
**Sync**: Service Worker (background)
**Tenant**: Configure in wrangler.toml
