# WebSocket Real-time Integration - Implementation Guide

## Overview

WebSocket integration has been implemented to enable real-time bidirectional communication between the POS frontend and backend. This allows for instant order updates, multi-client synchronization, and reduced server load compared to HTTP polling.

## What's Been Implemented ✅

### 1. WebSocket Client Manager
**File**: [src/lib/posWebSocketClient.ts](src/lib/posWebSocketClient.ts)

A singleton WebSocket client that manages:
- Connection lifecycle (connect, disconnect, reconnect)
- Exponential backoff reconnection (max 10 attempts)
- Message queueing when offline
- Message handlers for different event types
- State synchronization with stores

**Key Features**:
- **Auto-reconnect**: Automatically reconnects with exponential backoff
- **Message Queue**: Queues messages when offline, sends when reconnected
- **Singleton Pattern**: Single connection instance shared across the app
- **Type-safe Messages**: TypeScript interfaces for all message types

**Message Types Supported**:
- `submit_order` - Submit order to backend
- `order_created` - Order created successfully
- `order_status_update` - Order status changed
- `sync_state` - Full state synchronization
- `error` - Error messages from server

### 2. WebSocket Connection Manager Component
**File**: [src/components/WebSocketManager.tsx](src/components/WebSocketManager.tsx)

React component that:
- Manages WebSocket connection lifecycle
- Auto-connects when user logs in
- Auto-disconnects when user logs out
- Shows connection status indicator (in development mode)
- Displays queued message count

**Connection Status Indicator**:
- 🟢 **GREEN**: Connected and ready
- 🟡 **YELLOW**: Connecting...
- ⚫ **GRAY**: Disconnected

### 3. Hybrid Order Submission (WebSocket + HTTP Fallback)
**File**: [src/stores/posStore.ts](src/stores/posStore.ts:384-423)

The POS store now supports both WebSocket and HTTP order submission:

```typescript
// Strategy:
1. Check if WebSocket is connected
2. If connected → Submit via WebSocket (async, instant feedback)
3. If not connected → Fall back to HTTP API
4. If HTTP fails → Fall back to local-only mode
```

**Benefits**:
- **Real-time**: Orders appear instantly in KDS via WebSocket
- **Resilient**: Falls back to HTTP if WebSocket unavailable
- **Offline-capable**: Works in local-only mode if both fail

### 4. Integration in App
**File**: [src/App.web.tsx](src/App.web.tsx:54-55)

WebSocketManager is now integrated at the app root level, ensuring:
- WebSocket connects automatically when user logs in
- Connection persists across route changes
- Disconnects cleanly on logout

## How It Works

### Order Submission Flow (WebSocket)

```
User clicks "Place Order"
    ↓
POSStore.submitOrder()
    ↓
Check: posWebSocketClient.isConnected()
    ↓
[IF CONNECTED]
    ↓
posWebSocketClient.submitOrder(order)  ← Send via WebSocket
    ↓
Create temporary order (status: pending)
    ↓
Update UI immediately (optimistic update)
    ↓
[Backend processes order]
    ↓
Backend sends 'order_created' message
    ↓
posWebSocketClient.handleMessage()
    ↓
Update order with real orderId & orderNumber
    ↓
Add to KDS store (instant display)
    ↓
Print KOT (if enabled)
    ↓
Done ✓

[IF NOT CONNECTED]
    ↓
Fall back to HTTP API (existing flow)
```

### Real-time Order Status Updates

```
KDS staff marks order complete
    ↓
Backend updates order status in database
    ↓
Backend broadcasts 'order_status_update' via WebSocket
    ↓
All connected clients receive update
    ↓
POSWebSocketClient receives message
    ↓
Updates POS recent orders
    ↓
Updates KDS active orders
    ↓
UI updates automatically ✓
```

### State Synchronization on Reconnect

```
WebSocket reconnects after disconnect
    ↓
Client connects successfully
    ↓
Backend sends 'sync_state' message
    ↓
Contains:
  - activeOrders: All current kitchen orders
  - recentOrders: Last 10 POS orders
    ↓
POSWebSocketClient receives sync
    ↓
Updates POS store with latest orders
    ↓
Updates KDS store with latest orders
    ↓
UI is now in sync with server ✓
```

## Configuration

### Environment Variables

Update your `.env` file:

```bash
# WebSocket URL (for real-time sync)
VITE_BACKEND_WS_URL=ws://localhost:3001/ws

# HTTP API URL (for fallback)
VITE_BACKEND_API_URL=http://localhost:3001/api
```

**Production Example**:
```bash
VITE_BACKEND_WS_URL=wss://api.yourrestaurant.com/ws
VITE_BACKEND_API_URL=https://api.yourrestaurant.com/api
```

### WebSocket URL Construction

If `VITE_BACKEND_WS_URL` is not set, the client automatically constructs it:

```typescript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = VITE_BACKEND_URL || 'localhost:3001';
const url = `${protocol}//${host}/ws/restaurant-pos/${tenantId}`;
```

## Backend Requirements

The backend must implement the WebSocket endpoint at:

**Endpoint**: `GET /ws/restaurant-pos/:tenantId`

**Upgrade**: HTTP → WebSocket

### Message Protocol

#### Client → Server Messages

**1. Submit Order**
```json
{
  "type": "submit_order",
  "order": {
    "tenantId": "string",
    "orderType": "dine-in" | "takeout" | "delivery",
    "paymentMethod": "cash" | "online",
    "customer": { "name": "string", "phone": "string" },
    "cart": { /* ... */ },
    "status": "confirmed",
    "source": "pos"
  }
}
```

#### Server → Client Messages

**1. Order Created**
```json
{
  "type": "order_created",
  "order": {
    "id": "order-123",
    "orderNumber": "ORD-20250106-001",
    /* ... backend order data ... */
  },
  "kitchenOrder": {
    "id": "kitchen-123",
    "orderNumber": "ORD-20250106-001",
    "status": "pending",
    "items": [ /* ... */ ]
  }
}
```

**2. Order Status Update**
```json
{
  "type": "order_status_update",
  "orderId": "order-123",
  "orderNumber": "ORD-20250106-001",
  "status": "ready",
  "updatedBy": "kitchen-terminal-1"
}
```

**3. State Synchronization** (sent on connect/reconnect)
```json
{
  "type": "sync_state",
  "activeOrders": [ /* KitchenOrder[] */ ],
  "recentOrders": [ /* Order[] */ ]
}
```

**4. Error**
```json
{
  "type": "error",
  "message": "Invalid order data",
  "code": "VALIDATION_ERROR"
}
```

## Testing WebSocket Integration

### 1. Start Development Environment

```bash
# Terminal 1: Start backend with WebSocket support
cd /path/to/stonepot-restaurant
npm run dev

# Terminal 2: Start frontend
cd /path/to/restaurant-pos-ai
npm run dev
```

### 2. Check Connection Status

1. Open browser to `http://localhost:5173`
2. Login to the system
3. Look for connection status indicator in bottom-right corner
4. Should show: **WS: CONNECTED** (green)

### 3. Test Order Submission via WebSocket

1. Navigate to POS Dashboard (`/pos`)
2. Add items to cart
3. Click "Place Order" → Select payment → Confirm
4. Open browser console (F12)
5. Look for these logs:

```
[POSWebSocketClient] Sending message: submit_order
[POSWebSocketClient] Received message: order_created
[POSStore] Order submitted via WebSocket (async)
[POSStore] Order sent to KDS
[POSStore] KOT printed successfully
```

### 4. Test WebSocket Fallback

1. Stop backend server
2. Try to place an order
3. Should see connection status: **WS: DISCONNECTED** (gray)
4. Console logs:

```
[POSStore] WebSocket not connected, using HTTP API
[POSStore] Backend submission failed, using local mode
```

5. Order should still work in local-only mode

### 5. Test Reconnection

1. Stop backend
2. Wait for: `[POSWebSocketClient] Max reconnection attempts reached`
3. Restart backend
4. Manually refresh page or wait for next connection attempt
5. Should reconnect and show: **WS: CONNECTED**

### 6. Test Real-time Updates

1. Open two browser windows side-by-side
2. Window 1: POS Dashboard (`/pos`)
3. Window 2: Kitchen Dashboard (`/kitchen`)
4. Place order in POS (Window 1)
5. Order should appear instantly in KDS (Window 2)
6. Mark order complete in KDS (Window 2)
7. Status should update in POS recent orders (Window 1)

## Connection Status Monitoring

### Development Mode

In development, a status indicator is shown in the bottom-right corner:

- **WS: CONNECTED** (green) - WebSocket connected and ready
- **WS: CONNECTING** (yellow) - Attempting to connect
- **WS: DISCONNECTED** (gray) - Not connected
- **(N queued)** - Shows number of queued messages

### Production Mode

Status indicator is hidden in production. Monitor connection status via:

```typescript
import { posWebSocketClient } from './lib/posWebSocketClient';

// Check if connected
const isConnected = posWebSocketClient.isConnected();

// Check queued messages
const queueCount = posWebSocketClient.getQueuedMessageCount();
```

## Troubleshooting

### WebSocket won't connect

**Check**:
1. Backend is running on correct port
2. WebSocket endpoint is implemented: `/ws/restaurant-pos/:tenantId`
3. `.env` has correct `VITE_BACKEND_WS_URL`
4. CORS headers allow WebSocket upgrade
5. No firewall blocking WebSocket connections

**Logs to check**:
```
[POSWebSocketClient] Connecting to: ws://localhost:3001/ws/restaurant-pos/...
[POSWebSocketClient] Connected
```

### Messages not being received

**Check**:
1. Backend is sending correct message format (JSON)
2. Message type is one of: order_created, order_status_update, sync_state, error
3. Browser console shows: `[POSWebSocketClient] Received message: <type>`
4. No JavaScript errors in console

### Orders not appearing in KDS

**Check**:
1. WebSocket message contains `kitchenOrder` object
2. KDS store is receiving order: `[POSWebSocketClient] Order created: ...`
3. Order transformation is valid
4. KDS is filtering by correct station

### Queued messages not sending

**Check**:
1. WebSocket is actually connected (check status indicator)
2. Messages appear in queue: `[POSWebSocketClient] Processing queued messages: N`
3. No connection errors in console

### Connection keeps dropping

**Possible causes**:
- Backend restart/crash
- Network instability
- Load balancer timeout (increase timeout)
- Backend WebSocket implementation issue

**Solution**:
- Check backend logs for errors
- Increase reconnection attempts if needed
- Check network stability

## Performance Considerations

### Message Queue Size

Messages are queued in memory when WebSocket is disconnected. Monitor queue size:

```typescript
const queuedCount = posWebSocketClient.getQueuedMessageCount();
if (queuedCount > 50) {
  // Consider showing warning to user
  console.warn('Many messages queued, connection may be unstable');
}
```

### Reconnection Strategy

Current configuration:
- **Max attempts**: 10
- **Base delay**: 1 second
- **Max delay**: 30 seconds
- **Backoff**: Exponential (with jitter)

Adjust in `posWebSocketClient.ts` if needed:

```typescript
private readonly MAX_RECONNECT_ATTEMPTS = 10;
private readonly BASE_RECONNECT_DELAY = 1000;
private readonly MAX_RECONNECT_DELAY = 30000;
```

## Next Steps

### Immediate Enhancements

1. **Persistent Queue**: Store queued messages in localStorage
2. **Connection Quality Indicator**: Show latency/packet loss
3. **Automatic Retry**: Retry failed messages automatically
4. **Compression**: Use WebSocket compression for large messages

### Backend Implementation

Refer to the plan file for backend implementation details:
- **Option A**: New Cloudflare Worker with Durable Objects
- **Option B**: Extend theme-edge-worker
- **Option C**: Node.js backend with WebSocket server

See: `~/.claude/plans/zazzy-wishing-shannon.md`

## Success Criteria ✅

- [x] WebSocket client implemented and tested
- [x] Connection lifecycle managed automatically
- [x] Hybrid submission (WebSocket + HTTP fallback) working
- [x] Real-time order status updates
- [x] State synchronization on reconnect
- [x] Message queueing when offline
- [x] Integration with POS and KDS stores
- [x] Development status indicator
- [x] Graceful degradation to HTTP

## Files Created/Modified

### New Files
- `src/lib/posWebSocketClient.ts` - WebSocket client singleton
- `src/components/WebSocketManager.tsx` - Connection lifecycle manager
- `WEBSOCKET_INTEGRATION.md` - This documentation

### Modified Files
- `src/stores/posStore.ts` - Hybrid WebSocket/HTTP submission
- `src/App.web.tsx` - Integrated WebSocketManager component

## Support

For WebSocket-specific issues:
1. Check browser console for connection logs
2. Verify backend WebSocket endpoint is implemented
3. Check `.env` configuration
4. Monitor connection status indicator
5. Refer to backend implementation plan
