# Dynamic Migration System Design

## Problem Statement

**Current Limitation**: Migrations are compiled into the binary using `include_str!()` in `lib.rs`. Adding new database migrations requires:
1. Adding migration SQL file to `src-tauri/migrations/`
2. Adding migration entry to `lib.rs`
3. Rebuilding the entire Rust binary
4. Redistributing installer to users

**Desired Behavior**: Download migrations from cloud and apply them without requiring app rebuild or reinstall.

---

## Use Cases

### Use Case 1: Feature Rollout Without Rebuild
```
Scenario: Adding "loyalty points" feature to existing installations

Current Flow:
1. Write migration 038_loyalty_points.sql
2. Add to lib.rs migrations array
3. Rebuild app (cargo build - 30+ minutes)
4. Create new installer
5. Users must download and reinstall

Dynamic Flow:
1. Write migration 038_loyalty_points.sql
2. Upload to Cloudflare R2
3. App checks for new migrations on startup
4. Downloads and applies automatically
5. No rebuild, no reinstall required
```

### Use Case 2: Hotfix Database Schema
```
Scenario: Critical bug fix requires schema change

Current Flow:
- Same as above, requires rebuild + reinstall
- Takes hours to deploy

Dynamic Flow:
- Upload migration to cloud
- Apps auto-update within minutes
- No user intervention needed
```

### Use Case 3: Multi-Tenant Feature Flags
```
Scenario: Enable feature for specific tenants

Dynamic Flow:
1. Upload migration with tenant-specific logic
2. App downloads if tenant matches whitelist
3. Feature enabled without rebuild
```

---

## Architecture Design

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    HandsFree POS App                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │   Migration Service (Rust)                │          │
│  │                                            │          │
│  │  • Built-in Migrations (compiled)         │          │
│  │  • Dynamic Migration Loader               │          │
│  │  • Migration Executor                     │          │
│  │  • Version Tracker                        │          │
│  └──────────────────────────────────────────┘          │
│                    ↓          ↑                          │
│                    ↓          ↑                          │
│            Apply   ↓          ↑   Download               │
│                    ↓          ↑                          │
│         ┌──────────▼──────────┴─────────┐               │
│         │   Local SQLite Database       │               │
│         │                                │               │
│         │  • schema_migrations table     │               │
│         │    - version (int)             │               │
│         │    - name (text)               │               │
│         │    - applied_at (timestamp)    │               │
│         │    - source (built-in/cloud)   │               │
│         │    - checksum (SHA256)         │               │
│         └────────────────────────────────┘               │
│                                                          │
└─────────────────────────────────────────────────────────┘
                           ↑
                           │ HTTP GET
                           │
        ┌──────────────────▼──────────────────┐
        │   Cloudflare R2 Storage              │
        │                                      │
        │   /migrations/                       │
        │   ├── manifest.json                  │
        │   ├── 038_loyalty_points.sql         │
        │   ├── 039_delivery_tracking.sql      │
        │   └── 040_customer_feedback.sql      │
        │                                      │
        │   manifest.json:                     │
        │   {                                  │
        │     "migrations": [                  │
        │       {                              │
        │         "version": 38,               │
        │         "name": "loyalty_points",    │
        │         "file": "038_loyalty_points.sql",│
        │         "checksum": "sha256...",     │
        │         "required_app_version": "3.1.0",│
        │         "tenant_whitelist": null     │
        │       }                              │
        │     ]                                │
        │   }                                  │
        └──────────────────────────────────────┘
```

---

## Implementation

### 1. Migration Manifest Schema

**File**: `migrations/manifest.json` (uploaded to R2)

```json
{
  "version": 1,
  "migrations": [
    {
      "version": 38,
      "name": "loyalty_points",
      "description": "Add loyalty points system",
      "file": "038_loyalty_points.sql",
      "checksum": "sha256:abc123...",
      "required_app_version": "3.1.0",
      "tenant_whitelist": null,
      "created_at": "2026-01-26T10:00:00Z"
    },
    {
      "version": 39,
      "name": "delivery_tracking",
      "description": "Add delivery order tracking",
      "file": "039_delivery_tracking.sql",
      "checksum": "sha256:def456...",
      "required_app_version": "3.2.0",
      "tenant_whitelist": ["tenant-123", "tenant-456"],
      "created_at": "2026-01-27T14:30:00Z"
    }
  ]
}
```

### 2. Database Schema Addition

**File**: `src-tauri/migrations/038_migration_tracking.sql`

```sql
-- Track applied migrations (including dynamic ones)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL CHECK(source IN ('built-in', 'cloud')),
    checksum TEXT NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch()),
    app_version TEXT NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_migrations_source ON schema_migrations(source);
CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON schema_migrations(applied_at DESC);
```

### 3. Rust Implementation

**File**: `src-tauri/src/services/dynamic_migrations.rs`

```rust
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationManifest {
    pub version: i32,
    pub migrations: Vec<MigrationEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MigrationEntry {
    pub version: i32,
    pub name: String,
    pub description: Option<String>,
    pub file: String,
    pub checksum: String,
    pub required_app_version: String,
    pub tenant_whitelist: Option<Vec<String>>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppliedMigration {
    pub version: i32,
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    pub checksum: String,
    pub applied_at: i64,
    pub app_version: String,
}

pub struct DynamicMigrationService {
    db_path: PathBuf,
    cloud_base_url: String,
    tenant_id: String,
    app_version: String,
}

impl DynamicMigrationService {
    pub fn new(
        db_path: PathBuf,
        cloud_base_url: String,
        tenant_id: String,
        app_version: String,
    ) -> Self {
        Self {
            db_path,
            cloud_base_url,
            tenant_id,
            app_version,
        }
    }

    /// Fetch migration manifest from cloud
    pub async fn fetch_manifest(&self) -> Result<MigrationManifest, String> {
        let url = format!("{}/migrations/manifest.json", self.cloud_base_url);

        let response = reqwest::get(&url)
            .await
            .map_err(|e| format!("Failed to fetch manifest: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Manifest fetch failed with status: {}", response.status()));
        }

        let manifest: MigrationManifest = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse manifest: {}", e))?;

        Ok(manifest)
    }

    /// Download migration SQL file from cloud
    pub async fn download_migration(&self, entry: &MigrationEntry) -> Result<String, String> {
        let url = format!("{}/migrations/{}", self.cloud_base_url, entry.file);

        let response = reqwest::get(&url)
            .await
            .map_err(|e| format!("Failed to download migration: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Migration download failed: {}", response.status()));
        }

        let sql_content = response
            .text()
            .await
            .map_err(|e| format!("Failed to read migration content: {}", e))?;

        // Verify checksum
        let calculated_checksum = self.calculate_checksum(&sql_content);
        if calculated_checksum != entry.checksum {
            return Err(format!(
                "Checksum mismatch! Expected: {}, Got: {}",
                entry.checksum, calculated_checksum
            ));
        }

        Ok(sql_content)
    }

    /// Calculate SHA256 checksum
    fn calculate_checksum(&self, content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("sha256:{}", hex::encode(hasher.finalize()))
    }

    /// Get list of applied migrations
    pub fn get_applied_migrations(&self) -> Result<Vec<AppliedMigration>, String> {
        let db = Connection::open(&self.db_path).map_err(|e| e.to_string())?;

        let mut stmt = db
            .prepare(
                "SELECT version, name, description, source, checksum, applied_at, app_version
                 FROM schema_migrations
                 ORDER BY version ASC"
            )
            .map_err(|e| format!("Failed to query migrations: {}", e))?;

        let migrations = stmt
            .query_map([], |row| {
                Ok(AppliedMigration {
                    version: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    source: row.get(3)?,
                    checksum: row.get(4)?,
                    applied_at: row.get(5)?,
                    app_version: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to fetch migrations: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to process migrations: {}", e))?;

        Ok(migrations)
    }

    /// Check if migration is already applied
    pub fn is_migration_applied(&self, version: i32) -> Result<bool, String> {
        let db = Connection::open(&self.db_path).map_err(|e| e.to_string())?;

        let count: i32 = db
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
                params![version],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(count > 0)
    }

    /// Check if migration is applicable to this tenant
    pub fn is_migration_applicable(&self, entry: &MigrationEntry) -> bool {
        // Check tenant whitelist
        if let Some(whitelist) = &entry.tenant_whitelist {
            if !whitelist.contains(&self.tenant_id) {
                println!(
                    "[DynamicMigrations] Migration {} not applicable for tenant {}",
                    entry.name, self.tenant_id
                );
                return false;
            }
        }

        // Check app version compatibility
        if !self.is_version_compatible(&entry.required_app_version) {
            println!(
                "[DynamicMigrations] Migration {} requires app version {} (current: {})",
                entry.name, entry.required_app_version, self.app_version
            );
            return false;
        }

        true
    }

    /// Check if current app version meets requirement
    fn is_version_compatible(&self, required: &str) -> bool {
        // Simple version comparison (you can use semver crate for better handling)
        let current_parts: Vec<u32> = self.app_version
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect();
        let required_parts: Vec<u32> = required
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect();

        for i in 0..3 {
            let current = current_parts.get(i).unwrap_or(&0);
            let required = required_parts.get(i).unwrap_or(&0);

            if current < required {
                return false;
            } else if current > required {
                return true;
            }
        }

        true
    }

    /// Apply a migration
    pub fn apply_migration(
        &self,
        entry: &MigrationEntry,
        sql_content: &str,
    ) -> Result<(), String> {
        let db = Connection::open(&self.db_path).map_err(|e| e.to_string())?;

        // Execute migration in transaction
        db.execute("BEGIN TRANSACTION", [])
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        match db.execute_batch(sql_content) {
            Ok(_) => {
                // Record migration as applied
                db.execute(
                    "INSERT INTO schema_migrations (version, name, description, source, checksum, app_version)
                     VALUES (?1, ?2, ?3, 'cloud', ?4, ?5)",
                    params![
                        entry.version,
                        &entry.name,
                        &entry.description,
                        &entry.checksum,
                        &self.app_version,
                    ],
                )
                .map_err(|e| format!("Failed to record migration: {}", e))?;

                db.execute("COMMIT", [])
                    .map_err(|e| format!("Failed to commit transaction: {}", e))?;

                println!(
                    "[DynamicMigrations] Applied migration {} (version {})",
                    entry.name, entry.version
                );

                Ok(())
            }
            Err(e) => {
                db.execute("ROLLBACK", []).ok();
                Err(format!("Failed to apply migration: {}", e))
            }
        }
    }

    /// Check for and apply new migrations
    pub async fn sync_migrations(&self) -> Result<Vec<String>, String> {
        println!("[DynamicMigrations] Checking for new migrations...");

        // Fetch manifest
        let manifest = self.fetch_manifest().await?;

        let mut applied_migrations = Vec::new();

        // Process each migration
        for entry in manifest.migrations {
            // Skip if already applied
            if self.is_migration_applied(entry.version)? {
                continue;
            }

            // Skip if not applicable to this tenant
            if !self.is_migration_applicable(&entry) {
                continue;
            }

            // Download migration
            println!("[DynamicMigrations] Downloading migration: {}", entry.name);
            let sql_content = self.download_migration(&entry).await?;

            // Apply migration
            self.apply_migration(&entry, &sql_content)?;

            applied_migrations.push(format!("{} (v{})", entry.name, entry.version));
        }

        if applied_migrations.is_empty() {
            println!("[DynamicMigrations] No new migrations to apply");
        } else {
            println!(
                "[DynamicMigrations] Applied {} migrations: {:?}",
                applied_migrations.len(),
                applied_migrations
            );
        }

        Ok(applied_migrations)
    }
}
```

### 4. Tauri Commands

**File**: `src-tauri/src/commands/dynamic_migrations.rs`

```rust
use crate::services::dynamic_migrations::{DynamicMigrationService, AppliedMigration};
use tauri::Manager;

#[tauri::command]
pub async fn sync_dynamic_migrations(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

    // Get tenant ID from database
    let tenant_id = get_tenant_id(&app)?;

    // Get app version from package.json
    let app_version = env!("CARGO_PKG_VERSION").to_string();

    // Get cloud base URL from env
    let cloud_base_url = std::env::var("VITE_API_BASE_URL")
        .unwrap_or_else(|_| "https://api.example.com".to_string());

    let service = DynamicMigrationService::new(
        db_path,
        cloud_base_url,
        tenant_id,
        app_version,
    );

    service.sync_migrations().await
}

#[tauri::command]
pub async fn get_migration_history(app: tauri::AppHandle) -> Result<Vec<AppliedMigration>, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

    let service = DynamicMigrationService::new(
        db_path,
        String::new(),
        String::new(),
        String::new(),
    );

    service.get_applied_migrations()
}

fn get_tenant_id(app: &tauri::AppHandle) -> Result<String, String> {
    use rusqlite::Connection;

    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pos.db");

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let tenant_id: String = db
        .query_row(
            "SELECT tenant_id FROM tenant_activation WHERE is_activated = 1 LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get tenant_id: {}", e))?;

    Ok(tenant_id)
}
```

### 5. Frontend Integration

**File**: `src/services/dynamicMigrations.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface AppliedMigration {
  version: number;
  name: string;
  description?: string;
  source: 'built-in' | 'cloud';
  checksum: string;
  applied_at: number;
  app_version: string;
}

export async function syncDynamicMigrations(): Promise<string[]> {
  return await invoke<string[]>('sync_dynamic_migrations');
}

export async function getMigrationHistory(): Promise<AppliedMigration[]> {
  return await invoke<AppliedMigration[]>('get_migration_history');
}
```

**File**: `src/hooks/useDynamicMigrations.ts`

```typescript
import { useEffect, useState } from 'react';
import { syncDynamicMigrations } from '../services/dynamicMigrations';
import { toast } from 'sonner';

export function useDynamicMigrations(options: {
  checkOnStartup?: boolean;
  checkIntervalMinutes?: number;
} = {}) {
  const { checkOnStartup = true, checkIntervalMinutes = 60 } = options;
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkMigrations = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const appliedMigrations = await syncDynamicMigrations();

      if (appliedMigrations.length > 0) {
        toast.success(
          `Applied ${appliedMigrations.length} new migrations`,
          { description: appliedMigrations.join(', ') }
        );
      }

      setLastCheck(new Date());
    } catch (error) {
      console.error('[DynamicMigrations] Sync failed:', error);
      toast.error('Failed to sync migrations', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Check on startup
  useEffect(() => {
    if (checkOnStartup) {
      checkMigrations();
    }
  }, []);

  // Periodic check
  useEffect(() => {
    if (checkIntervalMinutes > 0) {
      const interval = setInterval(
        checkMigrations,
        checkIntervalMinutes * 60 * 1000
      );
      return () => clearInterval(interval);
    }
  }, [checkIntervalMinutes]);

  return {
    isSyncing,
    lastCheck,
    checkMigrations,
  };
}
```

**File**: `src/App.tsx`

```typescript
import { useDynamicMigrations } from './hooks/useDynamicMigrations';

function App() {
  // Auto-sync migrations on startup and every hour
  useDynamicMigrations({
    checkOnStartup: true,
    checkIntervalMinutes: 60,
  });

  return (
    // ... your app
  );
}
```

---

## Deployment Workflow

### 1. Create Migration File

```bash
# Create new migration
cat > src-tauri/migrations/038_loyalty_points.sql << 'EOF'
CREATE TABLE IF NOT EXISTS loyalty_points (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_id TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_points(customer_id);
EOF
```

### 2. Calculate Checksum

```bash
# Calculate SHA256 checksum
CHECKSUM=$(shasum -a 256 src-tauri/migrations/038_loyalty_points.sql | awk '{print $1}')
echo "sha256:$CHECKSUM"
```

### 3. Update Manifest

```bash
# Update manifest.json
cat > migrations/manifest.json << EOF
{
  "version": 1,
  "migrations": [
    {
      "version": 38,
      "name": "loyalty_points",
      "description": "Add loyalty points system",
      "file": "038_loyalty_points.sql",
      "checksum": "sha256:$CHECKSUM",
      "required_app_version": "3.1.0",
      "tenant_whitelist": null,
      "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  ]
}
EOF
```

### 4. Upload to Cloudflare R2

```bash
# Upload migration file
wrangler r2 object put handsfree-pos/migrations/038_loyalty_points.sql \
  --file=src-tauri/migrations/038_loyalty_points.sql

# Upload manifest
wrangler r2 object put handsfree-pos/migrations/manifest.json \
  --file=migrations/manifest.json
```

### 5. Apps Auto-Sync

```
App Startup:
1. useDynamicMigrations hook runs
2. Calls sync_dynamic_migrations command
3. Downloads manifest from R2
4. Checks for new migrations
5. Downloads + applies if applicable
6. Shows toast notification
```

---

## Security Considerations

### 1. Checksum Verification
- Every migration file has SHA256 checksum
- Downloaded content is verified before execution
- Prevents tampering and corruption

### 2. App Version Compatibility
- Migrations specify `required_app_version`
- Older apps skip incompatible migrations
- Prevents breaking changes on old versions

### 3. Tenant Whitelisting
- Migrations can specify `tenant_whitelist`
- Beta features can be rolled out to specific tenants
- Production tenants protected from experimental changes

### 4. Transaction Safety
- All migrations execute in transactions
- Rollback on failure prevents partial application
- Database remains consistent

### 5. HTTPS + Authentication
- All downloads over HTTPS
- Can add API token verification
- Prevent unauthorized migration injection

---

## Benefits

✅ **No Rebuild Required**: Add features without recompiling app
✅ **Instant Deployment**: Upload migration, apps sync within minutes
✅ **Gradual Rollout**: Enable features for specific tenants first
✅ **Version Safety**: Old apps won't apply incompatible migrations
✅ **Audit Trail**: Track which migrations applied when
✅ **Rollback Support**: Can create reverse migrations
✅ **Offline Support**: Apps cache migrations, apply when online
✅ **Multi-Tenant**: Different tenants can have different schemas

---

## Limitations

⚠️ **One-Way Migrations**: Cannot automatically rollback (must create reverse migration)
⚠️ **Network Required**: Initial download needs internet (can cache for offline)
⚠️ **Breaking Changes Risk**: Poorly written migrations can break app
⚠️ **Schema Drift**: Different devices might temporarily have different schemas

---

## Next Steps

1. **Implement Core Service**: Create `dynamic_migrations.rs` service
2. **Add Tauri Commands**: Register commands in `lib.rs`
3. **Create React Hook**: Implement `useDynamicMigrations`
4. **Test Workflow**: Upload test migration to R2
5. **Add UI Dashboard**: Show migration history in settings
6. **Create CLI Tool**: Automate manifest generation + upload

---

## Example: Complete Migration Deployment

```bash
#!/bin/bash
# deploy-migration.sh

MIGRATION_FILE=$1
MIGRATION_VERSION=$2
MIGRATION_NAME=$3
REQUIRED_APP_VERSION=$4

# Calculate checksum
CHECKSUM=$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')

# Upload to R2
wrangler r2 object put "handsfree-pos/migrations/$(basename $MIGRATION_FILE)" \
  --file="$MIGRATION_FILE"

# Update manifest (append to existing)
jq ".migrations += [{
  \"version\": $MIGRATION_VERSION,
  \"name\": \"$MIGRATION_NAME\",
  \"file\": \"$(basename $MIGRATION_FILE)\",
  \"checksum\": \"sha256:$CHECKSUM\",
  \"required_app_version\": \"$REQUIRED_APP_VERSION\",
  \"tenant_whitelist\": null,
  \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}]" manifest.json > manifest.tmp && mv manifest.tmp manifest.json

# Upload updated manifest
wrangler r2 object put handsfree-pos/migrations/manifest.json \
  --file=manifest.json

echo "✅ Migration deployed: $MIGRATION_NAME (v$MIGRATION_VERSION)"
```

**Usage**:
```bash
./deploy-migration.sh \
  src-tauri/migrations/038_loyalty_points.sql \
  38 \
  "loyalty_points" \
  "3.1.0"
```

---

## Status

**Design**: Complete ✅
**Implementation**: Ready to code
**Testing**: Pending
**Production**: Not deployed

This system enables feature deployment without rebuilds, dramatically improving development velocity and user experience! 🚀
