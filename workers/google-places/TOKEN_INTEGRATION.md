# Google Maps API Key Integration

## Overview

The Google Places worker uses the **same Google Maps API key** that's already configured for address verification in the admin panel. This eliminates the need to manage multiple API keys and ensures consistency across the platform.

## How It Works

### Token Manager Service

The API key is centrally managed by the `handsfree-token-manager` service and fetched on-demand by workers that need it.

```
┌─────────────────────┐
│  Admin Panel        │──┐
│  (address verify)   │  │
└─────────────────────┘  │
                         │    ┌──────────────────────┐
┌─────────────────────┐  ├───▶│  Token Manager       │
│  Google Places      │──┤    │  (central storage)   │
│  Worker             │  │    └──────────────────────┘
└─────────────────────┘  │              │
                         │              │
┌─────────────────────┐  │              ▼
│  Other Workers      │──┘    google:maps_api_key
└─────────────────────┘
```

### Token Key

The API key is stored under the token key: **`google:maps_api_key`**

### Code Implementation

```typescript
// src/lib/token-manager.ts
import { Env } from '../types';

export async function getGoogleMapsApiKey(env: Env): Promise<string> {
  const response = await env.TOKEN_MANAGER.fetch(
    new Request(`https://token-manager/api/tokens/google:maps_api_key`, {
      headers: {
        'X-Worker-Name': 'handsfree-google-places',
      },
    })
  );

  const result = await response.json();
  return result.data.value;
}
```

### Usage in Worker

```typescript
// Fetch API key when needed
const apiKey = await getGoogleMapsApiKey(env);

// Use with Google Places API
const placeDetails = await fetchPlaceDetails(placeId, apiKey, options);
```

## API Key Requirements

Your Google Maps API key must have these APIs enabled:

1. **Maps JavaScript API** (for map display)
2. **Geocoding API** (for address verification)
3. **Places API** ✅ **Required for this worker**

## Verifying API Access

### Check if Places API is enabled:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Dashboard"
3. Verify "Places API" shows as "Enabled"

### Check API key restrictions:

1. Go to "Credentials"
2. Click on your API key
3. Under "API restrictions", verify these are allowed:
   - Maps JavaScript API
   - Geocoding API
   - **Places API** ✅

## Setting Up the API Key (First Time)

If you haven't set up the Google Maps API key yet:

### 1. Create Google Cloud Project

```bash
# Go to https://console.cloud.google.com/
# Create new project or select existing
```

### 2. Enable Required APIs

```bash
# Enable via Console or CLI:
gcloud services enable \
  maps-backend.googleapis.com \
  geocoding-backend.googleapis.com \
  places-backend.googleapis.com
```

### 3. Create API Key

```bash
# In Google Cloud Console:
# APIs & Services → Credentials → Create Credentials → API Key
```

### 4. Restrict the Key (Recommended)

```javascript
// API restrictions
{
  "allowedApis": [
    "maps-backend.googleapis.com",
    "geocoding-backend.googleapis.com",
    "places-backend.googleapis.com"
  ]
}
```

### 5. Store in Token Manager

**Option A: Using token-manager API**
```bash
curl -X POST https://handsfree-token-manager.workers.dev/api/tokens \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{
    "key": "google:maps_api_key",
    "value": "AIza...YOUR_API_KEY",
    "description": "Google Maps API key for Places, Geocoding, and Maps"
  }'
```

**Option B: Direct D1 database insert**
```sql
-- Insert into token-manager's D1 database
INSERT INTO tokens (key, value, description, created_at)
VALUES (
  'google:maps_api_key',
  'AIza...YOUR_API_KEY',
  'Google Maps API key for Places, Geocoding, and Maps',
  datetime('now')
);
```

### 6. Enable Billing

Google requires billing for Maps APIs:
- $200/month free credit
- Places API: ~$0.017 per request
- Geocoding API: ~$0.005 per request

With caching, typical monthly cost: **$1-5/month**

## Benefits of Centralized Key Management

### ✅ Single Source of Truth
- One API key for all Google Maps services
- Easier to rotate/update if compromised
- Consistent billing across services

### ✅ Simplified Deployment
- No need to set secrets per worker
- Automatic access for new workers
- Reduced configuration overhead

### ✅ Better Security
- Keys stored in encrypted D1 database
- Access controlled via service bindings
- No hardcoded keys in wrangler.jsonc

### ✅ Easier Monitoring
- Centralized usage tracking
- Single quota to monitor
- Unified cost analysis

## Troubleshooting

### Error: "Token fetch failed"

**Cause:** TOKEN_MANAGER service binding not configured

**Fix:** Verify `wrangler.jsonc` has:
```jsonc
{
  "services": [
    {
      "binding": "TOKEN_MANAGER",
      "service": "handsfree-token-manager"
    }
  ]
}
```

### Error: "API key not valid"

**Cause:** Places API not enabled or key restrictions too strict

**Fix:**
1. Enable Places API in Google Cloud Console
2. Check API key restrictions include "Places API"
3. Verify billing is enabled

### Error: "Invalid Place ID"

**Cause:** Place ID extraction failed or invalid Google Maps URL

**Fix:**
1. Use the `/api/extract-place-id` endpoint to test URL parsing
2. Try using Place ID directly instead of URL
3. Verify the Google Maps URL is for a business (not just a location pin)

## Cost Optimization

### Caching Strategy

The worker uses aggressive caching to minimize API calls:

```typescript
const CACHE_TTL = {
  RESTAURANT_DETAILS: 86400, // 24 hours
  REVIEWS: 3600,              // 1 hour
};
```

### Example Savings

**Restaurant with 100 views/day:**

| Strategy | Requests/Month | Cost/Month |
|----------|----------------|------------|
| No caching | ~3,000 | $51.00 |
| With caching | ~50 | **$0.85** |

**Savings: 98% reduction in API costs**

## Migration from Separate Keys

If you previously used a separate `GOOGLE_PLACES_API_KEY`:

1. Delete the old secret:
   ```bash
   wrangler secret delete GOOGLE_PLACES_API_KEY
   ```

2. Ensure token-manager has the key:
   ```bash
   curl https://handsfree-token-manager.workers.dev/api/tokens/google:maps_api_key
   ```

3. Redeploy the worker:
   ```bash
   npm run deploy:prod
   ```

## Related Documentation

- [Token Manager Setup](../../token-manager/README.md)
- [Google Places API Pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
