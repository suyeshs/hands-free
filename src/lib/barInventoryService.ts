/**
 * Bar Inventory Service
 * SQLite persistence layer for bar inventory management
 * Handles inventory items, recipes, transactions, and closing sessions
 */

import Database from '@tauri-apps/plugin-sql';
import type {
  BarInventoryItem,
  BarRecipe,
  BarRecipeIngredient,
  BarInventoryTransaction,
  BarClosingSession,
  BarClosingCount,
  TransactionType,
} from '../types/bar';

class BarInventoryService {
  private db: Database | null = null;

  /**
   * Get or create database connection
   */
  private async getDb(): Promise<Database> {
    if (!this.db) {
      this.db = await Database.load('sqlite:restaurant.db');
    }
    return this.db;
  }

  // ==================== INVENTORY ITEMS ====================

  /**
   * Get all inventory items for a tenant
   */
  async getInventoryItems(tenantId: string): Promise<BarInventoryItem[]> {
    const db = await this.getDb();
    const rows = await db.select<any[]>(
      `SELECT * FROM bar_inventory_items WHERE tenant_id = $1 ORDER BY category, name`,
      [tenantId]
    );

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      inventoryItemId: row.inventory_item_id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      containerType: row.container_type,
      containerSizeMl: row.container_size_ml,
      costPerContainer: row.cost_per_container,
      fullContainers: row.full_containers,
      partialContainerMl: row.partial_container_ml,
      parLevel: row.par_level,
      reorderPoint: row.reorder_point,
      lastRestockedAt: row.last_restocked_at,
      lastCountedAt: row.last_counted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Save or update inventory item
   */
  async saveInventoryItem(item: BarInventoryItem): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      `INSERT INTO bar_inventory_items (
        id, tenant_id, inventory_item_id, name, category, subcategory,
        container_type, container_size_ml, cost_per_container,
        full_containers, partial_container_ml, par_level, reorder_point,
        last_restocked_at, last_counted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT(id) DO UPDATE SET
        name = $4, category = $5, subcategory = $6,
        container_type = $7, container_size_ml = $8, cost_per_container = $9,
        full_containers = $10, partial_container_ml = $11, par_level = $12, reorder_point = $13,
        last_restocked_at = $14, last_counted_at = $15, updated_at = $17`,
      [
        item.id,
        item.tenantId,
        item.inventoryItemId,
        item.name,
        item.category,
        item.subcategory,
        item.containerType,
        item.containerSizeMl,
        item.costPerContainer,
        item.fullContainers,
        item.partialContainerMl,
        item.parLevel,
        item.reorderPoint,
        item.lastRestockedAt,
        item.lastCountedAt,
        item.createdAt,
        item.updatedAt,
      ]
    );
  }

  /**
   * Update inventory item stock
   */
  async updateStock(
    itemId: string,
    fullContainers: number,
    partialContainerMl: number
  ): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      `UPDATE bar_inventory_items
       SET full_containers = $1, partial_container_ml = $2, updated_at = $3
       WHERE id = $4`,
      [fullContainers, partialContainerMl, new Date().toISOString(), itemId]
    );
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(itemId: string): Promise<void> {
    const db = await this.getDb();
    await db.execute(`DELETE FROM bar_inventory_items WHERE id = $1`, [itemId]);
  }

  // ==================== RECIPES ====================

  /**
   * Get all recipes for a tenant
   */
  async getRecipes(tenantId: string): Promise<BarRecipe[]> {
    const db = await this.getDb();
    const rows = await db.select<any[]>(
      `SELECT * FROM bar_recipes WHERE tenant_id = $1 ORDER BY drink_name`,
      [tenantId]
    );

    // Load ingredients for each recipe
    const recipes = await Promise.all(
      rows.map(async (row) => {
        const ingredients = await this.getRecipeIngredients(row.id);
        return {
          id: row.id,
          tenantId: row.tenant_id,
          menuItemId: row.menu_item_id,
          drinkName: row.drink_name,
          category: row.category,
          glassware: row.glassware,
          iceType: row.ice_type,
          ingredients,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
    );

    return recipes;
  }

  /**
   * Get recipe ingredients
   */
  private async getRecipeIngredients(recipeId: string): Promise<BarRecipeIngredient[]> {
    const db = await this.getDb();
    const rows = await db.select<any[]>(
      `SELECT * FROM bar_recipe_ingredients WHERE recipe_id = $1 ORDER BY sort_order`,
      [recipeId]
    );

    return rows.map((row) => ({
      id: row.id,
      recipeId: row.recipe_id,
      inventoryItemId: row.inventory_item_id,
      quantityMl: row.quantity_ml,
      quantityUnit: row.quantity_unit,
      isOptional: Boolean(row.is_optional),
      sortOrder: row.sort_order,
    }));
  }

  /**
   * Save recipe
   */
  async saveRecipe(recipe: BarRecipe): Promise<void> {
    const db = await this.getDb();

    // Save recipe
    await db.execute(
      `INSERT INTO bar_recipes (
        id, tenant_id, menu_item_id, drink_name, category, glassware, ice_type,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(id) DO UPDATE SET
        drink_name = $4, category = $5, glassware = $6, ice_type = $7, updated_at = $9`,
      [
        recipe.id,
        recipe.tenantId,
        recipe.menuItemId,
        recipe.drinkName,
        recipe.category,
        recipe.glassware,
        recipe.iceType,
        recipe.createdAt,
        recipe.updatedAt,
      ]
    );

    // Delete existing ingredients
    await db.execute(`DELETE FROM bar_recipe_ingredients WHERE recipe_id = $1`, [recipe.id]);

    // Save ingredients
    for (const ingredient of recipe.ingredients) {
      await db.execute(
        `INSERT INTO bar_recipe_ingredients (
          id, recipe_id, inventory_item_id, quantity_ml, quantity_unit,
          is_optional, sort_order, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          ingredient.id,
          recipe.id,
          ingredient.inventoryItemId,
          ingredient.quantityMl,
          ingredient.quantityUnit,
          ingredient.isOptional ? 1 : 0,
          ingredient.sortOrder,
          new Date().toISOString(),
        ]
      );
    }
  }

  /**
   * Delete recipe
   */
  async deleteRecipe(recipeId: string): Promise<void> {
    const db = await this.getDb();
    // Ingredients will be cascade deleted
    await db.execute(`DELETE FROM bar_recipes WHERE id = $1`, [recipeId]);
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Get transactions for a tenant
   */
  async getTransactions(
    tenantId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      itemId?: string;
      type?: TransactionType;
    }
  ): Promise<BarInventoryTransaction[]> {
    const db = await this.getDb();
    let query = `SELECT * FROM bar_inventory_transactions WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    if (options?.itemId) {
      query += ` AND inventory_item_id = $${paramIndex}`;
      params.push(options.itemId);
      paramIndex++;
    }

    if (options?.type) {
      query += ` AND transaction_type = $${paramIndex}`;
      params.push(options.type);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const rows = await db.select<any[]>(query, params);

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      inventoryItemId: row.inventory_item_id,
      transactionType: row.transaction_type,
      quantityMl: row.quantity_ml,
      barOrderId: row.bar_order_id,
      barOrderItemId: row.bar_order_item_id,
      staffId: row.staff_id,
      staffName: row.staff_name,
      costPerMl: row.cost_per_ml,
      totalCost: row.total_cost,
      reason: row.reason,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  }

  /**
   * Save transaction
   */
  async saveTransaction(transaction: BarInventoryTransaction): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      `INSERT INTO bar_inventory_transactions (
        id, tenant_id, inventory_item_id, transaction_type, quantity_ml,
        bar_order_id, bar_order_item_id, staff_id, staff_name,
        cost_per_ml, total_cost, reason, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        transaction.id,
        transaction.tenantId,
        transaction.inventoryItemId,
        transaction.transactionType,
        transaction.quantityMl,
        transaction.barOrderId,
        transaction.barOrderItemId,
        transaction.staffId,
        transaction.staffName,
        transaction.costPerMl,
        transaction.totalCost,
        transaction.reason,
        transaction.notes,
        transaction.createdAt,
      ]
    );
  }

  // ==================== CLOSING SESSIONS ====================

  /**
   * Get closing sessions for a tenant
   */
  async getClosingSessions(
    tenantId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      status?: 'open' | 'counting' | 'closed';
    }
  ): Promise<BarClosingSession[]> {
    const db = await this.getDb();
    let query = `SELECT * FROM bar_closing_sessions WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.startDate) {
      query += ` AND session_date >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      query += ` AND session_date <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    if (options?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    query += ` ORDER BY session_date DESC`;

    const rows = await db.select<any[]>(query, params);

    // Load counts for each session
    const sessions = await Promise.all(
      rows.map(async (row) => {
        const counts = await this.getClosingCounts(row.id);
        return {
          id: row.id,
          tenantId: row.tenant_id,
          sessionDate: row.session_date,
          openedAt: row.opened_at,
          closedAt: row.closed_at,
          status: row.status,
          openedByStaffId: row.opened_by_staff_id,
          closedByStaffId: row.closed_by_staff_id,
          openingCash: row.opening_cash,
          closingCash: row.closing_cash,
          expectedCash: row.expected_cash,
          varianceCash: row.variance_cash,
          totalOrders: row.total_orders,
          totalItemsSold: row.total_items_sold,
          grossRevenue: row.gross_revenue,
          itemsCounted: row.items_counted,
          totalVarianceMl: row.total_variance_ml,
          totalWasteMl: row.total_waste_ml,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          counts,
        };
      })
    );

    return sessions;
  }

  /**
   * Get closing counts for a session
   */
  private async getClosingCounts(sessionId: string): Promise<BarClosingCount[]> {
    const db = await this.getDb();
    const rows = await db.select<any[]>(
      `SELECT * FROM bar_closing_counts WHERE closing_session_id = $1 ORDER BY counted_at`,
      [sessionId]
    );

    return rows.map((row) => ({
      id: row.id,
      closingSessionId: row.closing_session_id,
      inventoryItemId: row.inventory_item_id,
      expectedFullBottles: row.expected_full_bottles,
      expectedPartialMl: row.expected_partial_ml,
      actualFullBottles: row.actual_full_bottles,
      actualPartialMl: row.actual_partial_ml,
      varianceBottles: row.variance_bottles,
      varianceMl: row.variance_ml,
      varianceCost: row.variance_cost,
      notes: row.notes,
      countedAt: row.counted_at,
    }));
  }

  /**
   * Save closing session
   */
  async saveClosingSession(session: BarClosingSession): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      `INSERT INTO bar_closing_sessions (
        id, tenant_id, session_date, opened_at, closed_at, status,
        opened_by_staff_id, closed_by_staff_id,
        opening_cash, closing_cash, expected_cash, variance_cash,
        total_orders, total_items_sold, gross_revenue,
        items_counted, total_variance_ml, total_waste_ml,
        notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT(id) DO UPDATE SET
        closed_at = $5, status = $6, closed_by_staff_id = $8,
        closing_cash = $10, expected_cash = $11, variance_cash = $12,
        total_orders = $13, total_items_sold = $14, gross_revenue = $15,
        items_counted = $16, total_variance_ml = $17, total_waste_ml = $18,
        notes = $19, updated_at = $21`,
      [
        session.id,
        session.tenantId,
        session.sessionDate,
        session.openedAt,
        session.closedAt,
        session.status,
        session.openedByStaffId,
        session.closedByStaffId,
        session.openingCash,
        session.closingCash,
        session.expectedCash,
        session.varianceCash,
        session.totalOrders,
        session.totalItemsSold,
        session.grossRevenue,
        session.itemsCounted,
        session.totalVarianceMl,
        session.totalWasteMl,
        session.notes,
        session.createdAt,
        session.updatedAt,
      ]
    );
  }

  /**
   * Save closing count
   */
  async saveClosingCount(count: BarClosingCount): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      `INSERT INTO bar_closing_counts (
        id, closing_session_id, inventory_item_id,
        expected_full_bottles, expected_partial_ml,
        actual_full_bottles, actual_partial_ml,
        variance_bottles, variance_ml, variance_cost,
        notes, counted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT(id) DO UPDATE SET
        actual_full_bottles = $6, actual_partial_ml = $7,
        variance_bottles = $8, variance_ml = $9, variance_cost = $10,
        notes = $11`,
      [
        count.id,
        count.closingSessionId,
        count.inventoryItemId,
        count.expectedFullBottles,
        count.expectedPartialMl,
        count.actualFullBottles,
        count.actualPartialMl,
        count.varianceBottles,
        count.varianceMl,
        count.varianceCost,
        count.notes,
        count.countedAt,
      ]
    );
  }

  /**
   * Delete closing session
   */
  async deleteClosingSession(sessionId: string): Promise<void> {
    const db = await this.getDb();
    // Counts will be cascade deleted
    await db.execute(`DELETE FROM bar_closing_sessions WHERE id = $1`, [sessionId]);
  }
}

export const barInventoryService = new BarInventoryService();
