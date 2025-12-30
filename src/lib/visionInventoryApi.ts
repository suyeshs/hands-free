/**
 * Vision Inventory API Client
 * Communicates with the deepseek-api/vision-inventory Cloudflare Worker
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

const VISION_API_URL = import.meta.env.VITE_VISION_INVENTORY_URL || 'https://vision-inventory.suyesh.workers.dev';

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
  private baseUrl: string;

  constructor(baseUrl: string = VISION_API_URL) {
    this.baseUrl = baseUrl;
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
    const url = `${this.baseUrl}${endpoint}`;

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
    formData.append('type', documentType);

    const url = `${this.baseUrl}/api/documents/fast`;

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
    const url = `${this.baseUrl}/api/documents/process`;

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
    if (options?.supplierId) params.append('supplier', options.supplierId);
    if (options?.lowStock) params.append('low_stock', 'true');
    if (options?.expiringSoon) params.append('expiring_soon', 'true');
    if (options?.search) params.append('search', options.search);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const endpoint = `/api/inventory${queryString ? `?${queryString}` : ''}`;

    return await this.request<InventoryListResponse>(endpoint, tenantId);
  }

  /**
   * Get single inventory item
   */
  async getInventoryItem(itemId: string, tenantId: string): Promise<InventoryItem> {
    return await this.request<InventoryItem>(`/api/inventory/${itemId}`, tenantId);
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(
    item: CreateInventoryItemInput,
    tenantId: string
  ): Promise<InventoryItem> {
    return await this.request<InventoryItem>('/api/inventory', tenantId, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(
    itemId: string,
    updates: UpdateInventoryItemInput,
    tenantId: string
  ): Promise<InventoryItem> {
    return await this.request<InventoryItem>(`/api/inventory/${itemId}`, tenantId, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Adjust inventory quantity
   */
  async adjustInventoryQuantity(
    itemId: string,
    quantityChange: number,
    reason: string,
    tenantId: string
  ): Promise<InventoryItem> {
    return await this.request<InventoryItem>(`/api/inventory/${itemId}/adjust`, tenantId, {
      method: 'POST',
      body: JSON.stringify({
        quantity_change: quantityChange,
        reason,
      }),
    });
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(itemId: string, tenantId: string): Promise<void> {
    await this.request<void>(`/api/inventory/${itemId}`, tenantId, {
      method: 'DELETE',
    });
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(tenantId: string): Promise<InventoryItem[]> {
    const data = await this.request<{ items: InventoryItem[] }>(
      '/api/inventory/alerts/low-stock',
      tenantId
    );
    return data.items;
  }

  /**
   * Get expiring soon alerts
   */
  async getExpiringSoonAlerts(tenantId: string, days: number = 7): Promise<InventoryItem[]> {
    const data = await this.request<{ items: InventoryItem[] }>(
      `/api/inventory/alerts/expiring?days=${days}`,
      tenantId
    );
    return data.items;
  }

  // ==================== SUPPLIERS ====================

  /**
   * Get all suppliers
   */
  async getSuppliers(tenantId: string, search?: string): Promise<SupplierListResponse> {
    const endpoint = search
      ? `/api/suppliers?search=${encodeURIComponent(search)}`
      : '/api/suppliers';
    return await this.request<SupplierListResponse>(endpoint, tenantId);
  }

  /**
   * Get single supplier
   */
  async getSupplier(supplierId: string, tenantId: string): Promise<Supplier> {
    return await this.request<Supplier>(`/api/suppliers/${supplierId}`, tenantId);
  }

  /**
   * Create new supplier
   */
  async createSupplier(supplier: CreateSupplierInput, tenantId: string): Promise<Supplier> {
    return await this.request<Supplier>('/api/suppliers', tenantId, {
      method: 'POST',
      body: JSON.stringify(supplier),
    });
  }

  /**
   * Update supplier
   */
  async updateSupplier(
    supplierId: string,
    updates: Partial<CreateSupplierInput>,
    tenantId: string
  ): Promise<Supplier> {
    return await this.request<Supplier>(`/api/suppliers/${supplierId}`, tenantId, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(supplierId: string, tenantId: string): Promise<void> {
    await this.request<void>(`/api/suppliers/${supplierId}`, tenantId, {
      method: 'DELETE',
    });
  }

  /**
   * Get items from a supplier
   */
  async getSupplierItems(supplierId: string, tenantId: string): Promise<InventoryItem[]> {
    const data = await this.request<{ items: InventoryItem[] }>(
      `/api/suppliers/${supplierId}/items`,
      tenantId
    );
    return data.items;
  }

  // ==================== SYNC ====================

  /**
   * Sync inventory from cloud to local
   * Returns all items for local storage
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
      items: inventoryData.items,
      suppliers: suppliersData.suppliers,
    };
  }
}

// Export singleton instance
export const visionInventoryApi = new VisionInventoryApi();

// Export class for testing/custom instances
export { VisionInventoryApi };
