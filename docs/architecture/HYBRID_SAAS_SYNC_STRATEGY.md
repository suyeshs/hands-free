# Hybrid SaaS Synchronization Strategy

## Problem Statement

In a true hybrid SaaS architecture, when a tenant is provisioned for the first time:
1. **Local POS** and **Cloud D1** schemas must be synchronized
2. Data must flow bidirectionally without conflicts
3. Connectivity issues or bugs can create schema/data mismatches
4. A **merge/discard workflow** is needed to resolve conflicts

---

## Current State Analysis

### Schema Mismatch

| System | Tables | Purpose |
|--------|--------|---------|
| **POS SQLite** | 22 tables | Offline-first local operations |
| **Cloud D1 Provisioning** | 14 tables | Multi-tenant SaaS platform |
| **Shared** | 4 tables | inventory_*, tips |

### Critical Gap

**Only 4 tables are shared** - this is insufficient for a hybrid SaaS:
- `sales_transactions` exists in POS but NOT in cloud provisioning ❌
- `staff_users` exists in POS but NOT in cloud provisioning ❌
- `daily_cash_registers` exists in POS but NOT in cloud provisioning ❌
- Many other business-critical tables are isolated

---

## Proposed Schema Alignment

### Tables That MUST Be in Cloud Provisioning

| Table | Current Status | Priority | Reason |
|-------|---------------|----------|---------|
| `sales_transactions` | ❌ Missing from cloud | **CRITICAL** | Cross-device reporting, analytics, owner oversight |
| `staff_users` | ❌ Missing from cloud | **CRITICAL** | Centralized staff management, permissions, HR |
| `daily_cash_registers` | ❌ Missing from cloud | **HIGH** | Financial oversight, multi-location reconciliation |
| `cash_payouts` | ❌ Missing from cloud | **HIGH** | Financial audit trail |
| `table_sessions` | ❌ Missing from cloud | **MEDIUM** | Cross-device table status (if multiple POS terminals) |
| `aggregator_orders` | ❌ Missing from cloud | **HIGH** | Centralized order management, analytics |
| `attendance_records` | ❌ Missing from cloud | **MEDIUM** | HR reporting, payroll integration |
| `weekly_rosters` | ❌ Missing from cloud | **MEDIUM** | Centralized scheduling |
| `leave_requests` | ❌ Missing from cloud | **MEDIUM** | HR workflow |

### Tables That Can Stay Local-Only

| Table | Reason |
|-------|--------|
| `kds_orders` | Real-time kitchen display state (ephemeral) |
| `out_of_stock_items` | Local cache, synced via inventory |
| `order_mappings` | Internal mapping, not business data |

---

## Tenant Provisioning Flow

### Phase 1: Initial Provisioning

```
┌─────────────────────────────────────────────────────────┐
│  NEW TENANT REGISTRATION (Cloud)                        │
│  1. Create tenant_id                                    │
│  2. Generate encryption keys                            │
│  3. Provision D1 database with FULL schema              │
│  4. Create default admin user                           │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  POS DEVICE ONBOARDING                                  │
│  1. Download tenant schema version                      │
│  2. Create local SQLite with matching schema            │
│  3. Sync initial data from cloud (staff, menu, etc.)    │
│  4. Mark tenant as "provisioned" in both systems        │
└─────────────────────────────────────────────────────────┘
```

### Phase 2: Schema Version Control

```sql
-- Add to BOTH POS and Cloud
CREATE TABLE IF NOT EXISTS schema_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  migration_name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pos', 'cloud'))
);
```

**Usage:**
- Every migration has a version number and checksum
- Both POS and Cloud track which migrations have been applied
- On sync, compare versions to detect mismatches

---

## Merge/Discard Workflow

### Conflict Detection

When POS connects to cloud, run **schema sync check**:

```typescript
interface SchemaSyncStatus {
  status: 'synced' | 'pos_ahead' | 'cloud_ahead' | 'diverged';
  posVersion: string;
  cloudVersion: string;
  missingInPos: string[];      // Tables in cloud but not POS
  missingInCloud: string[];    // Tables in POS but not cloud
  schemaMismatches: {
    table: string;
    posColumns: string[];
    cloudColumns: string[];
    columnDifferences: string[];
  }[];
}
```

### Conflict Resolution Workflow

#### Scenario 1: Schema Version Mismatch

```
┌─────────────────────────────────────────────────────────┐
│  DETECTION: POS v1.2.0, Cloud v1.3.0                    │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  ADMIN NOTIFICATION                                     │
│  "Schema version mismatch detected"                     │
│  • Cloud is 1 version ahead                             │
│  • Missing in POS: tips table indexes                   │
│                                                          │
│  [Apply Cloud Schema] [Keep POS Schema] [Review]       │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  AUTO-MIGRATION (Recommended)                           │
│  1. Download missing migrations from cloud              │
│  2. Apply to local POS database                         │
│  3. Verify checksum                                     │
│  4. Mark as synced                                      │
└─────────────────────────────────────────────────────────┘
```

#### Scenario 2: Data Conflict (Same Record, Different Values)

```
Example: staff_users table
POS:  { id: "123", name: "John Doe", role: "server", updated_at: "2026-01-17 10:00" }
Cloud: { id: "123", name: "John Smith", role: "manager", updated_at: "2026-01-17 09:00" }
```

**Resolution Strategy:**

```typescript
interface DataConflict {
  table: string;
  recordId: string;
  posData: Record<string, any>;
  cloudData: Record<string, any>;
  posUpdatedAt: string;
  cloudUpdatedAt: string;
  conflictingFields: string[];
}

type ConflictResolution =
  | { action: 'use_pos'; reason: 'newer_timestamp' }
  | { action: 'use_cloud'; reason: 'newer_timestamp' }
  | { action: 'manual_merge'; merge: Record<string, any> }
  | { action: 'create_duplicate'; newId: string };
```

**Default Rules (Last-Write-Wins):**
1. Compare `updated_at` timestamps
2. Newer record wins
3. Overwrite older record in both systems
4. Log conflict resolution for audit

**Manual Review UI:**
```
╔═══════════════════════════════════════════════════════╗
║  DATA CONFLICT DETECTED                               ║
╠═══════════════════════════════════════════════════════╣
║  Table: staff_users                                   ║
║  Record ID: 123                                       ║
║                                                        ║
║  Field: name                                          ║
║  POS Value:   "John Doe"    (Updated: 10:00 AM)      ║
║  Cloud Value: "John Smith"  (Updated: 09:00 AM)      ║
║                                                        ║
║  Field: role                                          ║
║  POS Value:   "server"      (Updated: 10:00 AM)      ║
║  Cloud Value: "manager"     (Updated: 09:00 AM)      ║
║                                                        ║
║  Recommended: Use POS (Newer)                         ║
║                                                        ║
║  [Use POS] [Use Cloud] [Manual Merge] [Skip]        ║
╚═══════════════════════════════════════════════════════╝
```

#### Scenario 3: Missing Data in One System

```
Example: sales_transactions
POS has 50 transactions from today
Cloud has 45 transactions from today
5 transactions missing in cloud (sync failure)
```

**Resolution:**
1. **Detect:** Compare record counts and IDs for date range
2. **Identify:** Find missing IDs in each system
3. **Sync:** Push missing records from POS → Cloud
4. **Verify:** Confirm counts match
5. **Log:** Record sync operation in audit log

---

## Implementation Plan

### Step 1: Update Cloud D1 Provisioning Schema

**Add missing critical tables to `tenant-schema.sql`:**

```sql
-- Sales Transactions (CRITICAL)
CREATE TABLE IF NOT EXISTS sales_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  -- ... (full schema from POS migration)
);

-- Staff Users (CRITICAL)
CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- ... (full schema from POS migration)
);

-- Daily Cash Registers (HIGH)
CREATE TABLE IF NOT EXISTS daily_cash_registers (
  -- ... (full schema from POS migration)
);

-- Cash Payouts (HIGH)
CREATE TABLE IF NOT EXISTS cash_payouts (
  -- ... (full schema from POS migration)
);

-- Aggregator Orders (HIGH)
CREATE TABLE IF NOT EXISTS aggregator_orders (
  -- ... (full schema from POS migration)
);

-- Attendance Records (MEDIUM)
CREATE TABLE IF NOT EXISTS attendance_records (
  -- ... (full schema from POS migration)
);

-- Weekly Rosters (MEDIUM)
CREATE TABLE IF NOT EXISTS weekly_rosters (
  -- ... (full schema from POS migration)
);

-- Leave Requests (MEDIUM)
CREATE TABLE IF NOT EXISTS leave_requests (
  -- ... (full schema from POS migration)
);
```

### Step 2: Schema Version Tracking

**Add to both POS and Cloud:**

```sql
CREATE TABLE IF NOT EXISTS schema_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  migration_name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pos', 'cloud', 'both'))
);

CREATE INDEX IF NOT EXISTS idx_schema_version ON schema_versions(version);
```

### Step 3: Sync Conflict Resolution Service

**File: `src/lib/syncConflictService.ts`**

```typescript
interface SyncConflict {
  type: 'schema' | 'data' | 'missing_record';
  table: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: any;
  resolution?: ConflictResolution;
}

class SyncConflictService {
  // Detect schema mismatches
  async detectSchemaMismatches(): Promise<SchemaSyncStatus> { }

  // Detect data conflicts
  async detectDataConflicts(table: string, dateRange: DateRange): Promise<DataConflict[]> { }

  // Resolve conflicts automatically (last-write-wins)
  async autoResolveConflicts(conflicts: DataConflict[]): Promise<void> { }

  // Get conflicts requiring manual review
  async getManualReviewQueue(): Promise<SyncConflict[]> { }

  // Apply manual resolution
  async applyManualResolution(conflictId: string, resolution: ConflictResolution): Promise<void> { }

  // Sync missing records
  async syncMissingRecords(table: string, missingIds: string[]): Promise<void> { }
}
```

### Step 4: Admin UI - Sync Conflict Dashboard

**File: `src/pages-v2/SyncConflictDashboard.tsx`**

```tsx
<SyncConflictDashboard>
  <SyncStatusCard
    status={syncStatus.status}
    posVersion={syncStatus.posVersion}
    cloudVersion={syncStatus.cloudVersion}
  />

  <ConflictList conflicts={conflicts}>
    {conflicts.map(conflict => (
      <ConflictCard
        type={conflict.type}
        table={conflict.table}
        severity={conflict.severity}
        onResolve={handleResolve}
      />
    ))}
  </ConflictList>

  <AutoSyncSettings>
    <Toggle label="Auto-resolve with last-write-wins" />
    <Toggle label="Auto-apply schema updates from cloud" />
    <Toggle label="Notify admin on conflict detection" />
  </AutoSyncSettings>
</SyncConflictDashboard>
```

### Step 5: Provisioning Checklist API

**Endpoint: `POST /api/tenants/:tenantId/provision`**

```typescript
async function provisionNewTenant(tenantId: string): Promise<ProvisioningResult> {
  const steps = [
    { name: 'Create D1 database schema', status: 'pending' },
    { name: 'Apply all migrations', status: 'pending' },
    { name: 'Create default admin user', status: 'pending' },
    { name: 'Generate encryption keys', status: 'pending' },
    { name: 'Initialize schema_versions table', status: 'pending' },
    { name: 'Create tenant secrets', status: 'pending' },
    { name: 'Mark tenant as active', status: 'pending' },
  ];

  for (const step of steps) {
    try {
      await executeProvisioningStep(tenantId, step.name);
      step.status = 'completed';
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      break;
    }
  }

  return { tenantId, steps };
}
```

---

## Migration Path

### For Existing Tenants

1. **Schema Audit**: Run comparison between POS and Cloud for all existing tenants
2. **Backfill Cloud**: Sync historical data from POS to newly added cloud tables
3. **Enable Bidirectional Sync**: Turn on real-time sync for new tables
4. **Monitor**: Track sync conflicts for 30 days
5. **Optimize**: Adjust conflict resolution rules based on real-world patterns

### For New Tenants

1. **Provision Cloud First**: Create D1 schema with ALL tables
2. **Generate POS Config**: Download schema version and initial data
3. **Initialize POS**: Create local SQLite with matching schema
4. **Verify Sync**: Confirm bidirectional sync is working
5. **Mark Active**: Enable POS for transactions

---

## Success Criteria

✅ **Schema Parity**: POS and Cloud have identical schemas for all synced tables
✅ **Version Tracking**: Both systems track and compare schema versions
✅ **Auto-Resolution**: 90%+ of conflicts resolved automatically with last-write-wins
✅ **Manual Review**: Admin dashboard shows remaining 10% for manual resolution
✅ **Provisioning**: New tenants get consistent schemas in POS and Cloud
✅ **Audit Trail**: All sync operations logged with before/after states
✅ **Offline Support**: POS continues working offline, syncs when reconnected
✅ **Data Integrity**: No data loss during conflict resolution

---

## Implementation Status

### Phase 1: Schema Alignment ✅ COMPLETED

1. ✅ **Updated `tenant-schema.sql`** with all critical tables
   - Added `sales_transactions` table for POS sales records
   - Added `staff_users` and `staff_login_history` for HR management
   - Added `daily_cash_registers` and `cash_payouts` for cash management
   - Added `aggregator_orders` for delivery platform integration
   - Added `schema_versions` table for migration tracking

2. ✅ **Created schema comparison tool**
   - File: `src/lib/schemaComparisonService.ts`
   - Features:
     - Extracts schema from POS SQLite database
     - Compares against Cloud D1 reference schema
     - Detects missing tables, columns, and type mismatches
     - Generates sync reports and migration scripts
   - API: `checkSchemaSync()`, `generateSchemaReport()`

3. ✅ **Built Schema Sync Dashboard**
   - File: `src/pages-v2/SchemaSyncDashboard.tsx`
   - Features:
     - Real-time schema comparison
     - Visual diff highlighting
     - Missing tables/columns detection
     - Downloadable sync reports
     - Recommended actions for administrators

**Result:** Cloud provisioning schema now includes 21 tables (up from 14), achieving 50% overlap with POS schema (up from 18%).

---

## Next Steps

### Short-term (P1) - In Progress
1. **Implement `syncConflictService.ts`** with auto-resolution
   - Last-write-wins strategy for data conflicts
   - Timestamp-based conflict resolution
   - Manual review queue for complex conflicts

2. **Add provisioning API** for new tenants
   - Automated tenant database creation
   - Schema version initialization
   - Default data seeding

### Long-term (P2) - Planned
1. **Backfill existing tenants** with historical data
   - Migrate sales_transactions from POS to Cloud
   - Sync staff_users and attendance records
   - Validate data integrity post-migration

2. **Enable bidirectional sync** for all tables
   - Real-time sync via WebSocket
   - Batch sync for offline mode
   - Conflict detection and auto-resolution

3. **Build analytics dashboard** for sync health monitoring
   - Sync latency metrics
   - Conflict resolution statistics
   - Schema drift alerts

---

**Last Updated:** January 17, 2026
**Phase 1 Completed:** January 17, 2026
