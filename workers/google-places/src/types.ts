/**
 * Google Places Integration Types
 */

export interface Env {
  // KV for caching Places API responses
  PLACES_CACHE: KVNamespace;

  // Service bindings
  TOKEN_MANAGER: Fetcher;

  // Environment variables
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
  CLOUDFLARE_ACCOUNT_ID: string;

  // NOTE: This worker DOES NOT store data
  // It only fetches from Google Places API
  // Reviews/ratings are stored in each tenant's own D1 database
}

/**
 * Google Places API Place Details Response
 */
export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
    periods: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  reviews?: GooglePlaceReview[];
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
    html_attributions: string[];
  }>;
  types: string[];
  business_status?: string;
  url?: string;
}

/**
 * Google Places Review
 */
export interface GooglePlaceReview {
  author_name: string;
  author_url?: string;
  language: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

/**
 * Structured Restaurant Details for Handsfree
 */
export interface RestaurantDetails {
  // Basic Info
  name: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;

  // Contact
  phone?: string;
  internationalPhone?: string;
  website?: string;

  // Location
  latitude: number;
  longitude: number;
  placeId: string;
  googleMapsUrl?: string;

  // Ratings & Reviews
  googleRating?: number;
  totalReviews?: number;
  priceLevel?: number; // 0-4 scale

  // Hours
  openNow?: boolean;
  hours?: {
    weekday_text: string[];
    periods: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };

  // Categories
  categories: string[];
  businessStatus?: string;

  // Photos
  photos?: Array<{
    reference: string;
    width: number;
    height: number;
  }>;

  // Reviews (limited to recent)
  recentReviews?: RestaurantReview[];

  // Metadata
  lastSyncedAt: string;
  source: 'google_places';
}

/**
 * Restaurant Review (formatted for Handsfree)
 */
export interface RestaurantReview {
  id: string; // Generated from Google review
  authorName: string;
  authorPhotoUrl?: string;
  rating: number; // 1-5
  text: string;
  reviewDate: string; // ISO timestamp
  relativeTime: string; // "2 days ago"
  source: 'google';
}

/**
 * Request to fetch restaurant details
 */
export interface FetchRestaurantRequest {
  // Either Google Places URL or Place ID
  googleUrl?: string;
  placeId?: string;

  // Options
  includeReviews?: boolean; // Default: true
  includePhotos?: boolean;  // Default: true
  maxReviews?: number;      // Default: 5
}

/**
 * Request to sync reviews
 */
export interface SyncReviewsRequest {
  tenantId: string;
  placeId: string;

  // Sync options
  fullSync?: boolean; // Sync all reviews vs incremental
  maxReviews?: number;
}

/**
 * Review sync result
 */
export interface ReviewSyncResult {
  tenantId: string;
  placeId: string;
  totalReviews: number;
  newReviews: number;
  updatedReviews: number;
  averageRating: number;
  syncedAt: string;
}

/**
 * Stored review in database
 */
export interface StoredReview {
  id: string;
  tenant_id: string;
  place_id: string;
  author_name: string;
  author_photo_url?: string;
  rating: number;
  review_text: string;
  review_date: string;
  relative_time: string;
  source: string; // 'google'
  google_review_time: number; // Original timestamp from Google
  created_at: string;
  updated_at: string;
}

/**
 * Address verification request
 */
export interface VerifyAddressRequest {
  address: string;
  region?: string; // Default: 'IN'
}

/**
 * Address verification response
 */
export interface VerifyAddressResponse {
  success: boolean;
  data?: {
    verified: boolean;
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    placeId: string;
    addressComponents: any[];
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  error?: string;
  message?: string;
}

/**
 * Reverse geocode request
 */
export interface ReverseGeocodeRequest {
  lat: number;
  lng: number;
}

/**
 * Reverse geocode response
 */
export interface ReverseGeocodeResponse {
  success: boolean;
  data?: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    placeId: string;
    addressComponents: any[];
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  error?: string;
  message?: string;
}

/**
 * Place details request
 */
export interface PlaceDetailsRequest {
  placeId: string;
}

/**
 * Place details response
 */
export interface PlaceDetailsResponse {
  success: boolean;
  data?: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    placeId: string;
    addressComponents: any[];
    city: string | null;
    state: string | null;
    pincode: string | null;
    placeIdChanged: boolean;
  };
  error?: string;
  message?: string;
}
