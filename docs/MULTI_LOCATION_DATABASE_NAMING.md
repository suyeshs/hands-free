# Multi-Location Database Naming Nomenclature

## Overview

For multi-location restaurant chains, each location gets its own D1 database. The naming follows a hierarchical structure to ensure uniqueness and traceability.

## Naming Structure

### 1. **Subdomain Generation**
Format: `{master-slug}-{location-slug}-{random}`

```
Example: kalyani-indiranagar-4521
```

**Components:**
- `master-slug`: First 20 chars of master restaurant name (lowercase, alphanumeric only)
- `location-slug`: First 15 chars of location name (lowercase, alphanumeric only)
- `random`: 4-digit random number (1000-9999)

### 2. **Tenant ID Generation**
Format: `{subdomain}-{timestamp}`

```
Example: kalyani-indiranagar-4521-lmn3x7k
```

**Components:**
- `subdomain`: The subdomain from step 1
- `timestamp`: Current timestamp in base36 format (7-8 chars)

### 3. **Database Name**
Format: `{tenant-id-sanitized}_db`

```
Example: kalyani_indiranagar_4521_lmn3x7k_db
```

**Rules:**
- Replace all non-alphanumeric characters (except `-` and `_`) with underscores
- Append `_db` suffix
- Must be valid D1 database name (lowercase, alphanumeric, underscores, hyphens)

## Complete Example

**Master Restaurant:** "Kalyani Restaurant"
**Master Tenant ID:** `kalyani-6207`

**New Location:** "Indiranagar Branch"

### Step-by-Step:
1. **Generate Subdomain:**
   - Master slug: `kalyani-restaurant` → `kalyani-restaurant` (20 chars)
   - Location slug: `indiranagar-branch` → `indiranagar-bran` (15 chars)
   - Random: `4521`
   - **Result:** `kalyani-restaurant-indiranagar-bran-4521`

2. **Generate Tenant ID:**
   - Subdomain: `kalyani-restaurant-indiranagar-bran-4521`
   - Timestamp (base36): `lmn3x7k` (e.g., Date.now().toString(36))
   - **Result:** `kalyani-restaurant-indiranagar-bran-4521-lmn3x7k`

3. **Generate Database Name:**
   - Tenant ID sanitized: `kalyani_restaurant_indiranagar_bran_4521_lmn3x7k`
   - Add suffix: `_db`
   - **Result:** `kalyani_restaurant_indiranagar_bran_4521_lmn3x7k_db`

## Activation Code

Each location gets a unique 6-character activation code:
- **Format:** 6 uppercase alphanumeric characters
- **Example:** `A7K9M2`
- **Purpose:** Used by location devices to activate and link to the location's tenant

## Database Schema

Each location database contains:

### Core Tables:
- `tenant_config` - Tenant configuration and activation info
- `menu_items` - Menu items (synced from master)
- `menu_categories` - Menu categories (synced from master)
- `staff_users` - Staff members
- `restaurant_settings` - Restaurant settings
- `floor_plan_sections` - Floor plan sections
- `floor_plan_tables` - Tables
- `orders` - Orders (location-specific)
- `sales_transactions` - Sales (location-specific)
- And all other standard POS tables...

### Key Fields in `tenant_config`:
```sql
- tenant_id: The location's unique tenant ID
- d1_database_id: Cloudflare D1 database UUID
- activation_code: 6-character activation code
- master_tenant_id: Links to master tenant (for chain)
```

## Migration Sync

After provisioning, the database schema is synced from the master via migration sync:

1. **Initial Setup:** Minimal schema (just `tenant_config`)
2. **Migration Sync:** Full schema applied from master's migration files
3. **Data Sync:** Menu, settings, floor plan synced from master
4. **Activation:** Location device activates with activation code

## Benefits of This Naming System

1. **Uniqueness:** Timestamp ensures no collisions
2. **Readability:** Name includes master and location names
3. **Traceability:** Easy to identify which chain and location
4. **Cloudflare Compatible:** Follows D1 naming requirements
5. **Length Control:** Total length stays under Cloudflare limits

## Environment Variables

```env
VITE_PROVISIONING_URL=https://handsfree-restaurant-provisioning.suyesh.workers.dev
```

## API Endpoints

### Create Location
```
POST /api/provision/location
```

**Request:**
```json
{
  "tenantId": "kalyani-6207",
  "restaurantName": "Indiranagar Branch",
  "companyName": "Kalyani Restaurant",
  "ownerName": "Kalyani",
  "email": "indiranagar@kalyani.com",
  "phone": "+91 9876543210",
  "city": "Bangalore",
  "pincode": "560038",
  "restaurantType": "FULL_SERVICE",
  "subdomain": "kalyani-restaurant-indiranagar-bran-4521"
}
```

**Response:**
```json
{
  "success": true,
  "tenantId": "kalyani-restaurant-indiranagar-bran-4521-lmn3x7k",
  "activationCode": "A7K9M2",
  "cloudflareResources": {
    "d1DatabaseId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "d1DatabaseName": "kalyani_restaurant_indiranagar_bran_4521_lmn3x7k_db"
  }
}
```

## Notes

- **No KV/R2/DNS:** Multi-location only creates D1, not full infrastructure
- **Fast Provisioning:** Synchronous response (no polling needed)
- **Schema Sync:** Uses migration sync to copy schema from master
- **Data Sync:** Menu and settings automatically synced from master on activation
