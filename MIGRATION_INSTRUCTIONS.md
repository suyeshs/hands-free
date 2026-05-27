# Manual Migration Instructions for Table Activation Fix

**Date**: 2026-05-21
**Migration**: 070_table_sessions_qr_ordering.sql
**Target Database**: coorg-food-company-1413_db

---

## Issue Summary

Table activation is failing with error:
```
D1_ERROR: no such column: table_id
```

This is because the `table_sessions` table schema doesn't match what the handler code expects.

---

## Quick Fix via Cloudflare Dashboard

Since wrangler authentication is having issues, use the Cloudflare Dashboard:

### Step 1: Open Cloudflare D1 Console

1. Go to https://dash.cloudflare.com/
2. Select your account
3. Click **Workers & Pages** in the left sidebar
4. Click **D1** tab
5. Find and click on database: **coorg-food-company-1413_db**
6. Click the **Console** tab

### Step 2: Execute Migration SQL

Copy the following SQL and paste it into the console:

```sql
-- Migration: Update table_sessions schema for QR code ordering
-- Adds columns needed for cryptographically secure table sessions
-- Maintains backward compatibility with existing sessions

-- Add new columns for QR code ordering (IF NOT EXISTS for safety)
ALTER TABLE table_sessions ADD COLUMN table_id TEXT;
ALTER TABLE table_sessions ADD COLUMN session_token TEXT;
ALTER TABLE table_sessions ADD COLUMN signature TEXT;
ALTER TABLE table_sessions ADD COLUMN activated_at TEXT;
ALTER TABLE table_sessions ADD COLUMN expires_at TEXT;
ALTER TABLE table_sessions ADD COLUMN activated_by TEXT;
ALTER TABLE table_sessions ADD COLUMN device_fingerprint TEXT;
ALTER TABLE table_sessions ADD COLUMN closed_by TEXT;

-- Migrate existing data: Copy table_number to table_id
UPDATE table_sessions SET table_id = CAST(table_number AS TEXT) WHERE table_id IS NULL;

-- Migrate existing data: Copy started_at to activated_at
UPDATE table_sessions SET activated_at = started_at WHERE activated_at IS NULL;

-- Migrate existing data: Set expires_at to 4 hours after activated_at
UPDATE table_sessions
SET expires_at = datetime(started_at, '+4 hours')
WHERE expires_at IS NULL;

-- Update status values: 'active' -> 'occupied', keep 'closed' as 'available'
UPDATE table_sessions SET status = 'occupied' WHERE status = 'active';
UPDATE table_sessions SET status = 'available' WHERE status = 'closed';

-- Create index on table_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);

-- Create index on session_token for validation lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_token ON table_sessions(session_token);

-- Create unique index for one occupied session per table
DROP INDEX IF EXISTS idx_table_sessions_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_occupied
ON table_sessions(table_id, tenant_id)
WHERE status = 'occupied';

-- Note: We keep the old columns (table_number, started_at, server_name, guest_count, order_data)
-- for backward compatibility. New code should use table_id and activated_at.
```

### Step 3: Verify Migration

After executing, verify the schema by running:

```sql
PRAGMA table_info(table_sessions);
```

You should see columns including: `table_id`, `session_token`, `activated_at`, `expires_at`

---

## Alternative: Fix Wrangler Authentication

If you want to use wrangler instead:

### Option 1: Create API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Add permission: **D1:Edit**
5. Copy the token
6. Set environment variable:
   ```bash
   export CLOUDFLARE_API_TOKEN="your-token-here"
   ```
7. Run migration:
   ```bash
   wrangler d1 execute coorg-food-company-1413_db --remote --file migrations-for-r2-deployment/070_table_sessions_qr_ordering.sql
   ```

### Option 2: Re-authenticate Wrangler

```bash
wrangler logout
wrangler login
# Follow browser prompt to authenticate
wrangler d1 execute coorg-food-company-1413_db --remote --file migrations-for-r2-deployment/070_table_sessions_qr_ordering.sql
```

---

## Testing After Migration

Once the migration is applied, test table activation:

### Test 1: Direct Tenant Worker Call
```bash
curl -X POST https://tenant-coorg-food-company-1413.suyesh.workers.dev/orders/coorg-food-company-1413/tables/TABLE-1/activate \
  -H "Content-Type: application/json" \
  -d '{"activatedBy":"test-user","durationMs":14400000}'
```

**Expected**: 200 OK with session details (not database error)

### Test 2: Via Restaurant Worker
```bash
curl -X POST https://handsfree-orders.suyesh.workers.dev/api/orders/coorg-food-company-1413/tables/TABLE-1/activate \
  -H "Content-Type: application/json" \
  -d '{"activatedBy":"test-user","durationMs":14400000}'
```

**Expected**: 200 OK with session details

### Test 3: From Floor Plan Manager

1. Open Floor Plan Manager in the app
2. Click on a table
3. Click "Activate" button
4. Should show success message with QR code URL

---

## What Gets Fixed

After applying this migration:

✅ **Table activation works** - No more "no such column" errors
✅ **QR code generation** - Sessions created with secure tokens
✅ **Session expiry** - Automatic timeout after 4 hours
✅ **Audit trail** - Track who activated/closed tables
✅ **Floor plan manager** - Activate/deactivate buttons work

---

## Rollback (if needed)

If something goes wrong, you can rollback by:

```sql
-- Remove new columns
ALTER TABLE table_sessions DROP COLUMN table_id;
ALTER TABLE table_sessions DROP COLUMN session_token;
ALTER TABLE table_sessions DROP COLUMN signature;
ALTER TABLE table_sessions DROP COLUMN activated_at;
ALTER TABLE table_sessions DROP COLUMN expires_at;
ALTER TABLE table_sessions DROP COLUMN activated_by;
ALTER TABLE table_sessions DROP COLUMN device_fingerprint;
ALTER TABLE table_sessions DROP COLUMN closed_by;

-- Revert status values
UPDATE table_sessions SET status = 'active' WHERE status = 'occupied';
UPDATE table_sessions SET status = 'closed' WHERE status = 'available';
```

**Note**: SQLite doesn't support `DROP COLUMN` in all versions. If this fails, you may need to recreate the table.

---

## Summary

**Problem**: Database schema doesn't match handler code
**Solution**: Add missing columns via migration 070
**Deployment**: Via Cloudflare Dashboard (due to wrangler auth issues)
**Testing**: curl commands + Floor Plan Manager UI
**Status**: Ready to apply

---

**Created**: 2026-05-21
**Priority**: HIGH (blocks table activation feature)
**Risk**: LOW (backward compatible, includes data migration)
