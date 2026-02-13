/**
 * Subscription Meals Plugin - TypeScript Type Definitions
 *
 * Comprehensive types for weekly meal subscription service
 * including plans, menus, customers, deliveries, and orders.
 */

import { MenuItem } from './index';

// ========================================
// Core Entity Types
// ========================================

/**
 * Subscription Plan Configuration
 */
export interface SubscriptionPlan {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  pricePerWeek: number;
  mealsPerWeek: number;
  deliveryDays: string[]; // ["monday", "wednesday", "friday"]
  active: boolean;
  cuisineTypes?: string[]; // ["north_indian", "south_indian"]
  mealSelectionLimit: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Cuisine Type Definition
 */
export interface CuisineType {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string; // emoji or icon name
  active: boolean;
  createdAt: string;
}

/**
 * Subscription Customer Status
 */
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

/**
 * Subscription Customer with Gated Community Address
 */
export interface SubscriptionCustomer {
  id: string;
  tenantId: string;
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  subscriptionPlanId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate?: string;
  nextBillingDate?: string;

  // Gated community specific fields
  towerNumber: string;
  apartmentNumber: string;
  floorNumber?: string;
  distanceFromKitchen?: number; // in meters
  deliveryNotes?: string;

  preferredCuisineType?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Weekly Menu by Cuisine
 */
export interface WeeklyMenu {
  id: string;
  tenantId: string;
  weekNumber: number; // ISO week (1-52)
  year: number;
  cuisineType: string;
  startDate: string; // Monday
  endDate: string; // Sunday
  active: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Menu Item in Weekly Subscription Menu
 */
export interface SubscriptionMenuItem {
  id: string;
  menuWeekId: string;
  menuItemId: string; // FK to menu_items
  available: boolean;
  maxOrdersPerWeek?: number;
  sortOrder: number;
  createdAt: string;
}

/**
 * Selected Item with Quantity
 */
export interface SelectedMealItem {
  menuItemId: string;
  quantity: number;
}

/**
 * Customer Meal Selection for a Week
 */
export interface MealPreference {
  id: string;
  subscriptionId: string;
  menuWeekId: string;
  selectedItems: SelectedMealItem[]; // JSON
  deliveryDay: string;
  deliveryTimeSlot: string; // "11:00-13:00"
  specialInstructions?: string;
  orderCutoffPassed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Delivery Status Types
 */
export type DeliveryStatus =
  | 'scheduled'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled';

/**
 * Individual Delivery Instance
 */
export interface SubscriptionDelivery {
  id: string;
  tenantId: string;
  subscriptionId: string;
  preferenceId: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  status: DeliveryStatus;

  // Delivery details
  towerNumber: string;
  apartmentNumber: string;
  distanceFromKitchen?: number;
  deliveryNotes?: string;

  assignedDriver?: string;
  deliveredAt?: string;
  deliveryProof?: string; // Photo URL

  createdAt: string;
  updatedAt: string;
}

/**
 * Payment Status Types
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * Order Linked to Delivery
 */
export interface SubscriptionOrder {
  id: string;
  deliveryId: string;
  orderId?: string; // FK to orders table
  tenantId: string;
  items: SelectedMealItem[]; // JSON
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  createdAt: string;
}

// ========================================
// Extended Types with Relations
// ========================================

/**
 * Subscription Customer with Plan Details
 */
export interface SubscriptionCustomerWithPlan extends SubscriptionCustomer {
  plan: SubscriptionPlan;
}

/**
 * Weekly Menu with Items
 */
export interface WeeklyMenuWithItems extends WeeklyMenu {
  items: (SubscriptionMenuItem & { menuItem: MenuItem })[];
}

/**
 * Delivery with Customer and Preference Details
 */
export interface DeliveryWithDetails extends SubscriptionDelivery {
  customer: SubscriptionCustomer;
  preference: MealPreference;
  order?: SubscriptionOrder;
}

/**
 * Meal Preference with Menu Details
 */
export interface MealPreferenceWithMenu extends MealPreference {
  menu: WeeklyMenu;
  items: (SelectedMealItem & { menuItem: MenuItem })[];
}

// ========================================
// Input/Form Types
// ========================================

/**
 * Create Subscription Plan Input
 */
export interface CreateSubscriptionPlanInput {
  name: string;
  description?: string;
  pricePerWeek: number;
  mealsPerWeek: number;
  deliveryDays: string[];
  cuisineTypes?: string[];
  mealSelectionLimit: number;
}

/**
 * Subscribe Input (Customer Registration)
 */
export interface SubscribeInput {
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  subscriptionPlanId: string;
  towerNumber: string;
  apartmentNumber: string;
  floorNumber?: string;
  deliveryNotes?: string;
  preferredCuisineType?: string;
}

/**
 * Create Weekly Menu Input
 */
export interface CreateWeeklyMenuInput {
  weekNumber: number;
  year: number;
  cuisineType: string;
  startDate: string;
  endDate: string;
}

/**
 * Excel Menu Upload Row
 */
export interface MenuExcelRow {
  itemName: string;
  category: string;
  price: number;
  description?: string;
  available: boolean;
  maxOrders?: number;
}

/**
 * Select Meals Input
 */
export interface SelectMealsInput {
  subscriptionId: string;
  menuWeekId: string;
  selectedItems: SelectedMealItem[];
  deliveryDay: string;
  deliveryTimeSlot: string;
  specialInstructions?: string;
}

/**
 * Update Delivery Status Input
 */
export interface UpdateDeliveryStatusInput {
  deliveryId: string;
  status: DeliveryStatus;
  assignedDriver?: string;
  deliveryProof?: string;
}

// ========================================
// Filter/Query Types
// ========================================

/**
 * Customer Filters
 */
export interface CustomerFilters {
  status?: SubscriptionStatus;
  towerNumber?: string;
  searchQuery?: string; // phone or name
  offset?: number;
  limit?: number;
}

/**
 * Delivery Filters
 */
export interface DeliveryFilters {
  date?: string;
  dateRange?: { start: string; end: string };
  status?: DeliveryStatus;
  towerNumber?: string;
  timeSlot?: string;
  offset?: number;
  limit?: number;
}

/**
 * Menu Week Filters
 */
export interface MenuWeekFilters {
  year?: number;
  cuisineType?: string;
  active?: boolean;
  published?: boolean;
  offset?: number;
  limit?: number;
}

// ========================================
// Statistics/Dashboard Types
// ========================================

/**
 * Subscription Statistics
 */
export interface SubscriptionStats {
  totalSubscribers: number;
  activeSubscribers: number;
  pausedSubscribers: number;
  todayDeliveries: number;
  thisWeekDeliveries: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  churnRate: number; // percentage
  averageRevenuePerUser: number;
}

/**
 * Tower Distribution Statistics
 */
export interface TowerDistribution {
  towerNumber: string;
  subscriberCount: number;
  deliveryCount: number;
  averageDistance: number;
}

/**
 * Delivery Schedule Group
 */
export interface DeliveryScheduleGroup {
  timeSlot: string;
  deliveries: DeliveryWithDetails[];
  totalDeliveries: number;
}

/**
 * Tower Delivery Route
 */
export interface TowerDeliveryRoute {
  towerNumber: string;
  deliveries: DeliveryWithDetails[];
  totalDistance: number;
  estimatedTime: number; // in minutes
}

// ========================================
// Utility Types
// ========================================

/**
 * Week Information
 */
export interface WeekInfo {
  weekNumber: number;
  year: number;
  startDate: string; // Monday
  endDate: string; // Sunday
  orderCutoffDate: string; // Previous Sunday 12pm
  canOrder: boolean;
}

/**
 * Time Slot Option
 */
export interface TimeSlot {
  value: string; // "11:00-13:00"
  label: string; // "11:00 AM - 1:00 PM"
  available: boolean;
}

/**
 * Tower Configuration
 */
export interface TowerConfig {
  towerNumber: string;
  name: string;
  distanceFromKitchen: number; // in meters
  floors: number;
  apartmentsPerFloor: number;
}

/**
 * Gated Community Configuration
 */
export interface GatedCommunityConfig {
  name: string;
  totalApartments: number;
  towers: TowerConfig[];
}

// ========================================
// API Response Types
// ========================================

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * API Success Response
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * API Error Response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
}

/**
 * API Response
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ========================================
// Event Types (for event emission)
// ========================================

/**
 * Subscription Created Event
 */
export interface SubscriptionCreatedEvent {
  subscriptionId: string;
  customerId: string;
  planId: string;
  timestamp: string;
}

/**
 * Subscription Cancelled Event
 */
export interface SubscriptionCancelledEvent {
  subscriptionId: string;
  customerId: string;
  reason?: string;
  timestamp: string;
}

/**
 * Menu Updated Event
 */
export interface MenuUpdatedEvent {
  menuWeekId: string;
  weekNumber: number;
  year: number;
  cuisineType: string;
  timestamp: string;
}

/**
 * Order Reminder Event
 */
export interface OrderReminderEvent {
  subscriptionId: string;
  customerPhone: string;
  weekNumber: number;
  cutoffDate: string;
  timestamp: string;
}
