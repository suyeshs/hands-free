# Sync Build Fix - Simplified Approach

## Problem
rusqlite::Connection is not Send, causing compilation errors when trying to use it across await points in async functions.

## Solution
Use a simpler approach with blocking operations:

1. Make sync functions synchronous (remove async)
2. Use `tokio::task::spawn_blocking` in the scheduler to run them in a thread pool
3. Clone the connection for each sync operation (rusqlite supports this with bundled features)

## Implementation Steps

### Step 1: Simplify sync functions
Remove async from sync functions and use synchronous HTTP with reqwest::blocking::Client

### Step 2: Update tiered_scheduler
Use spawn_blocking to run sync functions in background threads

### Step 3: Pass Connection by value (cloned)
Clone the connection for each sync operation

This approach:
- ✅ Avoids Send/Sync issues
- ✅ Works with rusqlite's threading model
- ✅ Simpler code (no Arc<Mutex> juggling)
- ✅ Still performant (rusqlite ops are blocking anyway)

## Alternative (Current Attempt)
Tried to make everything properly async with Arc<TokioMutex<Connection>>, but this requires refactoring all 12 sync functions which is time-consuming.

## Recommendation
For testing purposes, let's use the simpler blocking approach first, then optimize later if needed.
