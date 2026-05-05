# Google Places Integration for Restaurant POS

## Overview

The Google Places worker is a **read-only data fetcher** - it only retrieves data from Google Places API. Each restaurant's POS system stores reviews in its own tenant-specific D1 database.

## Architecture

```
┌──────────────────┐
│  Restaurant POS  │
│   (Admin Panel)  │
└────────┬─────────┘
         │
         │ 1. Fetch restaurant data
         ▼
┌──────────────────────────┐
│  Google Places Worker    │
│  (Read-Only)             │
│  - Fetches from Google   │
│  - Caches results (24h)  │
│  - Returns JSON          │
└────────┬─────────────────┘
         │
         │ 2. Data returned
         ▼
┌──────────────────┐
│  POS System      │
│  - Stores in     │
│    tenant D1 DB  │
└──────────────────┘
```

## Database Schema

The `google_reviews` table has been added to the tenant schema (`platform/scripts/tenant-schema.sql`).

All new tenant D1 databases will automatically include this table.

### For Existing Tenants

Run this migration on existing tenant databases:

```sql
-- Add google_reviews table
CREATE TABLE IF NOT EXISTS google_reviews (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  review_date TEXT NOT NULL,
  relative_time TEXT,
  source TEXT NOT NULL DEFAULT 'google',
  google_review_time INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_place ON google_reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON google_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON google_reviews(review_date DESC);
```

## POS Integration

### 1. Fetch Restaurant Details (Setup)

When setting up a new restaurant, fetch details from Google:

```typescript
// In POS setup wizard or admin panel
async function fetchRestaurantFromGoogle(googleUrl: string) {
  const response = await fetch(
    'https://handsfree-google-places.workers.dev/api/restaurant/fetch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleUrl,
        includeReviews: true,
        includePhotos: true,
        maxReviews: 10
      })
    }
  );

  const result = await response.json();

  if (result.success) {
    const data = result.data;

    // Save restaurant details to tenant metadata
    await saveTenantMetadata({
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      phone: data.phone,
      website: data.website,
      latitude: data.latitude,
      longitude: data.longitude,
      placeId: data.placeId,
      googleRating: data.googleRating,
      totalReviews: data.totalReviews
    });

    // Store reviews in tenant D1 database
    if (data.recentReviews) {
      await storeReviewsInD1(data.recentReviews);
    }

    return data;
  }

  throw new Error(result.error || 'Failed to fetch restaurant data');
}
```

### 2. Store Reviews in Tenant D1

```typescript
// Store reviews in this tenant's D1 database
async function storeReviewsInD1(reviews: RestaurantReview[], tenantDb: D1Database) {
  for (const review of reviews) {
    // Insert or update review
    await tenantDb
      .prepare(`
        INSERT INTO google_reviews (
          id, place_id, author_name, author_photo_url,
          rating, review_text, review_date, relative_time,
          source, google_review_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          review_text = excluded.review_text,
          rating = excluded.rating,
          relative_time = excluded.relative_time,
          updated_at = datetime('now')
      `)
      .bind(
        review.id,
        getCurrentPlaceId(), // From tenant metadata
        review.authorName,
        review.authorPhotoUrl || null,
        review.rating,
        review.text,
        review.reviewDate,
        review.relativeTime,
        'google',
        Math.floor(new Date(review.reviewDate).getTime() / 1000)
      )
      .run();
  }

  console.log(`✅ Stored ${reviews.length} reviews in tenant D1`);
}
```

### 3. Sync Reviews (Daily/Weekly)

Add a background task to sync reviews periodically:

```typescript
// POS background service or admin panel
async function syncGoogleReviews(tenantId: string, placeId: string) {
  console.log(`[ReviewSync] Syncing reviews for tenant ${tenantId}`);

  // Fetch latest reviews from Google
  const response = await fetch(
    'https://handsfree-google-places.worker.dev/api/restaurant/fetch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId,
        includeReviews: true,
        includePhotos: false,
        maxReviews: 50 // Fetch more for sync
      })
    }
  );

  const result = await response.json();

  if (result.success && result.data.recentReviews) {
    // Store in tenant D1
    const tenantDb = getTenantDatabase(tenantId);
    await storeReviewsInD1(result.data.recentReviews, tenantDb);

    // Update tenant metadata with latest rating
    await updateTenantMetadata(tenantId, {
      googleRating: result.data.googleRating,
      totalReviews: result.data.totalReviews,
      lastReviewSync: new Date().toISOString()
    });

    return {
      success: true,
      newReviews: result.data.recentReviews.length,
      totalReviews: result.data.totalReviews,
      averageRating: result.data.googleRating
    };
  }

  throw new Error('Failed to sync reviews');
}
```

### 4. Display Reviews in POS

Query reviews from the tenant D1 database:

```typescript
// Get reviews for display in POS or customer app
async function getReviews(tenantDb: D1Database, limit = 10) {
  const result = await tenantDb
    .prepare(`
      SELECT *
      FROM google_reviews
      WHERE place_id = ?
      ORDER BY review_date DESC
      LIMIT ?
    `)
    .bind(getCurrentPlaceId(), limit)
    .all();

  return result.results;
}

// Get review statistics
async function getReviewStats(tenantDb: D1Database) {
  const result = await tenantDb
    .prepare(`
      SELECT * FROM review_stats
      WHERE place_id = ?
    `)
    .bind(getCurrentPlaceId())
    .first();

  return result;
}
```

## API Endpoints

### Fetch Restaurant Details

**POST** `/api/restaurant/fetch`

```json
{
  "googleUrl": "https://www.google.com/maps/place/...",
  "includeReviews": true,
  "includePhotos": true,
  "maxReviews": 10
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
    "phone": "(415) 555-1234",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "placeId": "ChIJN1t_...",
    "googleRating": 4.5,
    "totalReviews": 1234,
    "recentReviews": [
      {
        "id": "ChIJN1t_..._1705939200",
        "authorName": "John Doe",
        "rating": 5,
        "text": "Amazing burgers!",
        "reviewDate": "2024-01-22T10:00:00.000Z",
        "relativeTime": "2 weeks ago",
        "source": "google"
      }
    ]
  }
}
```

### Extract Place ID

**POST** `/api/extract-place-id`

```json
{
  "url": "https://www.google.com/maps/place/..."
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

## Scheduled Review Sync

Add to POS admin panel or backend:

```typescript
// Run daily at 2 AM
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const tenants = await getAllActiveTenants(env);

    for (const tenant of tenants) {
      if (tenant.placeId) {
        try {
          await syncGoogleReviews(tenant.id, tenant.placeId);
          console.log(`✅ Synced reviews for ${tenant.name}`);
        } catch (error) {
          console.error(`❌ Failed to sync reviews for ${tenant.name}:`, error);
        }
      }
    }
  }
}
```

## Display Options

### Option 1: Show on Restaurant Storefront

```typescript
// In your customer-facing app
const reviews = await getReviews(tenantDb, 5);
const stats = await getReviewStats(tenantDb);

<div className="reviews">
  <div className="rating-summary">
    <span className="stars">⭐ {stats.average_rating}</span>
    <span className="count">({stats.total_reviews} reviews)</span>
  </div>

  {reviews.map(review => (
    <div key={review.id} className="review">
      <div className="author">
        {review.author_photo_url && (
          <img src={review.author_photo_url} alt={review.author_name} />
        )}
        <span>{review.author_name}</span>
      </div>
      <div className="rating">{'⭐'.repeat(review.rating)}</div>
      <p>{review.review_text}</p>
      <span className="date">{review.relative_time}</span>
    </div>
  ))}
</div>
```

### Option 2: Show in POS Dashboard

Display review analytics:
- Average rating trend
- Recent reviews
- Response rate
- Star distribution

## Best Practices

### 1. Cache Management
- Google Places worker caches for 24 hours
- Don't fetch more than once per day per restaurant
- Use cached results when available

### 2. Review Sync Frequency
- **Setup**: Fetch once during onboarding
- **Regular sync**: Daily at low-traffic hours (2-4 AM)
- **Manual sync**: Button in admin panel

### 3. Error Handling
```typescript
try {
  await syncGoogleReviews(tenantId, placeId);
} catch (error) {
  // Log error but don't fail
  console.error('Review sync failed:', error);
  // POS continues to work with existing reviews
}
```

### 4. Quota Management
- Google Places API: ~$0.017 per request
- With caching: ~50 requests/month per restaurant
- Cost: ~$0.85/month per restaurant

## Migration for Existing Tenants

For tenants already deployed without the google_reviews table:

```bash
# 1. Get list of all tenant D1 databases
npx wrangler d1 list | grep "_db"

# 2. For each tenant database, apply the schema
npx wrangler d1 execute <tenant-db-name> --remote --file=platform/workers/google-places/tenant-schema-addition.sql

# Example:
npx wrangler d1 execute khao-piyo-7766_db --remote --file=platform/workers/google-places/tenant-schema-addition.sql
```

## Testing

Test the integration:

```bash
# 1. Fetch restaurant data
curl -X POST https://handsfree-google-places.workers.dev/api/restaurant/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "placeId": "YOUR_PLACE_ID",
    "includeReviews": true,
    "maxReviews": 5
  }'

# 2. Check tenant D1 for stored reviews
npx wrangler d1 execute <tenant-db> --remote --command "SELECT COUNT(*) FROM google_reviews"
```

## Summary

- ✅ Google Places worker fetches data from Google (read-only)
- ✅ Each tenant stores reviews in their own D1 database
- ✅ POS calls the worker and stores the response
- ✅ Reviews sync daily via background job
- ✅ No shared database - fully multi-tenant
- ✅ Cost-effective with caching (~$0.85/month per restaurant)
