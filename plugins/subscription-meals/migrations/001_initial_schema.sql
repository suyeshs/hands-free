-- Subscription Meals Plugin - Initial Schema
-- Version: 1
-- Description: Creates tables for weekly subscription meal service

-- 1. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_per_week REAL NOT NULL,
  meals_per_week INTEGER NOT NULL,
  delivery_days TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  cuisine_types TEXT,
  meal_selection_limit INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant ON subscription_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(active);

-- 2. Subscription Cuisine Types
CREATE TABLE IF NOT EXISTS subscription_cuisine_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cuisine_types_tenant ON subscription_cuisine_types(tenant_id);

-- 3. Subscription Customers
CREATE TABLE IF NOT EXISTS subscription_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  subscription_plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_billing_date TEXT,
  tower_number TEXT NOT NULL,
  apartment_number TEXT NOT NULL,
  floor_number TEXT,
  distance_from_kitchen INTEGER,
  delivery_notes TEXT,
  preferred_cuisine_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_customers_tenant ON subscription_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_customers_phone ON subscription_customers(customer_phone);
CREATE INDEX IF NOT EXISTS idx_subscription_customers_status ON subscription_customers(status);
CREATE INDEX IF NOT EXISTS idx_subscription_customers_tower ON subscription_customers(tower_number);

-- 4. Subscription Menu Weeks
CREATE TABLE IF NOT EXISTS subscription_menu_weeks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  cuisine_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  published INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, week_number, year, cuisine_type)
);

CREATE INDEX IF NOT EXISTS idx_menu_weeks_tenant ON subscription_menu_weeks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_weeks_dates ON subscription_menu_weeks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_menu_weeks_cuisine ON subscription_menu_weeks(cuisine_type);

-- 5. Subscription Menu Items
CREATE TABLE IF NOT EXISTS subscription_menu_items (
  id TEXT PRIMARY KEY,
  menu_week_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  available INTEGER DEFAULT 1,
  max_orders_per_week INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (menu_week_id) REFERENCES subscription_menu_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE INDEX IF NOT EXISTS idx_sub_menu_items_week ON subscription_menu_items(menu_week_id);
CREATE INDEX IF NOT EXISTS idx_sub_menu_items_item ON subscription_menu_items(menu_item_id);

-- 6. Subscription Preferences
CREATE TABLE IF NOT EXISTS subscription_preferences (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  menu_week_id TEXT NOT NULL,
  selected_items TEXT NOT NULL,
  delivery_day TEXT NOT NULL,
  delivery_time_slot TEXT NOT NULL,
  special_instructions TEXT,
  order_cutoff_passed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscription_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_week_id) REFERENCES subscription_menu_weeks(id),
  UNIQUE(subscription_id, menu_week_id)
);

CREATE INDEX IF NOT EXISTS idx_preferences_subscription ON subscription_preferences(subscription_id);
CREATE INDEX IF NOT EXISTS idx_preferences_week ON subscription_preferences(menu_week_id);

-- 7. Subscription Deliveries
CREATE TABLE IF NOT EXISTS subscription_deliveries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  preference_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time_slot TEXT NOT NULL,
  status TEXT NOT NULL,
  tower_number TEXT NOT NULL,
  apartment_number TEXT NOT NULL,
  distance_from_kitchen INTEGER,
  delivery_notes TEXT,
  assigned_driver TEXT,
  delivered_at TEXT,
  delivery_proof TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscription_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (preference_id) REFERENCES subscription_preferences(id)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant ON subscription_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_subscription ON subscription_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON subscription_deliveries(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON subscription_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_tower ON subscription_deliveries(tower_number);

-- 8. Subscription Orders
CREATE TABLE IF NOT EXISTS subscription_orders (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL,
  order_id TEXT,
  tenant_id TEXT NOT NULL,
  items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (delivery_id) REFERENCES subscription_deliveries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_orders_delivery ON subscription_orders(delivery_id);
