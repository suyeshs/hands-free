/**
 * Inventory Handler
 * Manages all inventory-related tables in D1
 */

import { createSyncEngine, type SyncTableConfig } from '../lib/syncEngine';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Sync configuration for inventory_suppliers table
const inventorySuppliersSyncConfig: SyncTableConfig = {
  tableName: 'inventory_suppliers',
  direction: 'bidirectional',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    { source: 'contactName', target: 'contact_name', type: 'TEXT' },
    { source: 'email', target: 'email', type: 'TEXT' },
    { source: 'phone', target: 'phone', type: 'TEXT' },
    { source: 'address', target: 'address', type: 'TEXT' },
    { source: 'gstin', target: 'gstin', type: 'TEXT' },
    { source: 'taxId', target: 'tax_id', type: 'TEXT' },
    { source: 'paymentTerms', target: 'payment_terms', type: 'TEXT' },
    { source: 'currency', target: 'currency', type: 'TEXT' },
    { source: 'bankName', target: 'bank_name', type: 'TEXT' },
    { source: 'bankAccount', target: 'bank_account', type: 'TEXT' },
    { source: 'totalOrders', target: 'total_orders', type: 'INTEGER' },
    { source: 'totalSpent', target: 'total_spent', type: 'REAL' },
    { source: 'notes', target: 'notes', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 50,
  hooks: {
    afterSync: async (result) => {
      console.log(`[InventorySuppliers] Synced ${result.synced}/${result.totalRecords} suppliers in ${result.duration}ms`);
    }
  }
};

// Sync configuration for inventory_items table
const inventoryItemsSyncConfig: SyncTableConfig = {
  tableName: 'inventory_items',
  direction: 'bidirectional',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'name', target: 'name', type: 'TEXT', required: true },
    { source: 'quantity', target: 'quantity', type: 'REAL', required: true },
    { source: 'unit', target: 'unit', type: 'TEXT', required: true },
    { source: 'category', target: 'category', type: 'TEXT' },
    { source: 'supplierId', target: 'supplier_id', type: 'TEXT' },
    { source: 'pricePerUnit', target: 'price_per_unit', type: 'REAL' },
    { source: 'expiryDate', target: 'expiry_date', type: 'TEXT' },
    { source: 'reorderLevel', target: 'reorder_level', type: 'REAL' },
    { source: 'storageLocation', target: 'storage_location', type: 'TEXT' },
    { source: 'notes', target: 'notes', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[InventoryItems] Synced ${result.synced}/${result.totalRecords} items in ${result.duration}ms`);
    }
  }
};

// Sync configuration for inventory_documents table
const inventoryDocumentsSyncConfig: SyncTableConfig = {
  tableName: 'inventory_documents',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'created_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'type', target: 'type', type: 'TEXT', required: true },
    { source: 'originalFilename', target: 'original_filename', type: 'TEXT' },
    { source: 'storageKey', target: 'storage_key', type: 'TEXT' },
    { source: 'mimeType', target: 'mime_type', type: 'TEXT' },
    { source: 'fileSize', target: 'file_size', type: 'INTEGER' },
    { source: 'ocrProvider', target: 'ocr_provider', type: 'TEXT' },
    { source: 'ocrRawText', target: 'ocr_raw_text', type: 'TEXT' },
    { source: 'extractedData', target: 'extracted_data', type: 'TEXT' },
    { source: 'status', target: 'status', type: 'TEXT' },
    { source: 'errorMessage', target: 'error_message', type: 'TEXT' },
    { source: 'processingTimeMs', target: 'processing_time_ms', type: 'INTEGER' },
    { source: 'createdBy', target: 'created_by', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'processedAt', target: 'processed_at', type: 'TEXT' },
  ],
  batchSize: 50,
  hooks: {
    afterSync: async (result) => {
      console.log(`[InventoryDocuments] Synced ${result.synced}/${result.totalRecords} documents in ${result.duration}ms`);
    }
  }
};

// Sync configuration for inventory_transactions table
const inventoryTransactionsSyncConfig: SyncTableConfig = {
  tableName: 'inventory_transactions',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'created_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'itemId', target: 'item_id', type: 'TEXT', required: true },
    { source: 'documentId', target: 'document_id', type: 'TEXT' },
    { source: 'transactionType', target: 'transaction_type', type: 'TEXT', required: true },
    { source: 'quantityChange', target: 'quantity_change', type: 'REAL', required: true },
    { source: 'previousQuantity', target: 'previous_quantity', type: 'REAL' },
    { source: 'newQuantity', target: 'new_quantity', type: 'REAL' },
    { source: 'unit', target: 'unit', type: 'TEXT' },
    { source: 'reason', target: 'reason', type: 'TEXT' },
    { source: 'notes', target: 'notes', type: 'TEXT' },
    { source: 'orderId', target: 'order_id', type: 'TEXT' },
    { source: 'createdBy', target: 'created_by', type: 'TEXT' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[InventoryTransactions] Synced ${result.synced}/${result.totalRecords} transactions in ${result.duration}ms`);
    }
  }
};

// Sync configuration for inventory_recipes table
const inventoryRecipesSyncConfig: SyncTableConfig = {
  tableName: 'inventory_recipes',
  direction: 'bidirectional',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['menu_item_id'],
  timestampColumn: 'updated_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'menuItemId', target: 'menu_item_id', type: 'TEXT', required: true },
    { source: 'menuItemName', target: 'menu_item_name', type: 'TEXT', required: true },
    { source: 'yieldQuantity', target: 'yield_quantity', type: 'REAL' },
    { source: 'yieldUnit', target: 'yield_unit', type: 'TEXT' },
    { source: 'totalCost', target: 'total_cost', type: 'REAL' },
    { source: 'createdAt', target: 'created_at', type: 'TEXT', required: true },
    { source: 'updatedAt', target: 'updated_at', type: 'TEXT', required: true },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[InventoryRecipes] Synced ${result.synced}/${result.totalRecords} recipes in ${result.duration}ms`);
    }
  }
};

// Sync configuration for inventory_recipe_ingredients table
const inventoryRecipeIngredientsSyncConfig: SyncTableConfig = {
  tableName: 'inventory_recipe_ingredients',
  direction: 'bidirectional',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['id'],
  timestampColumn: 'created_at',
  columns: [
    { source: 'id', target: 'id', type: 'TEXT', required: true },
    { source: 'recipeId', target: 'recipe_id', type: 'TEXT', required: true },
    { source: 'inventoryItemId', target: 'inventory_item_id', type: 'TEXT', required: true },
    { source: 'quantity', target: 'quantity', type: 'REAL', required: true },
    { source: 'unit', target: 'unit', type: 'TEXT', required: true },
    { source: 'wastePercentage', target: 'waste_percentage', type: 'REAL' },
  ],
  batchSize: 100,
  hooks: {
    afterSync: async (result) => {
      console.log(`[InventoryRecipeIngredients] Synced ${result.synced}/${result.totalRecords} recipe ingredients in ${result.duration}ms`);
    }
  }
};

/**
 * POST /inventory/suppliers/sync - Sync inventory suppliers from POS to D1 using SyncEngine
 */
export async function handleInventorySuppliersSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { suppliers: any[] };
    const suppliers = body.suppliers || [];

    if (suppliers.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(inventorySuppliersSyncConfig, suppliers);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[InventorySuppliers] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync inventory suppliers',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /inventory/items/sync - Sync inventory items from POS to D1 using SyncEngine
 */
export async function handleInventoryItemsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { items: any[] };
    const items = body.items || [];

    if (items.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(inventoryItemsSyncConfig, items);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[InventoryItems] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync inventory items',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /inventory/documents/sync - Sync inventory documents from POS to D1 using SyncEngine
 */
export async function handleInventoryDocumentsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { documents: any[] };
    const documents = body.documents || [];

    if (documents.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(inventoryDocumentsSyncConfig, documents);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[InventoryDocuments] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync inventory documents',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /inventory/transactions/sync - Sync inventory transactions from POS to D1 using SyncEngine
 */
export async function handleInventoryTransactionsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { transactions: any[] };
    const transactions = body.transactions || [];

    if (transactions.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(inventoryTransactionsSyncConfig, transactions);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[InventoryTransactions] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync inventory transactions',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /inventory/recipes/sync - Sync inventory recipes from POS to D1 using SyncEngine
 */
export async function handleInventoryRecipesSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { recipes: any[] };
    const recipes = body.recipes || [];

    if (recipes.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(inventoryRecipesSyncConfig, recipes);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[InventoryRecipes] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync inventory recipes',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /inventory/recipe-ingredients/sync - Sync recipe ingredients from POS to D1 using SyncEngine
 */
export async function handleInventoryRecipeIngredientsSync(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { recipeIngredients: any[] };
    const recipeIngredients = body.recipeIngredients || [];

    if (recipeIngredients.length === 0) {
      return Response.json({
        success: true,
        synced: 0,
        errors: [],
      }, { headers: CORS_HEADERS });
    }

    const syncEngine = createSyncEngine(env.DB, tenantId);
    const result = await syncEngine.sync(inventoryRecipeIngredientsSyncConfig, recipeIngredients);

    return Response.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.map(e => `${e.recordId || 'unknown'}: ${e.error}`),
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[InventoryRecipeIngredients] Sync error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to sync recipe ingredients',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

// ============================================================================
// INVENTORY CRUD OPERATIONS
// ============================================================================

/**
 * GET /inventory/suppliers - List all suppliers
 */
export async function handleListSuppliers(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;

    const rows = await env.DB
      .prepare(
        search
          ? `SELECT * FROM inventory_suppliers
             WHERE tenant_id = ? AND (name LIKE ? OR contact_name LIKE ? OR email LIKE ?)
             ORDER BY name ASC`
          : `SELECT * FROM inventory_suppliers WHERE tenant_id = ? ORDER BY name ASC`
      )
      .bind(search ? tenantId : tenantId, ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []))
      .all();

    const suppliers = (rows.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      gstin: row.gstin,
      taxId: row.tax_id,
      paymentTerms: row.payment_terms,
      currency: row.currency || 'INR',
      bankName: row.bank_name,
      bankAccount: row.bank_account,
      totalOrders: row.total_orders || 0,
      totalSpent: row.total_spent || 0,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return Response.json({ success: true, suppliers }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] List suppliers error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list suppliers',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /inventory/suppliers - Create a supplier
 */
export async function handleCreateSupplier(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `INSERT INTO inventory_suppliers
         (id, tenant_id, name, contact_name, email, phone, address, gstin, tax_id,
          payment_terms, currency, bank_name, bank_account, notes, created_at, updated_at,
          total_orders, total_spent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
      )
      .bind(
        id,
        tenantId,
        body.name,
        body.contactName || null,
        body.email || null,
        body.phone || null,
        body.address || null,
        body.gstin || null,
        body.taxId || null,
        body.paymentTerms || null,
        body.currency || 'INR',
        body.bankName || null,
        body.bankAccount || null,
        body.notes || null,
        now,
        now
      )
      .run();

    return Response.json({
      success: true,
      supplier: {
        id,
        ...body,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: now,
        updatedAt: now,
      },
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Create supplier error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to create supplier',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /inventory/suppliers/:id - Get a specific supplier
 */
export async function handleGetSupplier(
  request: Request,
  env: Env,
  tenantId: string,
  supplierId: string
): Promise<Response> {
  try {
    const row = await env.DB
      .prepare('SELECT * FROM inventory_suppliers WHERE id = ? AND tenant_id = ?')
      .bind(supplierId, tenantId)
      .first();

    if (!row) {
      return Response.json({
        success: false,
        error: 'Supplier not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    const supplier = {
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      gstin: row.gstin,
      taxId: row.tax_id,
      paymentTerms: row.payment_terms,
      currency: row.currency || 'INR',
      bankName: row.bank_name,
      bankAccount: row.bank_account,
      totalOrders: row.total_orders || 0,
      totalSpent: row.total_spent || 0,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return Response.json({ success: true, supplier }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Get supplier error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get supplier',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PUT /inventory/suppliers/:id - Update a supplier
 */
export async function handleUpdateSupplier(
  request: Request,
  env: Env,
  tenantId: string,
  supplierId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const now = new Date().toISOString();

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    const fieldMap: Record<string, string> = {
      name: 'name',
      contactName: 'contact_name',
      email: 'email',
      phone: 'phone',
      address: 'address',
      gstin: 'gstin',
      taxId: 'tax_id',
      paymentTerms: 'payment_terms',
      currency: 'currency',
      bankName: 'bank_name',
      bankAccount: 'bank_account',
      notes: 'notes',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${column} = ?`);
        params.push(body[key]);
      }
    }

    params.push(supplierId, tenantId);

    await env.DB
      .prepare(
        `UPDATE inventory_suppliers SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
      )
      .bind(...params)
      .run();

    return Response.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Update supplier error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to update supplier',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * DELETE /inventory/suppliers/:id - Delete a supplier
 */
export async function handleDeleteSupplier(
  request: Request,
  env: Env,
  tenantId: string,
  supplierId: string
): Promise<Response> {
  try {
    await env.DB
      .prepare('DELETE FROM inventory_suppliers WHERE id = ? AND tenant_id = ?')
      .bind(supplierId, tenantId)
      .run();

    return Response.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Delete supplier error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to delete supplier',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /inventory/items - List all inventory items
 */
export async function handleListInventoryItems(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || undefined;
    const supplierId = url.searchParams.get('supplierId') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const lowStock = url.searchParams.get('lowStock') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let whereClause = 'WHERE tenant_id = ?';
    const params: any[] = [tenantId];

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (supplierId) {
      whereClause += ' AND supplier_id = ?';
      params.push(supplierId);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (lowStock) {
      whereClause += ' AND reorder_level IS NOT NULL AND quantity <= reorder_level';
    }

    // Get total count
    const countResult = await env.DB
      .prepare(`SELECT COUNT(*) as count FROM inventory_items ${whereClause}`)
      .bind(...params)
      .first();

    const total = countResult?.count || 0;

    // Get items
    const rows = await env.DB
      .prepare(
        `SELECT * FROM inventory_items ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset)
      .all();

    const items = (rows.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      category: row.category,
      supplierId: row.supplier_id,
      pricePerUnit: row.price_per_unit,
      expiryDate: row.expiry_date,
      reorderLevel: row.reorder_level,
      storageLocation: row.storage_location,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return Response.json({ success: true, items, total }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] List items error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list inventory items',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /inventory/items - Create an inventory item
 */
export async function handleCreateInventoryItem(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        `INSERT INTO inventory_items
         (id, tenant_id, name, quantity, unit, category, supplier_id, price_per_unit,
          expiry_date, reorder_level, storage_location, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        body.name,
        body.quantity || 0,
        body.unit,
        body.category || null,
        body.supplierId || null,
        body.pricePerUnit || null,
        body.expiryDate || null,
        body.reorderLevel || null,
        body.storageLocation || null,
        body.notes || null,
        now,
        now
      )
      .run();

    return Response.json({
      success: true,
      item: {
        id,
        ...body,
        createdAt: now,
        updatedAt: now,
      },
    }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Create item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to create inventory item',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /inventory/items/:id - Get a specific inventory item
 */
export async function handleGetInventoryItem(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    const row = await env.DB
      .prepare('SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?')
      .bind(itemId, tenantId)
      .first();

    if (!row) {
      return Response.json({
        success: false,
        error: 'Item not found',
      }, { status: 404, headers: CORS_HEADERS });
    }

    const item = {
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      category: row.category,
      supplierId: row.supplier_id,
      pricePerUnit: row.price_per_unit,
      expiryDate: row.expiry_date,
      reorderLevel: row.reorder_level,
      storageLocation: row.storage_location,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return Response.json({ success: true, item }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Get item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get inventory item',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PUT /inventory/items/:id - Update an inventory item
 */
export async function handleUpdateInventoryItem(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const now = new Date().toISOString();

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    const fieldMap: Record<string, string> = {
      name: 'name',
      quantity: 'quantity',
      unit: 'unit',
      category: 'category',
      supplierId: 'supplier_id',
      pricePerUnit: 'price_per_unit',
      expiryDate: 'expiry_date',
      reorderLevel: 'reorder_level',
      storageLocation: 'storage_location',
      notes: 'notes',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${column} = ?`);
        params.push(body[key]);
      }
    }

    params.push(itemId, tenantId);

    await env.DB
      .prepare(
        `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
      )
      .bind(...params)
      .run();

    return Response.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Update item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to update inventory item',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * DELETE /inventory/items/:id - Delete an inventory item
 */
export async function handleDeleteInventoryItem(
  request: Request,
  env: Env,
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    await env.DB
      .prepare('DELETE FROM inventory_items WHERE id = ? AND tenant_id = ?')
      .bind(itemId, tenantId)
      .run();

    return Response.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Inventory] Delete item error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to delete inventory item',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
