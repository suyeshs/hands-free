/**
 * Restaurant Details Form
 * Accepts manual entry or Google Maps URL for automatic details extraction
 * Includes feature configuration and operational mode selection
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Link as LinkIcon, Loader2, CheckCircle, ExternalLink, Settings, Building2, Store, Network } from 'lucide-react';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { getPlaceDetailsFromUrl, parseBasicInfoFromUrl } from '../../services/googlePlaces';
import { autoFillFromCity } from '../../lib/cityStateMapping';

export function RestaurantDetailsForm() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [activeSection, setActiveSection] = useState<'details' | 'features'>('details');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
    },
    website: '',
    features: {
      operationalMode: 'single-location' as 'single-location' | 'multi-location' | 'chain',
      tableService: true,
      takeawayOrders: true,
      dineIn: true,
      delivery: false,
      onlineOrders: false,
      aggregatorIntegration: false,
      qrOrdering: false,
      barManagement: false,
      chainManagement: false,
      kitchenDisplay: false,
      inventoryManagement: false,
      staffManagement: false,
      customerManagement: false,
      advancedReports: false,
      multiCurrencySupport: false,
    },
  });

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    // Load from restaurant settings store (not deprecated tenant provisioning)
    if (settings) {
      setFormData({
        name: settings.name || '',
        phone: settings.phone || '',
        address: {
          line1: settings.address?.line1 || '',
          line2: settings.address?.line2 || '',
          city: settings.address?.city || '',
          state: settings.address?.state || '',
          pincode: settings.address?.pincode || '',
        },
        website: settings.website || '',
        features: {
          // Map operationalScale to operationalMode for form state
          operationalMode: (settings.operationalScale || 'single-location') as any,
          ...(settings.features || {
            tableService: true,
            takeawayOrders: true,
            dineIn: true,
            delivery: false,
            onlineOrders: false,
            aggregatorIntegration: false,
            qrOrdering: false,
            barManagement: false,
            chainManagement: false,
            kitchenDisplay: false,
            inventoryManagement: false,
            staffManagement: false,
            customerManagement: false,
            advancedReports: false,
            multiCurrencySupport: false,
          }),
        },
      });
    }
  };

  const handleGoogleMapsExtract = async () => {
    if (!googleMapsUrl.trim()) {
      setError('Please enter a Google Maps URL');
      return;
    }

    setExtracting(true);
    setError(null);

    try {
      // Try to extract via API first
      const placeDetails = await getPlaceDetailsFromUrl(googleMapsUrl);

      if (placeDetails) {
        // Success - populate form with extracted data
        setFormData((prev) => ({
          ...prev,
          name: placeDetails.name || prev.name,
          phone: placeDetails.phone || prev.phone,
          address: {
            line1: placeDetails.address || '',
            line2: '',
            city: placeDetails.city || '',
            state: placeDetails.state || '',
            pincode: placeDetails.postalCode || '',
          },
          website: placeDetails.website || '',
        }));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        // Fallback - parse basic info from URL
        const basicInfo = parseBasicInfoFromUrl(googleMapsUrl);
        if (basicInfo) {
          setError('Could not auto-extract details. Please add the API key or enter details manually.');
        } else {
          setError('Invalid Google Maps URL. Please check and try again.');
        }
      }
    } catch (err) {
      console.error('[RestaurantDetails] Extract error:', err);
      setError('Failed to extract details. Please enter manually.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('[RestaurantDetails] Saving form data:', formData);

      // Extract operationalMode from features and map to operationalScale
      const { operationalMode, ...featuresWithoutMode } = formData.features;

      // Auto-enable chain management for chain mode
      const finalFeatures = { ...featuresWithoutMode };
      if (operationalMode === 'chain') {
        finalFeatures.chainManagement = true;
      }

      // Update restaurant settings store
      await updateSettings({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        website: formData.website,
        operationalScale: operationalMode as any, // Map to operationalScale
        features: finalFeatures,
      });

      console.log('[RestaurantDetails] Settings saved successfully');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('[RestaurantDetails] Save error:', err);
      setError('Failed to save restaurant details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* Header with Section Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100">
              {activeSection === 'details' ? (
                <MapPin className="w-6 h-6 text-blue-600" />
              ) : (
                <Settings className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {activeSection === 'details' ? 'Restaurant Details' : 'Features & Capabilities'}
              </h2>
              <p className="text-sm text-gray-600">
                {activeSection === 'details'
                  ? 'Add your location and contact information'
                  : 'Configure operational mode and enable features'}
              </p>
            </div>
          </div>

          {/* Section Toggle */}
          <div className="flex gap-2 bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setActiveSection('details')}
              className={`px-4 py-2  transition-colors ${
                activeSection === 'details'
                  ? 'bg-white shadow-sm text-blue-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('features')}
              className={`px-4 py-2  transition-colors ${
                activeSection === 'features'
                  ? 'bg-white shadow-sm text-blue-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Features
            </button>
          </div>
        </div>

        {/* Manual Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success/Error messages */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-green-50 border border-green-200 flex items-center gap-2 text-green-700"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Details saved successfully!</span>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700"
            >
              {error}
            </motion.div>
          )}

          {/* Details Section */}
          {activeSection === 'details' && (
            <>
              {/* Google Maps URL Extract */}
              <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
                <div className="flex items-start gap-3 mb-4">
                  <LinkIcon className="w-5 h-5 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Quick Setup with Google Maps</h3>
                    <p className="text-sm text-gray-600">
                      Paste your restaurant's Google Maps URL and we'll fill everything automatically!
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="flex-1 px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleGoogleMapsExtract}
                    disabled={extracting || !googleMapsUrl.trim()}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <span>Extract</span>
                    )}
                  </button>
                </div>

                {/* API Key notice */}
                {!import.meta.env.VITE_GOOGLE_PLACES_API_KEY && (
                  <div className="mt-3 text-xs text-gray-500 bg-white/50 p-3">
                    <strong>Note:</strong> Add <code className="px-1 py-0.5 bg-gray-200 rounded">VITE_GOOGLE_PLACES_API_KEY</code> to your .env file to enable automatic extraction.
                    Get an API key from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      Google Cloud Console <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Restaurant Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Your Restaurant Name"
              required
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="9876543210"
              required
              pattern="[0-9]{10}"
              maxLength={10}
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">10-digit mobile number</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Address Line 1 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.address.line1}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: { ...prev.address, line1: e.target.value } }))}
              placeholder="123 Main Street"
              required
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Address Line 2 (Optional)</label>
            <input
              type="text"
              value={formData.address.line2}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: { ...prev.address, line2: e.target.value } }))}
              placeholder="Near Landmark"
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">City <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.address.city}
                onChange={(e) => {
                  const cityInput = e.target.value;
                  // Auto-fill state and country based on city
                  const updatedAddress = autoFillFromCity(cityInput, formData.address);
                  setFormData((prev) => ({ ...prev, address: updatedAddress }));
                }}
                placeholder="Bengaluru"
                required
                className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">State <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.address.state}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: { ...prev.address, state: e.target.value } }))}
                placeholder="Karnataka"
                required
                className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Pincode <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.address.pincode}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: { ...prev.address, pincode: e.target.value } }))}
              placeholder="560001"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">6-digit pincode</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Website (Optional)</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
              placeholder="https://yourrestaurant.com"
              className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
            </>
          )}

          {/* Features Section */}
          {activeSection === 'features' && (
            <div className="space-y-8">
              {/* Operational Mode Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-4">
                  Operational Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      value: 'single-location',
                      icon: Store,
                      title: 'Single Location',
                      description: 'One restaurant location',
                    },
                    {
                      value: 'multi-location',
                      icon: Building2,
                      title: 'Multiple Locations',
                      description: 'Independent locations',
                    },
                    {
                      value: 'chain',
                      icon: Network,
                      title: 'Restaurant Chain',
                      description: 'Centralized menu & management',
                    },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          features: { ...prev.features, operationalMode: mode.value as any },
                        }))
                      }
                      className={`p-4  border-2 text-left transition-all ${
                        formData.features.operationalMode === mode.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <mode.icon className="w-8 h-8 text-blue-600 mb-2" />
                      <h3 className="font-semibold text-gray-900">{mode.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">{mode.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="grid grid-cols-2 gap-6">
                {/* Core Features */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Core Features</h3>
                  <div className="space-y-3">
                    {[
                      { key: 'tableService', label: 'Table/Dine-in Service', description: 'Floor plans, table management' },
                      { key: 'takeawayOrders', label: 'Takeaway/Pickup Orders', description: 'Counter orders, packing charges' },
                      { key: 'onlineOrders', label: 'Online Ordering', description: 'Website/app orders' },
                      { key: 'aggregatorIntegration', label: 'Aggregator Integration', description: 'Swiggy, Zomato, etc.' },
                      { key: 'barManagement', label: 'Bar Management', description: 'Bar inventory, recipes, closing' },
                      { key: 'qrOrdering', label: 'QR Code Ordering', description: 'Guest self-ordering via QR' },
                    ].map((feature) => (
                      <label key={feature.key} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.features[feature.key as keyof typeof formData.features] as boolean}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              features: { ...prev.features, [feature.key]: e.target.checked },
                            }))
                          }
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{feature.label}</div>
                          <div className="text-xs text-gray-600">{feature.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Advanced Features */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Advanced Features</h3>
                  <div className="space-y-3">
                    {[
                      { key: 'inventoryManagement', label: 'Inventory Management', description: 'Stock tracking, suppliers' },
                      { key: 'staffManagement', label: 'Staff Management', description: 'Roster, attendance, payroll' },
                      { key: 'customerManagement', label: 'Customer Database', description: 'CRM, loyalty programs' },
                      { key: 'kitchenDisplay', label: 'Kitchen Display (KDS)', description: 'Digital kitchen screens' },
                      { key: 'advancedReports', label: 'Advanced Reports', description: 'Analytics, insights' },
                      { key: 'multiCurrencySupport', label: 'Multi-Currency', description: 'International pricing' },
                    ].map((feature) => (
                      <label key={feature.key} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.features[feature.key as keyof typeof formData.features] as boolean}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              features: { ...prev.features, [feature.key]: e.target.checked },
                            }))
                          }
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{feature.label}</div>
                          <div className="text-xs text-gray-600">{feature.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chain Management Notice */}
              {formData.features.operationalMode === 'chain' && (
                <div className="p-4 bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Chain Mode:</strong> Chain Management will be automatically enabled. You'll be able to manage
                    multiple locations, sync master menus, and view consolidated reports.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submit Button - Outside both conditionals */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Details</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
