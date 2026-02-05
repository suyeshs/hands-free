# Async Provisioning Design

## Problem

Current onboarding takes **2.5 minutes** because we wait for full infrastructure provisioning before completing. This creates a poor UX - users stare at a loading screen for 150 seconds.

## Solution

**Async Provisioning**: Return activation code early, continue D1 setup in background.

### Current Flow (Synchronous - 150s)

```
User submits form
    ↓
[Wait 150 seconds for full provisioning]
    ↓ (Create tenant metadata)
    ↓ (Create D1 database - 30-60s)
    ↓ (Apply 45-table schema - 30-60s)
    ↓ (Create KV namespaces - 10-20s)
    ↓ (Create R2 bucket - 10-20s)
    ↓ (Generate activation code)
    ↓
Return activation code
    ↓
Complete onboarding
    ↓
Redirect to Hub
```

**Total time to Hub**: 150 seconds ⏱️

### New Flow (Async - 15s to Hub)

```
User submits form
    ↓
[Quick sync operations - 10-15s]
    ↓ (Create tenant metadata - 5s)
    ↓ (Generate activation code - 1s)
    ↓ (Create KV namespaces - 10s)
    ↓
Return activation code ✅
    ↓
Complete onboarding (15s total)
    ↓
Redirect to Hub
    ↓
[Background async operations - continues in worker]
    ↓ (Create D1 database - 30-60s)
    ↓ (Apply 45-table schema - 30-60s)
    ↓ (Create R2 bucket - 10-20s)
    ↓
Mark provisioning complete
```

**Total time to Hub**: 15 seconds ⚡ (10x faster!)

**Time to full provisioning**: 150 seconds (background)

## Implementation

### 1. Backend Changes (Provisioning Worker)

**Current endpoint**: `/api/provision` (synchronous)

**New endpoint**: `/api/provision-async` (returns early)

```typescript
// POST /api/provision-async
{
  "tenantId": "restaurant-123",
  "companyName": "My Restaurant",
  ...
}

// Response (returned in 10-15s):
{
  "success": true,
  "activationCode": "ABCD-1234-EFGH-5678",
  "tenant": {
    "tenantId": "restaurant-123",
    "subdomain": "restaurant-123",
    "kv_namespace_id": "abc123...",
    "provisioning": {
      "status": "in_progress",  // ← Key difference
      "completed": false,
      "d1Ready": false,
      "r2Ready": false,
      "estimatedCompletion": "2026-01-24T16:50:00Z"
    }
  }
}

// Background worker continues:
// - Create D1 database
// - Apply schema
// - Create R2 bucket
// - Update KV: provisioning:status:{tenantId} = "complete"
```

**Provisioning Status in KV:**

```typescript
// Key: provisioning:status:{tenantId}
{
  "status": "in_progress" | "complete" | "failed",
  "startedAt": "2026-01-24T16:47:00Z",
  "completedAt": null,
  "progress": {
    "metadata": true,
    "kvNamespaces": true,
    "d1Database": false,  // ← Still provisioning
    "d1Schema": false,
    "r2Bucket": false
  },
  "resourceIds": {
    "d1DatabaseId": null,  // Will be populated when ready
    "r2BucketName": null
  }
}
```

### 2. Frontend Changes

#### StoreCreationModal (Quick Steps)

**Before (5 steps - 150s):**
```
✓ Validate
⚙️ Provision infrastructure (150s)
  Deploy worker
  Generate activation
  Finalize
```

**After (3 steps - 15s):**
```
✓ Validate information
⚙️ Create tenant account (10s)
✓ Generate activation code
```

#### New D1 Status Service

**File**: `src/services/d1ProvisioningStatus.ts`

```typescript
export interface D1ProvisioningStatus {
  status: 'in_progress' | 'complete' | 'failed';
  progress: {
    metadata: boolean;
    kvNamespaces: boolean;
    d1Database: boolean;
    d1Schema: boolean;
    r2Bucket: boolean;
  };
  estimatedTimeRemaining?: number; // seconds
}

export async function checkD1Status(tenantId: string): Promise<D1ProvisioningStatus> {
  const response = await fetch(
    `${import.meta.env.VITE_PROVISIONING_URL}/api/provisioning-status/${tenantId}`
  );
  return response.json();
}

export function startPolling(
  tenantId: string,
  onUpdate: (status: D1ProvisioningStatus) => void,
  onComplete: () => void
) {
  const interval = setInterval(async () => {
    const status = await checkD1Status(tenantId);
    onUpdate(status);

    if (status.status === 'complete') {
      clearInterval(interval);
      onComplete();
    }
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(interval);
}
```

#### Hub Page D1 Status Card

**File**: `src/components/home/D1StatusCard.tsx` (already exists, enhance it)

```tsx
export function D1StatusCard() {
  const [status, setStatus] = useState<D1ProvisioningStatus | null>(null);
  const { tenant } = useTenantStore();

  useEffect(() => {
    if (!tenant?.tenantId) return;

    const stopPolling = startPolling(
      tenant.tenantId,
      (newStatus) => setStatus(newStatus),
      () => {
        // D1 is ready!
        toast.success('Database is ready! All features unlocked.');
      }
    );

    return stopPolling;
  }, [tenant?.tenantId]);

  if (!status || status.status === 'complete') return null;

  return (
    <Card className="border-blue-500 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          Setting Up Your Database
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-blue-700 mb-4">
          Your restaurant is ready to use! We're still setting up the full database in the background.
        </p>

        <div className="space-y-2">
          <ProgressItem
            label="Tenant Account"
            completed={status.progress.metadata}
          />
          <ProgressItem
            label="Cache & Sessions"
            completed={status.progress.kvNamespaces}
          />
          <ProgressItem
            label="Database"
            completed={status.progress.d1Database}
            inProgress={!status.progress.d1Database}
          />
          <ProgressItem
            label="Schema (45 tables)"
            completed={status.progress.d1Schema}
          />
          <ProgressItem
            label="File Storage"
            completed={status.progress.r2Bucket}
          />
        </div>

        {status.estimatedTimeRemaining && (
          <p className="text-xs text-blue-600 mt-4">
            Estimated time remaining: {Math.ceil(status.estimatedTimeRemaining / 60)} minutes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### 3. User Experience

#### Onboarding Flow

**Before**:
```
User fills form
    ↓
[Stares at loading screen for 2.5 minutes]
    ↓
"Restaurant Created!"
    ↓
Hub page
```

**After**:
```
User fills form
    ↓
[Quick 15-second setup]
    ↓
"Restaurant Created!"
    ↓
Hub page with blue card: "Setting Up Your Database"
    ↓
[User can explore app, add staff, configure settings]
    ↓
[2 minutes later] ✅ "Database is ready! All features unlocked."
```

#### What Works Immediately vs. After D1

**Immediately Available (after 15s):**
- ✅ View Hub page
- ✅ Configure restaurant settings
- ✅ Add staff members
- ✅ View activation code
- ✅ Basic navigation

**Available After D1 Completes (~2 min):**
- ✅ Menu management
- ✅ Inventory tracking
- ✅ Orders and POS
- ✅ Reports and analytics
- ✅ Floor plan management

This is progressive enhancement - core setup works immediately, full features unlock when ready.

## Migration Strategy

### Phase 1: Add Async Endpoint (Backend)

1. Keep existing `/api/provision` (synchronous)
2. Add new `/api/provision-async` (async)
3. Add `/api/provisioning-status/:tenantId` (status check)

### Phase 2: Update Frontend (A/B Test)

1. Add feature flag: `VITE_ASYNC_PROVISIONING=true`
2. If enabled, use async flow
3. If disabled, use old sync flow
4. Test both flows in parallel

### Phase 3: Full Migration

1. Make async default
2. Remove sync endpoint
3. Update all documentation

## Benefits

### User Experience
- **15x faster onboarding**: 150s → 15s to Hub
- **Better perceived performance**: Users in app immediately
- **Progressive enhancement**: Explore while provisioning continues
- **No more blank screens**: Active feedback with progress

### Technical
- **Reduced server load**: Quick responses, background processing
- **Better error handling**: Failures don't block onboarding
- **Retry logic**: Can retry D1 setup without re-creating tenant
- **Monitoring**: Track provisioning success rate separately

### Business
- **Lower drop-off**: Users less likely to leave during long wait
- **Faster activation**: Get users into app ASAP
- **Better first impression**: Snappy, responsive onboarding

## Rollback Plan

If async provisioning has issues:

1. Set `VITE_ASYNC_PROVISIONING=false`
2. App falls back to sync flow
3. Users wait 2.5 minutes (old behavior)
4. Fix async issues, re-enable

## Testing Checklist

- [ ] Async endpoint returns activation code in <15s
- [ ] Background provisioning completes successfully
- [ ] D1StatusCard polls and updates correctly
- [ ] Toast notification shows when D1 is ready
- [ ] Features are disabled/enabled based on D1 status
- [ ] Error handling for provisioning failures
- [ ] Retry logic for failed background tasks
- [ ] Fallback to sync flow works

## Performance Targets

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time to Hub | 150s | 15s | **10x faster** |
| Time to activation | 150s | 15s | **10x faster** |
| Time to full features | 150s | 150s | Same (background) |
| User perceived wait | 150s | 15s + background | **Much better UX** |

---

**Status**: Design Complete
**Next**: Implement backend async endpoint
**ETA**: 2-3 hours implementation
**Risk**: Low (can fallback to sync flow)
