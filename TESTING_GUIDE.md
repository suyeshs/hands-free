# POS Authentication Testing Guide

**Date**: 2025-12-18
**Status**: ✅ Ready for Testing

---

## What's Been Implemented

### ✅ Backend (Rust)
- Secure platform keychain storage
- Manager authentication (phone SMS + TOTP)
- Staff PIN authentication (Argon2id hashing)
- Device registration system
- Session management

### ✅ Frontend (React)
- Dual login page (manager/staff toggle)
- Manager login form (phone + SMS + TOTP)
- Staff PIN login with numeric keypad
- Authentication routing in App.tsx
- Logout functionality
- **Tenant-based menu sync** (no more hardcoded values!)

---

## Prerequisites

Before testing, you need to:

1. **Register a device** (one-time setup)
2. **Create at least one staff user** (for staff login testing)

---

## Step 1: Register Device (First Time Setup)

Since the device registration flow isn't implemented yet, you'll need to manually register using Tauri commands:

### Option A: Via Browser Console (Recommended)

Once the app loads and asks for device registration, open the browser dev tools console and run:

```javascript
await window.__TAURI__.invoke('register_device', {
  deviceName: 'POS Terminal 1',
  tenantId: 'khao-piyo-7766',  // Use your actual tenant ID
  tenantName: 'Khao Piyo Restaurant'
});
```

### Option B: Create a Temporary Setup Button

Add this to `Login.tsx` temporarily:

```tsx
// Inside Login component, add a dev button
{!deviceStatus?.isRegistered && (
  <button
    onClick={async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('register_device', {
        deviceName: 'POS Terminal 1',
        tenantId: 'khao-piyo-7766',
        tenantName: 'Khao Piyo Restaurant'
      });
      window.location.reload();
    }}
    className="bg-blue-500 text-white px-4 py-2 rounded"
  >
    Register This Device (Dev Only)
  </button>
)}
```

---

## Step 2: Create Test Staff Users

Once the device is registered and you can access the manager view, create staff users via the Tauri SQL plugin:

### Method 1: Via Browser Console

```javascript
import Database from '@tauri-apps/plugin-sql';

// Load database
const db = await Database.load('sqlite:pos.db');

// Get your tenant ID
const { invoke } = await import('@tauri-apps/api/core');
const deviceStatus = await invoke('check_device_registration');
const tenantId = deviceStatus.tenantId;

// Hash a PIN (e.g., "1234")
const pinHash = await invoke('hash_staff_pin', { pin: '1234' });

// Create staff user
await db.execute(`
  INSERT INTO staff_users (id, tenant_id, name, role, pin_hash, is_active, permissions, created_at)
  VALUES (?, ?, ?, ?, ?, 1, '[]', ?)
`, [
  crypto.randomUUID(),
  tenantId,
  'John Waiter',
  'waiter',
  pinHash,
  Math.floor(Date.now() / 1000)
]);

console.log('Staff user created: John Waiter, PIN: 1234');
```

### Method 2: Create Multiple Staff Users

```javascript
const staffUsers = [
  { name: 'John Waiter', role: 'waiter', pin: '1234' },
  { name: 'Jane Cashier', role: 'cashier', pin: '5678' },
  { name: 'Chef Mike', role: 'kitchen', pin: '9999' },
];

for (const staff of staffUsers) {
  const pinHash = await invoke('hash_staff_pin', { pin: staff.pin });
  await db.execute(`
    INSERT INTO staff_users (id, tenant_id, name, role, pin_hash, is_active, permissions, created_at)
    VALUES (?, ?, ?, ?, ?, 1, '[]', ?)
  `, [
    crypto.randomUUID(),
    tenantId,
    staff.name,
    staff.role,
    pinHash,
    Math.floor(Date.now() / 1000)
  ]);
  console.log(`Created: ${staff.name}, PIN: ${staff.pin}`);
}
```

---

## Testing the Authentication Flows

### Test 1: Staff PIN Login

1. **Start the app**: `npm run tauri dev`
2. You should see the Login page with two tabs: "Staff Login" and "Manager Login"
3. **Select Staff Login tab** (should be default)
4. Choose a staff member from the dropdown (e.g., "John Waiter")
5. Enter the PIN using the numeric keypad (e.g., `1234`)
6. **Expected**: Login successful, redirects to POS dashboard
7. **Verify**: Check browser console for `[App] Login successful`
8. **Test logout**: Click the red logout icon in the sidebar
9. **Expected**: Returns to login page

#### Staff Login Features to Test:
- ✅ PIN masking (dots instead of numbers)
- ✅ Auto-submit when 6 digits entered
- ✅ Manual submit button for 4-5 digit PINs
- ✅ Rate limiting (3 failed attempts → 30s lockout)
- ✅ Clear button
- ✅ Backspace button

### Test 2: Manager Login (Phone + SMS)

1. **Switch to Manager Login tab**
2. Enter a test phone number:
   - Use **+1** prefix (US) or **+91** (India) for bypass mode
   - Example: `+14155551234`
3. Click "Send Verification Code"
4. **Expected**: SMS code input appears
5. Enter **any 6-digit code** (bypass mode allows anything)
   - Example: `123456` or `999999`
6. Click "Verify Code"
7. **If TOTP enabled**: Enter TOTP code from authenticator app
8. **Expected**: Login successful, redirects to POS dashboard

#### Manager Login Features to Test:
- ✅ Phone number validation
- ✅ SMS code input (6 digits)
- ✅ TOTP input (if enabled)
- ✅ Back button navigation
- ✅ Error handling
- ✅ Bypass mode indicator

### Test 3: Session Persistence

1. Login as staff or manager
2. **Refresh the page** (F5 or Cmd+R)
3. **Expected**: Still logged in, no redirect to login page
4. **Verify**:
   - Manager: Session stored in OS keychain
   - Staff: Session in memory (will be lost on app restart)

### Test 4: Tenant-Based Menu Sync

1. Login successfully
2. Navigate to "Manager" tab (menu onboarding)
3. **Expected**: Uses correct tenant ID (from device registration)
4. **Verify**: Check console for tenant ID in network requests
5. **No more hardcoded "default-tenant"!**

---

## Troubleshooting

### Issue: "Device Not Registered" on Login Page

**Solution**: Run the device registration command from Step 1

### Issue: "No staff accounts found"

**Solution**: Create staff users using Step 2

### Issue: Login succeeds but immediately logs out

**Cause**: Session validation may be failing

**Debug**:
```javascript
// Check if session was created
const { invoke } = await import('@tauri-apps/api/core');
const session = await invoke('get_staff_session');
console.log('Staff session:', session);

// Or for manager
const managerSession = await invoke('get_manager_session');
console.log('Manager session:', managerSession);
```

### Issue: Compilation errors

**Solution**: Make sure Tauri dependencies are installed:
```bash
cd src-tauri
cargo check
```

### Issue: TypeScript errors

**Solution**: Install missing npm packages:
```bash
npm install
npm install @tauri-apps/api @tauri-apps/plugin-sql
```

---

## Security Testing

### Test PIN Rate Limiting

1. Login as staff
2. Logout
3. Try to login again with **wrong PIN** 3 times
4. **Expected**: "Too many failed attempts. Try again in 30 seconds"
5. Wait 30 seconds
6. **Expected**: Can login again with correct PIN

### Test Secure Storage (Platform Keychain)

Manager sessions are stored in OS keychains, not localStorage:

**macOS**:
```bash
# Open Keychain Access app
open -a "Keychain Access"

# Search for: restaurant-pos-ai
# You should see entries for:
# - device_registration
# - manager_session (when manager is logged in)
```

**Windows**: Open Credential Manager, search for "restaurant-pos-ai"

**Linux**: Check Secret Service (GNOME Keyring, KWallet, etc.)

---

## Development Tips

### View All Staff Users

```javascript
import Database from '@tauri-apps/plugin-sql';
const db = await Database.load('sqlite:pos.db');
const staff = await db.select('SELECT name, role, is_active FROM staff_users');
console.table(staff);
```

### Delete All Staff Users (Reset)

```javascript
const db = await Database.load('sqlite:pos.db');
await db.execute('DELETE FROM staff_users');
console.log('All staff users deleted');
```

### Reset Device Registration

```javascript
const { invoke } = await import('@tauri-apps/api/core');
await invoke('manager_logout');  // Clear manager session
await invoke('staff_logout');    // Clear staff session

// Then manually delete from keychain (see Security Testing above)
```

### Test with Multiple Tenants

To test switching between tenants, register the device with a different tenant ID and restart the app.

---

## Next Steps (Future Enhancements)

### Setup Wizard (Not Yet Implemented)

Would include:
- Welcome screen
- Manager phone authentication
- TOTP verification
- Tenant selection (if manager has multiple tenants)
- Device naming
- Initial menu sync

### Staff Management UI (Not Yet Implemented)

Would include:
- List all staff users
- Create new staff
- Edit staff (change PIN, permissions)
- Deactivate staff
- View login history

### Offline Menu Sync

Currently, menu items are loaded from local SQLite. Future enhancements:
- Background sync with cloud
- Offline-first operation
- Conflict resolution

---

## Summary Checklist

Before reporting "all works":

- ✅ Device registered successfully
- ✅ At least one staff user created
- ✅ Staff login works with PIN
- ✅ Manager login works with phone + SMS
- ✅ TOTP verification works (if enabled)
- ✅ Session persists on page refresh
- ✅ Logout works (returns to login page)
- ✅ Rate limiting works (3 failed attempts)
- ✅ Tenant ID used correctly (not hardcoded)
- ✅ Menu onboarding uses correct tenant ID

---

**Happy Testing!** 🚀

If you encounter any issues, check the browser console and Rust backend logs for detailed error messages.
