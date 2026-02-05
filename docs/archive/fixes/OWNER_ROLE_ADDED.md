# Owner Role Added

## Summary

Added a new `OWNER` role to the authentication system to distinguish restaurant owners from managers. The owner is automatically logged in after completing the setup wizard.

## Changes Made

### 1. Added OWNER to UserRole Enum

**File:** `src/types/auth.ts`

**Lines 5-10:**
```typescript
export enum UserRole {
  SERVER = 'server',
  KITCHEN = 'kitchen',
  MANAGER = 'manager',
  AGGREGATOR = 'aggregator',
  OWNER = 'owner',  // ← NEW
}
```

### 2. Added OWNER Permissions

**File:** `src/types/auth.ts`

**Lines 84-92:**
```typescript
[UserRole.OWNER]: {
  canViewPOS: true,
  canTakeOrders: true,
  canViewKDS: true,
  canViewAggregators: true,
  canManageMenu: true,
  canManageUsers: true,
  canViewReports: true,
},
```

**Permissions:** OWNER has full access to all features (same as MANAGER).

### 3. Updated SystemCheckScreen Auto-Login

**File:** `src/components/setup/screens/SystemCheckScreen.tsx`

**Lines 267-284:**
```typescript
const ownerUser = {
  id: 'owner-1',
  email: wizardData.restaurantInfo?.email || 'owner@restaurant.local',
  name: 'Restaurant Owner',
  role: UserRole.OWNER,  // ← Changed from MANAGER to OWNER
  tenantId: localStorage.getItem('pos_activation_code') || 'local',
};

// ... mockTokens ...

useAuthStore.setState({
  user: ownerUser,
  tokens: mockTokens,
  role: UserRole.OWNER,  // ← Changed from MANAGER to OWNER
  isAuthenticated: true,
  isLoading: false,
  error: null,
});
```

### 4. Updated HubPage Dashboard Visibility

**File:** `src/pages-v2/HubPage.tsx`

Added `UserRole.OWNER` to all dashboard role arrays:

- **POS Dashboard** (line 147): `[UserRole.SERVER, UserRole.MANAGER, UserRole.OWNER]`
- **Kitchen Display** (line 158): `[UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER]`
- **Service Dashboard** (line 172): `[UserRole.SERVER, UserRole.MANAGER, UserRole.OWNER]`
- **Sales Reports** (line 186): `[UserRole.MANAGER, UserRole.OWNER]`
- **Inventory** (line 195): `[UserRole.MANAGER, UserRole.OWNER]`
- **System & Devices** (line 204): `[UserRole.MANAGER, UserRole.OWNER]`
- **Settings** (line 213): `[UserRole.MANAGER, UserRole.OWNER]`

### 5. Updated Aggregator Status Card Visibility

**File:** `src/pages-v2/HubPage.tsx`

**Line 310:**
```typescript
// BEFORE
{isDesktopDevice && isTauriApp && user?.role === UserRole.MANAGER && (

// AFTER
{isDesktopDevice && isTauriApp && (user?.role === UserRole.MANAGER || user?.role === UserRole.OWNER) && (
```

## Role Hierarchy

```
OWNER (Restaurant Owner)
  ↓ Full access to all features
  ↓ Automatically assigned after setup wizard
  ↓ Can manage staff, menus, settings, reports

MANAGER
  ↓ Same permissions as OWNER
  ↓ Manually assigned by owner
  ↓ Can be hired staff with management privileges

SERVER
  ↓ Can take orders, view POS, service dashboard

KITCHEN
  ↓ Can view kitchen display system

AGGREGATOR
  ↓ Can view KDS and aggregator orders
```

## Use Cases

### Restaurant Owner (OWNER role)
- Completes setup wizard
- Automatically logged in as OWNER
- Has full access to all dashboards
- Can manage restaurant settings
- Can hire and assign roles to staff

### Manager (MANAGER role)
- Hired by owner
- Same permissions as owner
- Can perform all management tasks
- Useful for multi-location restaurants or delegated management

### Staff (SERVER, KITCHEN, AGGREGATOR roles)
- Limited access based on role
- Cannot access management features
- Focused on operational tasks

## Benefits

1. **Clear Ownership** - Distinguishes the restaurant owner from hired managers
2. **Automatic Setup** - Owner is auto-logged in after setup wizard
3. **No Manual Login** - Seamless onboarding experience
4. **Role Clarity** - Makes it clear who owns the restaurant
5. **Future Extensibility** - Can add owner-specific features later (e.g., billing, subscription management)

## Testing

```bash
# 1. Clear data
rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos/

# 2. Start app
bun tauri dev

# 3. Complete setup wizard
# - Fill in restaurant info
# - Click "Create Store"
# - Wait for provisioning
# - Click "Go to Dashboard"

# Expected Result:
# ✅ Hub page loads
# ✅ User is logged in as "Restaurant Owner"
# ✅ Role badge shows "OWNER"
# ✅ All dashboards are visible
# ✅ Aggregator status card is visible (desktop only)
```

## Future Enhancements

Potential owner-specific features:
- **Subscription Management** - Owner can manage billing and subscription
- **Multi-Location Management** - Owner can create and manage multiple restaurant locations
- **Staff Permissions** - Owner can grant/revoke manager permissions
- **Data Export** - Owner has full access to export all restaurant data
- **Account Deletion** - Only owner can delete the restaurant account

## Files Modified

1. ✅ `src/types/auth.ts` - Added OWNER role and permissions
2. ✅ `src/components/setup/screens/SystemCheckScreen.tsx` - Changed auto-login to use OWNER role
3. ✅ `src/pages-v2/HubPage.tsx` - Added OWNER to dashboard visibility and aggregator card

## Backwards Compatibility

- Existing managers retain their MANAGER role
- No database migration needed (role is stored in auth state)
- If an old user logs in, they'll keep their existing role
- Only newly completed setup wizards will auto-assign OWNER role

## Notes

- OWNER and MANAGER have identical permissions currently
- The distinction is semantic and organizational
- Future features may differentiate between OWNER and MANAGER
- The OWNER role is only assigned during initial setup wizard completion
