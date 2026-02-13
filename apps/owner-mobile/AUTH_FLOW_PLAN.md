# Owner Mobile App - Authentication Flow Plan

## Current Infrastructure Analysis

### Cloudflare Workers Architecture

1. **Auth Worker** (`/platform/workers/auth`)
   - Uses OpenAuth for authentication
   - Supports email/password and passkeys
   - Handles platform users (super admins, store owners)
   - **Location**: Separate auth service at auth.handsfree.tech

2. **Restaurant Provisioning Worker** (`/platform/workers/restaurant-provisioning`)
   - Generates activation codes for new restaurants
   - Format: `XXXX-XXXX-XXXX-XXXX` (16 alphanumeric characters)
   - Stores in `TENANT_METADATA` KV: `pos_activation:{normalizedCode}`
   - Contains: tenantId, createdAt, usedAt, email, phone

3. **MSG91 Verify Worker** (`/platform/workers/msg91-verify`)
   - SMS/WhatsApp OTP verification
   - Endpoints:
     - `POST /verify/start` - Send OTP to phone
     - `POST /verify/check` - Verify OTP
   - Rate limiting: 3 attempts per hour per phone number

4. **Tenant Worker** (`/platform/workers/tenant-router/tenant-worker`)
   - Handles all tenant-specific API requests
   - Base URL: `https://{tenant-subdomain}.handsfree.tech/api/`
   - Already has Owner & Staff app API endpoints

---

## Proposed Authentication Flow

### For Owner Mobile App

#### Step 1: Tenant Verification (Activation Code)
```
User enters: XXXX-XXXX-XXXX-XXXX
↓
App validates format locally
↓
POST /api/auth/verify-tenant
Body: { activationCode: "XXXX-XXXX-XXXX-XXXX" }
↓
Worker checks TENANT_METADATA KV
↓
Response: {
  success: true,
  tenantId: "uuid",
  tenantName: "Airarang Restaurant",
  subdomain: "airarang",
  apiUrl: "https://airarang.handsfree.tech"
}
```

**Storage:**
- Save `tenantId`, `subdomain`, `apiUrl` in app secure storage
- Show restaurant name for confirmation

#### Step 2: Owner Phone Verification
```
User enters: +919876543210
↓
POST /api/auth/owner/verify-phone
Body: {
  tenantId: "uuid",
  phone: "+919876543210"
}
↓
Worker checks TENANTS_DB if phone matches owner phone
↓
If valid:
  - Generate OTP via MSG91
  - Send SMS
  - Response: { success: true, otpSent: true }
If invalid:
  - Response: { success: false, error: "Phone not registered as owner" }
```

#### Step 3: OTP Verification
```
User enters: 123456
↓
POST /api/auth/owner/verify-otp
Body: {
  tenantId: "uuid",
  phone: "+919876543210",
  otp: "123456"
}
↓
Worker verifies OTP with MSG91
↓
If valid:
  - Generate JWT token
  - Response: {
      success: true,
      token: "jwt-token",
      user: {
        id: "owner-id",
        phone: "+919876543210",
        role: "owner",
        tenantId: "uuid",
        tenantName: "Airarang"
      }
    }
```

#### Step 4: Store Auth State
```
Secure Storage:
  - authToken (JWT)
  - userId
  - userRole (owner)
  - tenantId
  - tenantSubdomain
  - userPhone
  - apiBaseUrl

Set Authorization header for all API calls:
  Authorization: Bearer {authToken}
  X-Tenant-Id: {tenantId}
```

---

### For Staff Mobile App

Similar flow but with staff-specific validation:

#### Step 1: Same - Tenant Verification (Activation Code)

#### Step 2: Staff Phone/PIN Verification
```
POST /api/auth/staff/verify-credentials
Body: {
  tenantId: "uuid",
  phone: "+919876543210",
  pin: "1234"  // Staff PIN
}
↓
Worker checks staff_users table
↓
If valid:
  - Generate JWT token
  - Response: {
      success: true,
      token: "jwt-token",
      user: {
        id: "staff-id",
        phone: "+919876543210",
        name: "Rajesh Kumar",
        role: "waiter",
        tenantId: "uuid",
        locationId: "loc-mg-road"
      }
    }
```

---

## New Worker Endpoints Needed

### 1. Tenant Verification Endpoint

**File**: `/platform/workers/restaurant-provisioning/src/index.ts`

```typescript
// POST /verify-tenant
if (url.pathname === '/verify-tenant' && request.method === 'POST') {
  const { activationCode } = await request.json();

  // Normalize code
  const normalizedCode = activationCode.replace(/-/g, '').toUpperCase();
  const key = `pos_activation:${normalizedCode}`;

  // Check KV
  const data = await env.TENANT_METADATA.get(key);
  if (!data) {
    return Response.json({ success: false, error: 'Invalid activation code' });
  }

  const activationData = JSON.parse(data);

  // Get tenant details from TENANTS_DB
  const tenant = await env.TENANTS_DB.prepare(
    'SELECT * FROM tenants WHERE tenant_id = ?'
  ).bind(activationData.tenantId).first();

  return Response.json({
    success: true,
    tenantId: tenant.tenant_id,
    tenantName: tenant.company_name,
    subdomain: tenant.subdomain,
    apiUrl: `https://${tenant.subdomain}.handsfree.tech`
  });
}
```

### 2. Owner Phone Verification Endpoint

**File**: `/platform/workers/tenant-router/tenant-worker/src/handlers/auth.ts` (new file)

```typescript
export async function verifyOwnerPhone(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  const { phone } = await request.json();

  // Check if phone matches owner phone in TENANTS_DB
  const tenant = await env.TENANTS_DB.prepare(
    'SELECT phone FROM tenants WHERE tenant_id = ? AND phone = ?'
  ).bind(tenantId, phone).first();

  if (!tenant) {
    return Response.json({
      success: false,
      error: 'Phone number not registered as owner'
    }, 403);
  }

  // Send OTP via MSG91
  const otpResponse = await fetch('https://verify.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authkey': env.MSG91_AUTH_KEY
    },
    body: JSON.stringify({
      mobile: phone,
      template_id: env.MSG91_TEMPLATE_ID
    })
  });

  return Response.json({
    success: true,
    otpSent: true,
    message: 'OTP sent to your phone'
  });
}
```

### 3. OTP Verification & Token Generation

```typescript
export async function verifyOwnerOTP(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  const { phone, otp } = await request.json();

  // Verify OTP with MSG91
  const verifyResponse = await fetch('https://verify.msg91.com/api/v5/otp/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authkey': env.MSG91_AUTH_KEY
    },
    body: JSON.stringify({ mobile: phone, otp })
  });

  const result = await verifyResponse.json();

  if (!result.type === 'success') {
    return Response.json({
      success: false,
      error: 'Invalid OTP'
    }, 401);
  }

  // Generate JWT token
  const token = await generateJWT({
    userId: tenantId, // Owner ID = Tenant ID
    phone,
    role: 'owner',
    tenantId
  }, env.JWT_SECRET);

  // Get tenant details
  const tenant = await env.TENANTS_DB.prepare(
    'SELECT * FROM tenants WHERE tenant_id = ?'
  ).bind(tenantId).first();

  return Response.json({
    success: true,
    token,
    user: {
      id: tenantId,
      phone,
      role: 'owner',
      tenantId,
      tenantName: tenant.company_name
    }
  });
}
```

---

## Mobile App Implementation

### File Structure
```
apps/owner-mobile/src/
├── services/
│   ├── auth.ts              # Auth API calls
│   └── storage.ts           # Secure storage
├── stores/
│   └── authStore.ts         # Auth state management
├── screens/
│   ├── auth/
│   │   ├── TenantVerification.tsx
│   │   ├── PhoneVerification.tsx
│   │   └── OTPVerification.tsx
│   └── Dashboard.tsx (existing)
```

### Key Components

#### 1. Auth Service (`services/auth.ts`)
```typescript
export class AuthService {
  async verifyTenant(activationCode: string) {
    const response = await fetch(
      'https://provisioning.handsfree.tech/verify-tenant',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activationCode })
      }
    );
    return response.json();
  }

  async verifyOwnerPhone(tenantId: string, phone: string) {
    // Call tenant-specific worker
  }

  async verifyOTP(tenantId: string, phone: string, otp: string) {
    // Verify and get token
  }
}
```

#### 2. Auth Store (`stores/authStore.ts`)
```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tenantId: string | null;
  apiBaseUrl: string | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}
```

#### 3. Secure Storage (`services/storage.ts`)
```typescript
// Use Tauri secure storage
import { Store } from '@tauri-apps/plugin-store';

const store = new Store('auth.dat');

export async function saveAuth(data: AuthData) {
  await store.set('auth', data);
}

export async function getAuth(): Promise<AuthData | null> {
  return await store.get('auth');
}
```

---

## Security Considerations

1. **Token Storage**: Use Tauri's encrypted store
2. **Token Expiry**: JWT with 7-day expiry, refresh mechanism
3. **Rate Limiting**: Enforce on OTP sending (3/hour)
4. **HTTPS Only**: All API calls over HTTPS
5. **Activation Code**: Single-use, expires after 30 days unused
6. **Phone Verification**: Must match owner phone in database
7. **OTP Expiry**: 10 minutes validity

---

## Migration Path

### Phase 1: Worker Endpoints (Backend)
1. Add `/verify-tenant` to restaurant-provisioning worker
2. Add auth handlers to tenant-worker
3. Integrate MSG91 for OTP
4. Add JWT generation utilities

### Phase 2: Mobile Auth Screens (Frontend)
1. Create auth flow screens
2. Implement auth service
3. Add secure storage
4. Update API service to use auth tokens

### Phase 3: Protected Routes
1. Add auth guard to app
2. Redirect to login if not authenticated
3. Add token refresh logic
4. Handle token expiry

---

## Testing Plan

1. **Tenant Verification**
   - Valid activation code
   - Invalid activation code
   - Expired code
   - Already used code

2. **Phone Verification**
   - Valid owner phone
   - Invalid phone
   - Phone not matching owner
   - Rate limiting

3. **OTP Verification**
   - Valid OTP
   - Invalid OTP
   - Expired OTP
   - Retry mechanism

4. **Token Management**
   - Token storage
   - Token refresh
   - Token expiry handling
   - Logout flow

---

## Next Steps

1. ✅ Analyze current infrastructure
2. ✅ Design auth flow
3. ⏳ Implement worker endpoints
4. ⏳ Implement mobile auth screens
5. ⏳ Test end-to-end flow
6. ⏳ Deploy and validate
