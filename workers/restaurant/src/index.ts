/**
 * Restaurant Worker
 *
 * Handles restaurant-specific operations including:
 * - Menu APIs (KV-based)
 * - Customer management (D1 + encrypted PII)
 * - Order management (D1 + customer integration)
 * - Proxying UI requests to restaurant-client
 */

import { type RestaurantEnv, getTenantDatabase, hasTenantDatabase } from './lib/tenant-db-resolver';
import {
  upsertCustomer,
  getCustomer,
  getCustomerByPhone,
  listCustomers,
  updateCustomerMetrics,
  deleteCustomer,
  addCustomerAddress,
  getCustomerAddresses,
  type CustomerInput,
} from './lib/customer-manager';
import {
  getCustomerTags,
  assignTag,
  removeTag,
  getTagDefinitions,
  createTagDefinition,
  updateTagDefinition,
  deleteTagDefinition,
  getTagStats,
  bulkAutoAssignTags,
} from './lib/customer-tags';
import {
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
  getTodayStats,
  type OrderInput,
  type OrderFilters,
} from './lib/order-manager';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
  listCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuItem,
  listMenuItems,
  getMenuMetadata,
  updateMenuMetadata,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateMenuItemInput,
  type UpdateMenuItemInput,
  type MenuItemFilters,
  type MenuMetadata,
} from './lib/menu-manager';
import { invalidateMenuCache } from './lib/menu-cache';
import {
  getDineInPricingOverrides,
  saveDineInPricingOverride,
  deleteDineInPricingOverride,
  bulkSaveDineInPricingOverrides,
  resetAllDineInPricingOverrides,
} from './lib/dine-in-pricing';
import {
  createInventoryItem,
  getInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  getInventorySummary,
  getLowStockAlerts,
  getExpiryAlerts,
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
  deleteSupplier,
  createDocument,
  getDocument,
  listDocuments,
  createTransaction,
  listTransactions,
  createRecipe,
  getRecipe,
  getRecipeByMenuItem,
  listRecipes,
  updateRecipe,
  deleteRecipe,
  getRecipeCost,
  deductInventoryForOrder,
  type InventoryCategory,
} from './lib/inventory-manager';

interface TenantMetadata {
  tenantId: string;
  businessCategory?: string;
  subdomain?: string;
  companyName?: string;
  [key: string]: any;
}

export default {
  async fetch(request: Request, env: RestaurantEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      const path = url.pathname;
      const method = request.method;

      console.log(`[RestaurantWorker] ${method} ${hostname}${path}`);

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-ID',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // Serve migrations from R2 (public endpoint, no authentication)
      if (path.startsWith('/migrations/')) {
        const fileName = path.substring('/migrations/'.length);
        console.log(`[RestaurantWorker] Serving migration file: ${fileName}`);

        try {
          const object = await env.ASSETS.get(`migrations/${fileName}`);

          if (!object) {
            console.error(`[RestaurantWorker] Migration file not found: ${fileName}`);
            return new Response('Migration file not found', { status: 404 });
          }

          const headers = new Headers();
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

          // Set appropriate content type
          if (fileName.endsWith('.json')) {
            headers.set('Content-Type', 'application/json');
          } else if (fileName.endsWith('.sql')) {
            headers.set('Content-Type', 'text/plain');
          }

          console.log(`[RestaurantWorker] Successfully serving migration: ${fileName}`);
          return new Response(object.body, { headers });
        } catch (error) {
          console.error(`[RestaurantWorker] Error serving migration:`, error);
          return new Response('Error serving migration', { status: 500 });
        }
      }

      // Extract tenant ID from X-Tenant-ID header or subdomain
      let tenantId = request.headers.get('X-Tenant-ID');

      if (!tenantId) {
        tenantId = extractTenantFromHostname(hostname, env.PLATFORM_DOMAIN);
      }

      if (!tenantId) {
        // Allow some specific admin paths to bypass hostname-based tenant extraction
        if (path === '/api/cfupload' || path === '/api/admin/menu/unassigned-images' || path.startsWith('/api/admin/unassigned-images')) {
          console.log(`[RestaurantWorker] Special route detected, continuing without tenantId from hostname`);
          // Extract from query string for these special routes
          const urlObj = new URL(request.url);
          tenantId = urlObj.searchParams.get('tenantId');
        } else {
          console.error(`[RestaurantWorker] Missing tenant ID: ${hostname}`);
          return jsonResponse({ error: 'Invalid restaurant subdomain' }, 400);
        }
      }

      // Handle routes that don't require tenant ID
      if (path === '/api/cfupload') {
        return handleCFUploadAPI(request, env);
      }

      // At this point, tenantId must be non-null for all other routes
      if (!tenantId) {
        console.error(`[RestaurantWorker] Missing tenant ID after all extraction attempts`);
        return jsonResponse({ error: 'Tenant ID required' }, 400);
      }

      // TypeScript now knows tenantId is string (not null)
      console.log(`[RestaurantWorker] Tenant ID: ${tenantId}`);

      // Get tenant metadata (informative, no longer strictly blocking for public APIs)
      const tenantMetadata = await getTenantMetadata(tenantId, env);

      console.log(`[RestaurantWorker] Tenant metadata status: ${tenantMetadata ? 'Found' : 'Not Found'}`);

      // Check if tenant has a configured database (for customer/order APIs)
      // IMPORTANT: Now supports both static (legacy) and dynamic (newly provisioned) tenants
      const hasTenantDb = await hasTenantDatabase(tenantId, env);
      console.log(`[RestaurantWorker] Tenant ${tenantId} has database: ${hasTenantDb}`);

      // Check if this is a dynamically provisioned tenant (uses dispatch namespace)
      const isStaticTenant = tenantId === 'khao-piyo-7766' || tenantId === 'coorg-food-company-6163';
      const usesTenantWorker = hasTenantDb && !isStaticTenant;

      if (usesTenantWorker) {
        console.log(`[RestaurantWorker] Tenant ${tenantId} uses dispatch namespace - routing to tenant worker`);
      }

      // Route to appropriate handler
      if (path.startsWith('/api/customers')) {
        if (!hasTenantDb) {
          return jsonResponse(
            { error: 'Customer management not available for this tenant' },
            503
          );
        }
        return handleCustomerAPI(request, tenantId, path, method, env);
      }

      if (path.startsWith('/api/tag-definitions')) {
        if (!hasTenantDb) {
          return jsonResponse({ error: 'Tag management not available for this tenant' }, 503);
        }
        return handleTagAPI(request, tenantId, path, method, env);
      }

      if (path.startsWith('/api/orders')) {
        if (!hasTenantDb) {
          return jsonResponse({ error: 'Order management not available for this tenant' }, 503);
        }
        return handleOrderAPI(request, tenantId, path, method, env);
      }

      if (path.startsWith('/api/inventory')) {
        if (!hasTenantDb) {
          return jsonResponse({ error: 'Inventory management not available for this tenant' }, 503);
        }
        return handleInventoryAPI(request, tenantId, path, method, env);
      }

      // Proxy document scanning to vision-inventory worker
      if (path.startsWith('/api/documents')) {
        console.log(`[RestaurantWorker] Routing to vision-inventory proxy for path: ${path}`);
        return proxyToVisionInventory(request, tenantId, path, env);
      }

      if (path.startsWith('/api/menu') || path.startsWith('/api/categories') || path.startsWith('/api/config') || path.startsWith('/api/restaurant') || path.startsWith('/api/admin/menu') || path.startsWith('/api/admin/floor-plan')) {
        // Check if this is an admin endpoint (requires tenant DB)
        if (path.startsWith('/api/admin/menu') || path.startsWith('/api/admin/floor-plan')) {
          // R2-based menu upload endpoints don't need tenant DB (only R2 + AI)
          // Proxy to restaurant-client which will handle authentication
          if (path === '/api/admin/menu/parse-from-r2' ||
              path === '/api/admin/menu/process-from-r2' ||
              path.startsWith('/api/admin/menu/unassigned-images') ||  // Image upload tracking (R2-based)
              path.startsWith('/api/r2')) {
            console.log(`[RestaurantWorker] Proxying R2/image endpoint ${path} to restaurant-client`);
            return proxyToRestaurantClient(request, tenantId, tenantMetadata, env);
          }

          // Other admin endpoints require tenant DB
          if (!hasTenantDb) {
            console.warn(`[RestaurantWorker] Admin endpoint ${path} blocked: tenant ${tenantId} has no D1 database configured`);
            return jsonResponse({
              error: 'Admin feature not available for this tenant',
              details: 'Tenant database not configured. Contact support to enable admin features.'
            }, 503);
          }

          // For dynamically provisioned tenants, route to tenant-specific worker via dispatch
          if (usesTenantWorker) {
            console.log(`[RestaurantWorker] Routing admin request to tenant worker for ${tenantId}`);
            return routeToTenantWorker(request, tenantId, tenantMetadata, env);
          }

          // For legacy static tenants, use direct database access
          return handleMenuManagementAPI(request, tenantId, path, method, env);
        }

        // Regular menu reading endpoints
        // For dynamically provisioned tenants, route to tenant worker via dispatch
        if (usesTenantWorker && (path.startsWith('/api/menu') || path.startsWith('/api/categories'))) {
          console.log(`[RestaurantWorker] Routing menu/categories request to tenant worker for ${tenantId}`);
          return routeToTenantWorker(request, tenantId, tenantMetadata, env);
        }

        return handleMenuAPI(request, path, tenantId, method, env);
      }

      // Proxy all other requests to restaurant-client
      return proxyToRestaurantClient(request, tenantId, tenantMetadata, env);
    } catch (error) {
      console.error('[RestaurantWorker] Error:', error);
      return jsonResponse(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  },
};

/**
 * Parse a path pattern like "/api/customers/phone/:phone/addresses" into segments
 * Returns { matched: true, params: { phone: "value" } } or { matched: false }
 */
function matchRoute(pattern: string, path: string): { matched: boolean; params: Record<string, string> } {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      // This is a parameter - capture it
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      // Static segment doesn't match
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

/**
 * Handle Customer API endpoints using deterministic routing
 */
async function handleCustomerAPI(
  request: Request,
  tenantId: string,
  path: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  try {
    const url = new URL(request.url);

    // ==========================================================================
    // Static routes (exact matches) - check these first
    // ==========================================================================

    if (path === '/api/customers') {
      if (method === 'POST') {
        // POST /api/customers - Create/update customer
        const body = await request.json<CustomerInput & { phoneHash?: string; deliveryAddress?: any }>();

        // If phoneHash is provided, use it; otherwise, it will be computed from phone
        const customer = await upsertCustomer(tenantId, body, env);

        return jsonResponse({
          success: true,
          customer,
          customerId: customer.id,
          phoneHash: customer.phoneHash,
          isNew: !!(await getCustomer(customer.id, tenantId, env)) // Indicate if it's a new customer
        });
      }

      if (method === 'GET') {
        // GET /api/customers - List customers
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const search = url.searchParams.get('search') || undefined;
        const tagId = url.searchParams.get('tagId') || undefined;
        const sortByParam = url.searchParams.get('sortBy');
        const sortBy: 'name' | 'total_orders' | 'total_spent' | 'last_order_date' | undefined =
          sortByParam === 'name' || sortByParam === 'total_orders' || sortByParam === 'total_spent' || sortByParam === 'last_order_date'
            ? sortByParam
            : undefined;
        const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

        const result = await listCustomers(tenantId, env, {
          page,
          limit,
          search,
          tagId,
          sortBy,
          sortOrder,
        });

        return jsonResponse({
          success: true,
          customers: result.customers,
          total: result.total,
          pagination: {
            page,
            limit,
            hasMore: result.total > page * limit,
          },
        });
      }
    }

    if (path === '/api/customers/verify-device' && method === 'POST') {
      // POST /api/customers/verify-device - Register device fingerprint after OTP verification
      const body = await request.json<{
        phone: string;
        name?: string;
        email?: string;
        fingerprintHash: string;
        deviceName?: string;
        deviceType?: 'mobile' | 'desktop';
      }>();

      let customer = await getCustomerByPhone(body.phone, tenantId, env);

      if (!customer) {
        customer = await upsertCustomer(tenantId, {
          phone: body.phone,
          name: body.name,
          email: body.email,
        }, env);
      }

      const db = getTenantDatabase(tenantId, env);
      await db.prepare(`
        INSERT INTO customer_devices (id, tenant_id, customer_id, fingerprint_hash, device_name, device_type, last_used_at, verified_via)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'otp')
        ON CONFLICT(tenant_id, fingerprint_hash)
        DO UPDATE SET customer_id = ?, device_name = ?, device_type = ?, last_used_at = datetime('now')
      `).bind(
        crypto.randomUUID(),
        tenantId,
        customer.id,
        body.fingerprintHash,
        body.deviceName || 'Unknown device',
        body.deviceType || 'desktop',
        customer.id,
        body.deviceName || 'Unknown device',
        body.deviceType || 'desktop'
      ).run();

      return jsonResponse({ success: true, customer });
    }

    if (path === '/api/customers/by-fingerprint' && method === 'GET') {
      // GET /api/customers/by-fingerprint - Lookup customer by device fingerprint
      const fingerprintHash = url.searchParams.get('hash');

      if (!fingerprintHash) {
        return jsonResponse({ error: 'Missing fingerprint hash' }, 400);
      }

      const db = getTenantDatabase(tenantId, env);

      const device = await db.prepare(`
        SELECT cd.*, c.id as customer_id, c.phone_number_encrypted, c.name_encrypted, c.email_encrypted,
               c.total_orders, c.total_spent, c.average_order_value, c.encryption_key_version
        FROM customer_devices cd
        JOIN customers c ON cd.customer_id = c.id
        WHERE cd.tenant_id = ? AND cd.fingerprint_hash = ?
      `).bind(tenantId, fingerprintHash).first<any>();

      if (!device) {
        return jsonResponse({ success: true, customer: null });
      }

      await db.prepare(`
        UPDATE customer_devices SET last_used_at = datetime('now')
        WHERE tenant_id = ? AND fingerprint_hash = ?
      `).bind(tenantId, fingerprintHash).run();

      const customer = await getCustomer(device.customer_id, tenantId, env);
      return jsonResponse({ success: true, customer });
    }

    if (path === '/api/customers/by-phone-hash' && method === 'GET') {
      // GET /api/customers/by-phone-hash - Lookup customer by phone hash
      const phoneHash = url.searchParams.get('hash');

      if (!phoneHash) {
        return jsonResponse({ error: 'Missing phone hash' }, 400);
      }

      const db = getTenantDatabase(tenantId, env);

      const customerRecord = await db.prepare(`
        SELECT id FROM customers WHERE tenant_id = ? AND phone_hash = ?
      `).bind(tenantId, phoneHash).first<{ id: string }>();

      if (!customerRecord) {
        return jsonResponse({ success: true, customer: null });
      }

      const customer = await getCustomer(customerRecord.id, tenantId, env);
      return jsonResponse({ success: true, customer });
    }

    // ==========================================================================
    // Parameterized routes - use matchRoute for deterministic matching
    // Order: most specific patterns first (more segments first)
    // ==========================================================================

    // /api/customers/phone/:phone/addresses (4 segments)
    let match = matchRoute('/api/customers/phone/:phone/addresses', path);
    if (match.matched) {
      const phoneNumber = match.params.phone;

      if (method === 'GET') {
        const customer = await getCustomerByPhone(phoneNumber, tenantId, env);
        if (!customer) {
          return jsonResponse({ success: true, addresses: [] });
        }
        const addresses = await getCustomerAddresses(customer.id, tenantId, env);
        return jsonResponse({ success: true, addresses, customerId: customer.id });
      }

      if (method === 'POST') {
        let customer = await getCustomerByPhone(phoneNumber, tenantId, env);
        if (!customer) {
          customer = await upsertCustomer(tenantId, { phone: phoneNumber }, env);
        }
        const body = await request.json<any>();
        const address = await addCustomerAddress(customer.id, tenantId, body, env);
        return jsonResponse({ success: true, address, customerId: customer.id });
      }
    }

    // /api/customers/:customerId/tags/:tagId (4 segments)
    match = matchRoute('/api/customers/:customerId/tags/:tagId', path);
    if (match.matched && method === 'DELETE') {
      const db = getTenantDatabase(tenantId, env);
      await removeTag(match.params.customerId, match.params.tagId, db);
      return jsonResponse({ success: true, message: 'Tag removed' });
    }

    // /api/customers/phone/:phone (3 segments)
    match = matchRoute('/api/customers/phone/:phone', path);
    if (match.matched && method === 'GET') {
      const phoneNumber = match.params.phone;
      const customer = await getCustomerByPhone(phoneNumber, tenantId, env);

      if (!customer) {
        return jsonResponse({ error: 'Customer not found' }, 404);
      }
      return jsonResponse({ success: true, customer });
    }

    // /api/customers/:customerId/tags (3 segments)
    match = matchRoute('/api/customers/:customerId/tags', path);
    if (match.matched) {
      const customerId = match.params.customerId;
      const db = getTenantDatabase(tenantId, env);

      if (method === 'GET') {
        const tags = await getCustomerTags(customerId, db);
        return jsonResponse({ success: true, tags });
      }

      if (method === 'POST') {
        const body = await request.json<{ tagId: string; assignedBy: string }>();
        await assignTag(customerId, body.tagId, body.assignedBy, db);
        return jsonResponse({ success: true, message: 'Tag assigned' });
      }
    }

    // /api/customers/:customerId/addresses (3 segments)
    match = matchRoute('/api/customers/:customerId/addresses', path);
    if (match.matched) {
      const customerId = match.params.customerId;

      if (method === 'GET') {
        const addresses = await getCustomerAddresses(customerId, tenantId, env);
        return jsonResponse({ success: true, addresses });
      }

      if (method === 'POST') {
        const body = await request.json<any>();
        const address = await addCustomerAddress(customerId, tenantId, body, env);
        return jsonResponse({ success: true, address });
      }
    }

    // /api/customers/:phoneHash/orders (3 segments) - Get customer order history
    match = matchRoute('/api/customers/:phoneHash/orders', path);
    if (match.matched && method === 'GET') {
      const phoneHash = match.params.phoneHash;

      // Lookup customer by phone hash
      const db = getTenantDatabase(tenantId, env);
      const customerRecord = await db.prepare(`
        SELECT id FROM customers WHERE tenant_id = ? AND phone_hash = ?
      `).bind(tenantId, phoneHash).first<{ id: string }>();

      if (!customerRecord) {
        return jsonResponse({ success: true, orders: [] });
      }

      // Get customer orders
      const orders = await listOrders(tenantId, {
        customerId: customerRecord.id,
        limit: 50
      }, env);

      return jsonResponse({ success: true, orders: orders.orders, total: orders.total });
    }

    // /api/customers/:phoneHash/address (3 segments) - Add address for customer by phone hash
    match = matchRoute('/api/customers/:phoneHash/address', path);
    if (match.matched && method === 'POST') {
      const phoneHash = match.params.phoneHash;

      // Lookup customer by phone hash
      const db = getTenantDatabase(tenantId, env);
      const customerRecord = await db.prepare(`
        SELECT id FROM customers WHERE tenant_id = ? AND phone_hash = ?
      `).bind(tenantId, phoneHash).first<{ id: string }>();

      if (!customerRecord) {
        return jsonResponse({ error: 'Customer not found' }, 404);
      }

      const body = await request.json<any>();
      const address = await addCustomerAddress(customerRecord.id, tenantId, body, env);
      return jsonResponse({ success: true, address, customerId: customerRecord.id });
    }

    // /api/customers/:identifier (2 segments) - must be last among parameterized routes
    // This handles both customerId and phoneHash lookups
    match = matchRoute('/api/customers/:identifier', path);
    if (match.matched) {
      const identifier = match.params.identifier;

      // Skip if identifier matches reserved words (already handled above)
      if (['verify-device', 'by-fingerprint', 'by-phone-hash', 'phone'].includes(identifier)) {
        return jsonResponse({ error: 'Customer API endpoint not found' }, 404);
      }

      if (method === 'GET') {
        const db = getTenantDatabase(tenantId, env);

        // Try to get customer by ID first
        let customer = await getCustomer(identifier, tenantId, env);

        // If not found by ID, try by phone hash (for backend compatibility)
        if (!customer) {
          const customerRecord = await db.prepare(`
            SELECT id FROM customers WHERE tenant_id = ? AND phone_hash = ?
          `).bind(tenantId, identifier).first<{ id: string }>();

          if (customerRecord) {
            customer = await getCustomer(customerRecord.id, tenantId, env);
          }
        }

        if (!customer) {
          return jsonResponse({ error: 'Customer not found' }, 404);
        }

        return jsonResponse({ success: true, customer });
      }

      if (method === 'DELETE') {
        await deleteCustomer(identifier, tenantId, env);
        return jsonResponse({ success: true, message: 'Customer deleted' });
      }
    }

    return jsonResponse({ error: 'Customer API endpoint not found' }, 404);
  } catch (error) {
    console.error('[RestaurantWorker] Customer API error:', error);
    return jsonResponse(
      {
        error: 'Customer API error',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Handle Tag Definition API endpoints
 */
async function handleTagAPI(
  request: Request,
  tenantId: string,
  path: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  try {
    const db = getTenantDatabase(tenantId, env);

    // GET /api/tag-definitions - List all tags
    if (path === '/api/tag-definitions' && method === 'GET') {
      const tags = await getTagDefinitions(tenantId, db);
      return jsonResponse({ success: true, tags });
    }

    // POST /api/tag-definitions - Create custom tag
    if (path === '/api/tag-definitions' && method === 'POST') {
      const body = await request.json<any>();
      const tag = await createTagDefinition(tenantId, body, db);
      return jsonResponse({ success: true, tag });
    }

    // GET /api/tag-definitions/stats - Get tag usage statistics
    if (path === '/api/tag-definitions/stats' && method === 'GET') {
      const stats = await getTagStats(tenantId, db);
      return jsonResponse({ success: true, stats });
    }

    // POST /api/tag-definitions/bulk-auto-assign - Bulk auto-assign tags
    if (path === '/api/tag-definitions/bulk-auto-assign' && method === 'POST') {
      const processed = await bulkAutoAssignTags(tenantId, db);
      return jsonResponse({
        success: true,
        message: `Processed ${processed} customers`,
        processed,
      });
    }

    // PATCH /api/tag-definitions/:tagId - Update tag definition
    const updateMatch = path.match(/^\/api\/tag-definitions\/([^/]+)$/);
    if (updateMatch && method === 'PATCH') {
      const tagId = updateMatch[1];
      const body = await request.json<any>();
      await updateTagDefinition(tagId, body, db);
      return jsonResponse({ success: true, message: 'Tag updated' });
    }

    // DELETE /api/tag-definitions/:tagId - Delete tag definition
    if (updateMatch && method === 'DELETE') {
      const tagId = updateMatch[1];
      await deleteTagDefinition(tagId, db);
      return jsonResponse({ success: true, message: 'Tag deleted' });
    }

    return jsonResponse({ error: 'Tag API endpoint not found' }, 404);
  } catch (error) {
    console.error('[RestaurantWorker] Tag API error:', error);
    return jsonResponse(
      {
        error: 'Tag API error',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Handle Order API endpoints
 */
async function handleOrderAPI(
  request: Request,
  tenantId: string,
  path: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  try {
    // POST /api/orders - Create order
    if (path === '/api/orders' && method === 'POST') {
      const body = await request.json<OrderInput>();
      const order = await createOrder(body, env);
      return jsonResponse({ success: true, order });
    }

    // GET /api/orders - List orders
    if (path === '/api/orders' && method === 'GET') {
      const url = new URL(request.url);
      const filters: OrderFilters = {
        status: url.searchParams.get('status') as any,
        orderType: url.searchParams.get('orderType') as any,
        source: url.searchParams.get('source') as any,
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        customerId: url.searchParams.get('customerId') || undefined,
        page: parseInt(url.searchParams.get('page') || '1', 10),
        limit: parseInt(url.searchParams.get('limit') || '50', 10),
      };

      const result = await listOrders(tenantId, filters, env);
      return jsonResponse({
        success: true,
        orders: result.orders,
        total: result.total,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          hasMore: result.hasMore,
        },
      });
    }

    // GET /api/orders/stats/today - Get today's statistics
    if (path === '/api/orders/stats/today' && method === 'GET') {
      const stats = await getTodayStats(tenantId, env);
      return jsonResponse({ success: true, stats });
    }

    // GET /api/orders/:orderId - Get order by ID
    const orderIdMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (orderIdMatch && method === 'GET') {
      const orderId = orderIdMatch[1];
      const order = await getOrder(orderId, tenantId, env);
      return jsonResponse({ success: true, order });
    }

    // PATCH /api/orders/:orderId/status - Update order status
    const statusMatch = path.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === 'PATCH') {
      const orderId = statusMatch[1];
      const body = await request.json<{ status: any }>();
      const order = await updateOrderStatus(orderId, tenantId, body.status, env);
      return jsonResponse({ success: true, order });
    }

    return jsonResponse({ error: 'Order API endpoint not found' }, 404);
  } catch (error) {
    console.error('[RestaurantWorker] Order API error:', error);
    return jsonResponse(
      {
        error: 'Order API error',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Handle Inventory API endpoints
 */
async function handleInventoryAPI(
  request: Request,
  tenantId: string,
  path: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  try {
    console.log(`[RestaurantWorker] Inventory API: ${method} ${path}`);

    // ==================== Summary & Alerts (static routes first) ====================

    // GET /api/inventory/summary - Get inventory summary
    if (path === '/api/inventory/summary' && method === 'GET') {
      const summary = await getInventorySummary(tenantId, env);
      return jsonResponse({ success: true, ...summary });
    }

    // GET /api/inventory/alerts/low-stock - Get low stock alerts
    if (path === '/api/inventory/alerts/low-stock' && method === 'GET') {
      const alerts = await getLowStockAlerts(tenantId, env);
      return jsonResponse({ success: true, alerts });
    }

    // GET /api/inventory/alerts/expiring - Get expiry alerts
    if (path === '/api/inventory/alerts/expiring' && method === 'GET') {
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '7', 10);
      const alerts = await getExpiryAlerts(tenantId, days, env);
      return jsonResponse({ success: true, alerts });
    }

    // ==================== Suppliers ====================

    // GET /api/inventory/suppliers - List suppliers
    if (path === '/api/inventory/suppliers' && method === 'GET') {
      const url = new URL(request.url);
      const search = url.searchParams.get('search') || undefined;
      const suppliers = await listSuppliers(tenantId, search, env);
      return jsonResponse({ success: true, suppliers });
    }

    // POST /api/inventory/suppliers - Create supplier
    if (path === '/api/inventory/suppliers' && method === 'POST') {
      const body = await request.json<any>();
      // Map snake_case API fields to camelCase internal fields
      const input = {
        name: body.name,
        contactName: body.contact_name ?? body.contactName ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        gstin: body.gstin ?? null,
        taxId: body.tax_id ?? body.taxId ?? null,
        paymentTerms: body.payment_terms ?? body.paymentTerms ?? null,
        currency: body.currency ?? 'INR',
        bankName: body.bank_name ?? body.bankName ?? null,
        bankAccount: body.bank_account ?? body.bankAccount ?? null,
        notes: body.notes ?? null,
      };
      const supplier = await createSupplier(tenantId, input, env);
      return jsonResponse({ success: true, supplier });
    }

    // GET /api/inventory/suppliers/:id - Get supplier
    const supplierIdMatch = path.match(/^\/api\/inventory\/suppliers\/([^/]+)$/);
    if (supplierIdMatch && method === 'GET') {
      const supplierId = supplierIdMatch[1];
      const supplier = await getSupplier(supplierId, tenantId, env);
      if (!supplier) {
        return jsonResponse({ error: 'Supplier not found' }, 404);
      }
      return jsonResponse({ success: true, supplier });
    }

    // PUT /api/inventory/suppliers/:id - Update supplier
    if (supplierIdMatch && method === 'PUT') {
      const supplierId = supplierIdMatch[1];
      const body = await request.json<any>();
      // Map snake_case API fields to camelCase internal fields
      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.contact_name !== undefined || body.contactName !== undefined) {
        updates.contactName = body.contact_name ?? body.contactName;
      }
      if (body.email !== undefined) updates.email = body.email;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.address !== undefined) updates.address = body.address;
      if (body.gstin !== undefined) updates.gstin = body.gstin;
      if (body.tax_id !== undefined || body.taxId !== undefined) {
        updates.taxId = body.tax_id ?? body.taxId;
      }
      if (body.payment_terms !== undefined || body.paymentTerms !== undefined) {
        updates.paymentTerms = body.payment_terms ?? body.paymentTerms;
      }
      if (body.currency !== undefined) updates.currency = body.currency;
      if (body.bank_name !== undefined || body.bankName !== undefined) {
        updates.bankName = body.bank_name ?? body.bankName;
      }
      if (body.bank_account !== undefined || body.bankAccount !== undefined) {
        updates.bankAccount = body.bank_account ?? body.bankAccount;
      }
      if (body.notes !== undefined) updates.notes = body.notes;

      const supplier = await updateSupplier(supplierId, tenantId, updates, env);
      return jsonResponse({ success: true, supplier });
    }

    // DELETE /api/inventory/suppliers/:id - Delete supplier
    if (supplierIdMatch && method === 'DELETE') {
      const supplierId = supplierIdMatch[1];
      await deleteSupplier(supplierId, tenantId, env);
      return jsonResponse({ success: true, message: 'Supplier deleted' });
    }

    // ==================== Documents (Invoices, Bills) ====================

    // GET /api/inventory/documents - List documents
    if (path === '/api/inventory/documents' && method === 'GET') {
      const url = new URL(request.url);
      const filters = {
        type: url.searchParams.get('type') as any || undefined,
        supplierId: url.searchParams.get('supplierId') || url.searchParams.get('supplier_id') || undefined,
        startDate: url.searchParams.get('startDate') || url.searchParams.get('start_date') || undefined,
        endDate: url.searchParams.get('endDate') || url.searchParams.get('end_date') || undefined,
        limit: parseInt(url.searchParams.get('limit') || '50', 10),
        offset: parseInt(url.searchParams.get('offset') || '0', 10),
      };
      const result = await listDocuments(tenantId, filters, env);
      return jsonResponse({ success: true, ...result });
    }

    // POST /api/inventory/documents - Create document
    if (path === '/api/inventory/documents' && method === 'POST') {
      const body = await request.json<any>();
      const input = {
        type: body.type || 'invoice',
        invoiceNumber: body.invoice_number ?? body.invoiceNumber ?? undefined,
        invoiceDate: body.invoice_date ?? body.invoiceDate ?? undefined,
        supplierId: body.supplier_id ?? body.supplierId ?? undefined,
        originalFilename: body.original_filename ?? body.originalFilename ?? undefined,
        ocrProvider: body.ocr_provider ?? body.ocrProvider ?? undefined,
        extractedData: body.extracted_data ?? body.extractedData ?? undefined,
        processingTimeMs: body.processing_time_ms ?? body.processingTimeMs ?? undefined,
        createdBy: body.created_by ?? body.createdBy ?? undefined,
      };
      const document = await createDocument(tenantId, input, env);
      return jsonResponse({ success: true, document });
    }

    // GET /api/inventory/documents/:id - Get document
    const documentIdMatch = path.match(/^\/api\/inventory\/documents\/([^/]+)$/);
    if (documentIdMatch && method === 'GET') {
      const documentId = documentIdMatch[1];
      const document = await getDocument(documentId, tenantId, env);
      if (!document) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }
      return jsonResponse({ success: true, document });
    }

    // ==================== Recipes ====================

    // GET /api/inventory/recipes - List recipes
    if (path === '/api/inventory/recipes' && method === 'GET') {
      const recipes = await listRecipes(tenantId, env);
      return jsonResponse({ success: true, recipes });
    }

    // POST /api/inventory/recipes - Create recipe
    if (path === '/api/inventory/recipes' && method === 'POST') {
      const body = await request.json<any>();
      const recipe = await createRecipe(tenantId, body, env);
      return jsonResponse({ success: true, recipe });
    }

    // GET /api/inventory/recipes/by-menu-item/:menuItemId - Get recipe by menu item
    const recipeByMenuMatch = path.match(/^\/api\/inventory\/recipes\/by-menu-item\/([^/]+)$/);
    if (recipeByMenuMatch && method === 'GET') {
      const menuItemId = recipeByMenuMatch[1];
      const recipe = await getRecipeByMenuItem(menuItemId, tenantId, env);
      return jsonResponse({ success: true, recipe });
    }

    // GET /api/inventory/recipes/cost/:menuItemId - Get recipe cost
    const recipeCostMatch = path.match(/^\/api\/inventory\/recipes\/cost\/([^/]+)$/);
    if (recipeCostMatch && method === 'GET') {
      const menuItemId = recipeCostMatch[1];
      const cost = await getRecipeCost(menuItemId, tenantId, env);
      return jsonResponse({ success: true, cost });
    }

    // GET /api/inventory/recipes/:id - Get recipe
    const recipeIdMatch = path.match(/^\/api\/inventory\/recipes\/([^/]+)$/);
    if (recipeIdMatch && method === 'GET') {
      const recipeId = recipeIdMatch[1];
      const recipe = await getRecipe(recipeId, tenantId, env);
      if (!recipe) {
        return jsonResponse({ error: 'Recipe not found' }, 404);
      }
      return jsonResponse({ success: true, recipe });
    }

    // PUT /api/inventory/recipes/:id - Update recipe
    if (recipeIdMatch && method === 'PUT') {
      const recipeId = recipeIdMatch[1];
      const body = await request.json<any>();
      const recipe = await updateRecipe(recipeId, tenantId, body, env);
      return jsonResponse({ success: true, recipe });
    }

    // DELETE /api/inventory/recipes/:id - Delete recipe
    if (recipeIdMatch && method === 'DELETE') {
      const recipeId = recipeIdMatch[1];
      await deleteRecipe(recipeId, tenantId, env);
      return jsonResponse({ success: true, message: 'Recipe deleted' });
    }

    // ==================== Transactions ====================

    // GET /api/inventory/transactions - List transactions
    if (path === '/api/inventory/transactions' && method === 'GET') {
      const url = new URL(request.url);
      const filters = {
        itemId: url.searchParams.get('itemId') || undefined,
        documentId: url.searchParams.get('documentId') || undefined,
        transactionType: url.searchParams.get('transactionType') as any || undefined,
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        limit: parseInt(url.searchParams.get('limit') || '50', 10),
        offset: parseInt(url.searchParams.get('offset') || '0', 10),
      };
      const result = await listTransactions(tenantId, filters, env);
      return jsonResponse({ success: true, ...result });
    }

    // POST /api/inventory/transactions - Create transaction
    if (path === '/api/inventory/transactions' && method === 'POST') {
      const body = await request.json<any>();
      const transaction = await createTransaction(tenantId, body, env);
      return jsonResponse({ success: true, transaction });
    }

    // ==================== Order Deduction ====================

    // POST /api/inventory/orders/deduct - Deduct inventory for order
    if (path === '/api/inventory/orders/deduct' && method === 'POST') {
      const body = await request.json<{ orderId: string; items: Array<{ menuItemId: string; quantity: number }> }>();
      const result = await deductInventoryForOrder(tenantId, body.orderId, body.items, env);
      return jsonResponse({ success: true, ...result });
    }

    // ==================== Inventory Items (parameterized routes last) ====================

    // GET /api/inventory - List inventory items
    if ((path === '/api/inventory' || path === '/api/inventory/') && method === 'GET') {
      const url = new URL(request.url);
      const filters = {
        category: url.searchParams.get('category') as InventoryCategory || undefined,
        supplierId: url.searchParams.get('supplierId') || undefined,
        search: url.searchParams.get('search') || undefined,
        lowStock: url.searchParams.get('lowStock') === 'true',
        expiringSoon: url.searchParams.get('expiringSoon') === 'true',
        limit: parseInt(url.searchParams.get('limit') || '50', 10),
        offset: parseInt(url.searchParams.get('offset') || '0', 10),
      };
      const result = await listInventoryItems(tenantId, filters, env);
      return jsonResponse({ success: true, items: result.items, total: result.total });
    }

    // POST /api/inventory - Create inventory item
    if ((path === '/api/inventory' || path === '/api/inventory/') && method === 'POST') {
      const body = await request.json<any>();
      // Map snake_case API fields to camelCase internal fields
      const input = {
        name: body.name,
        quantity: body.quantity ?? 0,
        unit: body.unit || 'pcs',
        category: body.category || 'other',
        supplierId: body.supplier_id ?? body.supplierId ?? null,
        pricePerUnit: body.price_per_unit ?? body.pricePerUnit ?? null,
        expiryDate: body.expiry_date ?? body.expiryDate ?? null,
        reorderLevel: body.reorder_level ?? body.reorderLevel ?? null,
        storageLocation: body.storage_location ?? body.storageLocation ?? null,
        notes: body.notes ?? null,
      };
      const item = await createInventoryItem(tenantId, input, env);
      return jsonResponse({ success: true, item });
    }

    // GET /api/inventory/:id - Get inventory item
    const itemIdMatch = path.match(/^\/api\/inventory\/([^/]+)$/);
    if (itemIdMatch && method === 'GET') {
      const itemId = itemIdMatch[1];
      // Skip if it's a known sub-path
      if (['summary', 'suppliers', 'recipes', 'transactions', 'alerts', 'orders'].includes(itemId)) {
        return jsonResponse({ error: 'Inventory endpoint not found' }, 404);
      }
      const item = await getInventoryItem(itemId, tenantId, env);
      if (!item) {
        return jsonResponse({ error: 'Inventory item not found' }, 404);
      }
      return jsonResponse({ success: true, item });
    }

    // PUT /api/inventory/:id - Update inventory item
    if (itemIdMatch && method === 'PUT') {
      const itemId = itemIdMatch[1];
      const body = await request.json<any>();
      // Map snake_case API fields to camelCase internal fields
      const updates: any = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.quantity !== undefined) updates.quantity = body.quantity;
      if (body.unit !== undefined) updates.unit = body.unit;
      if (body.category !== undefined) updates.category = body.category;
      if (body.supplier_id !== undefined || body.supplierId !== undefined) {
        updates.supplierId = body.supplier_id ?? body.supplierId;
      }
      if (body.price_per_unit !== undefined || body.pricePerUnit !== undefined) {
        updates.pricePerUnit = body.price_per_unit ?? body.pricePerUnit;
      }
      if (body.expiry_date !== undefined || body.expiryDate !== undefined) {
        updates.expiryDate = body.expiry_date ?? body.expiryDate;
      }
      if (body.reorder_level !== undefined || body.reorderLevel !== undefined) {
        updates.reorderLevel = body.reorder_level ?? body.reorderLevel;
      }
      if (body.storage_location !== undefined || body.storageLocation !== undefined) {
        updates.storageLocation = body.storage_location ?? body.storageLocation;
      }
      if (body.notes !== undefined) updates.notes = body.notes;

      const item = await updateInventoryItem(itemId, tenantId, updates, env);
      return jsonResponse({ success: true, item });
    }

    // DELETE /api/inventory/:id - Delete inventory item
    if (itemIdMatch && method === 'DELETE') {
      const itemId = itemIdMatch[1];
      await deleteInventoryItem(itemId, tenantId, env);
      return jsonResponse({ success: true, message: 'Inventory item deleted' });
    }

    return jsonResponse({ error: 'Inventory API endpoint not found' }, 404);
  } catch (error) {
    console.error('[RestaurantWorker] Inventory API error:', error);
    return jsonResponse(
      {
        error: 'Inventory API error',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Handle Menu API Endpoints (existing)
 */
async function handleMenuAPI(
  request: Request,
  path: string,
  tenantId: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  try {
    console.log(`[RestaurantWorker] Menu API: ${method} ${path} for tenant: ${tenantId}`);

    // Check if tenant has D1 database - if yes, use D1-based menu, otherwise fallback to KV
    const hasTenantDb = await hasTenantDatabase(tenantId, env);
    console.log(`[RestaurantWorker] Menu API - Tenant ${tenantId} has database: ${hasTenantDb}`);

    if (hasTenantDb) {
      // Use D1-based menu APIs
      return handleMenuD1API(request, path, tenantId, method, env);
    }

    // Fallback to KV-based menu (legacy)
    return handleMenuKVAPI(path, tenantId, env);
  } catch (error) {
    console.error('[RestaurantWorker] Menu API Error:', error);
    return jsonResponse(
      {
        error: 'Menu API error',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * D1-based menu reading endpoints (public)
 */
async function handleMenuD1API(
  request: Request,
  path: string,
  tenantId: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  // POST /api/menu/parse-from-r2 - Parse menu file from R2 (tenant-specific, no admin auth required)
  if (path === '/api/menu/parse-from-r2' && method === 'POST') {
    console.log(`[RestaurantWorker] Tenant-specific parse-from-r2 for tenant: ${tenantId}`);

    // Proxy to restaurant-client worker's admin endpoint
    // The restaurant-client will handle the actual R2 parsing with AI
    const clientUrl = env.RESTAURANT_CLIENT_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev';
    const proxyUrl = `${clientUrl}/api/admin/menu/parse-from-r2`;

    console.log(`[RestaurantWorker] Proxying to: ${proxyUrl}`);

    // Forward the request with tenant headers
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set('X-Tenant-ID', tenantId);

    // Copy Authorization header if present (Bearer token from POS app)
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      proxyHeaders.set('Authorization', authHeader);
    }

    try {
      const proxyRequest = new Request(proxyUrl, {
        method: 'POST',
        headers: proxyHeaders,
        body: request.body,
      });

      const response = await fetch(proxyRequest);

      console.log(`[RestaurantWorker] Parse response status: ${response.status}`);

      // Return the response from restaurant-client with CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID, Authorization');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('[RestaurantWorker] Parse-from-r2 proxy error:', error);
      return jsonResponse(
        {
          success: false,
          error: 'Failed to parse menu file',
          message: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  }

  // GET /api/menu - Get all menu items
  if (path === '/api/menu' || path === '/api/menu/') {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId') || undefined;
    const isAvailable = url.searchParams.get('isAvailable') === 'true' ? true : undefined;
    const isFeatured = url.searchParams.get('isFeatured') === 'true' ? true : undefined;
    const isVegetarian = url.searchParams.get('isVegetarian') === 'true' ? true : undefined;
    const search = url.searchParams.get('search') || undefined;

    const filters: MenuItemFilters = {
      categoryId,
      isAvailable,
      isFeatured,
      isVegetarian,
      search,
    };

    const result = await listMenuItems(tenantId, filters, env);
    return jsonResponse({ success: true, items: result.items, total: result.total });
  }

  // GET /api/menu/metadata - Get menu metadata
  if (path === '/api/menu/metadata' || path === '/api/menu/metadata/') {
    const metadata = await getMenuMetadata(tenantId, env);
    return jsonResponse({ success: true, metadata });
  }

  // GET /api/menu/categories - Get category hierarchy
  if (path === '/api/menu/categories' || path === '/api/menu/categories/') {
    const categories = await listCategories(tenantId, env);
    return jsonResponse({ success: true, categories });
  }

  // GET /api/menu/:itemId - Get menu item details
  const itemMatch = path.match(/^\/api\/menu\/([^/]+)$/);
  if (itemMatch && method === 'GET') {
    const itemId = itemMatch[1];
    const item = await getMenuItem(itemId, tenantId, env);
    return jsonResponse({ success: true, item });
  }

  return jsonResponse({ error: 'Menu endpoint not found' }, 404);
}

/**
 * Legacy KV-based menu reading endpoints
 */
async function handleMenuKVAPI(
  path: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<Response> {
  console.log(`[RestaurantWorker] Legacy KV Menu API: ${path} for tenant: ${tenantId}`);

  // GET /api/menu - Get all menu items
  if (path === '/api/menu' || path === '/api/menu/') {
    const menuData = await env.TENANT_METADATA.get(`menu:${tenantId}:data`, 'json');

    if (!menuData) {
      return jsonResponse({ error: 'Menu not found', tenantId }, 404);
    }

    return jsonResponse(menuData);
  }

  // GET /api/menu/metadata - Get menu metadata
  if (path === '/api/menu/metadata' || path === '/api/menu/metadata/') {
    const metadata = await env.TENANT_METADATA.get(`menu:${tenantId}:metadata`, 'json');

    if (!metadata) {
      return jsonResponse({ error: 'Menu metadata not found', tenantId }, 404);
    }

    return jsonResponse(metadata);
  }

  // GET /api/menu/categories - Get category hierarchy
  if (path === '/api/menu/categories' || path === '/api/menu/categories/') {
    const categories = await env.TENANT_METADATA.get(`menu:${tenantId}:categories`, 'json');

    if (!categories) {
      return jsonResponse({ error: 'Menu categories not found', tenantId }, 404);
    }

    return jsonResponse(categories);
  }

  // GET /api/config/voice - Get voice ordering configuration
  if (path === '/api/config/voice' || path === '/api/config/voice/') {
    const voiceConfig = await env.TENANT_METADATA.get(`config:${tenantId}:voice`, 'json');

    if (!voiceConfig) {
      return jsonResponse(
        {
          error: 'Voice config not found',
          tenantId,
          message: 'Voice ordering not configured for this tenant',
        },
        404
      );
    }

    return jsonResponse(voiceConfig);
  }

  // GET /api/config/theme - Get theme configuration
  if (path === '/api/config/theme' || path === '/api/config/theme/') {
    const themeConfig = await env.TENANT_METADATA.get(`config:${tenantId}:theme`, 'json');

    if (!themeConfig) {
      return jsonResponse(
        {
          error: 'Theme config not found',
          tenantId,
          message: 'Theme not configured for this tenant',
        },
        404
      );
    }

    return jsonResponse(themeConfig);
  }

  // GET /api/restaurant/:tenantId/profile - Get restaurant profile
  const profileMatch = path.match(/^\/api\/restaurant\/([^/]+)\/profile\/?$/);
  if (profileMatch) {
    const requestedTenantId = profileMatch[1];

    if (requestedTenantId !== tenantId) {
      return jsonResponse(
        {
          error: 'Unauthorized',
          message: 'Cannot access profile for different tenant',
        },
        403
      );
    }

    const themeConfig: any =
      (await env.TENANT_METADATA.get(`config:${tenantId}:theme`, 'json')) || {};
    const menuMetadata: any =
      (await env.TENANT_METADATA.get(`menu:${tenantId}:metadata`, 'json')) || {};

    const profile = {
      tenantId,
      name: themeConfig.branding?.name || 'Restaurant',
      cuisine: themeConfig.branding?.cuisine?.join(', ') || 'Multi-cuisine',
      address: 'Address not configured',
      phone: '+1234567890',
      hours: '10 AM - 10 PM',
      about: themeConfig.branding?.description || 'Welcome to our restaurant',
      brandIdentity: {
        primaryColor: themeConfig.branding?.colors?.primary || '#FFA000',
        logo: themeConfig.branding?.logo?.url || null,
        tagline: themeConfig.branding?.tagline || null,
      },
      status: 'active',
      createdAt: themeConfig.createdAt || new Date().toISOString(),
      updatedAt: themeConfig.updatedAt || new Date().toISOString(),
      menuStats: menuMetadata.stats || null,
    };

    return jsonResponse({ success: true, profile });
  }

  return jsonResponse({ error: 'Menu endpoint not found' }, 404);
}

/**
 * Handle Menu Management API endpoints (admin only)
 */
async function handleMenuManagementAPI(
  request: Request,
  tenantId: string,
  path: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  try {
    console.log(`[RestaurantWorker] Menu Management API: ${method} ${path}`);

    // ==================== Category Endpoints ====================

    // GET /api/admin/menu/categories - List all categories
    if (path === '/api/admin/menu/categories' && method === 'GET') {
      const categories = await listCategories(tenantId, env);
      return jsonResponse({ success: true, categories });
    }

    // POST /api/admin/menu/categories - Create category
    if (path === '/api/admin/menu/categories' && method === 'POST') {
      const body = await request.json<CreateCategoryInput>();
      const category = await createCategory(tenantId, body, env);
      return jsonResponse({ success: true, category });
    }

    // PUT /api/admin/menu/categories/:id - Update category
    const updateCategoryMatch = path.match(/^\/api\/admin\/menu\/categories\/([^/]+)$/);
    if (updateCategoryMatch && method === 'PUT') {
      const categoryId = updateCategoryMatch[1];
      const body = await request.json<UpdateCategoryInput>();
      const category = await updateCategory(categoryId, tenantId, body, env);
      return jsonResponse({ success: true, category });
    }

    // DELETE /api/admin/menu/categories/:id - Delete category
    if (updateCategoryMatch && method === 'DELETE') {
      const categoryId = updateCategoryMatch[1];
      await deleteCategory(categoryId, tenantId, env);
      return jsonResponse({ success: true, message: 'Category deleted' });
    }

    // ==================== Menu Item Endpoints ====================

    // GET /api/admin/menu/items - List menu items with filters
    if (path === '/api/admin/menu/items' && method === 'GET') {
      const url = new URL(request.url);
      const categoryId = url.searchParams.get('categoryId') || undefined;
      const isAvailable = url.searchParams.get('isAvailable') === 'true' ? true : undefined;
      const isFeatured = url.searchParams.get('isFeatured') === 'true' ? true : undefined;
      const search = url.searchParams.get('search') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const filters: MenuItemFilters = {
        categoryId,
        isAvailable,
        isFeatured,
        search,
        limit,
        offset,
      };

      const result = await listMenuItems(tenantId, filters, env);
      return jsonResponse({
        success: true,
        items: result.items,
        total: result.total,
        pagination: { limit, offset, hasMore: result.total > offset + limit },
      });
    }

    // POST /api/admin/menu/items - Create menu item
    if (path === '/api/admin/menu/items' && method === 'POST') {
      const body = await request.json<CreateMenuItemInput>();
      const item = await createMenuItem(tenantId, body, env);
      await invalidateMenuCache(tenantId, env);
      return jsonResponse({ success: true, item });
    }

    // PUT /api/admin/menu/items/:id - Update menu item
    const updateItemMatch = path.match(/^\/api\/admin\/menu\/items\/([^/]+)$/);
    if (updateItemMatch && method === 'PUT') {
      const itemId = updateItemMatch[1];
      const body = await request.json<UpdateMenuItemInput>();
      const item = await updateMenuItem(itemId, tenantId, body, env);
      await invalidateMenuCache(tenantId, env);
      return jsonResponse({ success: true, item });
    }

    // DELETE /api/admin/menu/items/:id - Delete menu item
    if (updateItemMatch && method === 'DELETE') {
      const itemId = updateItemMatch[1];
      await deleteMenuItem(itemId, tenantId, env);
      await invalidateMenuCache(tenantId, env);
      return jsonResponse({ success: true, message: 'Menu item deleted' });
    }

    // PATCH /api/admin/menu/items/:id/availability - Toggle availability
    const availabilityMatch = path.match(/^\/api\/admin\/menu\/items\/([^/]+)\/availability$/);
    if (availabilityMatch && method === 'PATCH') {
      const itemId = availabilityMatch[1];
      const body = await request.json<{ isAvailable: boolean }>();
      const item = await updateMenuItem(itemId, tenantId, { isAvailable: body.isAvailable }, env);
      await invalidateMenuCache(tenantId, env);
      return jsonResponse({ success: true, item });
    }

    // ==================== Menu Metadata Endpoints ====================

    // GET /api/admin/menu/metadata - Get menu metadata
    if (path === '/api/admin/menu/metadata' && method === 'GET') {
      const metadata = await getMenuMetadata(tenantId, env);
      return jsonResponse({ success: true, metadata });
    }

    // PUT /api/admin/menu/metadata - Update menu metadata
    if (path === '/api/admin/menu/metadata' && method === 'PUT') {
      const body = await request.json<Partial<MenuMetadata>>();
      const metadata = await updateMenuMetadata(tenantId, body, env);
      await invalidateMenuCache(tenantId, env);
      return jsonResponse({ success: true, metadata });
    }

    // ==================== Dine-In Pricing Endpoints ====================

    // GET /api/admin/menu/dine-in-pricing - Get all dine-in pricing overrides
    if (path === '/api/admin/menu/dine-in-pricing' && method === 'GET') {
      const overrides = await getDineInPricingOverrides(tenantId, env);
      return jsonResponse({ success: true, overrides });
    }

    // PUT /api/admin/menu/dine-in-pricing/:menuItemId - Save dine-in pricing override
    const dineInPricingMatch = path.match(/^\/api\/admin\/menu\/dine-in-pricing\/([^/]+)$/);
    if (dineInPricingMatch && method === 'PUT') {
      const menuItemId = dineInPricingMatch[1];
      const body = await request.json<{ dineInPrice: number | null; dineInAvailable: boolean }>();
      const override = await saveDineInPricingOverride(tenantId, menuItemId, body.dineInPrice, body.dineInAvailable, env);
      return jsonResponse({ success: true, override });
    }

    // DELETE /api/admin/menu/dine-in-pricing/:menuItemId - Delete dine-in pricing override
    if (dineInPricingMatch && method === 'DELETE') {
      const menuItemId = dineInPricingMatch[1];
      await deleteDineInPricingOverride(tenantId, menuItemId, env);
      return jsonResponse({ success: true, message: 'Dine-in pricing override deleted' });
    }

    // POST /api/admin/menu/dine-in-pricing/bulk - Bulk save dine-in pricing overrides
    if (path === '/api/admin/menu/dine-in-pricing/bulk' && method === 'POST') {
      const body = await request.json<{ overrides: Array<{ menuItemId: string; dineInPrice: number | null; dineInAvailable: boolean }> }>();
      const count = await bulkSaveDineInPricingOverrides(tenantId, body.overrides, env);
      return jsonResponse({ success: true, savedCount: count });
    }

    // DELETE /api/admin/menu/dine-in-pricing - Reset all dine-in pricing overrides
    if (path === '/api/admin/menu/dine-in-pricing' && method === 'DELETE') {
      const count = await resetAllDineInPricingOverrides(tenantId, env);
      return jsonResponse({ success: true, deletedCount: count });
    }

    // ==================== Unassigned Images Endpoints ====================

    if (path === '/api/admin/menu/unassigned-images' || path.startsWith('/api/admin/unassigned-images')) {
      return handleUnassignedImagesAPI(request, tenantId, path, method, env);
    }

    // ==================== Floor Plan Endpoints ====================

    // GET /api/admin/floor-plan - Get floor plan (sections, tables, assignments)
    if (path === '/api/admin/floor-plan' && method === 'GET') {
      const { getFloorPlan } = await import('./lib/floor-plan');
      const db = getTenantDatabase(tenantId, env);
      if (!db) {
        return jsonResponse({ error: 'Tenant database not found' }, 404);
      }
      const floorPlan = await getFloorPlan(db, tenantId);
      if (!floorPlan) {
        return jsonResponse({ success: false, error: 'Floor plan not found' }, 404);
      }
      return jsonResponse({
        success: true,
        sections: floorPlan.sections,
        tables: floorPlan.tables,
        assignments: floorPlan.assignments,
      });
    }

    // PUT /api/admin/floor-plan - Save floor plan (sections, tables, assignments)
    if (path === '/api/admin/floor-plan' && method === 'PUT') {
      const { saveFloorPlan } = await import('./lib/floor-plan');
      const db = getTenantDatabase(tenantId, env);
      if (!db) {
        return jsonResponse({ error: 'Tenant database not found' }, 404);
      }
      const body = await request.json<{ sections: any[]; tables: any[]; assignments: any[] }>();
      await saveFloorPlan(db, tenantId, {
        sections: body.sections || [],
        tables: body.tables || [],
        assignments: body.assignments || [],
      });
      return jsonResponse({
        success: true,
        message: 'Floor plan saved',
        savedAt: new Date().toISOString(),
      });
    }

    return jsonResponse({ error: 'Menu management endpoint not found' }, 404);
  } catch (error) {
    console.error('[RestaurantWorker] Menu Management API Error:', error);
    return jsonResponse(
      {
        error: 'Menu management error',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Proxy document scanning requests to vision-inventory worker
 * This enables OCR/bill scanning through the restaurant worker
 */
async function proxyToVisionInventory(
  request: Request,
  tenantId: string,
  path: string,
  env: RestaurantEnv
): Promise<Response> {
  const visionApiUrl = env.INVENTORY_API_URL || 'https://vision-inventory.suyesh.workers.dev';
  const url = new URL(request.url);
  const proxyUrl = `${visionApiUrl}${path}${url.search}`;

  console.log(`[RestaurantWorker] Proxying document request to vision-inventory: ${proxyUrl}`);

  // Clone request and add tenant header
  const headers = new Headers(request.headers);
  headers.set('X-Tenant-ID', tenantId);

  // Remove host header to avoid issues
  headers.delete('host');

  try {
    console.log(`[RestaurantWorker] Proxy request: ${request.method} ${proxyUrl}`);
    console.log(`[RestaurantWorker] Content-Type: ${request.headers.get('Content-Type')}`);

    // Buffer the body first for multipart requests to avoid streaming issues
    let body: ArrayBuffer | undefined = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
      console.log(`[RestaurantWorker] Request body size: ${body.byteLength} bytes`);
    }

    // For proxying, send buffered body
    const response = await fetch(proxyUrl, {
      method: request.method,
      headers: headers,
      body: body,
    });

    console.log(`[RestaurantWorker] Proxy response: ${response.status} ${response.statusText}`);

    // Clone response with CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[RestaurantWorker] Vision inventory proxy error:', error);
    return jsonResponse(
      {
        error: 'Failed to connect to document processing service',
        message: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
}

/**
 * Route requests to tenant-specific worker via dispatch namespace
 * Used for dynamically provisioned tenants (Workers for Platforms)
 */
async function routeToTenantWorker(
  request: Request,
  tenantId: string,
  tenantMetadata: TenantMetadata | null,
  env: RestaurantEnv
): Promise<Response> {
  if (!env.TENANT_DISPATCH) {
    console.error(`[RestaurantWorker] TENANT_DISPATCH binding not available`);
    return jsonResponse({ error: 'Tenant worker routing not configured' }, 503);
  }

  // Get tenant subdomain from metadata
  let subdomain = tenantMetadata?.subdomain;

  if (!subdomain) {
    // Try fetching from KV if not in memory
    try {
      const kvMetadata = await env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json') as any;
      subdomain = kvMetadata?.subdomain;
    } catch (error) {
      console.error(`[RestaurantWorker] Error fetching tenant metadata from KV:`, error);
    }
  }

  if (!subdomain) {
    console.error(`[RestaurantWorker] Tenant subdomain not found for ${tenantId}`);
    return jsonResponse({ error: 'Tenant subdomain not found' }, 404);
  }

  const workerName = `tenant-${subdomain}`;

  console.log(`[RestaurantWorker] Dispatching to tenant worker: ${workerName}`);

  try {
    // Get tenant worker from dispatch namespace
    const tenantWorker = env.TENANT_DISPATCH.get(workerName);

    // Strip /api prefix from the path for tenant worker
    // Tenant worker expects /menu, /categories, etc. without /api prefix
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.substring(4); // Remove '/api' prefix
    }

    // Forward request to tenant worker via dispatch namespace
    const tenantWorkerRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Add tenant context headers
    tenantWorkerRequest.headers.set('X-Tenant-ID', tenantId);
    if (subdomain) {
      tenantWorkerRequest.headers.set('X-Tenant-Subdomain', subdomain);
    }

    // Dispatch to tenant worker
    const response = await tenantWorker.fetch(tenantWorkerRequest);

    console.log(`[RestaurantWorker] Tenant worker response: ${response.status}`);
    return response;
  } catch (error) {
    console.error(`[RestaurantWorker] Error routing to tenant worker ${workerName}:`, error);
    return jsonResponse(
      {
        error: 'Failed to route to tenant worker',
        message: error instanceof Error ? error.message : String(error),
        tenantId,
        workerName,
      },
      502
    );
  }
}

/**
 * Proxy requests to restaurant-client
 */
async function proxyToRestaurantClient(
  request: Request,
  tenantId: string | null,
  tenantMetadata: TenantMetadata | null,
  env: RestaurantEnv
): Promise<Response> {
  const url = new URL(request.url);
  const clientUrl = env.RESTAURANT_CLIENT_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev';
  const proxyUrl = `${clientUrl}${url.pathname}${url.search}`;

  console.log(`[RestaurantWorker] Proxying to: ${proxyUrl}`);

  const filteredHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'host' || lowerKey.startsWith('cf-') || lowerKey === 'x-forwarded-host') {
      continue;
    }
    filteredHeaders.set(key, value);
  }

  if (!filteredHeaders.has('User-Agent')) {
    filteredHeaders.set('User-Agent', 'Handsfree-Restaurant-Worker/1.0');
  }

  if (tenantId) {
    filteredHeaders.set('X-Tenant-ID', tenantId);
  }
  filteredHeaders.set('X-Business-Category', 'RESTAURANT');
  if (tenantMetadata?.companyName) {
    filteredHeaders.set('X-Company-Name', tenantMetadata.companyName);
  } else if (tenantId) {
    filteredHeaders.set('X-Company-Name', tenantId);
  }

  const proxyRequest = new Request(proxyUrl, {
    method: request.method,
    headers: filteredHeaders,
    body: request.body,
  });

  const response = await fetch(proxyRequest);

  console.log(`[RestaurantWorker] Response status: ${response.status}`);

  return response;
}

/**
 * Extract tenant ID from hostname
 */
function extractTenantFromHostname(hostname: string, platformDomain: string): string | null {
  try {
    hostname = hostname.replace(/^https?:\/\//, '');
    const parts = hostname.split('.');

    if (parts.length >= 3) {
      const domainParts = platformDomain.split('.');
      const hostnameEnding = parts.slice(-domainParts.length).join('.');

      if (hostnameEnding === platformDomain) {
        const subdomain = parts.slice(0, -domainParts.length).join('.');
        return subdomain || null;
      }
    }

    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'demo';
    }

    return null;
  } catch (error) {
    console.error('[RestaurantWorker] Error extracting tenant:', error);
    return null;
  }
}

/**
 * Get tenant metadata from KV
 */
async function getTenantMetadata(
  tenantId: string | null,
  env: RestaurantEnv
): Promise<TenantMetadata | null> {
  if (!tenantId) {
    return null;
  }
  try {
    const tenantKey = `tenant:${tenantId}`;
    const tenantData = (await env.TENANT_METADATA.get(tenantKey, 'json')) as TenantMetadata | null;

    if (tenantData) {
      console.log(`[RestaurantWorker] Found tenant in KV: ${tenantKey}`);
      return tenantData;
    }

    const adminTenants = (await env.TENANT_METADATA.get('admin_tenants', 'json')) as
      | TenantMetadata[]
      | null;

    if (adminTenants && Array.isArray(adminTenants)) {
      const tenant = adminTenants.find((t: TenantMetadata) => t.tenantId === tenantId);

      if (tenant) {
        console.log(`[RestaurantWorker] Found tenant in admin_tenants array`);
        return tenant;
      }
    }

    console.warn(`[RestaurantWorker] Tenant not found in KV: ${tenantId}`);
    return null;
  } catch (error) {
    console.error('[RestaurantWorker] Error fetching tenant metadata:', error);
    return null;
  }
}

/**
 * Handle Unassigned Images API
 */
async function handleUnassignedImagesAPI(
  request: Request,
  tenantId: string,
  path: string,
  method: string,
  env: RestaurantEnv
): Promise<Response> {
  const url = new URL(request.url);

  // Allow tenantId from query parameter if this is a generic route
  const queryTenantId = url.searchParams.get('tenantId');
  const targetTenantId = queryTenantId || tenantId;

  if (!targetTenantId) {
    return jsonResponse({ error: 'Missing tenantId' }, 400);
  }

  const db = getTenantDatabase(targetTenantId, env);

  if (method === 'GET') {
    try {
      const result = await db
        .prepare(`SELECT * FROM unassigned_images WHERE tenant_id = ? ORDER BY uploaded_at DESC`)
        .bind(targetTenantId)
        .all<any>();

      return jsonResponse({
        success: true,
        images: result.results || [],
        count: result.results?.length || 0,
      });
    } catch (error) {
      // Table might not exist - return empty array
      console.log(`[RestaurantWorker] unassigned_images table may not exist for ${targetTenantId}:`, error);
      return jsonResponse({ success: true, images: [], count: 0 });
    }
  }

  if (method === 'POST') {
    const body = await request.json<{
      action: 'assign' | 'delete' | 'create';
      imageId?: string;
      menuItemId?: string;
      cloudflareImageId?: string;
      filename?: string;
      imageUrl?: string;
      cfAccountId?: string;
      cfApiToken?: string;
    }>();

    const { action, imageId, menuItemId, cloudflareImageId, filename, imageUrl, cfAccountId, cfApiToken } = body;

    try {
      if (action === 'create') {
        if (!cloudflareImageId || !imageUrl) {
          return jsonResponse({ error: 'Missing cloudflareImageId or imageUrl for create action' }, 400);
        }

        const id = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO unassigned_images (id, tenant_id, cloudflare_image_id, filename, image_url, uploaded_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`
          )
          .bind(id, targetTenantId, cloudflareImageId, filename || 'uploaded_image', imageUrl)
          .run();

        return jsonResponse({ success: true, id });
      }

      if (action === 'delete') {
        if (!imageId) return jsonResponse({ error: 'Missing imageId for delete action' }, 400);

        // Get image details first for CF deletion
        const image = await db
          .prepare(`SELECT * FROM unassigned_images WHERE id = ? AND tenant_id = ?`)
          .bind(imageId, targetTenantId)
          .first<any>();

        if (image && cfApiToken && image.cloudflare_image_id) {
          try {
            const accId = cfAccountId || env.CLOUDFLARE_ACCOUNT_ID || '0f3287b287060e3215662501ee96292e';
            await fetch(`https://api.cloudflare.com/client/v4/accounts/${accId}/images/v1/${image.cloudflare_image_id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${cfApiToken}` }
            });
          } catch (e) { console.error('Error deleting from CF:', e); }
        }

        await db
          .prepare(`DELETE FROM unassigned_images WHERE id = ? AND tenant_id = ?`)
          .bind(imageId, targetTenantId)
          .run();

        return jsonResponse({ success: true });
      }

      if (action === 'assign') {
        if (!imageId || !menuItemId) {
          return jsonResponse({ error: 'Missing imageId or menuItemId for assign action' }, 400);
        }

        // 1. Get image details
        const image = await db
          .prepare(`SELECT * FROM unassigned_images WHERE id = ? AND tenant_id = ?`)
          .bind(imageId, targetTenantId)
          .first<any>();

        if (!image) return jsonResponse({ error: 'Image not found' }, 404);

        // 2. Update menu item
        await db
          .prepare(
            `UPDATE menu_items
             SET cloudflare_image_id = ?, image_url = ?, photo_url = ?, updated_at = datetime('now')
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(image.cloudflare_image_id, image.image_url, image.image_url, menuItemId, targetTenantId)
          .run();

        // 3. Delete from unassigned
        await db
          .prepare(`DELETE FROM unassigned_images WHERE id = ? AND tenant_id = ?`)
          .bind(imageId, targetTenantId)
          .run();

        await invalidateMenuCache(targetTenantId, env);

        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: 'Invalid action' }, 400);
    } catch (error) {
      console.error(`[RestaurantWorker] Error in unassigned images POST:`, error);
      return jsonResponse({ error: 'Database error', message: String(error) }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

/**
 * Handle Cloudflare Images Upload API
 */
async function handleCFUploadAPI(request: Request, env: RestaurantEnv): Promise<Response> {
  try {
    const method = request.method;
    if (method === 'OPTIONS') return jsonResponse(null, 204);
    if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    // 1. Get Token from Token Manager
    const tokenKey = 'cloudflare:images_token';
    const tokenResponse = await env.TOKEN_MANAGER.fetch(`https://token-manager/api/tokens/${encodeURIComponent(tokenKey)}`, {
      headers: {
        'X-Worker-Name': 'handsfree-restaurant'
      }
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[RestaurantWorker] Failed to fetch token: ${tokenResponse.status} ${errorText}`);
      return jsonResponse({ error: 'Failed to fetch upload token', status: tokenResponse.status, details: errorText }, 500);
    }

    const tokenData = await tokenResponse.json() as any;
    const apiToken = tokenData.data?.value;
    const accountId = env.CLOUDFLARE_ACCOUNT_ID || '0f3287b287060e3215662501ee96292e';

    if (!apiToken) {
      console.error('[RestaurantWorker] Upload token not available');
      return jsonResponse({ error: 'Upload token not available' }, 500);
    }

    console.log(`[RestaurantWorker] Using accountId: ${accountId}, Token obtained.`);

    // 2. Forward the multi-part request to Cloudflare
    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;

    console.log('[RestaurantWorker] Parsing form data from request...');
    let file: any;
    try {
      const formData = await request.formData();
      file = formData.get('file');
      console.log(`[RestaurantWorker] File found in formData: ${file ? 'Yes' : 'No'}`);
    } catch (e) {
      console.error('[RestaurantWorker] Error parsing formData:', e);
      return jsonResponse({ error: 'Failed to parse form data', message: String(e) }, 400);
    }

    if (!file) return jsonResponse({ error: 'No file provided' }, 400);

    const cfFormData = new FormData();
    cfFormData.append('file', file);

    console.log(`[RestaurantWorker] Uploading to Cloudflare: ${uploadUrl}`);
    const cfResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}` },
      body: cfFormData,
    });

    console.log(`[RestaurantWorker] Cloudflare response status: ${cfResponse.status}`);

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      console.error(`[RestaurantWorker] Cloudflare upload failed: ${cfResponse.status} ${errorText}`);
      return jsonResponse({ error: 'Cloudflare upload failed', details: errorText }, cfResponse.status);
    }

    const result = await cfResponse.json() as any;
    console.log('[RestaurantWorker] Cloudflare upload success:', result.result?.id);

    return jsonResponse({
      success: true,
      id: result.result?.id,
      filename: result.result?.filename,
      uploaded: result.result?.uploaded,
      variants: result.result?.variants,
      url: result.result?.variants?.[0],
    });

  } catch (error) {
    console.error('[RestaurantWorker] CF Upload error (catch):', error);
    return jsonResponse({ error: 'Internal server error', message: String(error) }, 500);
  }
}

/**
 * JSON response helper with CORS
 */
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-ID',
    },
  });
}
