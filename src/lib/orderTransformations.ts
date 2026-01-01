/**
 * Order Transformation Utilities
 * Transforms POS, Aggregator, and Online orders into KitchenOrder format
 */

import { Order, CartItem, MenuCategory } from '../types/pos';
import { AggregatorOrder, AggregatorOrderItem } from '../types/aggregator';
import { OnlineOrder, OnlineOrderItem } from '../types/online';
import { KitchenOrder, KitchenOrderItem, KitchenItemStatus } from '../types/kds';

/**
 * Maps menu category to kitchen station
 * Now returns the category directly to support dynamic categories from menu
 */
function categoryToStation(category: MenuCategory | string): string {
  // Return the category as-is since we're using dynamic menu categories
  return String(category);
}

/**
 * Transforms a POS CartItem to KitchenOrderItem
 */
function transformCartItemToKitchenItem(cartItem: CartItem): KitchenOrderItem {
  return {
    id: cartItem.id,
    name: cartItem.menuItem.name,
    quantity: cartItem.quantity,
    status: 'pending' as KitchenItemStatus,
    specialInstructions: cartItem.specialInstructions || null,
    modifiers: cartItem.modifiers.map((mod) => ({
      name: mod.name,
      value: mod.price > 0 ? `+₹${mod.price}` : 'included',
    })),
    station: categoryToStation(cartItem.menuItem.category),
  };
}

/**
 * Transforms an AggregatorOrderItem to KitchenOrderItem
 */
function transformAggregatorItemToKitchenItem(
  item: AggregatorOrderItem,
  index: number
): KitchenOrderItem {
  // Combine variants and addons into modifiers format
  const modifiers: Array<{ name: string; value: string }> = [];

  // Add variants
  if (item.variants && item.variants.length > 0) {
    item.variants.forEach((variant) => {
      modifiers.push({
        name: 'Variant',
        value: variant,
      });
    });
  }

  // Add addons
  if (item.addons && item.addons.length > 0) {
    item.addons.forEach((addon: any) => {
      modifiers.push({
        name: typeof addon === 'string' ? 'Addon' : addon.name || 'Addon',
        value: typeof addon === 'string' ? addon : addon.value || addon.name || '',
      });
    });
  }

  return {
    id: item.id || `agg-item-${index}`,
    name: item.name,
    quantity: item.quantity,
    status: 'pending' as KitchenItemStatus,
    specialInstructions: item.specialInstructions || null,
    modifiers,
    station: 'all', // Will be assigned by category mapper in Phase 4
  };
}

/**
 * Options for transforming a POS order to a kitchen order
 */
interface TransformOptions {
  isRunningOrder?: boolean; // True if this is an additional KOT for an existing table
  kotSequence?: number; // KOT number for this table session (1, 2, 3...)
}

/**
 * Transforms a POS Order to KitchenOrder format
 * @param posOrder - The POS order to transform
 * @param _tenantId - Tenant ID for multi-tenancy (unused, for future use)
 * @param options - Optional transform options (isRunningOrder, kotSequence)
 * @returns Partial KitchenOrder (id and orderNumber will be assigned by backend/store)
 */
export function transformPOSToKitchenOrder(
  posOrder: Order,
  _tenantId: string,
  options?: TransformOptions
): Partial<KitchenOrder> {
  // Map POS OrderType to KitchenOrder orderType
  const orderTypeMap: Record<string, 'dine-in' | 'delivery' | 'pickup'> = {
    'dine-in': 'dine-in',
    takeout: 'pickup',
    delivery: 'delivery',
  };

  return {
    // id and orderNumber will be assigned when creating the order
    orderNumber: posOrder.orderNumber || '',
    orderType: orderTypeMap[posOrder.orderType] || 'dine-in',
    source: 'pos',
    status: 'pending',
    createdAt: posOrder.createdAt || new Date().toISOString(),
    acceptedAt: null,
    readyAt: null,
    items: posOrder.items.map(transformCartItemToKitchenItem),
    tableNumber: posOrder.tableNumber || null,
    isUrgent: false,
    elapsedMinutes: 0,
    // Running order flag for additional KOTs on existing tables
    isRunningOrder: options?.isRunningOrder ?? false,
    kotSequence: options?.kotSequence,
  };
}

/**
 * Transforms an Aggregator Order to KitchenOrder format
 * @param aggOrder - The aggregator order to transform
 * @returns Partial KitchenOrder (id will be assigned by backend/store)
 */
export function transformAggregatorToKitchenOrder(
  aggOrder: AggregatorOrder
): Partial<KitchenOrder> {
  // Determine if order is urgent based on time elapsed
  const createdAt = new Date(aggOrder.createdAt);
  const now = new Date();
  const minutesElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
  const isUrgent = minutesElapsed > 15; // Mark as urgent if waiting more than 15 minutes

  // Map aggregator source to valid KitchenOrder source (direct -> pos)
  const sourceMap: Record<string, 'zomato' | 'swiggy' | 'pos'> = {
    zomato: 'zomato',
    swiggy: 'swiggy',
    direct: 'pos', // Map direct orders to POS source
  };

  // Map aggregator to valid type (direct orders don't have aggregator)
  const aggregatorMap: Record<string, 'zomato' | 'swiggy' | undefined> = {
    zomato: 'zomato',
    swiggy: 'swiggy',
    direct: undefined,
  };

  return {
    // id will be assigned when creating the order
    orderNumber: aggOrder.orderNumber,
    orderType: 'aggregator',
    source: sourceMap[aggOrder.aggregator] || 'pos',
    status: 'pending',
    createdAt: aggOrder.createdAt,
    acceptedAt: aggOrder.acceptedAt || null,
    readyAt: aggOrder.readyAt || null,
    items: aggOrder.cart.items.map((item, index) =>
      transformAggregatorItemToKitchenItem(item, index)
    ),
    tableNumber: null,
    isUrgent,
    elapsedMinutes: minutesElapsed,
    aggregator: aggregatorMap[aggOrder.aggregator],
    estimatedPrepTime: 20, // Default 20 minutes, can be overridden
  };
}

/**
 * Helper function to validate transformed KitchenOrder
 * Ensures all required fields are present
 */
export function validateKitchenOrder(order: Partial<KitchenOrder>): boolean {
  // Check required fields
  if (!order.orderNumber) {
    console.error('[OrderTransformation] Missing orderNumber');
    return false;
  }

  if (!order.items || order.items.length === 0) {
    console.error('[OrderTransformation] Missing or empty items array');
    return false;
  }

  if (!order.orderType) {
    console.error('[OrderTransformation] Missing orderType');
    return false;
  }

  // Validate each item
  for (const item of order.items) {
    if (!item.name || !item.quantity) {
      console.error('[OrderTransformation] Invalid item:', item);
      return false;
    }
  }

  return true;
}

/**
 * Transforms an OnlineOrderItem to KitchenOrderItem
 */
function transformOnlineItemToKitchenItem(
  item: OnlineOrderItem,
  index: number
): KitchenOrderItem {
  // Combine variants and addons into modifiers format
  const modifiers: Array<{ name: string; value: string }> = [];

  // Add variants
  if (item.variants && item.variants.length > 0) {
    item.variants.forEach((variant) => {
      modifiers.push({
        name: 'Variant',
        value: variant,
      });
    });
  }

  // Add addons
  if (item.addons && item.addons.length > 0) {
    item.addons.forEach((addon: any) => {
      modifiers.push({
        name: typeof addon === 'string' ? 'Addon' : addon.name || 'Addon',
        value: typeof addon === 'string' ? addon : addon.value || addon.name || '',
      });
    });
  }

  return {
    id: item.id || `online-item-${index}`,
    name: item.name,
    quantity: item.quantity,
    status: 'pending' as KitchenItemStatus,
    specialInstructions: item.specialInstructions || null,
    modifiers,
    station: 'all', // Will be assigned by category mapper
  };
}

/**
 * Transforms an Online Order to KitchenOrder format
 * @param onlineOrder - The online order to transform
 * @returns Partial KitchenOrder (id will be assigned by backend/store)
 */
export function transformOnlineToKitchenOrder(
  onlineOrder: OnlineOrder
): Partial<KitchenOrder> {
  // Determine if order is urgent based on time elapsed
  const createdAt = new Date(onlineOrder.createdAt);
  const now = new Date();
  const minutesElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
  const isUrgent = minutesElapsed > 15; // Mark as urgent if waiting more than 15 minutes

  return {
    // id will be assigned when creating the order
    orderNumber: onlineOrder.orderNumber,
    orderType: onlineOrder.orderType === 'delivery' ? 'delivery' : 'pickup',
    source: 'online',
    status: 'pending',
    createdAt: onlineOrder.createdAt,
    acceptedAt: onlineOrder.confirmedAt || null,
    readyAt: onlineOrder.readyAt || null,
    items: onlineOrder.cart.items.map((item, index) =>
      transformOnlineItemToKitchenItem(item, index)
    ),
    tableNumber: null,
    isUrgent,
    elapsedMinutes: minutesElapsed,
    estimatedPrepTime: 20, // Default 20 minutes, can be overridden
  };
}

/**
 * Creates a complete KitchenOrder with generated ID and current timestamp
 * Used when frontend needs to create KitchenOrders directly
 */
export function createKitchenOrderWithId(
  partialOrder: Partial<KitchenOrder>
): KitchenOrder {
  const now = new Date().toISOString();

  return {
    id: `kitchen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    orderNumber: partialOrder.orderNumber || `#${Math.floor(1000 + Math.random() * 9000)}`,
    orderType: partialOrder.orderType || 'dine-in',
    source: partialOrder.source,
    status: partialOrder.status || 'pending',
    createdAt: partialOrder.createdAt || now,
    acceptedAt: partialOrder.acceptedAt || null,
    readyAt: partialOrder.readyAt || null,
    items: partialOrder.items || [],
    tableNumber: partialOrder.tableNumber || null,
    isUrgent: partialOrder.isUrgent ?? false,
    elapsedMinutes: partialOrder.elapsedMinutes ?? 0,
    aggregator: partialOrder.aggregator,
    estimatedPrepTime: partialOrder.estimatedPrepTime,
    // Running order fields for additional KOTs on existing tables
    isRunningOrder: partialOrder.isRunningOrder ?? false,
    kotSequence: partialOrder.kotSequence,
    // Version and updatedAt for conflict resolution
    version: partialOrder.version ?? 1,
    updatedAt: partialOrder.updatedAt ?? now,
  };
}

/**
 * Backend Order Types
 * Matches the schema expected by stonepot-restaurant backend
 */
export interface BackendOrderItem {
  itemId: string;
  dishName: string;
  quantity: number;
  price: number;
  itemTotal: number;
  customization?: string | null;
}

export interface BackendCart {
  items: BackendOrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

export interface BackendCustomer {
  name: string;
  phone: string;
  email?: string | null;
}

export interface BackendOrder {
  orderType: 'dine-in' | 'takeout' | 'delivery';
  paymentMethod: 'cash' | 'online';
  customer: BackendCustomer;
  cart: BackendCart;
  status: 'confirmed';
  tableNumber?: number | null;
  notes?: string | null;
  tenantId: string;
  source: 'pos';
  createdAt?: string;
}

/**
 * Transforms a POS Order to Backend Order format
 * @param posOrder - The POS order to transform
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Backend order ready for API submission
 */
export function transformPOSOrderToBackend(
  posOrder: Order,
  tenantId: string
): BackendOrder {
  // Map payment methods: card/upi/wallet → 'online', cash → 'cash'
  const paymentMethodMap: Record<string, 'cash' | 'online'> = {
    cash: 'cash',
    card: 'online',
    upi: 'online',
    wallet: 'online',
  };

  // Generate customer info for walk-in/dine-in orders
  const customer: BackendCustomer = {
    name: posOrder.customer?.name ||
          (posOrder.tableNumber ? `Table ${posOrder.tableNumber}` : 'Walk-in Customer'),
    phone: posOrder.customer?.phone || `POS-${Date.now()}`,
    email: posOrder.customer?.address || null, // Using address field for email if available
  };

  // Transform cart items
  const items: BackendOrderItem[] = posOrder.items.map((item) => {
    // Build customization string from modifiers and special instructions
    const modifierText = item.modifiers.length > 0
      ? item.modifiers.map(m => m.name).join(', ')
      : null;
    const customization = [modifierText, item.specialInstructions]
      .filter(Boolean)
      .join(' | ') || null;

    return {
      itemId: item.menuItem.id,
      dishName: item.menuItem.name,
      quantity: item.quantity,
      price: item.menuItem.price,
      itemTotal: item.subtotal,
      customization,
    };
  });

  // Build cart
  const cart: BackendCart = {
    items,
    subtotal: posOrder.subtotal,
    tax: posOrder.tax,
    deliveryFee: 0, // POS doesn't have delivery fee
    total: posOrder.total,
  };

  return {
    orderType: posOrder.orderType,
    paymentMethod: paymentMethodMap[posOrder.paymentMethod || 'cash'] || 'cash',
    customer,
    cart,
    status: 'confirmed', // POS orders are auto-confirmed
    tableNumber: posOrder.tableNumber || null,
    notes: posOrder.notes || null,
    tenantId,
    source: 'pos',
    createdAt: posOrder.createdAt || new Date().toISOString(),
  };
}

/**
 * Validates a backend order before submission
 * @param order - The backend order to validate
 * @returns true if valid, false otherwise
 */
export function validateBackendOrder(order: BackendOrder): boolean {
  // Check required fields
  if (!order.tenantId) {
    console.error('[OrderTransformation] Missing tenantId');
    return false;
  }

  if (!order.customer?.name || !order.customer?.phone) {
    console.error('[OrderTransformation] Missing customer info');
    return false;
  }

  if (!order.cart?.items || order.cart.items.length === 0) {
    console.error('[OrderTransformation] Missing or empty cart items');
    return false;
  }

  // Validate each item
  for (const item of order.cart.items) {
    if (!item.dishName || !item.quantity || item.quantity <= 0) {
      console.error('[OrderTransformation] Invalid cart item:', item);
      return false;
    }
  }

  // Validate totals
  if (order.cart.total <= 0) {
    console.error('[OrderTransformation] Invalid cart total:', order.cart.total);
    return false;
  }

  return true;
}
