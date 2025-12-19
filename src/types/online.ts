/**
 * Online Order Types
 * For direct orders from restaurant website/app
 */

import { MenuCategory } from './pos';

export type OnlineOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type OnlineOrderType = 'delivery' | 'pickup';

export interface OnlineCustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string | null;
  coordinates?: {
    lat: number;
    lng: number;
  } | null;
}

export interface OnlineOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  specialInstructions?: string | null;
  variants?: string[];
  addons?: any[];
  category?: MenuCategory;
}

export interface OnlineCart {
  items: OnlineOrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
}

export interface OnlinePayment {
  method: string;
  status: string;
  isPrepaid: boolean;
  transactionId?: string;
}

export interface OnlineOrder {
  // Order info
  id: string;
  orderNumber: string;
  status: OnlineOrderStatus;
  orderType: OnlineOrderType;

  // Timestamps
  createdAt: string;
  confirmedAt?: string | null;
  readyAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;

  // Customer
  customer: OnlineCustomer;

  // Cart
  cart: OnlineCart;

  // Payment
  payment: OnlinePayment;

  // Special instructions
  specialInstructions?: string | null;

  // Delivery info
  deliveryTime?: string; // Estimated delivery time
  deliveryInstructions?: string | null;
}

export interface OnlineOrderFilter {
  status: OnlineOrderStatus | 'all';
}

export interface OnlineOrderStats {
  total: number;
  pending: number;
  preparing: number;
  ready: number;
}
