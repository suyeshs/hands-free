# Migration Fix - Table Name Conflict

**Issue**: Migration 036 failed with error: `no such column: table_number`

## Root Cause

There was an **existing `orders` table** created in `src-tauri/src/database/mod.rs` with a different schema:

**Existing table** (from database/mod.rs):
```sql
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    table_id TEXT,           -- ← Different column name
    server_id TEXT NOT NULL,
    status TEXT,
    ...
);
```

**New migration** (036_guest_orders.sql):
```sql
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    table_number TEXT NOT NULL,  -- ← Different column name
    customer_name TEXT,
    ...
);
```

## What Happened

1. Migration tried to `CREATE TABLE IF NOT EXISTS orders`
2. Found existing table → skipped creation
3. Tried to `CREATE INDEX ... ON orders(table_number)`
4. **Error**: `table_number` column doesn't exist in the old table

## Solution

**Renamed tables** to avoid conflict:
- `orders` → `guest_orders`
- `order_items` → `guest_order_items`

## Files Changed

### 1. Migration File
**File**: `src-tauri/migrations/036_guest_orders.sql`
- Changed: `CREATE TABLE orders` → `CREATE TABLE guest_orders`
- Changed: `CREATE TABLE order_items` → `CREATE TABLE guest_order_items`
- Updated all indexes and foreign keys

### 2. Web Server
**File**: `src-tauri/src/webserver.rs`
- Changed: `INSERT INTO orders` → `INSERT INTO guest_orders`
- Changed: `INSERT INTO order_items` → `INSERT INTO guest_order_items`
- Changed: `SELECT ... FROM orders` → `SELECT ... FROM guest_orders`

## Table Purpose Separation

Now we have clear separation:

| Table | Purpose | Used By |
|-------|---------|---------|
| **orders** | POS staff orders | POS system, table sessions |
| **guest_orders** | QR code guest orders | Web server, guest ordering |
| **kds_orders** | Kitchen display orders | KDS system |
| **bar_orders** | Bar orders | Bar system |
| **aggregator_orders** | Third-party orders | Swiggy, Zomato integration |

## Testing

The app should now start successfully. Test by:

1. Start app: `bun tauri dev`
2. Verify migrations run successfully
3. Start tunnel and generate QR codes
4. Submit a test order
5. Check `guest_orders` table has the order
6. Verify order appears in POS

## Next Steps

All code changes are complete. The migration should now work properly without conflicts.
