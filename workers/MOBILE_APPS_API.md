# Mobile Apps API Documentation

Complete API reference for HandsFree Owner and Staff mobile applications.

## Base URL

All API requests are made to the tenant worker through the handsfree-proxy:

```
https://{tenant-subdomain}.handsfree.tech/api/
```

Example:
```
https://airarang.handsfree.tech/api/owner/dashboard/stats
```

## Authentication

All API requests must include:
- `X-Tenant-Id` header with the tenant ID
- `Authorization` header with Bearer token (to be implemented)

## Real-time Updates

Both apps support WebSocket connections for real-time data updates.

### WebSocket Endpoint

```
wss://{tenant-subdomain}.handsfree.tech/api/realtime/ws
```

### Connection Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| appType | string | Required: 'owner' or 'staff' |
| locationId | string | Optional: Filter updates by location, 'all' for aggregated |
| staffId | string | Optional: Staff member ID (for staff app) |
| subscriptions | string | Comma-separated channels: 'sales', 'orders', 'kds', 'team', 'activity' |

### Example Connection

```javascript
const ws = new WebSocket(
  'wss://airarang.handsfree.tech/api/realtime/ws?' +
  'appType=owner&' +
  'locationId=all&' +
  'subscriptions=sales,orders,activity'
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Message Types

**From Server:**

```json
{
  "type": "connected",
  "clientId": "uuid",
  "timestamp": 1234567890
}
```

```json
{
  "type": "new-order",
  "channel": "kds",
  "data": { /* order object */ },
  "timestamp": 1234567890
}
```

```json
{
  "type": "sales-update",
  "channel": "sales",
  "data": {
    "totalSales": 45800,
    "orderCount": 142,
    "change": "+12.5%"
  },
  "timestamp": 1234567890
}
```

**From Client:**

```json
{
  "type": "subscribe",
  "channels": ["kds", "team"]
}
```

```json
{
  "type": "ping"
}
```

```json
{
  "type": "kds-action",
  "action": "mark-ready",
  "orderId": "order-uuid"
}
```

---

## Owner Mobile App API

### 1. Dashboard Stats

Get dashboard metrics for Owner app home screen.

**Endpoint:** `GET /api/owner/dashboard/stats`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| locationId | string | 'all' | Location ID or 'all' for aggregated stats |
| period | string | 'today' | Time period: 'today', 'week', 'month', 'year' |

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSales": 45800,
    "salesChange": "+12.5%",
    "orders": 142,
    "ordersChange": "+8.2%",
    "activeStaff": 12,
    "staffChange": "+2",
    "avgWaitTime": 12,
    "waitTimeChange": "-15%",
    "period": "today",
    "locationId": "all"
  }
}
```

### 2. Sales Chart Data

Get sales data for interactive charts.

**Endpoint:** `GET /api/owner/dashboard/sales-data`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| locationId | string | 'all' | Location ID or 'all' |
| period | string | 'day' | Chart period: 'day', 'week', 'month', 'year' |

**Response (Day):**

```json
{
  "success": true,
  "data": [
    { "label": "0:00", "value": 0 },
    { "label": "1:00", "value": 0 },
    ...
    { "label": "12:00", "value": 3200 },
    ...
    { "label": "23:00", "value": 150 }
  ]
}
```

**Response (Week):**

```json
{
  "success": true,
  "data": [
    { "label": "Mon", "value": 5400 },
    { "label": "Tue", "value": 6200 },
    { "label": "Wed", "value": 7100 },
    { "label": "Thu", "value": 6800 },
    { "label": "Fri", "value": 8900 },
    { "label": "Sat", "value": 12400 },
    { "label": "Sun", "value": 11200 }
  ]
}
```

**Response (Month):**

```json
{
  "success": true,
  "data": [
    { "label": "1", "value": 2100 },
    { "label": "2", "value": 2300 },
    ...
    { "label": "30", "value": 2800 }
  ]
}
```

**Response (Year):**

```json
{
  "success": true,
  "data": [
    { "label": "Jan", "value": 65000 },
    { "label": "Feb", "value": 72000 },
    ...
    { "label": "Dec", "value": 89000 }
  ]
}
```

### 3. Locations

Get all locations with stats.

**Endpoint:** `GET /api/owner/locations`

**Response:**

```json
{
  "success": true,
  "data": {
    "all": {
      "id": "all",
      "name": "All Locations",
      "count": "3 restaurants",
      "stats": {
        "sales": 83200,
        "orders": 298,
        "staff": 26
      }
    },
    "locations": [
      {
        "id": "loc-mg-road",
        "name": "MG Road",
        "address": "123 MG Road",
        "city": "Bangalore",
        "state": "Karnataka",
        "isActive": true,
        "stats": {
          "sales": 45800,
          "orders": 142,
          "staff": 12
        }
      },
      {
        "id": "loc-indiranagar",
        "name": "Indiranagar",
        "address": "456 12th Main",
        "city": "Bangalore",
        "state": "Karnataka",
        "isActive": true,
        "stats": {
          "sales": 28400,
          "orders": 98,
          "staff": 8
        }
      }
    ]
  }
}
```

### 4. Activity Feed

Get recent activity for the dashboard.

**Endpoint:** `GET /api/owner/activity`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| locationId | string | 'all' | Location filter |
| limit | number | 20 | Max activities to return |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "type": "order",
      "title": "New order received",
      "description": "Table 12 - ₹1,240",
      "time": "2 min ago"
    },
    {
      "type": "sales",
      "title": "Sales milestone reached",
      "description": "Crossed ₹80,000 today",
      "time": "15 min ago"
    },
    {
      "type": "inventory",
      "title": "Low stock alert",
      "description": "Paneer needs restock",
      "time": "1 hour ago"
    },
    {
      "type": "staff",
      "title": "Staff clocked in",
      "description": "Rajesh Kumar started shift",
      "time": "2 hours ago"
    }
  ]
}
```

---

## Staff Mobile App API

### 1. Clock In

Clock in staff member.

**Endpoint:** `POST /api/staff/attendance/clock-in`

**Request Body:**

```json
{
  "staffId": "staff-uuid",
  "locationId": "loc-mg-road",
  "deviceId": "device-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "clockInId": "clock-in-uuid",
    "clockInTime": "2026-02-04T10:30:00.000Z"
  }
}
```

### 2. Clock Out

Clock out staff member.

**Endpoint:** `POST /api/staff/attendance/clock-out`

**Request Body:**

```json
{
  "staffId": "staff-uuid",
  "locationId": "loc-mg-road"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "clockOutTime": "2026-02-04T18:45:00.000Z"
  }
}
```

### 3. Attendance Stats

Get attendance and performance stats for staff member.

**Endpoint:** `GET /api/staff/attendance/stats`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| staffId | string | Yes | Staff member ID |
| period | string | No | 'today', 'week', 'month' (default: 'today') |

**Response:**

```json
{
  "success": true,
  "data": {
    "clockState": {
      "isClockedIn": true,
      "clockInTime": "2026-02-04T10:30:00.000Z",
      "duration": "4h 32m"
    },
    "today": {
      "hoursWorked": "4h 32m",
      "tipsEarned": 350,
      "tablesServed": 12,
      "rating": 4.8
    },
    "weekly": {
      "totalHours": "36h 15m",
      "totalTips": 2450,
      "tablesServed": 89,
      "avgRating": 4.7
    }
  }
}
```

### 4. KDS Orders

Get active kitchen orders (Manager mode).

**Endpoint:** `GET /api/staff/kds/orders`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| locationId | string | Optional location filter |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "order-uuid",
      "orderNumber": "4523",
      "tableNumber": 8,
      "items": [
        { "name": "Butter Chicken", "quantity": 2 },
        { "name": "Paneer Tikka", "quantity": 1 },
        { "name": "Naan", "quantity": 3 }
      ],
      "status": "pending",
      "createdAt": "2026-02-04T10:12:00.000Z",
      "urgent": true,
      "locationId": "loc-mg-road"
    }
  ]
}
```

### 5. Mark Order Ready

Mark kitchen order as ready.

**Endpoint:** `POST /api/staff/kds/orders/:orderId/ready`

**Request Body:**

```json
{
  "locationId": "loc-mg-road"
}
```

**Response:**

```json
{
  "success": true
}
```

### 6. Report Order Delay

Report delay for an order.

**Endpoint:** `POST /api/staff/kds/orders/:orderId/delay`

**Request Body:**

```json
{
  "locationId": "loc-mg-road",
  "delayMinutes": 5,
  "reason": "High volume"
}
```

**Response:**

```json
{
  "success": true
}
```

### 7. Team Status

Get team member status (Manager mode).

**Endpoint:** `GET /api/staff/team/status`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| locationId | string | Optional location filter |

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "activeOrders": 18,
      "staffOnline": 12,
      "salesTotal": 45800,
      "avgPrepTime": 14
    },
    "team": [
      {
        "id": "staff-uuid",
        "name": "Rajesh Kumar",
        "role": "Waiter",
        "status": "Active",
        "tables": 4,
        "clockedIn": true
      },
      {
        "id": "staff-uuid-2",
        "name": "Priya Singh",
        "role": "Waiter",
        "status": "Active",
        "tables": 5,
        "clockedIn": true
      },
      {
        "id": "staff-uuid-3",
        "name": "Amit Patel",
        "role": "Chef",
        "status": "Active",
        "tables": 0,
        "clockedIn": true
      }
    ]
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid auth |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Integration Example

### Owner App - Dashboard with Real-time Updates

```typescript
import { fetch } from '@tauri-apps/plugin-http';

// Fetch initial dashboard stats
const response = await fetch(
  'https://airarang.handsfree.tech/api/owner/dashboard/stats?locationId=all&period=today',
  {
    headers: {
      'X-Tenant-Id': 'tenant-uuid',
      'Authorization': 'Bearer token'
    }
  }
);
const stats = await response.json();

// Connect WebSocket for real-time updates
const ws = new WebSocket(
  'wss://airarang.handsfree.tech/api/realtime/ws?appType=owner&locationId=all&subscriptions=sales,activity'
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'sales-update') {
    // Update dashboard stats in real-time
    updateDashboard(data.data);
  }

  if (data.type === 'sales-activity') {
    // Add to activity feed
    addActivity(data.data);
  }
};
```

### Staff App - KDS with Real-time Updates

```typescript
// Fetch initial KDS orders
const response = await fetch(
  'https://airarang.handsfree.tech/api/staff/kds/orders?locationId=loc-mg-road',
  {
    headers: {
      'X-Tenant-Id': 'tenant-uuid',
      'Authorization': 'Bearer token'
    }
  }
);
const orders = await response.json();

// Connect WebSocket for real-time order updates
const ws = new WebSocket(
  'wss://airarang.handsfree.tech/api/realtime/ws?appType=staff&locationId=loc-mg-road&subscriptions=kds,team'
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'new-order') {
    // Add new order to KDS
    addKDSOrder(data.data);
  }

  if (data.type === 'order-urgent') {
    // Mark order as urgent
    markOrderUrgent(data.data);
  }
};

// Mark order ready
const markReady = async (orderId: string) => {
  await fetch(
    `https://airarang.handsfree.tech/api/staff/kds/orders/${orderId}/ready`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'tenant-uuid',
        'Authorization': 'Bearer token'
      },
      body: JSON.stringify({ locationId: 'loc-mg-road' })
    }
  );
};
```

---

## Deployment

The mobile app APIs are deployed as part of the tenant-worker:

```bash
cd platform/workers/tenant-router/tenant-worker
wrangler deploy
```

The Realtime Coordinator Durable Object will be automatically deployed with the worker.

---

**Last Updated:** February 2026
