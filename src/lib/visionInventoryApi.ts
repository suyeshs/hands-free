/**
 * Vision Inventory API Client
 * Communicates with the restaurant worker's inventory endpoints
 * for AI-powered bill scanning and inventory management
 */

import {
  BillScanResult,
  ExtractedDocumentData,
  InventoryItem,
  Supplier,
  CreateInventoryItemInput,
  CreateSupplierInput,
  UpdateInventoryItemInput,
  InventoryCategory,
} from '../types/inventory';

// Base URL is dynamically set per tenant - inventory APIs go through tenant subdomain proxy
// This ensures proper tenant isolation and CORS handling
const getInventoryApiUrl = (tenantId: string) => `https://${tenantId}.handsfree.tech`;

interface DocumentUploadResponse {
  id: string;
  status: string;
  extractedData?: ExtractedDocumentData;
  processingTimeMs?: number;
  confidence?: number;
  provider?: string;
}

interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
}

interface SupplierListResponse {
  suppliers: Supplier[];
  total: number;
}

class VisionInventoryApi {
  /**
   * Get the base URL for a tenant's inventory APIs
   */
  private getBaseUrl(tenantId: string): string {
    return getInventoryApiUrl(tenantId);
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(tenantId: string): HeadersInit {
    return {
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make API request with error handling
   */
  private async request<T>(
    endpoint: string,
    tenantId: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl(tenantId)}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(tenantId),
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[VisionInventoryApi] Request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // ==================== DOCUMENT SCANNING ====================

  /**
   * Scan a bill/invoice using AI OCR (fast 3-tier processing)
   * Supports: invoice, bill, receipt, handwritten_note, camera_capture
   */
  async scanBill(file: File, tenantId: string, documentType: string = 'invoice'): Promise<BillScanResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);

    // Use tenant subdomain for document scanning - routes through handsfree-proxy to vision-inventory
    const url = `https://${tenantId}.handsfree.tech/api/documents/scan`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Tenant-ID': tenantId,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data: DocumentUploadResponse = await response.json();

      return {
        documentId: data.id,
        status: data.status as BillScanResult['status'],
        provider: data.provider as BillScanResult['provider'],
        processingTimeMs: data.processingTimeMs,
        extractedData: data.extractedData,
        confidenceScore: data.confidence,
      };
    } catch (error) {
      console.error('[VisionInventoryApi] Bill scan failed:', error);
      throw error;
    }
  }

  /**
   * Scan bill from camera capture (base64 image)
   */
  async scanBillFromCamera(
    base64Image: string,
    tenantId: string,
    documentType: string = 'camera_capture'
  ): Promise<BillScanResult> {
    // Use tenant subdomain for document scanning - routes through handsfree-proxy to vision-inventory
    const url = `https://${tenantId}.handsfree.tech/api/documents/process`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          type: documentType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Processing failed: ${response.status}`);
      }

      const data: DocumentUploadResponse = await response.json();

      return {
        documentId: data.id,
        status: data.status as BillScanResult['status'],
        provider: data.provider as BillScanResult['provider'],
        processingTimeMs: data.processingTimeMs,
        extractedData: data.extractedData,
        confidenceScore: data.confidence,
      };
    } catch (error) {
      console.error('[VisionInventoryApi] Camera scan failed:', error);
      throw error;
    }
  }

  /**
   * Get document processing status
   */
  async getDocumentStatus(documentId: string, tenantId: string): Promise<BillScanResult> {
    const data = await this.request<DocumentUploadResponse>(
      `/api/documents/${documentId}`,
      tenantId
    );

    return {
      documentId: data.id,
      status: data.status as BillScanResult['status'],
      provider: data.provider as BillScanResult['provider'],
      processingTimeMs: data.processingTimeMs,
      extractedData: data.extractedData,
      confidenceScore: data.confidence,
    };
  }

  /**
   * Reprocess a failed document
   */
  async reprocessDocument(documentId: string, tenantId: string): Promise<BillScanResult> {
    const data = await this.request<DocumentUploadResponse>(
      `/api/documents/${documentId}/reprocess`,
      tenantId,
      { method: 'POST' }
    );

    return {
      documentId: data.id,
      status: data.status as BillScanResult['status'],
      provider: data.provider as BillScanResult['provider'],
      processingTimeMs: data.processingTimeMs,
      extractedData: data.extractedData,
      confidenceScore: data.confidence,
    };
  }

  // ==================== INVENTORY ITEMS ====================

  /**
   * Get all inventory items
   */
  async getInventoryItems(
    tenantId: string,
    options?: {
      category?: InventoryCategory;
      supplierId?: string;
      lowStock?: boolean;
      expiringSoon?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<InventoryListResponse> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.supplierId) params.append('supplierId', options.supplierId);
    if (options?.lowStock) params.append('lowStock', 'true');
    if (options?.expiringSoon) params.append('expiringSoon', 'true');
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.page) params.append('offset', ((options.page - 1) * (options.limit || 50)).toString());

    const queryString = params.toString();
    const endpoint = `/api/inventory${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<{ success: boolean; items: InventoryItem[]; total: number }>(endpoint, tenantId);
    return {
      items: response.items || [],
      total: response.total || 0,
      page: options?.page || 1,
      limit: options?.limit || 50,
    };
  }

  /**
   * Get single inventory item
   */
  async getInventoryItem(itemId: string, tenantId: string): Promise<InventoryItem> {
    const response = await this.request<{ success: boolean; item: InventoryItem }>(
      `/api/inventory/${itemId}`,
      tenantId
    );
    return response.item;
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(
    item: CreateInventoryItemInput,
    tenantId: string
  ): Promise<InventoryItem> {
    // Map client field names to API field names
    const apiItem = {
      name: item.name,
      quantity: item.currentStock ?? 0,  // API expects 'quantity', client uses 'currentStock'
      unit: item.unit || 'pcs',
      category: item.category || 'other',
      supplier_id: item.supplierId,
      price_per_unit: item.pricePerUnit,
      reorder_level: item.reorderLevel ?? 0,
      expiry_date: item.expiryDate,
      storage_location: item.storageLocation,
      notes: item.notes,
    };

    const response = await this.request<{ success: boolean; item: InventoryItem }>(
      '/api/inventory',
      tenantId,
      {
        method: 'POST',
        body: JSON.stringify(apiItem),
      }
    );
    return response.item;
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(
    itemId: string,
    updates: UpdateInventoryItemInput,
    tenantId: string
  ): Promise<InventoryItem> {
    // Map client field names to API field names
    const apiUpdates: Record<string, any> = {};
    if (updates.name !== undefined) apiUpdates.name = updates.name;
    if (updates.currentStock !== undefined) apiUpdates.quantity = updates.currentStock;
    if (updates.unit !== undefined) apiUpdates.unit = updates.unit;
    if (updates.category !== undefined) apiUpdates.category = updates.category;
    if (updates.supplierId !== undefined) apiUpdates.supplier_id = updates.supplierId;
    if (updates.pricePerUnit !== undefined) apiUpdates.price_per_unit = updates.pricePerUnit;
    if (updates.reorderLevel !== undefined) apiUpdates.reorder_level = updates.reorderLevel;
    if (updates.expiryDate !== undefined) apiUpdates.expiry_date = updates.expiryDate;
    if (updates.storageLocation !== undefined) apiUpdates.storage_location = updates.storageLocation;
    if (updates.notes !== undefined) apiUpdates.notes = updates.notes;

    const response = await this.request<{ success: boolean; item: InventoryItem }>(
      `/api/inventory/${itemId}`,
      tenantId,
      {
        method: 'PUT',
        body: JSON.stringify(apiUpdates),
      }
    );
    return response.item;
  }

  /**
   * Adjust inventory quantity via transaction
   */
  async adjustInventoryQuantity(
    itemId: string,
    quantityChange: number,
    reason: string,
    tenantId: string
  ): Promise<InventoryItem> {
    // Create a transaction to adjust quantity
    await this.request<{ success: boolean; transaction: any }>(
      '/api/inventory/transactions',
      tenantId,
      {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          transactionType: 'adjust',
          quantityChange,
          reason,
        }),
      }
    );
    // Return updated item
    return this.getInventoryItem(itemId, tenantId);
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(itemId: string, tenantId: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/inventory/${itemId}`, tenantId, {
      method: 'DELETE',
    });
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(tenantId: string): Promise<any[]> {
    const data = await this.request<{ success: boolean; alerts: any[] }>(
      '/api/inventory/alerts/low-stock',
      tenantId
    );
    return data.alerts || [];
  }

  /**
   * Get expiring soon alerts
   */
  async getExpiringSoonAlerts(tenantId: string, days: number = 7): Promise<any[]> {
    const data = await this.request<{ success: boolean; alerts: any[] }>(
      `/api/inventory/alerts/expiring?days=${days}`,
      tenantId
    );
    return data.alerts || [];
  }

  // ==================== SUPPLIERS ====================

  /**
   * Get all suppliers
   */
  async getSuppliers(tenantId: string, search?: string): Promise<SupplierListResponse> {
    const endpoint = search
      ? `/api/inventory/suppliers?search=${encodeURIComponent(search)}`
      : '/api/inventory/suppliers';
    const response = await this.request<{ success: boolean; suppliers: Supplier[] }>(endpoint, tenantId);
    return {
      suppliers: response.suppliers || [],
      total: response.suppliers?.length || 0,
    };
  }

  /**
   * Get single supplier
   */
  async getSupplier(supplierId: string, tenantId: string): Promise<Supplier> {
    const response = await this.request<{ success: boolean; supplier: Supplier }>(
      `/api/inventory/suppliers/${supplierId}`,
      tenantId
    );
    return response.supplier;
  }

  /**
   * Create new supplier
   */
  async createSupplier(supplier: CreateSupplierInput, tenantId: string): Promise<Supplier> {
    const response = await this.request<{ success: boolean; supplier: Supplier }>(
      '/api/inventory/suppliers',
      tenantId,
      {
        method: 'POST',
        body: JSON.stringify(supplier),
      }
    );
    return response.supplier;
  }

  /**
   * Update supplier
   */
  async updateSupplier(
    supplierId: string,
    updates: Partial<CreateSupplierInput>,
    tenantId: string
  ): Promise<Supplier> {
    const response = await this.request<{ success: boolean; supplier: Supplier }>(
      `/api/inventory/suppliers/${supplierId}`,
      tenantId,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
    return response.supplier;
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(supplierId: string, tenantId: string): Promise<void> {
    await this.request<void>(`/api/inventory/suppliers/${supplierId}`, tenantId, {
      method: 'DELETE',
    });
  }

  /**
   * Get items from a supplier
   */
  async getSupplierItems(supplierId: string, tenantId: string): Promise<InventoryItem[]> {
    const response = await this.request<{ success: boolean; items: InventoryItem[]; total: number }>(
      `/api/inventory?supplierId=${supplierId}`,
      tenantId
    );
    return response.items || [];
  }

  // ==================== INVENTORY SUMMARY ====================

  /**
   * Get inventory summary statistics
   */
  async getInventorySummary(tenantId: string): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    expiringSoonCount: number;
    categoryBreakdown: Record<string, { count: number; value: number }>;
  }> {
    const response = await this.request<{
      success: boolean;
      totalItems: number;
      totalValue: number;
      lowStockCount: number;
      expiringSoonCount: number;
      categoryBreakdown: Record<string, { count: number; value: number }>;
    }>('/api/inventory/summary', tenantId);
    return {
      totalItems: response.totalItems,
      totalValue: response.totalValue,
      lowStockCount: response.lowStockCount,
      expiringSoonCount: response.expiringSoonCount,
      categoryBreakdown: response.categoryBreakdown,
    };
  }

  // ==================== RECIPES ====================

  /**
   * Get recipe ingredients for a menu item
   */
  async getRecipeIngredients(menuItemId: string, tenantId: string): Promise<{
    recipe: any;
    ingredients: any[];
  }> {
    const response = await this.request<{ success: boolean; recipe: any }>(
      `/api/inventory/recipes/by-menu-item/${menuItemId}`,
      tenantId
    );
    return {
      recipe: response.recipe,
      ingredients: response.recipe?.ingredients || [],
    };
  }

  /**
   * Create or update recipe for a menu item
   */
  async saveRecipe(
    menuItemId: string,
    menuItemName: string,
    ingredients: { inventoryItemId: string; quantity: number; unit: string; wastePercentage?: number }[],
    tenantId: string
  ): Promise<any> {
    const response = await this.request<{ success: boolean; recipe: any }>(
      '/api/inventory/recipes',
      tenantId,
      {
        method: 'POST',
        body: JSON.stringify({
          menuItemId,
          menuItemName,
          ingredients: ingredients.map((ing) => ({
            inventoryItemId: ing.inventoryItemId,
            quantity: ing.quantity,
            unit: ing.unit,
            wastePercentage: ing.wastePercentage || 0,
          })),
        }),
      }
    );
    return response.recipe;
  }

  /**
   * Delete recipe
   */
  async deleteRecipe(recipeId: string, tenantId: string): Promise<void> {
    await this.request(`/api/inventory/recipes/${recipeId}`, tenantId, {
      method: 'DELETE',
    });
  }

  /**
   * Get recipe cost breakdown
   */
  async getRecipeCost(menuItemId: string, tenantId: string): Promise<{
    totalCost: number;
    costPerServing: number;
    ingredients: any[];
  }> {
    const response = await this.request<{ success: boolean; cost: any }>(
      `/api/inventory/recipes/cost/${menuItemId}`,
      tenantId
    );
    return {
      totalCost: response.cost?.totalCost || 0,
      costPerServing: response.cost?.totalCost || 0, // Same as total for single serving
      ingredients: response.cost?.ingredients || [],
    };
  }

  // ==================== EXTRACTED VENDORS ====================

  /**
   * Get pending extracted vendor details (from bill scans)
   * Note: This feature requires the vision-inventory OCR service
   */
  async getPendingExtractedVendors(_tenantId: string): Promise<{
    items: any[];
    total: number;
  }> {
    // This endpoint is not yet implemented in restaurant worker
    // Return empty for now
    console.warn('[VisionInventoryApi] getPendingExtractedVendors: OCR features not yet available');
    return { items: [], total: 0 };
  }

  /**
   * Confirm extracted vendor details
   * Note: This feature requires the vision-inventory OCR service
   */
  async confirmExtractedVendor(
    _extractedId: string,
    _action: 'create_new' | 'merge_with_existing' | 'reject',
    _tenantId: string,
    _existingSupplierId?: string
  ): Promise<any> {
    console.warn('[VisionInventoryApi] confirmExtractedVendor: OCR features not yet available');
    return { success: false, error: 'OCR features not yet available' };
  }

  /**
   * Find matching suppliers by name or GSTIN
   */
  async findMatchingSuppliers(
    tenantId: string,
    params: { name?: string; gstin?: string }
  ): Promise<any[]> {
    // Use the supplier search endpoint
    const searchTerm = params.name || params.gstin || '';
    if (!searchTerm) return [];

    const response = await this.getSuppliers(tenantId, searchTerm);
    return response.suppliers || [];
  }

  // ==================== DOCUMENTS (Invoices, Bills) ====================

  /**
   * Create a document record (for tracking invoices/bills)
   */
  async createDocument(
    input: {
      type: 'invoice' | 'bill' | 'receipt' | 'purchase_order';
      invoiceNumber?: string;
      invoiceDate?: string;
      supplierId?: string;
      originalFilename?: string;
      ocrProvider?: string;
      extractedData?: any;
      processingTimeMs?: number;
      createdBy?: string;
    },
    tenantId: string
  ): Promise<any> {
    const apiInput = {
      type: input.type,
      invoice_number: input.invoiceNumber,
      invoice_date: input.invoiceDate,
      supplier_id: input.supplierId,
      original_filename: input.originalFilename,
      ocr_provider: input.ocrProvider,
      extracted_data: input.extractedData,
      processing_time_ms: input.processingTimeMs,
      created_by: input.createdBy,
    };

    const response = await this.request<{ success: boolean; document: any }>(
      '/api/inventory/documents',
      tenantId,
      {
        method: 'POST',
        body: JSON.stringify(apiInput),
      }
    );
    return response.document;
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string, tenantId: string): Promise<any | null> {
    const response = await this.request<{ success: boolean; document: any }>(
      `/api/inventory/documents/${documentId}`,
      tenantId
    );
    return response.document;
  }

  /**
   * List documents with optional filters
   */
  async listDocuments(
    tenantId: string,
    filters?: {
      type?: 'invoice' | 'bill' | 'receipt' | 'purchase_order';
      supplierId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ documents: any[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.supplierId) params.set('supplier_id', filters.supplierId);
    if (filters?.startDate) params.set('start_date', filters.startDate);
    if (filters?.endDate) params.set('end_date', filters.endDate);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    if (filters?.offset) params.set('offset', filters.offset.toString());

    const queryString = params.toString();
    const path = queryString ? `/api/inventory/documents?${queryString}` : '/api/inventory/documents';

    const response = await this.request<{ success: boolean; documents: any[]; total: number }>(
      path,
      tenantId
    );
    return { documents: response.documents || [], total: response.total || 0 };
  }

  // ==================== SYNC ====================

  /**
   * Sync inventory from cloud
   * Returns all items and suppliers
   */
  async syncInventoryFromCloud(tenantId: string): Promise<{
    items: InventoryItem[];
    suppliers: Supplier[];
  }> {
    const [inventoryData, suppliersData] = await Promise.all([
      this.getInventoryItems(tenantId, { limit: 1000 }),
      this.getSuppliers(tenantId),
    ]);

    return {
      items: inventoryData.items || [],
      suppliers: (suppliersData as any).items || suppliersData.suppliers || [],
    };
  }
}

// Export singleton instance
export const visionInventoryApi = new VisionInventoryApi();

// Export class for testing/custom instances
export { VisionInventoryApi };
