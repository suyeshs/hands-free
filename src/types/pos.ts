/**
 * Point of Sale (POS) Types
 */

// MenuCategory is now a dynamic string (category ID from backend)
// Legacy hardcoded values kept for reference: 'appetizers' | 'mains' | 'sides' | 'desserts' | 'beverages' | 'specials'
export type MenuCategory = string;

export type OrderType = 'dine-in' | 'takeout' | 'delivery';

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'pending';

export type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface MenuModifier {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: MenuCategory;
  price: number;
  image?: string;
  available: boolean;
  preparationTime?: number; // In minutes
  modifiers?: MenuModifier[];
  tags?: string[]; // veg, non-veg, spicy, etc.
}

export interface CartModifier {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // Unique cart item ID
  menuItem: MenuItem;
  quantity: number;
  modifiers: CartModifier[];
  specialInstructions?: string;
  subtotal: number; // (menuItem.price + sum of modifier prices) * quantity
}

export interface OrderCustomer {
  name?: string;
  phone?: string;
  address?: string;
}

export interface Order {
  id?: string;
  orderNumber?: string;
  orderType: OrderType;
  tableNumber?: number | null;
  customer?: OrderCustomer;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod?: PaymentMethod;
  status: OrderStatus;
  createdAt?: string;
  notes?: string;
}

export interface POSStats {
  todaySales: number;
  ordersToday: number;
  averageOrderValue: number;
  activeOrders: number;
}

/**
 * KOT (Kitchen Order Ticket) tracking
 */
export interface KOTRecord {
  kotNumber: string;
  printedAt: string; // ISO timestamp
  itemIds: string[]; // Cart item IDs included in this KOT
  sentToKitchen: boolean;
}

/**
 * Table Session - tracks an active dine-in table
 */
export interface TableSession {
  tableNumber: number;
  guestCount: number;
  order: Order;
  startedAt: string; // ISO timestamp when table was opened
  serverName?: string;
  kotRecords?: KOTRecord[]; // Track all KOTs printed for this table
  lastKotPrintedAt?: string; // ISO timestamp of last KOT print
}
