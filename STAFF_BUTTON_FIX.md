# Staff "Add Staff" Button Fix

## Problem
After adding the first staff member, the "Add Staff" button became unclickable/disabled.

## Root Cause
The `StaffManager` component has a button that's disabled when `tenantId` is not provided:

```typescript
<button
  onClick={handleAddNew}
  disabled={!tenantId}  // ← Button disabled when no tenantId
  className="..."
>
  + Add Staff
</button>
```

The issue was that in [SettingsPage.tsx](src/pages-v2/SettingsPage.tsx), the `StaffManager` component was not receiving the `tenantId` prop, while other components like `CustomerManager` were properly configured with it.

## Solution
Added `componentProps: { tenantId }` to the StaffManager configuration in SettingsPage.tsx.

### Before
```typescript
{
  id: 'staff',
  label: 'Staff Management',
  description: 'Staff members, roles, PINs, and assignments',
  icon: Users,
  component: StaffManager,
  // ← Missing componentProps!
},
```

### After
```typescript
{
  id: 'staff',
  label: 'Staff Management',
  description: 'Staff members, roles, PINs, and assignments',
  icon: Users,
  component: StaffManager,
  componentProps: { tenantId },  // ✅ Added
},
```

## File Modified
- **src/pages-v2/SettingsPage.tsx** - Added `componentProps: { tenantId }` to StaffManager setting

## How It Works
1. SettingsPage gets `tenantId` from: `tenant?.tenantId || user?.tenantId || ''`
2. This tenantId is now passed to StaffManager via `componentProps`
3. StaffManager receives it as a prop and uses it to enable the "Add Staff" button
4. The button remains enabled throughout the session

## Result
✅ "Add Staff" button is now always clickable when you have a valid tenantId
✅ Can add multiple staff members without issues
✅ Matches the behavior of other management components (Customers, Menu, etc.)

## Testing
- [x] First staff member can be added
- [x] "Add Staff" button remains clickable after adding first staff
- [x] Multiple staff members can be added sequentially
- [x] No TypeScript errors
- [x] Build succeeds

---

**Status**: ✅ Fixed
**Impact**: Critical bug fix for staff management workflow
