# Dynamic Feature Activation System

## Overview

Features are activated dynamically based on:
1. **User Role**: Manager, Captain, Service Staff, Kitchen Staff, Cleaning Staff
2. **Device Mode**: POS Terminal, KDS, BDS, LAN Server, Staff Mobile
3. **Deployment Type**: Desktop, Android, Cloud Backend

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Feature Activation Engine                  │
│                                                         │
│  Inputs:                                               │
│  ├─ User Role (from authentication)                   │
│  ├─ Device Mode (from config/detection)               │
│  └─ Platform (desktop/android)                        │
│                                                         │
│  Processing:                                           │
│  ├─ Load feature matrix                               │
│  ├─ Check permissions                                 │
│  └─ Build UI dynamically                              │
│                                                         │
│  Outputs:                                              │
│  ├─ Available routes                                  │
│  ├─ Visible menu items                                │
│  ├─ Enabled components                                │
│  └─ Active backend commands                           │
└─────────────────────────────────────────────────────────┘
```

---

## Device Modes

### 1. POS Terminal (Full System)
**Purpose**: Complete restaurant management
**Users**: Owners, Managers, Service Staff
**Features**:
- ✅ Point of Sale
- ✅ Table Management
- ✅ Order Taking
- ✅ Payment Processing
- ✅ Customer Management
- ✅ Kitchen Display (view)
- ✅ Reports & Analytics
- ✅ Settings & Configuration
- ✅ Staff Management
- ✅ Inventory

**UI**: Desktop app with full navigation

### 2. KDS (Kitchen Display System)
**Purpose**: Kitchen order management only
**Users**: Kitchen Staff
**Features**:
- ✅ Kitchen Display System
- ✅ View incoming orders
- ✅ Mark items as prepared
- ✅ Order queue management
- ✅ Timer and priorities
- ❌ POS
- ❌ Settings (limited)
- ❌ Reports

**UI**: Desktop app, KDS-only interface, full screen

### 3. BDS (Bar Display System)
**Purpose**: Bar order management only
**Users**: Bar Staff
**Features**:
- ✅ Bar Display System
- ✅ View drink orders
- ✅ Mark drinks as prepared
- ✅ Recipe viewer
- ✅ Inventory tracking
- ❌ POS
- ❌ Food orders
- ❌ Settings (limited)

**UI**: Desktop app, BDS-only interface

### 4. LAN Server (Backend Only)
**Purpose**: Centralized data server
**Users**: System Admin
**Features**:
- ✅ Database server
- ✅ API server
- ✅ WebSocket server
- ✅ Backup & sync
- ❌ No UI (headless)
- ✅ Admin panel (optional)

**UI**: No UI or minimal admin dashboard

### 5. Staff Mobile App
**Purpose**: Personal staff access
**Users**: All Staff Roles
**Features**:
- ✅ View salary & payslips
- ✅ View schedule
- ✅ Clock in/out
- ✅ Request leave
- ✅ Attendance history
- ✅ Role-specific: Orders (service), Tasks (cleaning), etc.
- ❌ Settings
- ❌ Reports (except captain)

**UI**: Android app, mobile-optimized

---

## Role-Based Feature Matrix

| Feature | Owner | Manager | Captain | Service | Kitchen | Cleaning | Bar |
|---------|-------|---------|---------|---------|---------|----------|-----|
| **POS Module** |
| Take Orders | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Process Payments | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Apply Discounts | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Void Items | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| **Kitchen** |
| View Orders | ✅ | ✅ | 👁️ | 👁️ | ✅ | ❌ | ❌ |
| Mark Prepared | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Bar** |
| View Bar Orders | ✅ | ✅ | 👁️ | 👁️ | ❌ | ❌ | ✅ |
| Mark Drinks Ready | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Management** |
| Staff Management | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Menu Management | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | 📊 | ❌ | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| **Personal** |
| View Own Salary | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Own Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clock In/Out | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request Leave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Role-Specific** |
| Assign Tasks | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Team Roster | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cleaning Tasks | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

**Legend**:
- ✅ Full access
- 👁️ View only
- 📊 Summary/limited
- ⚠️ Limited/approval required
- ❌ No access

---

## Implementation

### 1. Device Mode Configuration

**Option A: Environment Variable**
```bash
# .env or runtime config
DEVICE_MODE=pos            # Full POS terminal
DEVICE_MODE=kds            # Kitchen Display only
DEVICE_MODE=bds            # Bar Display only
DEVICE_MODE=server         # Headless server
DEVICE_MODE=mobile         # Staff mobile app
```

**Option B: Config File**
```json
// app.config.json
{
  "deviceMode": "pos",
  "features": {
    "pos": true,
    "kitchen": true,
    "bar": true,
    "reports": true,
    "settings": true
  },
  "lockedMode": false,  // If true, can't change mode
  "autoDetect": true     // Auto-detect based on hardware
}
```

**Option C: First-Time Setup Wizard**
```tsx
// On first launch, show setup wizard
<SetupWizard>
  <Step1_WelcomeScreen />
  <Step2_ChooseDeviceMode>
    <Option value="pos" icon={Monitor}>
      Full POS Terminal
      <Description>Complete restaurant management system</Description>
    </Option>
    <Option value="kds" icon={Chef}>
      Kitchen Display
      <Description>Kitchen order management only</Description>
    </Option>
    <Option value="bds" icon={Wine}>
      Bar Display
      <Description>Bar order management only</Description>
    </Option>
  </Step2_ChooseDeviceMode>
  <Step3_Configuration />
  <Step4_Complete />
</SetupWizard>
```

### 2. Feature Flag System

**Create Feature Service**

```typescript
// src/services/featureFlags.ts

export enum DeviceMode {
  POS = 'pos',
  KDS = 'kds',
  BDS = 'bds',
  SERVER = 'server',
  MOBILE = 'mobile',
}

export enum UserRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  CAPTAIN = 'captain',
  SERVICE = 'service',
  KITCHEN = 'kitchen',
  CLEANING = 'cleaning',
  BAR = 'bar',
}

interface FeatureContext {
  deviceMode: DeviceMode;
  userRole: UserRole;
  platform: 'desktop' | 'android' | 'web';
}

class FeatureService {
  private context: FeatureContext;

  constructor() {
    this.context = this.loadContext();
  }

  loadContext(): FeatureContext {
    const deviceMode = this.getDeviceMode();
    const userRole = this.getUserRole();
    const platform = this.getPlatform();

    return { deviceMode, userRole, platform };
  }

  getDeviceMode(): DeviceMode {
    // Priority: Config file > Local storage > Environment variable
    const storedMode = localStorage.getItem('deviceMode');
    if (storedMode) return storedMode as DeviceMode;

    const envMode = import.meta.env.VITE_DEVICE_MODE;
    if (envMode) return envMode as DeviceMode;

    // Default
    return DeviceMode.POS;
  }

  getUserRole(): UserRole {
    const { user } = useAuthStore.getState();
    return user?.role as UserRole || UserRole.SERVICE;
  }

  getPlatform(): 'desktop' | 'android' | 'web' {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return isAndroid() ? 'android' : 'desktop';
    }
    return 'web';
  }

  // Check if feature is enabled
  isEnabled(feature: string): boolean {
    const { deviceMode, userRole, platform } = this.context;

    // Feature matrix
    const matrix: Record<string, (ctx: FeatureContext) => boolean> = {
      // POS Features
      'pos.takeOrders': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager', 'captain', 'service'].includes(ctx.userRole),

      'pos.processPayments': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager', 'captain', 'service'].includes(ctx.userRole),

      'pos.applyDiscounts': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager', 'captain'].includes(ctx.userRole),

      // Kitchen Features
      'kitchen.viewOrders': (ctx) =>
        [DeviceMode.POS, DeviceMode.KDS].includes(ctx.deviceMode) &&
        ['owner', 'manager', 'kitchen'].includes(ctx.userRole),

      'kitchen.markPrepared': (ctx) =>
        [DeviceMode.KDS, DeviceMode.POS].includes(ctx.deviceMode) &&
        ['owner', 'manager', 'kitchen'].includes(ctx.userRole),

      // Bar Features
      'bar.viewOrders': (ctx) =>
        [DeviceMode.POS, DeviceMode.BDS].includes(ctx.deviceMode) &&
        ['owner', 'manager', 'bar'].includes(ctx.userRole),

      'bar.markReady': (ctx) =>
        [DeviceMode.BDS, DeviceMode.POS].includes(ctx.deviceMode) &&
        ['owner', 'manager', 'bar'].includes(ctx.userRole),

      // Management Features
      'management.staffManagement': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager'].includes(ctx.userRole),

      'management.reports': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager', 'captain'].includes(ctx.userRole),

      'management.settings': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager'].includes(ctx.userRole),

      // Personal Features (always available)
      'personal.viewSalary': () => true,
      'personal.viewSchedule': () => true,
      'personal.clockIn': () => true,
      'personal.requestLeave': () => true,

      // Role-Specific
      'captain.assignTasks': (ctx) =>
        ctx.userRole === UserRole.CAPTAIN,

      'captain.viewTeamRoster': (ctx) =>
        ['owner', 'manager', 'captain'].includes(ctx.userRole),

      'cleaning.tasks': (ctx) =>
        ctx.userRole === UserRole.CLEANING,
    };

    const checker = matrix[feature];
    return checker ? checker(this.context) : false;
  }

  // Check if route is accessible
  canAccessRoute(route: string): boolean {
    const { deviceMode, userRole } = this.context;

    // Route access matrix
    const routeMatrix: Record<string, (ctx: FeatureContext) => boolean> = {
      '/hub': (ctx) => ctx.deviceMode === DeviceMode.POS,
      '/pos': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager', 'captain', 'service'].includes(ctx.userRole),
      '/kitchen': (ctx) =>
        [DeviceMode.KDS, DeviceMode.POS].includes(ctx.deviceMode),
      '/bar': (ctx) =>
        [DeviceMode.BDS, DeviceMode.POS].includes(ctx.deviceMode),
      '/settings': (ctx) =>
        ctx.deviceMode === DeviceMode.POS &&
        ['owner', 'manager'].includes(ctx.userRole),
      '/staff-mobile/*': (ctx) =>
        ctx.platform === 'android' || ctx.deviceMode === DeviceMode.MOBILE,
    };

    // Check exact match
    if (routeMatrix[route]) {
      return routeMatrix[route](this.context);
    }

    // Check wildcard match
    for (const [pattern, checker] of Object.entries(routeMatrix)) {
      if (pattern.endsWith('/*') && route.startsWith(pattern.slice(0, -2))) {
        return checker(this.context);
      }
    }

    return true; // Default allow
  }

  // Get available routes for current context
  getAvailableRoutes(): string[] {
    const allRoutes = [
      '/hub',
      '/pos',
      '/kitchen',
      '/bar',
      '/service',
      '/sales-report',
      '/inventory',
      '/settings',
      '/staff-mobile/home',
      '/staff-mobile/salary',
      '/staff-mobile/schedule',
    ];

    return allRoutes.filter(route => this.canAccessRoute(route));
  }
}

// Singleton instance
export const featureService = new FeatureService();

// React hook
export function useFeature(feature: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(featureService.isEnabled(feature));
  }, [feature]);

  return enabled;
}

// Component guard
export function FeatureGate({
  feature,
  children,
  fallback = null
}: {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const enabled = useFeature(feature);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
```

### 3. Use in Components

**Route Protection**:
```tsx
// src/App.tsx

function App() {
  const availableRoutes = featureService.getAvailableRoutes();
  const deviceMode = featureService.getDeviceMode();

  // KDS-only mode: Show only kitchen
  if (deviceMode === DeviceMode.KDS) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<KitchenDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    );
  }

  // BDS-only mode: Show only bar
  if (deviceMode === DeviceMode.BDS) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<BarDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    );
  }

  // Mobile mode: Show only mobile routes
  if (deviceMode === DeviceMode.MOBILE) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<MobileLayout />}>
            <Route index element={<Navigate to="/home" />} />
            <Route path="home" element={<StaffMobileHome />} />
            <Route path="salary" element={<StaffMobileSalary />} />
            <Route path="schedule" element={<StaffMobileSchedule />} />
          </Route>
        </Routes>
      </HashRouter>
    );
  }

  // Full POS mode: Show all available routes
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {availableRoutes.includes('/hub') && (
          <Route path="/hub" element={<HubPage />} />
        )}

        {availableRoutes.includes('/pos') && (
          <Route path="/pos" element={<POSDashboard />} />
        )}

        {availableRoutes.includes('/kitchen') && (
          <Route path="/kitchen" element={<KitchenDashboard />} />
        )}

        {availableRoutes.includes('/bar') && (
          <Route path="/bar" element={<BarDashboard />} />
        )}

        {availableRoutes.includes('/settings') && (
          <Route path="/settings" element={<SettingsPage />} />
        )}

        <Route path="/" element={<DefaultRedirect />} />
      </Routes>
    </HashRouter>
  );
}
```

**Component-Level Protection**:
```tsx
// Hide/show features within components

export function POSDashboard() {
  return (
    <div>
      <h1>Point of Sale</h1>

      {/* Always visible */}
      <OrderList />

      {/* Only if discount feature enabled */}
      <FeatureGate feature="pos.applyDiscounts">
        <DiscountButton />
      </FeatureGate>

      {/* Only if void feature enabled */}
      <FeatureGate feature="pos.voidItems">
        <VoidButton />
      </FeatureGate>

      {/* Custom logic */}
      {featureService.isEnabled('pos.processPayments') && (
        <PaymentModal />
      )}
    </div>
  );
}
```

**Navigation Menu**:
```tsx
// src/components/Navigation.tsx

export function Navigation() {
  const canAccessPOS = useFeature('pos.takeOrders');
  const canAccessKitchen = useFeature('kitchen.viewOrders');
  const canAccessBar = useFeature('bar.viewOrders');
  const canAccessReports = useFeature('management.reports');
  const canAccessSettings = useFeature('management.settings');

  return (
    <nav>
      {canAccessPOS && (
        <NavLink to="/pos">Point of Sale</NavLink>
      )}

      {canAccessKitchen && (
        <NavLink to="/kitchen">Kitchen</NavLink>
      )}

      {canAccessBar && (
        <NavLink to="/bar">Bar</NavLink>
      )}

      {canAccessReports && (
        <NavLink to="/sales-report">Reports</NavLink>
      )}

      {canAccessSettings && (
        <NavLink to="/settings">Settings</NavLink>
      )}
    </nav>
  );
}
```

### 4. Backend Command Protection

**Rust Side**:
```rust
// src-tauri/src/commands/guards.rs

use tauri::State;

pub struct UserContext {
    pub user_id: String,
    pub role: String,
    pub device_mode: String,
}

#[tauri::command]
pub async fn create_order(
    user_context: State<'_, UserContext>,
    order_data: OrderData,
) -> Result<Order, String> {
    // Check if user can create orders
    if !can_create_orders(&user_context) {
        return Err("Unauthorized: Cannot create orders".to_string());
    }

    // Proceed with order creation
    Ok(create_order_internal(order_data).await?)
}

fn can_create_orders(ctx: &UserContext) -> bool {
    matches!(
        ctx.role.as_str(),
        "owner" | "manager" | "captain" | "service"
    ) && ctx.device_mode == "pos"
}

#[tauri::command]
pub async fn manage_staff(
    user_context: State<'_, UserContext>,
    action: StaffAction,
) -> Result<(), String> {
    // Only owners and managers can manage staff
    if !matches!(ctx.role.as_str(), "owner" | "manager") {
        return Err("Unauthorized: Staff management restricted".to_string());
    }

    Ok(handle_staff_action(action).await?)
}
```

---

## Configuration Examples

### Example 1: Full POS Terminal

```json
// app.config.json
{
  "deviceMode": "pos",
  "deviceName": "POS Terminal 1",
  "features": {
    "pos": true,
    "kitchen": true,
    "bar": true,
    "reports": true,
    "settings": true,
    "inventory": true,
    "staff": true
  },
  "lockedMode": false,
  "kioskoMode": false
}
```

**Result**: Full-featured POS with all modules

---

### Example 2: Kitchen Display Only

```json
// app.config.json
{
  "deviceMode": "kds",
  "deviceName": "Kitchen Display 1",
  "features": {
    "pos": false,
    "kitchen": true,
    "bar": false,
    "reports": false,
    "settings": false
  },
  "lockedMode": true,   // Can't change mode
  "kioskMode": true,    // Full screen, no exit
  "autoLogin": {
    "enabled": true,
    "role": "kitchen"
  }
}
```

**Result**:
- Only shows Kitchen Display System
- Full screen, can't navigate away
- Auto-login as kitchen staff
- No access to other features

---

### Example 3: Bar Display Only

```json
// app.config.json
{
  "deviceMode": "bds",
  "deviceName": "Bar Display 1",
  "features": {
    "pos": false,
    "kitchen": false,
    "bar": true,
    "reports": false,
    "settings": false
  },
  "lockedMode": true,
  "kioskMode": true,
  "autoLogin": {
    "enabled": true,
    "role": "bar"
  }
}
```

**Result**:
- Only shows Bar Display System
- Locked to bar view
- Auto-login as bar staff

---

### Example 4: Staff Mobile App

```json
// app.config.json (Android)
{
  "deviceMode": "mobile",
  "platform": "android",
  "features": {
    "pos": false,
    "kitchen": false,
    "bar": false,
    "reports": false,
    "settings": false,
    "personal": true,
    "roleSpecific": true
  }
}
```

**Result**:
- Shows mobile UI only
- Personal features (salary, schedule, attendance)
- Role-specific features based on login

---

## Runtime Device Mode Switching

Allow admins to change device mode:

```tsx
// src/pages/admin/DeviceModeSettings.tsx

export function DeviceModeSettings() {
  const [currentMode, setCurrentMode] = useState(featureService.getDeviceMode());
  const [isLocked, setIsLocked] = useState(false);

  const handleModeChange = async (newMode: DeviceMode) => {
    if (isLocked) {
      alert('Device mode is locked. Contact administrator.');
      return;
    }

    // Confirm
    if (!confirm(`Switch to ${newMode} mode? App will restart.`)) {
      return;
    }

    // Save to config
    await invoke('set_device_mode', { mode: newMode });
    localStorage.setItem('deviceMode', newMode);

    // Restart app
    window.location.reload();
  };

  return (
    <div>
      <h2>Device Mode</h2>
      <p>Current Mode: <strong>{currentMode}</strong></p>

      <div className="mode-options">
        <ModeOption
          mode={DeviceMode.POS}
          title="Full POS Terminal"
          description="Complete restaurant management"
          icon={Monitor}
          active={currentMode === DeviceMode.POS}
          onClick={() => handleModeChange(DeviceMode.POS)}
        />

        <ModeOption
          mode={DeviceMode.KDS}
          title="Kitchen Display"
          description="Kitchen orders only"
          icon={ChefHat}
          active={currentMode === DeviceMode.KDS}
          onClick={() => handleModeChange(DeviceMode.KDS)}
        />

        <ModeOption
          mode={DeviceMode.BDS}
          title="Bar Display"
          description="Bar orders only"
          icon={Wine}
          active={currentMode === DeviceMode.BDS}
          onClick={() => handleModeChange(DeviceMode.BDS)}
        />
      </div>

      <label>
        <input
          type="checkbox"
          checked={isLocked}
          onChange={(e) => setIsLocked(e.target.checked)}
        />
        Lock device mode (requires admin password to change)
      </label>
    </div>
  );
}
```

---

## Build-Time Feature Activation

For even smaller binaries, exclude features at build time:

```toml
# src-tauri/Cargo.toml

[features]
default = ["pos", "kitchen", "bar", "reports"]
pos = []
kitchen = []
bar = []
reports = []
settings = []
inventory = []

# Build profiles
[profile.kds]
inherits = "release"
strip = true
features = ["kitchen"]

[profile.bds]
inherits = "release"
strip = true
features = ["bar"]
```

Build commands:
```bash
# Full build
bun tauri build

# KDS only
bun tauri build --profile kds

# BDS only
bun tauri build --profile bds
```

---

## Summary

**Dynamic Feature Activation Based On**:

1. **User Role** → What they can do
   - Owner: Everything
   - Manager: Everything except sensitive owner actions
   - Captain: Team management + service features
   - Service: POS + orders
   - Kitchen: Kitchen display only
   - Cleaning: Cleaning tasks only
   - Bar: Bar display only

2. **Device Mode** → What's available
   - POS: Full system
   - KDS: Kitchen only
   - BDS: Bar only
   - Mobile: Staff personal features
   - Server: No UI (headless)

3. **Platform** → How it's accessed
   - Desktop: Full UI
   - Android: Mobile UI
   - Web: Browser UI (optional)

**Benefits**:
- ✅ One codebase, many configurations
- ✅ Same app serves multiple purposes
- ✅ Easy to deploy (one binary per platform)
- ✅ Secure (backend validates permissions)
- ✅ Flexible (runtime or build-time activation)

**Example Use Cases**:
```bash
# Restaurant with 5 devices from same codebase:
1. Manager Desktop → Full POS (deviceMode: pos, role: manager)
2. Service Tablet → POS only (deviceMode: pos, role: service)
3. Kitchen Screen → KDS only (deviceMode: kds, role: kitchen)
4. Bar Screen → BDS only (deviceMode: bds, role: bar)
5. Staff Phones → Mobile app (platform: android, various roles)
```

All from **one codebase**! 🎉
