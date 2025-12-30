/**
 * Local Inventory Service
 * Handles SQLite operations for inventory management
 * Works offline with local database, syncs with cloud when available
 */

import Database from '@tauri-apps/plugin-sql';
import {
  InventoryItem,
  InventoryItemRow,
  Supplier,
  SupplierRow,
  InventoryDocument,
  InventoryDocumentRow,
  InventoryTransaction,
  InventoryTransactionRow,
  RecipeIngredient,
  RecipeIngredientRow,
  CreateInventoryItemInput,
  CreateSupplierInput,
  UpdateInventoryItemInput,
  StockAdjustmentInput,
  ExtractedDocumentData,
  InventorySummary,
  LowStockAlert,
  ExpiryAlert,
  InventoryCategory,
  TransactionType,
  OcrStatus,
  DocumentType,
} from '../types/inventory';

class InventoryService {
  private db: Database | null = null;
  private dbPromise: Promise<Database> | null = null;

  private async getDb(): Promise<Database> {
    if (this.db) return this.db;

    if (!this.dbPromise) {
      this.dbPromise = Database.load('sqlite:pos.db').then((db) => {
        this.db = db;
        return db;
      });
    }

    return this.dbPromise;
  }

  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  private getNow(): string {
    return new Date().toISOString();
  }

  // ==================== SUPPLIERS ====================

  async getSuppliers(tenantId: string, search?: string): Promise<Supplier[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM suppliers WHERE tenant_id = $1';
    const params: (string | number)[] = [tenantId];

    if (search) {
      query += ' AND (name LIKE $2 OR contact_name LIKE $2 OR phone LIKE $2)';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name ASC';

    const rows = await db.select<SupplierRow[]>(query, params);
    return rows.map(this.rowToSupplier);
  }

  async getSupplier(supplierId: string, tenantId: string): Promise<Supplier | null> {
    const db = await this.getDb();
    const rows = await db.select<SupplierRow[]>(
      'SELECT * FROM suppliers WHERE id = $1 AND tenant_id = $2',
      [supplierId, tenantId]
    );
    return rows.length > 0 ? this.rowToSupplier(rows[0]) : null;
  }

  async createSupplier(input: CreateSupplierInput, tenantId: string): Promise<Supplier> {
    const db = await this.getDb();
    const now = this.getNow();
    const id = this.generateId('sup');

    await db.execute(
      `INSERT INTO suppliers (id, tenant_id, name, contact_name, phone, email, address, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        tenantId,
        input.name,
        input.contactName || null,
        input.phone || null,
        input.email || null,
        input.address || null,
        input.notes || null,
        now,
        now,
      ]
    );

    return {
      id,
      tenantId,
      name: input.name,
      contactName: input.contactName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateSupplier(
    supplierId: string,
    updates: Partial<CreateSupplierInput>,
    tenantId: string
  ): Promise<Supplier | null> {
    const db = await this.getDb();
    const now = this.getNow();

    const setClauses: string[] = ['updated_at = $1'];
    const params: (string | number | null)[] = [now];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.contactName !== undefined) {
      setClauses.push(`contact_name = $${paramIndex++}`);
      params.push(updates.contactName || null);
    }
    if (updates.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      params.push(updates.phone || null);
    }
    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      params.push(updates.email || null);
    }
    if (updates.address !== undefined) {
      setClauses.push(`address = $${paramIndex++}`);
      params.push(updates.address || null);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(updates.notes || null);
    }

    params.push(supplierId, tenantId);

    await db.execute(
      `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}`,
      params
    );

    return this.getSupplier(supplierId, tenantId);
  }

  async deleteSupplier(supplierId: string, tenantId: string): Promise<boolean> {
    const db = await this.getDb();

    // Check if supplier has items
    const items = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM inventory_items WHERE supplier_id = $1 AND tenant_id = $2',
      [supplierId, tenantId]
    );

    if (items[0].count > 0) {
      throw new Error('Cannot delete supplier with existing inventory items');
    }

    await db.execute(
      'DELETE FROM suppliers WHERE id = $1 AND tenant_id = $2',
      [supplierId, tenantId]
    );

    return true;
  }

  // ==================== INVENTORY ITEMS ====================

  async getInventoryItems(
    tenantId: string,
    options?: {
      category?: InventoryCategory;
      supplierId?: string;
      lowStock?: boolean;
      expiringSoon?: boolean;
      search?: string;
    }
  ): Promise<InventoryItem[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM inventory_items WHERE tenant_id = $1';
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (options?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(options.category);
    }
    if (options?.supplierId) {
      query += ` AND supplier_id = $${paramIndex++}`;
      params.push(options.supplierId);
    }
    if (options?.lowStock) {
      query += ' AND current_stock <= reorder_level';
    }
    if (options?.expiringSoon) {
      query += ` AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days')`;
    }
    if (options?.search) {
      query += ` AND (name LIKE $${paramIndex++} OR sku LIKE $${paramIndex - 1})`;
      params.push(`%${options.search}%`);
    }

    query += ' ORDER BY name ASC';

    const rows = await db.select<InventoryItemRow[]>(query, params);
    return rows.map(this.rowToInventoryItem);
  }

  async getInventoryItem(itemId: string, tenantId: string): Promise<InventoryItem | null> {
    const db = await this.getDb();
    const rows = await db.select<InventoryItemRow[]>(
      'SELECT * FROM inventory_items WHERE id = $1 AND tenant_id = $2',
      [itemId, tenantId]
    );
    return rows.length > 0 ? this.rowToInventoryItem(rows[0]) : null;
  }

  async createInventoryItem(input: CreateInventoryItemInput, tenantId: string): Promise<InventoryItem> {
    const db = await this.getDb();
    const now = this.getNow();
    const id = this.generateId('inv');

    await db.execute(
      `INSERT INTO inventory_items (
        id, tenant_id, name, sku, category, current_stock, unit,
        price_per_unit, reorder_level, supplier_id, storage_location, expiry_date,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        tenantId,
        input.name,
        input.sku || null,
        input.category,
        input.currentStock || 0,
        input.unit,
        input.pricePerUnit || null,
        input.reorderLevel || 0,
        input.supplierId || null,
        input.storageLocation || null,
        input.expiryDate || null,
        now,
        now,
      ]
    );

    // Log initial stock transaction if starting with stock
    if (input.currentStock && input.currentStock > 0) {
      await this.logTransaction({
        itemId: id,
        quantityChange: input.currentStock,
        transactionType: 'adjustment',
        reason: 'Initial stock',
        unitPrice: input.pricePerUnit,
      }, tenantId);
    }

    return {
      id,
      tenantId,
      name: input.name,
      sku: input.sku,
      category: input.category,
      currentStock: input.currentStock || 0,
      unit: input.unit,
      pricePerUnit: input.pricePerUnit,
      reorderLevel: input.reorderLevel || 0,
      supplierId: input.supplierId,
      storageLocation: input.storageLocation,
      expiryDate: input.expiryDate,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateInventoryItem(
    itemId: string,
    updates: UpdateInventoryItemInput,
    tenantId: string
  ): Promise<InventoryItem | null> {
    const db = await this.getDb();
    const now = this.getNow();

    const setClauses: string[] = ['updated_at = $1'];
    const params: (string | number | null)[] = [now];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.sku !== undefined) {
      setClauses.push(`sku = $${paramIndex++}`);
      params.push(updates.sku || null);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      params.push(updates.category);
    }
    if (updates.unit !== undefined) {
      setClauses.push(`unit = $${paramIndex++}`);
      params.push(updates.unit);
    }
    if (updates.pricePerUnit !== undefined) {
      setClauses.push(`price_per_unit = $${paramIndex++}`);
      params.push(updates.pricePerUnit || null);
    }
    if (updates.reorderLevel !== undefined) {
      setClauses.push(`reorder_level = $${paramIndex++}`);
      params.push(updates.reorderLevel);
    }
    if (updates.supplierId !== undefined) {
      setClauses.push(`supplier_id = $${paramIndex++}`);
      params.push(updates.supplierId || null);
    }
    if (updates.storageLocation !== undefined) {
      setClauses.push(`storage_location = $${paramIndex++}`);
      params.push(updates.storageLocation || null);
    }
    if (updates.expiryDate !== undefined) {
      setClauses.push(`expiry_date = $${paramIndex++}`);
      params.push(updates.expiryDate || null);
    }

    params.push(itemId, tenantId);

    await db.execute(
      `UPDATE inventory_items SET ${setClauses.join(', ')} WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}`,
      params
    );

    return this.getInventoryItem(itemId, tenantId);
  }

  async adjustStock(input: StockAdjustmentInput, tenantId: string, recordedBy?: string): Promise<InventoryItem | null> {
    const db = await this.getDb();
    const item = await this.getInventoryItem(input.itemId, tenantId);
    if (!item) return null;

    const now = this.getNow();
    const newQuantity = item.currentStock + input.quantityChange;

    // Update stock
    await db.execute(
      'UPDATE inventory_items SET current_stock = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4',
      [newQuantity, now, input.itemId, tenantId]
    );

    // Log transaction
    await this.logTransaction({
      itemId: input.itemId,
      documentId: input.documentId,
      transactionType: input.transactionType,
      quantityChange: input.quantityChange,
      previousQuantity: item.currentStock,
      newQuantity,
      unitPrice: input.unitPrice,
      reason: input.reason,
      recordedBy,
    }, tenantId);

    return this.getInventoryItem(input.itemId, tenantId);
  }

  async deleteInventoryItem(itemId: string, tenantId: string): Promise<boolean> {
    const db = await this.getDb();

    // Delete related recipe ingredients first
    await db.execute(
      'DELETE FROM recipe_ingredients WHERE inventory_item_id = $1 AND tenant_id = $2',
      [itemId, tenantId]
    );

    await db.execute(
      'DELETE FROM inventory_items WHERE id = $1 AND tenant_id = $2',
      [itemId, tenantId]
    );

    return true;
  }

  // ==================== TRANSACTIONS ====================

  private async logTransaction(
    data: {
      itemId: string;
      documentId?: string;
      transactionType: TransactionType;
      quantityChange: number;
      previousQuantity?: number;
      newQuantity?: number;
      unitPrice?: number;
      reason?: string;
      recordedBy?: string;
    },
    tenantId: string
  ): Promise<void> {
    const db = await this.getDb();
    const id = this.generateId('txn');
    const now = this.getNow();

    // Get previous quantity if not provided
    let prevQty = data.previousQuantity;
    if (prevQty === undefined) {
      const item = await this.getInventoryItem(data.itemId, tenantId);
      prevQty = item?.currentStock || 0;
    }

    const newQty = data.newQuantity ?? prevQty + data.quantityChange;

    await db.execute(
      `INSERT INTO inventory_transactions (
        id, tenant_id, item_id, document_id, transaction_type,
        quantity_change, previous_quantity, new_quantity, unit_price, reason, recorded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        tenantId,
        data.itemId,
        data.documentId || null,
        data.transactionType,
        data.quantityChange,
        prevQty,
        newQty,
        data.unitPrice || null,
        data.reason || null,
        data.recordedBy || null,
        now,
      ]
    );
  }

  async getItemTransactions(itemId: string, tenantId: string, limit: number = 50): Promise<InventoryTransaction[]> {
    const db = await this.getDb();
    const rows = await db.select<InventoryTransactionRow[]>(
      `SELECT * FROM inventory_transactions
       WHERE item_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [itemId, tenantId, limit]
    );
    return rows.map(this.rowToTransaction);
  }

  // ==================== DOCUMENTS ====================

  async saveDocument(
    data: {
      documentType: DocumentType;
      supplierId?: string;
      filePath?: string;
      ocrStatus: OcrStatus;
      ocrProvider?: string;
      extractedData?: ExtractedDocumentData;
      totalAmount?: number;
      taxAmount?: number;
      documentDate?: string;
      invoiceNumber?: string;
      processingTimeMs?: number;
      confidenceScore?: number;
    },
    tenantId: string
  ): Promise<InventoryDocument> {
    const db = await this.getDb();
    const id = this.generateId('doc');
    const now = this.getNow();

    await db.execute(
      `INSERT INTO inventory_documents (
        id, tenant_id, document_type, supplier_id, file_path, ocr_status, ocr_provider,
        extracted_data, total_amount, tax_amount, document_date, invoice_number,
        processing_time_ms, confidence_score, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id,
        tenantId,
        data.documentType,
        data.supplierId || null,
        data.filePath || null,
        data.ocrStatus,
        data.ocrProvider || null,
        data.extractedData ? JSON.stringify(data.extractedData) : null,
        data.totalAmount || null,
        data.taxAmount || null,
        data.documentDate || null,
        data.invoiceNumber || null,
        data.processingTimeMs || null,
        data.confidenceScore || null,
        now,
        now,
      ]
    );

    return {
      id,
      tenantId,
      documentType: data.documentType,
      supplierId: data.supplierId,
      filePath: data.filePath,
      ocrStatus: data.ocrStatus,
      ocrProvider: data.ocrProvider as InventoryDocument['ocrProvider'],
      extractedData: data.extractedData,
      totalAmount: data.totalAmount,
      taxAmount: data.taxAmount,
      documentDate: data.documentDate,
      invoiceNumber: data.invoiceNumber,
      processingTimeMs: data.processingTimeMs,
      confidenceScore: data.confidenceScore,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getDocuments(tenantId: string, limit: number = 50): Promise<InventoryDocument[]> {
    const db = await this.getDb();
    const rows = await db.select<InventoryDocumentRow[]>(
      `SELECT * FROM inventory_documents
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return rows.map(this.rowToDocument);
  }

  // ==================== RECIPE INGREDIENTS ====================

  async getRecipeIngredients(menuItemId: string, tenantId: string): Promise<RecipeIngredient[]> {
    const db = await this.getDb();
    const rows = await db.select<RecipeIngredientRow[]>(
      `SELECT * FROM recipe_ingredients WHERE menu_item_id = $1 AND tenant_id = $2`,
      [menuItemId, tenantId]
    );
    return rows.map(this.rowToRecipeIngredient);
  }

  async addRecipeIngredient(
    menuItemId: string,
    inventoryItemId: string,
    quantityRequired: number,
    unit: string,
    tenantId: string
  ): Promise<RecipeIngredient> {
    const db = await this.getDb();
    const id = this.generateId('rcp');
    const now = this.getNow();

    await db.execute(
      `INSERT INTO recipe_ingredients (id, tenant_id, menu_item_id, inventory_item_id, quantity_required, unit, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, tenantId, menuItemId, inventoryItemId, quantityRequired, unit, now]
    );

    return {
      id,
      tenantId,
      menuItemId,
      inventoryItemId,
      quantityRequired,
      unit: unit as RecipeIngredient['unit'],
      createdAt: now,
    };
  }

  async removeRecipeIngredient(ingredientId: string, tenantId: string): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      'DELETE FROM recipe_ingredients WHERE id = $1 AND tenant_id = $2',
      [ingredientId, tenantId]
    );
  }

  // ==================== ALERTS & SUMMARY ====================

  async getLowStockAlerts(tenantId: string): Promise<LowStockAlert[]> {
    const items = await this.getInventoryItems(tenantId, { lowStock: true });
    return items.map((item) => ({
      item,
      currentStock: item.currentStock,
      reorderLevel: item.reorderLevel,
      deficit: item.reorderLevel - item.currentStock,
    }));
  }

  async getExpiringSoonAlerts(tenantId: string, days: number = 7): Promise<ExpiryAlert[]> {
    const db = await this.getDb();
    const rows = await db.select<InventoryItemRow[]>(
      `SELECT * FROM inventory_items
       WHERE tenant_id = $1 AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+' || $2 || ' days')
       ORDER BY expiry_date ASC`,
      [tenantId, days]
    );

    return rows.map((row) => {
      const item = this.rowToInventoryItem(row);
      const expiryDate = new Date(item.expiryDate!);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        item,
        expiryDate: item.expiryDate!,
        daysUntilExpiry,
      };
    });
  }

  async getInventorySummary(tenantId: string): Promise<InventorySummary> {
    const items = await this.getInventoryItems(tenantId);
    const lowStockItems = items.filter((i) => i.currentStock <= i.reorderLevel);
    const expiringSoon = await this.getExpiringSoonAlerts(tenantId, 7);

    const byCategory: InventorySummary['byCategory'] = {} as InventorySummary['byCategory'];
    let totalValue = 0;

    for (const item of items) {
      const category = item.category;
      const itemValue = item.currentStock * (item.pricePerUnit || 0);
      totalValue += itemValue;

      if (!byCategory[category]) {
        byCategory[category] = { count: 0, value: 0 };
      }
      byCategory[category].count++;
      byCategory[category].value += itemValue;
    }

    return {
      totalItems: items.length,
      totalValue,
      lowStockCount: lowStockItems.length,
      expiringSoonCount: expiringSoon.length,
      byCategory,
    };
  }

  // ==================== ROW MAPPERS ====================

  private rowToSupplier(row: SupplierRow): Supplier {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      contactName: row.contact_name || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToInventoryItem(row: InventoryItemRow): InventoryItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      sku: row.sku || undefined,
      category: row.category as InventoryCategory,
      currentStock: row.current_stock,
      unit: row.unit as InventoryItem['unit'],
      pricePerUnit: row.price_per_unit || undefined,
      reorderLevel: row.reorder_level,
      supplierId: row.supplier_id || undefined,
      storageLocation: row.storage_location || undefined,
      expiryDate: row.expiry_date || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToDocument(row: InventoryDocumentRow): InventoryDocument {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      documentType: row.document_type as DocumentType,
      supplierId: row.supplier_id || undefined,
      filePath: row.file_path || undefined,
      ocrStatus: row.ocr_status as OcrStatus,
      ocrProvider: row.ocr_provider as InventoryDocument['ocrProvider'],
      extractedData: row.extracted_data ? JSON.parse(row.extracted_data) : undefined,
      totalAmount: row.total_amount || undefined,
      taxAmount: row.tax_amount || undefined,
      documentDate: row.document_date || undefined,
      invoiceNumber: row.invoice_number || undefined,
      processingTimeMs: row.processing_time_ms || undefined,
      confidenceScore: row.confidence_score || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToTransaction(row: InventoryTransactionRow): InventoryTransaction {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      itemId: row.item_id,
      documentId: row.document_id || undefined,
      transactionType: row.transaction_type as TransactionType,
      quantityChange: row.quantity_change,
      previousQuantity: row.previous_quantity,
      newQuantity: row.new_quantity,
      unitPrice: row.unit_price || undefined,
      reason: row.reason || undefined,
      recordedBy: row.recorded_by || undefined,
      createdAt: row.created_at,
    };
  }

  private rowToRecipeIngredient(row: RecipeIngredientRow): RecipeIngredient {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      menuItemId: row.menu_item_id,
      inventoryItemId: row.inventory_item_id,
      quantityRequired: row.quantity_required,
      unit: row.unit as RecipeIngredient['unit'],
      createdAt: row.created_at,
    };
  }
}

export const inventoryService = new InventoryService();
