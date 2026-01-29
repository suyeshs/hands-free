import { useState } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { getPlaceDetailsFromUrl, parseBasicInfoFromUrl } from '../../services/googlePlaces';
import { RestaurantType, RESTAURANT_TYPE_CONFIGS } from '../../types/restaurantTypes';
import { toast } from 'sonner';

export interface LocationFormData {
  locationName: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  country: string;
  phone?: string;
  email?: string;
  restaurantType: RestaurantType;
  googleMapsUrl?: string;
  // Google Maps metadata (optional)
  googlePlaceId?: string;
  googleRating?: number;
  googleTotalReviews?: number;
  latitude?: number;
  longitude?: number;
}

interface LocationCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LocationFormData) => Promise<void>;
  defaultRestaurantType?: RestaurantType;
}

interface GooglePlacePreview {
  rating?: number;
  totalReviews?: number;
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    relativeTime: string;
  }>;
  cuisine?: string[];
  priceLevel?: number;
  photos?: string[];
}

export function LocationCreationModal({
  isOpen,
  onClose,
  onSubmit,
  defaultRestaurantType = RestaurantType.FULL_SERVICE,
}: LocationCreationModalProps) {
  // Filter out business structure types for individual locations
  const getLocationRestaurantType = (type: RestaurantType): RestaurantType => {
    // If master tenant is MULTI_BRAND or LARGE_CHAIN, default to FULL_SERVICE for locations
    if (type === RestaurantType.MULTI_BRAND || type === RestaurantType.LARGE_CHAIN) {
      return RestaurantType.FULL_SERVICE;
    }
    return type;
  };

  const [formData, setFormData] = useState<LocationFormData>({
    locationName: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
    },
    country: 'India',
    phone: '',
    email: '',
    restaurantType: getLocationRestaurantType(defaultRestaurantType),
    googleMapsUrl: '',
  });

  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [isLoadingGoogleData, setIsLoadingGoogleData] = useState(false);
  const [googlePlacePreview, setGooglePlacePreview] = useState<GooglePlacePreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleGoogleMapsAutoFill = async () => {
    if (!googleMapsUrl.trim()) {
      toast.error('Please enter a Google Maps URL');
      return;
    }

    setIsLoadingGoogleData(true);
    try {
      // Try to fetch full details from Google Places API
      const placeDetails = await getPlaceDetailsFromUrl(googleMapsUrl);

      if (placeDetails) {
        // Auto-fill form with Google Places data
        setFormData((prev) => ({
          ...prev,
          locationName: placeDetails.name,
          address: {
            line1: placeDetails.address.split(',')[0]?.trim() || '',
            line2: placeDetails.address.split(',')[1]?.trim() || '',
            city: placeDetails.city || '',
            state: placeDetails.state || '',
            pincode: placeDetails.postalCode || '',
          },
          country: placeDetails.country || 'India',
          phone: placeDetails.phone || '',
          googleMapsUrl: googleMapsUrl,
          googlePlaceId: placeDetails.placeId,
          googleRating: placeDetails.rating,
          googleTotalReviews: placeDetails.totalReviews,
          latitude: placeDetails.latitude,
          longitude: placeDetails.longitude,
        }));

        // Show preview of Google Maps data
        setGooglePlacePreview({
          rating: placeDetails.rating,
          totalReviews: placeDetails.totalReviews,
          reviews: placeDetails.reviews,
          cuisine: placeDetails.cuisine,
          priceLevel: placeDetails.priceLevel,
          photos: placeDetails.photos,
        });

        toast.success(
          `Auto-filled from Google Maps ${placeDetails.rating ? `(${placeDetails.rating}⭐ • ${placeDetails.totalReviews} reviews)` : ''}`
        );
      } else {
        // Fallback: Parse basic info from URL (no API call)
        const basicInfo = parseBasicInfoFromUrl(googleMapsUrl);
        if (basicInfo?.name) {
          setFormData((prev) => ({
            ...prev,
            locationName: basicInfo.name!,
            googleMapsUrl: googleMapsUrl,
          }));
          toast.info('Extracted restaurant name. Please fill in address manually.');
        } else {
          toast.error('Could not extract details from URL. Please check the URL format.');
        }
      }
    } catch (error) {
      console.error('Failed to fetch Google Maps data:', error);
      toast.error('Failed to fetch Google Maps data. Please fill in manually.');
    } finally {
      setIsLoadingGoogleData(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Location name validation
    if (!formData.locationName || formData.locationName.trim().length < 2) {
      newErrors.locationName = 'Location name must be at least 2 characters';
    }
    if (formData.locationName.length > 100) {
      newErrors.locationName = 'Location name must be less than 100 characters';
    }

    // Address line 1 validation
    if (!formData.address.line1 || formData.address.line1.trim().length < 5) {
      newErrors.addressLine1 = 'Street address must be at least 5 characters';
    }
    if (formData.address.line1.length > 200) {
      newErrors.addressLine1 = 'Street address is too long';
    }

    // City validation
    if (!formData.address.city || formData.address.city.trim().length < 2) {
      newErrors.city = 'City is required';
    }

    // State validation
    if (!formData.address.state || formData.address.state.trim().length < 2) {
      newErrors.state = 'State is required';
    }

    // Pincode validation (India format: 6 digits)
    if (!formData.address.pincode || !/^\d{6}$/.test(formData.address.pincode)) {
      newErrors.pincode = 'Pincode must be exactly 6 digits';
    }

    // Phone validation (optional, but validate if provided)
    if (formData.phone && !/^\+?\d{10,15}$/.test(formData.phone.replace(/[\s-]/g, ''))) {
      newErrors.phone = 'Invalid phone number format';
    }

    // Email validation (optional, but validate if provided)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Failed to create location:', error);
      toast.error('Failed to create location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }

    // Clear error for this field
    setErrors((prev) => ({
      ...prev,
      [field]: '',
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Add New Location</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-surface-2">
          {/* Google Maps URL Input */}
          <div className="bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-2 text-blue-900 mb-2">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold">Google Maps Auto-Fill (Optional)</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Paste a Google Maps URL to automatically populate restaurant name, full address, phone number, ratings, and reviews
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <input
                type="url"
                placeholder="https://www.google.com/maps/place/..."
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                className="flex-1 px-3 py-2 bg-card border border-blue-300 text-foreground text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleGoogleMapsAutoFill}
                disabled={isLoadingGoogleData}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium border border-blue-600"
              >
                {isLoadingGoogleData ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Data'
                )}
              </button>
            </div>
          </div>

          {/* Google Place Preview */}
          {googlePlacePreview && (
            <div className="bg-green-50 border border-green-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-green-900">
                  ✓ Google Maps Data Retrieved
                </h4>
                {googlePlacePreview.rating && (
                  <span className="text-base font-semibold text-green-900">⭐ {googlePlacePreview.rating}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {googlePlacePreview.totalReviews && (
                  <div>
                    <span className="text-green-700 font-medium">Total Reviews:</span>
                    <span className="ml-1 text-foreground">{googlePlacePreview.totalReviews.toLocaleString()}</span>
                  </div>
                )}
                {googlePlacePreview.priceLevel && (
                  <div>
                    <span className="text-green-700 font-medium">Price Level:</span>
                    <span className="ml-1 text-foreground">{'₹'.repeat(googlePlacePreview.priceLevel)}</span>
                  </div>
                )}
              </div>

              {googlePlacePreview.cuisine && googlePlacePreview.cuisine.length > 0 && (
                <div className="text-xs">
                  <span className="text-green-700 font-medium">Cuisine:</span>
                  <span className="ml-1 text-foreground">{googlePlacePreview.cuisine.join(', ')}</span>
                </div>
              )}

              {googlePlacePreview.reviews && googlePlacePreview.reviews.length > 0 && (
                <div className="text-xs space-y-2">
                  <span className="text-green-700 font-semibold">Recent Reviews:</span>
                  {googlePlacePreview.reviews.slice(0, 2).map((review, idx) => (
                    <div key={idx} className="bg-card p-2 border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-foreground">⭐ {review.rating}</span>
                        <span className="text-foreground font-medium">{review.authorName}</span>
                        <span className="text-muted-foreground">{review.relativeTime}</span>
                      </div>
                      <p className="text-foreground line-clamp-2">{review.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-green-700 border-t border-green-200 pt-2">
                ℹ️ Address and contact details have been auto-filled in the form below. Review data is shown for reference only.
              </div>
            </div>
          )}

          {/* Form Sections */}
          <div className="bg-card p-6 border border space-y-6">
            <h3 className="text-base font-semibold text-foreground">Location Details</h3>

            {/* Location Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Location Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.locationName}
                onChange={(e) => handleInputChange('locationName', e.target.value)}
                placeholder="e.g., Downtown Branch, Airport Location"
                className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {errors.locationName && (
                <p className="mt-1 text-xs text-red-600">{errors.locationName}</p>
              )}
            </div>

            {/* Address Section */}
            <div className="space-y-4 pt-4 border-t border">
              <h4 className="text-sm font-semibold text-foreground">Full Address</h4>

              {/* Street Address Line 1 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Street Address Line 1 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.address.line1}
                  onChange={(e) => handleInputChange('address.line1', e.target.value)}
                  placeholder="Building number and street name"
                  className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                {errors.addressLine1 && (
                  <p className="mt-1 text-xs text-red-600">{errors.addressLine1}</p>
                )}
              </div>

              {/* Street Address Line 2 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Street Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={formData.address.line2}
                  onChange={(e) => handleInputChange('address.line2', e.target.value)}
                  placeholder="Suite, unit, floor (optional)"
                  className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* City and State */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    City <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    placeholder="Mumbai"
                    className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  {errors.city && (
                    <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    State <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    placeholder="Maharashtra"
                    className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  {errors.state && (
                    <p className="mt-1 text-xs text-red-600">{errors.state}</p>
                  )}
                </div>
              </div>

              {/* Pincode */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Pincode <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.address.pincode}
                  onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                  placeholder="400001"
                  maxLength={6}
                  className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <p className="mt-1 text-xs text-muted-foreground">Must be exactly 6 digits</p>
                {errors.pincode && (
                  <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>
                )}
              </div>
            </div>

            {/* Contact Section */}
            <div className="space-y-4 pt-4 border-t border">
              <h4 className="text-sm font-semibold text-foreground">Contact Information (Optional)</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="location@restaurant.com"
                    className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Restaurant Type */}
            <div className="pt-4 border-t border">
              <label className="block text-sm font-medium text-foreground mb-1">
                Restaurant Type
              </label>
              <select
                value={formData.restaurantType}
                onChange={(e) => handleInputChange('restaurantType', e.target.value as RestaurantType)}
                className="w-full px-3 py-2 bg-card border border text-foreground text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {(Object.values(RestaurantType) as RestaurantType[])
                  .filter((type) =>
                    // Filter out business structure types - only show operational types
                    type !== RestaurantType.MULTI_BRAND &&
                    type !== RestaurantType.LARGE_CHAIN
                  )
                  .map((type) => (
                    <option key={type} value={type}>
                      {RESTAURANT_TYPE_CONFIGS[type].label}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                ℹ️ Select the operational type for this location
              </p>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-orange-50 border border-orange-200 p-4">
            <h4 className="text-sm font-semibold text-orange-900 mb-1">⚠️ Important Notice</h4>
            <p className="text-sm text-orange-800">
              Creating this location will provision a new tenant with dedicated Cloudflare infrastructure (D1 database, KV namespace, R2 storage, DNS configuration). This process typically takes 2-3 minutes to complete.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border bg-card p-6 -mx-6 -mb-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-foreground bg-card border border hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Location...
                </>
              ) : (
                'Create Location'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
