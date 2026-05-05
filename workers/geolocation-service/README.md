# Geolocation Service Worker

A shared Cloudflare Worker that provides accurate geolocation data using Cloudflare's edge network. Can be used by all apps in the platform.

## Features

- 🌍 Accurate geolocation using Cloudflare's edge network
- 🚀 Fast response times (edge-cached)
- 🔒 CORS-enabled for cross-origin requests
- 📍 Provides city, state, postal code, coordinates, and timezone
- 🆓 No external API dependencies
- 📊 Better accuracy than IP-based geolocation services

## API Endpoints

### `GET /api/geo`

Returns geolocation data for the requesting client.

**Response:**
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

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "Geolocation Service",
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Deployment

### Prerequisites

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

### Deploy to Staging

```bash
cd workers/geolocation-service
npm install
npm run deploy:staging
```

### Deploy to Production

```bash
npm run deploy:production
```

### Local Development

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

## Usage Examples

### JavaScript/TypeScript

```typescript
async function getGeolocation() {
  try {
    const response = await fetch('https://geo.handsfree.tech/api/geo');
    const data = await response.json();

    console.log('City:', data.city);
    console.log('State:', data.region);
    console.log('Pincode:', data.postalCode);

    return data;
  } catch (error) {
    console.error('Failed to get geolocation:', error);
  }
}
```

### React Component

```tsx
import { useState, useEffect } from 'react';

function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://geo.handsfree.tech/api/geo')
      .then(res => res.json())
      .then(data => {
        setLocation(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Geolocation failed:', error);
        setLoading(false);
      });
  }, []);

  return { location, loading };
}

export function LocationForm() {
  const { location, loading } = useGeolocation();

  if (loading) return <div>Detecting location...</div>;

  return (
    <form>
      <input defaultValue={location?.city} name="city" />
      <input defaultValue={location?.region} name="state" />
      <input defaultValue={location?.postalCode} name="pincode" />
    </form>
  );
}
```

### cURL

```bash
curl https://geo.handsfree.tech/api/geo
```

## Custom Domain Setup

1. Add a DNS record in Cloudflare:
   - Type: `CNAME`
   - Name: `geo`
   - Target: `geolocation-service.workers.dev`
   - Proxy: Enabled (orange cloud)

2. Update `wrangler.toml`:
```toml
[env.production]
routes = [
  { pattern = "geo.handsfree.tech", custom_domain = true }
]
```

3. Deploy:
```bash
npm run deploy:production
```

## Monitoring

View real-time logs:
```bash
npm run tail
```

Or in the Cloudflare Dashboard:
- Workers & Pages → geolocation-service → Logs

## Cost

This worker runs on Cloudflare's free tier:
- **100,000 requests/day** free
- **10ms CPU time per request** (typically uses <1ms)
- No additional costs for geolocation data

For higher usage, see [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Apps Using This Service

- ✅ Restaurant POS (Desktop & Mobile)
- ✅ Staff Mobile App
- ✅ Owner Mobile App
- ✅ Tenant Activation Flow
- ✅ Customer-facing apps

## Advantages Over IP Geolocation APIs

| Feature | Cloudflare Worker | ipapi.co / ip-api.com |
|---------|-------------------|----------------------|
| Accuracy | ⭐⭐⭐⭐⭐ High | ⭐⭐⭐ Medium |
| Speed | <10ms | 200-500ms |
| Rate Limits | 100k/day free | 1k-45k/month |
| Reliability | 99.99% uptime | Variable |
| Cost | Free | $10-50/month |
| Postal Code | ✅ Accurate | ⚠️ Approximate |

## Support

For issues or questions, contact the platform team or open an issue in the main repository.
