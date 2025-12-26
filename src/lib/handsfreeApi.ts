/**
 * Handsfree Platform API Adapter
 *
 * Adapts the POS application to work with the Handsfree Platform APIs.
 * Provides compatibility layer between POS expectations and platform reality.
 * Supports multi-tenant dynamic configuration via tenantStore.
 */

import { useTenantStore } from '../stores/tenantStore';

// Default URLs (used when tenant store is not available or in dev mode)
const DEFAULT_BASE_URL = import.meta.env.VITE_HANDSFREE_API_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev';
const DEFAULT_ORDERS_URL = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';

// Cloudflare Zero Trust Service Token for authenticated API access
const CF_ACCESS_CLIENT_ID = import.meta.env.VITE_CF_ACCESS_CLIENT_ID || '';
const CF_ACCESS_CLIENT_SECRET = import.meta.env.VITE_CF_ACCESS_CLIENT_SECRET || '';

/**
 * Get API URLs from tenant store or fallback to defaults
 */
function getApiUrls(): { baseUrl: string; ordersUrl: string } {
  try {
    const tenant = useTenantStore.getState().tenant;
    return {
      baseUrl: tenant?.apiBaseUrl || DEFAULT_BASE_URL,
      ordersUrl: tenant?.ordersEndpoint || DEFAULT_ORDERS_URL,
    };
  } catch {
    // If store not available (during initialization), use defaults
    return {
      baseUrl: DEFAULT_BASE_URL,
      ordersUrl: DEFAULT_ORDERS_URL,
    };
  }
}

/**
 * Get headers for API requests including CF Zero Trust authentication
 */
function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add Cloudflare Zero Trust headers if configured
  if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
  }

  return headers;
}

// POS MenuItem type (from src/types/index.ts)
export interface POSMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  dietary_tags: string[];
  allergens: string[];
  spice_level: number;
  is_veg: boolean;
  is_vegan: boolean;
  preparation_time: number;
  available: boolean;
  active: boolean;
  image?: string;
  imageUrl?: string;
  imageId?: string;
  variants?: Array<{ name: string; price_adjustment: number }>;
  addons?: Array<{ name: string; price: number }>;
  is_popular: boolean;
}

// Platform MenuItem type (from handsfree platform D1)
interface HandsfreeMenuItem {
  id: string;
  tenant_id: string;
  name: string;
  name_hindi?: string | null;
  category: string;
  description?: string | null;
  price: number;
  photo_url?: string | null;
  cloudflare_image_id?: string | null;
  available: boolean; // comes as 1 or 0, converted to boolean
  is_vegetarian: boolean;
  is_vegan?: boolean;
  spice_level?: string | null;
  allergens?: string | null;
  tags?: string[];
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Transform Platform MenuItem to POS MenuItem
 */
function transformMenuItem(item: HandsfreeMenuItem): POSMenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    price: item.price,
    category_id: item.category,
    dietary_tags: item.tags || [],
    allergens: item.allergens ? item.allergens.split(',').map(a => a.trim()) : [],
    spice_level: item.spice_level ? parseInt(item.spice_level) : 0,
    is_veg: item.is_vegetarian,
    is_vegan: item.is_vegan || false,
    preparation_time: 15, // Default preparation time
    available: item.available,
    active: item.available,
    image: item.photo_url || undefined,
    imageUrl: item.photo_url || undefined,
    imageId: item.cloudflare_image_id || undefined,
    variants: [], // TODO: Extract from tags or separate field
    addons: [], // TODO: Extract from tags or separate field
    is_popular: false, // TODO: Add to platform schema
  };
}

/**
 * Get menu for tenant from Handsfree Platform
 */
export async function getHandsfreeMenu(tenantId: string): Promise<{ items: POSMenuItem[]; count: number }> {
  const { baseUrl } = getApiUrls();
  console.log('[HandsfreeAPI] Fetching menu for tenant:', tenantId, 'from:', baseUrl);

  try {
    // Call handsfree platform menu API
    const response = await fetch(`${baseUrl}/api/menu-d1/${tenantId}?limit=1000`, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Menu API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch menu');
    }

    // Transform platform items to POS format
    const items = (data.items || []).map(transformMenuItem);

    console.log(`[HandsfreeAPI] Loaded ${items.length} menu items`);

    return {
      items,
      count: items.length,
    };
  } catch (error) {
    console.error('[HandsfreeAPI] Error fetching menu:', error);
    throw error;
  }
}

/**
 * Submit order to Handsfree Platform
 */
export interface HandsfreeOrderPayload {
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number | null;
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    modifiers?: Array<{ name: string; price_adjustment: number }>;
    specialInstructions?: string;
  }>;
  subtotal: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  status: string;
}

export async function submitHandsfreeOrder(
  tenantId: string,
  order: HandsfreeOrderPayload
): Promise<{ orderId: string; orderNumber: string }> {
  const { ordersUrl } = getApiUrls();
  console.log('[HandsfreeAPI] Submitting order for tenant:', tenantId, 'to:', ordersUrl);

  try {
    // Transform order payload to match platform expectations
    const platformOrder = {
      tenantId,
      orderType: order.orderType,
      tableNumber: order.tableNumber,
      items: order.items.map(item => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        itemTotal: item.quantity * item.price,
        customization: [
          ...(item.modifiers || []).map(m => `${m.name} (+₹${m.price_adjustment})`),
          item.specialInstructions || '',
        ]
          .filter(Boolean)
          .join(', '),
      })),
      subtotal: order.subtotal,
      tax: order.tax || 0,
      total: order.total,
      paymentMethod: order.paymentMethod || 'cash',
      customerName: order.customerName || `Table ${order.tableNumber || 'Walk-in'}`,
      customerPhone: order.customerPhone || 'N/A',
      notes: order.notes,
      status: order.status || 'pending',
      source: 'pos',
    };

    // Call orders worker API (dedicated worker with direct D1 bindings)
    const response = await fetch(`${ordersUrl}/api/orders/${tenantId}`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(platformOrder),
    });

    if (!response.ok) {
      throw new Error(`Order API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to submit order');
    }

    console.log('[HandsfreeAPI] Order submitted successfully:', data.orderId);

    return {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
    };
  } catch (error) {
    console.error('[HandsfreeAPI] Error submitting order:', error);
    throw error;
  }
}

/**
 * Get order status from Handsfree Platform
 */
export async function getHandsfreeOrderStatus(
  tenantId: string,
  orderId: string
): Promise<{ status: string; updatedAt: string }> {
  const { ordersUrl } = getApiUrls();
  console.log('[HandsfreeAPI] Fetching order status:', orderId, 'from:', ordersUrl);

  try {
    const response = await fetch(`${ordersUrl}/api/orders/${tenantId}/${orderId}`, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Order status API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch order status');
    }

    return {
      status: data.order.status,
      updatedAt: data.order.updated_at,
    };
  } catch (error) {
    console.error('[HandsfreeAPI] Error fetching order status:', error);
    throw error;
  }
}

/**
 * Today's Special Item from API
 */
export interface TodaysSpecialItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  tags?: string[];
  menuItemId?: string;
  sortOrder: number;
}

/**
 * Get today's specials for tenant
 * These are quick-access items (potentially off-menu) managed in admin panel
 * Uses admin-panel API since specials are stored in KV namespace
 */
export async function getTodaysSpecials(tenantId: string): Promise<TodaysSpecialItem[]> {
  const adminPanelUrl = import.meta.env.VITE_ADMIN_PANEL_URL || 'https://handsfree-admin-panel.pages.dev';
  console.log('[HandsfreeAPI] Fetching today\'s specials for tenant:', tenantId);

  try {
    // Fetch from admin-panel API with dine-in channel filter (POS only sees dine-in specials)
    const response = await fetch(`${adminPanelUrl}/api/tenants/${tenantId}/specials?channel=dine-in`, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      console.warn('[HandsfreeAPI] Specials API returned:', response.status);
      return []; // Graceful fallback - don't block POS
    }

    const data = await response.json();

    if (!data.success) {
      console.warn('[HandsfreeAPI] Specials API error:', data.error);
      return [];
    }

    const specials = (data.specials || []).sort(
      (a: TodaysSpecialItem, b: TodaysSpecialItem) => a.sortOrder - b.sortOrder
    );

    console.log(`[HandsfreeAPI] Loaded ${specials.length} today's specials`);
    return specials;
  } catch (error) {
    console.error('[HandsfreeAPI] Error fetching specials:', error);
    return []; // Graceful fallback - never block POS operation
  }
}

// ==================== CUSTOMER MANAGEMENT ====================

/**
 * Customer from API
 */
export interface Customer {
  id: string;
  tenantId: string;
  phone: string;
  name?: string;
  email?: string;
  firstOrderDate?: string;
  lastOrderDate?: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  preferences?: {
    dietary_preferences?: string[];
    favorite_items?: string[];
    spice_preference?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Customer list response
 */
export interface CustomerListResponse {
  success: boolean;
  customers: Customer[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

/**
 * Customer import result
 */
export interface CustomerImportResult {
  success: number;
  failed: number;
  total: number;
  errors: { row: number; phone: string; error: string }[];
  customers: Customer[];
}

/**
 * Get customer management API URL for a tenant
 * Uses the restaurant worker subdomain
 */
function getCustomerApiUrl(tenantId: string): string {
  return `https://${tenantId}.handsfree.tech`;
}

/**
 * List customers with pagination and search
 */
export async function listCustomers(
  tenantId: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<CustomerListResponse> {
  const baseUrl = getCustomerApiUrl(tenantId);
  const params = new URLSearchParams();

  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.search) params.set('search', options.search);
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);

  console.log('[HandsfreeAPI] Listing customers for tenant:', tenantId);

  try {
    const response = await fetch(`${baseUrl}/api/customers?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...getApiHeaders(),
        'X-Tenant-ID': tenantId,
      },
    });

    if (!response.ok) {
      throw new Error(`Customer API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as CustomerListResponse;
  } catch (error) {
    console.error('[HandsfreeAPI] Error listing customers:', error);
    throw error;
  }
}

/**
 * Get a single customer by ID
 */
export async function getCustomer(tenantId: string, customerId: string): Promise<Customer | null> {
  const baseUrl = getCustomerApiUrl(tenantId);
  console.log('[HandsfreeAPI] Getting customer:', customerId);

  try {
    const response = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      method: 'GET',
      headers: {
        ...getApiHeaders(),
        'X-Tenant-ID': tenantId,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Customer API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.customer as Customer;
  } catch (error) {
    console.error('[HandsfreeAPI] Error getting customer:', error);
    throw error;
  }
}

/**
 * Create or update a customer (upsert by phone)
 */
export async function upsertCustomer(
  tenantId: string,
  customer: { phone: string; name?: string; email?: string; notes?: string }
): Promise<Customer> {
  const baseUrl = getCustomerApiUrl(tenantId);
  console.log('[HandsfreeAPI] Upserting customer:', customer.phone);

  try {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        ...getApiHeaders(),
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify(customer),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Customer API failed: ${response.status}`);
    }

    const data = await response.json();
    return data.customer as Customer;
  } catch (error) {
    console.error('[HandsfreeAPI] Error upserting customer:', error);
    throw error;
  }
}

/**
 * Delete a customer
 */
export async function deleteCustomer(tenantId: string, customerId: string): Promise<void> {
  const baseUrl = getCustomerApiUrl(tenantId);
  console.log('[HandsfreeAPI] Deleting customer:', customerId);

  try {
    const response = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      method: 'DELETE',
      headers: {
        ...getApiHeaders(),
        'X-Tenant-ID': tenantId,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Customer API failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[HandsfreeAPI] Error deleting customer:', error);
    throw error;
  }
}

/**
 * Import customers from CSV text
 */
export async function importCustomersFromCSV(
  tenantId: string,
  csvText: string
): Promise<CustomerImportResult> {
  const adminPanelUrl = import.meta.env.VITE_ADMIN_PANEL_URL || 'https://handsfree-admin-panel.pages.dev';
  console.log('[HandsfreeAPI] Importing customers from CSV for tenant:', tenantId);

  try {
    const response = await fetch(`${adminPanelUrl}/api/tenants/${tenantId}/customers-import`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ csvText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Import API failed: ${response.status}`);
    }

    const data = await response.json();
    return data.result as CustomerImportResult;
  } catch (error) {
    console.error('[HandsfreeAPI] Error importing customers:', error);
    throw error;
  }
}

export const handsfreeApi = {
  getMenu: getHandsfreeMenu,
  submitOrder: submitHandsfreeOrder,
  getOrderStatus: getHandsfreeOrderStatus,
  getTodaysSpecials,
  // Customer management
  listCustomers,
  getCustomer,
  upsertCustomer,
  deleteCustomer,
  importCustomersFromCSV,
};

export default handsfreeApi;
