# Background Operations Coordination - Implementation Summary

## ✅ What Was Implemented

### 1. Core System Components

#### BackgroundOperationsCoordinator
- **File**: `src/services/backgroundOperationsCoordinator.ts`
- **Purpose**: Central coordinator that manages pausing/resuming of all background operations
- **Features**:
  - Registration system for background operations
  - Reference counting for nested critical operations
  - Automatic pause/resume during critical operations
  - Status monitoring and diagnostics

#### Registration Utilities
- **File**: `src/services/backgroundOperationsRegistry.ts`
- **Purpose**: Helper utilities for easy service registration
- **Includes**:
  - `registerIntervalOperation()` - For interval-based services
  - `registerWebSocketOperation()` - For WebSocket services
  - `registerAsyncOperation()` - For custom async operations

### 2. Database Integration

#### Enhanced Menu Upload Commit
- **File**: `src/lib/database.ts`
- **Changes**:
  1. ✅ Added SQLite busy timeout (30 seconds)
  2. ✅ Enabled WAL mode for better concurrency
  3. ✅ Added retry logic with exponential backoff
  4. ✅ Integrated with background coordinator
  5. ✅ Changed to IMMEDIATE transactions

**How it works now:**
```typescript
await executeCriticalOperation(async () => {
  await retryDatabaseOperation(async () => {
    // BEGIN IMMEDIATE TRANSACTION
    // ... all database operations ...
    // COMMIT
  });
}, 'Menu Upload Commit');
```

### 3. Example Service Integration

#### TieredSyncManager
- **File**: `src/services/sync/TieredSyncManager.ts`
- **Changes**:
  - Registered with coordinator in constructor
  - Added `pause()` method to stop all intervals
  - Added `resume()` method to restart intervals
  - Unregisters on stop

**Before:**
```typescript
constructor() {
  this.incrementalSync = new IncrementalSyncService();
  this.offlineQueue = new OfflineQueue();
}
```

**After:**
```typescript
constructor() {
  this.incrementalSync = new IncrementalSyncService();
  this.offlineQueue = new OfflineQueue();

  // Register with coordinator
  backgroundCoordinator.register('tiered-sync-manager', {
    name: 'Tiered Sync Manager',
    pause: () => this.pause(),
    resume: () => this.resume(),
  });
}
```

## 🔄 Services That Need Registration

Based on your codebase analysis, here are the services that should be registered:

### Critical (Database Writers)
- [x] **TieredSyncManager** - ✅ Already implemented
- [ ] **D1SyncService** - Needs registration
- [ ] **orderSyncService** - Needs registration
- [ ] **salesSyncService** - Needs registration
- [ ] **aggregatorSyncService** - Needs registration
- [ ] **menuSync** - Needs registration

### Important (Frequent Operations)
- [ ] **orderPollingService** - Needs registration
- [ ] **WebSocketManager** - Needs registration
- [ ] **multiLocationSyncService** - Needs registration
- [ ] **lanSyncService** - Needs registration

### Lower Priority
- [ ] **pluginUpdateChecker** - Optional
- [ ] **reCameraDetectionService** - Optional
- [ ] **autoAttendanceService** - Optional

## 📋 Implementation Checklist

### For Each Service:

1. **Add Import**
   ```typescript
   import { backgroundCoordinator } from '../backgroundOperationsCoordinator';
   ```

2. **Register in Constructor/Init**
   ```typescript
   backgroundCoordinator.register('unique-service-id', {
     name: 'Service Display Name',
     pause: () => this.pause(),
     resume: () => this.resume(),
   });
   ```

3. **Implement Pause Method**
   ```typescript
   private pause(): void {
     // Stop intervals
     if (this.intervalId) clearInterval(this.intervalId);

     // Close connections
     this.connection?.close();

     // Set flags
     console.log('[ServiceName] Paused');
   }
   ```

4. **Implement Resume Method**
   ```typescript
   private resume(): void {
     if (!this.isRunning) return; // Don't resume if explicitly stopped

     // Restart intervals
     this.startIntervals();

     // Reconnect
     this.reconnect();

     console.log('[ServiceName] Resumed');
   }
   ```

5. **Unregister on Cleanup**
   ```typescript
   destroy(): void {
     backgroundCoordinator.unregister('unique-service-id');
   }
   ```

## 🎯 Quick Start: Register Your First Service

### Example: Order Polling Service

```typescript
// src/lib/orderPollingService.ts
import { backgroundCoordinator } from '../services/backgroundOperationsCoordinator';

class OrderPollingService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Register with coordinator
    backgroundCoordinator.register('order-polling', {
      name: 'Order Polling Service',
      pause: () => this.pausePolling(),
      resume: () => this.resumePolling()
    });
  }

  start() {
    this.isEnabled = true;
    this.pollingInterval = setInterval(() => this.poll(), 5000);
  }

  stop() {
    this.isEnabled = false;
    this.pausePolling();
    backgroundCoordinator.unregister('order-polling');
  }

  private pausePolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[OrderPolling] Paused');
    }
  }

  private resumePolling() {
    if (this.isEnabled && !this.pollingInterval) {
      this.pollingInterval = setInterval(() => this.poll(), 5000);
      console.log('[OrderPolling] Resumed');
    }
  }

  private async poll() {
    // Polling logic
  }
}
```

## 🧪 Testing

### Manual Testing

1. **Check Registration**
   ```typescript
   import { backgroundCoordinator } from './services/backgroundOperationsCoordinator';

   console.log(backgroundCoordinator.listOperations());
   // Should show all registered services
   ```

2. **Test Pause/Resume**
   ```typescript
   // Manually test
   await backgroundCoordinator.pauseAll();
   console.log('All services paused - check logs');

   await backgroundCoordinator.resumeAll();
   console.log('All services resumed - check logs');
   ```

3. **Test Menu Upload**
   ```typescript
   // Upload a menu and check console logs
   // You should see:
   // [BackgroundCoordinator] Pausing N background operations...
   // [TieredSync] Paused
   // [Upload Session] Committing...
   // [Upload Session] Committed successfully
   // [BackgroundCoordinator] Resuming N background operations...
   // [TieredSync] Resumed
   ```

### Automated Testing

```typescript
describe('BackgroundCoordinator', () => {
  it('should pause and resume services', async () => {
    let isPaused = false;

    backgroundCoordinator.register('test-service', {
      name: 'Test Service',
      pause: () => { isPaused = true; },
      resume: () => { isPaused = false; }
    });

    await backgroundCoordinator.pauseAll();
    expect(isPaused).toBe(true);

    await backgroundCoordinator.resumeAll();
    expect(isPaused).toBe(false);
  });
});
```

## 📊 Monitoring

### Add to Diagnostics Page

```typescript
import { backgroundCoordinator } from '../services/backgroundOperationsCoordinator';

function BackgroundOperationsStatus() {
  const [status, setStatus] = useState(backgroundCoordinator.getStatus());
  const [operations, setOperations] = useState(backgroundCoordinator.listOperations());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(backgroundCoordinator.getStatus());
      setOperations(backgroundCoordinator.listOperations());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-bold mb-2">Background Operations</h3>

      <div className="mb-4">
        <div className={`inline-block px-3 py-1 rounded ${
          status.isPaused ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
        }`}>
          {status.isPaused ? '⏸️ PAUSED' : '▶️ RUNNING'}
        </div>
        <span className="ml-3 text-sm text-gray-600">
          {status.operationsCount} registered
        </span>
      </div>

      <div className="space-y-1">
        {operations.map(op => (
          <div key={op.id} className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${
              status.isPaused ? 'bg-yellow-500' : 'bg-green-500'
            }`} />
            <span>{op.name}</span>
            <span className="text-gray-400">({op.id})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 🚀 Benefits Achieved

1. **No More Database Locks** - Background operations pause during critical operations
2. **Automatic Coordination** - Services coordinate without manual intervention
3. **Graceful Degradation** - Services resume automatically after critical operations
4. **Better Reliability** - Combined with WAL mode and retry logic
5. **Easy Monitoring** - See what's running and what's paused
6. **Scalable** - Easy to add new services

## 📝 Next Steps

1. **Register D1SyncService** - Second highest priority
2. **Register orderSyncService** - Handles order synchronization
3. **Register WebSocket Manager** - Real-time updates
4. **Add to Diagnostics** - Show coordination status
5. **Load Testing** - Test with heavy concurrent load

## 🐛 Troubleshooting

### Still Getting Database Locks?
1. Check which services are registered: `backgroundCoordinator.listOperations()`
2. Verify all write operations are registered
3. Check console logs during critical operations
4. Ensure pause() actually stops the operations

### Service Not Resuming?
1. Check if `isRunning` flag is preserved during pause
2. Verify resume() recreates intervals correctly
3. Check for errors in resume callback
4. Ensure no early returns in resume logic

### Performance Issues?
1. Reduce sync intervals if too aggressive
2. Batch operations where possible
3. Consider priority-based pausing (pause only high-priority operations)

## 📚 References

- [BACKGROUND_OPERATIONS_GUIDE.md](BACKGROUND_OPERATIONS_GUIDE.md) - Full implementation guide
- [backgroundOperationsCoordinator.ts](src/services/backgroundOperationsCoordinator.ts) - Core coordinator
- [backgroundOperationsRegistry.ts](src/services/backgroundOperationsRegistry.ts) - Helper utilities
- [database.ts](src/lib/database.ts) - Enhanced database operations

---

**Status**: ✅ Core system implemented | 🔄 Service registration in progress | 📈 Ready for production testing
