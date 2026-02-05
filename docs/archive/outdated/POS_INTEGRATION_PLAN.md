# POS Integration with Handsfree Platform

## Analysis Complete

### Current Architecture

#### POS Application
- **Location**: `/Users/stonepot-tech/projects/restaurant-pos-ai/`
- **Tech Stack**: Tauri, React, Zustand, TypeScript
- **Deployment**: Dual platform (Desktop via Tauri, Web via Cloudflare Pages)
- **Backend API**: Configured for `http://localhost:3001/api`

**Tenant Architecture Support**: ✅ YES
- `authStore.ts` - Stores `tenantId` in user object
- `menuStore.ts` - `loadMenuFromAPI(tenantId)` method
- `orderStore.ts` - `submitOrder(tenantId, orderType)` method
- `backendApi.ts` - All API calls accept `tenantId` parameter

**Current API Expectations**:
```typescript
// Menu API
GET /api/tenants/${tenantId}/menu
Response: { items: MenuItem[], count: number }

// Order API
POST /api/orders
Body: { tenantId, orderType, items[], ... }
Response: { orderId: string, orderNumber: string }

// Auth APIs
POST /api/auth/login
POST /api/auth/login/pin
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/me
```

#### Handsfree Platform
- **Location**: `/Users/stonepot-tech/stonepot-platform/handsfree-platform/`
- **Architecture**: Multi-worker Cloudflare deployment
- **Workers**:
  - `store-front` - Main entry point (routes by subdomain)
  - `restaurant` - Restaurant-specific routing
  - `restaurant-client` - OpenNext Next.js app with D1 database

**Available APIs**:
```typescript
// Menu API (D1 Database)
GET /api/menu-d1/${tenantId}?limit=1000
Response: { items: MenuItem[], pagination: {...} }

POST /api/menu-d1/${tenantId}
Body: { name, category, price, ... }

PUT /api/menu-d1/${tenantId}/${itemId}
DELETE /api/menu-d1/${tenantId}/${itemId}

// Order API: ❌ NOT YET IMPLEMENTED
```

### Integration Gaps Identified

1. **Menu API Format Mismatch**:
   - POS expects: `/api/tenants/${tenantId}/menu`
   - Platform has: `/api/menu-d1/${tenantId}`
   - Field name differences (e.g., `isVeg` vs `is_vegetarian`)

2. **Order API Missing**:
   - POS expects `/api/orders` endpoint
   - Platform has NO order API yet
   - Need to create order storage (D1) and endpoints

3. **Authentication Integration**:
   - POS has auth APIs defined
   - Platform uses different auth (Hanko passkeys)
   - Need auth adapter or bypass for POS terminals

4. **Data Synchronization**:
   - POS uses SQLite locally (Tauri mode)
   - Web uses backend APIs
   - Need bidirectional sync strategy

## Integration Plan

### Phase 1: API Compatibility Layer (POS Side) ✅ PRIORITY

**Goal**: Create adapter in POS to work with existing handsfree platform APIs

**Tasks**:
1. Create `src/lib/handsfreeApi.ts` - Adapter for handsfree platform
2. Map API endpoints:
   - `/api/tenants/${tenantId}/menu` → `/api/menu-d1/${tenantId}`
3. Transform data formats:
   - Platform MenuItem → POS MenuItem
   - POS Order → Platform Order format
4. Update `.env` configuration for handsfree platform URLs

**Files to Create/Modify**:
- `/Users/stonepot-tech/projects/restaurant-pos-ai/src/lib/handsfreeApi.ts` (NEW)
- `/Users/stonepot-tech/projects/restaurant-pos-ai/.env.local` (UPDATE)
- `/Users/stonepot-tech/projects/restaurant-pos-ai/src/stores/menuStore.ts` (MODIFY - add handsfree option)
- `/Users/stonepot-tech/projects/restaurant-pos-ai/src/stores/orderStore.ts` (MODIFY - add handsfree option)

### Phase 2: Order API Implementation (Platform Side) ✅ PRIORITY

**Goal**: Create order management API in restaurant-client

**Tasks**:
1. Create D1 database schema for orders
2. Create order API endpoints:
   - `POST /api/orders/${tenantId}` - Create order
   - `GET /api/orders/${tenantId}` - List orders
   - `GET /api/orders/${tenantId}/${orderId}` - Get order details
   - `PATCH /api/orders/${tenantId}/${orderId}/status` - Update order status
3. Store orders in D1 database
4. Sync order status updates to KV for real-time updates

**Files to Create**:
- `/Users/stonepot-tech/stonepot-platform/handsfree-platform/restaurant-client/app/api/orders/[tenantId]/route.ts`
- `/Users/stonepot-tech/stonepot-platform/handsfree-platform/restaurant-client/app/api/orders/[tenantId]/[orderId]/route.ts`
- `/Users/stonepot-tech/stonepot-platform/handsfree-platform/restaurant-client/app/api/orders/[tenantId]/[orderId]/status/route.ts`

**Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL, -- 'dine_in', 'takeaway', 'delivery'
  status TEXT NOT NULL, -- 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT, -- 'cash', 'card', 'upi', 'wallet', 'online'
  table_number INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  source TEXT DEFAULT 'pos', -- 'pos', 'web', 'zomato', 'swiggy'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  customization TEXT, -- JSON string with modifiers, special instructions
  item_total REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

### Phase 3: Menu API Adapter (Platform Side)

**Goal**: Create menu API endpoint that matches POS expectations

**Options**:
A. Create alias endpoint `/api/tenants/${tenantId}/menu` that proxies to `/api/menu-d1/${tenantId}`
B. Update POS to use handsfree API format directly (via adapter in Phase 1)

**Recommendation**: Use Option B (adapter on POS side) - less platform changes

### Phase 4: Authentication Integration

**Goal**: Allow POS terminals to authenticate with handsfree platform

**Options**:
A. PIN-based authentication for POS terminals (already in POS code)
B. API key authentication for trusted POS devices
C. Bypass authentication for local development

**Recommendation**: Start with Option C for testing, implement Option A for production

**Tasks**:
1. Create `/api/auth/pos-login` endpoint
2. Generate tenant-specific POS access tokens
3. Store POS sessions in KV
4. Middleware to validate POS tokens

### Phase 5: Real-time Synchronization

**Goal**: Keep POS and web app in sync

**Architecture**:
```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│             │         │              │         │             │
│  POS App    │◄────────┤  D1 Database │────────►│  Web App    │
│  (Desktop)  │         │   (Orders)   │         │  (Browser)  │
│             │         │              │         │             │
└──────┬──────┘         └──────────────┘         └──────┬──────┘
       │                                                 │
       │                                                 │
       └─────────────────►KV Cache◄─────────────────────┘
                       (Real-time sync)
```

**Sync Strategies**:
1. **Menu**: D1 as source of truth, sync to KV on change
2. **Orders**: Write to D1, publish to KV for real-time updates
3. **Status Updates**: WebSocket or polling for live order status

**Implementation**:
- Use existing D1→KV sync pattern from menu
- Add KV pub/sub for order status updates
- POS polls KV every 5 seconds for status updates

### Phase 6: Deployment Configuration

**POS Deployment Options**:
1. **Desktop App** (Tauri):
   - Configure `.env` with handsfree platform URL
   - Use local SQLite for offline capability
   - Sync to cloud when online

2. **Web App** (Cloudflare Pages):
   - Deploy to Pages with wrangler
   - Direct integration with handsfree platform
   - No local database (always online)

**Configuration**:
```env
# .env.production (Web deployment)
VITE_BACKEND_API_URL=https://coorg-food-company-6163.handsfree.tech/api
VITE_DEFAULT_TENANT_ID=coorg-food-company-6163
VITE_SKIP_AUTH=false

# .env.local (Desktop development)
VITE_BACKEND_API_URL=http://localhost:3001/api
VITE_DEFAULT_TENANT_ID=demo-restaurant
VITE_SKIP_AUTH=true
```

## Implementation Order

### Immediate Actions (This Session):
1. ✅ Create `handsfreeApi.ts` adapter in POS
2. ✅ Create order API endpoints in restaurant-client
3. ✅ Create D1 order schema
4. ✅ Update POS configuration
5. ✅ Test basic integration

### Next Session:
1. Implement authentication for POS
2. Add real-time synchronization
3. Deploy and test in production
4. Monitor and optimize

## API Mapping Reference

### Menu API
| POS Expects | Handsfree Platform | Status |
|-------------|-------------------|--------|
| `GET /api/tenants/{tenantId}/menu` | `GET /api/menu-d1/{tenantId}` | ✅ Map via adapter |
| Response: `{ items, count }` | Response: `{ items, pagination }` | ✅ Transform in adapter |

### Order API
| POS Expects | Handsfree Platform | Status |
|-------------|-------------------|--------|
| `POST /api/orders` | `POST /api/orders/{tenantId}` | ❌ Need to create |
| Response: `{ orderId, orderNumber }` | Same | ⚠️ To implement |

### Field Mapping (Menu Items)
| POS Field | Platform Field | Transform |
|-----------|----------------|-----------|
| `isVeg` | `is_vegetarian` | Map boolean |
| `isVegan` | `is_vegan` | Map boolean |
| `imageUrl` | `photo_url` | Direct map |
| `imageId` | `cloudflare_image_id` | Direct map |
| `available` | `available` | Direct map (convert 1/0 to boolean) |
| `category` | `category` | Direct map |
| `price` | `price` | Direct map |

## Testing Checklist

- [ ] POS can fetch menu from handsfree platform
- [ ] Menu items display correctly in POS
- [ ] POS can submit orders to handsfree platform
- [ ] Orders are stored in D1 database
- [ ] Order numbers are generated correctly
- [ ] Web app can view POS-created orders
- [ ] Order status updates sync between POS and web
- [ ] Authentication works for POS terminals
- [ ] Offline mode works (Tauri only)
- [ ] Error handling and fallbacks work

## Success Criteria

1. POS application successfully connects to handsfree platform
2. Menu data syncs from platform to POS
3. Orders created in POS appear in platform database
4. Orders are visible in web app admin panel
5. Order status updates propagate in real-time
6. POS works offline (desktop mode) with local SQLite
7. POS syncs data when reconnecting online

## Next Steps

Execute Phase 1 and Phase 2 immediately to establish basic integration.
