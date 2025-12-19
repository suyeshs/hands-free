/**
 * Kitchen Display System Types
 */

export type KitchenOrderStatus =
  | 'pending'
  | 'in_progress'
  | 'ready'
  | 'completed';

export type KitchenItemStatus =
  | 'pending'
  | 'in_progress'
  | 'ready'
  | 'served';

export interface KitchenOrderItem {
  id: string;
  name: string;
  quantity: number;
  status: KitchenItemStatus;
  specialInstructions?: string | null;
  modifiers: Array<{
    name: string;
    value: string;
  }>;
  station?: string; // Grill, Wok, Fryer, etc.
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  orderType: 'dine-in' | 'delivery' | 'pickup' | 'aggregator';
  source?: 'pos' | 'zomato' | 'swiggy' | 'online'; // Source of the order
  status: KitchenOrderStatus;

  // Timestamps
  createdAt: string;
  acceptedAt?: string | null;
  readyAt?: string | null;

  // Items
  items: KitchenOrderItem[];

  // Table info (for dine-in)
  tableNumber?: number | null;

  // Priority/urgency
  isUrgent: boolean;
  elapsedMinutes: number; // Time since order was accepted

  // Aggregator specific
  aggregator?: 'zomato' | 'swiggy';
  estimatedPrepTime?: number; // In minutes
}

export type KitchenStation =
  | 'all'
  | 'grill'
  | 'wok'
  | 'fryer'
  | 'cold'
  | 'beverage'
  | 'dessert';

export interface KitchenStats {
  activeOrders: number;
  pendingItems: number;
  averagePrepTime: number; // In minutes
  oldestOrderMinutes: number;
}
