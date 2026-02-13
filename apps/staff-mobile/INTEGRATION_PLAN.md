# Staff Mobile App Integration Plan

## Overview

Integrate the standalone staff-mobile app with the main HandsFree POS system to share database, attendance tracking, and payroll data.

## Current Status

### Staff Mobile App (apps/staff-mobile/)
- ✅ **UI Complete** - Staff and Manager modes
- ✅ **Basic Store** - Zustand with hardcoded mock data
- ❌ **No Database** - Uses mock data only
- ❌ **No API Integration** - Standalone app
- ❌ **No Attendance Sync** - Clock in/out doesn't persist
- ❌ **No Payroll Integration** - Can't view real payroll data

### Main POS App (src/)
- ✅ **Full Database Schema** - SQLite with all tables
- ✅ **Attendance Store** - Complete implementation
- ✅ **Payroll Store** - Complete implementation
- ✅ **WiFi Auto-Attendance** - Working
- ✅ **Network Access Control** - Working

## Integration Architecture

### Option 1: Shared Database (Recommended)
```
┌─────────────────────────────────────┐
│       Main POS App (Desktop)        │
│                                     │
│  ┌─────────────────────────────┐  │
│  │   SQLite Database           │  │
│  │   - attendance_records      │  │
│  │   - staff_salary            │  │
│  │   - staff_advances          │  │
│  │   - staff_payslips          │  │
│  └──────────┬──────────────────┘  │
└─────────────┼───────────────────────┘
              │
              │ Shared Database File
              │
┌─────────────┼───────────────────────┐
│  ┌──────────▼──────────────────┐  │
│  │   SQLite Database           │  │
│  │   (Same file, read-only     │  │
│  │    or read-write via API)   │  │
│  └─────────────────────────────┘  │
│                                     │
│    Staff Mobile App (Android)      │
└─────────────────────────────────────┘
```

### Option 2: API-Based (For Remote Access)
```
┌─────────────────────────────────────┐
│       Main POS App (Desktop)        │
│                                     │
│  ┌─────────────────────────────┐  │
│  │   SQLite Database           │  │
│  │   - attendance_records      │  │
│  │   - staff_salary            │  │
│  └─────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐  │
│  │   REST API Server           │  │
│  │   - /api/attendance          │  │
│  │   - /api/payroll             │  │
│  │   - /api/staff               │  │
│  └──────────┬──────────────────┘  │
└─────────────┼───────────────────────┘
              │
              │ HTTP/HTTPS
              │
┌─────────────┼───────────────────────┐
│  ┌──────────▼──────────────────┐  │
│  │   HTTP Client               │  │
│  │   (Zustand + API calls)     │  │
│  └─────────────────────────────┘  │
│                                     │
│    Staff Mobile App (Android)      │
└─────────────────────────────────────┘
```

## Integration Steps

### Phase 1: Database Integration (Local Network)

#### 1. Add Tauri SQL Plugin
**File:** `apps/staff-mobile/package.json`

```json
{
  "dependencies": {
    "@tauri-apps/plugin-sql": "^2", // ADD THIS
    // ... existing dependencies
  }
}
```

#### 2. Copy Main App Stores
Copy these stores from main app to staff-mobile:

- `src/stores/attendanceStore.ts` → `apps/staff-mobile/src/stores/attendanceStore.ts`
- `src/stores/payrollStore.ts` → `apps/staff-mobile/src/stores/payrollStore.ts`
- `src/stores/staffStore.ts` → `apps/staff-mobile/src/stores/staffStore.ts` (replace existing)

#### 3. Update Staff Mobile StaffStore
**File:** `apps/staff-mobile/src/stores/staffStore.ts`

Replace mock store with real implementation:

```typescript
import { create } from 'zustand';
import { useAttendanceStore } from './attendanceStore';

export type StaffMode = 'staff' | 'manager';

interface StaffState {
  currentMode: StaffMode;
  currentStaffId: string | null;
  tenantId: string | null;

  // Actions
  setMode: (mode: StaffMode) => void;
  setCurrentStaff: (staffId: string, tenantId: string) => void;

  // Attendance actions (delegate to attendanceStore)
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;

  // Computed state
  getClock State: () => {
    isClockedIn: boolean;
    clockInTime: Date | null;
    duration: string;
  };
  getTodayStats: () => {
    hoursWorked: string;
    tipsEarned: number;
    tablesServed: number;
    rating: number;
  };
}

export const useStaffStore = create<StaffState>((set, get) => ({
  currentMode: 'staff',
  currentStaffId: null,
  tenantId: null,

  setMode: (mode) => set({ currentMode: mode }),

  setCurrentStaff: (staffId, tenantId) => set({
    currentStaffId: staffId,
    tenantId
  }),

  clockIn: async () => {
    const state = get();
    if (!state.currentStaffId || !state.tenantId) {
      throw new Error('Staff not logged in');
    }

    await useAttendanceStore.getState().clockIn(
      state.currentStaffId,
      state.tenantId,
      { method: 'manual' }
    );
  },

  clockOut: async () => {
    const state = get();
    const activeRecord = useAttendanceStore.getState().getActiveRecordForStaff(
      state.currentStaffId!
    );

    if (activeRecord) {
      await useAttendanceStore.getState().clockOut(activeRecord.id);
    }
  },

  getClockState: () => {
    const state = get();
    const activeRecord = useAttendanceStore.getState().getActiveRecordForStaff(
      state.currentStaffId!
    );

    if (!activeRecord) {
      return {
        isClockedIn: false,
        clockInTime: null,
        duration: '0h 0m'
      };
    }

    const clockInTime = new Date(activeRecord.clockInAt);
    const now = new Date();
    const diff = now.getTime() - clockInTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return {
      isClockedIn: true,
      clockInTime,
      duration: `${hours}h ${minutes}m`
    };
  },

  getTodayStats: () => {
    // TODO: Calculate from attendance_records
    const state = get();
    const todayRecords = useAttendanceStore.getState().getTodayAttendance();
    const myRecord = todayRecords.find(r => r.staffId === state.currentStaffId);

    if (!myRecord || !myRecord.clockOutAt) {
      return {
        hoursWorked: '0h 0m',
        tipsEarned: 0,
        tablesServed: 0,
        rating: 0
      };
    }

    const hours = myRecord.totalHours || 0;
    const hoursInt = Math.floor(hours);
    const minutes = Math.floor((hours % 1) * 60);

    return {
      hoursWorked: `${hoursInt}h ${minutes}m`,
      tipsEarned: 0, // TODO: Get from tips table
      tablesServed: 0, // TODO: Get from orders table
      rating: 0 // TODO: Get from feedback table
    };
  }
}));
```

#### 4. Update StaffMode Component
**File:** `apps/staff-mobile/src/components/StaffMode.tsx`

Update to use real data:

```typescript
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useStaffStore } from '../stores/staffStore';
import './StaffMode.css';

export default function StaffMode() {
  const { clockIn, clockOut, getClockState, getTodayStats } = useStaffStore();
  const [clockState, setClockState] = useState(getClockState());
  const [todayStats, setTodayStats] = useState(getTodayStats());
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  );

  // Update clock state and stats every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      );
      setClockState(getClockState());
      setTodayStats(getTodayStats());
    }, 1000);

    return () => clearInterval(timer);
  }, [getClockState, getTodayStats]);

  const handleClockIn = async () => {
    try {
      await clockIn();
      setClockState(getClockState());
    } catch (error) {
      console.error('Clock in failed:', error);
      alert('Failed to clock in: ' + (error as Error).message);
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOut();
      setClockState(getClockState());
    } catch (error) {
      console.error('Clock out failed:', error);
      alert('Failed to clock out: ' + (error as Error).message);
    }
  };

  return (
    <div className="staff-mode">
      {/* ... rest of component using clockState and todayStats ... */}
      <button
        className={`clock-btn tap-feedback ${clockState.isClockedIn ? 'out' : 'in'}`}
        onClick={clockState.isClockedIn ? handleClockOut : handleClockIn}
      >
        <Clock size={20} />
        {clockState.isClockedIn ? 'Clock Out' : 'Clock In'}
      </button>
    </div>
  );
}
```

#### 5. Add Database Path Configuration
**File:** `apps/staff-mobile/src-tauri/tauri.conf.json`

Add database path configuration:

```json
{
  "productName": "HandsFree Staff",
  "identifier": "com.handsfree.staff",
  "plugins": {
    "sql": {
      "preload": [],
      "enabled": true
    }
  }
}
```

#### 6. Add Authentication/Staff Selection
**File:** `apps/staff-mobile/src/components/StaffLogin.tsx` (NEW)

```typescript
import { useState } from 'react';
import { useStaffStore as useMainStaffStore } from '../stores/staffStore';

export default function StaffLogin({ onLogin }: { onLogin: () => void }) {
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const { setCurrentStaff } = useMainStaffStore();

  const handleLogin = () => {
    // TODO: Verify PIN from database
    // For now, just set staff ID
    setCurrentStaff(staffId, 'tenant-id'); // TODO: Get tenant ID from config
    onLogin();
  };

  return (
    <div className="staff-login">
      <h2>Staff Login</h2>
      <input
        type="text"
        placeholder="Staff ID"
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
      />
      <input
        type="password"
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
```

### Phase 2: API Integration (Remote Access)

#### 1. Add API Endpoints to Main App
**File:** `src-tauri/src/commands/attendance_api.rs` (NEW)

```rust
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ClockInRequest {
    pub staff_id: String,
    pub tenant_id: String,
    pub method: String,
}

#[command]
pub async fn api_clock_in(request: ClockInRequest) -> Result<String, String> {
    // Call existing attendance logic
    Ok("success".to_string())
}

#[command]
pub async fn api_clock_out(record_id: String) -> Result<(), String> {
    // Call existing attendance logic
    Ok(())
}

#[command]
pub async fn api_get_attendance(
    staff_id: String,
    tenant_id: String
) -> Result<Vec<AttendanceRecord>, String> {
    // Query attendance_records table
    Ok(vec![])
}
```

#### 2. Expose API via HTTP Server
**File:** `src-tauri/src/api_server.rs` (NEW)

Use Tauri's built-in HTTP server or add a lightweight HTTP server (like `warp` or `axum`) to expose commands via REST API.

### Phase 3: Testing & Deployment

#### Test Checklist
- [ ] Staff can log in to mobile app
- [ ] Clock in creates record in `attendance_records`
- [ ] Clock out updates record correctly
- [ ] Hours calculated correctly
- [ ] Today's stats display correctly
- [ ] Payroll displays staff's payslips
- [ ] Advance requests work
- [ ] WiFi auto-attendance still works on desktop
- [ ] Mobile app syncs with desktop app in real-time

## Database Access Patterns

### Read-Only Access (Safe for Staff Mobile)
- `attendance_records` (own records only)
- `staff_salary` (own salary only)
- `staff_payslips` (own payslips only)
- `staff_advances` (own advances only)

### Write Access (Restricted)
- `attendance_records` (clock in/out only)
- `staff_advances` (create new requests only)

## Security Considerations

### Data Access Control
- Staff can only view/modify their own data
- Filter all queries by `staff_id`
- No access to other staff members' data
- No access to restaurant settings or management features

### Authentication
- PIN-based authentication
- Store hashed PINs in database
- Session tokens for API access
- Auto-logout after inactivity

### Network Security
- HTTPS for API communication
- Certificate pinning for production
- WiFi access control (optional)
- VPN support for remote access

## Deployment Options

### Option A: Local Network Only
- Main POS app runs on desktop
- Staff mobile app connects via local WiFi
- No internet required
- Best for single-location restaurants

### Option B: Cloud-Synced
- Main POS app syncs to cloud (Cloudflare D1)
- Staff mobile app connects to cloud API
- Works from anywhere
- Best for multi-location chains

### Option C: Hybrid
- Local network for on-premise access
- Cloud sync for remote access
- Fallback to cloud if local unavailable
- Best for flexibility

## Timeline

- **Phase 1 (Database Integration):** 6-8 hours
- **Phase 2 (API Integration):** 8-10 hours
- **Phase 3 (Testing):** 4-6 hours
- **Total:** 2-3 days

## Next Steps

1. ✅ Fix payroll calculation (DONE)
2. ⏳ Integrate staff-mobile database
3. ⏳ Copy stores and update components
4. ⏳ Add authentication
5. ⏳ Test end-to-end flow
6. ⏳ Deploy to device

## Resources

- Main app stores: `src/stores/`
- Staff mobile app: `apps/staff-mobile/`
- Database schema: `migrations-for-r2-deployment/`
- Tauri SQL plugin: https://github.com/tauri-apps/tauri-plugin-sql
