/**
 * Inventory Manager
 *
 * Handles inventory operations using tenant D1 database.
 * Provides CRUD for inventory items, suppliers, documents, transactions, and recipes.
 */

import { getTenantDatabase, type RestaurantEnv } from './tenant-db-resolver';

// ============================================================================
// Types
// ============================================================================

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  quantity: number;
  unit: string;
  category: InventoryCategory | null;
  supplierId: string | null;
  pricePerUnit: number | null;
  expiryDate: string | null;
  reorderLevel: number | null;
  storageLocation: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InventoryCategory =
  | 'produce'
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'dry_goods'
  | 'beverages'
  | 'supplies'
  | 'other';

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  taxId: string | null;
  paymentTerms: string | null;
  currency: string;
  bankName: string | null;
  bankAccount: string | null;
  totalOrders: number;
  totalSpent: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDocument {
  id: string;
  tenantId: string;
  type: 'invoice' | 'bill' | 'receipt' | 'handwritten_note' | 'camera_capture';
  originalFilename: string | null;
  storageKey: string | null;
  mimeType: string | null;
  fileSize: number | null;
  ocrProvider: string | null;
  ocrRawText: string | null;
  extractedData: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  processingTimeMs: number | null;
  createdBy: string | null;
  createdAt: string;
  processedAt: string | null;
  // Invoice-specific fields
  invoiceNumber: string | null;
  invoiceDate: string | null;
  supplierId: string | null;
}

export interface InventoryTransaction {
  id: string;
  tenantId: string;
  itemId: string;
  documentId: string | null;
  transactionType: 'add' | 'remove' | 'adjust' | 'set' | 'waste' | 'transfer' | 'order_deduction';
  quantityChange: number;
  previousQuantity: number | null;
  newQuantity: number | null;
  unit: string | null;
  reason: string | null;
  notes: string | null;
  orderId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Recipe {
  id: string;
  tenantId: string;
  menuItemId: string;
  menuItemName: string;
  yieldQuantity: number;
  yieldUnit: string;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  id: string;
  tenantId: string;
  recipeId: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  wastePercentage: number;
  inventoryItem?: InventoryItem;
}

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  expiringSoonCount: number;
  categoryBreakdown: Record<string, { count: number; value: number }>;
}

export interface LowStockAlert {
  itemId: string;
  itemName: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  deficit: number;
}

export interface ExpiryAlert {
  itemId: string;
  itemName: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantity: number;
  unit: string;
}

// ============================================================================
// Inventory Items
// ============================================================================

export async function createInventoryItem(
  tenantId: string,
  input: Omit<InventoryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  env: RestaurantEnv
): Promise<InventoryItem> {
  const db = getTenantDatabase(tenantId, env);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO inventory_items
       (id, tenant_id, name, quantity, unit, category, supplier_id, price_per_unit,
        expiry_date, reorder_level, storage_location, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      tenantId,
      input.name,
      input.quantity,
      input.unit,
      input.category,
      input.supplierId,
      input.pricePerUnit,
      input.expiryDate,
      input.reorderLevel,
      input.storageLocation,
      input.notes,
      now,
      now
    )
    .run();

  return getInventoryItem(id, tenantId, env) as Promise<InventoryItem>;
}

export async function getInventoryItem(
  id: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<InventoryItem | null> {
  const db = getTenantDatabase(tenantId, env);
  const row = await db
    .prepare('SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<any>();

  if (!row) return null;

  return mapInventoryItem(row);
}

export async function listInventoryItems(
  tenantId: string,
  filters: {
    category?: InventoryCategory;
    supplierId?: string;
    search?: string;
    lowStock?: boolean;
    expiringSoon?: boolean;
    limit?: number;
    offset?: number;
  },
  env: RestaurantEnv
): Promise<{ items: InventoryItem[]; total: number }> {
  const db = getTenantDatabase(tenantId, env);

  let whereClause = 'WHERE tenant_id = ?';
  const params: any[] = [tenantId];

  if (filters.category) {
    whereClause += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.supplierId) {
    whereClause += ' AND supplier_id = ?';
    params.push(filters.supplierId);
  }

  if (filters.search) {
    whereClause += ' AND (name LIKE ? OR notes LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.lowStock) {
    whereClause += ' AND reorder_level IS NOT NULL AND quantity <= reorder_level';
  }

  if (filters.expiringSoon) {
    whereClause += " AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days')";
  }

  // Count total
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM inventory_items ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();
  const total = countResult?.count || 0;

  // Get items
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const rows = await db
    .prepare(
      `SELECT * FROM inventory_items ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all<any>();

  const items = (rows.results || []).map(mapInventoryItem);

  return { items, total };
}

export async function updateInventoryItem(
  id: string,
  tenantId: string,
  input: Partial<Omit<InventoryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  env: RestaurantEnv
): Promise<InventoryItem | null> {
  const db = getTenantDatabase(tenantId, env);
  const now = new Date().toISOString();

  const updates: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.quantity !== undefined) {
    updates.push('quantity = ?');
    params.push(input.quantity);
  }
  if (input.unit !== undefined) {
    updates.push('unit = ?');
    params.push(input.unit);
  }
  if (input.category !== undefined) {
    updates.push('category = ?');
    params.push(input.category);
  }
  if (input.supplierId !== undefined) {
    updates.push('supplier_id = ?');
    params.push(input.supplierId);
  }
  if (input.pricePerUnit !== undefined) {
    updates.push('price_per_unit = ?');
    params.push(input.pricePerUnit);
  }
  if (input.expiryDate !== undefined) {
    updates.push('expiry_date = ?');
    params.push(input.expiryDate);
  }
  if (input.reorderLevel !== undefined) {
    updates.push('reorder_level = ?');
    params.push(input.reorderLevel);
  }
  if (input.storageLocation !== undefined) {
    updates.push('storage_location = ?');
    params.push(input.storageLocation);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    params.push(input.notes);
  }

  params.push(id, tenantId);

  await db
    .prepare(
      `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    )
    .bind(...params)
    .run();

  return getInventoryItem(id, tenantId, env);
}

export async function deleteInventoryItem(
  id: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<void> {
  const db = getTenantDatabase(tenantId, env);
  await db
    .prepare('DELETE FROM inventory_items WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .run();
}

// ============================================================================
// Inventory Summary & Alerts
// ============================================================================

export async function getInventorySummary(
  tenantId: string,
  env: RestaurantEnv
): Promise<InventorySummary> {
  const db = getTenantDatabase(tenantId, env);

  // Get total items and value
  const totals = await db
    .prepare(
      `SELECT
         COUNT(*) as total_items,
         COALESCE(SUM(quantity * COALESCE(price_per_unit, 0)), 0) as total_value
       FROM inventory_items WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ total_items: number; total_value: number }>();

  // Get low stock count
  const lowStock = await db
    .prepare(
      `SELECT COUNT(*) as count FROM inventory_items
       WHERE tenant_id = ? AND reorder_level IS NOT NULL AND quantity <= reorder_level`
    )
    .bind(tenantId)
    .first<{ count: number }>();

  // Get expiring soon count
  const expiring = await db
    .prepare(
      `SELECT COUNT(*) as count FROM inventory_items
       WHERE tenant_id = ? AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days')`
    )
    .bind(tenantId)
    .first<{ count: number }>();

  // Get category breakdown
  const categories = await db
    .prepare(
      `SELECT
         COALESCE(category, 'other') as category,
         COUNT(*) as count,
         COALESCE(SUM(quantity * COALESCE(price_per_unit, 0)), 0) as value
       FROM inventory_items WHERE tenant_id = ?
       GROUP BY category`
    )
    .bind(tenantId)
    .all<{ category: string; count: number; value: number }>();

  const categoryBreakdown: Record<string, { count: number; value: number }> = {};
  for (const cat of categories.results || []) {
    categoryBreakdown[cat.category] = { count: cat.count, value: cat.value };
  }

  return {
    totalItems: totals?.total_items || 0,
    totalValue: totals?.total_value || 0,
    lowStockCount: lowStock?.count || 0,
    expiringSoonCount: expiring?.count || 0,
    categoryBreakdown,
  };
}

export async function getLowStockAlerts(
  tenantId: string,
  env: RestaurantEnv
): Promise<LowStockAlert[]> {
  const db = getTenantDatabase(tenantId, env);

  const rows = await db
    .prepare(
      `SELECT id, name, quantity, unit, reorder_level
       FROM inventory_items
       WHERE tenant_id = ? AND reorder_level IS NOT NULL AND quantity <= reorder_level
       ORDER BY (reorder_level - quantity) DESC`
    )
    .bind(tenantId)
    .all<any>();

  return (rows.results || []).map((row) => ({
    itemId: row.id,
    itemName: row.name,
    currentStock: row.quantity,
    reorderLevel: row.reorder_level,
    unit: row.unit,
    deficit: row.reorder_level - row.quantity,
  }));
}

export async function getExpiryAlerts(
  tenantId: string,
  daysAhead: number = 7,
  env: RestaurantEnv
): Promise<ExpiryAlert[]> {
  const db = getTenantDatabase(tenantId, env);

  const rows = await db
    .prepare(
      `SELECT id, name, quantity, unit, expiry_date,
              julianday(expiry_date) - julianday('now') as days_until
       FROM inventory_items
       WHERE tenant_id = ? AND expiry_date IS NOT NULL
         AND expiry_date <= date('now', '+' || ? || ' days')
       ORDER BY expiry_date ASC`
    )
    .bind(tenantId, daysAhead)
    .all<any>();

  return (rows.results || []).map((row) => ({
    itemId: row.id,
    itemName: row.name,
    expiryDate: row.expiry_date,
    daysUntilExpiry: Math.floor(row.days_until),
    quantity: row.quantity,
    unit: row.unit,
  }));
}

// ============================================================================
// Suppliers
// ============================================================================

export async function createSupplier(
  tenantId: string,
  input: Omit<Supplier, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'totalOrders' | 'totalSpent'>,
  env: RestaurantEnv
): Promise<Supplier> {
  const db = getTenantDatabase(tenantId, env);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO inventory_suppliers
       (id, tenant_id, name, contact_name, email, phone, address, gstin, tax_id,
        payment_terms, currency, bank_name, bank_account, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      tenantId,
      input.name,
      input.contactName,
      input.email,
      input.phone,
      input.address,
      input.gstin,
      input.taxId,
      input.paymentTerms,
      input.currency || 'INR',
      input.bankName,
      input.bankAccount,
      input.notes,
      now,
      now
    )
    .run();

  return getSupplier(id, tenantId, env) as Promise<Supplier>;
}

export async function getSupplier(
  id: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<Supplier | null> {
  const db = getTenantDatabase(tenantId, env);
  const row = await db
    .prepare('SELECT * FROM inventory_suppliers WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<any>();

  if (!row) return null;

  return mapSupplier(row);
}

export async function listSuppliers(
  tenantId: string,
  search?: string,
  env?: RestaurantEnv
): Promise<Supplier[]> {
  if (!env) throw new Error('Environment required');
  const db = getTenantDatabase(tenantId, env);

  let query = 'SELECT * FROM inventory_suppliers WHERE tenant_id = ?';
  const params: any[] = [tenantId];

  if (search) {
    query += ' AND (name LIKE ? OR contact_name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY name ASC';

  const rows = await db.prepare(query).bind(...params).all<any>();

  return (rows.results || []).map(mapSupplier);
}

export async function updateSupplier(
  id: string,
  tenantId: string,
  input: Partial<Omit<Supplier, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  env: RestaurantEnv
): Promise<Supplier | null> {
  const db = getTenantDatabase(tenantId, env);
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
    totalOrders: 'total_orders',
    totalSpent: 'total_spent',
    notes: 'notes',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined) {
      updates.push(`${column} = ?`);
      params.push((input as any)[key]);
    }
  }

  params.push(id, tenantId);

  await db
    .prepare(
      `UPDATE inventory_suppliers SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    )
    .bind(...params)
    .run();

  return getSupplier(id, tenantId, env);
}

export async function deleteSupplier(
  id: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<void> {
  const db = getTenantDatabase(tenantId, env);
  await db
    .prepare('DELETE FROM inventory_suppliers WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .run();
}

// ============================================================================
// Inventory Documents (Invoices, Bills, etc.)
// ============================================================================

export async function createDocument(
  tenantId: string,
  input: {
    type: InventoryDocument['type'];
    invoiceNumber?: string;
    invoiceDate?: string;
    supplierId?: string;
    originalFilename?: string;
    ocrProvider?: string;
    extractedData?: any;
    processingTimeMs?: number;
    createdBy?: string;
  },
  env: RestaurantEnv
): Promise<InventoryDocument> {
  const db = getTenantDatabase(tenantId, env);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO inventory_documents
       (id, tenant_id, type, invoice_number, invoice_date, supplier_id,
        original_filename, ocr_provider, extracted_data, status,
        processing_time_ms, created_by, created_at, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`
    )
    .bind(
      id,
      tenantId,
      input.type,
      input.invoiceNumber || null,
      input.invoiceDate || null,
      input.supplierId || null,
      input.originalFilename || null,
      input.ocrProvider || null,
      input.extractedData ? JSON.stringify(input.extractedData) : null,
      input.processingTimeMs || null,
      input.createdBy || null,
      now,
      now
    )
    .run();

  return getDocument(id, tenantId, env) as Promise<InventoryDocument>;
}

export async function getDocument(
  id: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<InventoryDocument | null> {
  const db = getTenantDatabase(tenantId, env);
  const row = await db
    .prepare('SELECT * FROM inventory_documents WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<any>();

  if (!row) return null;

  return mapDocument(row);
}

export async function listDocuments(
  tenantId: string,
  filters: {
    type?: InventoryDocument['type'];
    supplierId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  },
  env: RestaurantEnv
): Promise<{ documents: InventoryDocument[]; total: number }> {
  const db = getTenantDatabase(tenantId, env);

  let whereClause = 'WHERE tenant_id = ?';
  const params: any[] = [tenantId];

  if (filters.type) {
    whereClause += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters.supplierId) {
    whereClause += ' AND supplier_id = ?';
    params.push(filters.supplierId);
  }

  if (filters.startDate) {
    whereClause += ' AND (invoice_date >= ? OR created_at >= ?)';
    params.push(filters.startDate, filters.startDate);
  }

  if (filters.endDate) {
    whereClause += ' AND (invoice_date <= ? OR created_at <= ?)';
    params.push(filters.endDate, filters.endDate);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM inventory_documents ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const rows = await db
    .prepare(
      `SELECT * FROM inventory_documents ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all<any>();

  const documents = (rows.results || []).map(mapDocument);

  return { documents, total: countResult?.count || 0 };
}

function mapDocument(row: any): InventoryDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    originalFilename: row.original_filename,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    ocrProvider: row.ocr_provider,
    ocrRawText: row.ocr_raw_text,
    extractedData: row.extracted_data ? JSON.parse(row.extracted_data) : null,
    status: row.status,
    errorMessage: row.error_message,
    processingTimeMs: row.processing_time_ms,
    createdBy: row.created_by,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    supplierId: row.supplier_id,
  };
}

// ============================================================================
// Inventory Transactions
// ============================================================================

export async function createTransaction(
  tenantId: string,
  input: {
    itemId: string;
    transactionType: InventoryTransaction['transactionType'];
    quantityChange: number;
    documentId?: string;
    reason?: string;
    notes?: string;
    orderId?: string;
    createdBy?: string;
  },
  env: RestaurantEnv
): Promise<InventoryTransaction> {
  const db = getTenantDatabase(tenantId, env);

  // Get current quantity
  const item = await getInventoryItem(input.itemId, tenantId, env);
  if (!item) throw new Error('Item not found');

  const previousQuantity = item.quantity;
  let newQuantity: number;

  switch (input.transactionType) {
    case 'set':
      newQuantity = input.quantityChange;
      break;
    case 'add':
      newQuantity = previousQuantity + input.quantityChange;
      break;
    case 'remove':
    case 'waste':
    case 'order_deduction':
      newQuantity = previousQuantity - Math.abs(input.quantityChange);
      break;
    case 'adjust':
    case 'transfer':
    default:
      newQuantity = previousQuantity + input.quantityChange;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create transaction record
  await db
    .prepare(
      `INSERT INTO inventory_transactions
       (id, tenant_id, item_id, document_id, transaction_type, quantity_change,
        previous_quantity, new_quantity, unit, reason, notes, order_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      tenantId,
      input.itemId,
      input.documentId || null,
      input.transactionType,
      input.quantityChange,
      previousQuantity,
      newQuantity,
      item.unit,
      input.reason || null,
      input.notes || null,
      input.orderId || null,
      input.createdBy || null,
      now
    )
    .run();

  // Update item quantity
  await db
    .prepare(
      'UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
    )
    .bind(newQuantity, now, input.itemId, tenantId)
    .run();

  return {
    id,
    tenantId,
    itemId: input.itemId,
    documentId: input.documentId || null,
    transactionType: input.transactionType,
    quantityChange: input.quantityChange,
    previousQuantity,
    newQuantity,
    unit: item.unit,
    reason: input.reason || null,
    notes: input.notes || null,
    orderId: input.orderId || null,
    createdBy: input.createdBy || null,
    createdAt: now,
  };
}

export async function listTransactions(
  tenantId: string,
  filters: {
    itemId?: string;
    documentId?: string;
    transactionType?: InventoryTransaction['transactionType'];
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  },
  env: RestaurantEnv
): Promise<{ transactions: InventoryTransaction[]; total: number }> {
  const db = getTenantDatabase(tenantId, env);

  let whereClause = 'WHERE tenant_id = ?';
  const params: any[] = [tenantId];

  if (filters.itemId) {
    whereClause += ' AND item_id = ?';
    params.push(filters.itemId);
  }
  if (filters.documentId) {
    whereClause += ' AND document_id = ?';
    params.push(filters.documentId);
  }
  if (filters.transactionType) {
    whereClause += ' AND transaction_type = ?';
    params.push(filters.transactionType);
  }
  if (filters.startDate) {
    whereClause += ' AND created_at >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    whereClause += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM inventory_transactions ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const rows = await db
    .prepare(
      `SELECT * FROM inventory_transactions ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all<any>();

  const transactions = (rows.results || []).map(mapTransaction);

  return { transactions, total: countResult?.count || 0 };
}

// ============================================================================
// Recipes
// ============================================================================

export async function createRecipe(
  tenantId: string,
  input: {
    menuItemId: string;
    menuItemName: string;
    yieldQuantity?: number;
    yieldUnit?: string;
    ingredients: Array<{
      inventoryItemId: string;
      quantity: number;
      unit: string;
      wastePercentage?: number;
    }>;
  },
  env: RestaurantEnv
): Promise<Recipe> {
  const db = getTenantDatabase(tenantId, env);
  const recipeId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create recipe
  await db
    .prepare(
      `INSERT INTO inventory_recipes
       (id, tenant_id, menu_item_id, menu_item_name, yield_quantity, yield_unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      recipeId,
      tenantId,
      input.menuItemId,
      input.menuItemName,
      input.yieldQuantity || 1,
      input.yieldUnit || 'serving',
      now,
      now
    )
    .run();

  // Add ingredients
  for (const ing of input.ingredients) {
    const ingId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO inventory_recipe_ingredients
         (id, tenant_id, recipe_id, inventory_item_id, quantity, unit, waste_percentage)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        ingId,
        tenantId,
        recipeId,
        ing.inventoryItemId,
        ing.quantity,
        ing.unit,
        ing.wastePercentage || 0
      )
      .run();
  }

  // Calculate and update total cost
  await updateRecipeCost(recipeId, tenantId, env);

  return getRecipe(recipeId, tenantId, env) as Promise<Recipe>;
}

export async function getRecipe(
  id: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<Recipe | null> {
  const db = getTenantDatabase(tenantId, env);

  const row = await db
    .prepare('SELECT * FROM inventory_recipes WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<any>();

  if (!row) return null;

  const recipe = mapRecipe(row);

  // Get ingredients
  const ingredients = await db
    .prepare(
      `SELECT ri.*, ii.name as item_name, ii.price_per_unit
       FROM inventory_recipe_ingredients ri
       LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id
       WHERE ri.recipe_id = ? AND ri.tenant_id = ?`
    )
    .bind(id, tenantId)
    .all<any>();

  recipe.ingredients = (ingredients.results || []).map((ing) => ({
    id: ing.id,
    tenantId: ing.tenant_id,
    recipeId: ing.recipe_id,
    inventoryItemId: ing.inventory_item_id,
    quantity: ing.quantity,
    unit: ing.unit,
    wastePercentage: ing.waste_percentage || 0,
  }));

  return recipe;
}

export async function getRecipeByMenuItem(
  menuItemId: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<Recipe | null> {
  const db = getTenantDatabase(tenantId, env);

  const row = await db
    .prepare('SELECT * FROM inventory_recipes WHERE menu_item_id = ? AND tenant_id = ?')
    .bind(menuItemId, tenantId)
    .first<any>();

  if (!row) return null;

  return getRecipe(row.id, tenantId, env);
}

export async function listRecipes(
  tenantId: string,
  env: RestaurantEnv
): Promise<Recipe[]> {
  const db = getTenantDatabase(tenantId, env);

  const rows = await db
    .prepare('SELECT * FROM inventory_recipes WHERE tenant_id = ? ORDER BY menu_item_name ASC')
    .bind(tenantId)
    .all<any>();

  return (rows.results || []).map(mapRecipe);
}

export async function updateRecipe(
  id: string,
  tenantId: string,
  input: {
    menuItemName?: string;
    yieldQuantity?: number;
    yieldUnit?: string;
    ingredients?: Array<{
      inventoryItemId: string;
      quantity: number;
      unit: string;
      wastePercentage?: number;
    }>;
  },
  env: RestaurantEnv
): Promise<Recipe | null> {
  const db = getTenantDatabase(tenantId, env);
  const now = new Date().toISOString();

  const updates: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (input.menuItemName !== undefined) {
    updates.push('menu_item_name = ?');
    params.push(input.menuItemName);
  }
  if (input.yieldQuantity !== undefined) {
    updates.push('yield_quantity = ?');
    params.push(input.yieldQuantity);
  }
  if (input.yieldUnit !== undefined) {
    updates.push('yield_unit = ?');
    params.push(input.yieldUnit);
  }

  params.push(id, tenantId);

  await db
    .prepare(
      `UPDATE inventory_recipes SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    )
    .bind(...params)
    .run();

  // Replace ingredients if provided
  if (input.ingredients) {
    await db
      .prepare('DELETE FROM inventory_recipe_ingredients WHERE recipe_id = ? AND tenant_id = ?')
      .bind(id, tenantId)
      .run();

    for (const ing of input.ingredients) {
      const ingId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO inventory_recipe_ingredients
           (id, tenant_id, recipe_id, inventory_item_id, quantity, unit, waste_percentage)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          ingId,
          tenantId,
          id,
          ing.inventoryItemId,
          ing.quantity,
          ing.unit,
          ing.wastePercentage || 0
        )
        .run();
    }

    await updateRecipeCost(id, tenantId, env);
  }

  return getRecipe(id, tenantId, env);
}

export async function deleteRecipe(
  id: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<void> {
  const db = getTenantDatabase(tenantId, env);
  await db
    .prepare('DELETE FROM inventory_recipes WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .run();
}

async function updateRecipeCost(
  recipeId: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<void> {
  const db = getTenantDatabase(tenantId, env);

  const costResult = await db
    .prepare(
      `SELECT SUM(ri.quantity * COALESCE(ii.price_per_unit, 0) * (1 + ri.waste_percentage / 100)) as total_cost
       FROM inventory_recipe_ingredients ri
       LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id
       WHERE ri.recipe_id = ? AND ri.tenant_id = ?`
    )
    .bind(recipeId, tenantId)
    .first<{ total_cost: number }>();

  await db
    .prepare(
      'UPDATE inventory_recipes SET total_cost = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
    )
    .bind(costResult?.total_cost || 0, new Date().toISOString(), recipeId, tenantId)
    .run();
}

export async function getRecipeCost(
  menuItemId: string,
  tenantId: string,
  env: RestaurantEnv
): Promise<{ totalCost: number; ingredients: any[] } | null> {
  const recipe = await getRecipeByMenuItem(menuItemId, tenantId, env);
  if (!recipe) return null;

  const db = getTenantDatabase(tenantId, env);

  const ingredients = await db
    .prepare(
      `SELECT ri.*, ii.name as item_name, ii.price_per_unit,
              (ri.quantity * COALESCE(ii.price_per_unit, 0) * (1 + ri.waste_percentage / 100)) as ingredient_cost
       FROM inventory_recipe_ingredients ri
       LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id
       WHERE ri.recipe_id = ? AND ri.tenant_id = ?`
    )
    .bind(recipe.id, tenantId)
    .all<any>();

  return {
    totalCost: recipe.totalCost,
    ingredients: (ingredients.results || []).map((ing) => ({
      itemId: ing.inventory_item_id,
      itemName: ing.item_name,
      quantity: ing.quantity,
      unit: ing.unit,
      pricePerUnit: ing.price_per_unit,
      wastePercentage: ing.waste_percentage,
      cost: ing.ingredient_cost,
    })),
  };
}

// ============================================================================
// Order Deduction
// ============================================================================

export async function deductInventoryForOrder(
  tenantId: string,
  orderId: string,
  items: Array<{ menuItemId: string; quantity: number }>,
  env: RestaurantEnv
): Promise<{ deducted: number; skipped: number; errors: string[] }> {
  let deducted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const orderItem of items) {
    const recipe = await getRecipeByMenuItem(orderItem.menuItemId, tenantId, env);

    if (!recipe || !recipe.ingredients) {
      skipped++;
      continue;
    }

    for (const ingredient of recipe.ingredients) {
      const requiredQty = ingredient.quantity * orderItem.quantity * (1 + ingredient.wastePercentage / 100);

      try {
        await createTransaction(
          tenantId,
          {
            itemId: ingredient.inventoryItemId,
            transactionType: 'order_deduction',
            quantityChange: requiredQty,
            orderId,
            reason: `Order ${orderId}`,
            notes: `Deducted for menu item: ${recipe.menuItemName}`,
          },
          env
        );
        deducted++;
      } catch (err) {
        errors.push(`Failed to deduct ${ingredient.inventoryItemId}: ${err}`);
      }
    }
  }

  return { deducted, skipped, errors };
}

// ============================================================================
// Mappers
// ============================================================================

function mapInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
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
}

function mapSupplier(row: any): Supplier {
  return {
    id: row.id,
    tenantId: row.tenant_id,
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
}

function mapTransaction(row: any): InventoryTransaction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    itemId: row.item_id,
    documentId: row.document_id,
    transactionType: row.transaction_type,
    quantityChange: row.quantity_change,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    unit: row.unit,
    reason: row.reason,
    notes: row.notes,
    orderId: row.order_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapRecipe(row: any): Recipe {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    menuItemId: row.menu_item_id,
    menuItemName: row.menu_item_name,
    yieldQuantity: row.yield_quantity || 1,
    yieldUnit: row.yield_unit || 'serving',
    totalCost: row.total_cost || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
