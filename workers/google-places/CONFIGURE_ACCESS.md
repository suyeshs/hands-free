# Configure Token Manager Access

The Google Places Worker needs permission to access the Google Maps API key from the token manager.

## Quick Setup

Run this command to grant access:

```bash
# Set your admin API key
export ADMIN_API_KEY="your-admin-api-key-here"

# Run the grant access script
./grant-token-access.sh
```

## Manual Setup (if script doesn't work)

Use this curl command directly:

```bash
curl -X POST 'https://handsfree-token-manager.suyesh.workers.dev/api/admin/policies' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ADMIN_API_KEY_HERE' \
  -d '{
    "workerName": "handsfree-google-places",
    "allowedTokens": ["google:maps_api_key"]
  }'
```

Expected response:
```json
{
  "success": true,
  "timestamp": "2024-02-05T10:30:00.000Z"
}
```

## Verify Access

After configuring, test the worker:

```bash
curl -X POST 'https://handsfree-google-places-prod.suyesh.workers.dev/api/address/verify' \
  -H 'Content-Type: application/json' \
  -d '{"address": "MG Road, Bangalore, Karnataka 560001"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "verified": true,
    "address": "MG Road, Bengaluru, Karnataka 560001, India",
    "coordinates": {
      "lat": 12.9716,
      "lng": 77.5946
    },
    "placeId": "ChIJbU60yXAWrjsR4E9-UejD3_g",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001"
  }
}
```

## Troubleshooting

### Error: "Access denied" (403)

This means the policy hasn't been created yet. Run the setup command above.

### Error: "Unauthorized" (401)

Your admin API key is incorrect. Get the correct key:

```bash
# In the token-manager directory
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/token-manager

# The ADMIN_API_KEY secret is already set - you need to retrieve it from Cloudflare dashboard
# Or ask the platform administrator for the key
```

### Error: "Token not found" (404)

The Google Maps API key hasn't been stored in the token manager yet. Store it with:

```bash
curl -X POST 'https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ADMIN_API_KEY' \
  -d '{
    "service": "google",
    "key": "maps_api_key",
    "value": "YOUR_GOOGLE_MAPS_API_KEY"
  }'
```

## Check Current Policies

To see all configured access policies:

```bash
curl 'https://handsfree-token-manager.suyesh.workers.dev/api/admin/policies' \
  -H 'Authorization: Bearer YOUR_ADMIN_API_KEY'
```

## Alternative: Direct API Key Configuration

If you prefer not to use the token manager, you can set the Google Maps API key directly in the google-places worker:

```bash
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/google-places

# Set the API key as a secret
npx wrangler secret put GOOGLE_MAPS_API_KEY --env production
# Enter your Google Maps API key when prompted

# Update src/lib/token-manager.ts to fallback to env variable
```

Then modify the code to check for `env.GOOGLE_MAPS_API_KEY` before trying the token manager.
