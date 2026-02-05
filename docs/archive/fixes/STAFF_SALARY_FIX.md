# Staff Salary Configuration Fix

## Problem
When clicking "Configure Salary" in the add staff workflow, the salary record was not being saved to the database.

## Root Cause
The migration file `046_staff_payroll.sql` had incorrect foreign key constraints that referenced `staff(id)` instead of `staff_users(id)`. Since the actual table name is `staff_users`, the foreign key constraint would fail, preventing salary records from being inserted.

## Changes Made

### 1. Fixed Migration File
**File**: `migrations-for-r2-deployment/046_staff_payroll.sql`

Changed all foreign key references from:
```sql
FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
```

To:
```sql
FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
```

This affects the following tables:
- `staff_salary`
- `staff_advances`
- `staff_deductions`
- `staff_bonuses`
- `staff_attendance`
- `staff_payslips`

### 2. Created Fix Migration
**File**: `migrations-for-r2-deployment/046b_fix_staff_payroll_fk.sql`

This migration drops and recreates all payroll tables with the correct foreign key constraints. Use this for existing databases that may have been created with the wrong constraints.

### 3. Updated Payroll Store
**File**: `src/stores/payrollStore.ts`

Added table creation logic to ensure tables exist before attempting to insert data. Each method now:
1. Creates the table if it doesn't exist (with correct foreign key)
2. Creates the necessary indexes
3. Proceeds with the operation

Updated methods:
- `loadSalaries` - Ensures `staff_salary` table exists
- `setSalary` - Ensures `staff_salary` table exists before insert
- `loadAdvances` - Ensures `staff_advances` table exists
- `addAdvance` - Ensures `staff_advances` table exists before insert
- `loadDeductions` - Ensures `staff_deductions` table exists
- `loadBonuses` - Ensures `staff_bonuses` table exists
- `loadPayslips` - Ensures `staff_payslips` table exists

## How to Test

1. **Fresh Installation**: The fix will work automatically

2. **Existing Installation**:
   - Option A: Run the fix migration `046b_fix_staff_payroll_fk.sql`
   - Option B: The store will auto-create tables on first use (recommended)

### Test Steps:
1. Navigate to Staff Management
2. Click "Add Staff"
3. Fill in basic staff details (name, role, PIN)
4. Check "💰 Configure Salary"
5. Select salary type (e.g., Monthly)
6. Enter salary amount (e.g., 25000)
7. Click "Add Staff"
8. Verify that:
   - Staff member is created successfully
   - No error appears in the console
   - You can see the salary in payroll records

## Verification

Check the console for these success messages:
```
[StaffStore] Added staff: staff-xxxxx
[PayrollStore] Set salary for staff staff-xxxxx
```

If you see any errors about "no such table" or "foreign key constraint failed", ensure:
1. The `staff_users` table exists
2. The staff member was created before the salary is set
3. The `staffId` is correctly passed to `setSalary`

## Technical Details

### Staff Creation Flow (StaffManager.tsx:154-232)
1. Staff member is created first via `addStaff` or `updateStaff`
2. `addStaff` returns the new `staffId`
3. If `salaryEnabled` is true, `setSalary` is called with the `staffId`
4. If `advanceEnabled` is true, `addAdvance` is called with the `staffId`

### Database Schema
The correct foreign key relationship:
```
staff_users (id) <-- staff_salary (staff_id)
```

Not:
```
staff (id) <-- staff_salary (staff_id)  ❌ WRONG
```

## Related Files
- [StaffManager.tsx](src/components/admin/StaffManager.tsx#L198-L208)
- [staffStore.ts](src/stores/staffStore.ts#L218-L301)
- [payrollStore.ts](src/stores/payrollStore.ts#L185-L238)
- [046_staff_payroll.sql](migrations-for-r2-deployment/046_staff_payroll.sql)
