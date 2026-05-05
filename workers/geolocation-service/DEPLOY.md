# Deployment Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   cd workers/geolocation-service
   npm install
   ```

2. **Test locally:**
   ```bash
   npm run dev
   ```

   Visit http://localhost:8787/api/geo to test

3. **Deploy to production:**
   ```bash
   npm run deploy:production
   ```

4. **Get the worker URL:**
   After deployment, Wrangler will show the URL:
   ```
   Published geolocation-service (X.XX sec)
   https://geolocation-service.<your-subdomain>.workers.dev
   ```

5. **Update environment variable:**
   Add to your `.env` files:
   ```env
   VITE_GEO_SERVICE_URL=https://geolocation-service.<your-subdomain>.workers.dev
   ```

## Custom Domain (Optional)

1. **Add DNS record in Cloudflare:**
   - Log in to Cloudflare Dashboard
   - Select your domain (e.g., `handsfree.tech`)
   - Go to DNS → Records
   - Add CNAME record:
     - Name: `geo`
     - Target: `geolocation-service.<your-subdomain>.workers.dev`
     - Proxy: Enabled (orange cloud)

2. **Update wrangler.toml:**
   ```toml
   [env.production]
   name = "geolocation-service"
   routes = [
     { pattern = "geo.handsfree.tech", custom_domain = true }
   ]
   ```

3. **Deploy:**
   ```bash
   npm run deploy:production
   ```

4. **Update environment variable:**
   ```env
   VITE_GEO_SERVICE_URL=https://geo.handsfree.tech
   ```

## Verification

Test the deployed worker:

```bash
# Health check
curl https://geolocation-service.<your-subdomain>.workers.dev/health

# Get geolocation
curl https://geolocation-service.<your-subdomain>.workers.dev/api/geo
```

Expected response:
```json
{
  "country": "IN",
  "city": "Bengaluru",
  "region": "Karnataka",
  "regionCode": "KA",
  "postalCode": "560001",
  "latitude": "12.9716",
  "longitude": "77.5946",
  "timezone": "Asia/Kolkata",
  "continent": "AS",
  "metadata": {
    "asn": 12345,
    "colo": "BLR",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Monitoring

View real-time logs:
```bash
npm run tail
```

Or in Cloudflare Dashboard:
- Workers & Pages → geolocation-service → Logs

## Troubleshooting

### Worker not deploying

1. Check Wrangler is installed:
   ```bash
   wrangler --version
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Verify wrangler.toml is correct

### Getting empty geolocation data

This is expected when testing locally with `wrangler dev` - Cloudflare's geolocation data is only available in production.

Deploy to staging or production to test with real data:
```bash
npm run deploy:staging
```

### CORS errors in browser

The worker includes CORS headers. If you still see CORS errors:

1. Check the request URL is correct
2. Verify the worker is deployed
3. Check browser console for the actual error

## Cost Monitoring

Free tier includes:
- 100,000 requests per day
- 10ms CPU time per request

Monitor usage in Cloudflare Dashboard:
- Workers & Pages → geolocation-service → Metrics

## Support

For issues:
1. Check the [README](./README.md) for common solutions
2. View worker logs: `npm run tail`
3. Contact the platform team
