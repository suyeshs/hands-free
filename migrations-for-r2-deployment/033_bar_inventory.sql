-- Migration 033: Bar Inventory Management
-- Comprehensive inventory tracking for bar operations
-- Supports bottle-level and pour-level tracking
-- Created: 2026-01-23

-- ============================================
-- Bar Inventory Items
-- ============================================
-- Tracks liquor bottles, mixers, garnishes, glassware
CREATE TABLE IF NOT EXISTS bar_inventory_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    inventory_item_id TEXT, -- FK to inventory_items (optional integration)
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'spirits', 'wine', 'beer', 'mixers', 'garnishes', 'glassware'
    subcategory TEXT, -- 'whiskey', 'vodka', 'gin', 'rum', 'tequila', etc.

    -- Bottle/Container details
    container_type TEXT, -- 'bottle', 'keg', 'can', 'jar'
    container_size_ml INTEGER NOT NULL, -- Standard bottle size in ml (750ml, 1000ml, etc.)
    cost_per_container REAL NOT NULL DEFAULT 0, -- Purchase cost per bottle/keg

    -- Current stock
    full_containers INTEGER NOT NULL DEFAULT 0, -- Number of unopened bottles
    partial_container_ml REAL NOT NULL DEFAULT 0, -- Amount in opened bottle (ml)

    -- Par levels
    par_level INTEGER DEFAULT 2, -- Minimum bottles to keep in stock
    reorder_point INTEGER DEFAULT 1, -- When to reorder

    -- Tracking
    last_restocked_at TEXT,
    last_counted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_bar_inventory_tenant
    ON bar_inventory_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bar_inventory_category
    ON bar_inventory_items(category, subcategory);

CREATE INDEX IF NOT EXISTS idx_bar_inventory_stock
    ON bar_inventory_items(full_containers, partial_container_ml);

-- ============================================
-- Bar Drink Recipes
-- ============================================
-- Links drinks to their primary ingredients
CREATE TABLE IF NOT EXISTS bar_recipes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL, -- FK to menu_items
    drink_name TEXT NOT NULL,

    -- Recipe metadata
    category TEXT, -- 'cocktail', 'shot', 'mixed', 'beer', 'wine'
    glassware TEXT, -- 'highball', 'rocks', 'martini', 'shot', 'pint'
    ice_type TEXT, -- 'cubed', 'crushed', 'no-ice'

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE INDEX IF NOT EXISTS idx_bar_recipes_tenant
    ON bar_recipes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bar_recipes_menu_item
    ON bar_recipes(menu_item_id);

-- ============================================
-- Bar Recipe Ingredients
-- ============================================
-- Defines what goes into each drink
CREATE TABLE IF NOT EXISTS bar_recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL, -- FK to bar_inventory_items

    -- Quantity per serving
    quantity_ml REAL NOT NULL, -- Amount of this ingredient per drink
    quantity_unit TEXT DEFAULT 'ml', -- 'ml', 'oz', 'dash', 'slice', 'wedge'
    is_optional INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,

    created_at TEXT NOT NULL,

    FOREIGN KEY (recipe_id) REFERENCES bar_recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_item_id) REFERENCES bar_inventory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON bar_recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item
    ON bar_recipe_ingredients(inventory_item_id);

-- ============================================
-- Bar Inventory Transactions
-- ============================================
-- Track every pour/usage/restock
CREATE TABLE IF NOT EXISTS bar_inventory_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL,

    -- Transaction details
    transaction_type TEXT NOT NULL, -- 'sale', 'waste', 'restock', 'adjustment', 'count'
    quantity_ml REAL NOT NULL, -- Amount used/added (negative for usage, positive for restock)

    -- Links to orders (for sales tracking)
    bar_order_id TEXT,
    bar_order_item_id TEXT,

    -- Staff tracking
    staff_id TEXT,
    staff_name TEXT,

    -- Cost tracking
    cost_per_ml REAL, -- Cost per ml at time of transaction
    total_cost REAL, -- Total cost of this transaction

    -- Notes
    reason TEXT, -- For waste/adjustments
    notes TEXT,

    created_at TEXT NOT NULL,

    FOREIGN KEY (inventory_item_id) REFERENCES bar_inventory_items(id),
    FOREIGN KEY (bar_order_id) REFERENCES bar_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_tenant
    ON bar_inventory_transactions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_item
    ON bar_inventory_transactions(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_order
    ON bar_inventory_transactions(bar_order_id);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_date
    ON bar_inventory_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_bar_transactions_type
    ON bar_inventory_transactions(transaction_type);

-- ============================================
-- Bar Closing Sessions
-- ============================================
-- End-of-day reconciliation
CREATE TABLE IF NOT EXISTS bar_closing_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Session details
    session_date TEXT NOT NULL, -- Date of closing (YYYY-MM-DD)
    opened_at TEXT NOT NULL, -- When bar opened
    closed_at TEXT, -- When closing was completed
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'counting', 'closed'

    -- Staff
    opened_by_staff_id TEXT,
    closed_by_staff_id TEXT,

    -- Cash reconciliation
    opening_cash REAL DEFAULT 0,
    closing_cash REAL,
    expected_cash REAL,
    variance_cash REAL,

    -- Sales summary
    total_orders INTEGER DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,
    gross_revenue REAL DEFAULT 0,

    -- Inventory summary
    items_counted INTEGER DEFAULT 0,
    total_variance_ml REAL DEFAULT 0,
    total_waste_ml REAL DEFAULT 0,

    -- Notes
    notes TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bar_closing_tenant_date
    ON bar_closing_sessions(tenant_id, session_date);

CREATE INDEX IF NOT EXISTS idx_bar_closing_status
    ON bar_closing_sessions(status);

-- ============================================
-- Bar Closing Inventory Counts
-- ============================================
-- Snapshot of inventory during closing
CREATE TABLE IF NOT EXISTS bar_closing_counts (
    id TEXT PRIMARY KEY,
    closing_session_id TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL,

    -- Expected vs Actual
    expected_full_bottles INTEGER DEFAULT 0,
    expected_partial_ml REAL DEFAULT 0,
    actual_full_bottles INTEGER DEFAULT 0,
    actual_partial_ml REAL DEFAULT 0,

    -- Variance
    variance_bottles INTEGER DEFAULT 0,
    variance_ml REAL DEFAULT 0,
    variance_cost REAL DEFAULT 0,

    -- Notes
    notes TEXT,
    counted_at TEXT NOT NULL,

    FOREIGN KEY (closing_session_id) REFERENCES bar_closing_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_item_id) REFERENCES bar_inventory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_closing_counts_session
    ON bar_closing_counts(closing_session_id);

CREATE INDEX IF NOT EXISTS idx_closing_counts_item
    ON bar_closing_counts(inventory_item_id);
