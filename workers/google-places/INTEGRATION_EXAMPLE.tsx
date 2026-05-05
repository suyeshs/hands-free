/**
 * Example: Restaurant Setup Form Integration
 *
 * This shows how to integrate the Google Places worker
 * with your restaurant setup/onboarding form.
 */

'use client';

import { useState } from 'react';

// API configuration
const GOOGLE_PLACES_API = 'https://handsfree-google-places.workers.dev';

interface RestaurantFormData {
  name: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  website?: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  googleRating?: number;
  totalReviews?: number;
}

export function RestaurantSetupForm() {
  const [googleUrl, setGoogleUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RestaurantFormData>({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
  });
  const [googleData, setGoogleData] = useState<any>(null);

  /**
   * Fetch restaurant details from Google Places
   */
  async function fetchFromGoogle() {
    if (!googleUrl) {
      alert('Please enter a Google Maps URL');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${GOOGLE_PLACES_API}/api/restaurant/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleUrl,
          includeReviews: true,
          includePhotos: true,
          maxReviews: 10,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch restaurant data');
      }

      const data = result.data;
      setGoogleData(data);

      // Auto-populate form
      setFormData({
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
        totalReviews: data.totalReviews,
      });

      alert('✅ Restaurant details loaded from Google!');
    } catch (error) {
      console.error('Error fetching from Google:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Submit restaurant setup
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Your existing tenant creation logic
    const tenantData = {
      ...formData,
      // Include Google metadata
      googlePlaceId: formData.placeId,
      googleRating: formData.googleRating,
      totalReviews: formData.totalReviews,
    };

    console.log('Creating tenant with data:', tenantData);

    // After tenant is created, optionally sync reviews
    if (formData.placeId) {
      await syncReviewsForTenant(tenantData.tenantId, formData.placeId);
    }
  }

  /**
   * Sync Google reviews for the newly created tenant
   */
  async function syncReviewsForTenant(tenantId: string, placeId: string) {
    try {
      const response = await fetch(`${GOOGLE_PLACES_API}/api/reviews/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          placeId,
          maxReviews: 50,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Synced ${result.data.newReviews} reviews for ${tenantId}`);
      }
    } catch (error) {
      console.error('Error syncing reviews:', error);
      // Don't fail tenant creation if review sync fails
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Restaurant Setup</h1>

      {/* Google Places Import Section */}
      <div className="mb-8 p-4 border rounded-lg bg-blue-50">
        <h2 className="text-lg font-semibold mb-3">
          🚀 Quick Import from Google
        </h2>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">
            Google Maps URL
          </label>
          <input
            type="url"
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
            placeholder="https://www.google.com/maps/place/..."
            className="w-full px-3 py-2 border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Paste your restaurant's Google Maps URL to auto-fill details
          </p>
        </div>

        <button
          onClick={fetchFromGoogle}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Import from Google'}
        </button>

        {/* Show Google rating if available */}
        {googleData && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="font-semibold">Google Rating:</span>
            <span className="text-yellow-600">
              ⭐ {googleData.googleRating} ({googleData.totalReviews} reviews)
            </span>
          </div>
        )}
      </div>

      {/* Restaurant Details Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Restaurant Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Address *
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input
              type="text"
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">State</label>
            <input
              type="text"
              value={formData.state || ''}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Pincode</label>
            <input
              type="text"
              value={formData.pincode || ''}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Website</label>
            <input
              type="url"
              value={formData.website || ''}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Latitude *
            </label>
            <input
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) =>
                setFormData({ ...formData, latitude: parseFloat(e.target.value) })
              }
              required
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Longitude *
            </label>
            <input
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) =>
                setFormData({ ...formData, longitude: parseFloat(e.target.value) })
              }
              required
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        {/* Hidden field for Place ID */}
        {formData.placeId && (
          <input type="hidden" name="placeId" value={formData.placeId} />
        )}

        <button
          type="submit"
          className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold"
        >
          Create Restaurant
        </button>
      </form>

      {/* Display recent reviews if available */}
      {googleData?.recentReviews && googleData.recentReviews.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Recent Google Reviews</h3>
          <div className="space-y-4">
            {googleData.recentReviews.slice(0, 3).map((review: any) => (
              <div key={review.id} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {review.authorPhotoUrl && (
                    <img
                      src={review.authorPhotoUrl}
                      alt={review.authorName}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{review.authorName}</p>
                    <p className="text-xs text-gray-500">{review.relativeTime}</p>
                  </div>
                  <span className="ml-auto text-yellow-600">
                    {'⭐'.repeat(review.rating)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Alternative: Use as a React Hook
 */
export function useGooglePlaces() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRestaurant(googleUrl: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${GOOGLE_PLACES_API}/api/restaurant/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleUrl }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return { fetchRestaurant, loading, error };
}

/**
 * Usage of the hook:
 *
 * const { fetchRestaurant, loading, error } = useGooglePlaces();
 *
 * const data = await fetchRestaurant('https://google.com/maps/...');
 */
