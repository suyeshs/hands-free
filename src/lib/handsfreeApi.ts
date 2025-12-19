/**
 * Handsfree Platform API Adapter
 *
 * Adapts the POS application to work with the Handsfree Platform APIs.
 * Provides compatibility layer between POS expectations and platform reality.
 */

import type { MenuItem as PlatformMenuItem } from './backendApi';

const HANDSFREE_BASE_URL = import.meta.env.VITE_HANDSFREE_API_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev';

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
  console.log('[HandsfreeAPI] Fetching menu for tenant:', tenantId);

  try {
    // Call handsfree platform menu API
    const response = await fetch(`${HANDSFREE_BASE_URL}/api/menu-d1/${tenantId}?limit=1000`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
  console.log('[HandsfreeAPI] Submitting order for tenant:', tenantId);

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

    // Call handsfree platform order API
    const response = await fetch(`${HANDSFREE_BASE_URL}/api/orders/${tenantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
  console.log('[HandsfreeAPI] Fetching order status:', orderId);

  try {
    const response = await fetch(`${HANDSFREE_BASE_URL}/api/orders/${tenantId}/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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

export const handsfreeApi = {
  getMenu: getHandsfreeMenu,
  submitOrder: submitHandsfreeOrder,
  getOrderStatus: getHandsfreeOrderStatus,
};

export default handsfreeApi;
