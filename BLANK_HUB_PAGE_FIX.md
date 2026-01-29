# Blank Hub Page Fix

## Problem

After completing the setup wizard and clicking "Go to Dashboard", the hub page showed as a dark blank page with no content.

## Root Cause

The HubPage component has an authentication check that redirects unauthenticated users to the login page:

```typescript
// HubPage.tsx lines 61-66
useEffect(() => {
  if (!isAuthenticated || !user) {
    console.log('[HubPage] Not authenticated, redirecting to login');
    navigate('/login');
  }
}, [isAuthenticated, user, navigate]);
```

During the setup wizard flow, we were:
1. ✅ Saving settings to SQLite
2. ✅ Marking wizard as complete
3. ✅ Storing activation code
4. ❌ **NOT creating a user session**

So when navigating to `/hub`, the page would:
- Mount HubPage component
- Check authentication → sees `isAuthenticated = false`, `user = null`
- Redirect to `/login`
- The Login page has auto-bypass for owners, but by then the page is already blank

## The Fix

Auto-login the restaurant owner immediately after provisioning completes, **before** navigating to the hub.

### File Changed: SystemCheckScreen.tsx

**Location:** After saving settings and marking wizard complete, before `navigate('/hub')`

**Code Added:**
```typescript
// Auto-login the restaurant owner
const { useAuthStore } = await import('../../../stores/authStore');
const { UserRole } = await import('../../../types/auth');

const ownerUser = {
  id: 'owner-1',
  email: wizardData.restaurantInfo?.email || 'owner@restaurant.local',
  name: 'Restaurant Owner',
  role: UserRole.MANAGER,
  tenantId: localStorage.getItem('pos_activation_code') || 'local',
};

const mockTokens = {
  accessToken: 'owner-access-token',
  refreshToken: 'owner-refresh-token',
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
};

useAuthStore.setState({
  user: ownerUser,
  tokens: mockTokens,
  role: UserRole.MANAGER,
  isAuthenticated: true,
  isLoading: false,
  error: null,
});

console.log('[SystemCheckScreen] ✅ Owner auto-login complete');
```

## Testing

```bash
# 1. Clear data
rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos/

# 2. Start app
bun tauri dev

# 3. Complete setup wizard
# - Fill in restaurant info (name, address, contact, tax settings)
# - Click "Create Store"
# - Wait for provisioning to complete
# - Click "Go to Dashboard"

# Expected Result:
# ✅ Hub page loads with dashboard cards visible
# ✅ Restaurant owner is logged in as MANAGER
# ✅ No blank page
# ✅ No redirect loop
```

## What Happens Now

### Before (Blank Page):
```
1. User clicks "Go to Dashboard"
2. SystemCheckScreen:
   - Saves settings ✅
   - Marks wizard complete ✅
   - navigate('/hub')
3. HubPage loads:
   - Checks auth: isAuthenticated = false ❌
   - Redirects to /login
   - Page is blank (mid-redirect)
```

### After (Working):
```
1. User clicks "Go to Dashboard"
2. SystemCheckScreen:
   - Saves settings ✅
   - Marks wizard complete ✅
   - Auto-login owner ✅ NEW!
   - navigate('/hub')
3. HubPage loads:
   - Checks auth: isAuthenticated = true ✅
   - user = { name: "Restaurant Owner", role: MANAGER } ✅
   - Renders hub with dashboard cards ✅
```

## Benefits

1. **Seamless onboarding** - User goes straight to hub after setup
2. **No login required** - Restaurant owner is automatically authenticated
3. **Correct role** - Owner has MANAGER permissions
4. **Persistent auth** - Auth state is persisted via Zustand middleware
5. **No redirect loop** - Single navigation from setup to hub

## Notes

- The auth tokens are mock tokens (not from backend API)
- This is safe for local POS mode where there's no external authentication
- The owner can logout and login as staff members later
- The tenantId is set from the activation code

## Files Modified

- ✅ `src/components/setup/screens/SystemCheckScreen.tsx` - Added owner auto-login before navigation

## Related Issues Fixed

- ✅ Blank hub page after setup
- ✅ Infinite redirect between hub and login
- ✅ Owner not authenticated after provisioning
