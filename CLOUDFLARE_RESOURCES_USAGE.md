# Cloudflare Resources Usage Guide

Complete documentation of how provisioned Cloudflare resources (KV, R2, D1) are used in the HandsFree POS system.

---

## 🌐 Provisioned Resources

When a tenant is created, the backend provisions these Cloudflare resources:

```typescript
cloudflareResources: {
  kvNamespaceId: string;     // Workers KV namespace
  r2BucketName: string;      // R2 object storage bucket
  d1DatabaseId: string;      // D1 SQL database ID
  d1DatabaseName: string;    // D1 database name
}
```

---

## 📦 Workers KV (Key-Value Store)

**Purpose**: Fast, globally distributed key-value cache

### What We Store in KV:

#### 1. Tenant Configuration
```typescript
// Key: tenant:{tenantId}:config
{
  tenantId: string;
  subdomain: string;
  status: "ACTIVE" | "SUSPENDED";
  features: {
    aggregatorIntegration: boolean;
    voiceOrdering: boolean;
    multiLanguage: boolean;
  };
  settings: {
    currency: "INR" | "USD" | ...;
    timezone: string;
    taxRate: number;
  }
}
```

#### 2. Menu Cache
```typescript
// Key: tenant:{tenantId}:menu:cache
{
  categories: Category[];
  items: MenuItem[];
  lastSynced: string;
  version: number;
}
```

#### 3. Active Sessions
```typescript
// Key: tenant:{tenantId}:session:{sessionId}
{
  sessionId: string;
  userId: string;
  deviceId: string;
  role: "OWNER" | "MANAGER" | "SERVER" | "KITCHEN";
  lastActivity: string;
  expiresAt: string;
}
```

#### 4. Real-time Order Queue
```typescript
// Key: tenant:{tenantId}:orders:pending
{
  orders: OrderId[];
  lastUpdated: string;
}
```

#### 5. Aggregator Credentials (Encrypted)
```typescript
// Key: tenant:{tenantId}:aggregator:swiggy
{
  apiKey: string;          // Encrypted
  storeId: string;
  isActive: boolean;
  lastSync: string;
}
```

### KV Operations in POS:

**On App Start**:
```typescript
// Fetch tenant config from KV
const config = await fetch(`${BACKEND_API}/api/config`, {
  headers: { 'X-Tenant-ID': tenantId }
});
// Config is cached in local SQLite for offline access
```

**Menu Sync**:
```typescript
// Check if local menu is outdated
const localVersion = await getLocalMenuVersion();
const kvMenuCache = await fetch(`${BACKEND_API}/api/menu/cache`);

if (kvMenuCache.version > localVersion) {
  // Download latest menu from KV
  await updateLocalMenu(kvMenuCache);
}
```

**Session Management**:
```typescript
// Store active session in KV (for multi-device sync)
await fetch(`${BACKEND_API}/api/session`, {
  method: 'POST',
  body: JSON.stringify({ deviceId, userId, role })
});
```

---

## 🪣 R2 Object Storage

**Purpose**: Scalable object storage for large files

### What We Store in R2:

#### 1. Menu Item Images
```
Bucket structure:
handsfree-{tenantId}/
  ├── images/
  │   ├── menu-items/
  │   │   ├── {itemId}.jpg
  │   │   ├── {itemId}_thumb.jpg
  │   │   └── ...
  │   ├── categories/
  │   │   └── {categoryId}.jpg
  │   └── unassigned/
  │       └── {uploadId}.jpg
```

#### 2. Menu PDFs & Excel Files
```
  ├── uploads/
  │   ├── menu-pdf/
  │   │   └── menu_2025-01-22.pdf
  │   ├── menu-excel/
  │   │   └── menu_2025-01-22.xlsx
  │   └── extracted/
  │       └── menu_2025-01-22_extracted.json
```

#### 3. Receipt Images (from OCR)
```
  ├── receipts/
  │   ├── 2025-01/
  │   │   ├── order_12345.jpg
  │   │   └── order_12346.jpg
```

#### 4. Floor Plan Images
```
  ├── floor-plans/
  │   ├── floor_1.png
  │   └── floor_2.png
```

#### 5. Database Backups
```
  ├── backups/
  │   ├── daily/
  │   │   └── pos_2025-01-22.db
  │   └── hourly/
  │       └── pos_2025-01-22_14-00.db
```

#### 6. Staff Photos
```
  ├── staff/
  │   └── {userId}.jpg
```

### R2 Operations in POS:

**Image Upload (via Cloudflare Images API)**:
```typescript
// Images are uploaded to Cloudflare Images first (CDN)
const imageUrl = await uploadToCloudflareImages(file);

// Then reference is stored in R2 for backup/archive
await fetch(`${BACKEND_API}/api/images/archive`, {
  method: 'POST',
  body: JSON.stringify({
    imageId: cloudflareImageId,
    url: imageUrl,
    type: 'menu-item',
    itemId: 'item_123'
  })
});
```

**Menu PDF Processing**:
```typescript
// Upload PDF to R2
const uploadResult = await uploadPDF(pdfFile);

// Backend processes PDF from R2 and extracts menu
const extractedMenu = await fetch(`${BACKEND_API}/api/menu/extract`, {
  method: 'POST',
  body: JSON.stringify({
    pdfUrl: uploadResult.url,
    tenantId
  })
});
```

**Database Backup**:
```typescript
// Automatic hourly backup
const dbFile = await exportSQLiteDatabase();
await fetch(`${BACKEND_API}/api/backups/upload`, {
  method: 'POST',
  body: dbFile
});
```

---

## 🗄️ D1 Database (Cloud SQL)

**Purpose**: Cloudflare's distributed SQL database for cloud sync

### D1 Schema (Mirrors Local SQLite):

#### Core Tables (Synced from local):

```sql
-- Orders (synced from local SQLite)
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  table_id TEXT,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

-- Sales Transactions (synced from local)
CREATE TABLE sales_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

-- Menu Items (synced to local)
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category_id TEXT NOT NULL,
  image TEXT,
  active INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- Aggregator Orders (synced from aggregators)
CREATE TABLE aggregator_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT,
  items TEXT NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_to_local INTEGER DEFAULT 0
);

-- Inventory Levels (synced bidirectionally)
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  low_stock_threshold REAL,
  last_updated TEXT NOT NULL
);

-- Staff Attendance (synced from local)
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  synced_at TEXT NOT NULL
);
```

#### Analytics Tables (Cloud-only):

```sql
-- Daily Sales Summary (aggregated in D1)
CREATE TABLE daily_sales_summary (
  date TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  total_orders INTEGER NOT NULL,
  total_revenue REAL NOT NULL,
  avg_order_value REAL NOT NULL,
  payment_methods TEXT NOT NULL,
  top_items TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

-- Monthly Reports (aggregated in D1)
CREATE TABLE monthly_reports (
  month TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  total_revenue REAL NOT NULL,
  total_orders INTEGER NOT NULL,
  labor_costs REAL,
  food_costs REAL,
  net_profit REAL,
  generated_at TEXT NOT NULL
);
```

### D1 Sync Strategy:

**Local → D1 (Orders, Sales, Attendance)**:
```typescript
// After order completion
const order = {
  id: 'order_123',
  total_amount: 1250,
  status: 'completed',
  created_at: new Date().toISOString()
};

// Save locally first (immediate)
await saveOrderToLocalDB(order);

// Sync to D1 in background
await syncOrderToCloud(order);
```

**D1 → Local (Menu, Aggregator Orders)**:
```typescript
// Periodic sync every 5 minutes
setInterval(async () => {
  // Check for menu updates in D1
  const cloudMenu = await fetch(`${BACKEND_API}/api/menu/latest`);
  if (cloudMenu.version > localMenuVersion) {
    await updateLocalMenu(cloudMenu);
  }

  // Pull new aggregator orders from D1
  const newOrders = await fetch(
    `${BACKEND_API}/api/aggregator/orders?since=${lastSyncTime}`
  );
  await saveOrdersToLocalKDS(newOrders);
}, 5 * 60 * 1000);
```

**Bidirectional (Inventory)**:
```typescript
// Update inventory locally
await updateLocalInventory(itemId, newQuantity);

// Sync to D1
await fetch(`${BACKEND_API}/api/inventory/sync`, {
  method: 'POST',
  body: JSON.stringify({ itemId, quantity: newQuantity })
});

// Pull updates from other devices
const cloudInventory = await fetch(`${BACKEND_API}/api/inventory/latest`);
await mergeInventoryUpdates(cloudInventory);
```

---

## 🔄 Sync Architecture

### Local-First Architecture:

```
┌──────────────────────────────────────────────────────────┐
│                    POS Device (Local)                     │
│                                                            │
│  ┌────────────────────────────────────────────────┐      │
│  │          SQLite Database (Primary)             │      │
│  │  - Orders, Menu, Sales, Inventory, Staff       │      │
│  │  - Always available (offline-first)             │      │
│  └────────────┬───────────────────────────────────┘      │
│               │                                            │
│               │ Background Sync                            │
│               ▼                                            │
└───────────────┼────────────────────────────────────────────┘
                │
                │ HTTPS (Workers)
                ▼
┌──────────────────────────────────────────────────────────┐
│              Cloudflare Edge (Global)                     │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ Workers KV  │  │ R2 Storage  │  │ D1 Database │      │
│  │ (Cache)     │  │ (Files)     │  │ (Cloud SQL) │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                            │
│  ┌────────────────────────────────────────────────┐      │
│  │         Cloudflare Worker (API)                │      │
│  │  - Menu sync, Order sync, Image upload         │      │
│  │  - Aggregator webhooks, Analytics              │      │
│  └────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

### Data Flow Examples:

**1. Menu Upload Flow**:
```
User uploads PDF
  ↓
Save to local SQLite (images as base64)
  ↓
Upload PDF to R2 (background)
  ↓
Worker extracts menu items
  ↓
Store extracted menu in D1
  ↓
Update KV cache
  ↓
Notify all devices via WebSocket
  ↓
Other devices pull latest menu from KV
```

**2. Order Completion Flow**:
```
Order completed in POS
  ↓
Save to local SQLite (immediate)
  ↓
Display receipt (local data)
  ↓
Background sync to D1 (retry on failure)
  ↓
D1 aggregates for analytics
  ↓
Daily summary written to KV
```

**3. Aggregator Order Flow**:
```
Swiggy/Zomato webhook → Worker
  ↓
Worker saves to D1
  ↓
Updates KV order queue
  ↓
POS polls KV for new orders (every 30s)
  ↓
Download order to local SQLite
  ↓
Display in KDS
```

**4. Image Upload Flow**:
```
User uploads menu photos (bulk)
  ↓
Save to local SQLite (unassigned_images)
  ↓
Upload to Cloudflare Images API (CDN)
  ↓
Store reference in R2 (archive)
  ↓
Update D1 with image mappings
  ↓
AI matches images to menu items
  ↓
Update menu_items.image in D1 & local
```

---

## 🔐 Security & Access

### KV Access Patterns:
- **Write**: Only Worker (authenticated via CF Access)
- **Read**: Worker + Edge (cached, public for menu)
- **TTL**: Config (24h), Menu (1h), Sessions (30m)

### R2 Access Patterns:
- **Upload**: Worker only (authenticated)
- **Download**: Public URLs (signed, time-limited)
- **Lifecycle**: Delete old backups after 90 days

### D1 Access Patterns:
- **Write**: Worker only (authenticated)
- **Read**: Worker (queries for sync, analytics)
- **Backup**: Automatic daily snapshots

---

## 📊 Resource Limits & Costs

### Workers KV:
- **Free tier**: 100,000 reads/day, 1,000 writes/day
- **Paid**: $0.50/million reads, $5/million writes
- **Storage**: $0.50/GB/month

### R2:
- **Free tier**: 10 GB storage, 1 million Class A ops/month
- **Paid**: $0.015/GB/month storage, $4.50/million ops
- **Egress**: FREE (unlike S3!)

### D1:
- **Free tier**: 5 million reads/month, 100,000 writes/month
- **Paid**: $0.001/million reads, $1/million writes
- **Storage**: FREE up to 5GB

### Estimated Costs (per restaurant):
- **KV**: ~$1/month (menu cache, config)
- **R2**: ~$0.50/month (50GB images)
- **D1**: ~$2/month (orders, analytics)
- **Total**: ~$3.50/month per restaurant

---

## 🎯 Best Practices

### KV Best Practices:
1. **Cache aggressively** - Store frequently accessed data
2. **Short TTLs** - Keep data fresh (1h for menu)
3. **Namespace properly** - Use tenant prefixes
4. **Encrypt secrets** - Always encrypt credentials

### R2 Best Practices:
1. **Use Cloudflare Images** - For image CDN, not raw R2
2. **Organize by tenant** - Separate folders per tenant
3. **Lifecycle rules** - Auto-delete old backups
4. **Compress uploads** - Use WebP for images

### D1 Best Practices:
1. **Index properly** - Add indexes for common queries
2. **Batch writes** - Group multiple inserts
3. **Sync selectively** - Don't sync everything
4. **Aggregate in cloud** - Run analytics in D1, not local

---

This completes the Cloudflare resources usage documentation.
