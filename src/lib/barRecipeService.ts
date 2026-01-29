/**
 * Bar Recipe Service
 * Business logic for bar recipes, ingredient management, and cost calculation
 */

import type { BarRecipe, BarInventoryItem, BarOrder, IngredientUsage } from '../types/bar';
import { barInventoryService } from './barInventoryService';
import { useBarInventoryStore } from '../stores/barInventoryStore';

class BarRecipeService {
  /**
   * Get recipe by menu item ID
   */
  async getRecipeByMenuItemId(menuItemId: string): Promise<BarRecipe | null> {
    const store = useBarInventoryStore.getState();
    return store.getRecipeByMenuItemId(menuItemId) || null;
  }

  /**
   * Calculate pour cost for a recipe
   * Returns the total cost of ingredients for one serving
   */
  calculatePourCost(recipe: BarRecipe, items: BarInventoryItem[]): number {
    return recipe.ingredients.reduce((total, ingredient) => {
      const item = items.find((i) => i.id === ingredient.inventoryItemId);
      if (!item) return total;

      const costPerMl = item.costPerContainer / item.containerSizeMl;
      return total + ingredient.quantityMl * costPerMl;
    }, 0);
  }

  /**
   * Calculate ingredient usage for a bar order item
   * Returns detailed ingredient usage with costs
   */
  async calculateIngredientUsage(
    menuItemId: string,
    quantity: number,
    tenantId: string
  ): Promise<IngredientUsage[]> {
    const recipe = await this.getRecipeByMenuItemId(menuItemId);
    if (!recipe) return [];

    const items = await barInventoryService.getInventoryItems(tenantId);

    return recipe.ingredients.map((ingredient) => {
      const item = items.find((i) => i.id === ingredient.inventoryItemId);
      if (!item) {
        return {
          inventoryItemId: ingredient.inventoryItemId,
          itemName: 'Unknown Item',
          quantityMl: ingredient.quantityMl * quantity,
          costPerMl: 0,
          totalCost: 0,
        };
      }

      const costPerMl = item.costPerContainer / item.containerSizeMl;
      const quantityMl = ingredient.quantityMl * quantity;

      return {
        inventoryItemId: item.id,
        itemName: item.name,
        quantityMl,
        costPerMl,
        totalCost: quantityMl * costPerMl,
      };
    });
  }

  /**
   * Check if all ingredients are available for a recipe
   * Returns { available: boolean, missingItems: string[] }
   */
  async checkIngredientAvailability(
    recipe: BarRecipe,
    quantity: number,
    tenantId: string
  ): Promise<{ available: boolean; missingItems: string[] }> {
    const items = await barInventoryService.getInventoryItems(tenantId);
    const missingItems: string[] = [];

    for (const ingredient of recipe.ingredients) {
      if (ingredient.isOptional) continue;

      const item = items.find((i) => i.id === ingredient.inventoryItemId);
      if (!item) {
        missingItems.push(`${ingredient.inventoryItemId} (not found)`);
        continue;
      }

      const requiredMl = ingredient.quantityMl * quantity;
      const totalMl = item.fullContainers * item.containerSizeMl + item.partialContainerMl;

      if (totalMl < requiredMl) {
        missingItems.push(
          `${item.name} (need ${requiredMl}ml, have ${totalMl}ml)`
        );
      }
    }

    return {
      available: missingItems.length === 0,
      missingItems,
    };
  }

  /**
   * Deduct ingredients for a completed order
   * Creates transactions and updates inventory
   */
  async deductIngredientsForOrder(
    barOrder: BarOrder,
    tenantId: string
  ): Promise<void> {
    const store = useBarInventoryStore.getState();
    const items = await barInventoryService.getInventoryItems(tenantId);

    for (const orderItem of barOrder.items) {
      const recipe = await this.getRecipeByMenuItemId(orderItem.id.split('-')[0]);
      if (!recipe) continue;

      for (const ingredient of recipe.ingredients) {
        const item = items.find((i) => i.id === ingredient.inventoryItemId);
        if (!item) continue;

        const mlToDeduct = ingredient.quantityMl * orderItem.quantity;

        // Deduct from inventory (in-memory)
        store.deductMl(item.id, mlToDeduct);

        // Create transaction
        const transaction = {
          id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenantId,
          inventoryItemId: item.id,
          transactionType: 'sale' as const,
          quantityMl: -mlToDeduct, // Negative for deduction
          barOrderId: barOrder.id,
          barOrderItemId: orderItem.id,
          costPerMl: item.costPerContainer / item.containerSizeMl,
          totalCost: (mlToDeduct * item.costPerContainer) / item.containerSizeMl,
          createdAt: new Date().toISOString(),
        };

        // Save transaction
        await barInventoryService.saveTransaction(transaction);
        store.addTransaction(transaction);

        // Update stock in SQLite
        const updatedItem = store.getItemById(item.id);
        if (updatedItem) {
          await barInventoryService.updateStock(
            item.id,
            updatedItem.fullContainers,
            updatedItem.partialContainerMl
          );
        }
      }
    }
  }

  /**
   * Record waste for an item
   */
  async recordWaste(
    itemId: string,
    quantityMl: number,
    reason: string,
    staffId?: string,
    staffName?: string,
    tenantId?: string
  ): Promise<void> {
    const store = useBarInventoryStore.getState();
    const item = store.getItemById(itemId);
    if (!item || !tenantId) return;

    // Deduct from inventory
    store.deductMl(itemId, quantityMl);

    // Create waste transaction
    const transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      inventoryItemId: itemId,
      transactionType: 'waste' as const,
      quantityMl: -quantityMl, // Negative for deduction
      staffId,
      staffName,
      costPerMl: item.costPerContainer / item.containerSizeMl,
      totalCost: (quantityMl * item.costPerContainer) / item.containerSizeMl,
      reason,
      createdAt: new Date().toISOString(),
    };

    // Save transaction
    await barInventoryService.saveTransaction(transaction);
    store.addTransaction(transaction);

    // Update stock in SQLite
    const updatedItem = store.getItemById(itemId);
    if (updatedItem) {
      await barInventoryService.updateStock(
        itemId,
        updatedItem.fullContainers,
        updatedItem.partialContainerMl
      );
    }
  }

  /**
   * Create a simple recipe for a drink
   * Helper function for quick recipe creation
   */
  createSimpleRecipe(
    tenantId: string,
    menuItemId: string,
    drinkName: string,
    ingredients: Array<{
      inventoryItemId: string;
      quantityMl: number;
      quantityUnit?: string;
      isOptional?: boolean;
    }>
  ): BarRecipe {
    return {
      id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      menuItemId,
      drinkName,
      category: 'mixed',
      ingredients: ingredients.map((ing, index) => ({
        id: `ing-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        recipeId: '', // Will be set when recipe is saved
        inventoryItemId: ing.inventoryItemId,
        quantityMl: ing.quantityMl,
        quantityUnit: ing.quantityUnit || 'ml',
        isOptional: ing.isOptional || false,
        sortOrder: index,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get total usage for an item over a date range
   */
  async getTotalUsage(
    itemId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{ totalMl: number; totalCost: number; drinksSold: number }> {
    const transactions = await barInventoryService.getTransactions(tenantId, {
      itemId,
      startDate,
      endDate,
      type: 'sale',
    });

    const totalMl = transactions.reduce((sum, txn) => sum + Math.abs(txn.quantityMl), 0);
    const totalCost = transactions.reduce((sum, txn) => sum + (txn.totalCost || 0), 0);

    // Count unique bar order IDs
    const uniqueOrderIds = new Set(transactions.map((txn) => txn.barOrderId).filter(Boolean));
    const drinksSold = uniqueOrderIds.size;

    return { totalMl, totalCost, drinksSold };
  }

  /**
   * Get most used ingredients (top N)
   */
  async getTopUsedIngredients(
    tenantId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<Array<{ itemId: string; itemName: string; totalMl: number; totalCost: number }>> {
    const transactions = await barInventoryService.getTransactions(tenantId, {
      startDate,
      endDate,
      type: 'sale',
    });

    const store = useBarInventoryStore.getState();
    const usageMap = new Map<string, { totalMl: number; totalCost: number }>();

    transactions.forEach((txn) => {
      const existing = usageMap.get(txn.inventoryItemId) || { totalMl: 0, totalCost: 0 };
      usageMap.set(txn.inventoryItemId, {
        totalMl: existing.totalMl + Math.abs(txn.quantityMl),
        totalCost: existing.totalCost + (txn.totalCost || 0),
      });
    });

    const results = Array.from(usageMap.entries())
      .map(([itemId, usage]) => {
        const item = store.getItemById(itemId);
        return {
          itemId,
          itemName: item?.name || 'Unknown',
          totalMl: usage.totalMl,
          totalCost: usage.totalCost,
        };
      })
      .sort((a, b) => b.totalMl - a.totalMl)
      .slice(0, limit);

    return results;
  }
}

export const barRecipeService = new BarRecipeService();
