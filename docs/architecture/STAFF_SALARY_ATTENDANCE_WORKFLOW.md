# Staff Salary, Attendance, and Salary Advance Workflow

## ⚠️ Implementation Status

**This document describes the COMPLETE system design and database schema.**

**Current Reality**:
- ✅ **Database Schema**: Fully implemented (12 tables ready)
- ✅ **Manager/Owner Desktop UI**: Most features accessible via Settings
- ⚠️ **Staff Portal UI**: Backend ready, but **UI pages NOT built yet**
- ❌ **Android Mobile App**: Build config exists, but **NO functional app**
- ⚠️ **Salary Management UI**: Database ready, but **UI not built**

👉 **See [UI_ACCESS_PATTERNS.md](UI_ACCESS_PATTERNS.md) for complete details on who can access what and implementation gaps.**

---

## Overview

This restaurant POS system has a comprehensive staff management system that handles:
1. **Attendance Tracking** - Clock in/out, breaks, overtime
2. **Roster Management** - Weekly scheduling and shift assignments
3. **Leave Management** - Leave requests, approvals, and balance tracking
4. **Salary Management** - Base salary, advances, deductions, bonuses
5. **Payroll Processing** - Monthly payslip generation

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Manager Dashboard                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Roster     │  │  Attendance  │  │    Leave     │    │
│  │ Management   │  │  Tracking    │  │ Management   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Salary     │  │   Advances   │  │   Payroll    │    │
│  │   Config     │  │  & Deductions│  │ Processing   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Data flows to
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Individual Staff Portals                   │
│  (Separate Windows - Role-Based Access)                     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Clock In/Out │  │ View Schedule│  │ View Salary  │    │
│  │ Break Mgmt   │  │ Leave Request│  │ Payslip      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. `staff_users` (Migration 001)
Base staff information and authentication.
```sql
- id, tenant_id, name, role
- pin_hash (for authentication)
- email, phone, is_active
- created_at, last_login_at
```

#### 2. `attendance_records` (Migration 016)
Clock in/out tracking with break management.
```sql
- id, tenant_id, staff_id
- clock_in_at, clock_out_at (Unix timestamps)
- scheduled_start, scheduled_end
- break_duration_minutes, breaks_json
- shift_date (YYYY-MM-DD), shift_type
- total_hours, regular_hours, overtime_hours
- status (active/completed/missed/excused)
- late_by_minutes, early_departure_minutes
- notes, device_id
```

#### 3. `weekly_rosters` (Migration 017)
Weekly schedule templates.
```sql
- id, tenant_id
- week_start_date, week_end_date
- week_number, year
- name (optional - "Holiday Week")
- status (draft/published/archived)
- published_at, published_by
```

#### 4. `roster_assignments` (Migration 017)
Individual shift assignments.
```sql
- id, roster_id, staff_id
- shift_date, day_of_week
- shift_start, shift_end (Unix timestamps)
- shift_type (regular/split/overnight/on-call)
- role, position, section_id
- status (scheduled/confirmed/swapped/cancelled)
- confirmed_by_staff
- notes
```

#### 5. `leave_requests` (Migration 018)
Time-off management.
```sql
- id, tenant_id, staff_id
- start_date, end_date
- leave_type (vacation/sick/personal/emergency/unpaid)
- total_days, is_half_day
- reason, status (pending/approved/rejected/cancelled)
- requested_at, reviewed_at, reviewed_by
- review_notes
```

#### 6. `leave_balances` (Migration 018)
Annual leave allocation per staff.
```sql
- id, tenant_id, staff_id, year
- vacation_days_total, vacation_days_used
- sick_days_total, sick_days_used
- personal_days_total, personal_days_used
```

#### 7. `staff_salary` (Migration 030)
Salary configuration.
```sql
- id, staff_id
- base_salary, hourly_rate, overtime_rate
- salary_type (monthly/hourly/daily)
- effective_from, effective_to
```

#### 8. `staff_advances` (Migration 030)
Salary advances with repayment tracking.
```sql
- id, staff_id, amount, reason
- advance_date
- repayment_start_month (YYYY-MM format)
- installments, installments_paid
- status (pending/active/completed/cancelled)
```

#### 9. `staff_deductions` (Migration 030)
Salary deductions.
```sql
- id, staff_id, amount
- type (penalty/loan_repayment/tax/insurance/other)
- reason, deduction_month (YYYY-MM)
- is_recurring
```

#### 10. `staff_bonuses` (Migration 030)
Performance and festival bonuses.
```sql
- id, staff_id, amount
- type (performance/festival/target/other)
- reason, bonus_month (YYYY-MM)
```

#### 11. `staff_attendance` (Migration 030)
Summary attendance for payroll.
```sql
- id, staff_id, date
- clock_in, clock_out
- hours_worked, overtime_hours
- status (present/absent/half_day/leave/holiday)
- notes
```

#### 12. `staff_payslips` (Migration 030)
Monthly payroll records.
```sql
- id, staff_id, month (YYYY-MM)
- base_salary, overtime_pay, bonuses
- advances_deducted, other_deductions
- gross_salary, net_salary
- days_worked, hours_worked
- status (draft/processed/paid)
- paid_date, payment_method
- notes
```

---

## Complete Workflow

### 1. Roster Management Workflow

**Manager creates weekly schedule:**

1. **Create Weekly Roster**
   - Manager navigates to "Roster Management"
   - System auto-creates draft roster for current week
   - Can create rosters for future weeks

2. **Assign Shifts**
   - Click on date/staff cell to add shift
   - Enter shift details:
     - Shift start/end times
     - Role for this shift
     - Position/section
     - Shift type (regular/split/overnight)
   - Can add notes

3. **Publish Roster**
   - Review all assignments
   - Click "Publish Roster"
   - Status changes to "published"
   - Staff can now view their schedules

4. **Staff View**
   - Staff see their weekly schedule in their portal
   - Can confirm shifts
   - See shift timings, role, notes

**Components:**
- Frontend: [RosterManagement.tsx](src/components/admin/RosterManagement.tsx)
- Store: [rosteringStore.ts](src/stores/rosteringStore.ts)
- Migration: [017_weekly_roster.sql](src-tauri/migrations/017_weekly_roster.sql)

---

### 2. Attendance Tracking Workflow

**Staff clock in/out with break management:**

1. **Clock In**
   - Staff opens Clock In widget
   - Selects their name
   - Enters PIN (4-6 digits)
   - System verifies PIN
   - Records clock-in timestamp
   - Calculates late arrival (if scheduled)
   - Status: `active`

2. **Break Management**
   - Staff can start breaks:
     - Meal Break
     - Rest Break
     - Other
   - System records:
     - Break type
     - Start timestamp
     - End timestamp when resumed
     - Duration in minutes
   - Total break duration tracked

3. **Clock Out**
   - Must end any active break first
   - Click "Clock Out"
   - System records:
     - Clock-out timestamp
     - Calculates total hours worked
     - Separates regular hours (up to 8/day)
     - Calculates overtime (>8 hours)
     - Early departure tracking
   - Status: `completed`

4. **Attendance Management View**
   - Manager sees all staff attendance
   - Filter by staff, date range, status
   - View total hours, regular, overtime
   - Export to CSV

**Calculations:**
```javascript
totalHours = (clock_out - clock_in - break_duration) / 3600
regularHours = min(totalHours, 8)
overtimeHours = max(totalHours - 8, 0)
```

**Components:**
- Widget: [ClockInOutWidget.tsx](src/components/attendance/ClockInOutWidget.tsx)
- Management: [AttendanceManagement.tsx](src/components/admin/AttendanceManagement.tsx)
- Store: [attendanceStore.ts](src/stores/attendanceStore.ts)
- Migration: [016_attendance_records.sql](src-tauri/migrations/016_attendance_records.sql)

---

### 3. Leave Management Workflow

**Staff request leave, manager approves:**

1. **Staff Requests Leave**
   - Navigate to "Leave" section
   - Fill request form:
     - Leave type (vacation/sick/personal/emergency/unpaid)
     - Start date, end date
     - Half-day option
     - Reason
   - System checks leave balance
   - Prevents request if insufficient balance
   - Status: `pending`

2. **Manager Reviews Request**
   - See all pending leave requests
   - View staff's:
     - Leave balance
     - Attendance history
     - Current roster assignments
   - Approve or Reject with notes

3. **Leave Balance Updates**
   - On approval:
     - Deduct from appropriate balance
     - Update used days counter
     - Notify staff
   - On rejection:
     - Balance unchanged
     - Notify staff with reason

4. **Impact on Attendance**
   - Approved leave days marked in attendance
   - Status set to `leave`
   - Not counted as absent
   - Doesn't affect salary (for paid leave types)

**Leave Types:**
- **Vacation**: Deducted from vacation balance
- **Sick**: Deducted from sick leave balance
- **Personal**: Deducted from personal days
- **Emergency**: No balance check, manager discretion
- **Unpaid**: No balance deduction, salary impacted

**Components:**
- Management: [LeaveManagement.tsx](src/components/admin/LeaveManagement.tsx)
- Store: [leaveStore.ts](src/stores/leaveStore.ts)
- Migration: [018_leave_management.sql](src-tauri/migrations/018_leave_management.sql)

---

### 4. Salary Configuration

**Manager sets up staff salary:**

1. **Add Salary Record**
   - Select staff member
   - Enter:
     - Salary type (monthly/hourly/daily)
     - Base salary amount
     - Hourly rate (if hourly)
     - Overtime rate
     - Effective from date
   - Can have multiple records with date ranges

2. **Current Salary**
   - System uses record where:
     - `effective_from <= today`
     - `effective_to IS NULL OR effective_to > today`
   - Latest record takes precedence

3. **Salary Types:**
   - **Monthly**: Fixed monthly amount
   - **Hourly**: Rate × hours worked
   - **Daily**: Rate × days worked

**Migration:** [030_staff_payroll.sql](src-tauri/migrations/030_staff_payroll.sql)

---

### 5. Salary Advance Workflow

**Staff requests advance, manager approves, system tracks repayment:**

1. **Request Advance**
   - Staff requests advance payment
   - Enter:
     - Amount
     - Reason
     - Requested advance date
     - Repayment start month
     - Number of installments
   - Status: `pending`

2. **Manager Approval**
   - Reviews request
   - Approves or rejects
   - If approved:
     - Disburse amount
     - Status: `active`

3. **Repayment Tracking**
   - System automatically deducts from salary
   - Calculation:
     ```javascript
     installmentAmount = totalAmount / installments
     remainingInstallments = installments - installmentsPaid
     ```
   - Each month during payroll:
     - Deduct one installment
     - Increment `installments_paid`
     - When `installments_paid == installments`:
       - Status: `completed`

4. **In Payslip**
   - Shows as "Advances Deducted"
   - Reduces net salary
   - Shows remaining installments

**Components:**
- Database: `staff_advances` table
- Payroll integration (auto-deduction)

---

### 6. Deductions & Bonuses

#### Deductions

**Manager adds deductions:**

1. **One-Time Deduction**
   - Select staff
   - Enter:
     - Amount
     - Type (penalty/loan_repayment/tax/insurance/other)
     - Reason
     - Month to apply (YYYY-MM)
   - `is_recurring = false`

2. **Recurring Deduction**
   - Same as above
   - `is_recurring = true`
   - Applied every month until removed

3. **In Payslip**
   - Shows as "Other Deductions"
   - Itemized breakdown in notes

#### Bonuses

**Manager adds bonuses:**

1. **Add Bonus**
   - Select staff
   - Enter:
     - Amount
     - Type (performance/festival/target/other)
     - Reason
     - Month to apply (YYYY-MM)

2. **In Payslip**
   - Shows as "Bonuses"
   - Increases gross salary
   - Included in net pay

---

### 7. Payroll Processing

**Manager generates monthly payslips:**

1. **Automatic Data Collection**
   - System aggregates for the month:
     - Base salary from `staff_salary`
     - Attendance from `attendance_records`
     - Advances from `staff_advances`
     - Deductions from `staff_deductions`
     - Bonuses from `staff_bonuses`
     - Leave days

2. **Salary Calculation**

   **For Monthly Salary:**
   ```javascript
   // Base calculation
   baseSalary = staff_salary.base_salary

   // Attendance adjustment
   workingDays = getDaysInMonth(month)
   daysWorked = countPresentDays(staff_id, month)
   leaveDays = countLeaveDays(staff_id, month)
   absentDays = workingDays - daysWorked - leaveDays

   // Adjust for absences (unpaid)
   if (absentDays > 0) {
     baseSalary = baseSalary * (daysWorked + leaveDays) / workingDays
   }

   // Overtime
   overtimeHours = sumOvertimeHours(staff_id, month)
   overtimePay = overtimeHours * staff_salary.overtime_rate

   // Bonuses
   bonuses = sumBonuses(staff_id, month)

   // Gross salary
   grossSalary = baseSalary + overtimePay + bonuses

   // Deductions
   advancesDeducted = calculateAdvanceInstallment(staff_id, month)
   otherDeductions = sumDeductions(staff_id, month)

   // Net salary
   netSalary = grossSalary - advancesDeducted - otherDeductions
   ```

   **For Hourly Salary:**
   ```javascript
   regularHours = sumRegularHours(staff_id, month)
   overtimeHours = sumOvertimeHours(staff_id, month)

   baseSalary = regularHours * staff_salary.hourly_rate
   overtimePay = overtimeHours * staff_salary.overtime_rate

   // Rest same as monthly
   ```

   **For Daily Salary:**
   ```javascript
   daysWorked = countPresentDays(staff_id, month)
   baseSalary = daysWorked * staff_salary.daily_rate

   // Overtime calculated separately
   overtimePay = sumOvertimeHours(staff_id, month) * overtime_rate

   // Rest same as monthly
   ```

3. **Payslip Generation**
   - Insert into `staff_payslips`
   - Status: `draft`
   - Manager reviews

4. **Processing**
   - Manager verifies all payslips
   - Makes adjustments if needed
   - Changes status: `processed`

5. **Payment**
   - Manager records payment
   - Select payment method:
     - Cash
     - Bank Transfer
     - Cheque
     - UPI
   - Enter paid date
   - Status: `paid`

6. **Staff View**
   - Staff can view payslip in their portal
   - See breakdown:
     - Base salary
     - Overtime pay
     - Bonuses
     - Advances deducted
     - Other deductions
     - Net salary
   - Download PDF (if implemented)

---

## Staff Portal System

### Multi-Window Architecture

**Manager launches individual portals:**

1. **Launch Portal**
   - Manager goes to "Staff Portal Launcher"
   - Sees list of all staff grouped by role
   - Clicks "Open Portal" for a staff member
   - New window opens with personalized view

2. **Portal Types by Role**

   **Service Staff Portal:**
   - Table management
   - Order taking
   - Customer management
   - Personal dashboard (salary, attendance)

   **Kitchen Staff Portal:**
   - Kitchen Display System (KDS)
   - Order queue
   - Mark items as prepared
   - Personal dashboard

   **Operations Staff Portal:**
   - Reports and analytics
   - Inventory management
   - Staff oversight
   - Personal dashboard

   **Cleaning Staff Portal:**
   - Table status (dirty/clean)
   - Cleaning checklists
   - Task management
   - Personal dashboard

3. **Personal Dashboard (All Portals)**
   - Current month salary projection
   - Days worked / Total days
   - Hours worked / Expected hours
   - Upcoming shifts
   - Leave balance
   - Clock in/out widget

**Components:**
- Launcher: [StaffPortalLauncher.tsx](src/pages-v2/StaffPortalLauncher.tsx)
- Backend: [staff_portal.rs](src-tauri/src/commands/staff_portal.rs)

**Commands:**
```rust
open_staff_portal(staff_id, staff_name, role) -> window_label
close_staff_portal(staff_id) -> Result<()>
get_open_staff_portals() -> Vec<String>
focus_staff_portal(staff_id) -> bool
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     MONTHLY CYCLE                           │
└─────────────────────────────────────────────────────────────┘
        │
        ├─► Week 1-4: Roster Management
        │   └─► Manager creates/publishes weekly rosters
        │
        ├─► Daily: Attendance Tracking
        │   ├─► Staff clock in/out
        │   ├─► Break management
        │   └─► Overtime calculation
        │
        ├─► Ongoing: Leave Management
        │   ├─► Staff requests leave
        │   ├─► Manager approves/rejects
        │   └─► Balance updates
        │
        ├─► As Needed: Advances & Deductions
        │   ├─► Staff requests advance
        │   ├─► Manager approves
        │   └─► Monthly repayment tracking
        │
        └─► Month End: Payroll Processing
            ├─► Aggregate attendance data
            ├─► Calculate salary components
            ├─► Apply advances/deductions/bonuses
            ├─► Generate payslips
            ├─► Manager reviews & processes
            └─► Record payment
```

---

## Key Features

### 1. Real-Time Sync
- WebSocket broadcasts for:
  - Clock in/out events
  - Break updates
  - Roster changes
  - Leave approvals
- Multiple devices stay synchronized

### 2. Role-Based Access
- **Manager**: Full access to all features
- **Staff**: Limited to personal data only
- **Kitchen/Server**: Role-specific functionality
- PIN-based authentication

### 3. Offline Capability
- SQLite database for local storage
- Works without internet
- Syncs when connection restored

### 4. Audit Trail
- All changes timestamped
- Created_by and updated_by tracking
- Historical records maintained

### 5. Reporting
- Export attendance to CSV
- Export rosters to CSV
- Payslip PDF generation
- Monthly reports

---

## Security & Privacy

### 1. PIN Authentication
- Staff PIN hashed using bcrypt/argon2
- Never stored in plain text
- Verified server-side

### 2. Data Isolation
- Each staff portal is isolated
- Cannot access other staff's data
- Tenant-level data separation

### 3. Sensitive Data Protection
- Salary information encrypted
- Only visible to staff owner + manager
- Payslips secured

### 4. Permission Checks
- Backend validates staff_id for all operations
- Cannot modify other staff's attendance
- Cannot approve own leave requests

---

## Integration Points

### 1. With POS System
- Tips from POS orders
- Table assignments
- Order history
- Performance metrics

### 2. With Inventory
- Stock-taking assignments
- Wastage tracking
- Inventory reports access

### 3. With Reports
- Sales per server
- Kitchen efficiency
- Labor cost analysis
- Attendance trends

---

## Usage Examples

### Example 1: Staff Clock In

```typescript
// Staff enters PIN and clocks in
const record = await clockIn(staffId, tenantId);

// System records:
{
  id: "attendance-1234567890-abc123",
  staffId: "staff-001",
  tenantId: "tenant-001",
  clockInAt: "2024-01-26T09:00:00Z",
  shiftDate: "2024-01-26",
  status: "active",
  lateByMinutes: 0,
  breaks: []
}
```

### Example 2: Monthly Payslip

```typescript
// System generates payslip
{
  id: "payslip-202401-staff001",
  staffId: "staff-001",
  month: "2024-01",

  baseSalary: 15000,      // ₹15,000 base
  overtimePay: 2500,      // 20 hours × ₹125/hour
  bonuses: 1000,          // Festival bonus

  grossSalary: 18500,     // Total before deductions

  advancesDeducted: 2000, // 2nd installment of ₹6,000 advance
  otherDeductions: 500,   // Late penalty

  netSalary: 16000,       // Final take-home

  daysWorked: 26,
  hoursWorked: 208,

  status: "paid",
  paidDate: "2024-02-01",
  paymentMethod: "bank_transfer"
}
```

### Example 3: Advance Repayment

```typescript
// Staff takes ₹6,000 advance, repay in 3 months
{
  id: "advance-001",
  staffId: "staff-001",
  amount: 6000,
  reason: "Medical emergency",

  repaymentStartMonth: "2024-01",
  installments: 3,
  installmentsPaid: 0,

  status: "active"
}

// Each month during payroll:
// Month 1: Deduct ₹2,000, installmentsPaid = 1
// Month 2: Deduct ₹2,000, installmentsPaid = 2
// Month 3: Deduct ₹2,000, installmentsPaid = 3, status = "completed"
```

---

## File Reference

### Database Migrations
- [001_staff_users.sql](src-tauri/migrations/001_staff_users.sql)
- [016_attendance_records.sql](src-tauri/migrations/016_attendance_records.sql)
- [017_weekly_roster.sql](src-tauri/migrations/017_weekly_roster.sql)
- [018_leave_management.sql](src-tauri/migrations/018_leave_management.sql)
- [019_attendance_sync.sql](src-tauri/migrations/019_attendance_sync.sql)
- [030_staff_payroll.sql](src-tauri/migrations/030_staff_payroll.sql)

### Frontend Components
- [RosterManagement.tsx](src/components/admin/RosterManagement.tsx)
- [AttendanceManagement.tsx](src/components/admin/AttendanceManagement.tsx)
- [LeaveManagement.tsx](src/components/admin/LeaveManagement.tsx)
- [ClockInOutWidget.tsx](src/components/attendance/ClockInOutWidget.tsx)
- [StaffPortalLauncher.tsx](src/pages-v2/StaffPortalLauncher.tsx)

### State Management
- [attendanceStore.ts](src/stores/attendanceStore.ts)
- [staffStore.ts](src/stores/staffStore.ts)
- [rosteringStore.ts](src/stores/rosteringStore.ts)
- [leaveStore.ts](src/stores/leaveStore.ts)

### Backend Commands
- [staff_portal.rs](src-tauri/src/commands/staff_portal.rs)
- [staff_auth.rs](src-tauri/src/commands/staff_auth.rs)

### Documentation
- [STAFF_PORTAL_SYSTEM.md](STAFF_PORTAL_SYSTEM.md)

---

## Summary

This comprehensive system provides:

✅ **Complete Attendance Tracking**
- Clock in/out with PIN
- Break management
- Overtime calculation
- Late/early tracking

✅ **Flexible Rostering**
- Weekly schedule creation
- Shift assignments
- Multi-role support
- Staff confirmation

✅ **Leave Management**
- Multiple leave types
- Balance tracking
- Approval workflow
- Calendar integration

✅ **Salary Management**
- Flexible salary types (monthly/hourly/daily)
- Historical records
- Rate changes over time

✅ **Advance System**
- Request/approval flow
- Automatic repayment
- Installment tracking
- Full history

✅ **Payroll Processing**
- Automated calculations
- Deductions & bonuses
- Multiple payment methods
- Detailed payslips

✅ **Staff Portals**
- Role-based windows
- Personal dashboards
- Self-service features
- Data privacy

The system is designed to handle the complete lifecycle of staff management from hiring to payroll, with strong emphasis on automation, accuracy, and user experience.
