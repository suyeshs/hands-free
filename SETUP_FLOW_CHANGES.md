# Setup Flow Changes - Skip Completion Screen

## Summary
Modified the setup wizard to skip the CompletionScreen and instead show StoreCreationModal directly after SystemCheckScreen, with API health check integrated.

## Changes Made

### 1. **SystemCheckScreen.tsx** - Now Triggers Provisioning Modal
**Location**: [src/components/setup/screens/SystemCheckScreen.tsx](src/components/setup/screens/SystemCheckScreen.tsx)

**What Changed:**
- After system checks complete, shows StoreCreationModal instead of navigating to CompletionScreen
- Integrated restaurant creation API call
- Handles provisioning success/error callbacks
- Saves settings to SQLite after provisioning succeeds
- Navigates to tenant activation screen

**Key Functions:**
```typescript
const createRestaurant = async () => {
  const apiUrl = import.meta.env.VITE_PLATFORM_API_URL || 'https://handsfree-admin.pages.dev';
  const response = await fetch(`${apiUrl}/api/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  });
  return await response.json();
};
```

### 2. **StoreCreationModal.tsx** - API Health Check Added
**Location**: [src/components/StoreCreationModal.tsx](src/components/StoreCreationModal.tsx)

**What Changed:**
- Added API health check BEFORE starting provisioning steps
- Tests connectivity to `VITE_PLATFORM_API_URL`
- Checks if user is offline before attempting provision
- Shows clear error messages if API is unreachable

**Health Check Logic:**
```typescript
// Step 0: Check API health before starting
const apiUrl = import.meta.env.VITE_PLATFORM_API_URL || 'https://handsfree-admin.pages.dev';

try {
  const healthCheck = await fetch(`${apiUrl}`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000), // 5 second timeout
  });

  if (!healthCheck.ok && healthCheck.status !== 404) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('[StoreCreationModal] ✅ API is accessible at', apiUrl);
} catch (healthError: any) {
  // Check if offline
  if (!navigator.onLine) {
    throw new Error('You are offline. Please check your internet connection and try again.');
  }

  // Check if it's a timeout
  if (healthError.name === 'TimeoutError' || healthError.message?.includes('timeout')) {
    throw new Error(`Cannot reach provisioning server (timeout). Please check your internet connection.`);
  }

  throw new Error(`Cannot reach provisioning server at ${apiUrl}. Please check your internet connection or try again later.`);
}
```

## New Setup Flow

### Old Flow (Problematic):
1. User completes wizard screens
2. SystemCheckScreen runs checks
3. **Navigate to CompletionScreen**
4. CompletionScreen tries to provision (freezes if API unreachable)
5. If success, show activation code
6. Navigate to tenant activation

### New Flow (Fixed):
1. User completes wizard screens
2. SystemCheckScreen runs checks
3. **Show StoreCreationModal**
4. **StoreCreationModal checks API health FIRST**
5. If API accessible, proceed with provisioning
6. If API unreachable, show clear error immediately
7. On success, save to SQLite and navigate to activation
8. On error, show error message with retry option

## Benefits

✅ **Faster Error Detection**: API health check happens immediately, no 30-second wait

✅ **Better UX**: User sees provisioning progress in real-time with animated steps

✅ **Clear Error Messages**: Specific guidance for offline, timeout, or API errors

✅ **No Frozen UI**: Modal shows loading states, user knows what's happening

✅ **Consistent with Other Flows**: Uses same StoreCreationModal as SimpleRestaurantOnboarding

## What Happens to CompletionScreen?

The CompletionScreen component still exists but is **no longer used** in the setup wizard flow:
- It's defined in `SCREEN_ORDER` but never reached
- SystemCheckScreen shows modal instead of calling `onComplete()`
- Consider removing it in future cleanup

## API Configuration

The provisioning modal uses the correct environment variable:
```bash
VITE_PLATFORM_API_URL=https://handsfree-admin.pages.dev
```

API endpoint: `/api/tenants` (same as SimpleRestaurantOnboarding)

Request format:
```json
{
  "companyName": "Restaurant Name",
  "email": "owner@restaurant.local",
  "phone": "1234567890",
  "tenantId": "restaurant-name",
  "businessCategory": "RESTAURANT"
}
```

## Testing Checklist

### Test 1: ✅ Happy Path - API Accessible
1. Clear all data
2. Restart dev server: `bun tauri dev`
3. Complete setup wizard
4. SystemCheckScreen should:
   - Run all checks
   - Show StoreCreationModal
5. StoreCreationModal should:
   - Check API health (✅ accessible)
   - Show provisioning steps
   - Display activation code
6. Click "Continue to Activation"
7. Navigate to /tenant-activation

### Test 2: ✅ Offline Mode
1. Clear all data
2. Disconnect network
3. Complete setup wizard
4. SystemCheckScreen runs checks
5. StoreCreationModal opens
6. **Expected**: Immediate error "You are offline. Please check your internet connection and try again."
7. Modal shows error state with "Close" button

### Test 3: ✅ API Timeout
1. Clear all data
2. Throttle network to slow 3G
3. Complete setup wizard
4. SystemCheckScreen runs checks
5. StoreCreationModal opens
6. **Expected**: After 5 seconds, error "Cannot reach provisioning server (timeout)..."
7. Modal shows error state

### Test 4: ✅ API Error (404, 500, etc.)
1. Clear all data
2. Set invalid API URL: `VITE_PLATFORM_API_URL=https://invalid.example.com`
3. Complete setup wizard
4. **Expected**: Error "Cannot reach provisioning server at https://invalid.example.com..."

## Error Messages

The modal now shows specific errors:

| Scenario | Error Message |
|----------|---------------|
| Offline | "You are offline. Please check your internet connection and try again." |
| Timeout | "Cannot reach provisioning server (timeout). Please check your internet connection." |
| API Error | "Cannot reach provisioning server at [URL]. Please check your internet connection or try again later." |
| Provisioning Failed | Shows API error message from response |

## Files Modified

1. ✅ [src/components/setup/screens/SystemCheckScreen.tsx](src/components/setup/screens/SystemCheckScreen.tsx)
   - Added StoreCreationModal integration
   - Added createRestaurant function
   - Added success/error handlers
   - Removed navigation to CompletionScreen

2. ✅ [src/components/StoreCreationModal.tsx](src/components/StoreCreationModal.tsx)
   - Added API health check before provisioning
   - Added timeout handling (5 seconds)
   - Added offline detection
   - Added specific error messages

## Next Steps

**Optional Cleanup:**
- Remove CompletionScreen from SCREEN_ORDER in setupWizardStore.ts
- Remove 'completion' from SetupScreen type
- Remove CompletionScreen.tsx file (or keep for reference)

**Enhancements:**
- Add retry button in StoreCreationModal error state
- Add "Skip Provisioning" option for offline setup
- Add progress percentage to modal
- Add health check endpoint (`/health` or `/api/health`) on backend

## Verification

**How to verify the fix:**
1. Run `bun tauri dev`
2. Complete setup wizard
3. Watch console logs for:
   ```
   [SystemCheckScreen] All checks complete, showing provisioning modal
   [StoreCreationModal] 🔍 Checking API health...
   [StoreCreationModal] ✅ API is accessible at https://handsfree-admin.pages.dev
   [StoreCreationModal] Creating tenant with data: ...
   ```

**Success Indicators:**
- ✅ No navigation to CompletionScreen
- ✅ StoreCreationModal appears after system checks
- ✅ API health check runs before provisioning
- ✅ Clear error if API is unreachable
- ✅ Settings saved to SQLite after success
- ✅ Navigates to /tenant-activation

---

## Summary

The setup wizard now:
1. ✅ Skips the problematic CompletionScreen
2. ✅ Shows StoreCreationModal directly after system checks
3. ✅ Checks API health before attempting provisioning
4. ✅ Shows immediate, clear errors if API unreachable
5. ✅ Uses correct API endpoint (`/api/tenants`)
6. ✅ Saves to SQLite after successful provisioning
7. ✅ Provides better UX with animated progress

**No more frozen completion screens!**
