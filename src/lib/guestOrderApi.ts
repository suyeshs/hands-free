/**
 * Guest Order API
 * Public API functions for QR code-based guest ordering
 * These endpoints do not require authentication
 */

import type {
  GuestOrder,
  GuestOrderResponse,
  GuestTableInfo,
  ServiceRequestType,
} from '../types/guest-order';

// API URLs - use environment variables
const getApiUrls = () => ({
  ordersUrl: import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev',
  clientUrl: import.meta.env.VITE_HANDSFREE_API_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev',
});

/**
 * Get table information for guest ordering page
 * This is a public endpoint - no auth required
 */
export async function getTableInfo(
  tenantId: string,
  tableId: string
): Promise<GuestTableInfo> {
  const { ordersUrl } = getApiUrls();

  const response = await fetch(`${ordersUrl}/api/tables/${tenantId}/${tableId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get table info: ${error}`);
  }

  return response.json();
}

/**
 * Get menu for guest ordering
 * Uses the existing public menu endpoint
 */
export async function getGuestMenu(tenantId: string): Promise<any> {
  const { clientUrl } = getApiUrls();

  const response = await fetch(`${clientUrl}/api/menu-d1/${tenantId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get menu: ${error}`);
  }

  return response.json();
}

/**
 * Submit a guest order
 * This is a public endpoint - no auth required
 */
export async function submitGuestOrder(
  tenantId: string,
  order: GuestOrder
): Promise<GuestOrderResponse> {
  const { ordersUrl } = getApiUrls();

  const response = await fetch(`${ordersUrl}/api/qr-orders/${tenantId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...order,
      source: 'qr_code',
      orderType: 'dine_in',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to submit order: ${error}`);
  }

  return response.json();
}

/**
 * Get order status for guest
 * Public endpoint for guests to check their order status
 */
export async function getGuestOrderStatus(
  tenantId: string,
  orderId: string
): Promise<{
  status: string;
  orderNumber: string;
  estimatedTime?: number;
  items: Array<{ name: string; quantity: number; status: string }>;
}> {
  const { ordersUrl } = getApiUrls();

  const response = await fetch(`${ordersUrl}/api/qr-orders/${tenantId}/${orderId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get order status: ${error}`);
  }

  return response.json();
}

/**
 * Send a service request (Call Waiter)
 * Public endpoint - rate limited to 1 request per 30 seconds per table
 */
export async function sendServiceRequest(
  tenantId: string,
  tableId: string,
  type: ServiceRequestType
): Promise<{ requestId: string; message: string }> {
  const { ordersUrl } = getApiUrls();

  const response = await fetch(`${ordersUrl}/api/service-requests/${tenantId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tableId,
      type,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // Check for rate limit error
    if (response.status === 429) {
      throw new Error('Please wait before sending another request');
    }
    throw new Error(`Failed to send request: ${error}`);
  }

  return response.json();
}

/**
 * Get active session for a table
 * Returns session info if guest has an active ordering session
 */
export async function getTableSession(
  tenantId: string,
  tableId: string,
  sessionToken: string
): Promise<{
  valid: boolean;
  orderIds: string[];
  guestName?: string;
} | null> {
  const { ordersUrl } = getApiUrls();

  const response = await fetch(
    `${ordersUrl}/api/tables/${tenantId}/${tableId}/session`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    throw new Error(`Failed to get session: ${error}`);
  }

  return response.json();
}

/**
 * Calculate cart totals
 */
export function calculateCartTotals(items: GuestOrder['items']): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = items.reduce((sum, item) => {
    const modifierTotal = item.modifiers?.reduce(
      (mSum, mod) => mSum + mod.priceAdjustment,
      0
    ) || 0;
    return sum + (item.price + modifierTotal) * item.quantity;
  }, 0);

  // TODO: Make tax rate configurable
  const taxRate = 0.05; // 5% GST
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
