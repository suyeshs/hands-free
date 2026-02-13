# Attendance, Payroll, and Advances System Analysis

## Critical Issue Discovered ⚠️

**Problem:** There are TWO separate attendance tables that are NOT synchronized:

### Table 1: `attendance_records` (Clock In/Out)
- **Location:** [migrations-for-r2-deployment/016_attendance_records.sql](migrations-for-r2-deployment/016_attendance_records.sql)
- **Used By:** [attendanceStore.ts](src/stores/attendanceStore.ts) (line 143)
- **Purpose:** Real-time clock in/out tracking with breaks
- **Features:**
  - Clock in/out timestamps
  - Break tracking (meal, rest, other)
  - Late/early departure tracking
  - Device tracking
  - Auto-attendance support (WiFi-based)
  - Status: active, completed, missed, excused

### Table 2: `staff_attendance` (Payroll Calculation)
- **Location:** [migrations-for-r2-deployment/046_staff_payroll.sql](migrations-for-r2-deployment/046_staff_payroll.sql)
- **Used By:** [payrollStore.ts:generatePayslip()](src/stores/payrollStore.ts) (line 851-858)
- **Purpose:** Attendance data for payroll calculations
- **Features:**
  - Daily attendance status
  - Hours worked and overtime hours
  - Status: present, absent, half_day, leave, holiday

### The Problem

When staff clock in/out:
1. Data goes to `attendance_records` ✅
2. Payroll reads from `staff_attendance` ❌
3. **NO SYNC between these tables** ❌

**Result:** Payroll calculations will be **WRONG** because they read from an empty or outdated `staff_attendance` table!

```typescript
// payrollStore.ts line 851-858
const attendanceData = await db.select<Array<{
    hours_worked: number | null;
    overtime_hours: number | null;
}>>(`
    SELECT hours_worked, overtime_hours
    FROM staff_attendance
    WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
`, [staffId, month]);
```

## Data Flow Analysis

### Current Flow (BROKEN)

```
┌─────────────────┐
│ Staff Clocks In │
└────────┬────────┘
         │
         v
┌─────────────────────┐
│ attendance_records  │ <── Clock in/out data stored here
└─────────────────────┘
         │
         │  ❌ NO SYNC ❌
         │
         v
┌─────────────────────┐
│ staff_attendance    │ <── Payroll reads from here (EMPTY!)
└─────────────────────┘
         │
         v
┌─────────────────────┐
│ Generate Payslip    │ <── WRONG CALCULATION (0 hours!)
└─────────────────────┘
```

### Correct Flow (NEEDS IMPLEMENTATION)

```
┌─────────────────┐
│ Staff Clocks In │
└────────┬────────┘
         │
         v
┌─────────────────────┐
│ attendance_records  │ <── Primary source of truth
└────────┬────────────┘
         │
         │  ✅ SYNC JOB ✅
         │
         v
┌─────────────────────┐
│ staff_attendance    │ <── Aggregated daily data for payroll
└─────────────────────┘
         │
         v
┌─────────────────────┐
│ Generate Payslip    │ <── CORRECT CALCULATION
└─────────────────────┘
```

## Database Schema

### attendance_records (Source of Truth)
```sql
CREATE TABLE attendance_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    clock_in_at INTEGER NOT NULL,           -- Unix timestamp
    clock_out_at INTEGER,                    -- Unix timestamp, NULL if active
    break_duration_minutes INTEGER DEFAULT 0,
    breaks_json TEXT,
    shift_date TEXT NOT NULL,                -- YYYY-MM-DD
    total_hours REAL,                        -- Total shift hours
    regular_hours REAL,                      -- Regular hours (up to 8)
    overtime_hours REAL,                     -- Overtime hours (above 8)
    status TEXT NOT NULL DEFAULT 'active',   -- active, completed, missed, excused
    clock_in_method TEXT DEFAULT 'manual',   -- manual, wifi-auto, scheduled
    -- ... more fields
);
```

### staff_attendance (Payroll Target - Currently Empty)
```sql
CREATE TABLE staff_attendance (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    date TEXT NOT NULL,                      -- ISO 8601 date
    clock_in TEXT,                           -- ISO 8601 timestamp
    clock_out TEXT,                          -- ISO 8601 timestamp
    hours_worked REAL,                       -- Total hours for the day
    overtime_hours REAL DEFAULT 0,           -- Overtime hours for the day
    status TEXT NOT NULL,                    -- present, absent, half_day, leave, holiday
    notes TEXT,
    UNIQUE(staff_id, date)
);
```

## Staff Advances & Deductions

### staff_advances
```sql
CREATE TABLE staff_advances (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    repayment_start_month TEXT NOT NULL,    -- YYYY-MM format
    installments INTEGER NOT NULL DEFAULT 1,
    installments_paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,                   -- pending, active, completed, cancelled
);
```

- ✅ Properly integrated with payroll
- ✅ Auto-deducted during payslip generation
- ✅ Installments tracked correctly

### staff_deductions
```sql
CREATE TABLE staff_deductions (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,                     -- penalty, loan_repayment, tax, insurance, other
    deduction_month TEXT NOT NULL,          -- YYYY-MM format
    is_recurring BOOLEAN NOT NULL DEFAULT 0,
);
```

- ✅ Properly integrated with payroll
- ✅ Applied during payslip generation

## Staff Salary
```sql
CREATE TABLE staff_salary (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    base_salary REAL NOT NULL,
    hourly_rate REAL,
    overtime_rate REAL,
    salary_type TEXT NOT NULL,              -- monthly, hourly, daily
    effective_from TEXT NOT NULL,
    effective_to TEXT,                      -- NULL if current
);
```

- ✅ Properly tracked with history
- ✅ Used in payslip calculation
- ✅ Supports multiple salary types

## Payslip Generation (CURRENTLY BROKEN)

**Location:** [payrollStore.ts:generatePayslip()](src/stores/payrollStore.ts#L819-L919)

**Process:**
1. ✅ Get current salary configuration
2. ✅ Get bonuses for month
3. ✅ Get deductions for month
4. ✅ Calculate advance deductions
5. ❌ **Get attendance data** (reads from WRONG table)
6. ❌ Calculate hours and overtime (WRONG - gets 0 hours)
7. ❌ Calculate gross/net salary (WRONG - missing hours)
8. ✅ Create payslip record

## Solutions

### Option 1: Eliminate Duplicate Table (Recommended)
- Remove `staff_attendance` table entirely
- Modify `generatePayslip` to read directly from `attendance_records`
- Aggregate hours by querying `attendance_records` grouped by date

### Option 2: Implement Sync Job
- Create a background job that syncs `attendance_records` → `staff_attendance`
- Run sync:
  - On clock-out (real-time)
  - Daily at end of day (batch)
  - Before payslip generation (on-demand)

### Option 3: Unified View
- Create a SQL VIEW that aggregates `attendance_records` data
- Payroll reads from this view instead of `staff_attendance`

## Staff Mobile App

**Location:** `/Users/stonepot-tech/projects/restaurant-pos-ai/apps/staff-mobile`

**Status:** ⚠️ Separate app, needs integration

**Features:**
- Clock in/out with live timer
- Today's summary
- Weekly statistics
- Payroll access (viewing only)
- Dual mode: Staff & Manager

**Integration Needs:**
1. Share database schema with main app
2. Use same `attendance_records` table
3. Sync with cloud (if deployed separately)
4. Handle WiFi-based auto-attendance

## WiFi Access Control & Auto-Attendance

**Implementation:** ✅ Complete

**Tables:**
- `device_settings` - device-staff assignment
- `restaurant_settings` - WiFi check and auto-attendance flags

**Features:**
- ✅ WiFi SSID detection (macOS, Linux, Windows)
- ✅ Auto clock-in when connecting to restaurant WiFi
- ✅ Staff build restrictions
- ✅ Device assignment support

**Status:**
- WiFi detection: ✅ Fixed (works across all platforms)
- Auto-attendance: ✅ Functional
- Clock-in method tracking: ✅ Tracked in `attendance_records.clock_in_method`

## Network Access Policy

**Owner Build:**
- ✅ Full access always
- ✅ WiFi info displayed (for configuration)
- ✅ No restrictions

**Staff Build:**
- ✅ WiFi check enforced (if enabled)
- ✅ Sensitive features restricted:
  - Attendance (viewing own only)
  - Payroll (viewing own only)
  - Salary advances (requesting only)
- ✅ Access granted when on restaurant WiFi

**Web Mode:**
- ✅ No WiFi detection (browser security)
- ✅ Full access (no restrictions)

## Recommendations

### Immediate Priority (Critical)
1. **Fix payroll calculation** - Modify `generatePayslip` to read from `attendance_records`
2. **Remove or deprecate `staff_attendance` table** - Avoid confusion
3. **Test payroll calculation** - Verify hours are computed correctly

### High Priority
1. **Integrate staff-mobile app** - Share database and ensure consistency
2. **Add sync tests** - Verify attendance → payroll flow
3. **Document data flow** - Clear documentation for future developers

### Medium Priority
1. **Add payroll access control** - Ensure WiFi check works for payroll viewing
2. **Implement audit logging** - Track payroll generation and modifications
3. **Add validation** - Prevent payslip generation if attendance incomplete

## Files to Modify

### 1. Fix Payroll Calculation
- **File:** [src/stores/payrollStore.ts](src/stores/payrollStore.ts#L851-L858)
- **Change:** Query `attendance_records` instead of `staff_attendance`
- **SQL:**
```sql
-- OLD (BROKEN)
SELECT hours_worked, overtime_hours
FROM staff_attendance
WHERE staff_id = ? AND strftime('%Y-%m', date) = ?

-- NEW (FIXED)
SELECT
    shift_date as date,
    SUM(regular_hours) as hours_worked,
    SUM(overtime_hours) as overtime_hours
FROM attendance_records
WHERE staff_id = ?
  AND strftime('%Y-%m', shift_date) = ?
  AND status = 'completed'
GROUP BY shift_date
```

### 2. Deprecate staff_attendance Table
- **Files:** Migration files, schema files
- **Action:** Add deprecation notice, consider removal in future version

### 3. Update Documentation
- **Files:** README, API docs, developer guides
- **Action:** Document correct data flow and table usage

## Testing Checklist

- [ ] Staff clocks in → data in `attendance_records`
- [ ] Staff clocks out → hours calculated in `attendance_records`
- [ ] Generate payslip → reads from `attendance_records`
- [ ] Payslip shows correct hours worked
- [ ] Payslip shows correct overtime hours
- [ ] Advances deducted correctly
- [ ] Deductions applied correctly
- [ ] Bonuses added correctly
- [ ] WiFi auto-attendance → clock-in method tracked
- [ ] Staff mobile app → syncs with main database

## Timeline Estimate

- **Critical Fix (Payroll):** 2-4 hours
- **Testing & Validation:** 2-3 hours
- **Staff Mobile Integration:** 4-6 hours
- **Documentation:** 1-2 hours

**Total:** 1-2 days for complete resolution
