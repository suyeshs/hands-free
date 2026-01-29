/**
 * Bar Inventory Store
 * Manages bottle-level inventory tracking, recipes, transactions, and closing sessions
 * Supports both bottle-level and pour-level tracking modes
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BarInventoryItem,
  BarRecipe,
  BarInventoryTransaction,
  BarClosingSession,
  BarClosingCount,
  BarInventoryCategory,
  TransactionType,
} from '../types/bar';

interface BarInventorySettings {
  trackingMode: 'bottle' | 'pour';
  autoDeductOnOrder: boolean;
  requirePourConfirmation: boolean;
  lowStockThreshold: number; // Percentage of par level
  enableAutoReorder: boolean;
}

interface BarInventoryStore {
  // Inventory items
  items: BarInventoryItem[];
  recipes: BarRecipe[];
  transactions: BarInventoryTransaction[];
  closingSessions: BarClosingSession[];
  currentClosingSession: BarClosingSession | null;

  // Settings
  settings: BarInventorySettings;

  // Actions - Inventory Items
  setItems: (items: BarInventoryItem[]) => void;
  addItem: (item: BarInventoryItem) => void;
  updateItem: (itemId: string, updates: Partial<BarInventoryItem>) => void;
  deleteItem: (itemId: string) => void;
  getItemById: (itemId: string) => BarInventoryItem | undefined;
  getItemsByCategory: (category: BarInventoryCategory) => BarInventoryItem[];
  getLowStockItems: () => BarInventoryItem[];

  // Actions - Stock Management
  addBottle: (itemId: string, quantity: number) => void;
  removeBottle: (itemId: string, quantity: number) => void;
  updatePartialBottle: (itemId: string, ml: number) => void;
  deductMl: (itemId: string, ml: number) => void;
  restockItem: (itemId: string, fullBottles: number, staffId?: string, notes?: string) => void;

  // Actions - Recipes
  setRecipes: (recipes: BarRecipe[]) => void;
  addRecipe: (recipe: BarRecipe) => void;
  updateRecipe: (recipeId: string, updates: Partial<BarRecipe>) => void;
  deleteRecipe: (recipeId: string) => void;
  getRecipeByMenuItemId: (menuItemId: string) => BarRecipe | undefined;

  // Actions - Transactions
  setTransactions: (transactions: BarInventoryTransaction[]) => void;
  addTransaction: (transaction: BarInventoryTransaction) => void;
  getTransactionsByItem: (itemId: string) => BarInventoryTransaction[];
  getTransactionsByType: (type: TransactionType) => BarInventoryTransaction[];

  // Actions - Closing Sessions
  setClosingSessions: (sessions: BarClosingSession[]) => void;
  startClosingSession: (session: BarClosingSession) => void;
  updateClosingSession: (sessionId: string, updates: Partial<BarClosingSession>) => void;
  endClosingSession: (sessionId: string) => void;
  addClosingCount: (sessionId: string, count: BarClosingCount) => void;
  getCurrentClosingSession: () => BarClosingSession | null;

  // Actions - Settings
  updateSettings: (updates: Partial<BarInventorySettings>) => void;

  // Actions - Helpers
  calculateTotalMl: (item: BarInventoryItem) => number;
  calculateItemCost: (item: BarInventoryItem) => number;
  calculatePourCost: (recipeId: string) => number;
}

const DEFAULT_SETTINGS: BarInventorySettings = {
  trackingMode: 'bottle',
  autoDeductOnOrder: true,
  requirePourConfirmation: false,
  lowStockThreshold: 25, // 25% of par level
  enableAutoReorder: false,
};

export const useBarInventoryStore = create<BarInventoryStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      recipes: [],
      transactions: [],
      closingSessions: [],
      currentClosingSession: null,
      settings: DEFAULT_SETTINGS,

      // Inventory Items
      setItems: (items) => set({ items }),

      addItem: (item) => {
        set((state) => ({
          items: [...state.items, item],
        }));
      },

      updateItem: (itemId, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
          ),
        }));
      },

      deleteItem: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        }));
      },

      getItemById: (itemId) => {
        return get().items.find((item) => item.id === itemId);
      },

      getItemsByCategory: (category) => {
        return get().items.filter((item) => item.category === category);
      },

      getLowStockItems: () => {
        const state = get();
        return state.items.filter((item) => {
          const totalMl = state.calculateTotalMl(item);
          const parMl = item.parLevel * item.containerSizeMl;
          const threshold = parMl * (state.settings.lowStockThreshold / 100);
          return totalMl < threshold;
        });
      },

      // Stock Management
      addBottle: (itemId, quantity) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  fullContainers: item.fullContainers + quantity,
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }));
      },

      removeBottle: (itemId, quantity) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  fullContainers: Math.max(0, item.fullContainers - quantity),
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }));
      },

      updatePartialBottle: (itemId, ml) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  partialContainerMl: ml,
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }));
      },

      deductMl: (itemId, ml) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== itemId) return item;

            let remainingMl = ml;
            let partialMl = item.partialContainerMl;
            let fullBottles = item.fullContainers;

            // First deduct from partial bottle
            if (partialMl >= remainingMl) {
              partialMl -= remainingMl;
              remainingMl = 0;
            } else {
              remainingMl -= partialMl;
              partialMl = 0;
            }

            // If still need to deduct, open a full bottle
            while (remainingMl > 0 && fullBottles > 0) {
              fullBottles--;
              const bottleMl = item.containerSizeMl;
              if (bottleMl >= remainingMl) {
                partialMl = bottleMl - remainingMl;
                remainingMl = 0;
              } else {
                remainingMl -= bottleMl;
              }
            }

            return {
              ...item,
              fullContainers: fullBottles,
              partialContainerMl: partialMl,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      restockItem: (itemId, fullBottles, staffId, notes) => {
        const item = get().getItemById(itemId);
        if (!item) return;

        // Add bottles
        get().addBottle(itemId, fullBottles);

        // Create restock transaction
        const transaction: BarInventoryTransaction = {
          id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenantId: item.tenantId,
          inventoryItemId: itemId,
          transactionType: 'restock',
          quantityMl: fullBottles * item.containerSizeMl,
          staffId,
          costPerMl: item.costPerContainer / item.containerSizeMl,
          totalCost: fullBottles * item.costPerContainer,
          notes,
          createdAt: new Date().toISOString(),
        };

        get().addTransaction(transaction);

        // Update last restocked time
        get().updateItem(itemId, { lastRestockedAt: new Date().toISOString() });
      },

      // Recipes
      setRecipes: (recipes) => set({ recipes }),

      addRecipe: (recipe) => {
        set((state) => ({
          recipes: [...state.recipes, recipe],
        }));
      },

      updateRecipe: (recipeId, updates) => {
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === recipeId ? { ...recipe, ...updates, updatedAt: new Date().toISOString() } : recipe
          ),
        }));
      },

      deleteRecipe: (recipeId) => {
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== recipeId),
        }));
      },

      getRecipeByMenuItemId: (menuItemId) => {
        return get().recipes.find((recipe) => recipe.menuItemId === menuItemId);
      },

      // Transactions
      setTransactions: (transactions) => set({ transactions }),

      addTransaction: (transaction) => {
        set((state) => ({
          transactions: [...state.transactions, transaction],
        }));
      },

      getTransactionsByItem: (itemId) => {
        return get().transactions.filter((txn) => txn.inventoryItemId === itemId);
      },

      getTransactionsByType: (type) => {
        return get().transactions.filter((txn) => txn.transactionType === type);
      },

      // Closing Sessions
      setClosingSessions: (sessions) => set({ closingSessions: sessions }),

      startClosingSession: (session) => {
        set({ currentClosingSession: session, closingSessions: [...get().closingSessions, session] });
      },

      updateClosingSession: (sessionId, updates) => {
        set((state) => ({
          closingSessions: state.closingSessions.map((session) =>
            session.id === sessionId ? { ...session, ...updates, updatedAt: new Date().toISOString() } : session
          ),
          currentClosingSession:
            state.currentClosingSession?.id === sessionId
              ? { ...state.currentClosingSession, ...updates, updatedAt: new Date().toISOString() }
              : state.currentClosingSession,
        }));
      },

      endClosingSession: (sessionId) => {
        set((state) => ({
          closingSessions: state.closingSessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  status: 'closed' as const,
                  closedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
          currentClosingSession: state.currentClosingSession?.id === sessionId ? null : state.currentClosingSession,
        }));
      },

      addClosingCount: (sessionId, count) => {
        set((state) => ({
          closingSessions: state.closingSessions.map((session) => {
            if (session.id !== sessionId) return session;

            const counts = session.counts || [];
            return {
              ...session,
              counts: [...counts, count],
              itemsCounted: counts.length + 1,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      getCurrentClosingSession: () => {
        return get().currentClosingSession;
      },

      // Settings
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      // Helpers
      calculateTotalMl: (item) => {
        return item.fullContainers * item.containerSizeMl + item.partialContainerMl;
      },

      calculateItemCost: (item) => {
        const totalBottles = item.fullContainers + item.partialContainerMl / item.containerSizeMl;
        return totalBottles * item.costPerContainer;
      },

      calculatePourCost: (recipeId) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return 0;

        return recipe.ingredients.reduce((total, ingredient) => {
          const item = get().getItemById(ingredient.inventoryItemId);
          if (!item) return total;

          const costPerMl = item.costPerContainer / item.containerSizeMl;
          return total + ingredient.quantityMl * costPerMl;
        }, 0);
      },
    }),
    {
      name: 'bar-inventory-storage',
      partialize: (state) => ({
        settings: state.settings,
        // Don't persist full inventory data - it will be loaded from SQLite
      }),
    }
  )
);
