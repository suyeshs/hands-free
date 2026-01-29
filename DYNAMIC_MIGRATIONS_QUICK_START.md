# Dynamic Migrations - Quick Start Guide

## TL;DR

Deploy database changes without rebuilding the app!

```bash
# 1. Create migration file
vim src-tauri/migrations/039_my_feature.sql

# 2. Deploy to cloud
./deploy-migration.sh \
  src-tauri/migrations/039_my_feature.sql \
  39 \
  "my_feature" \
  "3.1.0"

# 3. Done! Apps sync automatically
```

---

## Setup (One-Time)

### 1. Add Hook to App.tsx

```tsx
import { useDynamicMigrations } from './hooks/useDynamicMigrations';

function App() {
  // Auto-sync migrations on startup + every hour
  useDynamicMigrations({
    checkOnStartup: true,
    checkIntervalMinutes: 60,
  });

  return <YourApp />;
}
```

### 2. Configure Environment

```bash
# .env
VITE_API_BASE_URL=https://api.handsfreepos.com
```

---

## Deploy a Migration

### Step 1: Write SQL

```sql
-- src-tauri/migrations/039_loyalty_points.sql
CREATE TABLE IF NOT EXISTS loyalty_points (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    points INTEGER DEFAULT 0
);
```

### Step 2: Deploy

```bash
./deploy-migration.sh \
  src-tauri/migrations/039_loyalty_points.sql \
  39 \
  "loyalty_points" \
  "3.1.0"
```

### Step 3: Wait

Apps sync within:
- **Instantly**: On next startup
- **< 60 min**: If already running (automatic check)

---

## Advanced Features

### Beta Testing (Specific Tenants Only)

Edit `migrations/manifest.json`:

```json
{
  "version": 39,
  "name": "loyalty_points",
  "tenant_whitelist": ["tenant-123", "tenant-456"],
  ...
}
```

Only these tenants will apply the migration.

### Version-Gated (Require Newer App)

```json
{
  "version": 40,
  "name": "advanced_feature",
  "required_app_version": "3.3.0",
  ...
}
```

Apps older than v3.3.0 will skip this migration.

---

## Verify Deployment

### Check Cloud Storage

```bash
# List migrations in R2
wrangler r2 object list handsfree-pos --prefix migrations/

# Download manifest to verify
wrangler r2 object get handsfree-pos/migrations/manifest.json
```

### Check Local Database

```bash
# View migration history
sqlite3 ~/Library/Application\ Support/com.stonepot.handsfree/pos.db \
  "SELECT version, name, source, datetime(applied_at, 'unixepoch')
   FROM schema_migrations
   ORDER BY version DESC
   LIMIT 10;"
```

---

## Troubleshooting

### Migration Not Applying?

1. **Check app version**: App must meet `required_app_version`
2. **Check whitelist**: If set, tenant must be in list
3. **Check logs**: Look for errors in browser console
4. **Force sync**: Restart app to trigger check

### Checksum Error?

- Re-calculate after any file changes
- Delete from manifest and redeploy

### Manifest Not Found?

- Check `VITE_API_BASE_URL` in `.env`
- Verify R2 bucket permissions
- Check CORS settings on R2

---

## Best Practices

✅ **Test locally first** - Apply to dev database before deploying
✅ **Small migrations** - Incremental changes are safer
✅ **Descriptive names** - Use clear names like `loyalty_points`
✅ **Add comments** - Explain what and why in SQL
✅ **Beta test** - Use whitelist for risky migrations
✅ **Monitor logs** - Watch for errors after deployment

❌ **Don't break schema** - Ensure backwards compatibility
❌ **Don't skip versions** - Maintain sequential numbering
❌ **Don't modify after deploy** - Create new migration instead

---

## Security

🔒 **SHA256 Checksums** - Every migration verified before execution
🔒 **Transactions** - Atomic apply with automatic rollback on failure
🔒 **Version Checks** - Old apps skip incompatible migrations
🔒 **HTTPS Only** - All downloads over secure connection
🔒 **Audit Trail** - Complete history in `schema_migrations` table

---

## Example Migrations

### Add Column

```sql
-- 039_add_customer_notes.sql
ALTER TABLE customers ADD COLUMN notes TEXT;
```

### Create Table

```sql
-- 040_feedback.sql
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);
```

### Add Index

```sql
-- 041_optimize_orders.sql
CREATE INDEX IF NOT EXISTS idx_orders_created
ON orders(created_at DESC);
```

---

## Migration Numbering

- Last built-in migration: **38** (migration_tracking)
- Next cloud migration: **39**
- Increment by 1 for each new migration

---

## Get Help

- 📖 Full docs: [DYNAMIC_MIGRATION_SYSTEM.md](docs/DYNAMIC_MIGRATION_SYSTEM.md)
- ✅ Implementation guide: [DYNAMIC_MIGRATIONS_IMPLEMENTATION_COMPLETE.md](DYNAMIC_MIGRATIONS_IMPLEMENTATION_COMPLETE.md)
- 🐛 Issues: Check console logs and database

---

## Summary

**Old Way**: Write migration → Add to lib.rs → Rebuild Rust → Create installer → Users reinstall → Wait hours

**New Way**: Write migration → Run deploy script → Apps sync within minutes

**No rebuild. No reinstall. Just works.** ✨
