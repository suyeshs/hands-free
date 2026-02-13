# Google Places Integration Worker

Cloudflare Worker that integrates with Google Places API to fetch restaurant data and sync reviews/ratings for the Handsfree platform.

## Features

- **Fetch Restaurant Details**: Get complete restaurant information from Google Places
- **Extract Place ID**: Parse Google Maps URLs to extract Place IDs
- **Sync Reviews**: Automatically sync Google reviews to your database
- **Smart Caching**: Cache restaurant details (24h) and reviews (1h) in KV
- **Review History**: Store all reviews in D1 database for historical tracking

## API Endpoints

### 1. Fetch Restaurant Details

**POST** `/api/restaurant/fetch`

Fetches complete restaurant information from Google Places API.

**Request Body:**
```json
{
  "googleUrl": "https://www.google.com/maps/place/...", // OR
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "includeReviews": true,   // Optional, default: true
  "includePhotos": true,    // Optional, default: true
  "maxReviews": 5           // Optional, default: 5
}
```

**Response:**
```json
{
  "success": true,
  "cached": false,
  "data": {
    "name": "The Big Burger",
    "address": "123 Main St, San Francisco, CA 94102",
    "city": "San Francisco",
    "state": "California",
    "pincode": "94102",
    "country": "United States",
    "phone": "(415) 555-1234",
    "internationalPhone": "+1 415-555-1234",
    "website": "https://thebigburger.com",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "googleMapsUrl": "https://maps.google.com/?cid=12345",
    "googleRating": 4.5,
    "totalReviews": 1234,
    "priceLevel": 2,
    "openNow": true,
    "hours": {
      "weekday_text": [
        "Monday: 11:00 AM – 10:00 PM",
        "Tuesday: 11:00 AM – 10:00 PM",
        ...
      ]
    },
    "categories": ["restaurant", "food", "establishment"],
    "businessStatus": "OPERATIONAL",
    "photos": [
      {
        "reference": "CmRaAAAA...",
        "width": 4032,
        "height": 3024
      }
    ],
    "recentReviews": [
      {
        "id": "ChIJN1t_tDeuEmsRUsoyG83frY4_1705939200",
        "authorName": "John Doe",
        "authorPhotoUrl": "https://lh3.googleusercontent.com/...",
        "rating": 5,
        "text": "Amazing burgers! Best in the city.",
        "reviewDate": "2024-01-22T10:00:00.000Z",
        "relativeTime": "2 weeks ago",
        "source": "google"
      }
    ],
    "lastSyncedAt": "2024-02-05T14:30:00.000Z",
    "source": "google_places"
  }
}
```

**Usage in Frontend:**

```typescript
// In your restaurant setup form
async function fetchRestaurantFromGoogle(googleUrl: string) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/restaurant/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleUrl,
      includeReviews: true,
      maxReviews: 10
    })
  });

  const result = await response.json();

  if (result.success) {
    // Populate form with restaurant details
    setRestaurantDetails({
      name: result.data.name,
      address: result.data.address,
      city: result.data.city,
      state: result.data.state,
      pincode: result.data.pincode,
      phone: result.data.phone,
      website: result.data.website,
      latitude: result.data.latitude,
      longitude: result.data.longitude,
      placeId: result.data.placeId
    });
  }
}
```

### 2. Verify Address

**POST** `/api/address/verify`

Verifies a customer address and returns coordinates + placeId. This is the primary endpoint for address verification across all apps.

**Request Body:**
```json
{
  "address": "123 MG Road, Bangalore, Karnataka 560001",
  "region": "IN"  // Optional, default: "IN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "address": "123, MG Road, Bangalore, Karnataka 560001, India",
    "coordinates": {
      "lat": 12.9716,
      "lng": 77.5946
    },
    "placeId": "ChIJbU60yXAWrjsR4E9-UejD3_g",
    "addressComponents": [...],
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "ADDRESS_NOT_FOUND",
  "message": "Address not found. Please provide a more specific address."
}
```

**Usage Example:**
```typescript
async function verifyCustomerAddress(address: string) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });

  const result = await response.json();

  if (result.success) {
    console.log('Address verified:', result.data.address);
    console.log('Coordinates:', result.data.coordinates);
    console.log('PlaceId:', result.data.placeId);
  } else {
    console.error('Verification failed:', result.message);
  }
}
```

### 3. Reverse Geocode

**POST** `/api/address/reverse-geocode`

Converts GPS coordinates to a formatted address with placeId.

**Request Body:**
```json
{
  "lat": 12.9716,
  "lng": 77.5946
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "MG Road, Bangalore, Karnataka 560001, India",
    "coordinates": {
      "lat": 12.9716,
      "lng": 77.5946
    },
    "placeId": "ChIJbU60yXAWrjsR4E9-UejD3_g",
    "addressComponents": [...],
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001"
  }
}
```

**Usage Example:**
```typescript
async function getAddressFromCoordinates(lat: number, lng: number) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/reverse-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  });

  const result = await response.json();
  return result.success ? result.data.address : null;
}
```

### 4. Get Place Details from PlaceId

**POST** `/api/address/place-details`

Retrieves full address details from a Google PlaceId. Automatically refreshes stale PlaceIds.

**Request Body:**
```json
{
  "placeId": "ChIJbU60yXAWrjsR4E9-UejD3_g"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "MG Road, Bangalore, Karnataka 560001, India",
    "coordinates": {
      "lat": 12.9716,
      "lng": 77.5946
    },
    "placeId": "ChIJbU60yXAWrjsR4E9-UejD3_g",
    "addressComponents": [...],
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001",
    "placeIdChanged": false  // True if placeId was automatically updated
  }
}
```

**Error Response (Invalid PlaceId):**
```json
{
  "success": false,
  "error": "PLACEID_NOT_FOUND",
  "message": "PlaceId is obsolete or not found"
}
```

**Usage Example:**
```typescript
async function getAddressFromPlaceId(placeId: string) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/place-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId })
  });

  const result = await response.json();

  if (result.success) {
    if (result.data.placeIdChanged) {
      console.log('PlaceId was updated:', result.data.placeId);
      // Update your database with the new placeId
    }
    return result.data;
  } else {
    console.error('PlaceId lookup failed:', result.message);
    // Prompt user to re-enter address
  }
}
```

### 5. Extract Place ID from URL

**POST** `/api/extract-place-id`

Extracts Google Place ID from a Google Maps URL.

**Request Body:**
```json
{
  "url": "https://www.google.com/maps/place/Restaurant+Name/@37.7749,-122.4194,17z/data=!3m1!4b1!4m5!3m4!1s0x808580c3a8d6a8b1:0x12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4"
  }
}
```

### 3. Sync Reviews

**POST** `/api/reviews/sync`

Syncs Google reviews to your database for a specific tenant.

**Request Body:**
```json
{
  "tenantId": "the-big-burger",
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "fullSync": true,      // Optional: sync all vs incremental
  "maxReviews": 50       // Optional: max reviews to sync
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tenantId": "the-big-burger",
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "totalReviews": 1234,
    "newReviews": 15,
    "updatedReviews": 3,
    "averageRating": 4.5,
    "syncedAt": "2024-02-05T14:30:00.000Z"
  }
}
```

**Usage - Automated Daily Sync:**

```typescript
// Run daily via Cloudflare Cron Trigger
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    // Sync reviews for all active tenants
    const tenants = await getAllActiveTenants(env);

    for (const tenant of tenants) {
      if (tenant.placeId) {
        await fetch('https://handsfree-google-places.workers.dev/api/reviews/sync', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: tenant.id,
            placeId: tenant.placeId,
            maxReviews: 50
          })
        });
      }
    }
  }
}
```

### 4. Get Stored Reviews

**GET** `/api/reviews?tenantId=xxx&placeId=yyy`

Retrieves stored reviews from the database.

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "ChIJN1t_tDeuEmsRUsoyG83frY4_1705939200",
        "tenant_id": "the-big-burger",
        "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
        "author_name": "John Doe",
        "author_photo_url": "https://...",
        "rating": 5,
        "review_text": "Amazing burgers!",
        "review_date": "2024-01-22T10:00:00.000Z",
        "relative_time": "2 weeks ago",
        "source": "google",
        "created_at": "2024-02-05T14:30:00.000Z",
        "updated_at": "2024-02-05T14:30:00.000Z"
      }
    ],
    "count": 50
  }
}
```

## Setup Instructions

### 1. Create KV Namespace

```bash
# Create KV for caching
npm run setup-kv

# Copy the namespace IDs and update wrangler.jsonc
```

### 2. Create D1 Database

```bash
# Create D1 database
npm run setup-d1

# Apply schema
npm run apply-schema

# Copy the database ID and update wrangler.jsonc
```

### 3. Verify Google Places API Access

**Note:** This worker uses the same Google Maps API key that's already configured for address verification.

The key is fetched automatically from the `handsfree-token-manager` service.

**Make sure your Google API key has Places API enabled:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Library"
3. Search for "Places API" and ensure it's **enabled**
4. Verify your API key restrictions include "Places API"
5. Billing must be enabled (Google provides $200/month free credit)

### 4. Update wrangler.jsonc with IDs

Replace the placeholders in `wrangler.jsonc` with your actual KV and D1 database IDs.

### 5. Deploy Worker

```bash
# Deploy to production
npm run deploy:prod
```

## Address Verification Integration Guide

### Why Use This Worker?

Instead of integrating Google Maps API directly in each app, use this centralized worker for:

- **Unified API Key Management**: Single source of truth for Google Maps API key
- **Consistent Caching**: Shared cache across all apps reduces API costs
- **Cost Optimization**: Built-in rate limiting and caching strategies
- **Automatic PlaceId Refresh**: Handles stale PlaceIds transparently
- **Cross-App Compatibility**: Works with React, Vue, mobile apps, POS systems, etc.

### Integration Examples

#### Example 1: Restaurant Client Address Entry

Replace the backend geocoding endpoint with the worker:

```typescript
// Before: Using backend endpoint
const response = await fetch(`${BACKEND_URL}/api/restaurant/geocode-address`, {
  method: 'POST',
  body: JSON.stringify({ addressString })
});

// After: Using Google Places Worker
const response = await fetch('https://handsfree-google-places.workers.dev/api/address/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: addressString })
});

const result = await response.json();

if (result.success) {
  // Save address with placeId for future quick lookup
  saveCustomerAddress({
    formatted: result.data.address,
    placeId: result.data.placeId,
    coordinates: result.data.coordinates,
    city: result.data.city,
    state: result.data.state,
    pincode: result.data.pincode
  });
}
```

#### Example 2: Quick Address Lookup with PlaceId

When customer has saved addresses, use placeId for instant verification:

```typescript
// Customer selects a saved address
async function loadSavedAddress(savedAddress: { placeId: string }) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/place-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId: savedAddress.placeId })
  });

  const result = await response.json();

  if (result.success) {
    // Address is still valid
    return result.data;
  } else if (result.error === 'PLACEID_NOT_FOUND') {
    // PlaceId is obsolete, prompt user to re-enter address
    promptAddressReentry();
  }
}
```

#### Example 3: POS System Address Verification

Mobile POS app verifying delivery addresses:

```typescript
// POS app verifying address before order creation
async function verifyDeliveryAddress(address: string) {
  try {
    const response = await fetch('https://handsfree-google-places.workers.dev/api/address/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, region: 'IN' })
    });

    const result = await response.json();

    if (!result.success) {
      return {
        valid: false,
        error: result.message || 'Address not found'
      };
    }

    // Check delivery radius
    const distance = calculateDistance(
      restaurantCoordinates,
      result.data.coordinates
    );

    return {
      valid: distance <= maxDeliveryRadius,
      address: result.data.address,
      coordinates: result.data.coordinates,
      placeId: result.data.placeId,
      distance,
      estimatedTime: calculateDeliveryTime(distance)
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Network error - please try again'
    };
  }
}
```

#### Example 4: Voice Ordering Address Entry

Integration with voice ordering system:

```typescript
// Voice AI confirms address with customer
async function confirmVoiceAddress(spokenAddress: string) {
  const response = await fetch('https://handsfree-google-places.workers.dev/api/address/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: spokenAddress })
  });

  const result = await response.json();

  if (result.success) {
    // Read back formatted address to customer for confirmation
    return {
      confirmed: true,
      formattedAddress: result.data.address,
      placeId: result.data.placeId,
      coordinates: result.data.coordinates,
      voicePrompt: `I have your address as ${result.data.address}. Is this correct?`
    };
  } else {
    return {
      confirmed: false,
      voicePrompt: 'Sorry, I could not find that address. Can you please repeat it more clearly?'
    };
  }
}
```

#### Example 5: Admin Panel - Restaurant Location Setup

Auto-populate restaurant details from Google Maps URL:

```typescript
// Admin enters Google Maps URL, worker extracts placeId and fetches details
async function setupRestaurantFromGoogleUrl(googleUrl: string) {
  // Step 1: Extract placeId from URL
  const extractResponse = await fetch('https://handsfree-google-places.workers.dev/api/extract-place-id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: googleUrl })
  });

  const { data: { placeId } } = await extractResponse.json();

  // Step 2: Get full restaurant details
  const detailsResponse = await fetch('https://handsfree-google-places.workers.dev/api/restaurant/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId, includeReviews: true })
  });

  const { data: restaurant } = await detailsResponse.json();

  // Auto-populate form
  return {
    name: restaurant.name,
    address: restaurant.address,
    city: restaurant.city,
    state: restaurant.state,
    pincode: restaurant.pincode,
    phone: restaurant.phone,
    website: restaurant.website,
    coordinates: {
      lat: restaurant.latitude,
      lng: restaurant.longitude
    },
    placeId: restaurant.placeId,
    googleRating: restaurant.googleRating,
    totalReviews: restaurant.totalReviews
  };
}
```

### Cost Optimization Tips

1. **Always save placeId**: When verifying an address, save the placeId returned. Future lookups using placeId are 40% cheaper.

2. **Use the worker's cache**: The worker caches results for 24 hours. Multiple apps benefit from shared cache.

3. **Batch verification**: If verifying multiple addresses, add a small delay between requests to benefit from potential cache hits.

4. **Validate before geocoding**: Check basic address format (e.g., has pincode, city) before calling the API.

## Integration with Restaurant Setup Form

### Example: Auto-populate from Google URL

```tsx
// In your restaurant setup component
import { useState } from 'react';

export function RestaurantSetupForm() {
  const [googleUrl, setGoogleUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurantData, setRestaurantData] = useState(null);

  async function handleFetchFromGoogle() {
    setLoading(true);

    try {
      const response = await fetch(
        'https://handsfree-google-places.workers.dev/api/restaurant/fetch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleUrl })
        }
      );

      const result = await response.json();

      if (result.success) {
        setRestaurantData(result.data);

        // Auto-populate form fields
        document.getElementById('name').value = result.data.name;
        document.getElementById('address').value = result.data.address;
        document.getElementById('city').value = result.data.city;
        document.getElementById('state').value = result.data.state;
        document.getElementById('pincode').value = result.data.pincode;
        document.getElementById('phone').value = result.data.phone;
        document.getElementById('website').value = result.data.website || '';
        document.getElementById('latitude').value = result.data.latitude;
        document.getElementById('longitude').value = result.data.longitude;

        // Store Place ID for review syncing
        document.getElementById('placeId').value = result.data.placeId;

        alert('Restaurant details loaded from Google!');
      }
    } catch (error) {
      console.error('Error fetching from Google:', error);
      alert('Failed to fetch restaurant details');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div>
        <label>Google Maps URL</label>
        <input
          type="url"
          value={googleUrl}
          onChange={(e) => setGoogleUrl(e.target.value)}
          placeholder="https://www.google.com/maps/place/..."
        />
        <button onClick={handleFetchFromGoogle} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch from Google'}
        </button>
      </div>

      {/* Display Google rating if available */}
      {restaurantData?.googleRating && (
        <div className="google-rating">
          <span>⭐ {restaurantData.googleRating}</span>
          <span>({restaurantData.totalReviews} reviews)</span>
        </div>
      )}

      {/* Rest of your form fields */}
    </div>
  );
}
```

## Pricing & Quotas

### Google Places API Pricing (as of 2024)

- **Place Details**: $0.017 per request
- **Place Photos**: $0.007 per request
- **Free Tier**: $200/month credit (≈11,700 Place Details requests)

### Caching Strategy

To minimize costs, the worker uses aggressive caching:

- **Restaurant Details**: 24 hours (rarely changes)
- **Reviews**: 1 hour (updates frequently)

For a restaurant with 100 views/day:
- Without caching: ~$51/month
- With caching: ~$1.70/month ✅

## Review Sync Best Practices

### Automatic Daily Sync

Add a cron trigger to your worker:

```jsonc
// In wrangler.jsonc
{
  "triggers": {
    "crons": ["0 2 * * *"] // Run at 2 AM daily
  }
}
```

### Manual Sync Trigger

Allow restaurant owners to manually trigger review sync from the admin panel.

### Display Reviews

Query the stored reviews to display on your restaurant page:

```typescript
async function getReviews(tenantId: string, placeId: string) {
  const response = await fetch(
    `https://handsfree-google-places.workers.dev/api/reviews?tenantId=${tenantId}&placeId=${placeId}`
  );

  const result = await response.json();
  return result.data.reviews;
}
```

## Supported Google Maps URL Formats

- `https://www.google.com/maps/place/Restaurant+Name/@lat,lng,zoom/data=...`
- `https://maps.google.com/?cid=123456789` (legacy CID format - not fully supported)
- Place ID parameter: `place_id=ChIJN1t_tDeuEmsRUsoyG83frY4`

## Error Handling

The worker returns structured errors:

```json
{
  "error": "Failed to fetch restaurant details",
  "message": "Google Places API error: INVALID_REQUEST - Invalid Place ID"
}
```

Common errors:
- `INVALID_REQUEST`: Invalid Place ID or missing parameters
- `ZERO_RESULTS`: Place not found
- `OVER_QUERY_LIMIT`: API quota exceeded
- `REQUEST_DENIED`: API key invalid or Places API not enabled

## Security

- API key stored as Cloudflare secret (not in code)
- CORS enabled for cross-origin requests
- Rate limiting recommended (not implemented yet)
- No sensitive data stored in KV cache

## Future Enhancements

- [ ] Support for Google Photos API to download images
- [ ] Sentiment analysis on reviews
- [ ] Review response tracking
- [ ] Multi-language review support
- [ ] Review moderation dashboard
- [ ] Webhook notifications for new reviews
- [ ] Integration with other review platforms (Yelp, TripAdvisor)
