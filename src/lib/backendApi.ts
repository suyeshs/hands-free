/**
 * Backend API Client
 * Interface to multi-tenant backend for menu management and operations
 */

import type { AggregatorOrder } from '../types/aggregator';
import type { User, LoginCredentials, PinLoginCredentials, AuthTokens } from '../types/auth';
import type { KitchenOrder } from '../types/kds';
import type { DineInPricingOverride, MenuCategory } from '../types';
import { getCurrentPlatform } from './platform';
import { tauriFetch as rustTauriFetch } from './tauriFetch';

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

  // Use custom Rust command on desktop (bypasses CORS and Tauri HTTP plugin bugs)
  if (platform === 'tauri') {
    return rustTauriFetch(url, options);
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

    console.log('[BackendAPI] uploadSmart response status:', response.status);

    // Check if response is OK before parsing
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BackendAPI] uploadSmart error response:', errorText.substring(0, 500));
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    // Try to parse JSON
    let data;
    try {
      const responseText = await response.text();
      console.log('[BackendAPI] uploadSmart response preview:', responseText.substring(0, 200));
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[BackendAPI] Failed to parse uploadSmart response as JSON:', e);
      throw new Error('Invalid JSON response from server. The endpoint may not be available.');
    }

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
   * NEW: Upload file via R2 multipart upload + AI processing
   * This method aligns with web client implementation:
   * 1. Upload to R2 (supports large files >32MB)
   * 2. Process with Gemini AI
   * 3. Auto-save to D1 database
   *
   * @param tenantId - Tenant ID
   * @param file - File to upload (PDF, Excel, Image, Word)
   * @param onProgress - Optional progress callback
   * @returns Processing result with items saved count
   */
  /**
   * NEW: Upload to R2 only (no parsing, for POS review workflow)
   */
  async uploadToR2Only(
    tenantId: string,
    file: File,
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
  ): Promise<{
    success: boolean;
    r2Key?: string;
    bucketName?: string;
    error?: string;
  }> {
    const { R2Uploader } = await import('./r2Uploader');

    const uploader = new R2Uploader(tenantId, onProgress);
    const uploadResult = await uploader.uploadFile(file, tenantId);

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'R2 upload failed');
    }

    console.log('[BackendAPI] File uploaded to R2:', uploadResult.r2Key);

    return {
      success: true,
      r2Key: uploadResult.r2Key,
      bucketName: uploadResult.bucketName,
    };
  },

  /**
   * NEW: Parse file from R2 with AI (no D1 save, for POS review workflow)
   */
  async parseFromR2(
    tenantId: string,
    r2Key: string,
    filename: string,
    mimeType: string
  ): Promise<{
    success: boolean;
    items: any[];
    summary?: {
      total: number;
      byType: Record<string, number>;
      withWarnings: number;
    };
    message?: string;
    error?: string;
  }> {
    const { parseFileFromR2 } = await import('./r2Uploader');

    const parseResult = await parseFileFromR2(tenantId, r2Key, filename, mimeType);

    if (!parseResult.success) {
      throw new Error(parseResult.error || 'AI parsing failed');
    }

    console.log('[BackendAPI] AI parsing complete:', parseResult.items.length, 'items');

    return {
      success: true,
      items: parseResult.items,
      summary: parseResult.summary,
      message: parseResult.message || `Successfully parsed ${parseResult.items.length} items`,
    };
  },

  /**
   * LEGACY: Upload to R2 with AI processing and D1 save (web client flow)
   * For POS, use uploadToR2Only + parseFromR2 + save to SQLite instead
   */
  async uploadViaR2(
    tenantId: string,
    file: File,
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
  ): Promise<{
    success: boolean;
    itemsSavedToD1: number;
    d1Errors?: string[];
    storeName?: string;
    message?: string;
  }> {
    const { R2Uploader, parseFileFromR2 } = await import('./r2Uploader');

    // Step 1: Upload to R2
    const uploader = new R2Uploader(tenantId, onProgress);
    const uploadResult = await uploader.uploadFile(file, tenantId);

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'R2 upload failed');
    }

    console.log('[BackendAPI] File uploaded to R2:', uploadResult.r2Key);

    // Step 2: Parse file with AI (no D1 save)
    const parseResult = await parseFileFromR2(
      tenantId,
      uploadResult.r2Key!,
      file.name,
      file.type
    );

    if (!parseResult.success) {
      throw new Error(parseResult.error || 'AI parsing failed');
    }

    // Note: For web client flow, items would be saved to D1 here
    // For POS, use uploadToR2Only + parseFromR2 + local SQLite save instead

    return {
      success: true,
      itemsSavedToD1: parseResult.items.length,
      d1Errors: [],
      storeName: '',
      message: parseResult.message || `Successfully processed ${parseResult.items.length} menu items`,
    };
  },

  /**
   * NEW: Get menu items from restaurant worker (D1 database)
   * Aligns with web client's menu display
   */
  async getMenuItemsFromD1(tenantId: string): Promise<MenuItem[]> {
    const restaurantWorkerUrl = import.meta.env.VITE_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';

    const response = await authFetch(`${restaurantWorkerUrl}/api/admin/menu/items`, {
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch menu items from D1');
    }

    const data = await response.json();
    return data.items || [];
  },

  /**
   * NEW: Get categories from restaurant worker (D1 database)
   */
  async getCategoriesFromD1(tenantId: string): Promise<MenuCategory[]> {
    const restaurantWorkerUrl = import.meta.env.VITE_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';

    const response = await authFetch(`${restaurantWorkerUrl}/api/admin/menu/categories`, {
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch categories from D1');
    }

    const data = await response.json();
    return data.categories || [];
  },

  /**
   * NEW: Create category in D1
   */
  async createCategoryInD1(tenantId: string, category: { name: string; description?: string; displayOrder?: number }): Promise<MenuCategory> {
    const restaurantWorkerUrl = import.meta.env.VITE_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';

    const response = await authFetch(`${restaurantWorkerUrl}/api/admin/menu/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify(category),
    });

    if (!response.ok) {
      throw new Error('Failed to create category in D1');
    }

    const data = await response.json();
    return data.category;
  },

  /**
   * NEW: Create menu item in D1
   */
  async createMenuItemInD1(tenantId: string, item: Partial<MenuItem>): Promise<MenuItem> {
    const restaurantWorkerUrl = import.meta.env.VITE_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';

    const response = await authFetch(`${restaurantWorkerUrl}/api/admin/menu/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify(item),
    });

    if (!response.ok) {
      throw new Error('Failed to create menu item in D1');
    }

    const data = await response.json();
    return data.item;
  },

  /**
   * NEW: Update menu item in D1
   */
  async updateMenuItemInD1(tenantId: string, itemId: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    const restaurantWorkerUrl = import.meta.env.VITE_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';

    const response = await authFetch(`${restaurantWorkerUrl}/api/admin/menu/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update menu item in D1');
    }

    const data = await response.json();
    return data.item;
  },

  /**
   * NEW: Delete menu item from D1
   */
  async deleteMenuItemFromD1(tenantId: string, itemId: string): Promise<void> {
    const restaurantWorkerUrl = import.meta.env.VITE_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';

    const response = await authFetch(`${restaurantWorkerUrl}/api/admin/menu/items/${itemId}`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete menu item from D1');
    }
  },

  /**
   * Confirm menu items (save to database)
   * LEGACY: Use uploadViaR2 for new implementations
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

  /**
   * Create a new menu item (saves to D1, then sync to local)
   */
  async createMenuItem(tenantId: string, item: Partial<MenuItem>): Promise<{ success: boolean; item: MenuItem }> {
    // Use orders worker for menu operations (same as getMenu)
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

    const response = await authFetch(`${ordersUrl}/api/menu/${tenantId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create menu item');
    }

    return data;
  },

  /**
   * Update an existing menu item (saves to D1, then sync to local)
   */
  async updateMenuItem(tenantId: string, itemId: string, updates: Partial<MenuItem>): Promise<{ success: boolean; item: MenuItem }> {
    // Use orders worker for menu operations (same as getMenu)
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

    const response = await authFetch(`${ordersUrl}/api/menu/${tenantId}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to update menu item');
    }

    return data;
  },

  /**
   * Delete a menu item (removes from D1, then sync to local)
   */
  async deleteMenuItem(tenantId: string, itemId: string): Promise<{ success: boolean }> {
    // Use orders worker for menu operations (same as getMenu)
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

    const response = await authFetch(`${ordersUrl}/api/menu/${tenantId}/items/${itemId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete menu item');
    }

    return data;
  },

  /**
   * Create a new category (saves to D1, then sync to local)
   */
  async createCategory(tenantId: string, category: { name: string; icon?: string; active?: boolean; sort_order?: number }): Promise<{ success: boolean; category: any }> {
    // Use orders worker for menu operations (same as getMenu)
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

    const response = await authFetch(`${ordersUrl}/api/menu/${tenantId}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(category),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create category');
    }

    return data;
  },

  /**
   * Update an existing category (saves to D1, then sync to local)
   */
  async updateCategory(tenantId: string, categoryId: string, updates: { name?: string; icon?: string; active?: boolean; sort_order?: number }): Promise<{ success: boolean; category: any }> {
    // Use orders worker for menu operations (same as getMenu)
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

    const response = await authFetch(`${ordersUrl}/api/menu/${tenantId}/categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to update category');
    }

    return data;
  },

  /**
   * Delete a category (removes from D1, then sync to local)
   */
  async deleteCategory(tenantId: string, categoryId: string): Promise<{ success: boolean }> {
    // Use orders worker for menu operations (same as getMenu)
    const ordersUrl = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

    const response = await authFetch(`${ordersUrl}/api/menu/${tenantId}/categories/${categoryId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete category');
    }

    return data;
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

  // ==================== ATTENDANCE API (Stubs for Phase 2) ====================

  /**
   * Get attendance records (stub - will be implemented with cloud sync)
   */
  async getAttendanceRecords(_tenantId: string, _filters?: any): Promise<any[]> {
    console.log('[BackendAPI] getAttendanceRecords - stub (local-only for now)');
    return [];
  },

  /**
   * Save attendance record (stub - will be implemented with cloud sync)
   */
  async saveAttendanceRecord(_tenantId: string, _record: any): Promise<void> {
    console.log('[BackendAPI] saveAttendanceRecord - stub (local-only for now)');
  },

  /**
   * Bulk save attendance records (stub - will be implemented with cloud sync)
   */
  async bulkSaveAttendance(_tenantId: string, _records: any[]): Promise<void> {
    console.log('[BackendAPI] bulkSaveAttendance - stub (local-only for now)');
  },

  /**
   * Delete attendance record (stub - will be implemented with cloud sync)
   */
  async deleteAttendanceRecord(_tenantId: string, _recordId: string): Promise<void> {
    console.log('[BackendAPI] deleteAttendanceRecord - stub (local-only for now)');
  },

  // ==================== ROSTER API (Stubs for Phase 3) ====================

  /**
   * Get rosters (stub - will be implemented with cloud sync)
   */
  async getRosters(_tenantId: string, _startDate?: string, _endDate?: string): Promise<any[]> {
    console.log('[BackendAPI] getRosters - stub (local-only for now)');
    return [];
  },

  /**
   * Save roster (stub - will be implemented with cloud sync)
   */
  async saveRoster(_tenantId: string, _roster: any, _assignments: any[]): Promise<void> {
    console.log('[BackendAPI] saveRoster - stub (local-only for now)');
  },

  /**
   * Get roster assignments (stub - will be implemented with cloud sync)
   */
  async getRosterAssignments(_tenantId: string, _rosterId: string): Promise<any[]> {
    console.log('[BackendAPI] getRosterAssignments - stub (local-only for now)');
    return [];
  },

  /**
   * Delete roster (stub - will be implemented with cloud sync)
   */
  async deleteRoster(_tenantId: string, _rosterId: string): Promise<void> {
    console.log('[BackendAPI] deleteRoster - stub (local-only for now)');
  },

  // ==================== LEAVE API (Stubs for Phase 4) ====================

  /**
   * Get leave requests (stub - will be implemented with cloud sync)
   */
  async getLeaveRequests(_tenantId: string, _filters?: any): Promise<any[]> {
    console.log('[BackendAPI] getLeaveRequests - stub (local-only for now)');
    return [];
  },

  /**
   * Save leave request (stub - will be implemented with cloud sync)
   */
  async saveLeaveRequest(_tenantId: string, _request: any): Promise<void> {
    console.log('[BackendAPI] saveLeaveRequest - stub (local-only for now)');
  },

  /**
   * Approve leave request (stub - will be implemented with cloud sync)
   */
  async approveLeaveRequest(_tenantId: string, _requestId: string, _reviewNotes?: string): Promise<void> {
    console.log('[BackendAPI] approveLeaveRequest - stub (local-only for now)');
  },

  /**
   * Reject leave request (stub - will be implemented with cloud sync)
   */
  async rejectLeaveRequest(_tenantId: string, _requestId: string, _reviewNotes: string): Promise<void> {
    console.log('[BackendAPI] rejectLeaveRequest - stub (local-only for now)');
  },

  /**
   * Get leave balances (stub - will be implemented with cloud sync)
   */
  async getLeaveBalances(_tenantId: string, _staffId?: string, _year?: number): Promise<any[]> {
    console.log('[BackendAPI] getLeaveBalances - stub (local-only for now)');
    return [];
  },

  /**
   * Update leave balance (stub - will be implemented with cloud sync)
   */
  async updateLeaveBalance(_tenantId: string, _balance: any): Promise<void> {
    console.log('[BackendAPI] updateLeaveBalance - stub (local-only for now)');
  },

  // ==================== DEVICE MANAGEMENT API ====================

  /**
   * List all devices for a tenant
   */
  async listDevices(tenantId: string): Promise<any[]> {
    const url = `${getTenantApiUrl(tenantId)}/devices`;
    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch devices');
    }

    return data.devices || [];
  },

  /**
   * Send device heartbeat
   */
  async sendDeviceHeartbeat(tenantId: string, deviceId: string, metadata?: any): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/devices/heartbeat`;
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ deviceId, metadata }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update heartbeat');
    }
  },

  /**
   * Suspend a device
   */
  async suspendDevice(tenantId: string, deviceId: string, reason: string, suspendedBy: string): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/devices/${deviceId}/suspend`;
    const response = await authFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ reason, suspendedBy }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to suspend device');
    }
  },

  /**
   * Revoke a device permanently
   */
  async revokeDevice(tenantId: string, deviceId: string, reason: string, revokedBy: string): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/devices/${deviceId}/revoke`;
    const response = await authFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ reason, revokedBy }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to revoke device');
    }
  },

  /**
   * Reactivate a suspended device
   */
  async reactivateDevice(tenantId: string, deviceId: string, reactivatedBy: string): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/devices/${deviceId}/reactivate`;
    const response = await authFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ reactivatedBy }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to reactivate device');
    }
  },

  /**
   * Update device name
   */
  async updateDeviceName(tenantId: string, deviceId: string, newName: string): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/devices/${deviceId}/name`;
    const response = await authFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ name: newName }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update device name');
    }
  },

  // ==================== CHAIN MANAGEMENT API ====================

  /**
   * Create a restaurant chain
   */
  async createChain(chainData: any): Promise<string> {
    const url = `${BACKEND_URL}/chains`;
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chainData),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] createChain error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create chain');
    }

    return data.chainId;
  },

  /**
   * Get chain details
   */
  async getChain(chainId: string): Promise<any> {
    const url = `${BACKEND_URL}/chains/${chainId}`;
    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] getChain error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch chain');
    }

    return data.chain;
  },

  /**
   * List all locations in a chain
   */
  async listChainLocations(chainId: string): Promise<any[]> {
    const url = `${BACKEND_URL}/chains/${chainId}/locations`;
    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] listChainLocations error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch locations');
    }

    return data.locations || [];
  },

  /**
   * Add a location to a chain
   */
  async addChainLocation(chainId: string, locationData: any): Promise<string> {
    const url = `${BACKEND_URL}/chains/${chainId}/locations`;
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationData),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] addChainLocation error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to add location');
    }

    return data.locationId;
  },

  /**
   * Pull master menu to a location
   */
  async pullMasterMenu(tenantId: string, chainId: string): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/chain/pull-menu`;
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ chainId }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] pullMasterMenu error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to pull master menu');
    }
  },

  /**
   * Get menu overrides for a location
   */
  async getMenuOverrides(tenantId: string): Promise<any[]> {
    const url = `${getTenantApiUrl(tenantId)}/chain/menu-overrides`;
    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] getMenuOverrides error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch menu overrides');
    }

    return data.overrides || [];
  },

  /**
   * Set a menu override for a location
   */
  async setMenuOverride(tenantId: string, itemId: string, overrideData: any): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/chain/menu-overrides`;
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ itemId, ...overrideData }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] setMenuOverride error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to set menu override');
    }
  },

  /**
   * Remove a menu override
   */
  async removeMenuOverride(tenantId: string, itemId: string): Promise<void> {
    const url = `${getTenantApiUrl(tenantId)}/chain/menu-overrides/${itemId}`;
    const response = await authFetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] removeMenuOverride error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to remove menu override');
    }
  },

  /**
   * Get consolidated sales report for a chain
   */
  async getChainSalesReport(chainId: string, startDate: string, endDate: string): Promise<any> {
    const url = `${BACKEND_URL}/chains/${chainId}/reports/sales?start=${startDate}&end=${endDate}`;
    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] getChainSalesReport error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch chain sales report');
    }

    return data.report;
  },

  /**
   * Get chain-wide menu analytics
   */
  async getChainMenuAnalytics(chainId: string, startDate: string, endDate: string): Promise<any> {
    const url = `${BACKEND_URL}/chains/${chainId}/reports/menu?start=${startDate}&end=${endDate}`;
    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] getChainMenuAnalytics error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch menu analytics');
    }

    return data.analytics;
  },

  /**
   * Get cross-location staff report
   */
  async getChainStaffReport(chainId: string): Promise<any> {
    const url = `${BACKEND_URL}/chains/${chainId}/reports/staff`;
    const response = await authFetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[BackendAPI] getChainStaffReport error response:', text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: Chain API endpoint may not be available`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch staff report');
    }

    return data.report;
  },
};

export default backendApi;
