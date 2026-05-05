/**
 * Restaurant Details Wizard
 * Multi-step wizard for restaurant setup with full-screen steps
 * Each step has its own screen with save/sync status indicators
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Link as LinkIcon,
  Loader2,
  CheckCircle,
  Settings,
  Building2,
  Store,
  Network,
  ArrowLeft,
  ArrowRight,
  Save,
  Cloud,
  CloudOff,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { getPlaceDetailsFromUrl, parseBasicInfoFromUrl } from '../../services/googlePlaces';
import { isTauri } from '../../lib/platform';
import { ActivationCodeInput } from '../locations/ActivationCodeInput';
import { syncMenuFromBackend } from '../../lib/menuSync';

type Step = 'setup-type' | 'activate-location' | 'details' | 'features';

interface SaveStatus {
  saved: boolean;
  synced: boolean;
  saving: boolean;
  syncing: boolean;
  error: string | null;
}

export function RestaurantDetailsWizard() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const [currentStep, setCurrentStep] = useState<Step>('setup-type');
  const [setupMode, setSetupMode] = useState<'new' | 'activate' | null>(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [extracting, setExtracting] = useState(false);

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

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    saved: false,
    synced: false,
    saving: false,
    syncing: false,
    error: null,
  });

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
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
      setSaveStatus((prev) => ({ ...prev, saved: true, synced: true }));
    }
  };

  const handleGoogleMapsExtract = async () => {
    if (!googleMapsUrl.trim()) {
      setSaveStatus((prev) => ({ ...prev, error: 'Please enter a Google Maps URL' }));
      return;
    }

    setExtracting(true);
    setSaveStatus((prev) => ({ ...prev, error: null }));

    try {
      const placeDetails = await getPlaceDetailsFromUrl(googleMapsUrl);

      if (placeDetails) {
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
        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
      } else {
        const basicInfo = parseBasicInfoFromUrl(googleMapsUrl);
        if (basicInfo) {
          setSaveStatus((prev) => ({
            ...prev,
            error: 'Could not auto-extract details. Please add the API key or enter details manually.',
          }));
        } else {
          setSaveStatus((prev) => ({
            ...prev,
            error: 'Invalid Google Maps URL. Please check and try again.',
          }));
        }
      }
    } catch (err) {
      console.error('[RestaurantDetailsWizard] Extract error:', err);
      setSaveStatus((prev) => ({
        ...prev,
        error: 'Failed to extract details. Please enter manually.',
      }));
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus((prev) => ({ ...prev, saving: true, error: null }));

    try {
      // Extract operationalMode from features and map to operationalScale
      const { operationalMode, ...featuresWithoutMode } = formData.features;

      // Auto-enable chain management for chain mode
      const finalFeatures = { ...featuresWithoutMode };
      if (operationalMode === 'chain') {
        finalFeatures.chainManagement = true;
      }

      await updateSettings({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        website: formData.website,
        operationalScale: operationalMode as any, // Map to operationalScale
        features: finalFeatures,
      });

      setSaveStatus({
        saved: true,
        synced: isTauri(), // In Tauri, local save = synced
        saving: false,
        syncing: false,
        error: null,
      });

      // Auto-hide success after 3 seconds
      setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, saved: prev.saved ? prev.saved : false }));
      }, 3000);
    } catch (err) {
      console.error('[RestaurantDetailsWizard] Save error:', err);
      setSaveStatus((prev) => ({
        ...prev,
        saving: false,
        error: 'Failed to save settings',
      }));
    }
  };

  // Handle location activation
  const handleActivation = async (code: string) => {
    try {
      console.log('[SetupWizard] Starting activation with code:', code);

      // Step 1: Validate code and get location metadata
      const locationMetadata = await invoke('validate_activation_code', {
        activationCode: code,
      });

      console.log('[SetupWizard] Location metadata received:', locationMetadata);

      // Step 2: Configure device as location tenant
      await invoke('configure_as_location', {
        location: locationMetadata,
      });

      console.log('[SetupWizard] Device configured as location');

      // Step 3: Sync menu from master's D1 database
      const masterTenantId = (locationMetadata as any).master_tenant_id;
      if (masterTenantId) {
        console.log('[SetupWizard] Syncing menu from master:', masterTenantId);
        await syncMenuFromBackend(masterTenantId);
        console.log('[SetupWizard] Menu synced successfully');
      }

      // Step 4: Navigate to POS - location is ready!
      console.log('[SetupWizard] ✅ Activation complete! Redirecting to POS...');
      setTimeout(() => {
        navigate('/pos');
      }, 1000);

    } catch (error) {
      console.error('[SetupWizard] Activation failed:', error);
      throw error; // Re-throw to let ActivationCodeInput handle the error display
    }
  };

  const steps: { id: Step; title: string; description: string; icon: any }[] = [
    {
      id: 'details',
      title: 'Restaurant Details',
      description: 'Basic information and location',
      icon: MapPin,
    },
    {
      id: 'features',
      title: 'Features & Capabilities',
      description: 'Configure operational mode',
      icon: Settings,
    },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const canGoNext = currentStepIndex < steps.length - 1;
  const canGoPrev = currentStepIndex > 0;

  const goNext = () => {
    if (canGoNext) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (canGoPrev) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex-1 relative">
                  <div className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${isActive
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isCompleted
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 bg-white text-gray-400'
                        }`}
                    >
                      {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-4 rounded transition-all ${isCompleted ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                      />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div
                      className={`text-sm font-semibold ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                        }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Status Indicator */}
        <div className="mb-6 flex items-center justify-between bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {saveStatus.saving ? (
              <>
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-gray-700">Saving changes...</span>
              </>
            ) : saveStatus.saved ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">All changes saved</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-gray-700">Unsaved changes</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Sync Status */}
            {isTauri() && (
              <div className="flex items-center gap-2">
                {saveStatus.synced ? (
                  <>
                    <Cloud className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-gray-600">Synced to local storage</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Not synced</span>
                  </>
                )}
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saveStatus.saving || (saveStatus.saved && saveStatus.synced)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>

        {/* Error Message */}
        {saveStatus.error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 flex items-center gap-3 text-red-700"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{saveStatus.error}</span>
          </motion.div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-8 mb-6"
          >
            {/* Setup Type Selection Step */}
            {currentStep === 'setup-type' && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to Guanix Restaurant POS</h2>
                  <p className="text-gray-600 text-lg">How would you like to set up your device?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  {/* New Restaurant Option */}
                  <button
                    onClick={() => {
                      setSetupMode('new');
                      setCurrentStep('details');
                    }}
                    className="group relative p-8 border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-xl transition-all text-left"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                        <Store size={40} className="text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">New Restaurant</h3>
                        <p className="text-sm text-gray-600">
                          Complete setup wizard for a new restaurant. Configure all details, features, and preferences.
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Activate Location Option */}
                  <button
                    onClick={() => {
                      setSetupMode('activate');
                      setCurrentStep('activate-location');
                    }}
                    className="group relative p-8 border-2 border-gray-200 rounded-2xl hover:border-green-500 hover:shadow-xl transition-all text-left"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center group-hover:bg-green-500 transition-colors">
                        <MapPin size={40} className="text-green-600 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Activate Location</h3>
                        <p className="text-sm text-gray-600">
                          Enter activation code to set up as a branch location. Quick 30-second setup!
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    💡 <strong>Tip:</strong> Choose "Activate Location" if you received an activation code from your master location.
                  </p>
                </div>
              </div>
            )}

            {/* Activation Code Input Step */}
            {currentStep === 'activate-location' && (
              <div>
                <ActivationCodeInput
                  onActivate={handleActivation}
                  onBack={() => setCurrentStep('setup-type')}
                />
              </div>
            )}

            {/* Details Step */}
            {currentStep === 'details' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Details</h2>
                  <p className="text-gray-600">Enter your restaurant's basic information and location</p>
                </div>

                {/* Google Maps URL Extract */}
                <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
                  <div className="flex items-start gap-3 mb-4">
                    <LinkIcon className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">Quick Setup with Google Maps</h3>
                      <p className="text-sm text-gray-600">
                        Paste your restaurant's Google Maps URL to auto-fill details
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

                  {!import.meta.env.VITE_GOOGLE_PLACES_API_KEY && (
                    <div className="mt-3 text-xs text-gray-500 bg-white/50 p-3">
                      <strong>Note:</strong> Add{' '}
                      <code className="px-1 py-0.5 bg-gray-200 rounded">VITE_GOOGLE_PLACES_API_KEY</code> to your
                      .env file for auto-extraction.
                    </div>
                  )}
                </div>

                {/* Manual Entry Fields */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Restaurant Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, name: e.target.value }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="Your Restaurant Name"
                      required
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, phone: e.target.value }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="9876543210"
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">10-digit mobile number</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Website (Optional)</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, website: e.target.value }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="https://yourrestaurant.com"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address.line1}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          address: { ...prev.address, line1: e.target.value },
                        }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="123 Main Street"
                      required
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Address Line 2 (Optional)</label>
                    <input
                      type="text"
                      value={formData.address.line2}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          address: { ...prev.address, line2: e.target.value },
                        }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="Near Landmark"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          address: { ...prev.address, city: e.target.value },
                        }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="Bengaluru"
                      required
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          address: { ...prev.address, state: e.target.value },
                        }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="Karnataka"
                      required
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address.pincode}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          address: { ...prev.address, pincode: e.target.value },
                        }));
                        setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                      }}
                      placeholder="560001"
                      required
                      pattern="[0-9]{6}"
                      maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">6-digit pincode</p>
                  </div>
                </div>
              </div>
            )}

            {/* Features Step */}
            {currentStep === 'features' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Features & Capabilities</h2>
                  <p className="text-gray-600">Configure your operational mode and enable features</p>
                </div>

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
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            features: { ...prev.features, operationalMode: mode.value as any },
                          }));
                          setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                        }}
                        className={`p-6  border-2 text-left transition-all ${formData.features.operationalMode === mode.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                          }`}
                      >
                        <mode.icon className="w-10 h-10 text-blue-600 mb-3" />
                        <h3 className="font-bold text-gray-900 text-lg mb-1">{mode.title}</h3>
                        <p className="text-sm text-gray-600">{mode.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="grid grid-cols-2 gap-8">
                  {/* Core Features */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Core Features</h3>
                    <div className="space-y-4">
                      {[
                        {
                          key: 'tableService',
                          label: 'Table/Dine-in Service',
                          description: 'Floor plans, table management',
                        },
                        {
                          key: 'takeawayOrders',
                          label: 'Takeaway/Pickup Orders',
                          description: 'Counter orders, packing charges',
                        },
                        { key: 'onlineOrders', label: 'Online Ordering', description: 'Website/app orders' },
                        {
                          key: 'aggregatorIntegration',
                          label: 'Aggregator Integration',
                          description: 'Swiggy, Zomato, etc.',
                        },
                        {
                          key: 'barManagement',
                          label: 'Bar Management',
                          description: 'Bar inventory, recipes, closing',
                        },
                        { key: 'qrOrdering', label: 'QR Code Ordering', description: 'Guest self-ordering via QR' },
                      ].map((feature) => (
                        <label key={feature.key} className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formData.features[feature.key as keyof typeof formData.features] as boolean}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                features: { ...prev.features, [feature.key]: e.target.checked },
                              }));
                              setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                            }}
                            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {feature.label}
                            </div>
                            <div className="text-sm text-gray-600">{feature.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Features */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Advanced Features</h3>
                    <div className="space-y-4">
                      {[
                        {
                          key: 'inventoryManagement',
                          label: 'Inventory Management',
                          description: 'Stock tracking, suppliers',
                        },
                        {
                          key: 'staffManagement',
                          label: 'Staff Management',
                          description: 'Roster, attendance, payroll',
                        },
                        {
                          key: 'customerManagement',
                          label: 'Customer Database',
                          description: 'CRM, loyalty programs',
                        },
                        {
                          key: 'kitchenDisplay',
                          label: 'Kitchen Display (KDS)',
                          description: 'Digital kitchen screens',
                        },
                        {
                          key: 'advancedReports',
                          label: 'Advanced Reports',
                          description: 'Analytics, insights',
                        },
                        {
                          key: 'multiCurrencySupport',
                          label: 'Multi-Currency',
                          description: 'International pricing',
                        },
                      ].map((feature) => (
                        <label key={feature.key} className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formData.features[feature.key as keyof typeof formData.features] as boolean}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                features: { ...prev.features, [feature.key]: e.target.checked },
                              }));
                              setSaveStatus((prev) => ({ ...prev, saved: false, synced: false }));
                            }}
                            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {feature.label}
                            </div>
                            <div className="text-sm text-gray-600">{feature.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chain Management Notice */}
                {formData.features.operationalMode === 'chain' && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200">
                    <div className="flex items-start gap-3">
                      <Network className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-1">Chain Mode Enabled</h4>
                        <p className="text-sm text-blue-800">
                          Chain Management will be automatically enabled. You'll be able to manage multiple locations,
                          sync master menus, and view consolidated reports across all locations.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm border border-gray-200 font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            Previous
          </button>

          <button
            onClick={goNext}
            disabled={!canGoNext}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg font-semibold"
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
