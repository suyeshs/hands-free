/**
 * Google Places Integration Worker
 *
 * Fetches restaurant data from Google Places API and syncs reviews/ratings
 */

import {
  Env,
  FetchRestaurantRequest,
  RestaurantDetails,
  RestaurantReview,
  GooglePlaceDetails,
  SyncReviewsRequest,
  ReviewSyncResult,
  StoredReview,
} from './types';
import { getGoogleMapsApiKey } from './lib/token-manager';

/**
 * CORS headers for cross-origin requests
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-ID',
};

/**
 * Google Places API endpoints
 */
const GOOGLE_PLACES_API = {
  PLACE_DETAILS: 'https://maps.googleapis.com/maps/api/place/details/json',
  PLACE_PHOTO: 'https://maps.googleapis.com/maps/api/place/photo',
};

/**
 * Cache TTL (1 day for restaurant details, 1 hour for reviews)
 */
const CACHE_TTL = {
  RESTAURANT_DETAILS: 86400, // 24 hours
  REVIEWS: 3600,              // 1 hour
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // Health check
      if (path === '/health') {
        return jsonResponse({ status: 'ok', service: 'google-places' });
      }

      // Fetch restaurant details from Google Places
      if (path === '/api/restaurant/fetch' && request.method === 'POST') {
        return handleFetchRestaurant(request, env);
      }

      // Sync reviews for a tenant
      if (path === '/api/reviews/sync' && request.method === 'POST') {
        return handleSyncReviews(request, env);
      }

      // Get cached reviews for a tenant
      if (path === '/api/reviews' && request.method === 'GET') {
        return handleGetReviews(request, env);
      }

      // Extract Place ID from Google URL
      if (path === '/api/extract-place-id' && request.method === 'POST') {
        return handleExtractPlaceId(request, env);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('[GooglePlaces] Error:', error);
      return jsonResponse(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  },
};

/**
 * Fetch restaurant details from Google Places
 */
async function handleFetchRestaurant(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as FetchRestaurantRequest;

    let placeId = body.placeId;

    // Extract Place ID from Google URL if provided
    if (body.googleUrl && !placeId) {
      placeId = extractPlaceIdFromUrl(body.googleUrl);
    }

    if (!placeId) {
      return jsonResponse({ error: 'placeId or googleUrl is required' }, 400);
    }

    console.log(`[GooglePlaces] Fetching details for Place ID: ${placeId}`);

    // Check cache first
    const cacheKey = `place:${placeId}`;
    const cached = await env.PLACES_CACHE.get(cacheKey, 'json');

    if (cached) {
      console.log(`[GooglePlaces] Cache hit for ${placeId}`);
      return jsonResponse({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Get Google Maps API key from Token Manager
    const apiKey = await getGoogleMapsApiKey(env);

    // Fetch from Google Places API
    const placeDetails = await fetchPlaceDetails(
      placeId,
      apiKey,
      {
        includeReviews: body.includeReviews !== false,
        includePhotos: body.includePhotos !== false,
      }
    );

    // Transform to Handsfree format
    const restaurantDetails = transformToRestaurantDetails(placeDetails, body.maxReviews || 5);

    // Cache the result
    await env.PLACES_CACHE.put(cacheKey, JSON.stringify(restaurantDetails), {
      expirationTtl: CACHE_TTL.RESTAURANT_DETAILS,
    });

    console.log(`[GooglePlaces] Successfully fetched and cached ${placeId}`);

    return jsonResponse({
      success: true,
      data: restaurantDetails,
      cached: false,
    });
  } catch (error) {
    console.error('[GooglePlaces] Fetch error:', error);
    return jsonResponse(
      {
        error: 'Failed to fetch restaurant details',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Sync reviews for a tenant's restaurant
 */
async function handleSyncReviews(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as SyncReviewsRequest;

    if (!body.tenantId || !body.placeId) {
      return jsonResponse({ error: 'tenantId and placeId are required' }, 400);
    }

    console.log(`[GooglePlaces] Syncing reviews for tenant ${body.tenantId}, place ${body.placeId}`);

    // Get Google Maps API key from Token Manager
    const apiKey = await getGoogleMapsApiKey(env);

    // Fetch latest reviews from Google
    const placeDetails = await fetchPlaceDetails(body.placeId, apiKey, {
      includeReviews: true,
      includePhotos: false,
    });

    if (!placeDetails.reviews || placeDetails.reviews.length === 0) {
      return jsonResponse({
        success: true,
        data: {
          tenantId: body.tenantId,
          placeId: body.placeId,
          totalReviews: 0,
          newReviews: 0,
          updatedReviews: 0,
          averageRating: placeDetails.rating || 0,
          syncedAt: new Date().toISOString(),
        },
      });
    }

    // Get existing reviews from database
    const existingReviews = await getStoredReviews(env.REVIEWS_DB, body.tenantId, body.placeId);
    const existingReviewTimes = new Set(existingReviews.map((r) => r.google_review_time));

    let newReviews = 0;
    let updatedReviews = 0;

    // Sync reviews to database
    for (const review of placeDetails.reviews.slice(0, body.maxReviews || 50)) {
      const reviewId = generateReviewId(body.placeId, review.time);

      if (existingReviewTimes.has(review.time)) {
        // Update existing review
        await updateReview(env.REVIEWS_DB, reviewId, body.tenantId, review);
        updatedReviews++;
      } else {
        // Insert new review
        await insertReview(env.REVIEWS_DB, reviewId, body.tenantId, body.placeId, review);
        newReviews++;
      }
    }

    const syncResult: ReviewSyncResult = {
      tenantId: body.tenantId,
      placeId: body.placeId,
      totalReviews: placeDetails.user_ratings_total || placeDetails.reviews.length,
      newReviews,
      updatedReviews,
      averageRating: placeDetails.rating || 0,
      syncedAt: new Date().toISOString(),
    };

    console.log(`[GooglePlaces] Review sync complete:`, syncResult);

    return jsonResponse({
      success: true,
      data: syncResult,
    });
  } catch (error) {
    console.error('[GooglePlaces] Sync error:', error);
    return jsonResponse(
      {
        error: 'Failed to sync reviews',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Get stored reviews for a tenant
 */
async function handleGetReviews(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');
  const placeId = url.searchParams.get('placeId');

  if (!tenantId || !placeId) {
    return jsonResponse({ error: 'tenantId and placeId are required' }, 400);
  }

  const reviews = await getStoredReviews(env.REVIEWS_DB, tenantId, placeId);

  return jsonResponse({
    success: true,
    data: {
      reviews,
      count: reviews.length,
    },
  });
}

/**
 * Extract Place ID from Google Maps URL
 */
async function handleExtractPlaceId(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { url: string };

    if (!body.url) {
      return jsonResponse({ error: 'url is required' }, 400);
    }

    const placeId = extractPlaceIdFromUrl(body.url);

    if (!placeId) {
      return jsonResponse({ error: 'Could not extract Place ID from URL' }, 400);
    }

    return jsonResponse({
      success: true,
      data: { placeId },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'Failed to extract Place ID',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Fetch place details from Google Places API
 */
async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  options: { includeReviews: boolean; includePhotos: boolean }
): Promise<GooglePlaceDetails> {
  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'rating',
    'user_ratings_total',
    'price_level',
    'opening_hours',
    'geometry',
    'address_components',
    'types',
    'business_status',
    'url',
  ];

  if (options.includeReviews) {
    fields.push('reviews');
  }

  if (options.includePhotos) {
    fields.push('photos');
  }

  const url = `${GOOGLE_PLACES_API.PLACE_DETAILS}?place_id=${placeId}&fields=${fields.join(',')}&key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data = (await response.json()) as any;

  if (data.status !== 'OK') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
  }

  return data.result;
}

/**
 * Transform Google Place Details to Handsfree Restaurant Details
 */
function transformToRestaurantDetails(
  place: GooglePlaceDetails,
  maxReviews: number
): RestaurantDetails {
  // Extract address components
  const addressComponents = place.address_components || [];
  const city = addressComponents.find((c) => c.types.includes('locality'))?.long_name;
  const state = addressComponents.find((c) => c.types.includes('administrative_area_level_1'))?.long_name;
  const pincode = addressComponents.find((c) => c.types.includes('postal_code'))?.long_name;
  const country = addressComponents.find((c) => c.types.includes('country'))?.long_name;

  // Transform reviews
  const recentReviews: RestaurantReview[] = (place.reviews || [])
    .slice(0, maxReviews)
    .map((review) => ({
      id: generateReviewId(place.place_id, review.time),
      authorName: review.author_name,
      authorPhotoUrl: review.profile_photo_url,
      rating: review.rating,
      text: review.text,
      reviewDate: new Date(review.time * 1000).toISOString(),
      relativeTime: review.relative_time_description,
      source: 'google' as const,
    }));

  // Transform photos
  const photos = (place.photos || []).map((photo) => ({
    reference: photo.photo_reference,
    width: photo.width,
    height: photo.height,
  }));

  return {
    // Basic Info
    name: place.name,
    address: place.formatted_address,
    city,
    state,
    pincode,
    country,

    // Contact
    phone: place.formatted_phone_number,
    internationalPhone: place.international_phone_number,
    website: place.website,

    // Location
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    placeId: place.place_id,
    googleMapsUrl: place.url,

    // Ratings & Reviews
    googleRating: place.rating,
    totalReviews: place.user_ratings_total,
    priceLevel: place.price_level,

    // Hours
    openNow: place.opening_hours?.open_now,
    hours: place.opening_hours
      ? {
          weekday_text: place.opening_hours.weekday_text,
          periods: place.opening_hours.periods,
        }
      : undefined,

    // Categories
    categories: place.types,
    businessStatus: place.business_status,

    // Photos
    photos: photos.length > 0 ? photos : undefined,

    // Reviews
    recentReviews: recentReviews.length > 0 ? recentReviews : undefined,

    // Metadata
    lastSyncedAt: new Date().toISOString(),
    source: 'google_places' as const,
  };
}

/**
 * Extract Place ID from Google Maps URL
 *
 * Supports formats:
 * - https://maps.google.com/?cid=1234567890
 * - https://www.google.com/maps/place/Restaurant+Name/@lat,lng,zoom/data=!3m1!4b1!4m5!3m4!1s0xABCDEF:0x1234567890
 * - https://goo.gl/maps/XXXXX (shortened URL - requires expansion)
 */
function extractPlaceIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Check for Place ID in path or query params
    const pathMatch = url.match(/place_id=([^&]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Check for data parameter containing Place ID
    const dataMatch = url.match(/!1s([^!]+)/);
    if (dataMatch) {
      return dataMatch[1];
    }

    // Check for CID (legacy format)
    const cidMatch = url.match(/cid=(\d+)/);
    if (cidMatch) {
      // Note: CID needs to be converted to Place ID via Geocoding API
      // For now, return null and require Place ID directly
      console.warn('[GooglePlaces] CID format not supported, please use Place ID');
      return null;
    }

    return null;
  } catch (error) {
    console.error('[GooglePlaces] Error extracting Place ID:', error);
    return null;
  }
}

/**
 * Generate deterministic review ID
 */
function generateReviewId(placeId: string, timestamp: number): string {
  return `${placeId}_${timestamp}`;
}

/**
 * Get stored reviews from database
 */
async function getStoredReviews(
  db: D1Database,
  tenantId: string,
  placeId: string
): Promise<StoredReview[]> {
  const result = await db
    .prepare(
      `
      SELECT * FROM google_reviews
      WHERE tenant_id = ? AND place_id = ?
      ORDER BY review_date DESC
      LIMIT 50
    `
    )
    .bind(tenantId, placeId)
    .all<StoredReview>();

  return result.results || [];
}

/**
 * Insert new review
 */
async function insertReview(
  db: D1Database,
  reviewId: string,
  tenantId: string,
  placeId: string,
  review: any
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO google_reviews (
        id, tenant_id, place_id, author_name, author_photo_url,
        rating, review_text, review_date, relative_time, source,
        google_review_time, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'google', ?, ?, ?)
    `
    )
    .bind(
      reviewId,
      tenantId,
      placeId,
      review.author_name,
      review.profile_photo_url || null,
      review.rating,
      review.text,
      new Date(review.time * 1000).toISOString(),
      review.relative_time_description,
      review.time,
      new Date().toISOString(),
      new Date().toISOString()
    )
    .run();
}

/**
 * Update existing review
 */
async function updateReview(
  db: D1Database,
  reviewId: string,
  tenantId: string,
  review: any
): Promise<void> {
  await db
    .prepare(
      `
      UPDATE google_reviews
      SET review_text = ?, rating = ?, relative_time = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `
    )
    .bind(
      review.text,
      review.rating,
      review.relative_time_description,
      new Date().toISOString(),
      reviewId,
      tenantId
    )
    .run();
}

/**
 * JSON response helper
 */
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
