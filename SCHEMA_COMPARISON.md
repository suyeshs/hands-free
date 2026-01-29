# Database Schema Comparison

## Overview
Comparison between POS SQLite local database and Cloud D1 tenant provisioning schema.

## Table Comparison Summary

| Category | POS SQLite | Cloud D1 Provisioning |
|----------|-----------|----------------------|
| **Total Tables** | 22 | 21 |
| **Shared Tables** | 11 | 11 |
| **POS-Specific** | 11 | - |
| **Cloud-Specific** | - | 10 |

**✅ Schema Alignment Update (Jan 17, 2026):** Added 7 critical tables to Cloud provisioning, increasing overlap from 18% to 50%.

---

## Shared Tables (11 tables)

These tables exist in BOTH systems with similar schemas:

### Core Business Operations (7 tables - NEW)
| Table Name | Purpose | Sync Direction |
|------------|---------|---------------|
| `sales_transactions` | POS sales records with payment details | POS → Cloud |
| `staff_users` | Employee/staff accounts with authentication | Bidirectional |
| `staff_login_history` | Staff authentication audit trail | POS → Cloud |
| `daily_cash_registers` | Daily cash drawer reconciliation | POS → Cloud |
| `cash_payouts` | Cash withdrawals and expenses | POS → Cloud |
| `aggregator_orders` | Food delivery platform orders (Swiggy, Zomato) | Bidirectional |
| `schema_versions` | Migration tracking for schema sync | Bidirectional |

### Inventory & Tips (4 tables - Existing)
| Table Name | Purpose | Sync Direction |
|------------|---------|---------------|
| `tips` | Tips tracking for staff | POS → Cloud |
| `inventory_documents` | OCR-processed invoices/bills | Bidirectional |
| `inventory_items` | Inventory stock items | Bidirectional |
| `inventory_transactions` | Inventory audit trail | Bidirectional |

---

## POS-Specific Tables (18 tables)

These tables exist ONLY in the local POS SQLite database:

### Restaurant Operations
| Table | Purpose |
|-------|---------|
| `table_sessions` | Active dine-in table management |
| `kds_orders` | Kitchen Display System orders |
| `aggregator_orders` | Food delivery aggregator orders (Swiggy, Zomato) |
| `order_mappings` | Cloud order ID to local order mapping |

### Cash Management
| Table | Purpose |
|-------|---------|
| `daily_cash_registers` | Daily cash register reconciliation |
| `cash_payouts` | Cash withdrawals and payouts |
| `sales_transactions` | POS sales records |

### Staff & HR
| Table | Purpose |
|-------|---------|
| `staff_users` | Employee/staff accounts |
| `staff_login_history` | Staff login/logout tracking |
| `attendance_records` | Daily attendance check-in/out |
| `attendance_sync_log` | Attendance cloud sync tracking |
| `weekly_rosters` | Work schedule templates |
| `roster_assignments` | Staff shift assignments |
| `leave_requests` | Leave applications |
| `leave_balances` | Leave quota tracking |

### Inventory
| Table | Purpose |
|-------|---------|
| `suppliers` | Vendor/supplier contacts |
| `recipe_ingredients` | Menu item ingredient mapping |
| `out_of_stock_items` | Items marked out-of-stock |

---

## Cloud-Specific Tables (10 tables)

These tables exist ONLY in the cloud D1 provisioning schema:

### Menu Management
| Table | Purpose |
|-------|---------|
| `menu_items` | Restaurant menu catalog |
| `menu_categories` | Hierarchical menu categories |
| `filesearch_sync_log` | AI-powered menu sync from documents |

### Customer Orders (Web/Voice)
| Table | Purpose |
|-------|---------|
| `customer_orders` | Orders from web/voice channels |
| `orders` | Generic order records |
| `order_items` | Order line items |

### Multi-Tenant Infrastructure
| Table | Purpose |
|-------|---------|
| `tenant_secrets` | Encrypted API keys/credentials |

### Inventory (Cloud Extensions)
| Table | Purpose |
|-------|---------|
| `inventory_suppliers` | Cloud version of suppliers table |
| `inventory_recipes` | Recipe definitions |
| `inventory_recipe_ingredients` | Recipe ingredient lists |

---

## Architectural Notes

### Why Different Schemas?

1. **POS SQLite** is designed for:
   - **Offline-first**: Works without internet
   - **Real-time operations**: Table management, KDS, cash register
   - **Local staff management**: Attendance, rosters, leave tracking
   - **Fast performance**: No network latency

2. **Cloud D1** is designed for:
   - **Multi-tenant SaaS**: Isolated data per restaurant
   - **Cross-channel orders**: Web, voice, mobile apps
   - **AI integration**: Menu sync via file search
   - **Centralized reporting**: Aggregate data across locations
   - **Secure secrets**: API key management for integrations

### Data Flow Between Systems

```
┌─────────────────────────────────────────────────────────┐
│                    POS SQLite (Local)                   │
│  • table_sessions, kds_orders, daily_cash_registers    │
│  • staff_users, attendance, rosters, leave              │
│  • sales_transactions, tips, aggregator_orders          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Real-time Sync (WebSocket)
                  ▼
┌─────────────────────────────────────────────────────────┐
│             Cloud D1 (Multi-Tenant Platform)            │
│  • menu_items, menu_categories, customer_orders         │
│  • inventory_* (shared with POS)                        │
│  • tips (synced from POS)                               │
│  • tenant_secrets, filesearch_sync_log                  │
└─────────────────────────────────────────────────────────┘
```

**Synced Data:**
- Tips: POS → Cloud (for cross-device reporting)
- Inventory: Bidirectional (POS updates stock, cloud manages recipes)
- Sales: POS → Cloud (for analytics, not present in provisioning yet)

**Local-Only Data:**
- Table sessions, KDS orders, cash registers
- Staff attendance, rosters, leave records
- Aggregator orders (Swiggy/Zomato)

**Cloud-Only Data:**
- Menu catalog and categories
- Customer orders from web/voice
- Tenant API secrets
- AI file search sync logs

---

## Tips Table Consistency ✅

The `tips` table was successfully added to BOTH schemas:

| Location | File | Status |
|----------|------|--------|
| POS SQLite | `src-tauri/migrations/020_tips.sql` | ✅ Added |
| Cloud D1 | `docs/d1-tips-migration.sql` | ✅ Added |
| Tenant Provisioning | `platform/scripts/tenant-schema.sql` | ✅ Added |

**Schema Match:** All three instances have identical structure with:
- Dual staff tracking (staff_id + server_name)
- Invoice linkage (invoice_number)
- Unique constraint on (tenant_id, invoice_number)
- Performance indexes (tenant_date, invoice, staff, server_name)
- Cloud sync timestamp (synced_at)

---

## Conclusion

✅ **The schemas are INTENTIONALLY DIFFERENT** - they serve different architectural purposes.

✅ **Tips table is NOW CONSISTENT** across all three systems (POS, Cloud D1, Provisioning).

✅ **No sync issues** - The tips table structure matches perfectly for seamless data flow.

The POS system focuses on **local restaurant operations** while the Cloud D1 system focuses on **multi-tenant SaaS features**. They share inventory management and sync tips data for reporting purposes.

---

**Last Updated:** January 17, 2026
