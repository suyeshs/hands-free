/**
 * Types for Orders Worker
 */

import { OrderNotificationDO } from './durable-objects/order-notification-do';

export interface Env {
  TENANT_DISPATCH: DispatchNamespace;
  TENANT_METADATA: KVNamespace;
  ORDER_NOTIFICATION: DurableObjectNamespace<OrderNotificationDO>;
  TOKEN_MANAGER: Fetcher;
  ENVIRONMENT: string;
  CLOUDFLARE_ACCOUNT_ID: string;
}

export interface TenantConfig {
  tenantId: string;
  databaseId: string;
  workerName: string;
  status: 'active' | 'suspended';
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  itemTotal: number;
  modifiers?: string | null;
  customization?: string | null;
  specialInstructions?: string | null;
  category?: string | null;
  spiceLevel?: string | null;
  isVegetarian?: boolean;
  isVegan?: boolean;
}

export interface OrderPayload {
  orderType: 'dine_in' | 'dine-in' | 'takeaway' | 'delivery';
  tableNumber?: number | null;
  items: OrderItem[];
  subtotal: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string | null;
  deliveryInstructions?: string | null;
  notes?: string;
  status?: string;
  source?: string;
  createdBy?: string | null;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  createdAt?: string;
  error?: string;
}
