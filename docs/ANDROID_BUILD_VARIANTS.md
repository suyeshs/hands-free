# Android Build Variants: Staff vs Owner APKs

## Overview

HandsFree Restaurant POS now supports **two separate Android APK builds** with different feature access levels:

### Staff APK (`com.stonepot_tech.handsfree_pos.staff`)
**Purpose**: On-site restaurant operations for all staff including managers

**Access Levels**:
- **Regular Staff (Off-Site)**: Basic operational features
- **Regular Staff (On Restaurant WiFi)**: + Sensitive features (attendance, full payroll, schedules, tips)
- **Managers**: + Operational management (menu, inventory, reports, rostering)

**Restricted Features**: Multi-location management, user management, system settings, advanced analytics

### Owner APK (`com.stonepot_tech.handsfree_pos.owner`)
**Purpose**: Corporate/multi-location management with full system access

**Access**: Everything including chain management, user management, system settings, advanced reports, integrations

## Installation

Both APKs can be installed on the same device simultaneously (different package IDs).

## Building

### Quick Build Commands

```bash
# Build staff APK
bun run android:build:staff

# Build owner APK
bun run android:build:owner

# Build both APKs
bun run android:build:both

# Automated script (with organized output)
./scripts/build-android-variants.sh
```

### Build Output

After running `bun run android:build:both`:

```
builds/android-YYYYMMDD-HHMMSS/
├── handsfree-staff-v3.1.0.apk    (~45 MB)
│   Package: com.stonepot_tech.handsfree_pos.staff
│
└── handsfree-owner-v3.1.0.apk    (~45 MB)
    Package: com.stonepot_tech.handsfree_pos.owner
```

## Feature Access Matrix

| Feature | Staff (Off-Site) | Staff (On WiFi) | Staff Manager | Owner APK |
|---------|------------------|-----------------|---------------|-----------|
| POS Dashboard | ✅ | ✅ | ✅ | ✅ |
| Kitchen (KDS) | ✅ | ✅ | ✅ | ✅ |
| Service (BDS) | ✅ | ✅ | ✅ | ✅ |
| Phone Ordering | ✅ | ✅ | ✅ | ✅ |
| Leave Requests | ✅ | ✅ | ✅ | ✅ |
| Payroll (Basic Summary) | ✅ | ✅ | ✅ | ✅ |
| **Attendance Marking** | ❌ | ✅ | ✅ | ✅ |
| **Full Payroll Details** | ❌ | ✅ | ✅ | ✅ |
| **Staff Schedules (All)** | ❌ | ✅ | ✅ | ✅ |
| **Tips Distribution** | ❌ | ✅ | ✅ | ✅ |
| **Rostering/Scheduling** | ❌ | ❌ | ✅ | ✅ |
| **Menu Management** | ❌ | ❌ | ✅ | ✅ |
| **Inventory Management** | ❌ | ❌ | ✅ | ✅ |
| **Daily/Weekly Reports** | ❌ | ❌ | ✅ | ✅ |
| Multi-Location/Chain Mgmt | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ✅ |
| System Settings | ❌ | ❌ | ❌ | ✅ |
| Cloud Sync/Integrations | ❌ | ❌ | ❌ | ✅ |
| Advanced/Financial Reports | ❌ | ❌ | ❌ | ✅ |
| Plugin Management | ❌ | ❌ | ❌ | ✅ |
| Aggregator Settings | ❌ | ❌ | ❌ | ✅ |

**Legend**:
- **Staff (Off-Site)**: Staff APK user not connected to restaurant WiFi
- **Staff (On WiFi)**: Staff APK user on restaurant WiFi network
- **Staff Manager**: Manager role in Staff APK
- **Owner APK**: Owner/corporate APK with full access

## WiFi-Based Access Control (Staff APK Only)

### Overview

The Staff APK uses WiFi network detection to control access to sensitive features. When staff connect to the configured restaurant WiFi, they gain access to:
- Full payroll details (earnings, deductions, hours)
- Attendance marking (clock in/out)
- All staff schedules
- Tips distribution details

### Setup

1. **Configure WiFi SSIDs** (Manager/Owner only):
   - Navigate to Settings > System > WiFi Access Control
   - Enter comma-separated WiFi SSIDs (e.g., "RestaurantWiFi,RestaurantWiFi-5G")
   - Enable/disable WiFi check

2. **Permission Requirements**:
   - Android: `ACCESS_FINE_LOCATION` permission (required for WiFi SSID detection)
   - iOS: Location permissions in Info.plist
   - Desktop: No special permissions (uses system commands)

3. **Network Indicator**:
   - Green "On Restaurant Network" badge = sensitive features enabled
   - Yellow "Off-Site" badge = sensitive features restricted
   - Click refresh icon to check connection immediately

### Platform Implementation

| Platform | WiFi Detection Method |
|----------|----------------------|
| Android | WifiManager via JNI (requires implementation) |
| macOS | `airport -I` command |
| Linux | `nmcli` or `iwgetid` command |
| Windows | `netsh wlan show interfaces` |

**Note**: Android implementation currently returns an error and requires full JNI setup. For now, use manual configuration or desktop platforms.

### Manual Attendance (Fallback)

If WiFi detection is unavailable or user denies location permission:
- Staff can request manual attendance from manager
- Manager can manually mark attendance in staff management

## Architecture

### Build-Time Configuration

```
.env.staff                         # Environment variables for staff build
.env.owner                        # Environment variables for owner build
src-tauri/tauri.conf.staff.json  # Tauri config with staff package ID
src-tauri/tauri.conf.owner.json  # Tauri config with owner package ID
```

### Build Variant Detection

```typescript
// src/config/buildConfig.ts
export const buildConfig = {
  variant: 'staff' | 'owner',
  isStaffBuild: boolean,
  allowedModes: string[]
};

// Check if feature/route is allowed
isFeatureEnabled(feature: string): boolean
isRouteAllowed(path: string, userRole?: string): boolean
```

### Frontend Restrictions

**Route Guards** (`BuildVariantGuard`):
- Blocks owner-only routes in staff build
- Redirects to `/hub` if route not allowed

**Navigation Filtering**:
- `FloatingNavBlob`: Hides restricted nav items
- `HubPage`: Filters dashboard cards by build variant

**Network-Based Access** (`NetworkContext`):
- Polls WiFi SSID every 30 seconds
- Provides `isOnRestaurantWiFi` boolean to components
- `useSensitiveFeatureAccess()` hook for feature gating

## Testing

### Local Development

```bash
# Test staff build
cp .env.staff .env.local
bun run dev

# Test owner build
cp .env.owner .env.local
bun run dev

# Verify:
# - Settings route blocked/allowed
# - Navigation items filtered
# - Dashboard cards filtered
```

### Device Testing

```bash
# Build both APKs
bun run android:build:both

# Install on device
adb install builds/android-*/handsfree-staff-v3.1.0.apk
adb install builds/android-*/handsfree-owner-v3.1.0.apk

# Verify:
# - Both apps appear in launcher
# - Different package IDs
# - Feature restrictions work
```

### WiFi Testing Checklist

**Staff APK**:
1. Connect to restaurant WiFi → indicator turns green → sensitive features unlock
2. Disconnect from WiFi → indicator changes → sensitive features hide
3. Switch to different WiFi → features remain locked
4. Manager access → menu/inventory/reports accessible regardless of WiFi

**Owner APK**:
1. No WiFi restrictions
2. No network indicator
3. All features accessible regardless of network

## Security Considerations

1. **Compile-Time Enforcement**: Features excluded at build time, not just hidden
2. **Route Guards**: Prevent direct URL navigation to restricted pages
3. **Type Safety**: TypeScript ensures variant checks are comprehensive
4. **Network Verification**: WiFi check runs continuously, not just once

## Database Schema

### WiFi Settings

```sql
-- restaurant_settings table
ALTER TABLE restaurant_settings
ADD COLUMN restaurant_wifi_ssid TEXT DEFAULT NULL;  -- Comma-separated SSIDs

ALTER TABLE restaurant_settings
ADD COLUMN wifi_check_enabled INTEGER DEFAULT 0;    -- 1 = enabled, 0 = disabled
```

## Troubleshooting

### Staff APK shows all features (should be restricted)

**Cause**: Staff build not detected
**Fix**:
- Check `VITE_APP_VARIANT=staff` in `.env.staff`
- Rebuild with `bun run android:build:staff`
- Verify in DevTools: `buildConfig.variant === 'staff'`

### WiFi detection not working

**Cause**: Platform not supported or permissions denied
**Fix**:
- **Android**: Requires JNI implementation (currently returns error)
- **Desktop**: Ensure commands available (`airport`, `nmcli`, `netsh`)
- **Permissions**: Grant location permission on mobile

### Both APKs have same package ID (can't install both)

**Cause**: Using wrong config file
**Fix**:
- Staff: `--config src-tauri/tauri.conf.staff.json`
- Owner: `--config src-tauri/tauri.conf.owner.json`
- Verify identifiers are different in config files

### Manager can't access menu/inventory in staff build

**Cause**: User role not properly checked
**Fix**:
- Managers should have `UserRole.MANAGER` role
- `ProtectedRoute` should allow MANAGER role
- Build variant check should allow managers for menu/inventory routes

## Files Modified

### Build Configuration
- `.env.staff` - Staff environment variables
- `.env.owner` - Owner environment variables
- `src-tauri/tauri.conf.staff.json` - Staff Tauri config (package ID: `.staff`)
- `src-tauri/tauri.conf.owner.json` - Owner Tauri config (package ID: `.owner`)
- `package.json` - Build scripts
- `scripts/build-android-variants.sh` - Automated build script

### Frontend
- `src/config/buildConfig.ts` - Build variant logic
- `src/vite-env.d.ts` - Environment variable types
- `src/App.tsx` - BuildVariantGuard component, route wrapping
- `src/components/layout-v2/FloatingNavBlob.tsx` - Navigation filtering
- `src/pages-v2/HubPage.tsx` - Dashboard filtering

### WiFi/Network
- `src-tauri/src/commands/network.rs` - WiFi SSID detection (Rust)
- `src-tauri/src/commands/mod.rs` - Network module registration
- `src-tauri/src/lib.rs` - Command registration
- `src/contexts/NetworkContext.tsx` - Network status tracking
- `src/components/NetworkStatusIndicator.tsx` - Visual indicator

### Database
- `migrations-for-r2-deployment/051_add_wifi_settings.sql` - WiFi settings schema

## Additional Resources

- See [plan file](/Users/stonepot-tech/.claude/plans/transient-launching-taco.md) for detailed implementation plan
- Android package naming: [developer.android.com](https://developer.android.com/studio/build/application-id)
- Tauri configuration: [tauri.app/v2/reference/config](https://tauri.app/v2/reference/config)

---

**Version**: 3.1.0
**Last Updated**: 2026-01-30
**Build System**: Tauri v2 + Vite + Bun
