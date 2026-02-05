-- Create v1.0 test database schema
CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    permissions TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS table_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    table_number INTEGER NOT NULL,
    guest_count INTEGER NOT NULL,
    server_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    closed_at TEXT,
    status TEXT NOT NULL,
    order_data TEXT NOT NULL
);

-- Insert test staff
INSERT INTO staff_users VALUES 
    ('staff-1', 'coorg-food-company-6163', 'John Manager', 'manager', 'hashed_pin_123', 1, NULL, '2024-01-01T10:00:00Z', NULL, NULL),
    ('staff-2', 'coorg-food-company-6163', 'Jane Cashier', 'cashier', 'hashed_pin_456', 1, NULL, '2024-01-01T10:00:00Z', NULL, NULL),
    ('staff-3', 'coorg-food-company-6163', 'Bob Waiter', 'waiter', 'hashed_pin_789', 1, NULL, '2024-01-01T10:00:00Z', NULL, NULL);

-- Insert test closed sessions with JSON order_data
INSERT INTO table_sessions VALUES 
    ('session-1', 'coorg-food-company-6163', 1, 2, 'Bob Waiter', '2024-02-01T12:00:00Z', '2024-02-01T13:00:00Z', 'closed', 
     '{"subtotal": 500.00, "discount": 0, "order_type": "dine-in", "items": [{"name": "Masala Dosa", "quantity": 2, "price": 150.00}, {"name": "Filter Coffee", "quantity": 2, "price": 50.00}]}'),
    ('session-2', 'coorg-food-company-6163', 2, 4, 'Bob Waiter', '2024-02-01T14:00:00Z', '2024-02-01T15:30:00Z', 'closed',
     '{"subtotal": 1200.00, "discount": 50, "order_type": "dine-in", "items": [{"name": "Chicken Biryani", "quantity": 3, "price": 300.00}, {"name": "Raita", "quantity": 3, "price": 50.00}, {"name": "Gulab Jamun", "quantity": 3, "price": 80.00}]}'),
    ('session-3', 'coorg-food-company-6163', 3, 2, 'Bob Waiter', '2024-02-02T12:30:00Z', '2024-02-02T13:15:00Z', 'closed',
     '{"subtotal": 800.00, "discount": 0, "order_type": "dine-in", "items": [{"name": "Thali", "quantity": 2, "price": 250.00}, {"name": "Lassi", "quantity": 2, "price": 60.00}]}'),
    ('session-4', 'coorg-food-company-6163', 4, 3, 'Bob Waiter', '2024-02-02T18:00:00Z', '2024-02-02T19:30:00Z', 'closed',
     '{"subtotal": 1500.00, "discount": 100, "order_type": "dine-in", "items": [{"name": "Paneer Butter Masala", "quantity": 2, "price": 280.00}, {"name": "Naan", "quantity": 4, "price": 40.00}, {"name": "Dal Makhani", "quantity": 1, "price": 200.00}]}'),
    ('session-5', 'coorg-food-company-6163', 5, 1, 'Bob Waiter', '2024-02-03T13:00:00Z', '2024-02-03T13:45:00Z', 'closed',
     '{"subtotal": 350.00, "discount": 0, "order_type": "dine-in", "items": [{"name": "Veg Pulao", "quantity": 1, "price": 180.00}, {"name": "Raita", "quantity": 1, "price": 50.00}, {"name": "Papad", "quantity": 2, "price": 20.00}]}');

-- Insert one active session
INSERT INTO table_sessions VALUES 
    ('session-6', 'coorg-food-company-6163', 6, 2, 'Bob Waiter', '2024-02-04T12:00:00Z', NULL, 'active',
     '{"subtotal": 600.00, "discount": 0, "order_type": "dine-in", "items": [{"name": "Idli", "quantity": 4, "price": 50.00}, {"name": "Vada", "quantity": 2, "price": 60.00}, {"name": "Sambhar", "quantity": 2, "price": 30.00}]}');
