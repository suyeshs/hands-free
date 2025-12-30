/**
 * Aggregator Order Types (Zomato, Swiggy)
 */

import { MenuCategory } from './pos';

export type AggregatorSource = 'zomato' | 'swiggy' | 'direct';

export type AggregatorOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'pending_pickup'    // Waiting for delivery partner to collect
  | 'picked_up'         // Delivery partner has collected the order
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface AggregatorCustomer {
  name: string;
  phone: string | null;
  address: string | null;
  coordinates?: {
    lat: number;
    lng: number;
  } | null;
}

export interface AggregatorOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  specialInstructions?: string | null;
  variants: string[];
  addons: any[];
  category?: MenuCategory; // Optional category for auto-accept rule matching
}

export interface AggregatorCart {
  items: AggregatorOrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  total: number;
}

export interface AggregatorPayment {
  method: string;
  status: string;
  isPrepaid: boolean;
}

export interface AggregatorDelivery {
  type: 'aggregator';
  estimatedTime?: string;
  instructions?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
}

export interface AggregatorOrder {
  // Aggregator metadata
  aggregator: AggregatorSource;
  aggregatorOrderId: string;
  aggregatorStatus: string;

  // Order info
  orderId: string; // Format: aggregator_id
  orderNumber: string;
  status: AggregatorOrderStatus;
  orderType: 'delivery' | 'pickup';

  // Timestamps
  createdAt: string;
  acceptedAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;  // When delivery partner collected the order
  deliveredAt?: string | null;
  archivedAt?: string | null;  // When order was archived (dismissed or auto-archived after delivery)

  // Customer
  customer: AggregatorCustomer;

  // Cart
  cart: AggregatorCart;

  // Payment
  payment: AggregatorPayment;

  // Delivery
  delivery?: AggregatorDelivery | null;

  // Special instructions
  specialInstructions?: string | null;

  // Raw data (for debugging)
  rawData?: any;
}

export interface AggregatorFilter {
  aggregator: 'all' | AggregatorSource;
  status: AggregatorOrderStatus | 'all';
}

export interface AggregatorStats {
  total: number;
  new: number;
  preparing: number;
  ready: number;
  pendingPickup: number;
  pickedUp: number;
}
