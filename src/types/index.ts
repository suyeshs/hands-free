// Database Types
export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  name_local?: string | null; // Global field: local script name
  description: string;
  description_local?: string | null; // Global field: local script description
  price: number;
  currency?: string; // Global field: INR, USD, EUR, etc.
  image?: string;
  active: boolean;
  preparation_time: number; // in minutes

  // Dietary & Allergen flags (Global fields)
  is_veg?: boolean;
  is_vegan?: boolean;
  is_halal?: boolean;
  is_kosher?: boolean;
  contains_gluten?: boolean;
  contains_dairy?: boolean;
  contains_nuts?: boolean;
  contains_shellfish?: boolean;
  allergens?: string[];
  dietary_tags?: string[]; // vegetarian, vegan, gluten-free, etc.

  // Additional metadata (Global fields)
  spice_level?: number; // 0-5
  portion_size?: string;
  calories?: number;
  variants?: Array<{ name: string; price_adjustment: number }>;
  addons?: Array<{ name: string; price: number }>;
  is_popular?: boolean;
  is_chef_special?: boolean;

  // Availability schedule (Global fields)
  available_from?: string; // HH:MM
  available_to?: string; // HH:MM
  days_available?: string[]; // ['monday', 'tuesday', ...]

  // Image tracking (Global fields)
  imageUrl?: string | null;
  imageId?: string | null;
  cloudflare_image_id?: string;

  // Combo meal support
  is_combo?: boolean;
  combo_groups?: ComboGroup[];
}

/**
 * Combo Group - A group of items that can be selected in a combo
 * e.g., "Choose your Main", "Choose your Side", "Choose your Drink"
 */
export interface ComboGroup {
  id: string;
  name: string; // e.g., "Choose your Main"
  required: boolean; // Must select from this group
  min_selections: number; // Minimum items to select (usually 1)
  max_selections: number; // Maximum items to select (usually 1)
  items: ComboGroupItem[]; // Available items in this group
}

/**
 * An item option within a combo group
 */
export interface ComboGroupItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  price_adjustment: number; // Additional cost (can be 0 or negative for upgrades/downgrades)
  available: boolean;
  tags?: string[]; // veg, non-veg, etc.
}

/**
 * Dine-in pricing override for a menu item
 * Stored locally in SQLite and persists across menu syncs
 * Allows restaurants to set different prices for dine-in vs delivery/takeout
 */
export interface DineInPricingOverride {
  id: string;
  menuItemId: string;
  tenantId: string;
  dineInPrice: number | null; // null = use cloud price
  dineInAvailable: boolean; // false = hide from dine-in menu
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  icon?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item: MenuItem;
  quantity: number;
  price: number;
  modifiers: OrderModifier[];
  special_instructions?: string;
  status: OrderItemStatus;
  created_at: Date;
}

export interface OrderModifier {
  name: string;
  value: string;
  price_adjustment: number;
}

export enum OrderItemStatus {
  Pending = "pending",
  InProgress = "in_progress",
  Ready = "ready",
  Served = "served",
  Cancelled = "cancelled",
}

export enum OrderStatus {
  Draft = "draft",
  Pending = "pending",
  InProgress = "in_progress",
  Ready = "ready",
  Completed = "completed",
  Cancelled = "cancelled",
}

export interface Order {
  id: string;
  table_id?: string;
  server_id: string;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface Table {
  id: string;
  number: number;
  capacity: number;
  section: string;
  status: TableStatus;
  position_x: number;
  position_y: number;
  current_order_id?: string;
}

export enum TableStatus {
  Available = "available",
  Occupied = "occupied",
  Reserved = "reserved",
  Cleaning = "cleaning",
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin_code: string;
  active: boolean;
}

export enum UserRole {
  Admin = "admin",
  Manager = "manager",
  Server = "server",
  Kitchen = "kitchen",
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  created_at: Date;
}

export enum PaymentMethod {
  Cash = "cash",
  Card = "card",
  UPI = "upi",
  Wallet = "wallet",
}

// AI-specific types
export interface AIRecommendation {
  type: "upsell" | "cross-sell" | "suggestion";
  item: MenuItem;
  confidence: number;
  reason: string;
}

export interface VoiceCommand {
  transcript: string;
  confidence: number;
  intent?: "add_item" | "remove_item" | "modify_item" | "complete_order";
  entities?: {
    item?: string;
    quantity?: number;
    modifier?: string;
  };
}

// UI State Types
export interface CartItem {
  menu_item: MenuItem;
  quantity: number;
  modifiers: OrderModifier[];
  special_instructions?: string;
}

