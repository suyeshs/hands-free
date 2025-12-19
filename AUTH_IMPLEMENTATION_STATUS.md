# POS Authentication Implementation Status

**Date**: 2025-12-18
**Status**: ✅ **Rust Backend Complete** | 🚧 Frontend In Progress

---

## ✅ Completed: Rust Backend (Phase 1)

### 1. Secure Storage Infrastructure
**Location**: `src-tauri/src/storage/secure.rs`

- ✅ Platform-specific keychain integration (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- ✅ Device registration storage
- ✅ Manager session storage (secure, encrypted)
- ✅ Session validation helpers

**Key Features**:
- Uses `keyring` crate for cross-platform secure storage
- All sensitive data (device registration, manager sessions) stored in OS keychains
- NOT stored in localStorage (security improvement over web version)

---

### 2. Device Registration System
**Files**:
- `src-tauri/src/storage/secure.rs` - Storage
- `src-tauri/src/commands/auth.rs` - Commands

**Tauri Commands**:
```rust
check_device_registration() -> DeviceStatusResponse
register_device(device_name, tenant_id, tenant_name) -> RegisterDeviceResponse
```

**Device Registration Structure**:
```rust
struct DeviceRegistration {
    device_id: String,        // UUID v4
    device_name: String,      // e.g., "POS Terminal 1"
    tenant_id: String,        // e.g., "khao-piyo-7766"
    tenant_name: String,      // e.g., "Khao Piyo Restaurant"
    registered_at: i64,       // Unix timestamp
}
```

**Flow**:
1. On first launch → Setup wizard
2. Manager authenticates via phone + TOTP
3. Device permanently registered to one tenant (kiosk mode)
4. Registration stored in platform keychain

---

### 3. Manager Authentication
**Files**:
- `src-tauri/src/network/auth_worker.rs` - Auth worker HTTP client
- `src-tauri/src/commands/auth.rs` - Tauri commands

**Integration**: Uses existing `auth.handsfree.tech` worker (same as web restaurant-client)

**Tauri Commands**:
```rust
manager_login_start(phone: String) -> StartLoginResponse
manager_login_verify(phone: String, code: String, verification_sid: String) -> VerifyLoginResponse
manager_totp_verify(totp_code: String, temp_token: String) -> VerifyTotpResponse
manager_logout() -> Result<(), String>
check_manager_auth() -> Result<bool, String>
get_manager_session() -> Result<Option<ManagerSessionInfo>, String>
```

**Auth Flow**:
```
1. manager_login_start(phone)
   ↓
2. Auth worker sends SMS code
   ↓
3. manager_login_verify(phone, code, sid)
   ↓
4. If TOTP enabled: manager_totp_verify(totp, temp_token)
   ↓
5. Session stored in platform keychain
```

**Supported Auth Methods**:
- ✅ Phone SMS verification (via Twilio)
- ✅ TOTP (Google Authenticator, Authy, etc.)
- ✅ Bypass mode for testing (+1, +91 numbers)

---

### 4. Staff PIN Authentication
**Files**:
- `src-tauri/src/commands/staff_auth.rs` - PIN hashing/verification utilities
- `src-tauri/migrations/001_staff_users.sql` - Database schema

**Security**: Argon2id PIN hashing (64 MiB memory, 3 iterations)

**Tauri Commands**:
```rust
// PIN Security
hash_staff_pin(pin: String) -> Result<String, String>
verify_staff_pin(pin: String, pin_hash: String) -> Result<bool, String>
is_valid_pin(pin: &str) -> bool  // 4-6 digits

// Rate Limiting
check_staff_login_rate_limit(staff_name: String) -> Result<(), String>
record_failed_login_attempt(staff_name: String) -> Result<(), String>
clear_failed_login_attempts(staff_name: String) -> Result<(), String>

// Session Management
set_staff_session(staff_user: StaffUser) -> Result<(), String>
staff_logout() -> Result<(), String>
get_staff_session() -> Result<Option<StaffSession>, String>
is_staff_authenticated() -> Result<bool, String>
```

**Database Schema** (`staff_users` table):
```sql
CREATE TABLE staff_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'cashier', 'waiter', 'kitchen', 'manager'
    pin_hash TEXT NOT NULL,  -- Argon2id hash
    is_active INTEGER DEFAULT 1,
    permissions TEXT,  -- JSON array
    created_at INTEGER NOT NULL,
    last_login_at INTEGER,
    UNIQUE(tenant_id, name)
);
```

**Rate Limiting**:
- 3 failed attempts → 30 second lockout
- Constant-time PIN verification (prevents timing attacks)
- In-memory failed attempt tracking

---

### 5. Dependencies Added
**Cargo.toml**:
```toml
# Authentication & Security
argon2 = { version = "0.5", features = ["std"] }
password-hash = { version = "0.5", features = ["rand_core"] }
rand = "0.8"
keyring = "2.3"
ring = "0.17"
reqwest = { version = "0.11", features = ["json"] }
tokio = { version = "1", features = ["full"] }
sha2 = "0.10"
hex = "0.4"
base64 = "0.21"
```

---

## 🚧 TODO: React Frontend Implementation

### 1. Setup Wizard (`src/pages/SetupWizard.tsx`)

**Required Steps**:
1. Welcome screen with branding
2. Manager phone authentication
   - Call `invoke('manager_login_start', { phone })`
   - Show SMS code input
   - Call `invoke('manager_login_verify', { phone, code, verificationSid })`
3. TOTP verification (if required)
   - Call `invoke('manager_totp_verify', { totpCode, tempToken })`
4. Tenant selection (if manager has multiple tenants)
5. Device naming
   - Call `invoke('register_device', { deviceName, tenantId, tenantName })`
6. Initial sync (download menu, config)

**Reference**: Look at `/Users/stonepot-tech/stonepot-platform/handsfree-platform/restaurant-client/app/auth/login/page.tsx` for UI patterns

---

### 2. Dual Login Screen (`src/pages/Login.tsx`)

**UI Layout**:
```tsx
<div className="login-screen">
  {/* Toggle: Manager vs Staff */}
  <Tabs defaultValue="staff">
    <Tab value="manager">👤 Manager</Tab>
    <Tab value="staff">👥 Staff</Tab>
  </Tabs>

  {mode === 'manager' ? (
    <ManagerLoginForm />  // Phone + SMS + TOTP
  ) : (
    <StaffPinLogin />     // Name + 4-6 digit PIN
  )}

  <DeviceInfo />  {/* Show tenant name, device name */}
  <OfflineIndicator />
</div>
```

**Manager Login Form**:
1. Phone number input
2. Send SMS code
3. Verify code
4. If TOTP required: show TOTP input
5. On success: redirect to /admin

**Staff PIN Login Form**:
1. Staff name dropdown (from `staff_users` table)
2. 4-6 digit PIN input (numeric keypad)
3. Verify PIN:
   ```tsx
   const { invoke } = useTauri();

   // Check rate limit
   await invoke('check_staff_login_rate_limit', { staffName });

   // Query staff from database (use Tauri SQL plugin)
   const staff = await db.select('SELECT * FROM staff_users WHERE name = ? AND tenant_id = ?', [name, tenantId]);

   // Verify PIN
   const isValid = await invoke('verify_staff_pin', { pin, pinHash: staff.pin_hash });

   if (isValid) {
     await invoke('clear_failed_login_attempts', { staffName });
     await invoke('set_staff_session', { staffUser: staff });
     router.push('/pos');
   } else {
     await invoke('record_failed_login_attempt', { staffName });
   }
   ```
4. On success: redirect to /pos

---

### 3. Staff Management UI (`src/pages/StaffManagement.tsx`)

**Features** (Manager only):
- List all staff users
  ```tsx
  const staff = await db.select('SELECT * FROM staff_users WHERE tenant_id = ?', [tenantId]);
  ```
- Create new staff
  ```tsx
  const pinHash = await invoke('hash_staff_pin', { pin });
  await db.execute('INSERT INTO staff_users ...', [id, tenantId, name, role, pinHash, ...]);
  ```
- Update staff PIN
  ```tsx
  const newPinHash = await invoke('hash_staff_pin', { pin: newPin });
  await db.execute('UPDATE staff_users SET pin_hash = ? WHERE id = ?', [newPinHash, staffId]);
  ```
- Deactivate staff
  ```tsx
  await db.execute('UPDATE staff_users SET is_active = 0 WHERE id = ?', [staffId]);
  ```

**Permissions**: Only accessible when `check_manager_auth()` returns true

---

### 4. App Routing (`src/App.tsx`)

```tsx
function App() {
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const status = await invoke('check_device_registration');
      setDeviceStatus(status);

      if (status.isRegistered) {
        const managerAuth = await invoke('check_manager_auth');
        const staffAuth = await invoke('is_staff_authenticated');
        setIsAuthenticated(managerAuth || staffAuth);
      }
    }
    checkAuth();
  }, []);

  if (!deviceStatus?.isRegistered) {
    return <SetupWizard />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <POSDashboard />;
}
```

---

### 5. Tauri Service Wrapper (`src/services/tauriService.ts`)

Create typed wrappers for Tauri commands:

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface DeviceStatus {
  isRegistered: boolean;
  deviceId?: string;
  deviceName?: string;
  tenantId?: string;
  tenantName?: string;
}

export interface StaffUser {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  createdAt: number;
  lastLoginAt?: number;
}

export const tauriAuth = {
  // Device registration
  checkDevice: () => invoke<DeviceStatus>('check_device_registration'),
  registerDevice: (deviceName: string, tenantId: string, tenantName: string) =>
    invoke('register_device', { deviceName, tenantId, tenantName }),

  // Manager auth
  managerLoginStart: (phone: string) => invoke('manager_login_start', { phone }),
  managerLoginVerify: (phone: string, code: string, verificationSid: string) =>
    invoke('manager_login_verify', { phone, code, verificationSid }),
  managerTotpVerify: (totpCode: string, tempToken: string) =>
    invoke('manager_totp_verify', { totpCode, tempToken }),
  managerLogout: () => invoke('manager_logout'),
  checkManagerAuth: () => invoke<boolean>('check_manager_auth'),

  // Staff auth
  hashStaffPin: (pin: string) => invoke<string>('hash_staff_pin', { pin }),
  verifyStaffPin: (pin: string, pinHash: string) =>
    invoke<boolean>('verify_staff_pin', { pin, pinHash }),
  isValidPin: (pin: string) => invoke<boolean>('is_valid_pin', { pin }),
  checkRateLimit: (staffName: string) =>
    invoke('check_staff_login_rate_limit', { staffName }),
  recordFailedAttempt: (staffName: string) =>
    invoke('record_failed_login_attempt', { staffName }),
  clearFailedAttempts: (staffName: string) =>
    invoke('clear_failed_login_attempts', { staffName }),
  setStaffSession: (staffUser: StaffUser) =>
    invoke('set_staff_session', { staffUser }),
  staffLogout: () => invoke('staff_logout'),
  getStaffSession: () => invoke<StaffUser | null>('get_staff_session'),
  isStaffAuthenticated: () => invoke<boolean>('is_staff_authenticated'),
};
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    POS Application (Tauri)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │ Setup Wizard │ → │ Login Screen │ → │ POS Dashboard│   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                      Tauri Commands                         │
│  ┌─────────────────────┐   ┌─────────────────────┐         │
│  │ Manager Auth        │   │ Staff Auth          │         │
│  │ - login_start       │   │ - hash_pin          │         │
│  │ - login_verify      │   │ - verify_pin        │         │
│  │ - totp_verify       │   │ - set_session       │         │
│  │ - logout            │   │ - logout            │         │
│  └─────────────────────┘   └─────────────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Rust Backend                             │
│  ┌───────────────────┐   ┌───────────────────┐             │
│  │ Auth Worker Client│   │ Secure Storage    │             │
│  │ (auth.handsfree)  │   │ (Platform Keychain│             │
│  └────────┬──────────┘   └─────────┬─────────┘             │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌───────────────────────────────────────────┐             │
│  │          SQLite Database (pos.db)         │             │
│  │  - staff_users (PIN hashes)               │             │
│  │  - staff_login_history                    │             │
│  │  - menu_items, orders, etc.               │             │
│  └───────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
              ┌──────────────────────────┐
              │  auth.handsfree.tech     │
              │  (Phone SMS + TOTP)      │
              └──────────────────────────┘
```

---

## Security Features Implemented

✅ **Platform Keychain Storage**
- Device registration encrypted in OS keychain
- Manager sessions NOT stored in localStorage
- Automatic encryption via OS-level keychain APIs

✅ **Argon2id PIN Hashing**
- 64 MiB memory, 3 iterations
- Constant-time verification (prevents timing attacks)
- Per-PIN unique salt

✅ **Rate Limiting**
- 3 failed PIN attempts → 30 second lockout
- In-memory tracking (resets on app restart)

✅ **TOTP Support**
- Integrates with existing auth worker TOTP
- Requires manager re-authentication for sensitive operations

✅ **Session Isolation**
- Manager sessions: Stored in keychain
- Staff sessions: In-memory only (cleared on logout)
- No session data in localStorage or IndexedDB

---

## Testing the Rust Backend

```bash
cd src-tauri

# Test compilation
cargo check

# Run tests (if any)
cargo test

# Build for development
cargo build

# Build for production
cargo build --release
```

**Compilation Status**: ✅ Success (only unused code warnings)

---

## Next Steps (Frontend)

1. ⏳ Create `src/services/tauriService.ts` (TypeScript wrappers)
2. ⏳ Build `src/pages/SetupWizard.tsx` (device registration)
3. ⏳ Build `src/pages/Login.tsx` (dual manager/staff login)
4. ⏳ Build `src/components/auth/ManagerLoginForm.tsx`
5. ⏳ Build `src/components/auth/StaffPinLogin.tsx`
6. ⏳ Build `src/pages/StaffManagement.tsx` (manager only)
7. ⏳ Update `src/App.tsx` (add auth routing)
8. ⏳ Test end-to-end flows

---

## Reference Files

**Web Restaurant Client** (for UI patterns):
- `/Users/stonepot-tech/stonepot-platform/handsfree-platform/restaurant-client/app/auth/login/page.tsx`
- `/Users/stonepot-tech/stonepot-platform/handsfree-platform/restaurant-client/components/auth/AuthProvider.tsx`

**Auth Worker** (API contracts):
- `/Users/stonepot-tech/stonepot-platform/handsfree-platform/auth-worker/src/index.ts`

---

**Last Updated**: 2025-12-18
**Backend Status**: ✅ Complete
**Frontend Status**: 🚧 Pending
