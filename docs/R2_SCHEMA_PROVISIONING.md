# R2 Schema Provisioning - Auto-Update Architecture

## Overview

Store the complete POS database schema in Cloudflare R2. When new tenants are provisioned, the domain-service worker fetches the latest schema from R2 and applies it to the tenant's D1 database. This enables **schema updates without redeploying the worker**.

## Benefits

✅ **Auto-Update**: Update schema in R2, all new tenants get the latest version
✅ **No Redeployment**: Change schema without redeploying the worker
✅ **Version Control**: Support multiple schema versions (v1, v2, v3)
✅ **Large Files**: R2 handles large schema files better than embedding in code
✅ **Centralized Management**: Single source of truth for schema
✅ **Rollback Support**: Keep previous versions for rollback if needed

## Architecture

```
Schema Updates:
1. Developer updates d1-complete-migration.sql locally
2. Upload to R2: wrangler r2 object put ...
3. New tenants automatically provision with latest schema

Provisioning Flow:
1. Tenant creation triggered
2. Domain-service creates D1 database
3. Fetch schema from R2 (handsfree-schemas/pos-schema-latest.sql)
4. Apply schema to tenant's D1 database via Cloudflare API
5. Tenant database ready with 45 tables
```

## Setup

### Step 1: Create R2 Bucket

```bash
# Create R2 bucket for schemas
wrangler r2 bucket create handsfree-schemas

# Output:
# Created bucket 'handsfree-schemas' with default storage class set to Standard.
```

### Step 2: Upload Schema to R2

```bash
# Navigate to domain-service directory
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/domain-service

# Upload latest schema
wrangler r2 object put handsfree-schemas/pos-schema-latest.sql \
  --file=/Users/stonepot-tech/projects/restaurant-pos-ai/docs/d1-complete-migration.sql \
  --content-type="application/sql"

# Output:
# Uploaded pos-schema-latest.sql to handsfree-schemas
```

### Step 3: Upload Versioned Schema (Optional)

```bash
# Keep versioned copies for rollback
wrangler r2 object put handsfree-schemas/pos-schema-v3.1.0.sql \
  --file=/Users/stonepot-tech/projects/restaurant-pos-ai/docs/d1-complete-migration.sql \
  --content-type="application/sql"

# List uploaded schemas
wrangler r2 object list handsfree-schemas

# Output:
# pos-schema-latest.sql (45.2 KB)
# pos-schema-v3.1.0.sql (45.2 KB)
# pos-schema-v3.0.0.sql (42.1 KB)
```

### Step 4: Configure wrangler.jsonc

Add R2 bucket binding to domain-service worker:

```jsonc
// /platform/workers/domain-service/wrangler.jsonc

{
  // ... other config

  // R2 Buckets
  "r2_buckets": [
    {
      "binding": "SCHEMA_STORAGE",
      "bucket_name": "handsfree-schemas"
    }
  ],

  // Production environment
  "env": {
    "production": {
      "r2_buckets": [
        {
          "binding": "SCHEMA_STORAGE",
          "bucket_name": "handsfree-schemas-prod"
        }
      ]
    }
  }
}
```

### Step 5: Update database-provisioner.ts

Replace hardcoded schema with R2 fetch:

```typescript
// /platform/workers/domain-service/src/core/database-provisioner.ts

export interface DatabaseProvisioningConfig {
  databaseId: string;
  tenantId: string;
  subdomain: string;
  includeSeeds?: boolean;
  schemaVersion?: string; // Optional: 'latest', 'v3.1.0', etc.
}

export class DatabaseProvisioner {
  private apiToken: string;
  private accountId: string;
  private r2Bucket?: R2Bucket; // Add R2 bucket

  constructor(apiToken: string, accountId: string, r2Bucket?: R2Bucket) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.r2Bucket = r2Bucket;
  }

  /**
   * Provision database with schema from R2
   */
  async provisionDatabase(config: DatabaseProvisioningConfig): Promise<DatabaseProvisioningResult> {
    const startTime = Date.now();
    const result: DatabaseProvisioningResult = {
      success: false,
      databaseId: config.databaseId,
      tablesCreated: 0,
      rowsInserted: 0,
      duration: 0,
    };

    try {
      console.log(`[DB] Provisioning database for ${config.subdomain} (${config.databaseId})`);

      // Fetch schema from R2
      const schemaSQL = await this.fetchSchemaFromR2(config.schemaVersion || 'latest');
      console.log(`[DB] ✅ Fetched schema from R2 (${schemaSQL.length} bytes)`);

      // Execute schema
      const schemaResult = await this.executeSchemaSQL(config.databaseId, schemaSQL);
      result.tablesCreated = schemaResult.tablesCreated;
      console.log(`[DB] ✅ Created ${schemaResult.tablesCreated} tables`);

      // Insert seed data (if requested)
      if (config.includeSeeds !== false) {
        const seedResult = await this.executeSeedData(config.databaseId);
        result.rowsInserted = seedResult.rowsInserted;
        console.log(`[DB] ✅ Inserted ${seedResult.rowsInserted} seed rows`);
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      console.log(`[DB] ✅ Database provisioning completed in ${result.duration}ms`);
      return result;

    } catch (error: any) {
      result.error = error.message || 'Unknown error';
      result.duration = Date.now() - startTime;
      console.error(`[DB] ❌ Database provisioning failed:`, error);
      throw error;
    }
  }

  /**
   * Fetch schema from R2
   */
  private async fetchSchemaFromR2(version: string = 'latest'): Promise<string> {
    if (!this.r2Bucket) {
      throw new Error('R2 bucket not configured - cannot fetch schema');
    }

    const schemaKey = version === 'latest'
      ? 'pos-schema-latest.sql'
      : `pos-schema-${version}.sql`;

    console.log(`[R2] Fetching schema: ${schemaKey}`);

    const schemaObject = await this.r2Bucket.get(schemaKey);

    if (!schemaObject) {
      throw new Error(`Schema not found in R2: ${schemaKey}`);
    }

    const schemaSQL = await schemaObject.text();

    if (!schemaSQL || schemaSQL.length === 0) {
      throw new Error(`Empty schema fetched from R2: ${schemaKey}`);
    }

    console.log(`[R2] ✅ Fetched ${schemaKey} (${schemaSQL.length} bytes)`);

    return schemaSQL;
  }

  /**
   * Execute schema SQL statements
   */
  private async executeSchemaSQL(databaseId: string, schemaSQL: string): Promise<{ tablesCreated: number }> {
    const statements = this.splitSQLStatements(schemaSQL);
    let tablesCreated = 0;

    console.log(`[DB] Executing ${statements.length} SQL statements...`);

    for (const statement of statements) {
      if (statement.trim()) {
        await this.executeSQLStatement(databaseId, statement);
        if (statement.toUpperCase().includes('CREATE TABLE')) {
          tablesCreated++;
        }
      }
    }

    return { tablesCreated };
  }

  /**
   * Execute seed data (categories, default settings)
   */
  private async executeSeedData(databaseId: string): Promise<{ rowsInserted: number }> {
    // Minimal seed data - categories only
    const seedSQL = `
      -- Default menu categories (if menu_categories table exists)
      INSERT OR IGNORE INTO menu_categories (id, tenant_id, name, display_order, created_at, updated_at)
      VALUES
        (1, 'default', 'Starters', 1, datetime('now'), datetime('now')),
        (2, 'default', 'Main Course', 2, datetime('now'), datetime('now')),
        (3, 'default', 'Breads', 3, datetime('now'), datetime('now')),
        (4, 'default', 'Rice & Biryani', 4, datetime('now'), datetime('now')),
        (5, 'default', 'Desserts', 5, datetime('now'), datetime('now')),
        (6, 'default', 'Beverages', 6, datetime('now'), datetime('now'));
    `;

    const statements = this.splitSQLStatements(seedSQL);
    let rowsInserted = 0;

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await this.executeSQLStatement(databaseId, statement);
          if (statement.toUpperCase().includes('INSERT')) {
            rowsInserted += 6; // Default categories
          }
        } catch (error: any) {
          // Ignore errors for seed data (table might not exist)
          console.warn(`[DB] Seed data warning:`, error.message);
        }
      }
    }

    return { rowsInserted };
  }

  // ... rest of the methods remain the same (executeSQLStatement, splitSQLStatements, etc.)
}
```

### Step 6: Update subdomain-service.ts

Pass R2 bucket to DatabaseProvisioner:

```typescript
// /platform/workers/domain-service/src/core/subdomain-service.ts

private async provisionDatabase(
  databaseId: string,
  databaseName: string,
  tenantId: string,
  subdomain: string
): Promise<DatabaseProvisioningResult> {
  console.log(`[DB] Provisioning database for ${subdomain}`);

  // Get API token from Token Manager
  const apiToken = await getCloudflareStorageToken();
  const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('Missing required credentials');
  }

  // Create DatabaseProvisioner with R2 bucket
  const provisioner = new DatabaseProvisioner(
    apiToken,
    accountId,
    this.env.SCHEMA_STORAGE // Pass R2 bucket binding
  );

  const result = await provisioner.provisionDatabase({
    databaseId,
    tenantId,
    subdomain,
    includeSeeds: true,
    schemaVersion: 'latest', // Use latest schema from R2
  });

  if (!result.success) {
    throw new Error(result.error || 'Database provisioning failed');
  }

  console.log(`[DB] ✅ Provisioned: ${result.tablesCreated} tables, ${result.rowsInserted} rows`);

  return result;
}
```

## Schema Update Workflow

### When Adding New Features (e.g., Bar Management)

1. **Update Local Schema**
   ```bash
   # Edit the schema file
   code /Users/stonepot-tech/projects/restaurant-pos-ai/docs/d1-complete-migration.sql

   # Add new tables (e.g., bar_orders, bar_inventory_items)
   ```

2. **Upload to R2**
   ```bash
   # Upload updated schema
   wrangler r2 object put handsfree-schemas/pos-schema-latest.sql \
     --file=/Users/stonepot-tech/projects/restaurant-pos-ai/docs/d1-complete-migration.sql

   # Also create versioned backup
   wrangler r2 object put handsfree-schemas/pos-schema-v3.2.0.sql \
     --file=/Users/stonepot-tech/projects/restaurant-pos-ai/docs/d1-complete-migration.sql
   ```

3. **Test New Provisioning**
   ```bash
   # Create test tenant to verify schema
   curl -X POST https://handsfree-domain-service.workers.dev/api/provision \
     -H "Content-Type: application/json" \
     -d '{
       "tenantId": "test-schema-v32",
       "subdomain": "test-schema-v32",
       "companyName": "Test Restaurant"
     }'

   # Check table count
   wrangler d1 execute test-schema-v32_db --remote \
     --command="SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
   ```

4. **No Worker Redeployment Needed** ✅
   - New tenants automatically get the updated schema
   - Existing tenants remain on their current schema
   - Can apply migrations to existing tenants separately

## Schema Versioning

### Version Naming Convention

```
pos-schema-latest.sql       # Always points to current production schema
pos-schema-v3.2.0.sql       # Specific version (semantic versioning)
pos-schema-v3.1.0.sql       # Previous version (for rollback)
pos-schema-v3.0.0.sql       # Older version
```

### Rollback to Previous Version

If you need to rollback:

```bash
# Option 1: Update latest to point to previous version
wrangler r2 object put handsfree-schemas/pos-schema-latest.sql \
  --file=pos-schema-v3.1.0.sql

# Option 2: Specify version in provisioning config
# Update subdomain-service.ts:
schemaVersion: 'v3.1.0' // Instead of 'latest'
```

## Monitoring

### Check Current Schema in R2

```bash
# List schemas
wrangler r2 object list handsfree-schemas

# Download current schema
wrangler r2 object get handsfree-schemas/pos-schema-latest.sql \
  --file=downloaded-schema.sql

# View schema metadata
wrangler r2 object info handsfree-schemas/pos-schema-latest.sql
```

### Verify Tenant Database

```bash
# Check table count for newly provisioned tenant
wrangler d1 execute {subdomain}_db --remote \
  --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"

# Should return: 45 tables

# List all tables
wrangler d1 execute {subdomain}_db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

## Best Practices

1. **Always Version Schemas**: Keep versioned copies in R2 for rollback
2. **Test Before Upload**: Test schema locally with SQLite before uploading
3. **Update Documentation**: Update table counts in docs when schema changes
4. **Monitor Provisioning**: Check new tenant provisioning logs after schema updates
5. **Gradual Rollout**: Test with one tenant before updating `latest`
6. **Backup Before Update**: Download current `latest` before overwriting

## Troubleshooting

### Schema Not Found in R2

```bash
# List bucket contents
wrangler r2 object list handsfree-schemas

# Re-upload schema
wrangler r2 object put handsfree-schemas/pos-schema-latest.sql \
  --file=/path/to/d1-complete-migration.sql
```

### Provisioning Fails with SQL Errors

```bash
# Download schema from R2 to verify
wrangler r2 object get handsfree-schemas/pos-schema-latest.sql \
  --file=verify-schema.sql

# Test locally
sqlite3 test.db < verify-schema.sql

# Check for syntax errors
```

### Worker Can't Access R2

```bash
# Verify R2 binding in wrangler.jsonc
cat wrangler.jsonc | grep -A 5 "r2_buckets"

# Redeploy worker
wrangler deploy
```

## Cost Considerations

**R2 Pricing** (as of 2024):
- Storage: $0.015 per GB per month
- Class A Operations (write): $4.50 per million requests
- Class B Operations (read): $0.36 per million requests

**Schema Storage Cost**:
- Schema size: ~50 KB
- Monthly storage: $0.00001 (~negligible)
- Provisioning reads: Minimal (only on new tenant creation)

**Estimated Monthly Cost**: < $0.01 for schema storage

## Related Files

- **Schema Source**: `/docs/d1-complete-migration.sql`
- **Database Provisioner**: `/platform/workers/domain-service/src/core/database-provisioner.ts`
- **Subdomain Service**: `/platform/workers/domain-service/src/core/subdomain-service.ts`
- **Wrangler Config**: `/platform/workers/domain-service/wrangler.jsonc`

---

**Last Updated**: 2026-01-23
**Architecture**: R2-based Schema Provisioning
**Current Schema Version**: v3.1.0 (45 tables)
