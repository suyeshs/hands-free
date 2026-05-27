import Database from "@tauri-apps/plugin-sql";
import { MenuItem, MenuCategory, Order, Table } from "../types";
import { getDatabasePath } from "./databasePath";
import { executeCriticalOperation } from "../services/backgroundOperationsCoordinator";

let db: Database | null = null;
let dbFilePath: string | null = null;

// Determine database name based on environment
// Dev mode uses pos-dev.db, production uses guanix.db
export const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

// Silent initialization - enable debug with localStorage.setItem('debug:database', 'true')

// Export database instance for sync services (stub for IncrementalSyncService)
export const database = {
  async query(sql: string, params?: any[]): Promise<any[]> {
    if (!db) {
      db = await Database.load(DB_NAME);
    }
    return db.select(sql, params);
  }
};

/**
 * Get the file system path to the database
 * Used by D1SyncService and other Rust commands that need the actual file path
 */
export async function getDatabaseFilePath(): Promise<string> {
  if (!dbFilePath) {
    dbFilePath = await getDatabasePath();
  }
  return dbFilePath;
}

export async function initDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load(DB_NAME);

    // Configure SQLite for better concurrency handling
    try {
      // Increase busy timeout to 30 seconds (30000ms)
      // This allows operations to wait for locks instead of failing immediately
      await db.execute("PRAGMA busy_timeout = 30000");

      // Enable Write-Ahead Logging (WAL) mode for better concurrent access
      // WAL allows reads and writes to proceed concurrently
      await db.execute("PRAGMA journal_mode = WAL");

      console.log('[Database] Configured SQLite with busy_timeout=30000ms and WAL mode');
    } catch (error) {
      console.warn('[Database] Failed to configure SQLite pragmas:', error);
    }

    // Initialize the file path for sync services
    dbFilePath = await getDatabasePath();
  }
  return db;
}

export async function getMenuCategories(): Promise<MenuCategory[]> {
  const database = await initDatabase();
  const result = await database.select<MenuCategory[]>(
    "SELECT * FROM menu_categories WHERE active = 1 ORDER BY sort_order"
  );
  return result;
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    "SELECT * FROM menu_items WHERE active = 1"
  );
  
  return result.map((item) => ({
    ...item,
    allergens: item.allergens ? JSON.parse(item.allergens) : [],
    dietary_tags: item.dietary_tags ? JSON.parse(item.dietary_tags) : [],
  }));
}

export async function getMenuItemsByCategory(
  categoryId: string
): Promise<MenuItem[]> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    "SELECT * FROM menu_items WHERE category_id = $1 AND active = 1",
    [categoryId]
  );
  
  return result.map((item) => ({
    ...item,
    allergens: item.allergens ? JSON.parse(item.allergens) : [],
    dietary_tags: item.dietary_tags ? JSON.parse(item.dietary_tags) : [],
  }));
}

export async function getTables(): Promise<Table[]> {
  const database = await initDatabase();
  const result = await database.select<Table[]>("SELECT * FROM tables");
  return result;
}

export async function updateTableStatus(
  tableId: string,
  status: string
): Promise<void> {
  const database = await initDatabase();
  await database.execute("UPDATE tables SET status = $1 WHERE id = $2", [
    status,
    tableId,
  ]);
}

export async function createOrder(
  tableId: string | null,
  serverId: string
): Promise<string> {
  const database = await initDatabase();
  const orderId = `order-${Date.now()}`;
  const now = new Date().toISOString();
  
  await database.execute(
    "INSERT INTO orders (id, table_id, server_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [orderId, tableId, serverId, "draft", now, now]
  );
  
  return orderId;
}

export async function getOrders(status?: string): Promise<Order[]> {
  const database = await initDatabase();
  let query = "SELECT * FROM orders ORDER BY created_at DESC";
  let params: any[] = [];
  
  if (status) {
    query = "SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC";
    params = [status];
  }
  
  const result = await database.select<Order[]>(query, params);
  return result;
}

export async function searchMenuItems(query: string): Promise<MenuItem[]> {
  const database = await initDatabase();
  const searchTerm = `%${query.toLowerCase()}%`;

  const result = await database.select<any[]>(
    "SELECT * FROM menu_items WHERE active = 1 AND (LOWER(name) LIKE $1 OR LOWER(description) LIKE $1)",
    [searchTerm]
  );

  return result.map((item) => ({
    ...item,
    allergens: item.allergens ? JSON.parse(item.allergens) : [],
    dietary_tags: item.dietary_tags ? JSON.parse(item.dietary_tags) : [],
  }));
}

/**
 * Create or update a menu category in local SQLite
 * Prevents duplicate categories by checking for existing name
 */
export async function saveMenuCategory(category: {
  id?: string;
  name: string;
  description?: string;
  sort_order?: number;
  active?: boolean;
}): Promise<string> {
  const database = await initDatabase();
  const now = new Date().toISOString();

  // First check if a category with this name already exists
  const existingByName = await database.select<any[]>(
    "SELECT id FROM menu_categories WHERE name = $1",
    [category.name]
  );

  if (existingByName.length > 0) {
    // Category with this name exists - update it instead of creating duplicate
    const existingId = existingByName[0].id;
    await database.execute(
      "UPDATE menu_categories SET description = $1, sort_order = $2, active = $3, updated_at = $4 WHERE id = $5",
      [
        category.description || '',
        category.sort_order || 0,
        category.active !== false ? 1 : 0,
        now,
        existingId,
      ]
    );
    return existingId;
  }

  // If ID is provided, check if category with this ID exists
  if (category.id) {
    const existingById = await database.select<any[]>(
      "SELECT id FROM menu_categories WHERE id = $1",
      [category.id]
    );

    if (existingById.length > 0) {
      // Update existing category by ID
      await database.execute(
        "UPDATE menu_categories SET name = $1, description = $2, sort_order = $3, active = $4, updated_at = $5 WHERE id = $6",
        [
          category.name,
          category.description || '',
          category.sort_order || 0,
          category.active !== false ? 1 : 0,
          now,
          category.id,
        ]
      );
      return category.id;
    }
  }

  // No existing category found - create new one
  const categoryId = category.id || `cat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await database.execute(
    "INSERT INTO menu_categories (id, name, description, sort_order, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      categoryId,
      category.name,
      category.description || '',
      category.sort_order || 0,
      category.active !== false ? 1 : 0,
      now,
      now,
    ]
  );

  return categoryId;
}

/**
 * Create or update a menu item in local SQLite
 * Accepts both camelCase (MenuItem type) and snake_case (database) properties
 */
export async function saveMenuItem(item: Partial<MenuItem> & { name: string; price: number }): Promise<string> {
  const database = await initDatabase();
  const itemId = item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  // const now = new Date().toISOString(); // Unused

  // Cast to any to allow flexible property access (camelCase or snake_case)
  const flexItem = item as any;

  // Check if item exists
  const existing = await database.select<any[]>(
    "SELECT id FROM menu_items WHERE id = $1",
    [itemId]
  );

  if (existing.length > 0) {
    // Update existing item - only fields that exist in schema
    await database.execute(
      `UPDATE menu_items SET
        name = $1,
        description = $2,
        price = $3,
        category_id = $4,
        allergens = $5,
        dietary_tags = $6,
        preparation_time = $7,
        image = $8,
        active = $9
      WHERE id = $10`,
      [
        item.name,
        item.description || '',
        item.price,
        flexItem.category_id || flexItem.categoryId || 'uncategorized',
        JSON.stringify(item.allergens || []),
        JSON.stringify(flexItem.dietary_tags || flexItem.dietaryTags || []),
        flexItem.preparation_time || flexItem.preparationTime || 15,
        flexItem.image || flexItem.imageUrl || null,
        flexItem.active !== false ? 1 : 0,
        itemId,
      ]
    );
  } else {
    // Insert new item - only fields that exist in schema
    await database.execute(
      `INSERT INTO menu_items (
        id, name, description, price, category_id, allergens, dietary_tags,
        preparation_time, image, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        itemId,
        item.name,
        item.description || '',
        item.price,
        flexItem.category_id || flexItem.categoryId || 'uncategorized',
        JSON.stringify(item.allergens || []),
        JSON.stringify(flexItem.dietary_tags || flexItem.dietaryTags || []),
        flexItem.preparation_time || flexItem.preparationTime || 15,
        flexItem.image || flexItem.imageUrl || null,
        flexItem.active !== false ? 1 : 0,
      ]
    );
  }

  return itemId;
}

/**
 * Batch save menu items (more efficient for bulk imports)
 */
export async function batchSaveMenuItems(items: (Partial<MenuItem> & { name: string; price: number })[]): Promise<string[]> {
  const savedIds: string[] = [];

  for (const item of items) {
    const id = await saveMenuItem(item);
    savedIds.push(id);
  }

  return savedIds;
}

/**
 * Get items that need to be synced to D1
 */
export async function getItemsNeedingSync(): Promise<MenuItem[]> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    "SELECT * FROM menu_items WHERE needs_sync = 1"
  );

  return result.map((item) => ({
    ...item,
    allergens: item.allergens ? JSON.parse(item.allergens) : [],
    dietary_tags: item.dietary_tags ? JSON.parse(item.dietary_tags) : [],
  }));
}

/**
 * Mark items as synced
 */
export async function markItemsAsSynced(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  const database = await initDatabase();
  const placeholders = itemIds.map((_, i) => `$${i + 1}`).join(',');
  await database.execute(
    `UPDATE menu_items SET needs_sync = 0 WHERE id IN (${placeholders})`,
    itemIds
  );
}

/**
 * Delete a menu category from local SQLite
 */
export async function deleteMenuCategory(categoryId: string): Promise<void> {
  const database = await initDatabase();

  // Soft delete - mark as inactive instead of removing
  await database.execute(
    "UPDATE menu_categories SET active = 0, updated_at = $1 WHERE id = $2",
    [new Date().toISOString(), categoryId]
  );

  // Also mark all items in this category as needing review (optional)
  await database.execute(
    "UPDATE menu_items SET category_id = 'uncategorized' WHERE category_id = $1",
    [categoryId]
  );
}

/**
 * Delete a menu item from local SQLite
 */
export async function deleteMenuItem(itemId: string): Promise<void> {
  const database = await initDatabase();

  await database.execute(
    "DELETE FROM menu_items WHERE id = $1",
    [itemId]
  );
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Retry helper with exponential backoff for database operations
 * Handles "database is locked" errors gracefully
 */
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);

      // Only retry on database locked errors
      if (errorMessage.includes('database is locked') || errorMessage.includes('SQLITE_BUSY')) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[Database] Operation failed (attempt ${attempt + 1}/${maxRetries}): ${errorMessage}. Retrying in ${delayMs}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  // All retries exhausted
  console.error(`[Database] Operation failed after ${maxRetries} attempts`);
  throw lastError;
}

// ============================================================================
// MENU UPLOAD SESSIONS
// ============================================================================

export interface UploadSession {
  id: string;
  menuType: 'food' | 'bar';
  status: 'in_progress' | 'committed' | 'cancelled';
  createdAt: string;
  committedAt?: string;
  totalItems: number;
  totalPages: number;
}

export interface UploadPage {
  id: string;
  sessionId: string;
  pageNumber: number;
  fileName: string;
  itemCount: number;
  status: 'uploading' | 'parsed' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export interface StagingItem {
  id: string;
  sessionId: string;
  pageNumber: number;
  name: string;
  category: string;
  description?: string;
  price: number;
  image?: string;
  active: boolean;
  preparationTime: number;
  allergens: string[];
  dietaryTags: string[];
}

/**
 * Start a new upload session
 */
export async function startUploadSession(menuType: 'food' | 'bar'): Promise<string> {
  const database = await initDatabase();
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  await database.execute(
    `INSERT INTO menu_upload_sessions (id, menu_type, status, created_at, total_items, total_pages)
     VALUES ($1, $2, 'in_progress', $3, 0, 0)`,
    [sessionId, menuType, now]
  );

  console.log('[Upload Session] Started new session:', sessionId, 'type:', menuType);
  return sessionId;
}

/**
 * Get session details
 */
export async function getUploadSession(sessionId: string): Promise<UploadSession | null> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    `SELECT * FROM menu_upload_sessions WHERE id = $1`,
    [sessionId]
  );

  if (result.length === 0) return null;

  const row = result[0];
  return {
    id: row.id,
    menuType: row.menu_type,
    status: row.status,
    createdAt: row.created_at,
    committedAt: row.committed_at,
    totalItems: row.total_items,
    totalPages: row.total_pages,
  };
}

/**
 * Add a page to upload session
 */
export async function addUploadPage(
  sessionId: string,
  pageNumber: number,
  fileName: string
): Promise<string> {
  const database = await initDatabase();
  const pageId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  await database.execute(
    `INSERT INTO menu_upload_pages (id, session_id, page_number, file_name, status, created_at)
     VALUES ($1, $2, $3, $4, 'uploading', $5)`,
    [pageId, sessionId, pageNumber, fileName, now]
  );

  // Update session total_pages
  await database.execute(
    `UPDATE menu_upload_sessions SET total_pages = total_pages + 1 WHERE id = $1`,
    [sessionId]
  );

  return pageId;
}

/**
 * Update page status
 */
export async function updatePageStatus(
  pageId: string,
  status: 'uploading' | 'parsed' | 'error',
  itemCount?: number,
  errorMessage?: string
): Promise<void> {
  const database = await initDatabase();

  await database.execute(
    `UPDATE menu_upload_pages
     SET status = $1, item_count = $2, error_message = $3
     WHERE id = $4`,
    [status, itemCount || 0, errorMessage || null, pageId]
  );
}

/**
 * Add items to staging
 */
export async function addStagingItems(
  sessionId: string,
  pageNumber: number,
  items: Array<{
    name: string;
    category: string;
    description?: string;
    price: number;
    image?: string;
    preparationTime?: number;
    allergens?: string[];
    dietaryTags?: string[];
  }>
): Promise<number> {
  const database = await initDatabase();
  let inserted = 0;

  for (const item of items) {
    const itemId = `staging-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    await database.execute(
      `INSERT INTO menu_items_staging (
        id, session_id, page_number, name, category, description, price,
        image, active, preparation_time, allergens, dietary_tags, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12)`,
      [
        itemId,
        sessionId,
        pageNumber,
        item.name,
        item.category,
        item.description || '',
        item.price,
        item.image || null,
        item.preparationTime || 15,
        JSON.stringify(item.allergens || []),
        JSON.stringify(item.dietaryTags || []),
        now,
      ]
    );
    inserted++;
  }

  // Update session total_items
  await database.execute(
    `UPDATE menu_upload_sessions SET total_items = total_items + $1 WHERE id = $2`,
    [inserted, sessionId]
  );

  console.log('[Upload Session] Added', inserted, 'items to session', sessionId);
  return inserted;
}

/**
 * Get all items from session
 */
export async function getSessionItems(sessionId: string): Promise<StagingItem[]> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    `SELECT * FROM menu_items_staging WHERE session_id = $1 ORDER BY page_number, name`,
    [sessionId]
  );

  return result.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    pageNumber: row.page_number,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    image: row.image,
    active: row.active === 1,
    preparationTime: row.preparation_time,
    allergens: JSON.parse(row.allergens || '[]'),
    dietaryTags: JSON.parse(row.dietary_tags || '[]'),
  }));
}

/**
 * Get all pages from session
 */
export async function getSessionPages(sessionId: string): Promise<UploadPage[]> {
  const database = await initDatabase();
  const result = await database.select<any[]>(
    `SELECT * FROM menu_upload_pages WHERE session_id = $1 ORDER BY page_number`,
    [sessionId]
  );

  return result.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    pageNumber: row.page_number,
    fileName: row.file_name,
    itemCount: row.item_count,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

/**
 * Commit session - Move staging items to production
 * Uses retry logic and pauses all background operations to prevent conflicts
 */
export async function commitUploadSession(sessionId: string): Promise<void> {
  const database = await initDatabase();

  // Get session details (outside of transaction)
  const session = await getUploadSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'in_progress') {
    throw new Error('Session already committed or cancelled');
  }

  console.log('[Upload Session] Committing session:', sessionId, 'type:', session.menuType);

  // Execute as critical operation - pauses all background operations
  await executeCriticalOperation(async () => {
    // Wait a moment for any pending database operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    // Wrap the entire transaction in retry logic
    await retryDatabaseOperation(async () => {
    // Safety: Ensure we're not in a transaction from a failed previous attempt
    try {
      await database.execute('ROLLBACK');
    } catch (e) {
      // Ignore - expected if no transaction is active
    }

    // Start transaction (DEFERRED allows busy_timeout to work properly)
    await database.execute('BEGIN DEFERRED TRANSACTION');

    try {
      // 1. Get all unique categories from staging
      const categories = await database.select<any[]>(
        `SELECT DISTINCT category FROM menu_items_staging WHERE session_id = $1`,
        [sessionId]
      );

      // 2. Create categories if they don't exist
      for (const catRow of categories) {
        const categoryId = `cat-${catRow.category.toLowerCase().replace(/\s+/g, '-')}`;
        const existing = await database.select<any[]>(
          `SELECT id FROM menu_categories WHERE id = $1`,
          [categoryId]
        );

        if (existing.length === 0) {
          await database.execute(
            `INSERT INTO menu_categories (id, name, sort_order, active)
             VALUES ($1, $2, 0, 1)`,
            [categoryId, catRow.category]
          );
        }
      }

      // 3. Delete old items (replace mode - delete all items of this menu type would go here if we add menu_type)
      // For now, we'll use category-based deletion
      const categoryNames = categories.map((c) => c.category);
      if (categoryNames.length > 0) {
        // Get category IDs for the categories we're replacing
        const namePlaceholders = categoryNames.map(() => '?').join(',');
        const categoryIds = await database.select<any[]>(
          `SELECT id FROM menu_categories WHERE name IN (${namePlaceholders})`,
          categoryNames
        );

        if (categoryIds.length > 0) {
          const idPlaceholders = categoryIds.map(() => '?').join(',');
          await database.execute(
            `DELETE FROM menu_items WHERE category_id IN (${idPlaceholders})`,
            categoryIds.map((c) => c.id)
          );
          console.log('[Upload Session] Deleted items in categories:', categoryNames);
        }
      }

      // 4. Copy staging items to production
      // Query staging items directly (don't call getSessionItems to maintain transaction context)
      const stagingItemsRaw = await database.select<any[]>(
        `SELECT * FROM menu_items_staging WHERE session_id = $1 ORDER BY page_number, name`,
        [sessionId]
      );

      // Batch insert items for better performance (reduces lock time)
      console.log(`[Upload Session] Inserting ${stagingItemsRaw.length} items in batches...`);
      const BATCH_SIZE = 10;
      for (let i = 0; i < stagingItemsRaw.length; i += BATCH_SIZE) {
        const batch = stagingItemsRaw.slice(i, i + BATCH_SIZE);
        const valueClauses: string[] = [];
        const allParams: any[] = [];
        let paramIndex = 1;

        for (const row of batch) {
          // Validate that category exists (fix for "ID is missing" error)
          if (!row.category || typeof row.category !== 'string') {
            console.error('[Upload Session] Skipping item with missing category:', row.name);
            continue;
          }

          const categoryId = `cat-${row.category.toLowerCase().replace(/\s+/g, '-')}`;
          const itemId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          valueClauses.push(
            `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9})`
          );
          allParams.push(
            itemId,
            categoryId,
            row.name,
            row.description || '',
            row.price,
            row.image || null,
            row.active ? 1 : 0,
            row.preparation_time,
            row.allergens,
            row.dietary_tags
          );
          paramIndex += 10;
        }

        if (valueClauses.length > 0) {
          console.log(`[Upload Session] Inserting batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(stagingItemsRaw.length/BATCH_SIZE)} (${valueClauses.length} items)...`);
          await database.execute(
            `INSERT INTO menu_items (
              id, category_id, name, description, price, image, active,
              preparation_time, allergens, dietary_tags
            ) VALUES ${valueClauses.join(', ')}`,
            allParams
          );
        }
      }
      console.log('[Upload Session] All items inserted successfully');

      // 5. Mark session as committed
      const now = new Date().toISOString();
      await database.execute(
        `UPDATE menu_upload_sessions SET status = 'committed', committed_at = $1 WHERE id = $2`,
        [now, sessionId]
      );

      // 6. Clean up staging tables
      await database.execute(`DELETE FROM menu_items_staging WHERE session_id = $1`, [sessionId]);
      await database.execute(`DELETE FROM menu_upload_pages WHERE session_id = $1`, [sessionId]);

      // Commit transaction
      await database.execute('COMMIT');

      console.log('[Upload Session] Session committed successfully. Inserted', stagingItemsRaw.length, 'items');
    } catch (error) {
      // Rollback on error
      try {
        await database.execute('ROLLBACK');
      } catch (rollbackError) {
        console.warn('[Upload Session] Rollback failed:', rollbackError);
      }
      console.error('[Upload Session] Commit failed, rolled back:', error);
      throw error;
    }
    });
  }, `Menu Upload Commit (${session.menuType})`);
}

/**
 * Cancel session and clean up
 */
export async function cancelUploadSession(sessionId: string): Promise<void> {
  const database = await initDatabase();

  await database.execute(
    `UPDATE menu_upload_sessions SET status = 'cancelled' WHERE id = $1`,
    [sessionId]
  );

  // Clean up staging data
  await database.execute(`DELETE FROM menu_items_staging WHERE session_id = $1`, [sessionId]);
  await database.execute(`DELETE FROM menu_upload_pages WHERE session_id = $1`, [sessionId]);

  console.log('[Upload Session] Session cancelled:', sessionId);
}

/**
 * Delete a page from session
 */
export async function deleteSessionPage(pageId: string): Promise<void> {
  const database = await initDatabase();

  // Get page details
  const pages = await database.select<any[]>(
    `SELECT session_id, page_number, item_count FROM menu_upload_pages WHERE id = $1`,
    [pageId]
  );

  if (pages.length === 0) return;

  const { session_id, page_number, item_count } = pages[0];

  // Delete staging items for this page
  await database.execute(
    `DELETE FROM menu_items_staging WHERE session_id = $1 AND page_number = $2`,
    [session_id, page_number]
  );

  // Delete page record
  await database.execute(`DELETE FROM menu_upload_pages WHERE id = $1`, [pageId]);

  // Update session totals
  await database.execute(
    `UPDATE menu_upload_sessions
     SET total_items = total_items - $1, total_pages = total_pages - 1
     WHERE id = $2`,
    [item_count || 0, session_id]
  );

  console.log('[Upload Session] Deleted page:', pageId);
}

