# Database Issues Analysis & Solutions

**Date:** 2026-02-05
**Status:** Critical - Menu upload failing with database locking errors

## Executive Summary

The restaurant POS application is experiencing critical database locking issues that prevent menu uploads from completing successfully. Analysis of console logs reveals multiple concurrent database operations without proper coordination, leading to transaction failures even with retry logic in place.

## Issues Identified

### 1. Database Locking During Menu Upload (CRITICAL)

**Symptoms:**
```
[Upload Session] Commit failed, rolled back:"error returned from database: (code: 517) database is locked"
[Database] Operation failed (attempt 1/5): error returned from database: (code: 517) database is locked
```

**Root Cause:**
- Multiple uncoordinated database operations occurring simultaneously
- Background operations coordinator shows "Pausing 0 background operations" - no operations registered
- TieredSyncManager not initialized/started despite being available
- Restaurant settings being saved repeatedly during menu upload
- Plugin manager initializing concurrently
- Multiple stores loading data simultaneously

**Current Mitigation (Insufficient):**
- WAL mode enabled ✓
- `busy_timeout = 30000ms` ✓
- Retry logic with exponential backoff (5 attempts) ✓
- Background coordinator exists but not used ✗

**Impact:** Menu uploads fail completely after exhausting all retries

### 2. Missing Plugin Metadata Table

**Symptoms:**
```
[PluginRegistry] Failed to get installed plugins:"error returned from database: (code: 1) no such table: plugin_metadata"
```

**Root Cause:**
- Plugin system schema not initialized
- `plugin_metadata` table not created during database setup

**Impact:** Plugin functionality broken, contributes to initialization errors

### 3. Restaurant Settings Validation Issues

**Symptoms:**
```
Address Line 1:"""✓"false
State:"""✓"false
```

**Root Cause:**
- Required address fields not properly validated/enforced
- Settings validation passing despite missing required fields

**Impact:** Restaurant settings incomplete, may cause issues with billing/invoicing

### 4. Provisioning Timeout

**Symptoms:**
```
Failed to load resource: The request timed out.
[Restaurant Onboarding] ❌ Provisioning request failed
```

**Root Cause:**
- Network timeout during restaurant provisioning API call
- Possibly slow backend response or network issues

**Impact:** Failed to provision new restaurant on first attempt (succeeded on retry)

## Technical Analysis

### Database Architecture

**Current Setup:**
- SQLite with WAL mode
- Busy timeout: 30 seconds
- Multiple database files: `pos-dev.db` (main), `handsfree.db` (plugins)
- Transaction-based operations with retry logic

**Concurrency Issues:**
The console logs show these concurrent operations during menu upload:
1. Menu upload commit (transaction with multiple INSERT operations)
2. Restaurant settings updates (30+ calls to `updateSettings`)
3. Plugin manager initialization
4. Menu store loading
5. Inventory store loading
6. Theme store operations
7. Multiple component re-renders triggering database reads

### Background Operations Coordinator

**Design:**
- Singleton coordinator to pause/resume background operations during critical database operations
- Supports interval-based, WebSocket-based, and custom operations
- Reference counting for nested pause/resume

**Current Status:**
- Coordinator initialized ✓
- TieredSyncManager has registration code ✓
- **TieredSyncManager never started ✗**
- **Zero operations registered ✗**

**Evidence:**
```
[BackgroundCoordinator] Starting critical operation: Menu Upload Commit (food)
[BackgroundCoordinator] Pausing 0 background operations...
[BackgroundCoordinator] All operations paused
```

## Proposed Solutions

### Solution 1: Enable Background Operations Coordination (Recommended)

**Priority:** HIGH
**Effort:** LOW
**Impact:** HIGH

**Implementation:**
1. Initialize and start TieredSyncManager in App.tsx when tenant is activated
2. Register other database-intensive operations (settings updates, store hydration)
3. Ensure all background operations properly pause during critical operations

**Code Changes:**
```typescript
// In App.tsx or appropriate initialization code
import { getTieredSyncManager } from './services/sync/TieredSyncManager';

// After tenant activation
if (tenantId && dbPath) {
  const syncManager = getTieredSyncManager(tenantId);
  await syncManager.start();
}
```

**Benefits:**
- Prevents concurrent database access during critical operations
- Uses existing infrastructure
- Minimal code changes

### Solution 2: Reduce Concurrent Settings Updates

**Priority:** HIGH
**Effort:** LOW
**Impact:** MEDIUM

**Issue:** Console shows 30+ `[RestaurantSettingsInline] 🔍 FORMDATA.ADDRESS CHANGED:` logs during menu upload

**Implementation:**
1. Debounce settings updates in RestaurantSettingsInline component
2. Batch multiple field changes into single database operation
3. Prevent settings updates during critical operations

**Code Changes:**
```typescript
// In RestaurantSettingsInline.tsx
import { debounce } from 'lodash';

const debouncedUpdateSettings = debounce((settings) => {
  updateSettings(settings);
}, 500);
```

### Solution 3: Initialize Plugin System Schema

**Priority:** MEDIUM
**Effort:** LOW
**Impact:** LOW (doesn't fix locking but eliminates errors)

**Implementation:**
1. Create database migration to add plugin_metadata table
2. Add schema initialization in database.ts or plugin manager init

**Code Changes:**
```typescript
// In database.ts or plugin initialization
await database.execute(`
  CREATE TABLE IF NOT EXISTS plugin_metadata (
    plugin_id TEXT PRIMARY KEY,
    manifest TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    installed_at TEXT NOT NULL,
    previous_version TEXT
  )
`);
```

### Solution 4: Increase Database Concurrency Limits

**Priority:** LOW
**Effort:** LOW
**Impact:** LOW (treating symptom, not cause)

**Implementation:**
1. Increase busy_timeout from 30s to 60s
2. Increase retry attempts from 5 to 10
3. Increase base delay in retry logic

**Not Recommended:** This only delays failures, doesn't prevent them

### Solution 5: Implement Queue-Based Database Operations

**Priority:** MEDIUM
**Effort:** HIGH
**Impact:** HIGH

**Implementation:**
1. Create database operation queue
2. Serialize all write operations through queue
3. Allow concurrent reads, but coordinate writes

**Benefits:**
- Guaranteed no concurrent write conflicts
- Better control over operation priority

**Drawbacks:**
- Significant refactoring required
- May impact perceived performance
- Adds complexity

## Recommended Action Plan

### Phase 1: Immediate Fixes (1-2 hours)

1. ✅ Initialize and start TieredSyncManager
2. ✅ Create plugin_metadata table
3. ✅ Debounce settings updates in components
4. ✅ Test menu upload with coordination enabled

### Phase 2: Short-term Improvements (2-4 hours)

1. Register additional background operations with coordinator
2. Add database operation logging to identify other lock sources
3. Implement transaction timeout monitoring
4. Add retry telemetry to track failure patterns

### Phase 3: Long-term Architecture (1-2 days)

1. Evaluate queue-based database operation system
2. Consider moving to separate worker thread for database operations
3. Implement connection pooling if applicable
4. Add comprehensive database operation metrics

## Testing Plan

### Test 1: Menu Upload with Coordinator
1. Enable TieredSyncManager
2. Upload multi-page menu
3. Verify no database locking errors
4. Confirm all items imported correctly

### Test 2: Concurrent Operations
1. Start menu upload
2. Simultaneously update settings
3. Load multiple pages
4. Verify coordinator pauses operations correctly

### Test 3: Recovery Testing
1. Simulate lock timeout
2. Verify retry logic works
3. Confirm clean rollback on failure

## Monitoring & Metrics

**Add logging for:**
- Database lock acquisition time
- Transaction duration
- Failed transaction count by operation type
- Coordinator pause/resume events
- Retry attempts by operation type

**Dashboard metrics:**
- Database operation success rate
- Average transaction duration
- Lock contention frequency
- Menu upload success rate

## Related Files

- [src/lib/database.ts](src/lib/database.ts:664-824) - Menu upload commit logic
- [src/services/backgroundOperationsCoordinator.ts](src/services/backgroundOperationsCoordinator.ts) - Coordination system
- [src/services/sync/TieredSyncManager.ts](src/services/sync/TieredSyncManager.ts) - Sync manager with coordinator integration
- [src/services/plugins/pluginManager.ts](src/services/plugins/pluginManager.ts:63-64) - Plugin database config
- [src/services/pluginRegistry.ts](src/services/pluginRegistry.ts:85) - Plugin metadata queries

## Conclusion

The database locking issues are solvable with existing infrastructure. The BackgroundOperationsCoordinator is well-designed but not being utilized. Enabling it should immediately resolve the menu upload failures. Additional optimizations (debouncing settings, proper schema initialization) will further improve stability.

**Next Steps:** Implement Phase 1 immediate fixes and validate with comprehensive testing.
