# Restaurant Setup Flow

## Overview
The app now has a proper separation between authentication and provisioning, with the ability to create new restaurants.

## Flow Diagram

```
┌─────────────────────┐
│   App Starts        │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ Need Tenant  │───Yes──▶ Tenant Activation (Auth Code)
    │ Activation?  │                    │
    └──────┬───────┘                    │
           No                           │
           │                            │
           │◀───────────────────────────┘
           │
           ▼
    ┌──────────────┐
    │     Need     │───Yes──▶ Provisioning Flow
    │ Provisioning?│         (Business Setup Wizard)
    └──────┬───────┘                │
           No                       │
           │                        │
           │◀───────────────────────┘
           │
           ▼
    ┌──────────────┐
    │  Menu Sync   │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  Hub Page    │──────────────────┐
    │              │                  │
    │ Dashboard    │                  │
    │ Cards        │                  │
    │              │                  │
    │ [Danger Zone]│                  │
    │  Create New  │◀─Click───────────┘
    │  Restaurant  │
    └──────────────┘
           │
           │ (Reset DB & Reload)
           │
           ▼
    Back to Tenant Activation
```

## Authentication vs Provisioning

### Tenant Activation (One-time per device)
- **Purpose**: Verify the device belongs to a specific tenant
- **Method**: 6-digit auth code from backend
- **Storage**: `tenant-storage` in localStorage
- **Skip with**: `VITE_SKIP_AUTH=true` (development only)

### Provisioning (One-time per restaurant)
- **Purpose**: Set up restaurant details, menu, settings
- **Steps**:
  1. Phone verification
  2. Business info (basic, legal, invoice, tax)
  3. Menu upload
  4. Optional configs (floor plan, staff, printers)
  5. Diagnostics
  6. Training mode toggle
- **Storage**: `provisioning-storage` in localStorage
- **Status**: `isProvisioned` flag tracks completion

## User Journey

### First Time Setup
1. **Enter Auth Code** → Tenant activated
2. **Complete Provisioning** → Restaurant set up
3. **Redirected to Hub** → Start using the app

### Returning User
1. **App loads** → Auth & provisioning already done
2. **Menu syncs** → Latest data loaded
3. **Hub appears** → Ready to work

### Create New Restaurant
1. **Navigate to Hub**
2. **Scroll to "Danger Zone"** (manager only)
3. **Click "Create New Restaurant"**
4. **Confirm deletion** (type "DELETE")
5. **Database wiped** → All data deleted
6. **App reloads** → Back to auth code entry
7. **Start fresh provisioning** → New restaurant setup

## Technical Implementation

### Database Reset (`src/lib/databaseReset.ts`)
- Clears all SQLite tables
- Resets provisioning store (`isProvisioned = false`)
- Resets tenant store
- Preserves auth structure for re-activation

### Provisioning Store (`src/stores/provisioningStore.ts`)
- Tracks completion of each setup step
- `isProvisioned`: Boolean flag for completion
- `resetProvisioning()`: Wipes all progress

### Tenant Store (`src/stores/tenantStore.ts`)
- Stores tenant info after activation
- `clearTenant()`: Removes tenant data
- `needsActivation`: Returns true if no tenant

### App.tsx Flow
```typescript
if (needsActivation) {
  return <TenantActivation />
}

if (needsProvisioning) {
  return <ProvisioningFlow />
}

// Menu sync...

return <HashRouter>
  {/* Routes to Hub, POS, KDS, etc. */}
</HashRouter>
```

## Security Notes

- ⚠️ "Create New Restaurant" requires **TWO confirmations**
- ⚠️ User must type "DELETE" exactly to confirm
- ⚠️ Only visible to **MANAGER** role
- ⚠️ No undo - data is permanently deleted
- ✅ Provisioning state is persisted to localStorage
- ✅ Tenant activation survives app restarts

## Development Shortcuts

### Skip Auth (Testing)
Add to `.env`:
```bash
VITE_SKIP_AUTH=true
```

### Reset Provisioning (Dev Mode)
In ProvisioningFlow footer (only visible in DEV mode):
- Click "[DEV] Reset Provisioning"
- Clears all setup progress

### Reset Device Mode
In main app (any page):
- Press **Ctrl+Shift+R**
- Resets device to "owner" mode
- Unlocks device
- Reloads app

## Files Modified

### Created
- `src/lib/databaseReset.ts` - Database wipe utilities
- `RESTAURANT_SETUP_FLOW.md` - This documentation

### Modified
- `src/pages-v2/HubPage.tsx` - Added "Create New Restaurant" button
- `src/App.tsx` - Already had correct flow logic

## Summary

✅ **Completed auth goes to hub** (not back to provisioning)
✅ **"Create New Restaurant" button** in Hub (manager only)
✅ **Database wipe functionality** with double confirmation
✅ **Fresh onboarding** after reset
✅ **Tenant + provisioning separation** working correctly
