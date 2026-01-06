/**
 * Inventory Store
 * Manages state for inventory management using the Vision Inventory API
 *
 * This store uses the web API as the primary source of truth,
 * with local SQLite fallback when API is unavailable.
 * Local changes will sync to D1 when connectivity is restored.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  InventoryItem,
  Supplier,
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
import { visionInventoryApi } from '../lib/visionInventoryApi';
import { inventoryService } from '../lib/inventoryService';

interface InventoryStore {
  // State
  items: InventoryItem[];
  suppliers: Supplier[];
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

  // Actions - Loading (API-first)
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
    recordedBy?: string,
    newSupplier?: { name: string; phone?: string; address?: string },
    documentInfo?: {
      invoiceNumber?: string;
      invoiceDate?: string;
      originalFilename?: string;
      extractedData?: any;
    }
  ) => Promise<void>;
  clearPendingScan: () => void;

  // Actions - Inventory CRUD (via API)
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

  // Actions - Suppliers (via API)
  addSupplier: (supplier: CreateSupplierInput, tenantId: string) => Promise<Supplier>;
  updateSupplier: (supplierId: string, updates: Partial<CreateSupplierInput>, tenantId: string) => Promise<void>;
  deleteSupplier: (supplierId: string, tenantId: string) => Promise<void>;

  // Actions - Recipe Ingredients (via API)
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

      // Loading actions - API-first approach
      loadInventory: async (tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await visionInventoryApi.getInventoryItems(tenantId, { limit: 1000 });
          // Map API response to local item format
          const items = (response.items || []).map(mapApiItemToLocal);
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
          const response = await visionInventoryApi.getSuppliers(tenantId);
          // Handle both response formats
          const suppliers = (response as any).items || response.suppliers || [];
          set({ suppliers: suppliers.map(mapApiSupplierToLocal) });
        } catch (error) {
          console.error('[InventoryStore] Failed to load suppliers:', error);
        }
      },

      loadSummary: async (tenantId: string) => {
        try {
          const summary = await visionInventoryApi.getInventorySummary(tenantId);
          set({ summary: mapApiSummaryToLocal(summary) });
        } catch (error) {
          console.error('[InventoryStore] Failed to load summary:', error);
          // Calculate from local items as fallback
          const items = get().items;
          set({
            summary: {
              totalItems: items.length,
              totalValue: items.reduce((sum, item) => sum + (item.currentStock * (item.pricePerUnit || 0)), 0),
              lowStockCount: items.filter(i => i.currentStock <= i.reorderLevel).length,
              expiringSoonCount: items.filter(i => {
                if (!i.expiryDate) return false;
                const daysUntil = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return daysUntil <= 7;
              }).length,
              categoryBreakdown: {},
            },
          });
        }
      },

      loadAlerts: async (tenantId: string) => {
        try {
          const [lowStockResponse, expiryResponse] = await Promise.all([
            visionInventoryApi.getLowStockAlerts(tenantId).catch(() => []),
            visionInventoryApi.getExpiringSoonAlerts(tenantId, 7).catch(() => []),
          ]);

          // Map to alert format
          const lowStockAlerts: LowStockAlert[] = (lowStockResponse || []).map((item: any) => ({
            itemId: item.id,
            itemName: item.name,
            currentStock: item.quantity || item.currentStock,
            reorderLevel: item.reorder_level || item.reorderLevel,
            unit: item.unit,
          }));

          const expiryAlerts: ExpiryAlert[] = (expiryResponse || []).map((item: any) => ({
            itemId: item.id,
            itemName: item.name,
            expiryDate: item.expiry_date || item.expiryDate,
            currentStock: item.quantity || item.currentStock,
            unit: item.unit,
            daysUntilExpiry: Math.ceil(
              (new Date(item.expiry_date || item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ),
          }));

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

      // Bill Scanning - uses API
      scanBill: async (file: File, tenantId: string, documentType = 'invoice') => {
        set({ scanProcessing: true, error: null });
        try {
          const result = await visionInventoryApi.scanBill(file, tenantId, documentType);
          set({ pendingScan: result, scanProcessing: false });
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
        _recordedBy?: string,
        newSupplier?: { name: string; phone?: string; address?: string },
        documentInfo?: {
          invoiceNumber?: string;
          invoiceDate?: string;
          originalFilename?: string;
          extractedData?: any;
        }
      ) => {
        set({ isLoading: true, error: null });

        let successCount = 0;
        let localFallbackCount = 0;
        const errors: string[] = [];
        let finalSupplierId = supplierId;

        // If new supplier data is provided, create the supplier first
        if (newSupplier && newSupplier.name) {
          try {
            console.log('[InventoryStore] Creating new supplier:', newSupplier.name);
            const createdSupplier = await visionInventoryApi.createSupplier({
              name: newSupplier.name,
              phone: newSupplier.phone,
              email: undefined,
              address: newSupplier.address,
            }, tenantId);
            finalSupplierId = createdSupplier.id;
            console.log('[InventoryStore] Created supplier with ID:', finalSupplierId);
          } catch (supplierError) {
            console.error('[InventoryStore] Failed to create supplier:', supplierError);
            // Continue without supplier - items will still be saved
            errors.push(`Supplier creation failed: ${supplierError instanceof Error ? supplierError.message : 'Unknown error'}`);
          }
        }

        // Create document record for tracking the invoice/bill
        let documentId: string | null = null;
        try {
          console.log('[InventoryStore] Creating document record for invoice tracking...');
          const document = await visionInventoryApi.createDocument({
            type: 'invoice',
            invoiceNumber: documentInfo?.invoiceNumber,
            invoiceDate: documentInfo?.invoiceDate,
            supplierId: finalSupplierId || undefined,
            originalFilename: documentInfo?.originalFilename,
            ocrProvider: 'gemini',
            extractedData: documentInfo?.extractedData || { items: results },
          }, tenantId);
          documentId = document?.id;
          console.log('[InventoryStore] Created document with ID:', documentId);
        } catch (docError) {
          console.error('[InventoryStore] Failed to create document record:', docError);
          // Continue without document - items will still be saved
          errors.push(`Document creation failed: ${docError instanceof Error ? docError.message : 'Unknown error'}`);
        }

        // Helper to try API first, then fallback to local
        const processItem = async (item: ExtractedItem): Promise<boolean> => {
          const itemInput: CreateInventoryItemInput = {
            name: item.name,
            category: 'other',
            currentStock: item.quantity,
            unit: (item.unit as any) || 'pcs',
            pricePerUnit: item.unitPrice,
            supplierId: finalSupplierId || undefined,
          };

          // Try API first
          try {
            if (item.matchedInventoryItemId) {
              await visionInventoryApi.adjustInventoryQuantity(
                item.matchedInventoryItemId,
                item.quantity,
                'Bill scan import',
                tenantId
              );
            } else if (item.isNewItem && item.name) {
              await visionInventoryApi.createInventoryItem(itemInput, tenantId);
            }
            return true;
          } catch (apiError) {
            console.warn(`[InventoryStore] API failed for "${item.name}", trying local storage...`, apiError);

            // Fallback to local SQLite
            try {
              if (item.matchedInventoryItemId) {
                // Adjust local stock
                await inventoryService.adjustStock(
                  {
                    itemId: item.matchedInventoryItemId,
                    quantityChange: item.quantity,
                    transactionType: 'purchase',
                    reason: 'Bill scan import (offline)',
                    unitPrice: item.unitPrice,
                  },
                  tenantId
                );
              } else if (item.isNewItem && item.name) {
                // Create locally
                await inventoryService.createInventoryItem(itemInput, tenantId);
              }
              localFallbackCount++;
              console.log(`[InventoryStore] Saved "${item.name}" to local storage`);
              return true;
            } catch (localError) {
              console.error(`[InventoryStore] Local fallback also failed for "${item.name}":`, localError);
              throw localError;
            }
          }
        };

        try {
          for (const item of results) {
            if (!item.name) continue; // Skip empty items

            try {
              const success = await processItem(item);
              if (success) successCount++;
            } catch (itemError) {
              console.error(`[InventoryStore] Failed to process item "${item.name}":`, itemError);
              errors.push(`${item.name}: ${itemError instanceof Error ? itemError.message : 'Failed'}`);
            }
          }

          // If all items failed, throw error
          if (successCount === 0 && errors.length > 0) {
            throw new Error(`Failed to save items: ${errors.join('; ')}`);
          }

          // Refresh data - try API first, then local
          try {
            await get().refreshAll(tenantId);
          } catch (refreshError) {
            console.warn('[InventoryStore] Failed to refresh from API, loading local data...');
            try {
              const localItems = await inventoryService.getInventoryItems(tenantId);
              set({ items: localItems });
            } catch (localRefreshError) {
              console.warn('[InventoryStore] Failed to refresh local data:', localRefreshError);
            }
          }

          set({ pendingScan: null, isLoading: false });

          // Build success message
          let message = '';
          if (localFallbackCount > 0) {
            message = `Saved ${successCount} items (${localFallbackCount} saved locally - will sync later)`;
          } else if (errors.length > 0) {
            message = `Saved ${successCount} items, but ${errors.length} failed`;
          }

          if (message) {
            set({ error: message });
          }
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

      // Inventory CRUD - via API
      addItem: async (item: CreateInventoryItemInput, tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          // Map local format to API format
          const apiItem = mapLocalItemToApi(item);
          const response = await visionInventoryApi.createInventoryItem(apiItem as any, tenantId);
          const newItem = mapApiItemToLocal(response);

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
          const apiUpdates = mapLocalUpdatesToApi(updates);
          const response = await visionInventoryApi.updateInventoryItem(itemId, apiUpdates as any, tenantId);
          const updatedItem = mapApiItemToLocal(response);

          set((state) => ({
            items: state.items.map((i) => (i.id === itemId ? updatedItem : i)),
            isLoading: false,
          }));
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
        _transactionType: TransactionType,
        reason: string,
        tenantId: string,
        _recordedBy?: string
      ) => {
        set({ isLoading: true, error: null });
        try {
          const response = await visionInventoryApi.adjustInventoryQuantity(
            itemId,
            quantityChange,
            reason,
            tenantId
          );
          const updatedItem = mapApiItemToLocal(response);

          set((state) => ({
            items: state.items.map((i) => (i.id === itemId ? updatedItem : i)),
            isLoading: false,
          }));
          await get().loadAlerts(tenantId);
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
          await visionInventoryApi.deleteInventoryItem(itemId, tenantId);
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

      // Suppliers - via API
      addSupplier: async (supplier: CreateSupplierInput, tenantId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await visionInventoryApi.createSupplier(supplier, tenantId);
          const newSupplier = mapApiSupplierToLocal(response);

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
          const response = await visionInventoryApi.updateSupplier(supplierId, updates, tenantId);
          const updatedSupplier = mapApiSupplierToLocal(response);

          set((state) => ({
            suppliers: state.suppliers.map((s) => (s.id === supplierId ? updatedSupplier : s)),
            isLoading: false,
          }));
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
          await visionInventoryApi.deleteSupplier(supplierId, tenantId);
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

      // Recipe Ingredients - via API
      getRecipeIngredients: async (menuItemId: string, tenantId: string) => {
        try {
          const response = await visionInventoryApi.getRecipeIngredients(menuItemId, tenantId);
          return (response.ingredients || []).map((ing: any) => ({
            id: ing.id,
            menuItemId,
            inventoryItemId: ing.inventory_item_id,
            quantity: ing.quantity,
            unit: ing.unit,
            itemName: ing.item_name,
            pricePerUnit: ing.price_per_unit,
          }));
        } catch (error) {
          console.error('[InventoryStore] Failed to get recipe ingredients:', error);
          return [];
        }
      },

      addRecipeIngredient: async (
        menuItemId: string,
        inventoryItemId: string,
        quantity: number,
        unit: string,
        tenantId: string
      ) => {
        // This would typically update an existing recipe or create a new one
        // For now, we'll use the saveRecipe endpoint
        const item = get().items.find(i => i.id === inventoryItemId);
        const itemName = item?.name || 'Unknown Item';

        await visionInventoryApi.saveRecipe(
          menuItemId,
          itemName,
          [{ inventoryItemId, quantity, unit }],
          tenantId
        );
      },

      removeRecipeIngredient: async (ingredientId: string, tenantId: string) => {
        // Note: The API may need a specific endpoint for this
        // For now, we'll delete the entire recipe
        await visionInventoryApi.deleteRecipe(ingredientId, tenantId);
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
        // Only persist filters, not actual data (data comes from API)
        categoryFilter: state.categoryFilter,
        supplierFilter: state.supplierFilter,
        showLowStock: state.showLowStock,
        showExpiringSoon: state.showExpiringSoon,
      }),
    }
  )
);

// ==================== Helper Functions ====================

/**
 * Map API inventory item to local format
 */
function mapApiItemToLocal(apiItem: any): InventoryItem {
  return {
    id: apiItem.id,
    name: apiItem.name,
    category: apiItem.category || 'other',
    currentStock: apiItem.quantity ?? apiItem.currentStock ?? 0,
    unit: apiItem.unit || 'pcs',
    pricePerUnit: apiItem.price_per_unit ?? apiItem.pricePerUnit,
    reorderLevel: apiItem.reorder_level ?? apiItem.reorderLevel ?? 0,
    expiryDate: apiItem.expiry_date ?? apiItem.expiryDate,
    supplierId: apiItem.supplier_id ?? apiItem.supplierId,
    sku: apiItem.sku,
    storageLocation: apiItem.storage_location ?? apiItem.storageLocation,
    notes: apiItem.notes,
    createdAt: apiItem.created_at ?? apiItem.createdAt,
    updatedAt: apiItem.updated_at ?? apiItem.updatedAt,
  };
}

/**
 * Map local inventory item to API format
 */
function mapLocalItemToApi(localItem: CreateInventoryItemInput): any {
  return {
    name: localItem.name,
    category: localItem.category,
    quantity: localItem.currentStock,
    unit: localItem.unit,
    price_per_unit: localItem.pricePerUnit,
    reorder_level: localItem.reorderLevel,
    expiry_date: localItem.expiryDate,
    supplier_id: localItem.supplierId,
    storage_location: localItem.storageLocation,
    notes: localItem.notes,
  };
}

/**
 * Map local updates to API format
 */
function mapLocalUpdatesToApi(updates: UpdateInventoryItemInput): any {
  const apiUpdates: any = {};

  if (updates.name !== undefined) apiUpdates.name = updates.name;
  if (updates.category !== undefined) apiUpdates.category = updates.category;
  if (updates.currentStock !== undefined) apiUpdates.quantity = updates.currentStock;
  if (updates.unit !== undefined) apiUpdates.unit = updates.unit;
  if (updates.pricePerUnit !== undefined) apiUpdates.price_per_unit = updates.pricePerUnit;
  if (updates.reorderLevel !== undefined) apiUpdates.reorder_level = updates.reorderLevel;
  if (updates.expiryDate !== undefined) apiUpdates.expiry_date = updates.expiryDate;
  if (updates.supplierId !== undefined) apiUpdates.supplier_id = updates.supplierId;
  if (updates.storageLocation !== undefined) apiUpdates.storage_location = updates.storageLocation;
  if (updates.notes !== undefined) apiUpdates.notes = updates.notes;

  return apiUpdates;
}

/**
 * Map API supplier to local format
 */
function mapApiSupplierToLocal(apiSupplier: any): Supplier {
  return {
    id: apiSupplier.id,
    name: apiSupplier.name,
    contactName: apiSupplier.contact_name ?? apiSupplier.contactName,
    email: apiSupplier.email,
    phone: apiSupplier.phone,
    address: apiSupplier.address,
    notes: apiSupplier.notes,
    // Enhanced fields
    gstin: apiSupplier.gstin,
    taxId: apiSupplier.tax_id ?? apiSupplier.taxId,
    paymentTerms: apiSupplier.payment_terms ?? apiSupplier.paymentTerms,
    currency: apiSupplier.currency || 'INR',
    bankName: apiSupplier.bank_name ?? apiSupplier.bankName,
    bankAccount: apiSupplier.bank_account ?? apiSupplier.bankAccount,
    bankIfsc: apiSupplier.bank_ifsc ?? apiSupplier.bankIfsc,
    upiId: apiSupplier.upi_id ?? apiSupplier.upiId,
    website: apiSupplier.website,
    category: apiSupplier.category,
    isVerified: apiSupplier.is_verified ?? apiSupplier.isVerified ?? false,
    totalOrders: apiSupplier.total_orders ?? apiSupplier.totalOrders ?? 0,
    totalSpent: apiSupplier.total_spent ?? apiSupplier.totalSpent ?? 0,
    rating: apiSupplier.rating,
    createdAt: apiSupplier.created_at ?? apiSupplier.createdAt,
    updatedAt: apiSupplier.updated_at ?? apiSupplier.updatedAt,
  };
}

/**
 * Map API summary to local format
 */
function mapApiSummaryToLocal(apiSummary: any): InventorySummary {
  return {
    totalItems: apiSummary.totalItems ?? apiSummary.total_items ?? 0,
    totalValue: apiSummary.totalValue ?? apiSummary.total_value ?? 0,
    lowStockCount: apiSummary.lowStockCount ?? apiSummary.low_stock_count ?? 0,
    expiringSoonCount: apiSummary.expiringSoonCount ?? apiSummary.expiring_soon_count ?? 0,
    categoryBreakdown: apiSummary.categoryBreakdown ?? apiSummary.category_breakdown ?? {},
  };
}
