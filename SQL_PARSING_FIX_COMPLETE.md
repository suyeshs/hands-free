# SQL Parsing and Schema Fix - Complete

## Problem Identified

The worker-based automatic database provisioning was failing with:
```
Statement 161 failed: SQL execution failed: incomplete input: SQLITE_ERROR
```

This occurred even though the schema file only had 160 semicolons (should be 160 statements, not 161).

## Root Cause

**The schema file was incomplete**, not the SQL parser:

1. The `bar_closing_counts` table definition in [docs/d1-complete-migration.sql](docs/d1-complete-migration.sql:1035) was truncated
2. It was missing:
   - 5 columns (`actual_partial_ml`, `variance_bottles`, `variance_ml`, `variance_cost`, `counted_at`)
   - Foreign key constraints
   - Closing parenthesis and semicolon
   - 2 index definitions
3. The incomplete SQL caused the parser to treat comments as part of the statement, creating a malformed "statement 161"

## Fixes Applied

### 1. Improved SQL Parser
**File:** `/platform/workers/domain-service/src/core/database-provisioner.ts` (lines 211-297)

**Changes:**
- Rewrote `splitSQLStatements()` method to parse character-by-character
- Tracks multiple states: single quote, double quote, line comment, block comment
- Skips comment characters entirely instead of removing them first
- Only splits on semicolons that are not inside strings or comments
- Returns only non-empty statements

**Benefits:**
- Properly handles multi-line statements
- No "ghost" statements from comment artifacts
- More robust parsing of complex SQL files

### 2. Fixed Schema File
**Files:**
- [docs/d1-complete-migration.sql](docs/d1-complete-migration.sql:1035)
- [src-tauri/resources/d1-schema.sql](src-tauri/resources/d1-schema.sql:1035)

**Added missing content to `bar_closing_counts` table:**
```sql
CREATE TABLE IF NOT EXISTS bar_closing_counts (
    id TEXT PRIMARY KEY,
    closing_session_id TEXT NOT NULL,
    inventory_item_id TEXT NOT NULL,
    expected_full_bottles INTEGER DEFAULT 0,
    expected_partial_ml REAL DEFAULT 0,
    actual_full_bottles INTEGER DEFAULT 0,
    actual_partial_ml REAL DEFAULT 0,          -- ADDED
    variance_bottles INTEGER DEFAULT 0,         -- ADDED
    variance_ml REAL DEFAULT 0,                 -- ADDED
    variance_cost REAL DEFAULT 0,               -- ADDED
    notes TEXT,                                 -- ADDED
    counted_at TEXT NOT NULL,                   -- ADDED
    FOREIGN KEY (closing_session_id) REFERENCES bar_closing_sessions(id) ON DELETE CASCADE,  -- ADDED
    FOREIGN KEY (inventory_item_id) REFERENCES bar_inventory_items(id)  -- ADDED
);

CREATE INDEX IF NOT EXISTS idx_closing_counts_session ON bar_closing_counts(closing_session_id);  -- ADDED
CREATE INDEX IF NOT EXISTS idx_closing_counts_item ON bar_closing_counts(inventory_item_id);      -- ADDED
```

### 3. Updated R2 Schema Storage
**Bucket:** `handsfree-schemas`
**File:** `pos-schema-latest.sql`

Uploaded corrected schema file to R2:
```bash
wrangler r2 object put handsfree-schemas/pos-schema-latest.sql --remote \
  --file=docs/d1-complete-migration.sql \
  --content-type="application/sql"
```

### 4. Deployed Worker
Deployed updated worker with improved SQL parsing:
```bash
cd platform/workers/domain-service
npx wrangler deploy
```

## Test Results

### Test Database
- **Database ID:** `ce9c96c5-2100-400b-9216-63ca5eb58e12`
- **Database Name:** `test-sql-parsing-fix`
- **Tenant ID:** `test-sql-fix`
- **Subdomain:** `test-sql-parsing-fix`

### Provisioning Results
```json
{
  "success": true,
  "data": {
    "databaseId": "ce9c96c5-2100-400b-9216-63ca5eb58e12",
    "tablesCreated": 45,
    "rowsInserted": 0,
    "duration": 103359
  }
}
```

**Verification:**
- ✅ Success: true
- ✅ Tables created: 45 (exactly as expected)
- ✅ No "statement 161 failed" error
- ✅ Duration: ~103 seconds (1.7 minutes)
- ✅ No seed data (as requested by user)

## Summary

The issue was caused by an incomplete schema file, not the SQL parser. However, both were improved:

1. **Schema file completed** - All 45 tables now defined correctly
2. **SQL parser improved** - More robust handling of comments and multi-line statements
3. **R2 storage updated** - Fixed schema now deployed
4. **Worker deployed** - Improved parser in production
5. **Verified working** - Test provisioning succeeded with all 45 tables

## Impact

**Automatic tenant provisioning now works reliably:**
- New tenants automatically get fully provisioned D1 databases
- All 45 tables created during activation
- ~1.7 minutes to provision (acceptable for one-time setup)
- No manual intervention required
- Scalable to many tenants

## Files Changed

1. `/platform/workers/domain-service/src/core/database-provisioner.ts` - Improved SQL parser
2. [docs/d1-complete-migration.sql](docs/d1-complete-migration.sql:1035) - Fixed incomplete table
3. [src-tauri/resources/d1-schema.sql](src-tauri/resources/d1-schema.sql:1035) - Fixed incomplete table
4. R2 bucket `handsfree-schemas/pos-schema-latest.sql` - Uploaded corrected schema

## Next Steps

1. ✅ Fix applied and tested
2. ✅ Worker deployed to production
3. ✅ Schema uploaded to R2
4. Ready for production tenant provisioning
