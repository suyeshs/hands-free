/**
 * Google Places API Integration
 * Extract restaurant details from Google Maps URL or Place ID
 *
 * Google Places API provides rich restaurant data including:
 * - Name, address, phone, website
 * - Cuisine types, price level
 * - Photos, reviews, ratings
 * - Opening hours
 */

export interface GooglePlaceReview {
  authorName: string;
  rating: number;
  text: string;
  time: string;
  relativeTime: string; // e.g., "2 weeks ago"
}

export interface GooglePlaceDetails {
  placeId: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  cuisine?: string[];
  priceLevel?: number;
  rating?: number;
  totalReviews?: number;
  reviews?: GooglePlaceReview[];
  photos?: string[];
  mapsUrl: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Extract Place ID from Google Maps URL
 * Supports various Google Maps URL formats:
 * - https://maps.google.com/?cid=123
 * - https://www.google.com/maps/place/Restaurant+Name/@lat,lng,zoom/data=!3m1!4b1!4m6!3m5!1s0xPLACE_ID
 * - https://goo.gl/maps/shortcode
 */
export function extractPlaceIdFromUrl(url: string): string | null {
  try {

    // Check for place ID in various formats
    // Format 1: /place/ URLs
    const placeMatch = url.match(/!1s([A-Za-z0-9_-]+)/);
    if (placeMatch) {
      return placeMatch[1];
    }

    // Format 2: cid= parameter
    const cidMatch = url.match(/[?&]cid=(\d+)/);
    if (cidMatch) {
      return cidMatch[1];
    }

    // Format 3: ftid= parameter
    const ftidMatch = url.match(/[?&]ftid=([A-Za-z0-9_-]+)/);
    if (ftidMatch) {
      return ftidMatch[1];
    }

    return null;
  } catch (error) {
    console.error('[GooglePlaces] Failed to parse URL:', error);
    return null;
  }
}

/**
 * Extract coordinates from Google Maps URL
 * Format: /@latitude,longitude,zoom
 * Example: /@13.0249313,77.6289492,17z
 */
export function extractCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  try {
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
      };
    }
    return null;
  } catch (error) {
    console.error('[GooglePlaces] Failed to extract coordinates:', error);
    return null;
  }
}

/**
 * Convert coordinates to Place ID using Geocoding API
 * This is useful when place ID extraction fails but we have coordinates
 */
export async function getPlaceIdFromCoordinates(
  lat: number,
  lng: number
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn('[GooglePlaces] API key not configured');
    return null;
  }

  try {
    console.log(`[GooglePlaces] Reverse geocoding coordinates: ${lat}, ${lng}`);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Return the first result's place_id
      const placeId = data.results[0].place_id;
      console.log(`[GooglePlaces] Found place_id from coordinates: ${placeId}`);
      return placeId;
    }

    console.warn('[GooglePlaces] No results from reverse geocoding');
    return null;
  } catch (error) {
    console.error('[GooglePlaces] Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * Helper function to extract address component by type
 */
function extractFromAddressComponents(
  components: any[],
  type: string
): string | undefined {
  if (!components) return undefined;
  const component = components.find((c: any) => c.types?.includes(type));
  return component?.longText || component?.shortText;
}

/**
 * Fetch place details from Google Places API
 * Note: This requires a Google Places API key and will make a request to Google's servers
 *
 * For production, you'll need to:
 * 1. Enable Google Places API in Google Cloud Console
 * 2. Get an API key
 * 3. Add it to .env as VITE_GOOGLE_PLACES_API_KEY
 * 4. Set up billing (Places API has free tier: 20,000 requests/month)
 */
export async function fetchPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn('[GooglePlaces] API key not configured. Add VITE_GOOGLE_PLACES_API_KEY to .env');
    return null;
  }

  try {
    // Use Places API (New) - Place Details endpoint
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=displayName,formattedAddress,addressComponents,internationalPhoneNumber,websiteUri,types,priceLevel,rating,userRatingCount,reviews,photos,location&key=${apiKey}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': 'displayName,formattedAddress,addressComponents,internationalPhoneNumber,websiteUri,types,priceLevel,rating,userRatingCount,reviews,photos,location',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract cuisine from types
    const cuisineTypes = data.types?.filter((type: string) =>
      type.includes('restaurant') ||
      type.includes('food') ||
      type.includes('cafe') ||
      type.includes('bar')
    ) || [];

    const details: GooglePlaceDetails = {
      placeId,
      name: data.displayName?.text || '',
      address: data.formattedAddress || '',
      city: extractFromAddressComponents(data.addressComponents, 'locality'),
      state: extractFromAddressComponents(data.addressComponents, 'administrative_area_level_1'),
      country: extractFromAddressComponents(data.addressComponents, 'country'),
      postalCode: extractFromAddressComponents(data.addressComponents, 'postal_code'),
      phone: data.internationalPhoneNumber,
      website: data.websiteUri,
      cuisine: cuisineTypes,
      priceLevel: data.priceLevel,
      rating: data.rating,
      totalReviews: data.userRatingCount,
      reviews: data.reviews?.map((review: any) => ({
        authorName: review.authorAttribution?.displayName || 'Anonymous',
        rating: review.rating,
        text: review.text?.text || '',
        time: review.publishTime,
        relativeTime: review.relativePublishTimeDescription,
      })) || [],
      photos: data.photos?.map((photo: any) => photo.name) || [],
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
      mapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    };

    console.log('[GooglePlaces] Fetched place details:', details);
    return details;
  } catch (error) {
    console.error('[GooglePlaces] Failed to fetch place details:', error);
    return null;
  }
}

/**
 * Get place details from Google Maps URL
 * This is the main function to use - pass a Google Maps URL and get restaurant details
 *
 * Strategy:
 * 1. Try to extract place ID from URL
 * 2. If that fails, extract coordinates and reverse geocode to get place ID
 * 3. Fetch place details using the place ID
 */
export async function getPlaceDetailsFromUrl(mapsUrl: string): Promise<GooglePlaceDetails | null> {
  let placeId = extractPlaceIdFromUrl(mapsUrl);

  if (!placeId) {
    console.warn('[GooglePlaces] Could not extract Place ID from URL, trying coordinate-based approach');

    // Fallback: Try extracting coordinates and reverse geocoding
    const coords = extractCoordinatesFromUrl(mapsUrl);
    if (coords) {
      console.log(`[GooglePlaces] Extracted coordinates: ${coords.lat}, ${coords.lng}`);
      placeId = await getPlaceIdFromCoordinates(coords.lat, coords.lng);
    }

    if (!placeId) {
      console.error('[GooglePlaces] Could not extract Place ID or coordinates from URL');
      return null;
    }
  }

  return fetchPlaceDetails(placeId);
}

/**
 * Alternative: Geocoding API approach (if Place ID extraction fails)
 * This uses the Geocoding API to search by name and address
 */
export async function searchPlaceByNameAndAddress(
  name: string,
  address: string
): Promise<GooglePlaceDetails | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn('[GooglePlaces] API key not configured');
    return null;
  }

  try {
    const query = encodeURIComponent(`${name}, ${address}`);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const place = data.results[0];
      const placeId = place.place_id;

      // Fetch detailed info using place ID
      return fetchPlaceDetails(placeId);
    }

    return null;
  } catch (error) {
    console.error('[GooglePlaces] Search failed:', error);
    return null;
  }
}

/**
 * Fallback: Extract basic info from Google Maps URL without API
 * Parses what we can from the URL structure itself
 */
export function parseBasicInfoFromUrl(url: string): Partial<GooglePlaceDetails> | null {
  try {
    // Extract restaurant name from URL
    const nameMatch = url.match(/place\/([^/@]+)/);
    const name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')) : '';

    // Extract coordinates if available (currently unused)
    // const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    return {
      name,
      mapsUrl: url,
    };
  } catch (error) {
    console.error('[GooglePlaces] Failed to parse URL:', error);
    return null;
  }
}
