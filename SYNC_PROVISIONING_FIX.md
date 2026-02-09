# Sync Service Provisioning Guard

## Problem

The sync service was being activated even when the tenant-worker was not provisioned, leading to failed WebSocket connections and unnecessary error logs.

## Solution

Added a provisioning check in [WebSocketManager.tsx:151-170](src/components/WebSocketManager.tsx#L151-L170) before initializing the sync service.

### Changes Made

**File**: `src/components/WebSocketManager.tsx`

Added a new guard that checks if the tenant-worker (D1 database) is provisioned before initializing the sync service:

```typescript
// GUARD: Check if tenant-worker is provisioned before initializing sync
try {
  console.log('[WebSocketManager] Checking tenant-worker provisioning status...');
  const { getD1ProvisioningService } = await import('../services/d1ProvisioningService');
  const provisioningService = getD1ProvisioningService();
  const d1Status = await provisioningService.checkStatus(effectiveTenantId);

  if (!d1Status.provisioned) {
    console.log('[WebSocketManager] Tenant-worker not provisioned, skipping sync initialization');
    console.log('[WebSocketManager] Sync service will activate once tenant-worker is provisioned');
    return;
  }

  console.log('[WebSocketManager] Tenant-worker is provisioned, proceeding with sync initialization');
} catch (err) {
  console.error('[WebSocketManager] Failed to check provisioning status:', err);
  console.log('[WebSocketManager] Assuming not provisioned, skipping sync initialization');
  return;
}
```

## Sync Activation Flow

The sync service now requires ALL of these conditions to be met:

1. ✅ Tenant ID exists
2. ✅ Setup is complete
3. ✅ Online features are enabled (`posSettings.activateOnline`)
4. ✅ Not in training mode
5. ✅ Not already initialized for this tenant
6. ✅ **NEW: Tenant-worker is provisioned** ⭐

## How to Provision Tenant-Worker

If you need to provision the tenant-worker for a tenant:

### Option 1: Via UI (Recommended)

1. Navigate to **Admin > Cloud Sync Settings**
2. Click the **"Provision D1 Database"** button
3. Wait for provisioning to complete
4. Restart the app or refresh the page

### Option 2: Programmatically

```typescript
import { getD1ProvisioningService } from './services/d1ProvisioningService';
import { getDatabaseFilePath } from './lib/database';

const tenantId = 'your-tenant-id';
const dbPath = await getDatabaseFilePath();
const provisioningService = getD1ProvisioningService();

const result = await provisioningService.provisionD1(
  tenantId,
  dbPath,
  (progress) => {
    console.log(`${progress.step}: ${progress.message} (${progress.progress}%)`);
  }
);

if (result.success) {
  console.log('Tenant-worker provisioned successfully!');
  // Sync service will automatically activate on next initialization
}
```

## Console Log Changes

### Before Fix

```
[WebSocketManager] Stores loaded, now initializing sync service
[OrderSyncService] Initializing for tenant: abc123
[OrderSyncService] Connecting to cloud WebSocket: wss://...
[OrderSyncService] Cloud WebSocket connected
[OrderSyncService] Cloud message: "sync_state"
```

### After Fix (Not Provisioned)

```
[WebSocketManager] Checking tenant-worker provisioning status...
[WebSocketManager] Tenant-worker not provisioned, skipping sync initialization
[WebSocketManager] Sync service will activate once tenant-worker is provisioned
```

### After Fix (Provisioned)

```
[WebSocketManager] Checking tenant-worker provisioning status...
[WebSocketManager] Tenant-worker is provisioned, proceeding with sync initialization
[WebSocketManager] Pre-loading staff and floor plan from database...
[WebSocketManager] Stores loaded, now initializing sync service
[OrderSyncService] Initializing for tenant: abc123
[OrderSyncService] Connecting to cloud WebSocket: wss://...
```

## Benefits

1. **Prevents unnecessary WebSocket connections** when tenant-worker is not ready
2. **Cleaner console logs** with clear messaging about provisioning status
3. **Better error handling** with explicit checks instead of failing silently
4. **Automatic activation** once tenant-worker is provisioned (no code changes needed)

## Related Files

- [src/components/WebSocketManager.tsx](src/components/WebSocketManager.tsx) - Sync service initialization
- [src/services/d1ProvisioningService.ts](src/services/d1ProvisioningService.ts) - Provisioning service
- [src/lib/orderSyncService.ts](src/lib/orderSyncService.ts) - Sync service implementation

## Testing

To test the fix:

1. **Unprovisioned tenant**: Start app with a tenant that has no worker provisioned
   - Expected: Sync service should NOT activate
   - Console: Should show "Tenant-worker not provisioned" message

2. **Provisioned tenant**: Provision the tenant-worker
   - Expected: Sync service should activate automatically
   - Console: Should show "Tenant-worker is provisioned" message

3. **Provisioning during runtime**: Provision tenant while app is running
   - Expected: Sync service remains inactive (requires restart/refresh)
   - Note: Effect dependencies need to be triggered for re-check
