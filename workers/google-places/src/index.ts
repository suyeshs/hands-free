/**
 * Google Places Integration Worker (Simplified - Read-Only)
 *
 * This worker ONLY fetches data from Google Places API.
 * It does NOT store any data - storage happens in tenant-specific D1 databases.
 */

import {
  Env,
  FetchRestaurantRequest,
  RestaurantDetails,
  RestaurantReview,
  GooglePlaceDetails,
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
 * Cache TTL (24 hours for restaurant details)
 */
const CACHE_TTL = 86400; // 24 hours

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

      // Extract Place ID from Google URL
      if (path === '/api/extract-place-id' && request.method === 'POST') {
        return handleExtractPlaceId(request, env);
      }

      // Verify address and get coordinates + placeId
      if (path === '/api/address/verify' && request.method === 'POST') {
        return handleVerifyAddress(request, env);
      }

      // Reverse geocode coordinates to address
      if (path === '/api/address/reverse-geocode' && request.method === 'POST') {
        return handleReverseGeocode(request, env);
      }

      // Get place details from placeId
      if (path === '/api/address/place-details' && request.method === 'POST') {
        return handlePlaceDetails(request, env);
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
    const restaurantDetails = transformToRestaurantDetails(placeDetails, body.maxReviews || 10);

    // Cache the result
    await env.PLACES_CACHE.put(cacheKey, JSON.stringify(restaurantDetails), {
      expirationTtl: CACHE_TTL,
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
 * Verify address and get coordinates + placeId
 */
async function handleVerifyAddress(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      address: string;
      region?: string;
    };

    if (!body.address || !body.address.trim()) {
      return jsonResponse({ error: 'address is required' }, 400);
    }

    console.log(`[GooglePlaces] Verifying address: ${body.address}`);

    // Get Google Maps API key from Token Manager
    const apiKey = await getGoogleMapsApiKey(env);

    // Geocode the address
    const geocodeResult = await geocodeAddress(body.address, apiKey, body.region || 'IN');

    if (!geocodeResult.success) {
      return jsonResponse(
        {
          success: false,
          error: geocodeResult.error,
          message: geocodeResult.message,
        },
        400
      );
    }

    return jsonResponse({
      success: true,
      data: {
        verified: true,
        address: geocodeResult.formattedAddress,
        coordinates: {
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
        },
        placeId: geocodeResult.placeId,
        addressComponents: geocodeResult.addressComponents,
        city: geocodeResult.addressComponents ? extractCity(geocodeResult.addressComponents) : null,
        state: geocodeResult.addressComponents ? extractState(geocodeResult.addressComponents) : null,
        pincode: geocodeResult.addressComponents ? extractPincode(geocodeResult.addressComponents) : null,
      },
    });
  } catch (error) {
    console.error('[GooglePlaces] Address verification error:', error);
    return jsonResponse(
      {
        success: false,
        error: 'Failed to verify address',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Reverse geocode coordinates to address
 */
async function handleReverseGeocode(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      lat: number;
      lng: number;
    };

    if (!body.lat || !body.lng) {
      return jsonResponse({ error: 'lat and lng are required' }, 400);
    }

    console.log(`[GooglePlaces] Reverse geocoding: ${body.lat}, ${body.lng}`);

    // Get Google Maps API key from Token Manager
    const apiKey = await getGoogleMapsApiKey(env);

    // Reverse geocode the coordinates
    const result = await reverseGeocode(body.lat, body.lng, apiKey);

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          error: result.error,
          message: result.message,
        },
        400
      );
    }

    return jsonResponse({
      success: true,
      data: {
        address: result.formattedAddress,
        coordinates: {
          lat: body.lat,
          lng: body.lng,
        },
        placeId: result.placeId,
        addressComponents: result.addressComponents,
        city: result.addressComponents ? extractCity(result.addressComponents) : null,
        state: result.addressComponents ? extractState(result.addressComponents) : null,
        pincode: result.addressComponents ? extractPincode(result.addressComponents) : null,
      },
    });
  } catch (error) {
    console.error('[GooglePlaces] Reverse geocoding error:', error);
    return jsonResponse(
      {
        success: false,
        error: 'Failed to reverse geocode coordinates',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Get place details from placeId
 */
async function handlePlaceDetails(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      placeId: string;
    };

    if (!body.placeId) {
      return jsonResponse({ error: 'placeId is required' }, 400);
    }

    console.log(`[GooglePlaces] Getting place details: ${body.placeId}`);

    // Get Google Maps API key from Token Manager
    const apiKey = await getGoogleMapsApiKey(env);

    // Get place details
    const result = await getPlaceDetailsById(body.placeId, apiKey);

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          error: result.error,
          message: result.message,
        },
        400
      );
    }

    return jsonResponse({
      success: true,
      data: {
        address: result.formattedAddress,
        coordinates: {
          lat: result.lat,
          lng: result.lng,
        },
        placeId: result.placeId,
        addressComponents: result.addressComponents,
        city: result.addressComponents ? extractCity(result.addressComponents) : null,
        state: result.addressComponents ? extractState(result.addressComponents) : null,
        pincode: result.addressComponents ? extractPincode(result.addressComponents) : null,
        placeIdChanged: result.placeId !== body.placeId,
      },
    });
  } catch (error) {
    console.error('[GooglePlaces] Place details error:', error);
    return jsonResponse(
      {
        success: false,
        error: 'Failed to get place details',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

/**
 * Geocode an address string to coordinates
 */
async function geocodeAddress(
  address: string,
  apiKey: string,
  region: string = 'IN'
): Promise<{
  success: boolean;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  placeId?: string;
  addressComponents?: any[];
  error?: string;
  message?: string;
}> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&region=${region}&key=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        success: true,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        addressComponents: result.address_components,
      };
    } else if (data.status === 'ZERO_RESULTS') {
      return {
        success: false,
        error: 'ADDRESS_NOT_FOUND',
        message: 'Address not found. Please provide a more specific address.',
      };
    } else {
      return {
        success: false,
        error: data.status,
        message: data.error_message || `Geocoding failed: ${data.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'GEOCODING_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reverse geocode coordinates to address
 */
async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{
  success: boolean;
  formattedAddress?: string;
  placeId?: string;
  addressComponents?: any[];
  error?: string;
  message?: string;
}> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        success: true,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        addressComponents: result.address_components,
      };
    } else {
      return {
        success: false,
        error: data.status,
        message: data.error_message || `Reverse geocoding failed: ${data.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'REVERSE_GEOCODING_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get place details by placeId
 */
async function getPlaceDetailsById(
  placeId: string,
  apiKey: string
): Promise<{
  success: boolean;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  placeId?: string;
  addressComponents?: any[];
  error?: string;
  message?: string;
}> {
  try {
    const fields = ['formatted_address', 'geometry', 'address_components', 'place_id'];
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields.join(
      ','
    )}&key=${apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.status === 'OK') {
      const result = data.result;
      return {
        success: true,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        addressComponents: result.address_components,
      };
    } else if (data.status === 'NOT_FOUND') {
      return {
        success: false,
        error: 'PLACEID_NOT_FOUND',
        message: 'PlaceId is obsolete or not found',
      };
    } else if (data.status === 'INVALID_REQUEST') {
      return {
        success: false,
        error: 'PLACEID_INVALID',
        message: 'PlaceId is invalid or deprecated',
      };
    } else {
      return {
        success: false,
        error: data.status,
        message: data.error_message || `Place Details failed: ${data.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'PLACE_DETAILS_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract pincode from address components
 */
function extractPincode(addressComponents: any[]): string | null {
  const postalCode = addressComponents.find((component) =>
    component.types.includes('postal_code')
  );
  return postalCode ? postalCode.long_name : null;
}

/**
 * Extract city from address components
 */
function extractCity(addressComponents: any[]): string | null {
  const city = addressComponents.find(
    (component) =>
      component.types.includes('locality') ||
      component.types.includes('administrative_area_level_2')
  );
  return city ? city.long_name : null;
}

/**
 * Extract state from address components
 */
function extractState(addressComponents: any[]): string | null {
  const state = addressComponents.find((component) =>
    component.types.includes('administrative_area_level_1')
  );
  return state ? state.long_name : null;
}

/**
 * Extract Place ID from Google Maps URL
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
