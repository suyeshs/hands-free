# Tables Sync Status - Tenant Worker

## Summary

**Total Tables**: 21
**Tables with Sync**: 3 ✅
**Tables Needing Sync**: 14 📝
**Tables Not Requiring Sync**: 4 ⏸️

---

## ✅ Already Have Sync Endpoints (3)

1. **tips** - `/tips/sync` ✅
   - Handler: `handlers/tips.ts`
   - SyncEngine: Integrated
   - Conflict keys: `tenant_id + invoice_number`

2. **sales_transactions** - `/sales/sync` ✅
   - Handler: `handlers/sales.ts`
   - SyncEngine: Integrated
   - Conflict keys: `tenant_id + invoice_number`

3. **aggregator_orders** - `/aggregator-orders/sync` ✅
   - Handler: `handlers/aggregator-orders.ts`
   - SyncEngine: Integrated
   - Conflict keys: `aggregator + aggregator_order_id`

---

## 📝 Need Sync Endpoints (14)

### Priority 1 - Core Operations (4 tables)

4. **orders** - POS orders
   - Direction: POS → Cloud
   - Conflict keys: `tenant_id + id`
   - Related: order_items (child table)
   - Handler exists: `handlers/orders.ts` (needs sync added)

5. **order_items** - Order line items
   - Direction: POS → Cloud
   - Conflict keys: `id`
   - Parent: orders
   - Should sync together with orders

6. **menu_items** - Restaurant menu
   - Direction: POS → Cloud (bidirectional possible)
   - Conflict keys: `tenant_id + id`
   - Handler exists: `handlers/menu.ts` (needs sync added)
   - Fields: 28 columns

7. **menu_categories** - Menu categories
   - Direction: POS → Cloud (bidirectional possible)
   - Conflict keys: `tenant_id + name`
   - Handler exists: `handlers/menu.ts` (needs sync added)
   - Fields: 8 columns

### Priority 2 - Staff & Cash Management (4 tables)

8. **staff_users** - Employee/staff accounts
   - Direction: POS → Cloud
   - Conflict keys: `tenant_id + id`
   - Handler exists: `handlers/staff.ts` (needs sync added)
   - Fields: 9 columns

9. **staff_login_history** - Login audit trail
   - Direction: POS → Cloud
   - Conflict keys: `id`
   - Fields: 6 columns
   - New handler needed: `handlers/staff-login.ts`

10. **daily_cash_registers** - Cash drawer reconciliation
    - Direction: POS → Cloud
    - Conflict keys: `tenant_id + business_date`
    - Fields: 14 columns
    - New handler needed: `handlers/cash-management.ts`

11. **cash_payouts** - Cash withdrawals/expenses
    - Direction: POS → Cloud
    - Conflict keys: `tenant_id + id`
    - Fields: 12 columns
    - Can be part of: `handlers/cash-management.ts`

### Priority 3 - Inventory Management (6 tables)

12. **inventory_suppliers** - Supplier information
    - Direction: POS → Cloud (bidirectional)
    - Conflict keys: `tenant_id + id`
    - Fields: 15 columns
    - New handler needed: `handlers/inventory.ts`

13. **inventory_items** - Inventory stock items
    - Direction: POS → Cloud (bidirectional)
    - Conflict keys: `tenant_id + id`
    - Fields: 14 columns
    - Handler: `handlers/inventory.ts`

14. **inventory_documents** - Invoice/bill OCR documents
    - Direction: POS → Cloud
    - Conflict keys: `tenant_id + id`
    - Fields: 12 columns
    - Handler: `handlers/inventory.ts`

15. **inventory_transactions** - Inventory audit trail
    - Direction: POS → Cloud
    - Conflict keys: `tenant_id + id`
    - Fields: 12 columns
    - Handler: `handlers/inventory.ts`

16. **inventory_recipes** - Recipe definitions
    - Direction: POS → Cloud (bidirectional)
    - Conflict keys: `tenant_id + menu_item_id`
    - Fields: 7 columns
    - Handler: `handlers/inventory.ts`

17. **inventory_recipe_ingredients** - Recipe ingredient mapping
    - Direction: POS → Cloud (bidirectional)
    - Conflict keys: `tenant_id + id`
    - Fields: 6 columns
    - Handler: `handlers/inventory.ts`

---

## ⏸️ Do Not Need Sync (4)

18. **customer_orders** - Web/voice orders created in cloud
    - Reason: Created directly in cloud, not in POS
    - Direction: Cloud → POS (if needed, opposite direction)

19. **filesearch_sync_log** - Metadata table
    - Reason: Cloud-only metadata tracking
    - No sync needed

20. **schema_versions** - Migration tracking
    - Reason: Cloud-only schema management
    - No sync needed

21. **tenant_secrets** - Encrypted API keys
    - Reason: Security-sensitive, managed separately via Token Manager
    - No sync needed

---

## Implementation Plan

### Phase 1: Core Operations (Immediate)
- [ ] Add sync to `handlers/orders.ts` for orders + order_items
- [ ] Add sync to `handlers/menu.ts` for menu_items + menu_categories

### Phase 2: Staff & Cash (High Priority)
- [ ] Add sync to `handlers/staff.ts` for staff_users
- [ ] Create `handlers/staff-login.ts` for staff_login_history
- [ ] Create `handlers/cash-management.ts` for daily_cash_registers + cash_payouts

### Phase 3: Inventory (Medium Priority)
- [ ] Create `handlers/inventory.ts` with sync for all 6 inventory tables

---

## Sync Configuration Templates

### Orders Sync
```typescript
const ordersSyncConfig: SyncTableConfig = {
  tableName: 'orders',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['tenant_id', 'id'],
  timestampColumn: 'updated_at',
  columns: [ /* 16 columns */ ],
};
```

### Menu Items Sync
```typescript
const menuItemsSyncConfig: SyncTableConfig = {
  tableName: 'menu_items',
  direction: 'bidirectional', // Can sync both ways
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['tenant_id', 'id'],
  timestampColumn: 'updated_at',
  columns: [ /* 28 columns */ ],
};
```

### Staff Users Sync
```typescript
const staffUsersSyncConfig: SyncTableConfig = {
  tableName: 'staff_users',
  direction: 'pos-to-cloud',
  conflictStrategy: 'last-write-wins',
  conflictKeys: ['tenant_id', 'id'],
  timestampColumn: 'created_at', // No updated_at column
  columns: [ /* 9 columns */ ],
};
```

---

## Routes to Add

### Orders
- `POST /orders/sync` - Sync orders + order_items from POS

### Menu
- `POST /menu/sync` - Sync menu items from POS
- `POST /categories/sync` - Sync categories from POS

### Staff
- `POST /staff/sync` - Sync staff users from POS
- `POST /staff/login-history/sync` - Sync login history

### Cash Management
- `POST /cash-registers/sync` - Sync daily cash registers
- `POST /cash-payouts/sync` - Sync cash payouts

### Inventory
- `POST /inventory/suppliers/sync` - Sync suppliers
- `POST /inventory/items/sync` - Sync inventory items
- `POST /inventory/documents/sync` - Sync documents
- `POST /inventory/transactions/sync` - Sync transactions
- `POST /inventory/recipes/sync` - Sync recipes
- `POST /inventory/recipe-ingredients/sync` - Sync recipe ingredients

---

## Estimated Implementation Time

- **Phase 1 (Core)**: 2-3 hours
  - Orders + order_items: 1.5 hours
  - Menu items + categories: 1 hour

- **Phase 2 (Staff & Cash)**: 2-3 hours
  - Staff users: 30 minutes
  - Staff login history: 1 hour
  - Cash management: 1.5 hours

- **Phase 3 (Inventory)**: 4-5 hours
  - 6 tables × 45 minutes each

**Total**: 8-11 hours

---

## Testing Priority

1. **Phase 1** - Test with real POS data
2. **Phase 2** - Test staff login and cash reconciliation flows
3. **Phase 3** - Test inventory management workflows

