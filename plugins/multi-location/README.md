# Multi-Location Management Plugin

Complete multi-location management for restaurant chains with real-time sales aggregation.

## Features

- **Chain Management**: Create and manage restaurant chains
- **Location Tracking**: Track multiple restaurant locations with full metadata including address, contact info, and Google Maps integration
- **Real-Time Sales Dashboard**: Live aggregation of sales across all locations
- **Cross-Location Reporting**: Consolidated reports across all chain locations
- **Cloudflare Infrastructure**: Optional per-location tenant provisioning with separate D1, KV, R2, and Workers

## Installation

1. Navigate to Settings > Plugins
2. Search for "Multi-Location Management"
3. Click "Install"
4. The plugin will automatically create the required database tables

## Database Schema

### Tables Created

#### `restaurant_chains`
- `id`: Chain ID (primary key)
- `chain_name`: Name of the restaurant chain
- `master_tenant_id`: Master tenant ID for the chain
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

#### `location_tenants`
- `id`: Location ID (primary key)
- `chain_id`: Reference to restaurant chain
- `location_tenant_id`: Unique tenant ID for this location
- `location_name`: Name of the location
- Address fields: `address_line1`, `address_line2`, `city`, `state`, `pincode`, `country`
- Contact: `phone`, `email`
- Provisioning: `activation_code`, `subdomain`, `restaurant_type`, `provisioning_status`
- Cloudflare resources: `d1_database_id`, `kv_namespace_id`, `r2_bucket_name`, `worker_url`
- Google Maps metadata: `google_place_id`, `google_maps_url`, `google_rating`, `google_total_reviews`, `latitude`, `longitude`
- Status and timestamps

## Usage

### Creating a Chain

1. Go to Chain Management
2. The first time you access it, a default chain will be created
3. You can customize the chain name and settings

### Adding Locations

1. Navigate to Chain Management > Locations
2. Click "Add Location"
3. Fill in location details:
   - Location name
   - Full address
   - Contact information
   - Google Maps link (optional)
4. Click "Create Location"

### Viewing Real-Time Sales

1. Navigate to Chain Management > Real-Time Sales
2. View aggregated metrics across all locations
3. Filter by specific locations
4. See live sales updates

## Development

### Migration Files

The plugin includes migration `001_location_tenants.sql` which creates:
- `restaurant_chains` table
- `location_tenants` table
- Indexes for performance
- Triggers for automatic timestamp updates

### Deployment

To deploy the plugin to R2:

```bash
cd plugins/multi-location
npm run deploy
```

## Version History

### 2.1.0 (2026-02-10)
- Initial plugin release
- Multi-location database schema
- Chain management UI
- Real-time sales dashboard

## License

Proprietary - HandsFree POS Team
