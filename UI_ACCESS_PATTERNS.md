# UI Access Patterns - Owner, Manager, and Staff

## Overview

This document explains how restaurant owners, managers, and staff access different parts of the system, including current implementation status and gaps.

---

## Current Implementation Status

### ✅ **Desktop/Tauri App** (FULLY IMPLEMENTED)
- **Platform**: Windows, macOS, Linux desktop application
- **Technology**: Tauri + React
- **Database**: Local SQLite (pos.db)
- **Primary Users**: Owners, Managers, Kitchen Staff, Service Staff

### 🚧 **Android App** (PLANNED - Native App)
- **Platform**: Android mobile devices (7.0+)
- **Technology**: React Native (recommended) or Native Kotlin
- **Status**: **TO BE BUILT** - Full implementation plan ready
- **Target**: All staff (Kitchen, Cleaning, Service, Captain)
- **Features**: Salary, Schedule, Attendance, Leave, Role-specific tools
- **Plan**: See [STAFF_MOBILE_APP_ANDROID.md](STAFF_MOBILE_APP_ANDROID.md)

---

## Access Patterns by User Type

### 1. Restaurant Owner

**Primary Access Method**: Desktop Tauri App

**Login Flow**:
1. Open the Tauri desktop application
2. Device auto-registers (or quick register in dev mode)
3. Choose **"Manager Login"** tab
4. Enter manager credentials (email/password) **OR**
5. Auto-bypass if flagged as owner from provisioning

**What They See**:
- **Hub Page** (`/hub`) - Central dashboard with cards:
  - Point of Sale
  - Kitchen Display
  - Service Dashboard
  - Sales Reports
  - Inventory
  - Bar Management
  - Settings (access to everything)

**Access to Staff Management**:
- Navigate to **Settings → Operations → Staff Management**
- Or click **Settings** from Hub
- Inside Settings, they can access:
  - **Staff Management** - Add/edit staff, assign roles, set PINs
  - **Attendance Tracking** - View all staff attendance
  - **Weekly Roster** - Create and publish schedules
  - **Leave Management** - Approve/reject leave requests
  - **Staff Portal Launcher** - Open individual staff windows

**Routes**:
```
/ → /hub (if authenticated)
/settings → Full settings access
/settings (Operations category) → Staff features
/pos → Point of Sale
/kitchen → Kitchen Display
/sales-report → Reports
/inventory → Inventory management
```

---

### 2. Manager (Similar to Owner)

**Primary Access Method**: Desktop Tauri App

**Login Flow**:
1. Open Tauri application
2. Device must be registered first
3. Choose **"Manager Login"** tab
4. Enter email/password credentials
5. System validates against SQLite or backend
6. Redirects to `/hub`

**What They See**:
- Same as Owner (full access)
- **Hub Page** with all dashboard cards
- Full Settings access
- All staff management features

**Staff Management Access**:
Same as Owner - full CRUD on:
- Staff records
- Attendance
- Roster
- Leave requests
- Advances/Deductions/Bonuses
- Payroll processing

---

### 3. Staff (Kitchen, Cleaning, Service, Captain)

**Primary Access Method**: Desktop Tauri App (Currently)

**Login Flow**:
1. Open Tauri application
2. Device must be registered
3. Choose **"Staff Login"** tab
4. Select name from dropdown
5. Enter 4-6 digit PIN
6. PIN verified via Argon2 hash
7. Redirects to role-specific dashboard

**What They See**:
Based on role assigned:

**Kitchen Staff**:
```
/ → /kitchen (Kitchen Display System)
- View incoming orders
- Mark items as prepared
- Timer for each order
- Cannot access POS, Settings, Reports
```

**Service Staff**:
```
/ → /pos (Point of Sale) or /service
- Take orders (if not using QR codes)
- View table status
- Process payments
- Limited settings access
```

**Captain (Senior Service Staff)**:
```
/ → /pos or /service
- All service staff features
- View team roster
- Assign tasks to service staff
- Access to more reports
- Can override certain operations
```

**Cleaning Staff**:
```
/ → /service or dedicated cleaning view
- View table status (dirty/clean)
- Cleaning checklist
- Mark tables as cleaned
- Task assignments
- Limited access to other features
```

**Current Limitations for Staff**:
- ❌ **NO dedicated staff portal UI yet** (planned but not implemented)
- ❌ Cannot view their own salary/payslip from app
- ❌ Cannot view their schedule
- ❌ Cannot request leave from UI
- ❌ Cannot see attendance history

**What's Planned (Not Yet Implemented)**:
- Individual staff portal windows (multi-window architecture exists)
- Personal dashboard with:
  - Current month salary projection
  - Attendance records
  - Upcoming shifts
  - Leave balance
  - Clock in/out widget

---

## Staff Portal System (PARTIALLY IMPLEMENTED)

### Current Status: **Foundation Built, UI Not Implemented**

### What EXISTS:

#### Backend (Rust) ✅
- Window management commands in `staff_portal.rs`
  ```rust
  open_staff_portal(staff_id, staff_name, role) -> window_label
  close_staff_portal(staff_id) -> Result<()>
  get_open_staff_portals() -> Vec<String>
  focus_staff_portal(staff_id) -> bool
  ```

#### Database Schema ✅
All tables exist for:
- Salary configuration
- Advances with repayment
- Deductions & bonuses
- Attendance tracking
- Roster assignments
- Leave management
- Payslip generation

#### Manager Launcher UI ✅
- File: `src/pages-v2/StaffPortalLauncher.tsx`
- Manager can see all staff
- Can click "Open Portal" button
- Opens new window with staff-specific URL

### What DOES NOT EXIST:

#### Staff Portal Pages ❌
These pages **do not exist**:
- `src/pages/staff-portal/ServiceStaffPortal.tsx` - **NOT CREATED**
- `src/pages/staff-portal/KitchenStaffPortal.tsx` - **NOT CREATED**
- `src/pages/staff-portal/OperationsStaffPortal.tsx` - **NOT CREATED**
- `src/pages/staff-portal/CleaningStaffPortal.tsx` - **NOT CREATED**

#### Shared Components ❌
These components **do not exist**:
- `src/components/staff/SalaryDashboard.tsx` - **NOT CREATED**
- `src/components/staff/PersonalInfo.tsx` - **NOT CREATED**
- `src/components/staff/AttendanceTracker.tsx` - **NOT CREATED**
- `src/components/staff/PayslipHistory.tsx` - **NOT CREATED**

#### Routes ❌
No routes configured for:
- `/staff-portal/service`
- `/staff-portal/kitchen`
- `/staff-portal/operations`
- `/staff-portal/cleaning`

**Result**: Manager can click "Open Portal" but it opens a **blank window** or 404.

---

## Android App for All Staff (PLANNED)

### Current State: **Full Native App - To Be Built**

**Decision Made**: Build a **native Android app** (not PWA, not Tauri Android)

### Recommended Technology: **React Native**

**Why React Native?**
- Reuse React/TypeScript knowledge
- Faster development (3 months vs 6+ months for native)
- Can share business logic with web app
- Cross-platform ready (can add iOS later)
- Large ecosystem and community

**Alternative**: Native Kotlin with Jetpack Compose
- Best performance
- Full Android platform features
- Longer development time

### Complete Plan Available:
👉 **[STAFF_MOBILE_APP_ANDROID.md](STAFF_MOBILE_APP_ANDROID.md)**

### App Features (All Roles):
1. ✅ **Authentication**: PIN + Biometric (fingerprint/face)
2. ✅ **Salary**: View breakdown, payslips, request advances
3. ✅ **Schedule**: Weekly/monthly calendar, shift details
4. ✅ **Attendance**: Clock in/out, view history
5. ✅ **Leave**: View balance, request leave
6. ✅ **Profile**: Settings, language, dark mode

### Role-Specific Features:
- **Service Staff**: Orders tab, table management, tips tracking
- **Captain**: Team management, reports, task assignment
- **Kitchen Staff**: Kitchen orders queue, prep tracking
- **Cleaning Staff**: Task checklist, table status

### Timeline:
- **Development**: 13 weeks (3 months)
- **Testing**: Included in timeline
- **Deployment**: Google Play Store

### Infrastructure:
- **Backend API**: Cloudflare Workers + D1 (recommended)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Storage**: AsyncStorage + SQLite (offline)
- **Authentication**: JWT + Android Keystore

**Current Reality**: Staff using Android devices will be able to access all their data once the app is built and deployed to Play Store.

---

## How It Works Today

### Scenario 1: Owner/Manager Manages Staff Salaries

1. **Login**:
   - Open desktop Tauri app
   - Manager login with credentials

2. **Access Staff Management**:
   ```
   Hub → Settings → Operations category → Staff Management
   ```

3. **Add Staff**:
   - Click "Add Staff"
   - Enter name, role, PIN, email, phone
   - Click Save
   - Staff saved to SQLite `staff_users` table

4. **Configure Salary**:
   - Select staff member
   - Click "Configure Salary" (if UI exists)
   - Enter base salary, type (monthly/hourly/daily)
   - Set effective date
   - Save to `staff_salary` table

5. **Record Attendance**:
   ```
   Settings → Operations → Attendance Tracking
   ```
   - View all staff attendance
   - Filter by staff, date range
   - Export to CSV

6. **Create Weekly Roster**:
   ```
   Settings → Operations → Weekly Roster
   ```
   - View current week
   - Assign shifts to staff
   - Set shift times, roles
   - Publish roster

7. **Process Salary Advance**:
   - Staff requests advance (currently no UI)
   - Manager approves manually
   - Insert into `staff_advances` table
   - System auto-deducts during payroll

8. **Generate Payslips**:
   - End of month
   - Run payroll calculation (manual or script)
   - System aggregates:
     - Base salary
     - Attendance hours
     - Overtime
     - Bonuses
     - Advances deducted
     - Other deductions
   - Generate payslip record
   - Store in `staff_payslips`

---

### Scenario 2: Staff Clock In/Out

**Current Method**: Desktop App Only

1. Staff arrives at work
2. Goes to desktop terminal
3. Login screen → "Staff Login" tab
4. Select their name from dropdown
5. Enter PIN on number pad
6. If attendance widget is open:
   - Click "Clock In"
   - System records timestamp
   - Calculates late arrival if scheduled
7. During shift:
   - Can start/end breaks
8. End of shift:
   - Click "Clock Out"
   - System calculates hours worked

**Component**: `src/components/attendance/ClockInOutWidget.tsx`

**Problem**: No mobile access for this feature.

---

### Scenario 3: Staff Views Their Schedule (NOT POSSIBLE)

**Expected Flow** (Not Implemented):
1. Staff opens their portal
2. Sees upcoming shifts
3. Can confirm attendance
4. Can request time off

**Current Reality**:
- Staff portal pages don't exist
- Staff must ask manager for schedule
- No self-service access

---

### Scenario 4: Staff Views Salary (NOT POSSIBLE)

**Expected Flow** (Not Implemented):
1. Staff opens their portal
2. Sees salary dashboard:
   - Expected salary this month
   - Days worked / Total days
   - Hours worked
   - Overtime hours
   - Bonuses this month
   - Advances being deducted
   - Net pay estimate
3. Can view past payslips

**Current Reality**:
- No UI for staff to view their own salary
- Must ask manager for payslip
- No self-service access

---

## Technical Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                  Tauri Desktop App                      │
│                                                         │
│  1. Device Registration                                │
│     └─> checkDeviceRegistration()                     │
│         • Reads from secure storage (Keychain)         │
│         • Returns tenant_id, device_name               │
│                                                         │
│  2. Manager Login                                       │
│     └─> Manager credentials (email/password)          │
│         • Validates against SQLite or backend          │
│         • Creates session in secure storage            │
│         • Redirects to /hub                            │
│                                                         │
│  3. Staff Login                                         │
│     └─> Staff PIN (4-6 digits)                        │
│         • Loads staff list from SQLite                 │
│         • Verifies PIN hash (Argon2)                   │
│         • Rate limiting (3 attempts)                   │
│         • Sets staff session                           │
│         • Redirects to role dashboard                  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────────┐
│  Manager Inputs  │
│  (Settings UI)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Local SQLite    │
│   (pos.db)       │
│                  │
│  • staff_users   │
│  • staff_salary  │
│  • attendance    │
│  • roster        │
│  • advances      │
│  • payslips      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Optional Cloud  │
│  Sync (Backend)  │
│                  │
│  • D1 Database   │
│  • R2 Storage    │
│  • Durable       │
│    Objects       │
└──────────────────┘
```

---

## Settings Navigation (Manager/Owner)

From Hub Page:

```
Hub → Settings

Settings Page Categories:
├── Business Setup
│   └── Restaurant Details
│
├── Menu & Products
│   ├── Menu Management
│   ├── Daily Specials
│   └── Dine-In Pricing
│
├── Operations ← STAFF FEATURES HERE
│   ├── Staff Management
│   ├── Floor Plan
│   ├── QR Code Ordering
│   ├── Customers
│   └── Billing History
│
├── Attendance & Rostering ← SALARY/SCHEDULE FEATURES
│   ├── Attendance Tracking
│   ├── Weekly Roster
│   └── Leave Management
│
├── Hardware & Printing
│   ├── Device Settings
│   └── Printer Settings
│
└── System & Training
    ├── Cloud Sync
    ├── Database Migrations
    └── Training Mode
```

**Where Staff Salary Features Live**:
- Settings → **Attendance & Rostering** category
- Has three settings:
  1. **Attendance Tracking** - View/manage clock in/out records
  2. **Weekly Roster** - Create schedules
  3. **Leave Management** - Approve leave requests

**Missing**:
- No "Salary Management" setting
- No "Payroll Processing" setting
- No "Advances & Deductions" setting
- No "Payslip Generation" setting

These features exist in the **database schema** but **no UI yet**.

---

## Gaps & What Needs to Be Built

### High Priority

1. **Staff Portal Pages** ⚠️
   - Create actual portal page components
   - Service Staff Portal with salary dashboard
   - Kitchen Staff Portal
   - Personal info displays
   - Salary breakdown widgets
   - Attendance history view
   - Shift schedule view

2. **Salary Management UI for Managers** ⚠️
   - UI to configure staff salaries
   - UI to record advances
   - UI to add deductions/bonuses
   - Payroll processing interface
   - Payslip generation tool

3. **Staff Self-Service Features** ⚠️
   - Leave request form
   - View my schedule
   - View my salary
   - Download payslip
   - Attendance history

### Medium Priority

4. **Android/Mobile App** ⚠️
   - Build functional Android app OR
   - Create mobile-responsive PWA
   - Mobile order taking interface
   - Mobile salary view
   - Mobile schedule view

5. **Advanced Payroll**
   - Automated payroll calculation
   - Tax calculations
   - EPF/ESI integration (India)
   - Bank transfer integration
   - Payslip PDF generation

### Low Priority

6. **Staff Portal Routes**
   - Add routes to App.tsx
   - Protected routes for staff portals
   - Deep linking support

7. **Reporting**
   - Staff salary reports
   - Attendance reports
   - Leave balance reports
   - Payroll summary reports

---

## Summary Table

| Feature | Desktop (Tauri) | Android App | Web (Browser) |
|---------|----------------|-------------|---------------|
| **Owner/Manager Login** | ✅ Implemented | ❌ No app | ⚠️ Possible via cloud |
| **Staff Login (PIN)** | ✅ Implemented | ❌ No app | ❌ Not implemented |
| **Add/Edit Staff** | ✅ Implemented | N/A | N/A |
| **Configure Salary** | ⚠️ DB only, no UI | ❌ No app | ❌ Not implemented |
| **Clock In/Out** | ✅ Implemented | ❌ No app | ❌ Not implemented |
| **View Attendance** | ✅ Manager view | ❌ No app | ❌ Not implemented |
| **Create Roster** | ✅ Implemented | N/A | N/A |
| **Approve Leave** | ✅ Implemented | N/A | N/A |
| **Record Advances** | ⚠️ DB only, no UI | N/A | N/A |
| **Generate Payslips** | ⚠️ DB only, no UI | N/A | N/A |
| **Staff View Salary** | ❌ Portal not built | ❌ No app | ❌ Not implemented |
| **Staff View Schedule** | ❌ Portal not built | ❌ No app | ❌ Not implemented |
| **Staff Request Leave** | ⚠️ Can via form if exists | ❌ No app | ❌ Not implemented |
| **Take Orders (POS)** | ✅ Desktop POS | ⚠️ Needed | ⚠️ Via QR ordering |

**Legend**:
- ✅ Fully implemented
- ⚠️ Partially implemented / Database ready but no UI
- ❌ Not implemented
- N/A - Not applicable for this user type

---

## Recommendations

### For Immediate Use (Current State):

1. **Owner/Manager**:
   - Use desktop Tauri app exclusively
   - Access all features via Settings page
   - Manually manage staff salaries (database records)
   - Use attendance tracking UI
   - Use roster management UI
   - Use leave management UI

2. **Staff**:
   - Use desktop Tauri app for:
     - PIN login
     - Clock in/out (if widget accessible)
     - Role-specific dashboards (POS/Kitchen)
   - Ask manager for:
     - Salary information
     - Schedule/roster
     - Payslips
     - Leave balance

### For Future Development:

1. **Build Staff Portal UIs** (Phase 1)
   - Implement the 4 portal page types
   - Add salary dashboard component
   - Add personal info widgets
   - Add schedule view
   - Add attendance history

2. **Add Salary Management UIs** (Phase 2)
   - Salary configuration form
   - Advance request/approval flow
   - Deduction/bonus entry
   - Payroll calculation tool
   - Payslip viewer/printer

3. **Consider Mobile Strategy** (Phase 3)
   - Option A: Build Tauri Android app
   - Option B: Progressive Web App (PWA)
   - Option C: React Native separate app
   - Focus on service staff use cases

4. **Integrate with Hardware** (Phase 4)
   - Biometric clock in/out
   - RFID cards for attendance
   - Mobile device as order terminal
   - Bluetooth receipt printers

---

## File Reference

### Implemented Files:
- [App.tsx](src/App.tsx) - Main routing and authentication
- [Login.tsx](src/pages/Login.tsx) - Manager & staff login page
- [SettingsPage.tsx](src/pages-v2/SettingsPage.tsx) - Settings with all categories
- [HubPage.tsx](src/pages-v2/HubPage.tsx) - Central dashboard
- [StaffManager.tsx](src/components/admin/StaffManager.tsx) - Add/edit staff
- [AttendanceManagement.tsx](src/components/admin/AttendanceManagement.tsx) - View attendance
- [RosterManagement.tsx](src/components/admin/RosterManagement.tsx) - Create schedules
- [LeaveManagement.tsx](src/components/admin/LeaveManagement.tsx) - Approve leave
- [ClockInOutWidget.tsx](src/components/attendance/ClockInOutWidget.tsx) - Clock in/out UI
- [StaffPortalLauncher.tsx](src/pages-v2/StaffPortalLauncher.tsx) - Launch staff windows
- [staff_portal.rs](src-tauri/src/commands/staff_portal.rs) - Window management
- [staff_auth.rs](src-tauri/src/commands/staff_auth.rs) - Authentication commands

### NOT Implemented (Needed):
- ❌ `src/pages/staff-portal/ServiceStaffPortal.tsx`
- ❌ `src/pages/staff-portal/KitchenStaffPortal.tsx`
- ❌ `src/components/staff/SalaryDashboard.tsx`
- ❌ `src/components/admin/SalaryManagement.tsx`
- ❌ `src/components/admin/AdvanceManagement.tsx`
- ❌ `src/components/admin/PayrollProcessing.tsx`

---

## Conclusion

**Current State Summary**:
- ✅ **Owner/Manager**: Full desktop app with most features
- ⚠️ **Staff**: Can login and use role dashboards, but **no personal portal**
- ❌ **Mobile**: Android build system exists, but **no functional app**

**To Enable Full Workflow**:
1. Build staff portal page UIs
2. Add salary management UIs for managers
3. Implement mobile access (PWA or native app)
4. Connect all pieces with proper routing

The **foundation is solid** (database schema, authentication, backend commands), but **UI layer for staff self-service is missing**.
