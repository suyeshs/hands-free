/**
 * Guest Order Types
 * Types for QR code-based dine-in ordering
 */

/**
 * Guest session stored in localStorage
 * Tracks the guest's ordering session at a table
 */
export interface GuestSession {
  sessionToken: string;
  tableId: string;
  tenantId: string;
  createdAt: string;
  lastActiveAt: string;
  orderIds: string[];
  guestName?: string;
}

/**
 * Cart item for guest ordering
 */
export interface GuestCartItem {
  id: string; // Unique cart item ID
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: GuestCartModifier[];
  specialInstructions?: string;
}

export interface GuestCartModifier {
  id: string;
  name: string;
  priceAdjustment: number;
}

/**
 * Guest order submission payload
 */
export interface GuestOrder {
  sessionToken: string;
  tableId: string;
  items: GuestCartItem[];
  paymentMethod: 'pay_now' | 'pay_later';
  guestName?: string;
  specialInstructions?: string;
}

/**
 * Guest order response from API
 */
export interface GuestOrderResponse {
  orderId: string;
  orderNumber: string;
  status: GuestOrderStatus;
  estimatedTime?: number; // Minutes
  tableNumber: number;
  total: number;
}

export type GuestOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

/**
 * Service request types (Call Waiter)
 */
export type ServiceRequestType = 'call_waiter' | 'bill_request' | 'need_help';

/**
 * Service request from guest
 */
export interface ServiceRequest {
  id: string;
  tableId: string;
  tableNumber: number;
  sectionId: string;
  sectionName?: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
}

export type ServiceRequestStatus = 'pending' | 'acknowledged' | 'resolved';

/**
 * Table info response for guest pages
 */
export interface GuestTableInfo {
  tableId: string;
  tableNumber: number;
  capacity: number;
  sectionId: string;
  sectionName: string;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  restaurantName: string;
  restaurantLogo?: string;
}

/**
 * Session storage key format
 */
export const GUEST_SESSION_KEY_PREFIX = 'qr-session';

export function getGuestSessionKey(tenantId: string, tableId: string): string {
  return `${GUEST_SESSION_KEY_PREFIX}-${tenantId}-${tableId}`;
}

/**
 * Session expiry time (4 hours in milliseconds)
 */
export const SESSION_EXPIRY_MS = 4 * 60 * 60 * 1000;

/**
 * Service request cooldown (30 seconds)
 */
export const SERVICE_REQUEST_COOLDOWN_MS = 30 * 1000;
