# Backend Integration - Implementation Status

## Phase 1: HTTP API Integration ✅ COMPLETE

### What's Been Implemented

#### 1. Order Transformation Layer
**File**: [src/lib/orderTransformations.ts](src/lib/orderTransformations.ts)

Added complete transformation functions to convert POS orders to backend format:

- **`transformPOSOrderToBackend()`** - Converts POS Order → Backend Order
  - Maps payment methods (card/upi/wallet → 'online')
  - Auto-generates customer info for walk-in orders
  - Combines modifiers and special instructions into customization field
  - Maps order types correctly

- **`validateBackendOrder()`** - Validates backend order before submission
  - Checks all required fields
  - Validates cart items and totals
  - Ensures data integrity

- **Backend Order Types** - TypeScript interfaces for backend schema:
  - `BackendOrder`
  - `BackendCart`
  - `BackendCustomer`
  - `BackendOrderItem`

**Key Features**:
- Automatic customer name generation: `Table ${tableNumber}` or `Walk-in Customer`
- Automatic phone generation: `POS-${timestamp}` for tracking
- Payment method mapping preserves all original info while conforming to backend schema
- Robust error handling with detailed logging

#### 2. POS Store Integration
**File**: [src/stores/posStore.ts](src/stores/posStore.ts)

Updated `submitOrder` function to:

1. **Transform order** using `transformPOSOrderToBackend()`
2. **Validate** before submission
3. **Submit to backend** via `backendApi.submitOrder()`
4. **Graceful fallback** - if backend fails, continues with local-only mode
5. **Update state** with backend-assigned order ID and number
6. **Continue existing flow** - KDS integration and KOT printing still work

**Changes Made** (lines 348-470):
```typescript
// Transform POS order to backend format
const backendOrder = transformPOSOrderToBackend(order, tenantId);

// Validate before submission
if (!validateBackendOrder(backendOrder)) {
  throw new Error('Invalid order data');
}

// Submit to backend with fallback
try {
  const { orderId, orderNumber } = await backendApi.submitOrder(tenantId, backendOrder);
  createdOrder = {
    ...order,
    id: orderId,
    orderNumber: orderNumber,
    status: 'confirmed',
  };
} catch (backendError) {
  // Fall back to local-only mode
  createdOrder = {
    ...order,
    id: `order-${Date.now()}`,
    orderNumber: `#${Math.floor(1000 + Math.random() * 9000)}`,
  };
}
```

Added helper method:
- **`updateLastOrderNumber()`** - Updates recent orders with backend-assigned number

#### 3. WebSocket Hook (Future Enhancement)
**File**: [src/hooks/usePOSWebSocket.ts](src/hooks/usePOSWebSocket.ts)

Created complete WebSocket client hook for real-time synchronization:

- **Connection Management**: Auto-connect, reconnect with exponential backoff
- **Message Queue**: Queues messages when disconnected, sends when reconnected
- **Message Handlers**: Processes order_created, order_status_update, sync_state
- **State Sync**: Bidirectional sync between POS, KDS, and backend
- **Error Handling**: Graceful degradation, max retry limits

**Status**: Ready to use when backend WebSocket endpoint is available

#### 4. Environment Configuration
**File**: [.env.example](.env.example)

Created configuration template with:
- `VITE_BACKEND_API_URL` - HTTP API endpoint
- `VITE_BACKEND_WS_URL` - WebSocket endpoint (for future use)
- `VITE_BACKEND_URL` - Base URL for constructing endpoints

## Current Integration Flow

### Order Submission Flow (HTTP)
```
POS Dashboard
    ↓
POSStore.submitOrder()
    ↓
transformPOSOrderToBackend()  ← Order transformation
    ↓
validateBackendOrder()        ← Validation
    ↓
backendApi.submitOrder()      ← HTTP POST to backend
    ↓
Backend creates order
    ↓
Returns orderId + orderNumber
    ↓
POSStore updates state
    ↓
transformPOSToKitchenOrder()  ← KDS transformation
    ↓
KDSStore.addOrder()           ← Send to kitchen
    ↓
printerService.print()        ← Print KOT (if enabled)
    ↓
Clear cart & show confirmation
```

### Fallback Flow (Backend Unavailable)
```
POS Dashboard
    ↓
POSStore.submitOrder()
    ↓
transformPOSOrderToBackend()
    ↓
backendApi.submitOrder() → FAILS
    ↓
Catch error, generate local order
    ↓
Continue with local ID/orderNumber
    ↓
KDS + KOT still work
    ↓
User can continue operating
```

## Testing the Integration

### Prerequisites
1. Backend server running on `http://localhost:3001`
2. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

### Test Scenarios

#### Test 1: Successful Order Submission
1. Open POS Dashboard
2. Add items to cart
3. Click "Place Order"
4. Select payment method
5. Click "Confirm Order"

**Expected**:
- Console log: `[POSStore] Submitting order to backend:`
- Console log: `[POSStore] Order created in backend:`
- Order appears in recent orders with backend-assigned number
- Order appears in KDS
- KOT prints (if auto-print enabled)

#### Test 2: Backend Unavailable (Fallback)
1. Stop backend server
2. Add items to cart
3. Click "Place Order"
4. Select payment method
5. Click "Confirm Order"

**Expected**:
- Console error: `[POSStore] Backend submission failed, using local mode:`
- Order still created with local ID
- Order appears in recent orders
- Order appears in KDS
- KOT prints (if auto-print enabled)
- System continues to work

#### Test 3: Order Data Validation
Check browser console for these logs:
- Transformation: `[POSStore] Submitting order to backend:`
- Customer info: Should see auto-generated name/phone
- Payment mapping: card/upi/wallet should map to 'online'
- Cart items: Should see customization field combining modifiers

## Backend API Endpoint Requirements

The backend must provide this endpoint:

**POST** `/api/orders`

**Request Body**:
```json
{
  "tenantId": "string",
  "orderType": "dine-in" | "takeout" | "delivery",
  "paymentMethod": "cash" | "online",
  "customer": {
    "name": "string",
    "phone": "string",
    "email": "string | null"
  },
  "cart": {
    "items": [
      {
        "itemId": "string",
        "dishName": "string",
        "quantity": "number",
        "price": "number",
        "itemTotal": "number",
        "customization": "string | null"
      }
    ],
    "subtotal": "number",
    "tax": "number",
    "deliveryFee": "number",
    "total": "number"
  },
  "status": "confirmed",
  "tableNumber": "number | null",
  "notes": "string | null",
  "source": "pos",
  "createdAt": "ISO 8601 timestamp"
}
```

**Response**:
```json
{
  "success": true,
  "orderId": "string",
  "orderNumber": "string"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "string"
}
```

## Next Steps

### Phase 2: WebSocket Real-time Sync (Optional)

When ready to implement real-time synchronization:

1. **Backend**: Implement WebSocket endpoint at `/ws/restaurant-pos/:tenantId`
2. **Frontend**: Enable WebSocket hook in POS Dashboard
3. **Integration**: Replace HTTP polling with WebSocket updates

**Benefits of WebSocket**:
- Real-time order updates across all POS terminals
- Instant status changes from KDS to POS
- Reduced API calls (no polling)
- Better multi-client synchronization

### Phase 3: Durable Objects (Future)

For ultra-low latency and global scale:

1. Create dedicated Cloudflare Worker: `restaurant-order-worker`
2. Implement `RestaurantOrderDO` Durable Object
3. Route WebSocket connections through DO
4. Achieve sub-second synchronization globally

**Estimated Effort**: 13-17 hours (as per plan)

## Files Modified

### New Files
- `src/lib/orderTransformations.ts` (+150 lines) - Backend transformation
- `src/hooks/usePOSWebSocket.ts` (+350 lines) - WebSocket client
- `.env.example` - Environment configuration template
- `BACKEND_INTEGRATION.md` - This documentation

### Modified Files
- `src/stores/posStore.ts` (lines 348-470) - Backend integration
- `src/types/kds.ts` - Added 'online' source type
- `src/stores/kdsStore.ts` - Added online order status propagation

## Troubleshooting

### Orders not reaching backend
- Check `.env` file has correct `VITE_BACKEND_API_URL`
- Check backend server is running
- Check browser console for errors
- Verify backend endpoint exists and is accessible

### CORS errors
Backend must include these headers:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Validation errors
- Check backend order schema matches `BackendOrder` type
- Verify all required fields are present
- Check cart items have all required fields

### Fallback mode always activating
- Verify `VITE_BACKEND_API_URL` in `.env`
- Check network connectivity
- Verify backend endpoint path is correct (`/api/orders`)

## Success Criteria ✅

- [x] POS orders transform to backend format correctly
- [x] Orders submit to backend via HTTP API
- [x] Backend-assigned order ID and number are used
- [x] Graceful fallback when backend unavailable
- [x] KDS integration continues to work
- [x] KOT printing continues to work
- [x] Order status propagates bidirectionally (KDS → POS)
- [x] Multi-order source support (POS, Zomato, Swiggy, Online)

## Support

For issues or questions:
1. Check browser console logs (filter by `[POSStore]`)
2. Verify backend server logs
3. Check `.env` configuration
4. Refer to plan file: `~/.claude/plans/zazzy-wishing-shannon.md`
