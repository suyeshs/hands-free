# POS Integration Guide - Menu Sync Worker

## Current Architecture

### Orders Worker Structure
```
handsfree-orders (Router Worker)
  ↓ Dispatches to →
tenant-{tenantId} (Tenant-Specific Worker)
  ↓ Has bindings →
D1 Database (tenant-specific)
KV Namespace (shared)
```

### Menu Sync Worker Structure
```
filesearch-sync (Menu Sync Worker)
  ↓ Calls →
TENANT_DISPATCH (handsfree-tenants namespace)
  ↓ Fetches from →
tenant-{tenantId} workers
  ↓ Returns →
Menu data from D1
```

---

## How POS Integrates with Menu Sync

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     POS APPLICATION                          │
│  (Rust/Tauri - Local SQLite as Source of Truth)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  ┌─────────┴──────────┐
                  │  Menu Changes      │
                  │  (Local SQLite)    │
                  └─────────┬──────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌───────────────┐  ┌────────────────┐  ┌──────────────────┐
│ Orders Worker │  │ Tenant Worker  │  │ Menu Sync Worker │
│ (Router)      │  │ (D1 Database)  │  │ (Sync Engine)    │
└───────────────┘  └────────────────┘  └──────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
                 ┌──────────────────────┐
                 │   Synchronized Menu   │
                 │  • D1 (Source)        │
                 │  • KV (Cache)         │
                 │  • File Search (AI)   │
                 └──────────────────────┘
```

---

## Current Endpoints Available

### From Orders Worker (Router)

Based on analysis of `platform/workers/orders/src/index.ts`:

#### Menu Endpoints
```bash
# List menu items
GET /api/menu/{tenantId}
GET /api/menu-d1/{tenantId}  # Alias

# Get single menu item
GET /api/menu/{tenantId}/{itemId}

# Categories
GET /api/categories/{tenantId}
POST /api/categories/{tenantId}
GET /api/categories/{tenantId}/{categoryId}
```

#### Sales Sync
```bash
POST /api/sales/{tenantId}/sync
```

#### Settings/Config
```bash
GET /api/settings/{tenantId}
PUT /api/settings/{tenantId}

GET /api/floor-plan/{tenantId}
PUT /api/floor-plan/{tenantId}

GET /api/staff/{tenantId}
PUT /api/staff/{tenantId}
```

### From Menu Sync Worker

**Base URL:** `https://filesearch-sync.suyesh.workers.dev`

```bash
# Check sync status
GET /status/{tenantId}

# Manual sync triggers
POST /sync/{tenantId}               # File Search only
POST /sync/d1-to-kv/{tenantId}     # D1 → KV only
POST /sync/full/{tenantId}          # Complete sync

# Auto-sync webhook
POST /webhook/menu-updated

# Batch operations
POST /status/batch
```

---

## POS Integration Steps

### Step 1: Menu Updates Flow

When POS saves menu changes to local SQLite:

```javascript
// 1. Save to local SQLite (source of truth)
await saveToLocalSQLite(menuItem);

// 2. Sync to D1 via tenant worker
await fetch(`https://handsfree-orders.suyesh.workers.dev/api/menu/${tenantId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(menuItem)
});

// 3. Trigger menu sync webhook (non-blocking)
fetch('https://filesearch-sync.suyesh.workers.dev/webhook/menu-updated', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'coorg-food-company-6163',
    trigger: 'pos_menu_update',
    itemsChanged: 1
  })
}).catch(err => console.error('Sync webhook failed:', err));
```

**What Happens:**
1. Local SQLite updated immediately (fast)
2. D1 updated via tenant worker (medium)
3. Webhook triggers background sync:
   - D1 → KV (fast)
   - D1 → File Search (slow, non-blocking)

---

### Step 2: Display Sync Status in POS

Add sync status indicator to POS UI:

```javascript
// services/menuSyncStatus.ts
export async function checkMenuSyncStatus(tenantId: string) {
  try {
    const response = await fetch(
      `https://filesearch-sync.suyesh.workers.dev/status/${tenantId}`
    );

    const { status } = await response.json();

    return {
      inSync: status.inSync,
      lastSyncTime: status.lastSyncTime,
      d1ItemCount: status.d1ItemCount,
      fileSearchItemCount: status.fileSearchItemCount,
      errors: status.errors,
      needsSync: status.needsSync
    };
  } catch (error) {
    console.error('Failed to check sync status:', error);
    return {
      inSync: false,
      lastSyncTime: null,
      d1ItemCount: 0,
      fileSearchItemCount: null,
      errors: ['Failed to contact sync service'],
      needsSync: true
    };
  }
}

// Usage in component
useEffect(() => {
  const checkStatus = async () => {
    const status = await checkMenuSyncStatus(tenantId);
    setSyncStatus(status);
  };

  checkStatus();
  const interval = setInterval(checkStatus, 30000); // Check every 30s

  return () => clearInterval(interval);
}, [tenantId]);
```

---

### Step 3: Manual Sync Button

Add "Sync Now" button for manual synchronization:

```javascript
// components/MenuSyncButton.tsx
async function handleManualSync() {
  setLoading(true);

  try {
    const response = await fetch(
      `https://filesearch-sync.suyesh.workers.dev/sync/full/${tenantId}`,
      { method: 'POST' }
    );

    const result = await response.json();

    if (result.success) {
      toast.success('Menu synced successfully!');

      // Refresh status
      await checkMenuSyncStatus(tenantId);
    } else {
      toast.error(`Sync failed: ${result.error}`);
    }
  } catch (error) {
    toast.error(`Sync failed: ${error.message}`);
  } finally {
    setLoading(false);
  }
}
```

---

### Step 4: Rust/Tauri Integration

Add commands to Tauri app for sync operations:

```rust
// src-tauri/src/commands/menu_sync.rs

use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncStatus {
    pub in_sync: bool,
    pub last_sync_time: Option<String>,
    pub d1_item_count: i32,
    pub file_search_item_count: Option<i32>,
    pub errors: Vec<String>,
    pub needs_sync: bool,
}

#[command]
pub async fn check_menu_sync_status(tenant_id: String) -> Result<SyncStatus, String> {
    let url = format!(
        "https://filesearch-sync.suyesh.workers.dev/status/{}",
        tenant_id
    );

    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = response.json()
        .await
        .map_err(|e| e.to_string())?;

    let status = data["status"].as_object()
        .ok_or("Invalid response format")?;

    Ok(SyncStatus {
        in_sync: status["inSync"].as_bool().unwrap_or(false),
        last_sync_time: status["lastSyncTime"].as_str().map(|s| s.to_string()),
        d1_item_count: status["d1ItemCount"].as_i64().unwrap_or(0) as i32,
        file_search_item_count: status["fileSearchItemCount"]
            .as_i64()
            .map(|n| n as i32),
        errors: status["errors"]
            .as_array()
            .map(|arr| arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect())
            .unwrap_or_default(),
        needs_sync: status["needsSync"].as_bool().unwrap_or(true),
    })
}

#[command]
pub async fn trigger_full_menu_sync(tenant_id: String) -> Result<String, String> {
    let url = format!(
        "https://filesearch-sync.suyesh.workers.dev/sync/full/{}",
        tenant_id
    );

    let client = reqwest::Client::new();
    let response = client.post(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = response.json()
        .await
        .map_err(|e| e.to_string())?;

    if data["success"].as_bool().unwrap_or(false) {
        Ok(data["message"].as_str().unwrap_or("Sync completed").to_string())
    } else {
        Err(data["error"].as_str().unwrap_or("Unknown error").to_string())
    }
}

#[command]
pub async fn trigger_menu_sync_webhook(
    tenant_id: String,
    items_changed: i32
) -> Result<(), String> {
    let url = "https://filesearch-sync.suyesh.workers.dev/webhook/menu-updated";

    let payload = serde_json::json!({
        "tenantId": tenant_id,
        "trigger": "pos_menu_update",
        "itemsChanged": items_changed
    });

    let client = reqwest::Client::new();
    client.post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

Register commands in `main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            check_menu_sync_status,
            trigger_full_menu_sync,
            trigger_menu_sync_webhook,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Integration with Existing POS Services

### Update TieredSyncManager

Add menu sync webhook to your existing sync manager:

```typescript
// services/TieredSyncManager.ts

import { triggerMenuSyncWebhook } from './menuSyncService';

class TieredSyncManager {
  // ... existing code

  async syncMenu() {
    // Existing sync to D1
    await this.d1SyncService.syncMenuItems();

    // NEW: Trigger File Search sync webhook
    await triggerMenuSyncWebhook(this.tenantId, changeCount);
  }
}
```

### Update CloudSyncSettings Component

Add menu sync status to your Cloud Sync Settings:

```tsx
// components/CloudSyncSettings.tsx

import { checkMenuSyncStatus } from '@/services/menuSyncService';

export function CloudSyncSettings() {
  const [menuSyncStatus, setMenuSyncStatus] = useState(null);

  useEffect(() => {
    async function checkStatus() {
      if (cloudSyncEnabled) {
        const status = await checkMenuSyncStatus(tenantId);
        setMenuSyncStatus(status);
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [cloudSyncEnabled, tenantId]);

  return (
    <div>
      {/* Existing D1 sync status */}

      {/* NEW: Menu sync status */}
      <div className="menu-sync-status">
        <h3>Menu Synchronization</h3>
        {menuSyncStatus?.inSync ? (
          <div className="status-synced">
            ✅ Menu synced • Last: {new Date(menuSyncStatus.lastSyncTime).toLocaleString()}
          </div>
        ) : (
          <div className="status-out-of-sync">
            ⚠️ Menu out of sync • {menuSyncStatus?.errors[0]}
            <button onClick={handleManualSync}>Sync Now</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Testing the Integration

### 1. Test Sync Status Endpoint

```bash
curl https://filesearch-sync.suyesh.workers.dev/status/coorg-food-company-6163
```

**Expected Response:**
```json
{
  "success": true,
  "status": {
    "inSync": false,
    "lastSyncTime": null,
    "d1ItemCount": 45,
    "fileSearchItemCount": null,
    "errors": ["Never synced - initial sync required"],
    "needsSync": true,
    "tenantId": "coorg-food-company-6163"
  }
}
```

### 2. Test Full Sync

```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/sync/full/coorg-food-company-6163
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Full sync completed successfully",
  "results": {
    "d1ToKv": { "success": true, "error": null },
    "fileSearch": { "success": true, "error": null }
  }
}
```

### 3. Test Webhook

```bash
curl -X POST https://filesearch-sync.suyesh.workers.dev/webhook/menu-updated \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "coorg-food-company-6163",
    "trigger": "pos_menu_update",
    "itemsChanged": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Menu sync triggered",
  "tenantId": "coorg-food-company-6163",
  "trigger": "pos_menu_update"
}
```

---

## Error Handling

### Network Errors

```javascript
try {
  await fetch('https://filesearch-sync.suyesh.workers.dev/...');
} catch (error) {
  if (error.message.includes('fetch')) {
    // Network error - sync worker unreachable
    console.error('Sync service unreachable:', error);
    // Continue with local operations
  }
}
```

### Sync Failures

```javascript
const result = await triggerFullSync(tenantId);

if (!result.success) {
  if (result.results.d1ToKv.success && !result.results.fileSearch.success) {
    // D1→KV succeeded, File Search failed
    // Voice ordering won't work but POS operations continue
    showWarning('Voice ordering sync failed. POS operations are not affected.');
  }
}
```

---

## Monitoring and Debugging

### View Sync Logs

```bash
# Monitor menu sync worker
wrangler tail --name filesearch-sync

# Filter for specific tenant
wrangler tail --name filesearch-sync --search "coorg-food-company-6163"

# Monitor orders worker
wrangler tail --name handsfree-orders
```

### Debug Checklist

1. **Sync Status Endpoint Not Responding**
   - Check worker is deployed: `wrangler list`
   - Verify URL is correct
   - Check CORS configuration

2. **Item Count Mismatch**
   - Trigger full sync: `POST /sync/full/{tenantId}`
   - Wait 30 seconds
   - Recheck status

3. **D1 Data Not Updating**
   - Check tenant worker is deployed
   - Verify dispatch namespace binding
   - Check D1 database exists

4. **File Search Not Updating**
   - Check backend API is running
   - Verify BACKEND_URL environment variable
   - Check Google Cloud quotas

---

## Summary

**POS → Menu Sync Integration:**

1. **POS saves menu changes** → Local SQLite (immediate)
2. **POS syncs to D1** → Via tenant worker (fast)
3. **POS triggers webhook** → Menu sync worker (non-blocking)
4. **Webhook executes sync** → D1 → KV → File Search (background)
5. **POS displays status** → Sync status API (real-time monitoring)

**URLs to Use:**

- **Menu Sync Worker:** `https://filesearch-sync.suyesh.workers.dev`
- **Orders Worker:** `https://handsfree-orders.suyesh.workers.dev`
- **Backend API:** `https://stonepot-restaurant-334610188311.us-central1.run.app`

All CORS properly configured for POS access from any origin.
