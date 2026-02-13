# Multi-Location Workflow Redesign

## Overview

Complete redesign of multi-location setup to eliminate activation codes and provide seamless tenant switching.

## User Experience Flow

### 1. Master Tenant Creates Location

**Current Flow (OLD):**
```
Master → Create Location → Get Activation Code → Share Code → Location Enters Code
```

**New Flow:**
```
Master → Click "Add Location" → Fill Form → Location Provisioned → Switch to Location
```

### 2. Form Fields (Similar to Restaurant Setup)

**Location Creation Form:**
- Location Name (required)
- Address (line1, line2, city, state, pincode)
- Phone (optional)
- Email (optional)
- Restaurant Type (Full Service, Quick Service, etc.)
- Google Place ID (optional, for maps integration)

**Behind the scenes:**
- Generates subdomain: `{master-name}-{location-name}-{random}`
- Provisions full infrastructure (D1 + KV + R2)
- Tags with `masterTenantId`
- Stores in master's `location_tenants` table
- Automatically sets `location_group_id` and `master_tenant_id` in location's `restaurant_settings`

### 3. Tenant Switching

**Header Component:**
```
┌─────────────────────────────────────────────┐
│  [Logo]  Restaurant POS                     │
│                                              │
│  Current: Kalyani HQ ▼                      │
│         ├─ Kalyani HQ (Master)              │
│         ├─ Indiranagar Branch               │
│         ├─ Koramangala Branch               │
│         └─ Jayanagar Branch                 │
└─────────────────────────────────────────────┘
```

**Switching Mechanism:**
1. Click dropdown → Select location
2. App saves current tenant context
3. Loads selected tenant's database
4. Refreshes all stores (menu, settings, staff, etc.)
5. Updates UI to show location-specific data

## Architecture Changes

### Database Schema

**Master Tenant SQLite:**
```sql
-- Existing table (enhanced)
CREATE TABLE location_tenants (
  location_id TEXT PRIMARY KEY,
  location_tenant_id TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL,
  -- ... existing fields ...

  -- NEW: Local database path for quick switching
  local_db_path TEXT,

  -- NEW: Quick access flag
  is_accessible BOOLEAN DEFAULT 1
);

-- NEW: Current tenant context
CREATE TABLE tenant_context (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_tenant_id TEXT NOT NULL,
  current_tenant_type TEXT NOT NULL, -- 'master' or 'location'
  switched_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Each Location Tenant SQLite:**
```sql
-- restaurant_settings (existing, enhanced)
ALTER TABLE restaurant_settings ADD COLUMN location_group_id TEXT;
ALTER TABLE restaurant_settings ADD COLUMN master_tenant_id TEXT;
ALTER TABLE restaurant_settings ADD COLUMN is_location BOOLEAN DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN parent_location_id TEXT;
```

### File Structure

**New Components:**
```
src/components/locations/
├── LocationProvisioningForm.tsx       # New location creation form
├── TenantSwitcher.tsx                 # Dropdown in header
├── LocationSettingsPage.tsx           # Adapted settings for locations
└── LocationSettingsNav.tsx            # Navigation for location settings
```

**Modified Components:**
```
src/components/Header.tsx              # Add tenant switcher
src/pages-v2/SettingsPage.tsx          # Detect if location, show adapted UI
src/components/admin/ChainLocationManager.tsx  # Use new form
```

**New Stores:**
```
src/stores/tenantSwitcherStore.ts      # Manage tenant switching
```

**New Tauri Commands:**
```
src-tauri/src/commands/tenant_switcher.rs
├── get_accessible_tenants()           # List master + locations
├── switch_tenant()                    # Switch to different tenant
├── get_current_tenant_context()       # Get active tenant
└── provision_location_tenant()        # Create location (auto-config)
```

## Implementation Plan

### Phase 1: Location Provisioning Form ✅

**Files to Create:**
1. `src/components/locations/LocationProvisioningForm.tsx`
   - Form with fields: name, address, phone, email, type
   - Validation
   - Progress indicator during provisioning
   - Success modal with "Switch to Location" button

2. Update `src/components/admin/ChainLocationManager.tsx`
   - Replace current "Add Location" flow
   - Use new LocationProvisioningForm
   - Show locations in table with "Switch" button

**Tauri Command:**
```rust
#[tauri::command]
pub async fn provision_location_tenant(
    app: AppHandle,
    chain_id: String,
    location_data: LocationFormData,
) -> Result<LocationMetadata, String> {
    // 1. Call provisioning worker
    // 2. Store location metadata in master's SQLite
    // 3. Create local database for location
    // 4. Run migrations on location DB
    // 5. Set location_group_id and master_tenant_id in location's restaurant_settings
    // 6. Return location metadata
}
```

### Phase 2: Tenant Switching ✅

**Files to Create:**
1. `src/stores/tenantSwitcherStore.ts`
   ```typescript
   interface TenantSwitcherState {
     currentTenant: TenantInfo | null;
     availableTenants: TenantInfo[];
     isLoading: boolean;

     loadTenants: () => Promise<void>;
     switchTenant: (tenantId: string) => Promise<void>;
     getCurrentTenant: () => Promise<TenantInfo>;
   }
   ```

2. `src/components/locations/TenantSwitcher.tsx`
   - Dropdown in header
   - Shows master + all locations
   - Visual indicator of current tenant
   - Click to switch

3. Update `src/components/Header.tsx`
   - Add TenantSwitcher component
   - Position: next to restaurant name

**Tauri Commands:**
```rust
#[tauri::command]
pub fn get_accessible_tenants(app: AppHandle) -> Result<Vec<TenantInfo>, String> {
    // 1. Get master tenant info
    // 2. Query location_tenants table
    // 3. Return list of all accessible tenants
}

#[tauri::command]
pub async fn switch_tenant(
    app: AppHandle,
    tenant_id: String,
    tenant_type: String, // 'master' or 'location'
) -> Result<(), String> {
    // 1. Save current tenant context
    // 2. Switch database connection to target tenant
    // 3. Update tenant_context table
    // 4. Emit event to reload all stores
    // 5. Return success
}
```

### Phase 3: Location-Specific Settings ✅

**Settings Sections Comparison:**

| Section | Master Tenant | Location Tenant |
|---------|---------------|-----------------|
| **Restaurant Details** | Full edit | Limited edit (name, hours) |
| **Menu Management** | Upload + Edit | **Sync Only** + View |
| **Staff Management** | Full access | Full access |
| **Hardware Settings** | Full access | Full access |
| **Invoice Settings** | Full edit | Inherit or override |
| **Payment Settings** | Full access | Full access |
| **Theme Customization** | Full access | Inherit or override |
| **Chain Management** | Visible | **Hidden** |
| **Cloud Sync** | Full access | Full access (syncs to master) |

**Implementation:**

1. `src/pages-v2/LocationSettingsPage.tsx`
   - Copy from SettingsPage.tsx
   - Detect `is_location` flag
   - Show/hide sections based on location type
   - Adapt behavior (e.g., menu sync vs upload)

2. `src/components/settings-location/` (new directory)
   - `LocationMenuSync.tsx` - Replace menu upload with sync button
   - `LocationRestaurantDetails.tsx` - Limited fields
   - `LocationInvoiceSettings.tsx` - Inherit with override option

**Menu Sync Workflow:**
```typescript
// Location Settings → Menu → Sync Button
const handleSyncMenu = async () => {
  // Calls existing command: fetch_and_load_master_menu
  await invoke('fetch_and_load_master_menu', {
    masterTenantId: settings.master_tenant_id,
    chainId: settings.location_group_id,
  });

  // Refresh menu store
  await menuStore.loadMenu();
};
```

### Phase 4: Automatic Chain Sync Configuration ✅

**During Location Provisioning:**
```rust
// In provision_location_tenant command
async fn provision_location_tenant(
    // ... args
) -> Result<LocationMetadata, String> {
    // ... create infrastructure ...

    // IMPORTANT: Auto-configure chain sync
    let location_db_path = get_location_db_path(&location_tenant_id)?;
    let location_conn = Connection::open(&location_db_path)?;

    location_conn.execute(
        "UPDATE restaurant_settings
         SET location_group_id = ?,
             master_tenant_id = ?,
             is_location = 1
         WHERE id = 1",
        params![chain_id, master_tenant_id],
    )?;

    // ... return metadata ...
}
```

**Chain Sync Auto-Start:**
```rust
// In location app startup (src-tauri/src/main.rs)
if is_location_tenant() {
    // Start chain sales sync service (every 5 minutes)
    tokio::spawn(async move {
        start_chain_sync_service(app_handle).await;
    });
}
```

## UI/UX Enhancements

### 1. Location Badge

Show visual indicator when viewing a location:
```tsx
// Header.tsx
{currentTenant.type === 'location' && (
  <Badge variant="secondary">
    📍 {currentTenant.name}
  </Badge>
)}
```

### 2. Settings Navigation

Location settings should show modified navigation:
```tsx
// LocationSettingsNav.tsx
const sections = [
  { id: 'details', label: 'Restaurant Details', icon: Building2 },
  { id: 'menu', label: 'Menu Sync', icon: Menu }, // Changed from "Menu Management"
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'hardware', label: 'Hardware', icon: MonitorSmartphone },
  { id: 'invoice', label: 'Invoice', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  // 'chain' section is HIDDEN for locations
];
```

### 3. Master Link

Show link back to master from location:
```tsx
// LocationSettingsPage.tsx
<Alert>
  <Info className="h-4 w-4" />
  <AlertDescription>
    This is a location of <Button variant="link" onClick={switchToMaster}>
      {masterTenantName}
    </Button>. Menu and settings are managed from the master.
  </AlertDescription>
</Alert>
```

## Database Migration Strategy

### Migration Files

**1. Update `migrations/051_chain_sync_tracking.sql`:**
```sql
-- Add location flags
ALTER TABLE restaurant_settings ADD COLUMN is_location INTEGER DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN parent_location_id TEXT;

-- Create tenant context table
CREATE TABLE IF NOT EXISTS tenant_context (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_tenant_id TEXT NOT NULL,
  current_tenant_type TEXT NOT NULL,
  switched_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**2. New `migrations/052_multi_tenant_local.sql`:**
```sql
-- Enhanced location_tenants for local access
ALTER TABLE location_tenants ADD COLUMN local_db_path TEXT;
ALTER TABLE location_tenants ADD COLUMN is_accessible INTEGER DEFAULT 1;
ALTER TABLE location_tenants ADD COLUMN last_accessed_at TEXT;

-- Index for quick tenant lookups
CREATE INDEX IF NOT EXISTS idx_location_tenants_accessible
ON location_tenants(is_accessible)
WHERE is_accessible = 1;
```

## Testing Checklist

### Provisioning Flow
- [ ] Create master tenant
- [ ] Master creates first location via form
- [ ] Location is provisioned with all infrastructure
- [ ] Location appears in master's location list
- [ ] location_group_id and master_tenant_id are set correctly

### Tenant Switching
- [ ] Tenant switcher shows master + locations
- [ ] Click location → app switches context
- [ ] Location's data loads correctly
- [ ] Switch back to master → master data loads
- [ ] Multiple rapid switches work without issues

### Location Settings
- [ ] Menu section shows "Sync" button (not upload)
- [ ] Sync button pulls menu from master
- [ ] Chain section is hidden
- [ ] Staff management works normally
- [ ] Invoice settings work (inherit or override)

### Chain Sync
- [ ] Location makes test sale
- [ ] Chain sync runs automatically (every 5 min)
- [ ] Sale appears in master's chain_sales_aggregated
- [ ] Master can view consolidated reports

### Edge Cases
- [ ] Switch tenant while form is open
- [ ] Network error during provisioning
- [ ] Location created but sync fails (recoverable)
- [ ] Delete location (cleanup)
- [ ] Rename location (updates everywhere)

## File Structure Summary

```
src/
├── components/
│   ├── Header.tsx                             [MODIFY] Add tenant switcher
│   ├── locations/
│   │   ├── LocationProvisioningForm.tsx       [NEW] Form to create location
│   │   ├── TenantSwitcher.tsx                 [NEW] Dropdown in header
│   │   ├── LocationSettingsPage.tsx           [NEW] Adapted settings
│   │   └── LocationSettingsNav.tsx            [NEW] Nav for locations
│   └── admin/
│       └── ChainLocationManager.tsx           [MODIFY] Use new form
├── stores/
│   └── tenantSwitcherStore.ts                 [NEW] Tenant switching state
└── pages-v2/
    └── SettingsPage.tsx                       [MODIFY] Detect location mode

src-tauri/src/commands/
├── tenant_switcher.rs                         [NEW] Switching commands
└── chain_locations.rs                         [MODIFY] Enhanced provisioning

migrations/
├── 051_chain_sync_tracking.sql                [MODIFY] Add location flags
└── 052_multi_tenant_local.sql                 [NEW] Local tenant access

workers/
└── restaurant-provisioning/
    └── src/
        └── index.ts                           [MODIFY] Enhanced response
```

## Next Steps

1. **Phase 1**: Create LocationProvisioningForm component
2. **Phase 2**: Implement tenant switching mechanism
3. **Phase 3**: Create location-specific settings pages
4. **Phase 4**: Update provisioning to auto-configure sync
5. **Phase 5**: Test complete flow end-to-end

## Benefits Over Previous Approach

| Feature | Old (Activation Code) | New (Integrated) |
|---------|----------------------|------------------|
| **Setup Complexity** | High (code sharing) | Low (one form) |
| **User Experience** | Multi-step | Seamless |
| **Tenant Switching** | Manual app config | Built-in dropdown |
| **Settings Adaptation** | Same for all | Location-specific |
| **Chain Sync Config** | Manual | Automatic |
| **Data Isolation** | Separate apps | Unified app |
| **Onboarding Time** | ~15 minutes | ~2 minutes |

## Security Considerations

1. **Tenant Isolation**: Each location has separate database, no cross-contamination
2. **Access Control**: Only master can create locations
3. **Data Sync**: One-way sync from location to master (sales data)
4. **Menu Sync**: One-way sync from master to location (menu data)
5. **Settings Inheritance**: Configurable (inherit vs override)
