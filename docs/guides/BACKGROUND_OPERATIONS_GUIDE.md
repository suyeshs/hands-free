# Background Operations Coordination Guide

## Overview

The Background Operations Coordinator prevents database locking issues by pausing all background operations during critical database operations (like menu uploads). This ensures exclusive database access when needed.

## Architecture

```
┌─────────────────────────────────────┐
│  Critical Operation (Menu Upload)   │
│  executeCriticalOperation()         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  BackgroundOperationsCoordinator    │
│  - Pause all registered operations  │
│  - Wait for completion              │
│  - Resume after operation           │
└──────────────┬──────────────────────┘
               │
      ┌────────┴─────────┬──────────┬────────┐
      ▼                  ▼          ▼        ▼
┌──────────┐   ┌──────────────┐  ┌────┐  ┌──────┐
│D1 Sync   │   │Order Polling │  │WS  │  │Other │
│Service   │   │Service       │  │Mgr │  │Svcs  │
└──────────┘   └──────────────┘  └────┘  └──────┘
```

## How It Works

### 1. Critical Operation Execution

```typescript
import { executeCriticalOperation } from './services/backgroundOperationsCoordinator';

// Automatically pauses ALL background operations
await executeCriticalOperation(async () => {
  // Your critical database operation
  await performDatabaseMigration();
}, 'Database Migration');
```

### 2. Operation Registration

Each background service must register itself with the coordinator:

```typescript
import { backgroundCoordinator } from './services/backgroundOperationsCoordinator';

backgroundCoordinator.register('my-sync-service', {
  name: 'My Sync Service',
  pause: () => {
    // Stop sync operations
    clearInterval(syncInterval);
  },
  resume: () => {
    // Restart sync operations
    startSync();
  }
});
```

## Service Registration Examples

### Example 1: Interval-Based Sync Service

```typescript
// src/services/sync/MyIntervalService.ts
import { registerIntervalOperation } from '../backgroundOperationsRegistry';

class MyIntervalService {
  private cleanup: (() => void) | null = null;

  start() {
    this.cleanup = registerIntervalOperation(
      'my-interval-service',
      'My Interval Service',
      async () => {
        // Your sync logic
        await this.syncData();
      },
      30000 // 30 seconds
    );
  }

  stop() {
    this.cleanup?.();
  }

  private async syncData() {
    console.log('Syncing data...');
    // Your sync implementation
  }
}

export const myIntervalService = new MyIntervalService();
```

### Example 2: D1 Sync Service

```typescript
// src/services/sync/D1SyncService.ts
import { backgroundCoordinator } from '../backgroundOperationsCoordinator';

export class D1SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    // Register with coordinator
    backgroundCoordinator.register('d1-sync-service', {
      name: 'D1 Sync Service',
      pause: () => this.pause(),
      resume: () => this.resume()
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.syncInterval = setInterval(() => this.sync(), 60000); // 1 minute
  }

  private pause() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('[D1SyncService] Paused');
  }

  private resume() {
    if (this.isRunning && !this.syncInterval) {
      this.syncInterval = setInterval(() => this.sync(), 60000);
      console.log('[D1SyncService] Resumed');
    }
  }

  private async sync() {
    console.log('[D1SyncService] Syncing...');
    // Your sync logic
  }
}
```

### Example 3: WebSocket Manager

```typescript
// src/components/WebSocketManager.tsx
import { useEffect } from 'react';
import { backgroundCoordinator } from '../services/backgroundOperationsCoordinator';

export function WebSocketManager() {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket('wss://api.example.com');
      // Setup handlers...
    };

    // Register with coordinator
    backgroundCoordinator.register('websocket-manager', {
      name: 'WebSocket Manager',
      pause: () => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.close();
          console.log('[WebSocketManager] Closed');
        }
      },
      resume: () => {
        connect();
        console.log('[WebSocketManager] Reconnecting');
      }
    });

    connect();

    return () => {
      backgroundCoordinator.unregister('websocket-manager');
      ws.current?.close();
    };
  }, []);

  return null;
}
```

### Example 4: Order Polling Service

```typescript
// src/lib/orderPollingService.ts
import { backgroundCoordinator } from '../services/backgroundOperationsCoordinator';

class OrderPollingService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;

  constructor() {
    backgroundCoordinator.register('order-polling', {
      name: 'Order Polling Service',
      pause: () => this.stopPolling(),
      resume: () => this.startPolling()
    });
  }

  enable() {
    this.isEnabled = true;
    this.startPolling();
  }

  disable() {
    this.isEnabled = false;
    this.stopPolling();
  }

  private startPolling() {
    if (this.isEnabled && !this.pollingInterval) {
      this.pollingInterval = setInterval(() => this.pollOrders(), 5000);
      console.log('[OrderPolling] Started');
    }
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[OrderPolling] Stopped');
    }
  }

  private async pollOrders() {
    // Polling logic
  }
}

export const orderPollingService = new OrderPollingService();
```

## Services That Should Be Registered

Based on your codebase, here are the key services that should register:

### High Priority (Database Write Operations)
1. ✅ **Menu Upload Session** - Already integrated
2. 🔄 **D1 Sync Service** - Syncs to Cloudflare D1
3. 🔄 **Order Sync Service** - Syncs orders
4. 🔄 **Tiered Sync Manager** - Multi-tier sync
5. 🔄 **Sales Sync Service** - Syncs sales data
6. 🔄 **Aggregator Sync Service** - Syncs aggregator data

### Medium Priority (Read Operations but Frequent)
7. 🔄 **Order Polling Service** - Polls for new orders
8. 🔄 **WebSocket Manager** - Real-time updates
9. 🔄 **Multi-Location Sync** - Chain sync
10. 🔄 **LAN Sync Service** - Local network sync

### Lower Priority (Infrequent Operations)
11. 🔄 **Attendance Auto Service** - Auto clock-in/out
12. 🔄 **Plugin Update Checker** - Checks for updates
13. 🔄 **Camera Detection Service** - ReCamera discovery

## Integration Steps

### Step 1: Register Each Service

For each background service, add registration in its initialization:

```typescript
import { backgroundCoordinator } from './services/backgroundOperationsCoordinator';

// In service constructor or initialization
backgroundCoordinator.register(uniqueId, {
  name: 'Service Name',
  pause: pauseFunction,
  resume: resumeFunction
});
```

### Step 2: Implement Pause/Resume Logic

Each service needs proper pause and resume implementations:

```typescript
pause() {
  // Stop intervals
  if (this.interval) clearInterval(this.interval);

  // Close connections
  this.connection?.close();

  // Set flags
  this.isPaused = true;
}

resume() {
  // Restart intervals
  this.interval = setInterval(...);

  // Reconnect
  this.reconnect();

  // Clear flags
  this.isPaused = false;
}
```

### Step 3: Test the Integration

```typescript
import { backgroundCoordinator } from './services/backgroundOperationsCoordinator';

// Check status
console.log(backgroundCoordinator.getStatus());
// { isPaused: false, pauseCount: 0, operationsCount: 5 }

// List registered operations
console.log(backgroundCoordinator.listOperations());
// [
//   { id: 'd1-sync', name: 'D1 Sync Service' },
//   { id: 'order-polling', name: 'Order Polling' },
//   ...
// ]

// Manual test
await backgroundCoordinator.pauseAll();
// All operations should pause
await backgroundCoordinator.resumeAll();
// All operations should resume
```

## Usage in Critical Operations

### Menu Upload (Already Implemented)

```typescript
// src/lib/database.ts
export async function commitUploadSession(sessionId: string): Promise<void> {
  await executeCriticalOperation(async () => {
    await retryDatabaseOperation(async () => {
      // Database operations...
    });
  }, 'Menu Upload Commit');
}
```

### Other Critical Operations

```typescript
// Database migration
export async function runMigration() {
  await executeCriticalOperation(async () => {
    // Run migration
  }, 'Database Migration');
}

// Bulk data import
export async function importData(data: any[]) {
  await executeCriticalOperation(async () => {
    // Import data
  }, 'Bulk Data Import');
}

// Database reset
export async function resetDatabase() {
  await executeCriticalOperation(async () => {
    // Reset operations
  }, 'Database Reset');
}
```

## Benefits

1. **No More Database Locks** - Exclusive access during critical operations
2. **Automatic Coordination** - No manual service management
3. **Graceful Degradation** - Services resume automatically
4. **Reference Counting** - Supports nested critical operations
5. **Easy Testing** - Can manually pause/resume for debugging
6. **Visibility** - Status and logging for monitoring

## Monitoring

Add to your diagnostics page:

```typescript
import { backgroundCoordinator } from './services/backgroundOperationsCoordinator';

function DiagnosticsPanel() {
  const status = backgroundCoordinator.getStatus();
  const operations = backgroundCoordinator.listOperations();

  return (
    <div>
      <h3>Background Operations</h3>
      <p>Status: {status.isPaused ? 'Paused' : 'Running'}</p>
      <p>Registered: {status.operationsCount}</p>
      <ul>
        {operations.map(op => (
          <li key={op.id}>{op.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Next Steps

1. **Review Services**: Identify all background operations in your codebase
2. **Add Registrations**: Add coordinator registration to each service
3. **Test**: Test menu upload with services running
4. **Monitor**: Check logs during critical operations
5. **Optimize**: Adjust pause/resume logic as needed

## Troubleshooting

### Service Not Pausing
- Check if service is registered: `backgroundCoordinator.listOperations()`
- Verify pause function is called: Add console.log
- Check if service recreates intervals after pause

### Service Not Resuming
- Verify resume function logic
- Check if service state is preserved during pause
- Ensure no errors in resume callback

### Still Getting Locks
- Confirm all write operations are registered
- Check for direct database access bypassing services
- Increase busy_timeout if needed
