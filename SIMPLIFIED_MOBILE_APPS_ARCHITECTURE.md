# Simplified Mobile Apps Architecture
## Owner App & Staff App - Direct Cloudflare Integration

## Key Insight

**No shared packages needed!** Both apps are thin clients that communicate directly with Cloudflare Workers for all data operations.

---

## Architecture Overview

```
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│   Owner App      │  │   Staff App      │  │  Desktop/Tablet │
│   (Android)      │  │   (Android)      │  │  POS (Desktop)  │
│                  │  │  + Manager Mode  │  │  (UNCHANGED)    │
│   - Settings     │  │                  │  │                 │
│   - Reports      │  │  Staff:          │  │                 │
│   - Chain Mgmt   │  │  - Attendance    │  │                 │
│   - Plugins      │  │  - Payroll       │  │                 │
│                  │  │                  │  │                 │
│                  │  │  Manager:        │  │                 │
│                  │  │  - KDS View      │  │                 │
│                  │  │  - Order Mgmt    │  │                 │
│                  │  │  - Floor Plan    │  │                 │
└────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘
         │                     │                      │
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               │
                    HTTP/WebSocket/Cloudflare Tunnel
                               │
                               ▼
                   ┌───────────────────────┐
                   │  Cloudflare Workers   │
                   │  ───────────────────  │
                   │  tenant-router        │
                   │  domain-service       │
                   │  provisioning         │
                   │  plugin-registry      │
                   └───────────┬───────────┘
                               │
                   ┌───────────┼───────────┐
                   │           │           │
                   ▼           ▼           ▼
              ┌────────┐  ┌────────┐  ┌────────┐
              │   D1   │  │   KV   │  │   R2   │
              │Database│  │ Cache  │  │Storage │
              └────────┘  └────────┘  └────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ Durable Objects  │
         │ - OrderSync      │
         │ - KitchenSync    │
         │ - TenantSession  │
         └──────────────────┘
```

---

## Data Flow Strategy

### No Local SQLite, No Shared Packages

**Owner App**:
```typescript
// Direct API calls to Cloudflare Workers
const updateSettings = async (settings) => {
  const response = await fetch(
    'https://auth.handsfree.tech/api/tenant/settings',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    }
  );
  return response.json();
};

// Real-time updates via WebSocket to Durable Objects
const ws = new WebSocket('wss://auth.handsfree.tech/ws/tenant');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Update UI reactively
};
```

**Staff App**:
```typescript
// Staff mode - limited endpoints
const clockIn = async () => {
  await fetch('https://auth.handsfree.tech/api/attendance/clock-in', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
};

// Manager mode - operational endpoints
const getKitchenOrders = async () => {
  const response = await fetch(
    'https://auth.handsfree.tech/api/orders/kitchen',
    {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    }
  );
  return response.json();
};
```

### Cloudflare Tunnel for Local Restaurant Network

```
Restaurant WiFi Network
┌────────────────────────────────────────┐
│                                        │
│  ┌──────────┐      ┌──────────┐       │
│  │ Staff    │      │ Manager  │       │
│  │ Phone    │      │ Tablet   │       │
│  └────┬─────┘      └────┬─────┘       │
│       │                 │              │
│       │   Cloudflared   │              │
│       └────────┬────────┘              │
│                │                       │
│                ▼                       │
│         ┌──────────────┐               │
│         │ Local Router │               │
│         │ (Cloudflare  │               │
│         │  Tunnel)     │               │
│         └──────┬───────┘               │
└────────────────┼───────────────────────┘
                 │
                 │ Encrypted Tunnel
                 │
                 ▼
    ┌────────────────────────┐
    │  Cloudflare Edge       │
    │  (auth.handsfree.tech) │
    └────────────────────────┘
```

**Benefits**:
- Staff app works on restaurant WiFi (fast, local)
- Also works outside restaurant (internet)
- No VPN needed
- Automatic failover

---

## App Structure

### Owner App

```
apps/owner-mobile/
├── src/
│   ├── pages/
│   │   ├── HubPage.tsx              # Dashboard
│   │   ├── SettingsPage.tsx         # Restaurant settings
│   │   ├── ChainPage.tsx            # Multi-location
│   │   ├── ReportsPage.tsx          # Sales analytics
│   │   ├── PluginsPage.tsx          # Plugin management
│   │   ├── MenuPage.tsx             # Menu management
│   │   └── StaffRosterPage.tsx      # Staff management
│   ├── components/
│   │   ├── ui/                      # Local UI components (simple)
│   │   ├── SettingsCard.tsx
│   │   ├── SalesChart.tsx
│   │   └── PluginCard.tsx
│   ├── services/
│   │   └── api.ts                   # API client for Cloudflare Workers
│   ├── stores/
│   │   └── appStore.ts              # Local UI state only (Zustand)
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── src/
│       └── main.rs                  # Minimal Tauri app (no business logic)
├── package.json
└── vite.config.ts
```

**Key Points**:
- **No local database** - All data from Cloudflare
- **No shared packages** - Self-contained app
- **Minimal Tauri** - Just for Android packaging
- **Direct API calls** - No abstraction layers

---

### Staff App (with Manager Mode)

```
apps/staff-mobile/
├── src/
│   ├── pages/
│   │   ├── HubPage.tsx              # Dashboard (role-based)
│   │   │
│   │   ├── staff/                   # Staff Mode Pages
│   │   │   ├── AttendancePage.tsx   # Clock in/out
│   │   │   ├── PayrollPage.tsx      # View payroll
│   │   │   ├── AdvancesPage.tsx     # Request advances
│   │   │   └── SchedulePage.tsx     # View schedule
│   │   │
│   │   └── manager/                 # Manager Mode Pages
│   │       ├── KDSPage.tsx          # Kitchen Display
│   │       ├── OrdersPage.tsx       # Order management
│   │       ├── FloorPlanPage.tsx    # Table management
│   │       └── TeamPage.tsx         # Staff oversight
│   ├── components/
│   │   ├── ui/                      # Local UI components
│   │   ├── ClockInWidget.tsx
│   │   ├── KitchenOrderCard.tsx
│   │   └── RoleSwitcher.tsx         # Toggle Staff/Manager mode
│   ├── services/
│   │   └── api.ts                   # API client
│   ├── stores/
│   │   └── appStore.ts              # UI state + user role
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── tauri.conf.json
│   └── src/main.rs
├── package.json
└── vite.config.ts
```

---

## Role-Based Access Control

### Staff App Roles

```typescript
// src/stores/appStore.ts
interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
  tenantId: string;
  permissions: string[];
}

interface AppStore {
  user: User | null;
  currentMode: 'staff' | 'manager';

  // Switch between staff and manager mode
  switchMode: (mode: 'staff' | 'manager') => void;

  // Check if user can access manager features
  canAccessManagerMode: () => boolean;
}

const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  currentMode: 'staff',

  switchMode: (mode) => {
    const { user } = get();
    if (mode === 'manager' && !user?.permissions.includes('manager_access')) {
      toast.error('You do not have manager permissions');
      return;
    }
    set({ currentMode: mode });
  },

  canAccessManagerMode: () => {
    const { user } = get();
    return user?.permissions.includes('manager_access') ||
           user?.role === 'manager' ||
           user?.role === 'owner';
  }
}));
```

### UI - Role Switcher

```typescript
// src/components/RoleSwitcher.tsx
import { useAppStore } from '@/stores/appStore';

export function RoleSwitcher() {
  const { currentMode, switchMode, canAccessManagerMode } = useAppStore();

  if (!canAccessManagerMode()) {
    return null; // Don't show switcher for regular staff
  }

  return (
    <div className="role-switcher">
      <button
        onClick={() => switchMode('staff')}
        className={currentMode === 'staff' ? 'active' : ''}
      >
        Staff Mode
      </button>
      <button
        onClick={() => switchMode('manager')}
        className={currentMode === 'manager' ? 'active' : ''}
      >
        Manager Mode
      </button>
    </div>
  );
}
```

### Routing Based on Mode

```typescript
// src/App.tsx
import { useAppStore } from '@/stores/appStore';

function App() {
  const { currentMode } = useAppStore();

  return (
    <BrowserRouter>
      <RoleSwitcher />

      <Routes>
        {/* Common Routes */}
        <Route path="/" element={<HubPage />} />

        {/* Staff Mode Routes */}
        {currentMode === 'staff' && (
          <>
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/advances" element={<AdvancesPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
          </>
        )}

        {/* Manager Mode Routes */}
        {currentMode === 'manager' && (
          <>
            <Route path="/kds" element={<KDSPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/floor-plan" element={<FloorPlanPage />} />
            <Route path="/team" element={<TeamPage />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## API Service Layer

### Owner App API Client

```typescript
// apps/owner-mobile/src/services/api.ts
const API_BASE = 'https://auth.handsfree.tech/api';

class OwnerAPI {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Settings
  async getRestaurantSettings() {
    return this.request('/tenant/settings');
  }

  async updateRestaurantSettings(settings: any) {
    return this.request('/tenant/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // Chain Management
  async getLocations() {
    return this.request('/chain/locations');
  }

  // Reports
  async getSalesReport(startDate: string, endDate: string) {
    return this.request(`/reports/sales?start=${startDate}&end=${endDate}`);
  }

  // Plugins
  async getInstalledPlugins() {
    return this.request('/plugins/installed');
  }

  async installPlugin(pluginId: string) {
    return this.request('/plugins/install', {
      method: 'POST',
      body: JSON.stringify({ pluginId })
    });
  }
}

export const api = new OwnerAPI();
```

### Staff App API Client

```typescript
// apps/staff-mobile/src/services/api.ts
const API_BASE = 'https://auth.handsfree.tech/api';

class StaffAPI {
  private token: string | null = null;

  // Authentication
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    this.token = data.token;
    return data.user;
  }

  // Staff Features
  async clockIn() {
    return this.request('/attendance/clock-in', { method: 'POST' });
  }

  async clockOut() {
    return this.request('/attendance/clock-out', { method: 'POST' });
  }

  async getPayroll() {
    return this.request('/payroll/my-payroll');
  }

  async requestAdvance(amount: number, reason: string) {
    return this.request('/advances/request', {
      method: 'POST',
      body: JSON.stringify({ amount, reason })
    });
  }

  // Manager Features
  async getKitchenOrders() {
    return this.request('/orders/kitchen');
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async getFloorPlan() {
    return this.request('/floor-plan');
  }

  async getTeamAttendance() {
    return this.request('/attendance/team');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }
}

export const api = new StaffAPI();
```

---

## Real-Time Updates (WebSocket)

### Owner App - Real-time Settings Sync

```typescript
// apps/owner-mobile/src/services/websocket.ts
class OwnerWebSocket {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(token: string) {
    this.ws = new WebSocket(`wss://auth.handsfree.tech/ws/owner?token=${token}`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const handlers = this.listeners.get(message.type) || [];
      handlers.forEach(handler => handler(message.data));
    };
  }

  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  disconnect() {
    this.ws?.close();
  }
}

export const ownerWS = new OwnerWebSocket();

// Usage in component:
ownerWS.on('settings_updated', (settings) => {
  // Update UI when another owner changes settings
  console.log('Settings updated by another owner:', settings);
});
```

### Staff App - Real-time KDS Updates (Manager Mode)

```typescript
// apps/staff-mobile/src/services/websocket.ts
class StaffWebSocket {
  private ws: WebSocket | null = null;

  connectKDS(token: string) {
    this.ws = new WebSocket(`wss://auth.handsfree.tech/ws/kds?token=${token}`);

    this.ws.onmessage = (event) => {
      const order = JSON.parse(event.data);
      // New order appears in KDS
      console.log('New order:', order);
    };
  }
}

export const staffWS = new StaffWebSocket();
```

---

## Offline Support (Optional - Minimal)

If you want minimal offline support:

```typescript
// Use IndexedDB for caching API responses (optional)
import { openDB } from 'idb';

class CachedAPI {
  private db;

  async init() {
    this.db = await openDB('handsfree-cache', 1, {
      upgrade(db) {
        db.createObjectStore('api-cache');
      }
    });
  }

  async cachedRequest(key: string, fetcher: () => Promise<any>) {
    // Try cache first
    const cached = await this.db.get('api-cache', key);
    if (cached) return cached;

    // Fetch from API
    const data = await fetcher();

    // Cache for next time
    await this.db.put('api-cache', data, key);

    return data;
  }
}
```

**But honestly, for these apps, you probably don't need offline support** since all operations require server connectivity anyway.

---

## Migration Strategy (Simplified)

### Phase 1: Owner App (Week 1)
```bash
# Create new React app
cd apps/owner-mobile
npm create vite@latest . --template react-ts

# Add Tauri
bun add @tauri-apps/api @tauri-apps/cli
cargo tauri init
cargo tauri android init

# Build UI that calls Cloudflare Workers
# No shared packages, no local DB, just API calls

# Test
cargo tauri android dev
```

### Phase 2: Staff App (Week 2)
```bash
# Same process as Owner app
cd apps/staff-mobile

# Add role switcher for Manager mode
# Build staff UI + manager UI

# Test
cargo tauri android dev
```

### Phase 3: Deploy (Week 3)
```bash
# Build APKs
cargo tauri android build --apk

# Sign and distribute
```

---

## Benefits of This Approach

✅ **Simpler** - No shared packages, no complex dependencies
✅ **Smaller APKs** - Only UI code, no business logic
✅ **Easier to maintain** - Each app is self-contained
✅ **Faster builds** - No workspace dependencies
✅ **Better security** - Business logic stays in Cloudflare Workers
✅ **Scalable** - Workers handle all the heavy lifting
✅ **Real-time** - WebSocket to Durable Objects for live updates
✅ **Manager Mode** - Staff app can switch modes for operational access

---

## Next Steps

Want to start building? I can help with:

1. **Create Owner App scaffold** - Minimal React + Tauri + API calls
2. **Create Staff App scaffold** - With role switcher for Manager mode
3. **Set up API endpoints in Cloudflare Workers** - If not already done
4. **Build real-time WebSocket integration** - For live updates

Which would you like to tackle first?
