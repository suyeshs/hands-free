/**
 * Subscription Meals Plugin - Type Definitions
 */

export interface SubscriptionPlan {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  price_per_week: number;
  meals_per_week: number;
  delivery_days: string[]; // ["monday", "wednesday", "friday"]
  active: boolean;
  cuisine_types?: string[];
  meal_selection_limit: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionCuisineType {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  icon?: string;
  active: boolean;
  created_at: string;
}

export interface SubscriptionCustomer {
  id: string;
  tenant_id: string;
  customer_phone: string;
  customer_name: string;
  customer_email?: string;
  subscription_plan_id: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  start_date: string;
  end_date?: string;
  next_billing_date?: string;
  
  // Gated community address
  tower_number: string;
  apartment_number: string;
  floor_number?: string;
  distance_from_kitchen?: number;
  delivery_notes?: string;
  
  preferred_cuisine_type?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionMenuWeek {
  id: string;
  tenant_id: string;
  week_number: number; // ISO week (1-52)
  year: number;
  cuisine_type: string;
  start_date: string; // Monday
  end_date: string; // Sunday
  active: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionMenuItem {
  id: string;
  menu_week_id: string;
  menu_item_id: string;
  available: boolean;
  max_orders_per_week?: number;
  sort_order: number;
  created_at: string;
}

export interface SelectedMealItem {
  menuItemId: string;
  quantity: number;
}

export interface SubscriptionPreference {
  id: string;
  subscription_id: string;
  menu_week_id: string;
  selected_items: SelectedMealItem[];
  delivery_day: string;
  delivery_time_slot: string;
  special_instructions?: string;
  order_cutoff_passed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionDelivery {
  id: string;
  tenant_id: string;
  subscription_id: string;
  preference_id: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  status: 'scheduled' | 'preparing' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled';
  
  // Delivery details
  tower_number: string;
  apartment_number: string;
  distance_from_kitchen?: number;
  delivery_notes?: string;
  
  assigned_driver?: string;
  delivered_at?: string;
  delivery_proof?: string; // Photo URL
  
  created_at: string;
  updated_at: string;
}

export interface SubscriptionOrder {
  id: string;
  delivery_id: string;
  order_id?: string;
  tenant_id: string;
  items: SelectedMealItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method?: string;
  created_at: string;
}

export interface DashboardStats {
  active_subscribers: number;
  todays_deliveries: number;
  this_week_deliveries: number;
  weekly_mrr: number;
  tower_distribution: Record<string, number>;
}

export interface DeliveryRoute {
  time_slot: string;
  deliveries: SubscriptionDelivery[];
  total_distance: number;
}
