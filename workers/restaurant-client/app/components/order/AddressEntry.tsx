'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { MapPin, Check, AlertCircle, Clock } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { BACKEND_URL, RESTAURANT_WORKER_URL } from '../../config/api';

interface SavedAddress {
  formatted: string;
  placeId: string | null; // Null for legacy addresses
  coordinates?: { lat: number; lng: number }; // For legacy address migration
  apartment?: string;
  landmark?: string;
  instructions?: string;
  city?: string;
  pincode?: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
  requiresMigration?: boolean; // Flag for legacy addresses
}

// Simplified address display: flat + building + pincode
function getSimplifiedAddress(address: SavedAddress): string {
  const parts = [];
  if (address.apartment) parts.push(address.apartment);
  if (address.landmark) parts.push(address.landmark);
  if (address.pincode) parts.push(address.pincode);
  return parts.join(' • ') || address.formatted;
}

// Get label icon and color
function getLabelStyle(label: string): { icon: string; color: string } {
  switch (label) {
    case 'home':
      return { icon: '🏠', color: 'text-blue-600' };
    case 'work':
      return { icon: '💼', color: 'text-purple-600' };
    default:
      return { icon: '📍', color: 'text-gray-600' };
  }
}

interface AddressEntryProps {
  sessionId: string;
  backendUrl?: string; // Deprecated - using BACKEND_URL constant instead
  onAddressVerified?: () => void;
  isVoiceSession?: boolean;
}

export const AddressEntry = observer(function AddressEntry({
  sessionId,
  backendUrl: _backendUrl, // Ignored - using BACKEND_URL constant
  onAddressVerified,
  isVoiceSession = false
}: AddressEntryProps) {
  // Structured address fields
  const [flatNumber, setFlatNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<'home' | 'work' | 'other'>('other');
  const [setAsDefault, setSetAsDefault] = useState(false);

  // Build full address string from structured fields
  const buildFullAddress = () => {
    const parts = [];
    if (flatNumber.trim()) parts.push(flatNumber.trim());
    if (buildingName.trim()) parts.push(buildingName.trim());
    if (addressLine1.trim()) parts.push(addressLine1.trim());
    if (city.trim()) parts.push(city.trim());
    if (pincode.trim()) parts.push(pincode.trim());
    return parts.join(', ');
  };

  // Check if required fields are filled
  const isAddressValid = () => {
    return addressLine1.trim() !== '' && city.trim() !== '' && pincode.trim() !== '';
  };

  // Load saved addresses for returning customers (placeId optimization)
  useEffect(() => {
    const loadSavedAddresses = async () => {
      const customerPhone = orderStore.customer?.phone;
      if (!customerPhone) return;

      try {
        // OPTIMIZATION: First check sessionStorage (populated via WebSocket)
        const cachedAddresses = sessionStorage.getItem('handsfree_saved_addresses');
        if (cachedAddresses) {
          const addresses = JSON.parse(cachedAddresses);
          if (addresses.length > 0) {
            setSavedAddresses(addresses);
            setShowSavedAddresses(true);
            console.log('[AddressEntry] Loaded', addresses.length, 'saved addresses from WebSocket cache');
            // Clear cache after use
            sessionStorage.removeItem('handsfree_saved_addresses');
            return;
          }
        }

        // Fetch from Restaurant Worker API (customer addresses stored in D1)
        // Get tenant ID from URL hostname
        const tenantId = window.location.hostname.split('.')[0] || 'default';
        const encodedPhone = encodeURIComponent(customerPhone);

        const response = await fetch(
          `${RESTAURANT_WORKER_URL}/api/customers/phone/${encodedPhone}/addresses`,
          {
            headers: {
              'X-Tenant-ID': tenantId,
            }
          }
        );

        if (!response.ok) {
          console.log('[AddressEntry] Failed to fetch saved addresses:', response.status);
          return;
        }

        const data = await response.json() as { success?: boolean, addresses?: any[] };

        if (data.success && data.addresses && data.addresses.length > 0) {
          // Transform addresses to match SavedAddress interface
          const transformedAddresses = data.addresses.map((addr: any) => ({
            formatted: addr.addressLine1 + (addr.addressLine2 ? ', ' + addr.addressLine2 : ''),
            placeId: addr.placeId || null,
            coordinates: addr.coordinates,
            apartment: addr.apartment,
            landmark: addr.landmark,
            instructions: addr.instructions,
            city: addr.city,
            pincode: addr.postalCode,
            label: addr.label || 'other',
            isDefault: !!addr.isDefault,
          }));

          setSavedAddresses(transformedAddresses);
          setShowSavedAddresses(true);
          console.log('[AddressEntry] Loaded', transformedAddresses.length, 'saved addresses from Restaurant Worker');
        }
      } catch (err) {
        console.error('[AddressEntry] Failed to load saved addresses:', err);
      }
    };

    loadSavedAddresses();
  }, [orderStore.customer?.phone]);

  // AUTO-VERIFY: If address is already in store (from quick checkout) but not fully verified
  useEffect(() => {
    const autoVerify = async () => {
      if (orderStore.deliveryAddress && !orderStore.estimatedDeliveryTime && !isVerifying) {
        console.log('[AddressEntry] Auto-verifying pre-populated address...');

        // Find the matching saved address to get its placeId/label
        const matchingSaved = savedAddresses.find(
          addr => addr.formatted === orderStore.deliveryAddress?.formatted
        );

        if (matchingSaved) {
          handleQuickSelect(matchingSaved);
        } else if (orderStore.deliveryAddress.placeId) {
          // If we have a placeId but no matching saved address (unlikely but possible)
          handleQuickSelect({
            formatted: orderStore.deliveryAddress.formatted,
            placeId: orderStore.deliveryAddress.placeId,
            coordinates: orderStore.deliveryAddress.coordinates,
            label: 'other',
            isDefault: true
          } as SavedAddress);
        }
      }
    };

    autoVerify();
  }, [orderStore.deliveryAddress, orderStore.estimatedDeliveryTime, savedAddresses, isVerifying]);

  // Quick select saved address (handles both optimized and legacy addresses)
  const handleQuickSelect = async (savedAddress: SavedAddress) => {
    setIsVerifying(true);
    setError(null);

    // Validate sessionId
    if (!sessionId || sessionId.trim() === '') {
      setError('Cannot verify address: No active session. Please refresh and try again.');
      setIsVerifying(false);
      return;
    }

    try {
      let endpoint = '';
      let body = {};

      // Choose endpoint based on what address data we have
      const isManualSession = sessionId.startsWith('manual-');

      if (savedAddress.placeId) {
        // Optimized path: Use placeId (40% cheaper, 50% faster)
        endpoint = `${BACKEND_URL}/api/restaurant/sessions/${sessionId}/quick-address`;
        body = {
          placeId: savedAddress.placeId,
          apartment: savedAddress.apartment,
          landmark: savedAddress.landmark,
          instructions: savedAddress.instructions,
          label: savedAddress.label,
          isDefault: savedAddress.isDefault,
        };
        console.log('[AddressEntry] Using optimized placeId lookup for', savedAddress.label);
      } else if (savedAddress.coordinates) {
        // Legacy path: Migrate address by reverse geocoding coordinates
        endpoint = `${BACKEND_URL}/api/restaurant/sessions/${sessionId}/migrate-address`;
        body = {
          coordinates: savedAddress.coordinates,
          apartment: savedAddress.apartment,
          landmark: savedAddress.landmark,
          instructions: savedAddress.instructions,
          label: savedAddress.label,
          isDefault: savedAddress.isDefault,
        };
        console.log('[AddressEntry] Migrating legacy address to get placeId');
      } else {
        // Fallback: Re-geocode using the formatted address string
        // The SavedAddress interface uses 'formatted' for the full address
        const addressString = savedAddress.formatted;

        if (!addressString) {
          throw new Error('Saved address has no usable address data');
        }

        // Use the geocode endpoint to verify and get coordinates
        endpoint = isManualSession
          ? `${BACKEND_URL}/api/restaurant/geocode-address`
          : `${BACKEND_URL}/api/restaurant/sessions/${sessionId}/geocode-address`;
        body = {
          addressString,
          apartment: savedAddress.apartment,
          instructions: savedAddress.instructions,
          label: savedAddress.label,
          isDefault: savedAddress.isDefault,
        };
        console.log('[AddressEntry] Re-geocoding saved address without placeId/coordinates');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        // Enhanced error handling for placeId failures
        if (data.code === 'PLACEID_INVALID' && data.suggestion === 'use_manual_entry') {
          console.warn('[AddressEntry] PlaceId invalid, prompting manual re-entry');
          setError(
            'This saved address needs to be re-verified. Please re-enter your address or select a different one.'
          );

          // Automatically switch to manual entry mode after 2 seconds
          setTimeout(() => {
            setShowSavedAddresses(false);
            setError(null);
          }, 2000);

          return;
        }

        throw new Error(data.message || 'Failed to verify address');
      }

      if (!data.eligible) {
        setError(data.message || 'Delivery not available to this address');
        return;
      }

      // Store verified address
      orderStore.setDeliveryAddress({
        formatted: data.address.formatted,
        coordinates: data.address.coordinates,
        placeId: data.address.placeId,
        pincode: data.address.pincode,
        city: data.address.city,
        state: data.address.state,
        apartment: data.address.apartment,
        landmark: data.address.landmark,
        instructions: data.address.instructions,
      });

      orderStore.setDeliveryFee(data.delivery.fee);
      orderStore.setEstimatedDeliveryTime(data.delivery.estimatedTime);

      // Log verification method used
      if (data.verificationMethod) {
        console.log('[AddressEntry] Verification method:', data.verificationMethod);

        // Show subtle notification if placeId was auto-refreshed
        if (data.placeIdUpdated) {
          console.log('[AddressEntry] ✓ Address placeId was automatically refreshed');
          // Could add a toast notification here if desired
        }
      }

      if (onAddressVerified) {
        onAddressVerified();
      }
    } catch (err) {
      console.error('Quick address lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify address');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyAddress = async () => {
    if (!isAddressValid()) {
      setError('Please fill in all required fields (Street/Area, City, and Pincode)');
      return;
    }

    // Validate sessionId
    if (!sessionId || sessionId.trim() === '') {
      setError('Cannot verify address: No active session. Please refresh and try again.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    const fullAddress = buildFullAddress();

    try {
      // Use sessionless endpoint for manual checkout (session IDs starting with "manual-")
      const isManualSession = sessionId.startsWith('manual-');
      const endpoint = isManualSession
        ? `${BACKEND_URL}/api/restaurant/geocode-address`
        : `${BACKEND_URL}/api/restaurant/sessions/${sessionId}/geocode-address`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addressString: fullAddress,
          apartment: flatNumber.trim() || undefined,
          instructions: instructions || undefined,
          label: selectedLabel,
          isDefault: setAsDefault,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify address');
      }

      if (!data.eligible) {
        setError(data.message || 'Delivery not available to this address');
        return;
      }

      // Store verified address in orderStore
      orderStore.setDeliveryAddress({
        formatted: data.address.formatted,
        coordinates: data.address.coordinates,
        placeId: data.address.placeId,
        pincode: data.address.pincode,
        city: data.address.city,
        state: data.address.state,
        instructions: instructions || undefined,
      });

      orderStore.setDeliveryFee(data.delivery.fee);
      orderStore.setEstimatedDeliveryTime(data.delivery.estimatedTime);

      if (onAddressVerified) {
        onAddressVerified();
      }
    } catch (err) {
      console.error('Address verification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify address');
    } finally {
      setIsVerifying(false);
    }
  };

  if (orderStore.isAddressVerified && orderStore.deliveryAddress) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200/50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-green-900 mb-1">Address Verified</h3>
              <p className="text-sm text-green-700 mb-3">
                {orderStore.deliveryAddress.formatted}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="bg-white/80 rounded-lg px-3 py-1.5">
                  <span className="text-green-600">Delivery: </span>
                  <span className="font-medium text-green-900">
                    {orderStore.deliveryFee === 0 ? 'FREE' : `₹${orderStore.deliveryFee}`}
                  </span>
                </div>
                <div className="bg-white/80 rounded-lg px-3 py-1.5">
                  <span className="text-green-600">Time: </span>
                  <span className="font-medium text-green-900">
                    {orderStore.estimatedDeliveryTime}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => orderStore.clearAddress()}
          className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Change address
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Saved Addresses (Optimized with placeId) */}
      {showSavedAddresses && savedAddresses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-600" />
            <label className="text-sm font-medium text-gray-700">
              Quick Select (Optimized)
            </label>
          </div>
          {savedAddresses.map((addr, idx) => {
            const labelStyle = getLabelStyle(addr.label);
            const simplifiedAddress = getSimplifiedAddress(addr);

            return (
              <button
                key={idx}
                onClick={() => handleQuickSelect(addr)}
                disabled={isVerifying}
                className={`w-full text-left p-4 backdrop-blur-sm rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${addr.isDefault
                    ? 'bg-green-50/80 hover:bg-green-100/80 border-green-200/50'
                    : 'bg-orange-50/80 hover:bg-orange-100/80 border-orange-200/50'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`text-2xl flex-shrink-0 ${labelStyle.color}`}>
                    {labelStyle.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {addr.label}
                      </p>
                      {addr.isDefault && (
                        <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      {simplifiedAddress}
                    </p>
                  </div>
                  <span className={`text-xs font-medium flex-shrink-0 ${addr.isDefault ? 'text-green-600' : 'text-orange-600'}`}>
                    {addr.placeId ? '⚡ Fast' : 'Saved'}
                  </span>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setShowSavedAddresses(false)}
            className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors py-2"
          >
            Or enter a new address
          </button>
        </div>
      )}

      {/* Manual Address Entry */}
      {(!showSavedAddresses || savedAddresses.length === 0) && (
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-800">Delivery Address</h3>
          </div>

          {/* Flat/House Number & Building Name - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Flat / House No.
              </label>
              <input
                type="text"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder="e.g., Flat 501"
                className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Building Name
              </label>
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="e.g., Prestige Towers"
                className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all outline-none text-sm"
              />
            </div>
          </div>

          {/* Street / Area */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Street / Area *
            </label>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g., 5th Cross, Koramangala"
              className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all outline-none text-sm"
            />
          </div>

          {/* City & Pincode - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                City *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Bangalore"
                className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Pincode *
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g., 560034"
                maxLength={6}
                className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all outline-none text-sm"
              />
            </div>
          </div>

          {/* Delivery Instructions */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Delivery Instructions (Optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Ring doorbell twice, leave at door..."
              rows={2}
              className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all outline-none resize-none text-sm"
            />
          </div>

          {/* Save Address Label */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Save this address as:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['home', 'work', 'other'].map((label) => {
                const labelStyle = getLabelStyle(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedLabel(label as 'home' | 'work' | 'other')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${selectedLabel === label
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white/60 hover:border-orange-300'
                      }`}
                  >
                    <span className="text-2xl mb-1">{labelStyle.icon}</span>
                    <span className="text-xs font-medium text-gray-700 capitalize">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Set as Default */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Set as default address</span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50/80 backdrop-blur-sm rounded-xl p-4 border border-red-200/50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Verify Button */}
          <button
            onClick={handleVerifyAddress}
            disabled={isVerifying || !isAddressValid()}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying Address...
              </span>
            ) : (
              'Verify Address'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            We'll check if we deliver to your location
          </p>

          {/* Back to saved addresses */}
          {savedAddresses.length > 0 && (
            <button
              onClick={() => setShowSavedAddresses(true)}
              className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Back to saved addresses
            </button>
          )}
        </div>
      )}
    </div>
  );
});
