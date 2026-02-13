/**
 * Location Provisioning Form
 * Create a new location tenant with full infrastructure
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useChainStore } from '../../stores/chainStore';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { generateActivationCode } from '../../lib/activationCode';
import { ActivationCodeModal } from './ActivationCodeModal';
import { Building2, MapPin, Phone, Mail, X, Loader2, CheckCircle2 } from 'lucide-react';

interface LocationFormData {
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
  restaurantType: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  googleRating?: number;
  googleTotalReviews?: number;
  latitude?: number;
  longitude?: number;
}

interface LocationProvisioningFormProps {
  onSuccess?: (locationMetadata: any) => void;
  onCancel?: () => void;
}

export function LocationProvisioningForm({ onSuccess, onCancel }: LocationProvisioningFormProps) {
  const { provisionLocationTenant, ensureChainExists } = useChainStore();
  const masterSettings = useRestaurantSettingsStore((state) => state.settings);

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
    restaurantType: 'FULL_SERVICE',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [provisioningProgress, setProvisioningProgress] = useState<{
    step: string;
    progress: number;
  }>({ step: '', progress: 0 });
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationCode, setActivationCode] = useState<string>('');
  const [createdLocation, setCreatedLocation] = useState<any>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      const [parent, child] = keys;
      return {
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as object),
          [child]: value,
        },
      };
    });
    // Clear error on input
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.locationName?.trim()) {
      newErrors.locationName = 'Location name is required';
    }
    if (!formData.address?.line1?.trim()) {
      newErrors['address.line1'] = 'Address is required';
    }
    if (!formData.address?.city?.trim()) {
      newErrors['address.city'] = 'City is required';
    }
    if (!formData.address?.state?.trim()) {
      newErrors['address.state'] = 'State is required';
    }
    if (!formData.address?.pincode?.trim()) {
      newErrors['address.pincode'] = 'Pincode is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsProvisioning(true);
    setProvisioningError(null);
    setProvisioningProgress({ step: 'Starting...', progress: 0 });

    try {
      // Ensure chain exists (auto-creates if needed)
      console.log('[LocationForm] Ensuring chain exists...');
      setProvisioningProgress({ step: 'Preparing chain...', progress: 5 });
      const chainId = await ensureChainExists();

      console.log('[LocationForm] Provisioning location with chainId:', chainId);

      // Provision the location tenant
      const locationMetadata = await provisionLocationTenant(
        chainId,
        formData,
        (step, progress) => {
          setProvisioningProgress({ step, progress });
        }
      );

      console.log('[LocationForm] Location provisioned successfully:', locationMetadata);

      // Generate activation code
      const chainName = masterSettings.name || 'XXXX';
      const code = generateActivationCode(chainName, formData.locationName);
      console.log('[LocationForm] Generated activation code:', code);

      // Success!
      setProvisioningProgress({ step: 'Location created successfully!', progress: 100 });

      // Wait a moment to show success message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Show activation code modal
      setActivationCode(code);
      setCreatedLocation(locationMetadata);
      setShowActivationModal(true);
      setIsProvisioning(false);
    } catch (error) {
      console.error('[LocationForm] Provisioning failed:', error);
      setProvisioningError(
        error instanceof Error ? error.message : 'Failed to create location'
      );
      setIsProvisioning(false);
    }
  };

  const isFormValid =
    formData.locationName?.trim() &&
    formData.address?.line1?.trim() &&
    formData.address?.city?.trim() &&
    formData.address?.state?.trim() &&
    formData.address?.pincode?.trim();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="glass-panel border border-border p-8 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider">
                  Create New Location
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Add a new location to {masterSettings.name || 'your restaurant chain'}
                </p>
              </div>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 hover:bg-white/5 transition-colors"
                disabled={isProvisioning}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="h-px bg-gradient-to-r from-accent via-accent/50 to-transparent"></div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Location Details Section */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent"></span>
              Location Details
            </h2>

            <div className="grid grid-cols-1 gap-6">
              {/* Location Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={formData.locationName}
                  onChange={(e) => handleInputChange('locationName', e.target.value)}
                  placeholder="e.g., Indiranagar Branch, Koramangala Outlet"
                  disabled={isProvisioning}
                  className={`w-full px-4 py-3.5 bg-white/5 border ${
                    errors.locationName ? 'border-red-500' : 'border-white/10'
                  } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {errors.locationName && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.locationName}</p>
                )}
              </div>

              {/* Restaurant Type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Restaurant Type
                </label>
                <select
                  value={formData.restaurantType}
                  onChange={(e) => handleInputChange('restaurantType', e.target.value)}
                  disabled={isProvisioning}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="FULL_SERVICE">Full Service</option>
                  <option value="QUICK_SERVICE">Quick Service</option>
                  <option value="CAFE">Cafe</option>
                  <option value="CLOUD_KITCHEN">Cloud Kitchen</option>
                  <option value="FOOD_TRUCK">Food Truck</option>
                </select>
              </div>

              {/* Phone & Email Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    Phone <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    disabled={isProvisioning}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    Email <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="location@example.com"
                    disabled={isProvisioning}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div className="pt-6 border-t border-border">
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent"></span>
              Location Address
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={formData.address.line1}
                  onChange={(e) => handleInputChange('address.line1', e.target.value)}
                  placeholder="Building Number, Street Name"
                  disabled={isProvisioning}
                  className={`w-full px-4 py-3.5 bg-white/5 border ${
                    errors['address.line1'] ? 'border-red-500' : 'border-white/10'
                  } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {errors['address.line1'] && (
                  <p className="text-red-400 text-xs mt-1.5">{errors['address.line1']}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Address Line 2 <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.address.line2 || ''}
                  onChange={(e) => handleInputChange('address.line2', e.target.value)}
                  placeholder="Area, Landmark"
                  disabled={isProvisioning}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    placeholder="City"
                    disabled={isProvisioning}
                    className={`w-full px-4 py-3.5 bg-white/5 border ${
                      errors['address.city'] ? 'border-red-500' : 'border-white/10'
                    } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {errors['address.city'] && (
                    <p className="text-red-400 text-xs mt-1.5">{errors['address.city']}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    placeholder="State"
                    disabled={isProvisioning}
                    className={`w-full px-4 py-3.5 bg-white/5 border ${
                      errors['address.state'] ? 'border-red-500' : 'border-white/10'
                    } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {errors['address.state'] && (
                    <p className="text-red-400 text-xs mt-1.5">{errors['address.state']}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    value={formData.address.pincode}
                    onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                    placeholder="560001"
                    maxLength={6}
                    disabled={isProvisioning}
                    className={`w-full px-4 py-3.5 bg-white/5 border ${
                      errors['address.pincode'] ? 'border-red-500' : 'border-white/10'
                    } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {errors['address.pincode'] && (
                    <p className="text-red-400 text-xs mt-1.5">{errors['address.pincode']}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Provisioning Progress */}
        {isProvisioning && (
          <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <p className="text-blue-400 text-sm font-medium">
                {provisioningProgress.step || 'Provisioning location...'}
              </p>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-white/5 h-2 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${provisioningProgress.progress}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs mt-2">
              {provisioningProgress.progress}% complete
            </p>
          </div>
        )}

        {/* Error Message */}
        {provisioningError && (
          <div className="mt-8 p-5 bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 text-sm font-medium">{provisioningError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 pt-6 border-t border-border flex items-center justify-end gap-4">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isProvisioning}
              className="px-6 py-3 border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-sm font-semibold uppercase tracking-wider">Cancel</span>
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isProvisioning}
            className="px-6 py-3 bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProvisioning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-semibold uppercase tracking-wider">Creating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">
                  Create Location
                </span>
              </>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-accent/5 border border-accent/20">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-accent">Note:</span> Creating a location will
            provision complete infrastructure (database, storage, worker) and automatically
            configure chain synchronization. This may take up to 2 minutes.
          </p>
        </div>
      </div>

      {/* Activation Code Modal */}
      {showActivationModal && (
        <ActivationCodeModal
          code={activationCode}
          locationName={formData.locationName}
          onClose={() => {
            setShowActivationModal(false);
            // Call success callback after modal closes
            if (onSuccess && createdLocation) {
              onSuccess(createdLocation);
            }
          }}
        />
      )}
    </div>
  );
}

export default LocationProvisioningForm;
