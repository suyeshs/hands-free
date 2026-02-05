# Staff Portal System - Multi-Window Architecture

## Overview

A comprehensive staff management system where each staff member gets their own dedicated window/app with:
- **Role-specific functionality** (Service, Kitchen, Operations, Cleaning)
- **Personal dashboard** with salary, advances, deductions
- **Time tracking** and attendance
- **Isolated sessions** - each window is independent

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Main POS App (Manager/Owner)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        Staff Portal Launcher                          │  │
│  │  - View all staff                                     │  │
│  │  - Open individual portals                            │  │
│  │  - Monitor open portals                               │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Spawns separate windows
                           ▼
      ┌─────────────────────────────────────────────────┐
      │     Individual Staff Portal Windows             │
      ├─────────────────────────────────────────────────┤
      │                                                 │
      │  ┌──────────────┐  ┌──────────────┐           │
      │  │ Service Staff│  │ Kitchen Staff│           │
      │  │   Window     │  │   Window     │           │
      │  │              │  │              │           │
      │  │ • Tables     │  │ • KDS View   │           │
      │  │ • Orders     │  │ • Orders     │           │
      │  │ • Salary Info│  │ • Salary Info│           │
      │  └──────────────┘  └──────────────┘           │
      │                                                 │
      │  ┌──────────────┐  ┌──────────────┐           │
      │  │  Operations  │  │ Cleaning     │           │
      │  │   Staff      │  │   Staff      │           │
      │  │              │  │              │           │
      │  │ • Reports    │  │ • Table      │           │
      │  │ • Inventory  │  │   Status     │           │
      │  │ • Salary Info│  │ • Salary Info│           │
      │  └──────────────┘  └──────────────┘           │
      └─────────────────────────────────────────────────┘
```

## Database Schema

### New Tables (Migration 030)

#### staff_salary
```sql
- id, staff_id
- base_salary, hourly_rate, overtime_rate
- salary_type (monthly/hourly/daily)
- effective_from, effective_to
```

#### staff_advances
```sql
- id, staff_id, amount
- reason, advance_date
- repayment_start_month, installments
- installments_paid, status
```

#### staff_deductions
```sql
- id, staff_id, amount
- type (penalty/loan_repayment/tax/insurance/other)
- reason, deduction_month
- is_recurring
```

#### staff_bonuses
```sql
- id, staff_id, amount
- type (performance/festival/target/other)
- reason, bonus_month
```

#### staff_attendance
```sql
- id, staff_id, date
- clock_in, clock_out
- hours_worked, overtime_hours
- status (present/absent/half_day/leave/holiday)
```

#### staff_payslips
```sql
- id, staff_id, month
- base_salary, overtime_pay, bonuses
- advances_deducted, other_deductions
- gross_salary, net_salary
- days_worked, hours_worked
- status (draft/processed/paid)
- paid_date, payment_method
```

## Features by Role

### 1. Service Staff Portal
**Primary Functions:**
- Table management (open/close/transfer)
- Take orders (when QR not used)
- View assigned tables
- See order history

**Personal Dashboard:**
- Current month salary projection
- Attendance record
- Tips earned
- Performance metrics

**UI Components:**
- Floor plan with table status
- Quick order entry
- Customer management
- Salary summary card

### 2. Kitchen Staff Portal
**Primary Functions:**
- KDS (Kitchen Display System)
- View incoming orders
- Mark items as prepared
- View order history

**Personal Dashboard:**
- Salary information
- Attendance record
- Shift timings
- Performance (orders completed)

**UI Components:**
- Order queue display
- Item preparation workflow
- Timer for each order
- Salary summary card

### 3. Operations Staff Portal
**Primary Functions:**
- View reports (sales, inventory)
- Manage inventory
- Staff oversight
- Analytics dashboard

**Personal Dashboard:**
- Salary information
- Attendance record
- Performance metrics
- Target achievement

**UI Components:**
- Dashboard with key metrics
- Report generation
- Inventory management
- Salary summary card

### 4. Cleaning Staff Portal
**Primary Functions:**
- Table status (dirty/clean)
- Cleaning checklist
- Task assignment
- Area management

**Personal Dashboard:**
- Salary information
- Attendance record
- Tasks completed
- Performance rating

**UI Components:**
- Table grid with status
- Cleaning checklist
- Task tracker
- Salary summary card

## Common Components (All Portals)

### Salary Dashboard Widget
```tsx
<SalaryDashboard>
  - Current Month Expected: ₹XX,XXX
  - Base Salary: ₹XX,XXX
  - Bonuses: ₹X,XXX
  - Overtime: ₹X,XXX
  - Advances Deducted: -₹X,XXX
  - Other Deductions: -₹X,XXX
  - Net Salary: ₹XX,XXX

  - Days Worked: 22/26
  - Hours Worked: 176/208
  - Next Payment: DD MMM YYYY
</SalaryDashboard>
```

### Personal Info Widget
```tsx
<PersonalInfo>
  - Name, Role, Employee ID
  - Joining Date
  - Phone, Email
  - Emergency Contact
</PersonalInfo>
```

### Attendance Widget
```tsx
<AttendanceTracker>
  - Clock In/Out buttons
  - Current shift duration
  - This month: 22 days, 176 hours
  - Leave balance
</AttendanceTracker>
```

## Implementation Files

### Backend (Rust)

#### Created
- `src-tauri/migrations/030_staff_payroll.sql` - Database schema
- `src-tauri/src/commands/staff_portal.rs` - Window management commands

#### Commands
```rust
- open_staff_portal(staff_id, staff_name, role) -> window_label
- close_staff_portal(staff_id) -> Result
- get_open_staff_portals() -> Vec<String>
- focus_staff_portal(staff_id) -> bool
```

### Frontend (React)

#### Launcher
- `src/pages-v2/StaffPortalLauncher.tsx` - Manager's launcher UI

#### Portal Pages (To be created)
- `src/pages/staff-portal/ServiceStaffPortal.tsx`
- `src/pages/staff-portal/KitchenStaffPortal.tsx`
- `src/pages/staff-portal/OperationsStaffPortal.tsx`
- `src/pages/staff-portal/CleaningStaffPortal.tsx`

#### Shared Components
- `src/components/staff/SalaryDashboard.tsx`
- `src/components/staff/PersonalInfo.tsx`
- `src/components/staff/AttendanceTracker.tsx`
- `src/components/staff/PayslipHistory.tsx`

## URL Routing

```
Main App Routes:
- /staff-portal-launcher → Manager launches portals

Staff Portal Routes (in separate windows):
- /staff-portal/service?staff_id=X&name=Y&role=Z
- /staff-portal/kitchen?staff_id=X&name=Y&role=Z
- /staff-portal/operations?staff_id=X&name=Y&role=Z
- /staff-portal/cleaning?staff_id=X&name=Y&role=Z
```

## Usage Flow

### Manager Opens Staff Portal

1. **Manager navigates to Staff Portal Launcher**
   ```
   Settings → Operations → Staff Portal Launcher
   ```

2. **Manager sees list of staff grouped by role**
   ```
   Service Staff (5)
   - John Doe [Open Portal button]
   - Jane Smith [Portal Open ✓] [Close Portal]
   ...

   Kitchen Staff (3)
   - Chef Kumar [Open Portal button]
   ...
   ```

3. **Manager clicks "Open Portal" for John Doe**
   ```
   → Tauri command: open_staff_portal("john-123", "John Doe", "server")
   → New window opens at /#/staff-portal/service?staff_id=john-123...
   → Window title: "Service Staff Portal - John Doe"
   ```

4. **John's Portal Window Opens**
   ```
   ┌──────────────────────────────────────┐
   │ Service Staff Portal - John Doe   [×]│
   ├──────────────────────────────────────┤
   │                                      │
   │  Welcome, John Doe                   │
   │  Role: Service Staff                 │
   │                                      │
   │  ┌────────────────────────────────┐  │
   │  │ Expected Salary This Month     │  │
   │  │ ₹18,500                        │  │
   │  │ (22 days worked out of 26)     │  │
   │  └────────────────────────────────┘  │
   │                                      │
   │  [Tables] [Orders] [Attendance]      │
   │                                      │
   │  Your Tables Today:                  │
   │  • Table 5 - Occupied               │
   │  • Table 7 - Cleaning               │
   │  • Table 12 - Available             │
   │                                      │
   └──────────────────────────────────────┘
   ```

### Staff Portal Features

#### Service Staff: Take Order
1. Click "Take Order" on Table 5
2. Select menu items
3. Enter customer details
4. Confirm order
5. Order sent to Kitchen
6. Table status updated

#### Kitchen Staff: View Orders
1. New order appears on KDS
2. Mark items as "Preparing"
3. Mark items as "Ready"
4. Order moves to "Completed"

#### All Staff: View Salary
1. Click "Salary" tab
2. See breakdown:
   - Base: ₹15,000
   - Overtime: ₹2,500
   - Bonus: ₹1,000
   - Advance Deducted: -₹0
   - Total: ₹18,500
3. View past payslips
4. Download payslip PDF

## Security Considerations

1. **Window Isolation**
   - Each staff window is independent
   - No cross-window data leakage
   - Staff can only see their own data

2. **Authentication**
   - Staff must login (PIN) before accessing portal
   - Session timeout after inactivity
   - Cannot access other staff's data

3. **Permission Checks**
   - Backend validates staff_id for all operations
   - Cannot view/edit other staff's salary
   - Role-based access control

4. **Data Privacy**
   - Salary information encrypted in transit
   - Personal data only accessible to owner + manager
   - Audit log for salary changes

## Next Steps (Phase-by-Phase)

### Phase 1: Foundation ✅
- [x] Database migration
- [x] Window management commands
- [x] Staff portal launcher UI

### Phase 2: Service Staff Portal (Current)
- [ ] Create ServiceStaffPortal.tsx
- [ ] Table management UI
- [ ] Order taking interface
- [ ] Salary dashboard component
- [ ] Attendance tracker

### Phase 3: Kitchen Staff Portal
- [ ] Create KitchenStaffPortal.tsx
- [ ] KDS view integration
- [ ] Order queue management
- [ ] Salary dashboard component

### Phase 4: Salary Management
- [ ] Create SalaryDashboard.tsx
- [ ] Payslip generation
- [ ] Advance request system
- [ ] Deduction management
- [ ] Payslip history view

### Phase 5: Attendance System
- [ ] Clock in/out functionality
- [ ] Attendance history
- [ ] Leave management
- [ ] Overtime tracking

### Phase 6: Operations & Cleaning Portals
- [ ] Operations portal with reports
- [ ] Cleaning portal with checklists
- [ ] Performance tracking

## Technical Implementation Details

### Window Spawning
```rust
// Create window with custom URL
WebviewWindowBuilder::new(&app_handle, window_label, webview_url)
    .title(format!("{} Portal - {}", role, staff_name))
    .inner_size(1024.0, 768.0)
    .build()
```

### URL Encoding
```rust
// Pass staff info via URL parameters
let url = format!("/#/staff-portal/service?staff_id={}&name={}&role={}",
    urlencoding::encode(&staff_id),
    urlencoding::encode(&staff_name),
    urlencoding::encode(&role)
);
```

### State Management
- Each portal window has its own React state
- Shared data via SQLite database
- Real-time updates via Tauri events

## Testing Checklist

- [ ] Launch portal for each role
- [ ] Multiple portals open simultaneously
- [ ] Close individual portals
- [ ] Refresh portal list
- [ ] Data isolation (staff can't see others' data)
- [ ] Salary calculations correct
- [ ] Attendance tracking works
- [ ] Order flow (service → kitchen)
- [ ] Window focus/switch works
- [ ] Window close cleanup

## Future Enhancements

### Mobile App Integration
- Extend to mobile apps for staff
- Push notifications for orders
- Remote clock in/out

### Advanced Features
- Shift scheduling
- Performance analytics
- Tip pooling/distribution
- Leave request workflow
- Training module
- Document storage
- Communication/chat

## Summary

This staff portal system provides a complete solution for:
- ✅ Role-based functionality
- ✅ Personal salary tracking
- ✅ Time & attendance
- ✅ Multi-window architecture
- ✅ Data isolation
- ✅ Easy management

Each staff member gets a personalized, isolated workspace while managers maintain oversight through the launcher interface.

---

**Status**: Phase 1 Complete (Foundation)
**Next**: Implement Service Staff Portal
**Files**: 3 created, database schema ready, window system functional
