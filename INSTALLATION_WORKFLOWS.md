# Installation & Setup Workflows

## Overview

Three distinct workflows for different installation scenarios in the HandsFree POS system.

---

## Workflow 1: First Time Install (New Restaurant)

**Scenario**: Restaurant owner installing POS for the first time

### Steps

1. **Download & Install**
   - Download HandsFree POS installer (.exe, .dmg, or .deb)
   - Run installer on first device
   - App launches to setup wizard

2. **Initial Setup Wizard**
   ```
   Step 1: Welcome Screen
   └─> "New Restaurant" or "Join Existing"
       └─> Select "New Restaurant"

   Step 2: Restaurant Details
   ├─> Restaurant Name
   ├─> Address (Line 1, Line 2, City, State, Pincode)
   ├─> Phone Number
   ├─> Email (optional)
   └─> GST Number (optional)

   Step 3: Owner Account Creation
   ├─> Owner Name
   ├─> Email
   ├─> Password
   └─> Role: OWNER (auto-set)

   Step 4: Tenant Provisioning (Automatic)
   ├─> Generate unique tenant_id (e.g., "mahesh-dhaba-6163")
   ├─> Provision Cloudflare D1 database
   ├─> Provision Cloudflare R2 storage bucket
   ├─> Create tenant subdomain (optional)
   └─> Store tenant config in local SQLite

   Step 5: Device Configuration
   ├─> Device Name: "POS Terminal 1"
   ├─> Device Mode: POS (default for first device)
   ├─> Device ID: Generated UUID
   ├─> Auto-adapt: Enabled (default)
   └─> Store in device_settings table

   Step 6: Menu Setup (Optional)
   ├─> Upload menu Excel/PDF
   ├─> AI parses menu structure
   ├─> Review and confirm items
   └─> Sync to cloud (D1 + R2)

   Step 7: Complete
   ├─> Show activation code
   ├─> Display tenant_id
   └─> Navigate to POS dashboard
   ```

3. **Result**
   - Owner logged in automatically
   - Device mode: POS (full features)
   - Tenant provisioned in cloud
   - Ready to take orders

### Database State After First Install

```sql
-- tenant_activation table
tenant_id: "mahesh-dhaba-6163"
is_activated: 1
activation_code: "MH-4X9K-2P7L"

-- device_settings table
id: 1
tenant_id: "mahesh-dhaba-6163"
device_mode: "pos"
device_name: "POS Terminal 1"
device_id: "550e8400-e29b-41d4-a716-446655440000"
auto_adapt_mode: 1
locked_mode: 0
current_user_id: "owner-123"
current_user_role: "owner"

-- staff_users table (local)
id: "owner-123"
name: "Mahesh Kumar"
email: "mahesh@example.com"
role: "owner"
pin: NULL (uses email/password)

-- Cloud D1 database
Provisioned with schema
Synced with local menu data
```

---

## Workflow 2: Same Tenant, New Device (Add KDS/BDS)

**Scenario**: Restaurant adding a kitchen display or second POS terminal

### Steps

1. **Download & Install**
   - Download HandsFree POS on new device (e.g., kitchen tablet)
   - Run installer
   - App launches to setup wizard

2. **Join Existing Tenant**
   ```
   Step 1: Welcome Screen
   └─> "New Restaurant" or "Join Existing"
       └─> Select "Join Existing"

   Step 2: Activation Code Entry
   ├─> Enter activation code: "MH-4X9K-2P7L"
   ├─> OR enter tenant_id: "mahesh-dhaba-6163"
   └─> Verify against cloud

   Step 3: Device Configuration
   ├─> Device Purpose:
   │   ├─> Point of Sale (POS)
   │   ├─> Kitchen Display (KDS) ← Select this
   │   ├─> Bar Display (BDS)
   │   └─> Server Mode
   ├─> Device Name: "Kitchen Display 1"
   ├─> Auto-adapt: Disabled (locked to KDS)
   ├─> Locked Mode: Enabled
   └─> Device ID: Generated UUID

   Step 4: Download Tenant Data
   ├─> Fetch restaurant settings from cloud
   ├─> Fetch menu from D1 database
   ├─> Fetch floor plan from cloud
   └─> Store locally in SQLite

   Step 5: Staff Login (Optional)
   ├─> Kitchen staff can log in with PIN
   ├─> Or device can be set to auto-login
   └─> Device shows KDS interface

   Step 6: Complete
   └─> Navigate to Kitchen Display dashboard
   ```

3. **Result**
   - Device connected to same tenant
   - Device mode: KDS (locked)
   - Menu synced from cloud
   - Kitchen staff can log in and view orders

### Database State After Second Device

**Device 1 (POS Terminal)**:
```sql
device_settings:
  device_mode: "pos"
  device_name: "POS Terminal 1"
  locked_mode: 0  -- Can switch modes
```

**Device 2 (Kitchen Display)**:
```sql
device_settings:
  device_mode: "kds"
  device_name: "Kitchen Display 1"
  locked_mode: 1  -- LOCKED to KDS mode
  auto_adapt_mode: 0  -- Auto-adapt disabled
```

**Both devices share**:
- Same `tenant_id`
- Same cloud D1 database
- Same menu data
- Orders sync via cloud

---

## Workflow 3: Same Device, Different Users

**Scenario**: Multiple staff members using same POS terminal

### Steps

1. **First User (Owner) Already Logged In**
   ```
   Current State:
   ├─> Device: POS Terminal 1
   ├─> Mode: POS (full features)
   └─> User: Owner (logged in)
   ```

2. **Owner Creates Staff Accounts**
   ```
   Navigate to: Settings → Staff Management

   Create Kitchen Staff:
   ├─> Name: "Raj Kumar"
   ├─> Role: Kitchen
   ├─> PIN: 1234
   └─> Save

   Create Service Staff:
   ├─> Name: "Amit Singh"
   ├─> Role: Service
   ├─> PIN: 5678
   └─> Save

   Create Captain:
   ├─> Name: "Priya Sharma"
   ├─> Role: Captain
   ├─> PIN: 9012
   └─> Save
   ```

3. **Owner Logs Out**
   ```
   Click Logout
   ├─> Record logout in device_login_history
   ├─> Clear current_user_id from device_settings
   └─> Show login screen
   ```

4. **Kitchen Staff Logs In**
   ```
   Login Screen:
   ├─> Select "Staff Login"
   ├─> Enter PIN: 1234
   └─> Authenticate

   Auto-Configuration (if auto_adapt = 1):
   ├─> Detect role: Kitchen
   ├─> Switch device mode: POS → KDS
   ├─> Update features_json (kitchen features only)
   ├─> Record login in device_login_history
   └─> Emit "device-mode-changed" event

   UI Update:
   ├─> Toast: "Device switched to Kitchen Display mode"
   ├─> Reload to KDS interface
   └─> Show kitchen orders only
   ```

5. **Kitchen Staff Logs Out, Service Staff Logs In**
   ```
   Logout (Kitchen):
   ├─> Record logout (reason: "manual")
   ├─> Clear current user
   └─> Show login screen

   Login (Service):
   ├─> Enter PIN: 5678
   ├─> Detect role: Service
   ├─> Switch device mode: KDS → POS (limited)
   ├─> Update features (service features only)
   └─> Show POS order-taking interface

   Features Enabled:
   ├─> ✅ Take orders
   ├─> ✅ Manage tables
   ├─> ✅ Track tips
   ├─> ❌ Apply discounts (disabled)
   ├─> ❌ Void orders (disabled)
   └─> ❌ Admin settings (hidden)
   ```

6. **Idle Timeout (Automatic)**
   ```
   After 30 minutes of inactivity:
   ├─> check_idle_timeout() detects timeout
   ├─> Record logout (reason: "timeout")
   ├─> Toast: "Session expired due to inactivity"
   ├─> Auto-logout
   └─> Show login screen
   ```

### User Session Flow

```
┌─────────────────────────────────────────────────────┐
│              POS Terminal 1 (Shared Device)          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  08:00 AM - Owner Logs In                           │
│  ├─> Device Mode: POS (full features)               │
│  ├─> Features: All unlocked                         │
│  └─> Login recorded in history                      │
│                                                      │
│  09:30 AM - Owner Logs Out                          │
│  └─> Logout recorded (reason: "manual")             │
│                                                      │
│  09:31 AM - Kitchen Staff (Raj) Logs In             │
│  ├─> Device Mode: POS → KDS (auto-switch)           │
│  ├─> Features: Kitchen only                         │
│  └─> UI: Kitchen Display interface                  │
│                                                      │
│  02:00 PM - Kitchen Staff Logs Out                  │
│  └─> Logout recorded                                │
│                                                      │
│  02:05 PM - Service Staff (Amit) Logs In            │
│  ├─> Device Mode: KDS → POS (auto-switch)           │
│  ├─> Features: Order taking, tables, tips           │
│  └─> UI: POS interface (limited)                    │
│                                                      │
│  02:40 PM - Idle Timeout (30 min)                   │
│  ├─> Auto-logout triggered                          │
│  ├─> Toast: "Session expired"                       │
│  └─> Logout recorded (reason: "timeout")            │
│                                                      │
│  03:00 PM - Captain (Priya) Logs In                 │
│  ├─> Device Mode: POS                               │
│  ├─> Features: Orders, discounts, team oversight    │
│  └─> UI: POS interface (captain level)              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Database State During Multi-User Usage

```sql
-- device_login_history table (audit trail)
┌─────────────┬─────────────┬──────────────┬─────────────────────┬─────────────────┬────────────────┐
│ user_id     │ user_role   │ login_time   │ device_mode_before  │ device_mode_after│ logout_time   │
├─────────────┼─────────────┼──────────────┼─────────────────────┼─────────────────┼────────────────┤
│ owner-123   │ owner       │ 08:00:00     │ pos                 │ pos             │ 09:30:00      │
│ kitchen-456 │ kitchen     │ 09:31:00     │ pos                 │ kds             │ 14:00:00      │
│ service-789 │ service     │ 14:05:00     │ kds                 │ pos             │ 14:40:00*     │
│ captain-012 │ captain     │ 15:00:00     │ pos                 │ pos             │ NULL (active) │
└─────────────┴─────────────┴──────────────┴─────────────────────┴─────────────────┴────────────────┘
* Auto-logout due to timeout

-- user_device_preferences table
┌─────────────┬─────────────┬──────────────────────┬─────────────┬──────────────┐
│ user_id     │ user_role   │ preferred_device_mode│ login_count │ last_login_at│
├─────────────┼─────────────┼──────────────────────┼─────────────┼──────────────┤
│ owner-123   │ owner       │ pos                  │ 47          │ 08:00:00     │
│ kitchen-456 │ kitchen     │ kds                  │ 152         │ 09:31:00     │
│ service-789 │ service     │ pos                  │ 203         │ 14:05:00     │
│ captain-012 │ captain     │ pos                  │ 89          │ 15:00:00     │
└─────────────┴─────────────┴──────────────────────┴─────────────┴──────────────┘
```

---

## Decision Tree: Which Workflow?

```
Start Installation
│
├─> Is this the first device for a new restaurant?
│   YES → Workflow 1: First Time Install
│   │    ├─> Create new tenant
│   │    ├─> Provision cloud resources
│   │    ├─> Create owner account
│   │    └─> Setup first device
│   │
│   NO → Continue
│
├─> Are you adding a device to an existing restaurant?
│   YES → Workflow 2: Same Tenant, New Device
│   │    ├─> Enter activation code
│   │    ├─> Download tenant data from cloud
│   │    ├─> Configure device purpose (POS/KDS/BDS)
│   │    └─> Join tenant network
│   │
│   NO → Continue
│
└─> Multiple staff using same device?
    YES → Workflow 3: Same Device, Different Users
         ├─> Create staff accounts (owner)
         ├─> Staff login with PIN
         ├─> Device auto-adapts to user role
         └─> Auto-logout on idle timeout
```

---

## Quick Reference

### First Time Install
- **When**: New restaurant, first device
- **Duration**: 5-10 minutes
- **Requirements**: Restaurant details, owner email
- **Output**: Tenant provisioned, activation code generated

### Add Device to Existing Tenant
- **When**: Adding KDS, BDS, or second POS
- **Duration**: 2-3 minutes
- **Requirements**: Activation code or tenant_id
- **Output**: Device joined to tenant, data synced

### Multi-User on Same Device
- **When**: Staff sharing POS terminal
- **Duration**: Instant (auto-configuration)
- **Requirements**: Staff accounts with PINs
- **Output**: Device adapts to each user automatically

---

## Common Configurations

### Configuration 1: Small Restaurant (1 Device)
```
Device 1: POS Terminal
├─> Mode: POS
├─> Auto-adapt: Enabled
├─> Locked: No
└─> Users: Owner, Manager, 2 Service Staff
```

### Configuration 2: Medium Restaurant (3 Devices)
```
Device 1: POS Terminal (Front Counter)
├─> Mode: POS
├─> Auto-adapt: Enabled
├─> Users: Owner, Manager, Captain, 3 Service Staff

Device 2: Kitchen Display
├─> Mode: KDS
├─> Auto-adapt: Disabled
├─> Locked: Yes (KDS only)
└─> Users: 2 Kitchen Staff

Device 3: Bar Display
├─> Mode: BDS
├─> Auto-adapt: Disabled
├─> Locked: Yes (BDS only)
└─> Users: 1 Bar Staff
```

### Configuration 3: Large Restaurant Chain (10+ Devices)
```
Location 1 (Mumbai):
├─> POS Terminal 1, 2, 3 (shared, auto-adapt)
├─> KDS (locked)
├─> BDS (locked)
└─> Manager Tablet (POS, personal)

Location 2 (Delhi):
├─> POS Terminal 1, 2 (shared, auto-adapt)
├─> KDS (locked)
└─> Manager Tablet (POS, personal)

All devices:
├─> Same tenant_id
├─> Same cloud database
├─> Real-time sync
└─> Separate device_settings per device
```

---

## Summary

| Workflow | Use Case | Setup Time | Complexity |
|----------|----------|------------|------------|
| **Workflow 1** | New restaurant, first install | 5-10 min | Medium |
| **Workflow 2** | Add device to existing tenant | 2-3 min | Low |
| **Workflow 3** | Multiple users, same device | Instant | Very Low |

All three workflows leverage:
- ✅ SQLite local storage
- ✅ Cloudflare D1 cloud database
- ✅ Automatic device-user alignment
- ✅ Role-based feature gating
- ✅ Idle timeout security
- ✅ Complete audit trail
