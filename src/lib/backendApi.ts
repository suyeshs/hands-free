/**
 * Backend API Client
 * Interface to multi-tenant backend for menu management and operations
 */

import type { AggregatorOrder } from '../types/aggregator';
import type { User, LoginCredentials, PinLoginCredentials, AuthTokens } from '../types/auth';
import type { KitchenOrder } from '../types/kds';
import type { DineInPricingOverride } from '../types';
import { getCurrentPlatform } from './platform';

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

// Get tenant-specific API URL (for admin endpoints that need to go through the restaurant worker)
function getTenantApiUrl(tenantId: string): string {
  // In production, use tenant subdomain; in dev, use BACKEND_URL with header
  // Note: For Tauri builds, we always use tenant subdomain since CORS is bypassed
  const platform = getCurrentPlatform();
  const isProd = import.meta.env.PROD;
  console.log('[BackendAPI] getTenantApiUrl - platform:', platform, 'isProd:', isProd, 'tenantId:', tenantId);

  // Always use tenant subdomain for Tauri (bypasses CORS) or production builds
  if (platform === 'tauri' || isProd) {
    const url = `https://${tenantId}.handsfree.tech/api`;
    console.log('[BackendAPI] Using tenant URL:', url);
    return url;
  }
  console.log('[BackendAPI] Using BACKEND_URL:', BACKEND_URL);
  return BACKEND_URL;
}

// Tauri HTTP client wrapper to bypass CORS
async function tauriFetch(url: string, options?: RequestInit): Promise<Response> {
  const platform = getCurrentPlatform();

  // Use Tauri's HTTP client on desktop (bypasses CORS)
  if (platform === 'tauri') {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, options);
  }

  // Use browser fetch on web
  return fetch(url, options);
}

// Helper to get auth token from storage
function getAuthToken(): string | null {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) return null;

  try {
    const parsed = JSON.parse(authStorage);
    return parsed.state?.tokens?.accessToken || null;
  } catch {
    return null;
  }
}

// Helper to create authenticated fetch
async function authFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return tauriFetch(url, {
    ...options,
    headers,
  });
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MenuItem {
  id?: string;
  name: string;
  nameLocal?: string | null;
  description: string;
  descriptionLocal?: string | null;
  price: number;
  currency: string;
  category: string;
  subcategory?: string | null;
  isVeg: boolean;
  isVegan?: boolean;
  isHalal?: boolean;
  isKosher?: boolean;
  containsGluten?: boolean;
  containsDairy?: boolean;
  containsNuts?: boolean;
  containsShellfish?: boolean;
  allergens: string[];
  dietaryTags: string[];
  spiceLevel: number;
  preparationTime: string;
  servingSize: string;
  calories?: number;
  variants?: Array<{ name: string; priceAdjustment: number }>;
  addons?: Array<{ name: string; price: number }>;
  isPopular?: boolean;
  isChefSpecial?: boolean;
  available: boolean;
  imageUrl?: string | null;
  imageId?: string | null;
  confidence?: number; // AI extraction confidence (0.0-1.0)
}

export interface PhotoMatchResult {
  filename: string;
  imageUrl: string;
  imageId: string;
  matched: boolean;
  matchedItem?: {
    id: string;
    name: string;
  } | null;
}

export const backendApi = {
  /**
   * Download Excel template
   */
  async downloadTemplate(): Promise<Blob> {
    const response = await tauriFetch(`${BACKEND_URL}/admin/menu/template`);
    if (!response.ok) {
      throw new Error('Failed to download template');
    }
    return response.blob();
  },

  /**
   * Smart AI-powered document upload (no template required)
   * Accepts: PDF, Excel, Word, Images
   */
  async uploadSmart(tenantId: string, file: File): Promise<{
    items: MenuItem[];
    count: number;
    confidence: number;
    metadata: any;
    message: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantId', tenantId);

    const response = await tauriFetch(`${BACKEND_URL}/admin/menu/upload-smart`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Smart upload failed');
    }

    return {
      items: data.items,
      count: data.count,
      confidence: data.confidence,
      metadata: data.metadata,
      message: data.message
    };
  },

  /**
   * Upload Excel file and parse (template-based)
   */
  async uploadExcel(tenantId: string, file: File): Promise<{ items: MenuItem[]; count: number; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantId', tenantId);

    const response = await tauriFetch(`${BACKEND_URL}/admin/menu/upload-excel`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    return {
      items: data.items,
      count: data.count,
      message: data.message
    };
  },

  /**
   * Confirm menu items (save to database)
   */
  async confirmMenu(tenantId: string, items: MenuItem[]): Promise<{ saved: number; failed: number; items: MenuItem[]; message: string }> {
    const response = await tauriFetch(`${BACKEND_URL}/admin/menu/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId, items }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Confirmation failed');
    }

    return {
      saved: data.saved,
      failed: data.failed,
      items: data.items,
      message: data.message
    };
  },

  /**
   * Upload photos with fuzzy matching
   */
  async uploadPhotos(tenantId: string, files: FileList): Promise<{
    total: number;
    matched: number;
    unmatched: number;
    results: {
      matched: PhotoMatchResult[];
      unmatched: PhotoMatchResult[];
      uploaded: PhotoMatchResult[];
    };
    message: string;
  }> {
    const formData = new FormData();

    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }
    formData.append('tenantId', tenantId);

    const response = await tauriFetch(`${BACKEND_URL}/admin/menu/upload-photos`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Photo upload failed');
    }

    return {
      total: data.total,
      matched: data.matched,
      unmatched: data.unmatched,
      results: data.results,
      message: data.message
    };
  },

  /**
   * Get full menu for tenant
   */
  async getMenu(tenantId: string): Promise<{ items: MenuItem[]; count: number }> {
    // Use orders worker for menu API (D1-backed, tenant-specific)
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const url = `${ordersUrl}/api/menu/${tenantId}`;
    console.log('[BackendAPI] Fetching menu from:', url);

    const response = await tauriFetch(url);
    console.log('[BackendAPI] Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[BackendAPI] Response data keys:', Object.keys(data));
    console.log('[BackendAPI] Items count:', data.items?.length);

    // Orders worker returns items array in response
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Failed to fetch menu - invalid response format');
    }

    return {
      items: data.items,
      count: data.items.length
    };
  },

  // ============================================================================
  // Authentication APIs
  // ============================================================================

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await tauriFetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    return {
      user: data.user,
      tokens: data.tokens,
    };
  },

  /**
   * Login with PIN (for POS terminals)
   */
  async loginWithPin(credentials: PinLoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await tauriFetch(`${BACKEND_URL}/auth/login/pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'PIN login failed');
    }

    return {
      user: data.user,
      tokens: data.tokens,
    };
  },

  /**
   * Logout (invalidate token)
   */
  async logout(): Promise<void> {
    const response = await authFetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Logout failed');
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ tokens: AuthTokens }> {
    const response = await tauriFetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Token refresh failed');
    }

    return {
      tokens: data.tokens,
    };
  },

  /**
   * Get current user profile
   */
  async getMe(): Promise<{ user: User }> {
    const response = await authFetch(`${BACKEND_URL}/auth/me`);

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch user profile');
    }

    return {
      user: data.user,
    };
  },

  // ============================================================================
  // Aggregator Order APIs
  // ============================================================================

  /**
   * Get aggregator orders
   */
  async getAggregatorOrders(tenantId: string, status?: string): Promise<{ orders: AggregatorOrder[]; count: number }> {
    const url = new URL(`${BACKEND_URL}/aggregator/orders`);
    url.searchParams.set('tenantId', tenantId);
    if (status && status !== 'all') {
      url.searchParams.set('status', status);
    }

    const response = await authFetch(url.toString());

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch aggregator orders');
    }

    return {
      orders: data.orders,
      count: data.count,
    };
  },

  /**
   * Accept aggregator order
   */
  async acceptAggregatorOrder(orderId: string, prepTime: number): Promise<{ order: AggregatorOrder }> {
    const response = await authFetch(`${BACKEND_URL}/aggregator/orders/${orderId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prepTime }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to accept order');
    }

    return {
      order: data.order,
    };
  },

  /**
   * Reject aggregator order
   */
  async rejectAggregatorOrder(orderId: string, reason: string): Promise<{ order: AggregatorOrder }> {
    const response = await authFetch(`${BACKEND_URL}/aggregator/orders/${orderId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to reject order');
    }

    return {
      order: data.order,
    };
  },

  /**
   * Mark aggregator order as ready
   */
  async markAggregatorOrderReady(orderId: string): Promise<{ order: AggregatorOrder }> {
    const response = await authFetch(`${BACKEND_URL}/aggregator/orders/${orderId}/ready`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to mark order as ready');
    }

    return {
      order: data.order,
    };
  },

  /**
   * Mark aggregator order as completed
   */
  async completeAggregatorOrder(orderId: string): Promise<{ order: AggregatorOrder }> {
    const response = await authFetch(`${BACKEND_URL}/aggregator/orders/${orderId}/complete`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to complete order');
    }

    return {
      order: data.order,
    };
  },

  // ============================================================================
  // Kitchen Display System (KDS) APIs
  // ============================================================================

  /**
   * Get kitchen orders
   */
  async getKitchenOrders(tenantId: string, station?: string): Promise<{ orders: KitchenOrder[]; count: number }> {
    const url = new URL(`${BACKEND_URL}/kds/orders`);
    url.searchParams.set('tenantId', tenantId);
    if (station && station !== 'all') {
      url.searchParams.set('station', station);
    }

    const response = await authFetch(url.toString());

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch kitchen orders');
    }

    return {
      orders: data.orders,
      count: data.count,
    };
  },

  /**
   * Mark kitchen item as ready
   */
  async markKitchenItemReady(orderId: string, itemId: string): Promise<{ order: KitchenOrder }> {
    const response = await authFetch(`${BACKEND_URL}/kds/orders/${orderId}/items/${itemId}/ready`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to mark item as ready');
    }

    return {
      order: data.order,
    };
  },

  /**
   * Mark all kitchen items ready for an order
   */
  async markAllKitchenItemsReady(orderId: string): Promise<{ order: KitchenOrder }> {
    const response = await authFetch(`${BACKEND_URL}/kds/orders/${orderId}/ready`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to mark all items as ready');
    }

    return {
      order: data.order,
    };
  },

  /**
   * Mark kitchen order as complete
   */
  async completeKitchenOrder(orderId: string): Promise<{ order: KitchenOrder }> {
    const response = await authFetch(`${BACKEND_URL}/kds/orders/${orderId}/complete`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to complete kitchen order');
    }

    return {
      order: data.order,
    };
  },

  // ============================================================================
  // Order Submission API (for POS orders)
  // ============================================================================

  /**
   * Submit POS order to backend
   */
  async submitOrder(tenantId: string, order: any): Promise<{ orderId: string; orderNumber: string }> {
    const response = await authFetch(`${BACKEND_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        ...order,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to submit order');
    }

    return {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
    };
  },

  // ============================================================================
  // Dine-In Pricing APIs
  // ============================================================================

  /**
   * Get all dine-in pricing overrides for a tenant
   */
  async getDineInPricingOverrides(tenantId: string): Promise<DineInPricingOverride[]> {
    const apiUrl = getTenantApiUrl(tenantId);
    const response = await authFetch(`${apiUrl}/admin/menu/dine-in-pricing`, {
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch dine-in pricing overrides');
    }

    return data.overrides || [];
  },

  /**
   * Save a dine-in pricing override
   */
  async saveDineInPricingOverride(
    tenantId: string,
    menuItemId: string,
    dineInPrice: number | null,
    dineInAvailable: boolean
  ): Promise<DineInPricingOverride> {
    const apiUrl = getTenantApiUrl(tenantId);
    const response = await authFetch(`${apiUrl}/admin/menu/dine-in-pricing/${menuItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({ dineInPrice, dineInAvailable }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save dine-in pricing override');
    }

    return data.override;
  },

  /**
   * Delete a dine-in pricing override
   */
  async deleteDineInPricingOverride(tenantId: string, menuItemId: string): Promise<void> {
    const apiUrl = getTenantApiUrl(tenantId);
    const response = await authFetch(`${apiUrl}/admin/menu/dine-in-pricing/${menuItemId}`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete dine-in pricing override');
    }
  },

  /**
   * Bulk save dine-in pricing overrides
   */
  async bulkSaveDineInPricingOverrides(
    tenantId: string,
    overrides: Array<{ menuItemId: string; dineInPrice: number | null; dineInAvailable: boolean }>
  ): Promise<number> {
    const apiUrl = getTenantApiUrl(tenantId);
    const url = `${apiUrl}/admin/menu/dine-in-pricing/bulk`;
    console.log('[BackendAPI] Bulk saving dine-in overrides to:', url);
    console.log('[BackendAPI] Overrides count:', overrides.length);

    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({ overrides }),
    });

    console.log('[BackendAPI] Response status:', response.status);

    // Check if response is ok before parsing
    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] Error response:', text);
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const text = await response.text();
    console.log('[BackendAPI] Response text:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[BackendAPI] Failed to parse JSON:', e);
      throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to bulk save dine-in pricing overrides');
    }

    return data.savedCount;
  },

  /**
   * Reset all dine-in pricing overrides for a tenant
   */
  async resetAllDineInPricingOverrides(tenantId: string): Promise<number> {
    const apiUrl = getTenantApiUrl(tenantId);
    const response = await authFetch(`${apiUrl}/admin/menu/dine-in-pricing`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to reset dine-in pricing overrides');
    }

    return data.deletedCount;
  },

  // ============================================================================
  // Restaurant Settings APIs (Cloud Sync)
  // ============================================================================

  /**
   * Get restaurant settings from cloud
   */
  async getRestaurantSettings(tenantId: string): Promise<any | null> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/settings/${tenantId}`);

    if (response.status === 404) {
      return null; // No settings stored in cloud yet
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch restaurant settings');
    }

    return data.settings;
  },

  /**
   * Save restaurant settings to cloud
   */
  async saveRestaurantSettings(tenantId: string, settings: any): Promise<void> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/settings/${tenantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save restaurant settings');
    }
  },

  // ============================================================================
  // Floor Plan APIs (Cloud Sync)
  // ============================================================================

  /**
   * Get floor plan from cloud (sections, tables, assignments)
   */
  async getFloorPlan(tenantId: string): Promise<{
    sections: any[];
    tables: any[];
    assignments: any[];
  } | null> {
    // Use tenant subdomain for restaurant worker routing
    const baseUrl = `https://${tenantId}.handsfree.tech`;
    const response = await authFetch(`${baseUrl}/api/admin/floor-plan`, {
      headers: {
        'x-tenant-id': tenantId,
      },
    });

    if (response.status === 404) {
      return null; // No floor plan stored in cloud yet
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch floor plan');
    }

    return {
      sections: data.sections || [],
      tables: data.tables || [],
      assignments: data.assignments || [],
    };
  },

  /**
   * Save floor plan to cloud
   */
  async saveFloorPlan(
    tenantId: string,
    sections: any[],
    tables: any[],
    assignments: any[]
  ): Promise<void> {
    // Use tenant subdomain for restaurant worker routing
    const baseUrl = `https://${tenantId}.handsfree.tech`;
    const response = await authFetch(`${baseUrl}/api/admin/floor-plan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({ sections, tables, assignments }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save floor plan');
    }
  },

  // ============================================================================
  // Staff APIs (Cloud Sync)
  // ============================================================================

  /**
   * Get staff members from cloud
   */
  async getStaff(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    role: string;
    pinHash: string;
    email?: string;
    phone?: string;
    isActive: boolean;
    joinedAt: string;
  }> | null> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/staff/${tenantId}`);

    if (response.status === 404) {
      return null; // No staff stored in cloud yet
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch staff');
    }

    return data.staff || [];
  },

  /**
   * Save staff members to cloud
   */
  async saveStaff(
    tenantId: string,
    staff: Array<{
      id: string;
      name: string;
      role: string;
      pinHash: string;
      email?: string;
      phone?: string;
      isActive: boolean;
      joinedAt: string;
    }>
  ): Promise<void> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/staff/${tenantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ staff }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save staff');
    }
  },

  // ============================================================================
  // Out-of-Stock APIs (Cloud Sync)
  // ============================================================================

  /**
   * Get out-of-stock items from cloud
   */
  async getOutOfStock(tenantId: string): Promise<Array<{
    id: string;
    itemId: string;
    itemName: string;
    portionsOut?: number;
    staffName?: string;
    isActive: boolean;
    createdAt: string;
  }> | null> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/out-of-stock/${tenantId}`);

    if (response.status === 404) {
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch out-of-stock items');
    }

    return data.items || [];
  },

  /**
   * Save out-of-stock items to cloud
   */
  async saveOutOfStock(
    tenantId: string,
    items: Array<{
      id: string;
      itemId: string;
      itemName: string;
      portionsOut?: number;
      staffName?: string;
      isActive: boolean;
      createdAt: string;
    }>
  ): Promise<void> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/out-of-stock/${tenantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save out-of-stock items');
    }
  },

  // ============================================================================
  // Printer Config APIs (Cloud Sync)
  // ============================================================================

  /**
   * Get printer configuration from cloud
   */
  async getPrinterConfig(tenantId: string): Promise<any | null> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/printer-config/${tenantId}`);

    if (response.status === 404) {
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch printer config');
    }

    return data.config;
  },

  /**
   * Save printer configuration to cloud
   */
  async savePrinterConfig(tenantId: string, config: any): Promise<void> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/printer-config/${tenantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save printer config');
    }
  },

  // ============================================================================
  // Aggregator Settings APIs (Cloud Sync)
  // ============================================================================

  /**
   * Get aggregator settings (auto-accept rules) from cloud
   */
  async getAggregatorSettings(tenantId: string): Promise<any | null> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/aggregator-settings/${tenantId}`);

    if (response.status === 404) {
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch aggregator settings');
    }

    return data.settings;
  },

  /**
   * Save aggregator settings to cloud
   */
  async saveAggregatorSettings(tenantId: string, settings: any): Promise<void> {
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
    const response = await authFetch(`${ordersUrl}/api/aggregator-settings/${tenantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save aggregator settings');
    }
  },
};

export default backendApi;
