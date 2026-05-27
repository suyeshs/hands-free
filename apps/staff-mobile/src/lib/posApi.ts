/**
 * POS LAN API
 * Talks to the POS ordering server (actix-web, bound on 0.0.0.0)
 * over the local network. Uses Tauri HTTP plugin when available.
 */

export interface PosMenuItem {
  item_id: string;
  name: string;
  price: number;
  category: string;
  is_veg?: boolean;
  description?: string;
}

export interface PosMenuCategory {
  name: string;
  items: PosMenuItem[];
}

export interface PosMenuResponse {
  success: boolean;
  categories: PosMenuCategory[];
  restaurant_name: string;
}

export interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface PlaceOrderPayload {
  table_number: string;
  items: OrderItem[];
  customer_name?: string;
  special_instructions?: string;
  staff_id?: string;
}

export interface PlaceOrderResult {
  success: boolean;
  order_id: string;
  message: string;
}

async function platformFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, options);
  } catch {
    return fetch(url, options);
  }
}

export async function pingPos(posUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await platformFetch(`${posUrl}/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export async function fetchPosMenu(posUrl: string): Promise<PosMenuResponse> {
  const res = await platformFetch(`${posUrl}/api/menu`, { method: 'GET' });
  if (!res.ok) throw new Error(`Menu fetch failed: ${res.status}`);
  return res.json() as Promise<PosMenuResponse>;
}

export async function placeOrder(
  posUrl: string,
  order: PlaceOrderPayload
): Promise<PlaceOrderResult> {
  const res = await platformFetch(`${posUrl}/api/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((err as any).message || `Order failed: ${res.status}`);
  }
  return res.json() as Promise<PlaceOrderResult>;
}
