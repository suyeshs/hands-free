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

// API URLs - use environment variables or detect local server
const getApiUrls = () => {
  // Check if we're accessing via cloudflared tunnel (local server)
  const hostname = window.location.hostname;
  const isLocalServer =
    hostname.includes('trycloudflare.com') || // Quick Tunnel
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    import.meta.env.VITE_USE_LOCAL_SERVER === 'true';

  if (isLocalServer) {
    // Use local server with relative URLs
    return {
      ordersUrl: '', // Relative URLs will use same origin
      clientUrl: '',
      isLocal: true,
    };
  }

  // Use cloud APIs for cloud deployment
  return {
    ordersUrl: import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev',
    clientUrl: import.meta.env.VITE_HANDSFREE_API_URL || 'https://handsfree-restaurant-client.suyesh.workers.dev',
    isLocal: false,
  };
};

/**
 * Get table information for guest ordering page
 * This is a public endpoint - no auth required
 */
export async function getTableInfo(
  tenantId: string,
  tableId: string
): Promise<GuestTableInfo> {
  const { ordersUrl, isLocal } = getApiUrls();

  if (isLocal) {
    // Local server doesn't need table info endpoint
    // Return mock data since we get table from URL parameter
    return {
      tableId,
      tableNumber: parseInt(tableId) || 0,
      capacity: 4,
      sectionId: 'main',
      sectionName: 'Main Dining',
      status: 'available' as const,
      restaurantName: tenantId,
      restaurantLogo: undefined,
    };
  }

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
  const { clientUrl, isLocal } = getApiUrls();

  // Use local server endpoint if available
  const url = isLocal ? '/api/menu' : `${clientUrl}/api/menu-d1/${tenantId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get menu: ${error}`);
  }

  const data = await response.json();

  // Transform local server response to match expected format
  if (isLocal && data.categories) {
    // Local server returns: { success, categories: [{ name, items }], restaurant_name }
    // Frontend expects: { categories, items }
    const allItems = data.categories.flatMap((cat: any) =>
      cat.items.map((item: any) => ({ ...item, category: cat.name }))
    );
    return {
      categories: data.categories.map((cat: any) => ({ name: cat.name })),
      items: allItems,
    };
  }

  return data;
}

/**
 * Submit a guest order
 * This is a public endpoint - no auth required
 */
export async function submitGuestOrder(
  tenantId: string,
  order: GuestOrder
): Promise<GuestOrderResponse> {
  const { ordersUrl, isLocal } = getApiUrls();

  if (isLocal) {
    // Use local server endpoint
    const localOrder = {
      table_number: order.tableId,
      items: order.items.map((item) => ({
        item_id: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        notes: item.specialInstructions || item.modifiers?.map((m) => m.name).join(', '),
      })),
      customer_name: order.guestName,
      customer_phone: undefined, // Not captured in current guest order type
      special_instructions: order.specialInstructions,
    };

    const response = await fetch('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(localOrder),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to submit order: ${error}`);
    }

    const result = await response.json();

    // Calculate total from items
    const total = order.items.reduce((sum, item) => {
      const modifierTotal = item.modifiers?.reduce((mSum, mod) => mSum + mod.priceAdjustment, 0) || 0;
      return sum + (item.price + modifierTotal) * item.quantity;
    }, 0);

    // Transform local server response to match expected format
    return {
      orderId: result.order_id,
      orderNumber: result.order_id,
      status: 'pending' as const,
      estimatedTime: result.estimated_time,
      tableNumber: parseInt(order.tableId) || 0,
      total,
    };
  }

  // Use cloud API
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
  const { ordersUrl, isLocal } = getApiUrls();

  if (isLocal) {
    // Use local server endpoint
    const response = await fetch(`/api/order/${orderId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get order status: ${error}`);
    }

    const result = await response.json();

    // Transform local server response
    return {
      status: result.order?.status || 'pending',
      orderNumber: orderId,
      estimatedTime: 20, // Default estimate
      items: [], // Local server doesn't return items in status endpoint
    };
  }

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
  const { ordersUrl, isLocal } = getApiUrls();

  if (isLocal) {
    // Use local server endpoint
    const requestTypeMap = {
      call_waiter: 'Waiter Assistance',
      bill_request: 'Bill Please',
      need_help: 'Need Help',
    };

    const response = await fetch('/api/call-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        table_number: tableId,
        requests: [requestTypeMap[type]],
        custom_request: null,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429) {
        throw new Error('Please wait before sending another request');
      }
      throw new Error(`Failed to send request: ${error}`);
    }

    const result = await response.json();
    return {
      requestId: `staff-call-${Date.now()}`,
      message: result.message || 'Staff has been notified',
    };
  }

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
