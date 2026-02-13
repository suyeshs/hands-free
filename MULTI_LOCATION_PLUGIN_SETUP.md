# Multi-Location Plugin Setup Complete

## Summary

Created a complete multi-location plugin that will create the required database tables (`restaurant_chains` and `location_tenants`) when installed.

## What Was Created

### 1. Plugin Structure

```
plugins/multi-location/
├── manifest.json                    # Plugin configuration and metadata
├── migrations/
│   └── 001_location_tenants.sql    # Database migration (creates tables)
├── deploy-plugin.sh                # R2 deployment script
└── README.md                       # Plugin documentation

global/plugins/multi-location/       # R2 deployment ready
├── manifest.json
└── migrations/
    └── 001_location_tenants.sql
```

### 2. Database Tables

When the plugin is installed, it creates:

#### `restaurant_chains`
- Chain ID
- Chain name
- Master tenant ID
- Timestamps

#### `location_tenants`
- Location ID and metadata
- Chain reference
- Full address details
- Contact information
- Activation code and subdomain
- Provisioning status
- Cloudflare resources (optional)
- Google Maps integration (optional)
- Timestamps and status

## How to Deploy to Production

### Step 1: Deploy Plugin to R2

```bash
cd plugins/multi-location
./deploy-plugin.sh
```

This will:
- Upload manifest.json to R2
- Upload migration SQL to R2
- Upload placeholder WASM module
- Make plugin available in the plugin registry

### Step 2: Install Plugin in POS

1. Open your POS application
2. Navigate to: **Settings → Plugins** (or `/hub` → Plugins card)
3. Search for "Multi-Location Management"
4. Click **Install**
5. The plugin will automatically run the migration and create the tables

### Step 3: Verify Installation

Check that tables were created:

```bash
# In Rust console or diagnostics page
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('restaurant_chains', 'location_tenants');
```

## How to Use Multi-Location Features

### Creating a Chain

The chain is auto-created the first time you access the Chain Management page:

1. Navigate to: `/chain` or Settings → Chain Management
2. The app will create a default chain for your tenant
3. You can view/edit chain details

### Adding Locations

1. Go to **Chain Management → Locations** tab
2. Click **Add Location**
3. Fill in the form:
   - Location name (e.g., "Downtown Branch")
   - Full address details
   - Contact info
   - Google Maps URL (optional)
4. Click **Create Location**
5. The location will be provisioned and added to your chain

### Viewing Real-Time Sales

1. Navigate to **Chain Management → Real-Time Sales** tab
2. View aggregated sales metrics across all locations
3. Filter by specific locations
4. See live sales updates

## For Local Development (Testing Without R2)

If you want to test the migration locally without deploying to R2:

### Option 1: Install Plugin Locally

The plugin system can install from a local manifest if you update the plugin registry worker to support local URLs.

### Option 2: Run Migration Manually (Temporary Fix)

If you need the tables immediately for testing:

```typescript
// In browser console (Tauri app)
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load("sqlite:pos-dev.db");

// Read and execute the migration
const migrationSQL = await fetch('/plugins/multi-location/migrations/001_location_tenants.sql').then(r => r.text());
await db.execute(migrationSQL);
```

Or use the Diagnostics page to run the SQL directly.

## Plugin Features

- ✅ Database schema creation via migrations
- ✅ Chain management UI (native React components)
- ✅ Location tracking with full metadata
- ✅ Real-time sales dashboard
- ✅ Cross-location reporting
- ✅ Google Maps integration
- ✅ Cloudflare provisioning support (optional)

## Plugin Manifest Details

- **ID**: `multi-location`
- **Version**: `2.1.0`
- **Type**: Hybrid (client-side UI + database)
- **Routes**:
  - `/chain` - Chain management dashboard
  - `/chain/locations` - Location management
  - `/chain/sales` - Real-time sales dashboard

## Troubleshooting

### Plugin Not Showing in Store

1. Verify R2 deployment succeeded
2. Check plugin registry worker is accessible
3. Verify manifest URL: `https://pub-d01c3c013f71424e8a32d71257785463.r2.dev/global/plugins/multi-location/2.1.0/manifest.json`

### Tables Not Created

1. Check plugin installation logs in browser console
2. Verify migration SQL was downloaded successfully
3. Check database permissions
4. Look for SQL errors in Rust logs

### Chain Management Page Not Loading

1. Ensure plugin is installed
2. Verify tables exist: `restaurant_chains` and `location_tenants`
3. Check browser console for errors
4. Verify Tauri commands are registered: `create_chain`, `get_chain`, `get_chain_locations`

## Architecture Notes

The multi-location system supports two approaches:

1. **Full Multi-Tenant** (Current): Separate tenant infrastructure per location with Cloudflare provisioning
2. **Simplified** (Alternative): Shared menu, separate databases, polling sync

The current plugin implements the full multi-tenant approach with the tables defined in migration 043.

## Next Steps

1. Deploy the plugin to R2: `cd plugins/multi-location && ./deploy-plugin.sh`
2. Install the plugin in your POS app
3. Access Chain Management: `/chain`
4. Add your first location
5. View real-time sales across locations

---

**Created**: 2026-02-10
**Plugin Version**: 2.1.0
**Migration Version**: 001
