'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { X, MapPin, Plus, Check, Clock, ChevronRight, Home, Briefcase, MapPinned, AlertCircle } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { BACKEND_URL } from '../../config/api';

interface SavedAddress {
  formatted: string;
  placeId: string | null;
  coordinates?: { lat: number; lng: number };
  apartment?: string;
  landmark?: string;
  instructions?: string;
  city?: string;
  pincode?: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
}

interface AddressSelectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl?: string; // Deprecated - using BACKEND_URL constant instead
  sessionId: string;
  tenantId: string;
}

// Simplified address display
function getSimplifiedAddress(address: SavedAddress): string {
  const parts = [];
  if (address.apartment) parts.push(address.apartment);
  if (address.landmark) parts.push(address.landmark);
  if (address.pincode) parts.push(address.pincode);
  return parts.join(' • ') || address.formatted;
}

// Get label icon component
function getLabelIcon(label: string) {
  switch (label) {
    case 'home':
      return <Home className="w-5 h-5" />;
    case 'work':
      return <Briefcase className="w-5 h-5" />;
    default:
      return <MapPinned className="w-5 h-5" />;
  }
}

export const AddressSelectionDrawer = observer(function AddressSelectionDrawer({
  isOpen,
  onClose,
  backendUrl: _backendUrl, // Ignored - using BACKEND_URL constant
  sessionId,
  tenantId
}: AddressSelectionDrawerProps) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<'home' | 'work' | 'other'>('home');
  const [setAsDefault, setSetAsDefault] = useState(true);

  // Load saved addresses when drawer opens
  useEffect(() => {
    if (isOpen) {
      loadSavedAddresses();
    }
  }, [isOpen]);

  const loadSavedAddresses = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First check sessionStorage (WebSocket cache)
      const cachedAddresses = sessionStorage.getItem('handsfree_saved_addresses');
      if (cachedAddresses) {
        const addresses = JSON.parse(cachedAddresses);
        if (addresses.length > 0) {
          setSavedAddresses(addresses);
          setIsLoading(false);
          return;
        }
      }

      // Try to fetch from backend if customer has phone
      const customerPhone = orderStore.customer?.phone;
      if (customerPhone && sessionId) {
        const response = await fetch(
          `${BACKEND_URL}/api/restaurant/sessions/${sessionId}/address-history?phone=${customerPhone}`
        );

        if (response.ok) {
          const data = await response.json() as { success?: boolean; addresses?: SavedAddress[] };
          if (data.success && data.addresses) {
            setSavedAddresses(data.addresses);
          }
        }
      }

      // Also try to fetch from restaurant worker (customer addresses table)
      if (customerPhone) {
        try {
          // Use current origin so requests stay on the same tenant domain and avoid CORS
          const workerUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev');
          const response = await fetch(
            `${workerUrl}/api/customers/phone/${encodeURIComponent(customerPhone)}`,
            {
              headers: {
                'X-Tenant-ID': tenantId,
              },
            }
          );

          if (response.ok) {
            const data = await response.json() as { success: boolean; customer?: { id: string } };
            if (data.success && data.customer?.id) {
              // Fetch addresses for this customer
              const addressResponse = await fetch(
                `${workerUrl}/api/customers/${data.customer.id}/addresses`,
                {
                  headers: {
                    'X-Tenant-ID': tenantId,
                  },
                }
              );

              if (addressResponse.ok) {
                const addressData = await addressResponse.json() as { success: boolean; addresses?: any[] };
                if (addressData.success && addressData.addresses && addressData.addresses.length > 0) {
                  // Transform to SavedAddress format
                  const transformedAddresses: SavedAddress[] = addressData.addresses.map((addr: any) => ({
                    formatted: addr.formatted_address || addr.formatted,
                    placeId: addr.place_id || null,
                    coordinates: addr.latitude && addr.longitude
                      ? { lat: addr.latitude, lng: addr.longitude }
                      : undefined,
                    apartment: addr.apartment,
                    landmark: addr.landmark,
                    instructions: addr.delivery_instructions,
                    city: addr.city,
                    pincode: addr.pincode,
                    label: addr.label || 'other',
                    isDefault: addr.is_default || false,
                  }));
                  setSavedAddresses(transformedAddresses);
                }
              }
            }
          }
        } catch (err) {
          console.error('[AddressSelectionDrawer] Failed to fetch from worker:', err);
        }
      }
    } catch (err) {
      console.error('[AddressSelectionDrawer] Failed to load addresses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAddress = async (address: SavedAddress) => {
    setIsVerifying(true);
    setError(null);

    try {
      let endpoint = '';
      let body = {};

      if (address.placeId) {
        endpoint = `${BACKEND_URL}/api/restaurant/sessions/${sessionId}/quick-address`;
        body = {
          placeId: address.placeId,
          apartment: address.apartment,
          landmark: address.landmark,
          instructions: address.instructions,
          label: address.label,
          isDefault: address.isDefault,
        };
      } else if (address.coordinates) {
        endpoint = `${BACKEND_URL}/api/restaurant/sessions/${sessionId}/migrate-address`;
        body = {
          coordinates: address.coordinates,
          apartment: address.apartment,
          landmark: address.landmark,
          instructions: address.instructions,
          label: address.label,
          isDefault: address.isDefault,
        };
      } else {
        // If no placeId or coordinates, just set the address directly
        orderStore.setDeliveryAddress({
          formatted: address.formatted,
          coordinates: address.coordinates || { lat: 0, lng: 0 },
          placeId: address.placeId || undefined,
          pincode: address.pincode,
          city: address.city,
          apartment: address.apartment,
          landmark: address.landmark,
          instructions: address.instructions,
        });
        onClose();
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify address');
      }

      if (!data.eligible) {
        setError(data.message || 'Delivery not available to this address');
        return;
      }

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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select address');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAddNewAddress = async () => {
    if (!newAddress.trim()) {
      setError('Please enter an address');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/restaurant/sessions/${sessionId}/geocode-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressString: newAddress.trim(),
          instructions: newInstructions || undefined,
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

      orderStore.setDeliveryAddress({
        formatted: data.address.formatted,
        coordinates: data.address.coordinates,
        placeId: data.address.placeId,
        pincode: data.address.pincode,
        city: data.address.city,
        state: data.address.state,
        instructions: newInstructions || undefined,
      });

      orderStore.setDeliveryFee(data.delivery.fee);
      orderStore.setEstimatedDeliveryTime(data.delivery.estimatedTime);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add address');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUpFromBottom 0.3s ease-out' }}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Delivery Address</h2>
              <p className="text-sm text-gray-500">Select or add delivery location</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)] px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500">Loading addresses...</p>
            </div>
          ) : showNewAddressForm ? (
            /* New Address Form */
            <div className="space-y-4">
              <button
                onClick={() => setShowNewAddressForm(false)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to saved addresses
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complete Address *
                </label>
                <textarea
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Flat/House No, Building, Street, Area, Pincode"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="Gate code, landmark, etc."
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none"
                />
              </div>

              {/* Label Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Save as
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['home', 'work', 'other'] as const).map((label) => (
                    <button
                      key={label}
                      onClick={() => setSelectedLabel(label)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        selectedLabel === label
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      {getLabelIcon(label)}
                      <span className="text-xs font-medium text-gray-700 capitalize mt-1">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>

              {/* Error */}
              {error && (
                <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleAddNewAddress}
                disabled={isVerifying || !newAddress.trim()}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium py-4 rounded-xl transition-all disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  'Add & Select Address'
                )}
              </button>
            </div>
          ) : (
            /* Saved Addresses List */
            <div className="space-y-3">
              {/* Current Address */}
              {orderStore.deliveryAddress && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-green-600 mb-1">Current Selection</p>
                      <p className="text-sm text-gray-900">{orderStore.deliveryAddress.formatted}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Saved Addresses */}
              {savedAddresses.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mt-4 mb-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Saved Addresses</span>
                  </div>
                  {savedAddresses.map((addr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectAddress(addr)}
                      disabled={isVerifying}
                      className={`w-full text-left p-4 rounded-xl border transition-all disabled:opacity-50 ${
                        orderStore.deliveryAddress?.formatted === addr.formatted
                          ? 'bg-orange-50 border-orange-300'
                          : 'bg-gray-50 border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          addr.label === 'home' ? 'bg-blue-100 text-blue-600' :
                          addr.label === 'work' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getLabelIcon(addr.label)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 capitalize">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Default
                              </span>
                            )}
                            {addr.placeId && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                Fast
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{getSimplifiedAddress(addr)}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-2">No saved addresses</p>
                  <p className="text-sm text-gray-400">Add your first delivery address below</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Add New Address Button */}
              <button
                onClick={() => setShowNewAddressForm(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50/50 transition-all text-gray-600 hover:text-orange-600"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Add New Address</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUpFromBottom {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
});
