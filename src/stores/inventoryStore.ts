/**
 * Inventory Store
 * Manages state for inventory management with AI bill scanning
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  InventoryItem,
  Supplier,
  InventoryDocument,
  RecipeIngredient,
  CreateInventoryItemInput,
  CreateSupplierInput,
  UpdateInventoryItemInput,
  BillScanResult,
  InventorySummary,
  LowStockAlert,
  ExpiryAlert,
  InventoryCategory,
  TransactionType,
  ExtractedItem,
} from '../types/inventory';
import { inventoryService } from '../lib/inventoryService';
import { visionInventoryApi } from '../lib/visionInventoryApi';

interface InventoryStore {
  // State
  items: InventoryItem[];
  suppliers: Supplier[];
  documents: InventoryDocument[];
  summary: InventorySummary | null;
  lowStockAlerts: LowStockAlert[];
  expiryAlerts: ExpiryAlert[];

  // Scan state
  pendingScan: BillScanResult | null;
  scanProcessing: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Filters
  categoryFilter: InventoryCategory | null;
  supplierFilter: string | null;
  searchQuery: string;
  showLowStock: boolean;
  showExpiringSoon: boolean;

  // Actions - Loading
  loadInventory: (tenantId: string) => Promise<void>;
  loadSuppliers: (tenantId: string) => Promise<void>;
  loadSummary: (tenantId: string) => Promise<void>;
  loadAlerts: (tenantId: string) => Promise<void>;
  refreshAll: (tenantId: string) => Promise<void>;

  // Actions - Bill Scanning
  scanBill: (file: File, tenantId: string, documentType?: string) => Promise<BillScanResult>;
  scanBillFromCamera: (base64: string, tenantId: string) => Promise<BillScanResult>;
  confirmScanResults: (
    results: ExtractedItem[],
    supplierId: string | null,
    tenantId: string,
    recordedBy?: string
  ) => Promise<void>;
  clearPendingScan: () => void;

  // Actions - Inventory CRUD
  addItem: (item: CreateInventoryItemInput, tenantId: string) => Promise<InventoryItem>;
  updateItem: (itemId: string, updates: UpdateInventoryItemInput, tenantId: string) => Promise<void>;
  adjustStock: (
    itemId: string,
    quantityChange: number,
    transactionType: TransactionType,
    reason: string,
    tenantId: string,
    recordedBy?: string
  ) => Promise<void>;
  deleteItem: (itemId: string, tenantId: string) => Promise<void>;

  // Actions - Suppliers
  addSupplier: (supplier: CreateSupplierInput, tenantId: string) => Promise<Supplier>;
  updateSupplier: (supplierId: string, updates: Partial<CreateSupplierInput>, tenantId: string) => Promise<void>;
  deleteSupplier: (supplierId: string, tenantId: string) => Promise<void>;

  // Actions - Recipe Ingredients
  getRecipeIngredients: (menuItemId: string, tenantId: string) => Promise<RecipeIngredient[]>;
  addRecipeIngredient: (
    menuItemId: string,
    inventoryItemId: string,
    quantity: number,
    unit: string,
    tenantId: string
  ) => Promise<void>;
  removeRecipeIngredient: (ingredientId: string, tenantId: string) => Promise<void>;

  // Actions - Filters
  setCategoryFilter: (category: InventoryCategory | null) => void;
  setSupplierFilter: (supplierId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setShowLowStock: (show: boolean) => void;
  setShowExpiringSoon: (show: boolean) => void;
  clearFilters: () => void;

  // Computed
  getFilteredItems: () => InventoryItem[];
  getItemsBySupplier: (supplierId: string) => InventoryItem[];
  findItemByName: (name: string) => InventoryItem | undefined;

  // Utilities
  clearError: () => void;
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      suppliers: [],
      documents: [],
      summary: null,
      lowStockAlerts: [],
      expiryAlerts: [],
      pendingScan: null,
      scanProcessing: false,
      isLoading: false,
      error: null,
      categoryFilter: null,
      supplierFilter: null,
      searchQuery: '',
      showLowStock: false,
      showExpiringSoon: false,

      // Loading actions
      loadInventory: async (tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const items = await inventoryService.getInventoryItems(tenantId);
          set({ items, isLoading: false });
        } catch (error) {
          console.error('[InventoryStore] Failed to load inventory:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load inventory',
            isLoading: false,
          });
        }
      },

      loadSuppliers: async (tenantId: string) => {
        try {
          const suppliers = await inventoryService.getSuppliers(tenantId);
          set({ suppliers });
        } catch (error) {
          console.error('[InventoryStore] Failed to load suppliers:', error);
        }
      },

      loadSummary: async (tenantId: string) => {
        try {
          const summary = await inventoryService.getInventorySummary(tenantId);
          set({ summary });
        } catch (error) {
          console.error('[InventoryStore] Failed to load summary:', error);
        }
      },

      loadAlerts: async (tenantId: string) => {
        try {
          const [lowStockAlerts, expiryAlerts] = await Promise.all([
            inventoryService.getLowStockAlerts(tenantId),
            inventoryService.getExpiringSoonAlerts(tenantId, 7),
          ]);
          set({ lowStockAlerts, expiryAlerts });
        } catch (error) {
          console.error('[InventoryStore] Failed to load alerts:', error);
        }
      },

      refreshAll: async (tenantId: string) => {
        set({ isLoading: true });
        try {
          await Promise.all([
            get().loadInventory(tenantId),
            get().loadSuppliers(tenantId),
            get().loadSummary(tenantId),
            get().loadAlerts(tenantId),
          ]);
        } finally {
          set({ isLoading: false });
        }
      },

      // Bill Scanning
      scanBill: async (file: File, tenantId: string, documentType = 'invoice') => {
        set({ scanProcessing: true, error: null });
        try {
          const result = await visionInventoryApi.scanBill(file, tenantId, documentType);
          set({ pendingScan: result, scanProcessing: false });

          // Save document to local DB
          if (result.extractedData) {
            await inventoryService.saveDocument(
              {
                documentType: documentType as any,
                ocrStatus: result.status,
                ocrProvider: result.provider,
                extractedData: result.extractedData,
                totalAmount: result.extractedData.total,
                taxAmount: result.extractedData.tax,
                documentDate: result.extractedData.invoiceDate,
                invoiceNumber: result.extractedData.invoiceNumber,
                processingTimeMs: result.processingTimeMs,
                confidenceScore: result.confidenceScore,
              },
              tenantId
            );
          }

          return result;
        } catch (error) {
          console.error('[InventoryStore] Bill scan failed:', error);
          set({
            error: error instanceof Error ? error.message : 'Bill scan failed',
            scanProcessing: false,
          });
          throw error;
        }
      },

      scanBillFromCamera: async (base64: string, tenantId: string) => {
        set({ scanProcessing: true, error: null });
        try {
          const result = await visionInventoryApi.scanBillFromCamera(base64, tenantId);
          set({ pendingScan: result, scanProcessing: false });

          // Save document to local DB
          if (result.extractedData) {
            await inventoryService.saveDocument(
              {
                documentType: 'camera_capture',
                ocrStatus: result.status,
                ocrProvider: result.provider,
                extractedData: result.extractedData,
                totalAmount: result.extractedData.total,
                taxAmount: result.extractedData.tax,
                processingTimeMs: result.processingTimeMs,
                confidenceScore: result.confidenceScore,
              },
              tenantId
            );
          }

          return result;
        } catch (error) {
          console.error('[InventoryStore] Camera scan failed:', error);
          set({
            error: error instanceof Error ? error.message : 'Camera scan failed',
            scanProcessing: false,
          });
          throw error;
        }
      },

      confirmScanResults: async (
        results: ExtractedItem[],
        supplierId: string | null,
        tenantId: string,
        recordedBy?: string
      ) => {
        set({ isLoading: true, error: null });
        try {
          for (const item of results) {
            if (item.matchedInventoryItemId) {
              // Update existing item stock
              await inventoryService.adjustStock(
                {
                  itemId: item.matchedInventoryItemId,
                  quantityChange: item.quantity,
                  transactionType: 'purchase',
                  reason: 'Bill scan import',
                  unitPrice: item.unitPrice,
                },
                tenantId,
                recordedBy
              );
            } else if (item.isNewItem) {
              // Create new inventory item
              await inventoryService.createInventoryItem(
                {
                  name: item.name,
                  category: 'other', // Default category, user can change
                  currentStock: item.quantity,
                  unit: (item.unit as any) || 'pcs',
                  pricePerUnit: item.unitPrice,
                  supplierId: supplierId || undefined,
                },
                tenantId
              );
            }
          }

          // Refresh data
          await get().refreshAll(tenantId);
          set({ pendingScan: null, isLoading: false });
        } catch (error) {
          console.error('[InventoryStore] Failed to confirm scan results:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to update inventory',
            isLoading: false,
          });
          throw error;
        }
      },

      clearPendingScan: () => {
        set({ pendingScan: null });
      },

      // Inventory CRUD
      addItem: async (item: CreateInventoryItemInput, tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const newItem = await inventoryService.createInventoryItem(item, tenantId);
          set((state) => ({
            items: [...state.items, newItem],
            isLoading: false,
          }));
          await get().loadSummary(tenantId);
          return newItem;
        } catch (error) {
          console.error('[InventoryStore] Failed to add item:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to add item',
            isLoading: false,
          });
          throw error;
        }
      },

      updateItem: async (itemId: string, updates: UpdateInventoryItemInput, tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const updatedItem = await inventoryService.updateInventoryItem(itemId, updates, tenantId);
          if (updatedItem) {
            set((state) => ({
              items: state.items.map((i) => (i.id === itemId ? updatedItem : i)),
              isLoading: false,
            }));
          }
        } catch (error) {
          console.error('[InventoryStore] Failed to update item:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to update item',
            isLoading: false,
          });
          throw error;
        }
      },

      adjustStock: async (
        itemId: string,
        quantityChange: number,
        transactionType: TransactionType,
        reason: string,
        tenantId: string,
        recordedBy?: string
      ) => {
        set({ isLoading: true, error: null });
        try {
          const updatedItem = await inventoryService.adjustStock(
            {
              itemId,
              quantityChange,
              transactionType,
              reason,
            },
            tenantId,
            recordedBy
          );

          if (updatedItem) {
            set((state) => ({
              items: state.items.map((i) => (i.id === itemId ? updatedItem : i)),
              isLoading: false,
            }));
            await get().loadAlerts(tenantId);
          }
        } catch (error) {
          console.error('[InventoryStore] Failed to adjust stock:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to adjust stock',
            isLoading: false,
          });
          throw error;
        }
      },

      deleteItem: async (itemId: string, tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          await inventoryService.deleteInventoryItem(itemId, tenantId);
          set((state) => ({
            items: state.items.filter((i) => i.id !== itemId),
            isLoading: false,
          }));
          await get().loadSummary(tenantId);
        } catch (error) {
          console.error('[InventoryStore] Failed to delete item:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to delete item',
            isLoading: false,
          });
          throw error;
        }
      },

      // Suppliers
      addSupplier: async (supplier: CreateSupplierInput, tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const newSupplier = await inventoryService.createSupplier(supplier, tenantId);
          set((state) => ({
            suppliers: [...state.suppliers, newSupplier],
            isLoading: false,
          }));
          return newSupplier;
        } catch (error) {
          console.error('[InventoryStore] Failed to add supplier:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to add supplier',
            isLoading: false,
          });
          throw error;
        }
      },

      updateSupplier: async (
        supplierId: string,
        updates: Partial<CreateSupplierInput>,
        tenantId: string
      ) => {
        set({ isLoading: true, error: null });
        try {
          const updatedSupplier = await inventoryService.updateSupplier(supplierId, updates, tenantId);
          if (updatedSupplier) {
            set((state) => ({
              suppliers: state.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
              isLoading: false,
            }));
          }
        } catch (error) {
          console.error('[InventoryStore] Failed to update supplier:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to update supplier',
            isLoading: false,
          });
          throw error;
        }
      },

      deleteSupplier: async (supplierId: string, tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          await inventoryService.deleteSupplier(supplierId, tenantId);
          set((state) => ({
            suppliers: state.suppliers.filter((s) => s.id !== supplierId),
            isLoading: false,
          }));
        } catch (error) {
          console.error('[InventoryStore] Failed to delete supplier:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to delete supplier',
            isLoading: false,
          });
          throw error;
        }
      },

      // Recipe Ingredients
      getRecipeIngredients: async (menuItemId: string, tenantId: string) => {
        return await inventoryService.getRecipeIngredients(menuItemId, tenantId);
      },

      addRecipeIngredient: async (
        menuItemId: string,
        inventoryItemId: string,
        quantity: number,
        unit: string,
        tenantId: string
      ) => {
        await inventoryService.addRecipeIngredient(menuItemId, inventoryItemId, quantity, unit, tenantId);
      },

      removeRecipeIngredient: async (ingredientId: string, tenantId: string) => {
        await inventoryService.removeRecipeIngredient(ingredientId, tenantId);
      },

      // Filters
      setCategoryFilter: (category: InventoryCategory | null) => {
        set({ categoryFilter: category });
      },

      setSupplierFilter: (supplierId: string | null) => {
        set({ supplierFilter: supplierId });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setShowLowStock: (show: boolean) => {
        set({ showLowStock: show });
      },

      setShowExpiringSoon: (show: boolean) => {
        set({ showExpiringSoon: show });
      },

      clearFilters: () => {
        set({
          categoryFilter: null,
          supplierFilter: null,
          searchQuery: '',
          showLowStock: false,
          showExpiringSoon: false,
        });
      },

      // Computed
      getFilteredItems: () => {
        const { items, categoryFilter, supplierFilter, searchQuery, showLowStock, showExpiringSoon } =
          get();

        return items.filter((item) => {
          if (categoryFilter && item.category !== categoryFilter) return false;
          if (supplierFilter && item.supplierId !== supplierFilter) return false;
          if (showLowStock && item.currentStock > item.reorderLevel) return false;
          if (showExpiringSoon) {
            if (!item.expiryDate) return false;
            const daysUntil = Math.ceil(
              (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            if (daysUntil > 7) return false;
          }
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              item.name.toLowerCase().includes(query) ||
              (item.sku && item.sku.toLowerCase().includes(query))
            );
          }
          return true;
        });
      },

      getItemsBySupplier: (supplierId: string) => {
        return get().items.filter((item) => item.supplierId === supplierId);
      },

      findItemByName: (name: string) => {
        const normalizedName = name.toLowerCase().trim();
        return get().items.find(
          (item) =>
            item.name.toLowerCase() === normalizedName ||
            item.name.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(item.name.toLowerCase())
        );
      },

      // Utilities
      clearError: () => set({ error: null }),
    }),
    {
      name: 'inventory-storage',
      partialize: (state) => ({
        // Only persist filters, not actual data
        categoryFilter: state.categoryFilter,
        supplierFilter: state.supplierFilter,
        showLowStock: state.showLowStock,
        showExpiringSoon: state.showExpiringSoon,
      }),
    }
  )
);
