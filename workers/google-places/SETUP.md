# Google Places Worker - Quick Setup Guide

## Prerequisites

- Cloudflare account
- Google Cloud account with billing enabled
- wrangler CLI installed

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd platform/workers/google-places
npm install
```

### 2. Create KV Namespace for Caching

```bash
# Create KV namespace
npx wrangler kv:namespace create PLACES_CACHE

# Output will be something like:
# { binding = "PLACES_CACHE", id = "abc123..." }

# Update wrangler.jsonc with the ID
# Replace "REPLACE_WITH_KV_ID" with the actual ID
```

### 3. Create D1 Database for Reviews

```bash
# Create D1 database
npx wrangler d1 create handsfree-reviews

# Output will show database ID
# Update wrangler.jsonc with the database ID

# Apply schema
npx wrangler d1 execute handsfree-reviews --remote --file=./schema.sql
```

### 4. Verify Google Maps API Key

**Important:** This worker uses the same Google Maps API key that's already configured for address verification in your admin panel.

The API key is fetched from the `handsfree-token-manager` service using the token key: `google:maps_api_key`

**If you haven't set up the Google Maps API key yet:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these APIs:
   - **Maps JavaScript API**
   - **Geocoding API**
   - **Places API** (required for this worker)
3. Create API key and restrict it to these APIs
4. Store the key in token-manager (see token-manager setup docs)

**Verify the key has Places API access:**
- Go to Google Cloud Console → Credentials
- Edit your API key
- Under "API restrictions", ensure "Places API" is enabled

### 5. Update wrangler.jsonc

Replace placeholders in `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "PLACES_CACHE",
      "id": "YOUR_KV_ID_HERE" // ← Replace this
    }
  ],
  "d1_databases": [
    {
      "binding": "REVIEWS_DB",
      "database_name": "handsfree-reviews",
      "database_id": "YOUR_D1_ID_HERE" // ← Replace this
    }
  ]
}
```

### 6. Deploy Worker

```bash
# Deploy to production
npx wrangler deploy --env production

# Output will show your worker URL:
# https://handsfree-google-places.workers.dev
```

### 7. Test the Worker

```bash
# Test with curl
curl -X POST https://handsfree-google-places.workers.dev/api/restaurant/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "includeReviews": true,
    "maxReviews": 5
  }'
```

## Verification Checklist

- [ ] KV namespace created and ID updated in wrangler.jsonc
- [ ] D1 database created and ID updated in wrangler.jsonc
- [ ] Database schema applied successfully
- [ ] Google Places API enabled in Google Cloud Console
- [ ] API key created and restricted to Places API
- [ ] Billing enabled on Google Cloud account
- [ ] API key set as Cloudflare secret
- [ ] Worker deployed successfully
- [ ] Test request returns valid data

## Troubleshooting

### "API key not valid" error

- Check that Places API is enabled in Google Cloud Console
- Verify API key restrictions allow Places API
- Ensure billing is enabled

### "Database not found" error

- Run schema application: `npx wrangler d1 execute handsfree-reviews --remote --file=./schema.sql`
- Verify D1 database ID in wrangler.jsonc matches actual database

### "KV namespace not found" error

- Verify KV namespace ID in wrangler.jsonc
- Check that KV namespace was created: `npx wrangler kv:namespace list`

### CORS errors in browser

- Worker includes CORS headers by default
- Check browser console for specific error messages

## Cost Estimation

### Google Places API

- **Place Details**: $0.017 per request
- **Free tier**: $200/month (≈11,700 requests)

### Example Restaurant (100 views/day)

**Without caching:**
- 100 requests/day × 30 days = 3,000 requests/month
- 3,000 × $0.017 = **$51/month**

**With caching (24h TTL):**
- ~1-2 requests/day for new data
- ~50 requests/month
- 50 × $0.017 = **$0.85/month** ✅

### Cloudflare Costs

- **Workers**: Free tier (100,000 requests/day)
- **KV**: $0.50/million reads (first 10M reads free)
- **D1**: Free tier (25GB storage, 5M reads/day)

**Total monthly cost**: ~$1-5/month for typical usage

## Next Steps

1. Integrate with your restaurant setup form
2. Add review sync to daily cron job
3. Display Google ratings on restaurant pages
4. Set up monitoring/alerts for API errors
5. Add analytics to track API usage

## Support

For issues or questions:
- Check the main [README.md](./README.md) for API documentation
- Review [Google Places API docs](https://developers.google.com/maps/documentation/places/web-service/overview)
- Check Cloudflare Workers [documentation](https://developers.cloudflare.com/workers/)
