# Data Workflow & Routing Flow

Complete documentation of data collection, storage, and routing from onboarding to hub page.

---

## 🔄 Complete Flow Overview

```
App Start
  ↓
Check Authentication
  ↓
Not Authenticated → Onboarding Form
  ↓
Collect Basic Data (4 fields)
  ↓
Create Tenant (Backend API)
  ↓
Store Metadata (Local SQLite)
  ↓
Auto-Activate Tenant
  ↓
Store Auth (localStorage + SQLite)
  ↓
Redirect to Hub Page
  ↓
Show Contextual Setup Guide
```

---

## 📊 Data Collection Flow

### Stage 1: Onboarding Form
**Component**: `SimpleRestaurantOnboarding.tsx`
**Route**: `/` or `/onboarding`

#### Data Collected:
```typescript
{
  restaurantName: string;    // User input: "The Coorg Food Company"
  email: string;             // User input: "owner@restaurant.com"
  phone: string;             // User input: "+91 98765 43210"
  subdomain: string;         // Auto-generated: "coorg-food-company-1234"
}
```

#### Data Storage:
- **Temporary**: React state (not persisted yet)
- **Backend Request**: Sent to `/api/tenants` endpoint

---

### Stage 2: Tenant Creation
**Component**: `StoreCreationModal.tsx`
**API**: `POST https://handsfree-admin.pages.dev/api/tenants`

#### Request Payload:
```json
{
  "companyName": "The Coorg Food Company",
  "email": "owner@restaurant.com",
  "phone": "+91 98765 43210",
  "tenantId": "coorg-food-company-1234",
  "businessCategory": "RESTAURANT"
}
```

#### Response:
```json
{
  "success": true,
  "tenantId": "coorg-food-company-1234",
  "subdomain": "coorg-food-company-1234",
  "activationCode": "ABC123XYZ",
  "status": "PROVISIONED",

  // Provisioned Cloudflare resources
  "cloudflareResources": {
    "kvNamespaceId": "a1b2c3d4e5f6",
    "r2BucketName": "handsfree-coorg-food-company-1234",
    "d1DatabaseId": "1234-5678-9abc-def0",
    "d1DatabaseName": "handsfree-coorg-food-company-1234"
  },

  // OR flat structure (backend can return either)
  "kvNamespaceId": "a1b2c3d4e5f6",
  "r2BucketName": "handsfree-coorg-food-company-1234",
  "d1DatabaseId": "1234-5678-9abc-def0",
  "d1DatabaseName": "handsfree-coorg-food-company-1234"
}
```

**Cloudflare Resources Provisioned**:
- **KV Namespace**: Key-value store for tenant configuration, menu cache, session data
- **R2 Bucket**: Object storage for images, PDFs, receipts, backups
- **D1 Database**: SQL database for orders, transactions, analytics (cloud copy of local SQLite)
- **Worker**: Serverless edge function for API endpoints, real-time sync

#### Data Storage:
- **localStorage**: `setup-wizard-storage` → activation code stored
- **Not yet in SQLite** (comes next)

---

### Stage 3: Local Metadata Storage
**Service**: `tenantProvisioning.ts` → `storeTenantMetadata()`
**Database**: SQLite (`pos.db`)

#### Data Stored:
```typescript
{
  // From onboarding form
  tenantId: "coorg-food-company-1234",
  companyName: "The Coorg Food Company",
  email: "owner@restaurant.com",
  phone: "+91 98765 43210",
  businessCategory: "RESTAURANT",
  subdomain: "coorg-food-company-1234",

  // From API response
  activationCode: "ABC123XYZ",
  status: "PROVISIONED",

  // Provisioned Cloudflare resources
  cloudflareResources: {
    kvNamespaceId: "a1b2c3d4e5f6",           // KV for config/cache
    r2BucketName: "handsfree-coorg-...",      // R2 for images/files
    d1DatabaseId: "1234-5678-9abc-def0",      // D1 for cloud sync
    d1DatabaseName: "handsfree-coorg-..."     // D1 database name
  },

  // Setup progress tracking
  setupProgress: {
    provisioned: true,        // ✅ Just completed
    menuUploaded: false,      // ⏳ Next step
    photosUploaded: false,
    detailsCompleted: false,
    staffAdded: false,
    testOrderCompleted: false
  },

  // Timestamps
  createdAt: "2025-01-22T10:30:00Z",
  updatedAt: "2025-01-22T10:30:00Z"
}
```

#### Storage Location:
```sql
-- SQLite table: restaurant_settings
INSERT INTO restaurant_settings (key, value)
VALUES ('tenant_metadata', '<JSON_STRING_ABOVE>');
```

---

### Stage 4: Tenant Activation
**Component**: `TenantActivation.tsx` (auto-triggered)
**API**: `POST https://handsfree-admin.pages.dev/api/tenants/activate`

#### Request:
```json
{
  "tenantId": "coorg-food-company-1234",
  "activationCode": "ABC123XYZ"
}
```

#### Response:
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "name": "Restaurant Owner",
    "email": "owner@restaurant.com",
    "role": "OWNER",
    "tenantId": "coorg-food-company-1234"
  }
}
```

#### Data Storage:

**1. localStorage (auth-storage)**:
```json
{
  "state": {
    "user": {
      "id": "user_123",
      "name": "Restaurant Owner",
      "email": "owner@restaurant.com",
      "role": "OWNER",
      "tenantId": "coorg-food-company-1234"
    },
    "isAuthenticated": true
  },
  "version": 0
}
```

**2. localStorage (tenant-storage)**:
```json
{
  "state": {
    "tenant": {
      "tenantId": "coorg-food-company-1234",
      "subdomain": "coorg-food-company-1234",
      "status": "ACTIVE"
    }
  }
}
```

**3. SQLite (staff_users table)**:
```sql
INSERT INTO staff_users (id, name, email, role, tenant_id, is_active)
VALUES (
  'user_123',
  'Restaurant Owner',
  'owner@restaurant.com',
  'OWNER',
  'coorg-food-company-1234',
  1
);
```

---

### Stage 5: Hub Page Load
**Component**: `HubPage.tsx`
**Route**: `/hub`

#### Data Retrieved:

**1. From localStorage (auth-storage)**:
```typescript
const { user, isAuthenticated } = useAuthStore();
// user = { id, name, email, role, tenantId }
// isAuthenticated = true
```

**2. From SQLite (tenant_metadata)**:
```typescript
const metadata = await getTenantMetadata();
// Returns full TenantMetadata object with setupProgress
```

**3. From other stores**:
```typescript
const { activeOrders } = useKDSStore();         // Kitchen orders
const { activeTables } = usePOSStore();         // POS tables
const { requests } = useServiceRequestStore();  // Service requests
const { orders } = useAggregatorStore();        // Aggregator orders
```

---

## 🛣️ Routing & Redirection Flow

### Entry Points

#### 1. App.tsx (Root Router)
```typescript
// Protected route check
useEffect(() => {
  if (!isAuthenticated) {
    navigate('/');  // Redirect to onboarding/login
  }
}, [isAuthenticated]);

// Routes
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/onboarding" element={<Onboarding />} />
  <Route path="/activation" element={<TenantActivation />} />
  <Route path="/hub" element={<HubPage />} />
  <Route path="/menu" element={<MenuManagement />} />
  <Route path="/images" element={<ImageManagement />} />
  <Route path="/settings" element={<SettingsPage />} />
  // ... other routes
</Routes>
```

---

### Flow 1: Fresh Installation (No Data)

```
User opens app
  ↓
App.tsx loads
  ↓
Check: isAuthenticated? → NO
  ↓
Show: SimpleRestaurantOnboarding component
  ↓
User fills form & clicks "Create Restaurant"
  ↓
StoreCreationModal.tsx shows progress
  ↓
API call: POST /api/tenants
  ↓
Success → activationCode returned
  ↓
storeTenantMetadata() called
  ↓
localStorage updated with activation code
  ↓
onComplete(activationCode) called
  ↓
Parent component triggers TenantActivation
  ↓
API call: POST /api/tenants/activate
  ↓
Success → user object returned
  ↓
useAuthStore.setState({ user, isAuthenticated: true })
  ↓
useTenantStore.setState({ tenant })
  ↓
localStorage & SQLite updated
  ↓
navigate('/hub')
  ↓
HubPage.tsx loads
  ↓
Fetch tenant metadata: getTenantMetadata()
  ↓
Calculate setup completion: 17% (only provisioned)
  ↓
Show ContextualSetupGuide
  ↓
Display: "📋 Upload Your Menu - MOST IMPORTANT"
```

---

### Flow 2: Returning User (Has Data)

```
User opens app
  ↓
App.tsx loads
  ↓
Check localStorage: auth-storage exists? → YES
  ↓
useAuthStore hydrates from localStorage
  ↓
isAuthenticated = true
  ↓
navigate('/hub')
  ↓
HubPage.tsx loads
  ↓
Fetch tenant metadata: getTenantMetadata()
  ↓
Calculate setup completion: X%
  ↓
If X < 100%:
  Show ContextualSetupGuide with next action
Else:
  Hide guide, show normal dashboard
```

---

### Flow 3: After Menu Upload

```
User clicks "Upload Your Menu" on Hub
  ↓
navigate('/menu')
  ↓
MenuManagement.tsx loads
  ↓
User uploads PDF/Excel/photos
  ↓
Menu extracted and stored in SQLite
  ↓
updateSetupProgress({ menuUploaded: true })
  ↓
SQLite updated: tenant_metadata.setupProgress.menuUploaded = true
  ↓
User navigates back to Hub
  ↓
HubPage.tsx re-fetches metadata
  ↓
Calculate completion: 33%
  ↓
ContextualSetupGuide updates
  ↓
Display: "📸 Add Menu Photos" (next action)
```

---

## 📍 Key Components & Their Data

### SimpleRestaurantOnboarding.tsx
**Reads**: Nothing (fresh start)
**Writes**:
- Sends data to backend API
- Calls `storeTenantMetadata()`
- Stores activation code in localStorage

**Navigation**:
- Entry: Direct render or route `/onboarding`
- Exit: Calls `onComplete()` → triggers activation → redirects to `/hub`

---

### StoreCreationModal.tsx
**Reads**: Props (createStoreFn)
**Writes**:
- localStorage: `setup-wizard-storage` (activation code)

**Navigation**:
- Entry: Opened by parent (SimpleRestaurantOnboarding)
- Exit: Closes and calls `onComplete(activationCode)`

---

### TenantActivation.tsx
**Reads**:
- localStorage: `setup-wizard-storage` (activation code)
- Props: activation code from parent

**Writes**:
- localStorage: `auth-storage` (user)
- localStorage: `tenant-storage` (tenant)
- SQLite: `staff_users` table (owner user)

**Navigation**:
- Entry: Auto-triggered after onboarding
- Exit: `navigate('/hub')` after successful activation

---

### HubPage.tsx
**Reads**:
- localStorage: `auth-storage` (via useAuthStore)
- SQLite: `tenant_metadata` (via getTenantMetadata)
- SQLite: Orders, tables, requests (via various stores)

**Writes**: Nothing (read-only display)

**Navigation**:
- Entry: Default landing for authenticated users
- Exit: User clicks dashboard card → `navigate('/pos')` etc.

---

### ContextualSetupGuide.tsx
**Reads**:
- SQLite: `tenant_metadata` (via getTenantMetadata)
- Calculates completion % and next action

**Writes**: Nothing (read-only)

**Navigation**:
- Entry: Rendered inside HubPage
- Exit: User clicks action card → `navigate(nextAction.route)`

---

## 🗂️ Data Storage Summary

### localStorage Keys

| Key | Content | When Set | When Read |
|-----|---------|----------|-----------|
| `auth-storage` | User object, isAuthenticated | After activation | App load, HubPage |
| `tenant-storage` | Tenant object (tenantId, subdomain) | After activation | App load, all pages |
| `restaurant-settings-storage` | Restaurant settings | Various pages | Settings page |
| `setup-wizard-storage` | Activation code, wizard state | During onboarding | Activation flow |
| `daily-sales-storage` | Daily sales cache | POS page | Reports page |
| `language-storage` | UI language preference | Language selector | App load |

---

### SQLite Tables

| Table | Data | When Written | When Read |
|-------|------|--------------|-----------|
| `restaurant_settings` | tenant_metadata JSON | After onboarding | Hub page load |
| `staff_users` | Owner/staff accounts | After activation | Login, staff pages |
| `menu_items` | Menu items from upload | Menu upload | POS, KDS, Menu pages |
| `menu_categories` | Menu categories | Menu upload | POS, Menu pages |
| `unassigned_images` | Uploaded photos | Photo upload | Image management |
| `aggregator_orders` | Delivery orders | Order sync | KDS, aggregator pages |
| `table_sessions` | Active tables | POS usage | Service dashboard |
| `sales_transactions` | Completed orders | Order completion | Reports page |

---

## 🔐 Authentication State

### Authenticated State Structure:
```typescript
{
  user: {
    id: string;
    name: string;
    email: string;
    role: 'OWNER' | 'MANAGER' | 'SERVER' | 'KITCHEN';
    tenantId: string;
  },
  isAuthenticated: boolean;
}
```

### Authentication Check Flow:
```typescript
// In protected routes
useEffect(() => {
  if (!isAuthenticated) {
    navigate('/');  // Back to onboarding/login
  }
}, [isAuthenticated, navigate]);
```

---

## 🎯 Setup Progress Tracking

### Progress States:
```typescript
setupProgress: {
  provisioned: boolean;      // After onboarding
  menuUploaded: boolean;     // After menu upload
  photosUploaded: boolean;   // After photo upload
  detailsCompleted: boolean; // After details form
  staffAdded: boolean;       // After adding staff
  testOrderCompleted: boolean; // After first order
}
```

### Progress Update Locations:

1. **Menu Upload** → `MenuManagement.tsx`
   ```typescript
   await updateSetupProgress({ menuUploaded: true });
   ```

2. **Photo Upload** → `ImageUploader.tsx`
   ```typescript
   await updateSetupProgress({ photosUploaded: true });
   ```

3. **Details Completion** → `RestaurantDetailsForm.tsx`
   ```typescript
   await updateRestaurantDetails({ address, city, ... });
   // Automatically sets detailsCompleted: true
   ```

4. **Staff Addition** → `StaffManagement.tsx`
   ```typescript
   await updateSetupProgress({ staffAdded: true });
   ```

5. **Test Order** → `POSDashboard.tsx`
   ```typescript
   await updateSetupProgress({ testOrderCompleted: true });
   ```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Opens App                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Check localStorage   │
              │   (auth-storage)     │
              └──────────┬───────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
    ┌───────────────┐         ┌──────────────┐
    │ Not Found/    │         │ Found &      │
    │ Invalid       │         │ Valid        │
    └───────┬───────┘         └──────┬───────┘
            │                        │
            ▼                        ▼
    ┌───────────────┐         ┌──────────────┐
    │ Onboarding    │         │ navigate(    │
    │ Form          │         │   '/hub'     │
    │               │         │ )            │
    └───────┬───────┘         └──────┬───────┘
            │                        │
            ▼                        ▼
    ┌───────────────┐         ┌──────────────┐
    │ User fills    │         │ Hub Page     │
    │ 4 fields      │         │ Loads        │
    └───────┬───────┘         └──────┬───────┘
            │                        │
            ▼                        ▼
    ┌───────────────┐         ┌──────────────┐
    │ POST /api/    │         │ Fetch        │
    │ tenants       │         │ tenant       │
    └───────┬───────┘         │ metadata     │
            │                 └──────┬───────┘
            ▼                        │
    ┌───────────────┐                │
    │ Store         │                ▼
    │ Metadata      │         ┌──────────────┐
    │ (SQLite)      │         │ Calculate    │
    └───────┬───────┘         │ completion   │
            │                 └──────┬───────┘
            ▼                        │
    ┌───────────────┐                │
    │ POST /api/    │                ▼
    │ activate      │         ┌──────────────┐
    └───────┬───────┘         │ Show Setup   │
            │                 │ Guide        │
            ▼                 └──────────────┘
    ┌───────────────┐
    │ Store Auth    │
    │ (localStorage │
    │ + SQLite)     │
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ navigate(     │
    │   '/hub'      │
    │ )             │
    └───────────────┘
```

---

## 🔍 Debug & Inspect Data

### Check localStorage:
```javascript
// Open browser console (F12)

// Auth state
JSON.parse(localStorage.getItem('auth-storage'))

// Tenant state
JSON.parse(localStorage.getItem('tenant-storage'))

// Setup wizard
JSON.parse(localStorage.getItem('setup-wizard-storage'))
```

### Check SQLite:
```typescript
// In any component
import { getTenantMetadata } from './services/tenantProvisioning';

const metadata = await getTenantMetadata();
console.log('Tenant Metadata:', metadata);
console.log('Setup Progress:', metadata.setupProgress);
console.log('Completion:', calculateSetupCompletion(metadata));
```

### Reset Everything:
```bash
# Use the reset utility
open reset-tenant.html
# OR
./reset-all-data.sh
```

---

## ✅ Data Validation

### At Onboarding:
- Restaurant name: Required, min 3 chars
- Email: Required, valid email format
- Phone: Required, international format (+XX...)
- Subdomain: Auto-generated, checked for availability

### At Activation:
- Activation code: Required, must match backend
- User must not already exist
- Tenant must be in PROVISIONED state

### At Hub:
- User must be authenticated
- Tenant metadata must exist
- Setup progress must be valid object

---

This completes the data workflow and routing documentation. All data points, storage locations, and navigation paths are now documented.
