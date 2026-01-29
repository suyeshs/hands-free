# Aggregator Integration Plugin

Complete integration for Swiggy and Zomato with order extraction, dashboard automation, status mapping, and sales recording.

## Overview

This hybrid plugin runs on both:
- **Client-side** (Browser WASM): Order processing, validation, transformation (offline)
- **Worker-side** (Cloudflare Workers WASM): Order sync, sales recording, analytics (D1 queries)

## Features

### Client Plugin (`client/`)
- ✅ Invoice number generation (AGG-2601-SWG12345)
- ✅ Order item transformation (aggregator → POS format)
- ✅ Payment method determination (prepaid → UPI, COD → cash)
- ✅ Order validation (items, totals, customer info)
- ✅ Status mapping (Swiggy/Zomato → internal status)
- ✅ Tax breakdown (CGST/SGST)
- ✅ Batch processing
- ✅ Pure calculations (works offline)

### Worker Plugin (`worker/`)
- ✅ Order sync to D1 (batch processing)
- ✅ Sales recording to sales_transactions table
- ✅ Sales reports by aggregator
- ✅ Order trends analytics (30-day history)
- ✅ DOM selector management (KV storage)
- ✅ Historical data queries

## Prerequisites

1. **Rust** (https://rustup.rs/)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **wasm32-unknown-unknown target**
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. **wasm-bindgen-cli** (for client plugin)
   ```bash
   cargo install wasm-bindgen-cli
   ```

## Building

```bash
# Build both client and worker plugins
chmod +x build.sh
./build.sh
```

## API Reference

### Client Functions

#### `generate_invoice_number(order_json: string) -> string`
Generate invoice number for aggregator order.

**Input:**
```json
{
  "orderId": "order-123",
  "orderNumber": "12345",
  "aggregator": "swiggy"
}
```

**Returns:**
```json
{
  "invoiceNumber": "AGG-2601-SWG12345",
  "orderNumber": "12345",
  "aggregator": "swiggy",
  "prefix": "SWG",
  "yearMonth": "2601"
}
```

#### `transform_items_to_cart(order_json: string) -> string`
Transform aggregator order items to POS cart format.

#### `validate_order(order_json: string) -> string`
Validate order completeness and correctness.

**Returns:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Customer phone number is missing"]
}
```

#### `map_aggregator_status(aggregator: string, status: string) -> string`
Map aggregator status to internal status.

**Example:**
```rust
map_aggregator_status("swiggy", "order_accepted")
// → { internalStatus: "accepted", description: "Order accepted by restaurant", shouldNotify: true }
```

### Worker Endpoints

#### `POST /api/plugin/aggregator-integration/{tenantId}/orders/sync`
Sync aggregator orders to D1.

**Request:**
```json
{
  "tenantId": "tenant-123",
  "orders": [
    {
      "orderId": "order-123",
      "orderNumber": "12345",
      "aggregator": "swiggy",
      "status": "accepted",
      "total": 450.00,
      "createdAt": "2026-01-29T10:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "synced": 1,
    "errors": [],
    "total": 1
  }
}
```

#### `POST /api/plugin/aggregator-integration/{tenantId}/sales/record`
Record aggregator sale to sales_transactions.

#### `POST /api/plugin/aggregator-integration/{tenantId}/reports/sales`
Generate sales report by aggregator.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "aggregator": "swiggy",
      "orderCount": 150,
      "totalSales": 67500.00,
      "avgOrderValue": 450.00,
      "totalTax": 6075.00,
      "totalDeliveryFee": 3000.00
    }
  ]
}
```

#### `GET /api/plugin/aggregator-integration/{tenantId}/analytics/trends`
Get 30-day order trends.

## Usage

### In React Components

```typescript
import { useWasm } from '@/hooks/useWasm';

function AggregatorDashboard() {
  const { instance, loading, invoke } = useWasm('aggregator-integration');

  const generateInvoice = async (order: AggregatorOrder) => {
    if (!instance) return;

    const result = await invoke<string>(
      'generate_invoice_number',
      JSON.stringify(order)
    );

    const data = JSON.parse(result);
    console.log('Invoice:', data.invoiceNumber);
  };

  const validateOrder = async (order: AggregatorOrder) => {
    const result = await invoke<string>('validate_order', JSON.stringify(order));
    const validation = JSON.parse(result);

    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
  };

  if (loading) return <div>Loading plugin...</div>;

  return <div>{/* Aggregator dashboard UI */}</div>;
}
```

### Calling Worker API

```typescript
// Sync orders to D1
const response = await fetch(
  '/api/plugin/aggregator-integration/tenant-123/orders/sync',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'tenant-123',
      orders: aggregatorOrders,
    }),
  }
);

const result = await response.json();
console.log('Synced:', result.data.synced, 'orders');
```

## Permissions

- `database.read.aggregator_orders` - Read aggregator order data
- `database.write.aggregator_orders` - Write aggregator orders
- `database.write.sales_transactions` - Record sales
- `dom.read.swiggy_dashboard` - Extract data from Swiggy dashboard
- `dom.interact.swiggy_dashboard` - Automate Swiggy dashboard actions
- `storage.aggregator_integration` - Store plugin-specific data

## Size

- **Client WASM**: ~120KB (optimized)
- **Worker WASM**: ~70KB (optimized)
- **Total**: ~190KB

## Regional Support

- **Primary Region**: India (IN)
- **Supported Platforms**: Swiggy, Zomato
- **Multi-region**: Not currently supported

## Migration from Built-in Aggregator Features

The aggregator plugin replaces:
- `src/lib/aggregatorSalesService.ts` (210 LOC) → Client + Worker WASM
- `src/lib/aggregatorSyncService.ts` (160 LOC) → Worker WASM
- Business logic in `src/stores/aggregatorStore.ts` → Plugin APIs

**Benefits after migration**:
- ✅ Update aggregator logic without app rebuild (critical for dashboard UI changes)
- ✅ ~3MB smaller base app
- ✅ Offline-capable order processing
- ✅ Regional deployment (India-only)
- ✅ Easy selector updates via KV

## DOM Selector Management

The plugin stores DOM extraction selectors in Cloudflare KV:

```typescript
// Update selectors via Worker API
await fetch('/api/plugin/aggregator-integration/tenant-123/extraction/update-selectors', {
  method: 'POST',
  body: JSON.stringify({
    platform: 'swiggy',
    selectors: {
      orderCard: '.order-card',
      orderNumber: '.order-number',
      acceptButton: 'button[data-action="accept"]',
      // ... more selectors
    },
    version: '2.0.0',
  }),
});
```

Selectors can be updated without deploying new plugin version!

## License

MIT

## Support

- GitHub Issues: https://github.com/handsfree/restaurant-pos-ai/issues
- Discord: https://discord.gg/handsfree
- Docs: https://docs.handsfree.com/plugins/aggregator-integration

## Next Steps

1. Test plugin with live Swiggy/Zomato orders
2. Deploy to staging environment
3. Migrate existing aggregator dashboard
4. Update DOM selectors for current dashboard versions
5. Roll out to India-based restaurants
