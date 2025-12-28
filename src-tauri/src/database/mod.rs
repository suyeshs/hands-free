/**
 * Database Module
 *
 * Contains both the regular POS database schema and the encrypted secrets database.
 */

pub mod encrypted;

use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct MenuItem {
    pub id: String,
    pub category_id: String,
    pub name: String,
    pub description: String,
    pub price: f64,
    pub image: Option<String>,
    pub active: bool,
    pub preparation_time: i32,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct MenuCategory {
    pub id: String,
    pub name: String,
    pub sort_order: i32,
    pub active: bool,
    pub icon: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub table_id: Option<String>,
    pub server_id: String,
    pub status: String,
    pub subtotal: f64,
    pub tax: f64,
    pub total: f64,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Table {
    pub id: String,
    pub number: i32,
    pub capacity: i32,
    pub section: String,
    pub status: String,
    pub position_x: f64,
    pub position_y: f64,
    pub current_order_id: Option<String>,
}

pub const INIT_SQL: &str = r#"
-- Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT 1,
    icon TEXT
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    preparation_time INTEGER NOT NULL DEFAULT 15,
    allergens TEXT,
    dietary_tags TEXT,
    FOREIGN KEY (category_id) REFERENCES menu_categories(id)
);

-- Tables
CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    section TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    current_order_id TEXT
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    table_id TEXT,
    server_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (table_id) REFERENCES tables(id),
    FOREIGN KEY (server_id) REFERENCES users(id)
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    modifiers TEXT,
    special_instructions TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    reference TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Menu data will be synced from HandsFree API on login
-- No demo seed data needed

INSERT OR IGNORE INTO tables (id, number, capacity, section, status, position_x, position_y) VALUES
    ('table-1', 1, 2, 'Main', 'available', 100, 100),
    ('table-2', 2, 4, 'Main', 'available', 250, 100),
    ('table-3', 3, 4, 'Main', 'available', 400, 100),
    ('table-4', 4, 6, 'Main', 'available', 100, 250),
    ('table-5', 5, 2, 'Patio', 'available', 250, 250),
    ('table-6', 6, 4, 'Patio', 'available', 400, 250);

INSERT OR IGNORE INTO users (id, name, role, pin_code) VALUES
    ('user-1', 'Admin User', 'admin', '1234'),
    ('user-2', 'John Server', 'server', '5678'),
    ('user-3', 'Jane Manager', 'manager', '9999');
"#;
