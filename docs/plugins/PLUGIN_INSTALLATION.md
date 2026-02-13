# Plugin Installation System

## Overview

The POS application now has a complete plugin infrastructure that allows dynamic installation of features without modifying core code. Plugins are stored in R2 and can be installed on-demand by users.

## Architecture

### Plugin Types

1. **Frontend WASM Plugins**: UI components loaded dynamically
2. **Backend WASM Plugins**: Worker-based API and scheduled tasks
3. **Hybrid Plugins**: Combination of both frontend and backend

### Plugin Infrastructure Tables

The system automatically creates these tables when needed:

#### `installed_plugins`
```sql
CREATE TABLE installed_plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    author TEXT,
    manifest TEXT NOT NULL,  -- Full manifest JSON
    installed_at INTEGER NOT NULL,
    enabled INTEGER DEFAULT 1
);
```

#### `plugin_migrations`
```sql
CREATE TABLE plugin_migrations (
    plugin_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    PRIMARY KEY (plugin_id, version)
);
```

## Plugin Manifest Structure

Each plugin must have a `manifest.json` file in R2:

```json
{
  "id": "inventory-management",
  "name": "Inventory Management",
  "version": "1.0.0",
  "description": "Track stock levels, suppliers, and purchase orders",
  "author": "Guanix Team",
  "requires_permissions": [
    "database.read.inventory_items",
    "database.write.inventory_items",
    "database.read.suppliers",
    "database.write.suppliers",
    "database.read.purchase_orders",
    "database.write.purchase_orders",
    "ui.mount.inventory"
  ],
  "migrations": [
    {
      "version": 1,
      "name": "inventory_items",
      "sql_url": "https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/inventory-management/migrations/001_inventory_items.sql"
    },
    {
      "version": 2,
      "name": "suppliers",
      "sql_url": "https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/inventory-management/migrations/002_suppliers.sql"
    },
    {
      "version": 3,
      "name": "purchase_orders",
      "sql_url": "https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/inventory-management/migrations/003_purchase_orders.sql"
    }
  ],
  "commands": [
    "get_inventory_items",
    "update_inventory_item",
    "create_purchase_order",
    "get_suppliers"
  ],
  "ui_routes": [
    {
      "path": "/inventory",
      "component_url": "https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/inventory-management/client.wasm",
      "roles": ["owner", "manager"]
    }
  ],
  "hub_card": {
    "title": "Inventory",
    "description": "Manage stock levels",
    "icon": "📦",
    "path": "/inventory",
    "accent_color": "blue",
    "roles": ["owner", "manager"],
    "order": 5
  }
}
```

## R2 Storage Structure

```
plugins/
├── inventory-management/
│   ├── manifest.json
│   ├── client.wasm                    # Frontend WASM
│   ├── worker.wasm                    # Backend WASM
│   └── migrations/
│       ├── 001_inventory_items.sql
│       ├── 002_suppliers.sql
│       └── 003_purchase_orders.sql
├── subscription-meals/
│   ├── manifest.json
│   ├── client.wasm
│   ├── worker.wasm
│   └── migrations/
│       ├── 001_subscription_plans.sql
│       ├── 002_subscription_customers.sql
│       └── 003_subscription_menu_weeks.sql
└── ... (other plugins)
```

## Installation Flow

### 1. User Initiates Installation

From the frontend:
```typescript
import { invoke } from '@tauri-apps/api/core';

async function installPlugin(pluginId: string) {
  try {
    const result = await invoke<string>('install_plugin', { pluginId });
    console.log(result); // "Plugin 'Inventory Management' v1.0.0 installed successfully. 3 migrations applied."
  } catch (error) {
    console.error('Failed to install plugin:', error);
  }
}

// Usage
await installPlugin('inventory-management');
```

### 2. Backend Process

The `install_plugin` command:

1. **Downloads manifest** from R2:
   ```
   https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/inventory-management/manifest.json
   ```

2. **Validates manifest**:
   - Checks ID matches requested plugin
   - Validates required structure

3. **Checks if already installed**:
   - Queries `installed_plugins` table
   - Returns error if already exists

4. **Downloads migration SQL files**:
   - Fetches all SQL files listed in manifest
   - Checks which migrations are already applied
   - Only downloads pending migrations

5. **Executes migrations**:
   - Runs SQL files in order
   - Marks each as applied in `plugin_migrations` table
   - All migrations run in a transaction

6. **Marks plugin as installed**:
   - Inserts row into `installed_plugins` table
   - Stores full manifest JSON for reference

### 3. Command Gating

Existing commands check if required plugin is installed:

```rust
use crate::commands::plugin::require_plugin;

#[tauri::command]
pub fn get_inventory_items(app: tauri::AppHandle) -> Result<Vec<InventoryItem>, String> {
    // Check if inventory plugin is installed
    require_plugin(&app, "inventory-management")?;

    // ... rest of implementation
}
```

The `require_plugin` helper:
- Queries `installed_plugins` table
- Returns error if plugin not installed
- Error message guides user to install from Plugins page

## Available Commands

### Frontend Commands

#### `install_plugin(pluginId: string) -> Promise<string>`
Install a plugin from R2.

**Example:**
```typescript
const result = await invoke('install_plugin', {
  pluginId: 'inventory-management'
});
console.log(result); // Success message with migration count
```

#### `is_plugin_installed(pluginId: string) -> Promise<boolean>`
Check if a plugin is installed and enabled.

**Example:**
```typescript
const installed = await invoke('is_plugin_installed', {
  pluginId: 'inventory-management'
});

if (installed) {
  // Show inventory UI
} else {
  // Show "Install Plugin" prompt
}
```

#### `get_installed_plugins() -> Promise<PluginManifest[]>`
Get list of all installed plugins with their manifests.

**Example:**
```typescript
const plugins = await invoke('get_installed_plugins');
plugins.forEach(plugin => {
  console.log(`${plugin.name} v${plugin.version} - ${plugin.description}`);
});
```

#### `uninstall_plugin(pluginId: string) -> Promise<string>`
Disable a plugin (preserves data, just marks as disabled).

**Example:**
```typescript
await invoke('uninstall_plugin', {
  pluginId: 'inventory-management'
});
// Plugin disabled but data remains in database
```

#### `enable_plugin(pluginId: string) -> Promise<string>`
Re-enable a previously disabled plugin.

**Example:**
```typescript
await invoke('enable_plugin', {
  pluginId: 'inventory-management'
});
// Plugin re-enabled, no migrations re-run
```

## Creating a New Plugin

### Step 1: Design Plugin Structure

Determine:
- Plugin ID (kebab-case, e.g., `inventory-management`)
- Required database tables
- UI components needed
- Permissions required
- Commands to expose

### Step 2: Create Database Migrations

Create numbered SQL files:

**001_inventory_items.sql:**
```sql
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    min_quantity REAL NOT NULL DEFAULT 0,
    max_quantity REAL,
    cost_per_unit REAL,
    last_restocked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_inventory_items_tenant ON inventory_items(tenant_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_category ON inventory_items(category);
```

### Step 3: Create Manifest

**manifest.json:**
```json
{
  "id": "inventory-management",
  "name": "Inventory Management",
  "version": "1.0.0",
  "description": "Track stock levels and suppliers",
  "author": "Guanix Team",
  "requires_permissions": [
    "database.read.inventory_items",
    "database.write.inventory_items"
  ],
  "migrations": [
    {
      "version": 1,
      "name": "inventory_items",
      "sql_url": "https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/inventory-management/migrations/001_inventory_items.sql"
    }
  ],
  "commands": [
    "get_inventory_items",
    "update_inventory_item"
  ],
  "ui_routes": [
    {
      "path": "/inventory",
      "component_url": "https://pub-6ec7c7c2e0e04a3e8db2f1b21fffc13f.r2.dev/plugins/inventory-management/client.wasm",
      "roles": ["owner", "manager"]
    }
  ],
  "hub_card": {
    "title": "Inventory",
    "description": "Manage stock levels",
    "icon": "📦",
    "path": "/inventory",
    "accent_color": "blue",
    "roles": ["owner", "manager"],
    "order": 5
  }
}
```

### Step 4: Upload to R2

Using Wrangler CLI:
```bash
# Upload manifest
wrangler r2 object put plugins/inventory-management/manifest.json \
  --file=./manifest.json \
  --bucket=guanix-pos-assets

# Upload migrations
wrangler r2 object put plugins/inventory-management/migrations/001_inventory_items.sql \
  --file=./migrations/001_inventory_items.sql \
  --bucket=guanix-pos-assets
```

### Step 5: Test Installation

```typescript
// In your app's plugin settings page
await invoke('install_plugin', { pluginId: 'inventory-management' });

// Verify installation
const installed = await invoke('is_plugin_installed', {
  pluginId: 'inventory-management'
});
console.log('Installed:', installed); // Should be true
```

## Error Handling

### Common Errors

#### "Plugin already installed"
```typescript
try {
  await invoke('install_plugin', { pluginId: 'inventory-management' });
} catch (error) {
  if (error.includes('already installed')) {
    // Show message: "Plugin is already installed"
    // Offer to uninstall/reinstall
  }
}
```

#### "Manifest not found"
```typescript
try {
  await invoke('install_plugin', { pluginId: 'non-existent-plugin' });
} catch (error) {
  if (error.includes('HTTP 404')) {
    // Show message: "Plugin not found in store"
  }
}
```

#### "Migration failed"
```typescript
try {
  await invoke('install_plugin', { pluginId: 'inventory-management' });
} catch (error) {
  if (error.includes('Migration') && error.includes('failed')) {
    // Show message: "Installation failed due to database error"
    // Plugin is NOT marked as installed, safe to retry
  }
}
```

## Command Gating Example

### In Rust Commands

```rust
#[tauri::command]
pub fn get_inventory_items(app: tauri::AppHandle) -> Result<Vec<InventoryItem>, String> {
    // Gate: Require inventory plugin
    commands::plugin::require_plugin(&app, "inventory-management")?;

    // Plugin is installed, proceed with implementation
    let db_path = app.path().app_data_dir()?.join(get_db_filename());
    let db = Connection::open(&db_path)?;

    // ... query inventory_items table
}
```

### In Frontend Code

```typescript
import { invoke } from '@tauri-apps/api/core';

async function loadInventory() {
  try {
    // Check if plugin is installed first
    const installed = await invoke('is_plugin_installed', {
      pluginId: 'inventory-management'
    });

    if (!installed) {
      // Show installation prompt
      setShowInstallPrompt(true);
      return;
    }

    // Plugin is installed, call command
    const items = await invoke('get_inventory_items');
    setInventoryItems(items);
  } catch (error) {
    console.error('Failed to load inventory:', error);
  }
}
```

## Migration Tracking

The system tracks which migrations have been applied:

```sql
SELECT * FROM plugin_migrations
WHERE plugin_id = 'inventory-management';

-- Result:
-- plugin_id              | version | name             | applied_at  | checksum
-- inventory-management   | 1       | inventory_items  | 1704096000  | inventory-management-inventory_items
-- inventory-management   | 2       | suppliers        | 1704096001  | inventory-management-suppliers
```

If you reinstall a plugin:
- Already-applied migrations are skipped
- Only new migrations are executed
- No duplicate data or errors

## Best Practices

### 1. Idempotent Migrations
Always use `CREATE TABLE IF NOT EXISTS`:
```sql
CREATE TABLE IF NOT EXISTS inventory_items (...);
-- NOT: CREATE TABLE inventory_items (...);
```

### 2. Unique Plugin IDs
Use kebab-case and descriptive names:
- ✅ `inventory-management`
- ✅ `subscription-meals`
- ❌ `plugin1`
- ❌ `inventoryManagement`

### 3. Semantic Versioning
Follow semver for plugin versions:
- `1.0.0` - Initial release
- `1.1.0` - New feature (new migration)
- `1.0.1` - Bug fix (no schema change)
- `2.0.0` - Breaking change

### 4. Migration Naming
Use descriptive, numbered names:
- `001_inventory_items.sql`
- `002_suppliers.sql`
- `003_purchase_orders.sql`
- NOT: `migration1.sql`, `update.sql`

### 5. Permission Scoping
Request only necessary permissions:
```json
"requires_permissions": [
  "database.read.inventory_items",
  "database.write.inventory_items"
]
```

NOT:
```json
"requires_permissions": [
  "database.*"  // Too broad
]
```

## Testing

### Unit Test: Plugin Installation
```typescript
import { test } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

test('should install inventory plugin', async () => {
  const result = await invoke('install_plugin', {
    pluginId: 'inventory-management'
  });

  expect(result).toContain('installed successfully');

  const installed = await invoke('is_plugin_installed', {
    pluginId: 'inventory-management'
  });

  expect(installed).toBe(true);
});
```

### Integration Test: Migration Execution
```typescript
test('should create inventory tables after installation', async () => {
  await invoke('install_plugin', { pluginId: 'inventory-management' });

  // Check if table exists
  const tableExists = await invoke('table_exists', {
    tableName: 'inventory_items'
  });

  expect(tableExists).toBe(true);
});
```

## Troubleshooting

### Problem: Migrations fail to apply
**Solution:** Check SQL syntax, ensure table names are unique, verify foreign key references exist.

### Problem: Plugin appears installed but commands fail
**Solution:** Restart the app to reload command registrations, verify plugin is marked as `enabled = 1` in database.

### Problem: Cannot uninstall plugin
**Solution:** Use `uninstall_plugin` command (disables but keeps data). To completely remove, manually delete from `installed_plugins` table and drop plugin tables.

### Problem: R2 files not found
**Solution:** Verify R2 bucket is public, check file paths match manifest URLs exactly, ensure CORS is enabled.

## Future Enhancements

1. **Plugin Marketplace UI**: Browse and install plugins from within the app
2. **Auto-Updates**: Check for new plugin versions and prompt to update
3. **Plugin Dependencies**: Allow plugins to depend on other plugins
4. **Rollback**: Ability to undo migrations if installation fails
5. **Plugin Analytics**: Track plugin usage and performance
6. **Sandboxing**: Isolate plugin code execution for security
7. **WASM Plugins**: Load frontend components dynamically from WASM modules
8. **Worker Plugins**: Run backend logic in Cloudflare Workers

## Related Files

- [src-tauri/src/commands/plugin.rs](../../src-tauri/src/commands/plugin.rs) - Plugin installation logic
- [src-tauri/src/commands/mod.rs](../../src-tauri/src/commands/mod.rs) - Command registration
- [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs) - Command handler setup
- [PLUGIN_SYNC_ARCHITECTURE.md](../../PLUGIN_SYNC_ARCHITECTURE.md) - Plugin sync system design
