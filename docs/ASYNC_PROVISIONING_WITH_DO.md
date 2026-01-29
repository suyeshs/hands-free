# Async Provisioning with Durable Objects

## Architecture: Real-Time Provisioning Updates

Instead of polling, use **Cloudflare Durable Objects** with **WebSocket** for real-time provisioning status updates.

## Flow Overview

```
User submits form
    ↓
POST /api/provision-async
    ↓
[Quick sync - 10-15s]
  • Create tenant metadata
  • Create KV namespaces
  • Generate activation code
  • Initialize Durable Object for provisioning
    ↓
Return activation code + WebSocket URL
    ↓
Frontend completes onboarding (15s)
    ↓
Redirect to Hub
    ↓
Hub connects to WebSocket
    ↓
[Background - Durable Object manages provisioning]
  • Create D1 database → Send WS update: "d1_creating"
  • Apply schema → Send WS update: "schema_applying" (with progress %)
  • Create R2 bucket → Send WS update: "r2_creating"
  • Complete → Send WS update: "complete"
    ↓
Frontend receives real-time updates
    ↓
Show toast: "Database ready! All features unlocked."
```

## Backend: Durable Object Implementation

### Durable Object: ProvisioningCoordinator

**File**: `platform/workers/domain-service/src/durable-objects/ProvisioningCoordinator.ts`

```typescript
/**
 * ProvisioningCoordinator Durable Object
 * Manages async provisioning and broadcasts real-time updates via WebSocket
 */

export interface ProvisioningStatus {
  tenantId: string;
  status: 'initializing' | 'in_progress' | 'complete' | 'failed';
  progress: {
    metadata: boolean;          // Tenant metadata created
    kvNamespaces: boolean;       // KV namespaces created
    d1Database: boolean;         // D1 database created
    d1Schema: boolean;           // Schema applied (45 tables)
    r2Bucket: boolean;           // R2 bucket created
  };
  currentStep: string;           // Human-readable current step
  progressPercent: number;       // 0-100
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export class ProvisioningCoordinator implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Set<WebSocket> = new Set();
  private status: ProvisioningStatus;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Load status from durable storage (survives restarts)
    this.state.blockConcurrencyWhile(async () => {
      this.status = await this.state.storage.get('status') || this.getInitialStatus();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time updates
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.sessions.add(server);

      server.accept();

      // Send current status immediately
      server.send(JSON.stringify({
        type: 'status',
        data: this.status
      }));

      server.addEventListener('close', () => {
        this.sessions.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // HTTP endpoint to start provisioning
    if (url.pathname === '/start' && request.method === 'POST') {
      const { tenantId, requestData } = await request.json();

      this.status = {
        tenantId,
        status: 'initializing',
        progress: {
          metadata: true,      // Already created before DO
          kvNamespaces: true,  // Already created before DO
          d1Database: false,
          d1Schema: false,
          r2Bucket: false,
        },
        currentStep: 'Starting background provisioning',
        progressPercent: 40, // Metadata + KV done (40%)
        startedAt: new Date().toISOString(),
      };

      await this.saveStatus();
      this.broadcast({ type: 'status', data: this.status });

      // Start async provisioning (non-blocking)
      this.env.ctx.waitUntil(this.runProvisioning(tenantId, requestData));

      return new Response(JSON.stringify({ success: true }));
    }

    // HTTP endpoint to get current status (for non-WS clients)
    if (url.pathname === '/status') {
      return new Response(JSON.stringify(this.status));
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Run provisioning steps asynchronously
   */
  private async runProvisioning(tenantId: string, requestData: any) {
    try {
      this.updateStatus('in_progress', 'Creating D1 database', 50);

      // Step 1: Create D1 Database (30-60s)
      const dbId = await this.createD1Database(tenantId);
      this.status.progress.d1Database = true;
      this.updateStatus('in_progress', 'Applying database schema', 60);

      // Step 2: Apply Schema (30-60s with progress updates)
      await this.applySchema(dbId, tenantId);
      this.status.progress.d1Schema = true;
      this.updateStatus('in_progress', 'Creating file storage', 85);

      // Step 3: Create R2 Bucket (10-20s)
      await this.createR2Bucket(tenantId);
      this.status.progress.r2Bucket = true;
      this.updateStatus('complete', 'Provisioning complete', 100);

      this.status.completedAt = new Date().toISOString();
      await this.saveStatus();
      this.broadcast({ type: 'complete', data: this.status });

    } catch (error: any) {
      this.status.status = 'failed';
      this.status.error = error.message;
      await this.saveStatus();
      this.broadcast({ type: 'error', data: { error: error.message } });
    }
  }

  /**
   * Create D1 Database via Cloudflare API
   */
  private async createD1Database(tenantId: string): Promise<string> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${tenantId}_db`
        })
      }
    );

    const data = await response.json();
    return data.result.uuid;
  }

  /**
   * Apply schema to D1 database with progress updates
   */
  private async applySchema(databaseId: string, tenantId: string) {
    // Fetch schema from R2
    const schemaObj = await this.env.R2_BUCKET.get('schemas/d1-complete-migration.sql');
    const schema = await schemaObj!.text();

    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const totalStatements = statements.length;
    let completed = 0;

    // Execute in batches of 10 for progress updates
    const batchSize = 10;
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);

      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: batch.join(';')
          })
        }
      );

      completed += batch.length;
      const schemaProgress = Math.floor((completed / totalStatements) * 100);
      const overallProgress = 60 + Math.floor(schemaProgress * 0.25); // Schema is 60-85%

      this.updateStatus(
        'in_progress',
        `Applying schema (${completed}/${totalStatements} statements)`,
        overallProgress
      );
    }
  }

  /**
   * Create R2 Bucket via Cloudflare API
   */
  private async createR2Bucket(tenantId: string) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${tenantId}-files`
        })
      }
    );
  }

  /**
   * Update status and broadcast to all connected clients
   */
  private updateStatus(
    status: ProvisioningStatus['status'],
    currentStep: string,
    progressPercent: number
  ) {
    this.status.status = status;
    this.status.currentStep = currentStep;
    this.status.progressPercent = progressPercent;

    this.saveStatus();
    this.broadcast({ type: 'progress', data: this.status });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcast(message: any) {
    const payload = JSON.stringify(message);
    this.sessions.forEach(ws => {
      try {
        ws.send(payload);
      } catch (err) {
        // Client disconnected, remove from sessions
        this.sessions.delete(ws);
      }
    });
  }

  /**
   * Save status to Durable Object storage (survives restarts)
   */
  private async saveStatus() {
    await this.state.storage.put('status', this.status);
  }

  private getInitialStatus(): ProvisioningStatus {
    return {
      tenantId: '',
      status: 'initializing',
      progress: {
        metadata: false,
        kvNamespaces: false,
        d1Database: false,
        d1Schema: false,
        r2Bucket: false,
      },
      currentStep: 'Initializing',
      progressPercent: 0,
      startedAt: new Date().toISOString(),
    };
  }
}
```

### Provisioning Endpoint (Updated)

**File**: `platform/workers/domain-service/src/routes/provision.ts`

```typescript
/**
 * POST /api/provision-async
 * Quick provisioning - returns activation code immediately
 * Continues D1 setup in Durable Object
 */
app.post('/api/provision-async', async (c) => {
  const requestData = await c.req.json();
  const { tenantId, companyName, email } = requestData;

  // STEP 1: Quick sync operations (10-15s)

  // Create tenant metadata
  const metadata = {
    tenantId,
    companyName,
    email,
    subdomain: tenantId,
    fullDomain: `${tenantId}.handsfree.tech`,
    createdAt: new Date().toISOString(),
  };

  // Generate activation code
  const activationCode = generateActivationCode();

  // Create KV namespaces (fast - 5-10s)
  const kvData = await createKVNamespace(`${tenantId}-data`);
  const kvCache = await createKVNamespace(`${tenantId}-cache`);
  const kvSessions = await createKVNamespace(`${tenantId}-sessions`);

  // Store basic tenant info in KV
  await c.env.TENANT_METADATA.put(`tenant:${tenantId}`, JSON.stringify({
    ...metadata,
    activationCode,
    kv_namespace_id: kvData.id,
    kvNamespaces: {
      data: kvData.id,
      cache: kvCache.id,
      sessions: kvSessions.id,
    },
    provisioning: {
      status: 'in_progress',
      d1Ready: false,
      r2Ready: false,
    }
  }));

  // STEP 2: Initialize Durable Object for async provisioning

  const doId = c.env.PROVISIONING_DO.idFromName(tenantId);
  const doStub = c.env.PROVISIONING_DO.get(doId);

  // Start async provisioning (non-blocking)
  await doStub.fetch('https://provisioning/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, requestData })
  });

  // STEP 3: Return immediately (15s total)

  return c.json({
    success: true,
    activationCode,
    tenant: {
      tenantId,
      subdomain: tenantId,
      fullDomain: `${tenantId}.handsfree.tech`,
      storeUrl: `https://${tenantId}.handsfree.tech`,
      kv_namespace_id: kvData.id,
      kvNamespaces: {
        data: kvData.id,
        cache: kvCache.id,
        sessions: kvSessions.id,
      },
      // WebSocket URL for real-time provisioning updates
      provisioningWebSocket: `wss://domain-service.suyesh.workers.dev/provisioning/${tenantId}/ws`,
      provisioning: {
        status: 'in_progress',
        d1Ready: false,
        r2Ready: false,
      }
    },
    createdAt: new Date().toISOString()
  }, 201);
});

/**
 * GET /provisioning/:tenantId/ws
 * WebSocket endpoint for real-time provisioning updates
 */
app.get('/provisioning/:tenantId/ws', async (c) => {
  const { tenantId } = c.req.param();

  const doId = c.env.PROVISIONING_DO.idFromName(tenantId);
  const doStub = c.env.PROVISIONING_DO.get(doId);

  // Upgrade to WebSocket, forward to Durable Object
  return doStub.fetch(c.req.raw);
});
```

## Frontend: WebSocket Integration

### Provisioning Status Service

**File**: `src/services/provisioningStatusService.ts`

```typescript
export interface ProvisioningUpdate {
  type: 'status' | 'progress' | 'complete' | 'error';
  data: ProvisioningStatus;
}

export class ProvisioningStatusService {
  private ws: WebSocket | null = null;
  private listeners: Set<(update: ProvisioningUpdate) => void> = new Set();

  /**
   * Connect to provisioning WebSocket for real-time updates
   */
  connect(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      const update: ProvisioningUpdate = JSON.parse(event.data);
      this.listeners.forEach(listener => listener(update));
    };

    this.ws.onerror = (error) => {
      console.error('[Provisioning WS] Error:', error);
    };

    this.ws.onclose = () => {
      console.log('[Provisioning WS] Connection closed');
      // Auto-reconnect after 5s if provisioning not complete
      setTimeout(() => this.connect(wsUrl), 5000);
    };
  }

  /**
   * Subscribe to provisioning updates
   */
  subscribe(callback: (update: ProvisioningUpdate) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const provisioningStatusService = new ProvisioningStatusService();
```

### Updated StoreCreationModal

```typescript
// src/components/StoreCreationModal.tsx

const runStoreCreation = async () => {
  try {
    // Quick validation
    setSteps(prev => prev.map((step, idx) =>
      idx === 0 ? { ...step, status: 'in-progress' } : step
    ));
    await new Promise(resolve => setTimeout(resolve, 300));
    setSteps(prev => prev.map((step, idx) =>
      idx === 0 ? { ...step, status: 'completed' } : step
    ));

    // Quick provisioning (10-15s)
    setSteps(prev => prev.map((step, idx) =>
      idx === 1 ? { ...step, status: 'in-progress', label: 'Creating tenant account' } : step
    ));

    const result = await createStoreFn(); // Returns in 15s!

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to create restaurant');
    }

    setSteps(prev => prev.map((step, idx) =>
      idx === 1 ? { ...step, status: 'completed' } : step
    ));

    // Activation code
    const code = result.activationCode;
    setActivationCode(code);
    setTenantData(result);

    setSteps(prev => prev.map((step, idx) =>
      idx === 2 ? { ...step, status: 'in-progress' } : step
    ));
    await new Promise(resolve => setTimeout(resolve, 500));
    setSteps(prev => prev.map((step, idx) =>
      idx === 2 ? { ...step, status: 'completed' } : step
    ));

    setIsCompleted(true);

    // Store activation code
    localStorage.setItem('pos_activation_code', code);
    localStorage.setItem('is_restaurant_owner', 'true');

    // Store WebSocket URL for Hub page
    localStorage.setItem('provisioning_ws_url', result.tenant.provisioningWebSocket);

    // Auto-advance to Hub (where real-time provisioning continues)
    await new Promise(resolve => setTimeout(resolve, 1000));
    onComplete(code, result);

  } catch (err: any) {
    setError(err.message);
  }
};
```

### Hub Page with Real-Time Updates

**File**: `src/pages-v2/HubPage.tsx`

```typescript
import { provisioningStatusService } from '../services/provisioningStatusService';

export function HubPage() {
  const [provisioningStatus, setProvisioningStatus] = useState<ProvisioningStatus | null>(null);

  useEffect(() => {
    const wsUrl = localStorage.getItem('provisioning_ws_url');
    if (!wsUrl) return;

    // Connect to provisioning WebSocket
    provisioningStatusService.connect(wsUrl);

    const unsubscribe = provisioningStatusService.subscribe((update) => {
      console.log('[Hub] Provisioning update:', update);

      if (update.type === 'progress') {
        setProvisioningStatus(update.data);
      }

      if (update.type === 'complete') {
        setProvisioningStatus(null);
        localStorage.removeItem('provisioning_ws_url');

        // Show success notification
        toast.success('🎉 Database is ready! All features unlocked.');

        // Disconnect WebSocket
        provisioningStatusService.disconnect();
      }
    });

    return () => {
      unsubscribe();
      provisioningStatusService.disconnect();
    };
  }, []);

  return (
    <div>
      {/* Show provisioning card if still provisioning */}
      {provisioningStatus && provisioningStatus.status !== 'complete' && (
        <ProvisioningStatusCard status={provisioningStatus} />
      )}

      {/* Rest of Hub UI */}
      <DashboardGrid />
    </div>
  );
}
```

### Provisioning Status Card (Real-Time)

```tsx
function ProvisioningStatusCard({ status }: { status: ProvisioningStatus }) {
  return (
    <motion.div
      className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-6 mb-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-4">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin flex-shrink-0 mt-1" />

        <div className="flex-1">
          <h3 className="text-lg font-bold text-blue-900 mb-2">
            Setting Up Your Database
          </h3>
          <p className="text-sm text-blue-700 mb-4">
            {status.currentStep}
          </p>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-blue-600 mb-1">
              <span>Progress</span>
              <span>{status.progressPercent}%</span>
            </div>
            <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-600"
                initial={{ width: 0 }}
                animate={{ width: `${status.progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <ChecklistItem completed={status.progress.metadata} label="Tenant Account" />
            <ChecklistItem completed={status.progress.kvNamespaces} label="Cache & Sessions" />
            <ChecklistItem
              completed={status.progress.d1Database}
              inProgress={!status.progress.d1Database && status.progressPercent >= 50}
              label="Database"
            />
            <ChecklistItem
              completed={status.progress.d1Schema}
              inProgress={!status.progress.d1Schema && status.progressPercent >= 60}
              label="Schema (45 tables)"
            />
            <ChecklistItem
              completed={status.progress.r2Bucket}
              inProgress={!status.progress.r2Bucket && status.progressPercent >= 85}
              label="File Storage"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

## Benefits of Durable Objects + WebSocket

### vs. Polling
- ❌ **Polling**: 5s delay per update, 12 requests/minute, wasteful
- ✅ **WebSocket**: Instant updates, 1 connection, efficient

### Real-Time UX
- See progress percentage update live (60% → 65% → 70%)
- See step names change in real-time ("Creating D1" → "Applying schema")
- No refresh needed - updates push automatically

### Reliable
- Durable Object survives worker restarts
- Status persisted in DO storage
- WebSocket auto-reconnects if disconnected

### Scalable
- One DO instance per tenant (isolated)
- Multiple clients can connect to same DO (WebSocket broadcast)
- No database polling overhead

---

**Next**: Implement Durable Object in platform worker
