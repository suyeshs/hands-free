/**
 * Basic Info Form for Provisioning
 * Restaurant name, tagline, address, and contact information
 */

import { useRestaurantSettingsStore, RestaurantDetails } from '../../../stores/restaurantSettingsStore';
import { useProvisioningStore } from '../../../stores/provisioningStore';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import { WizardNavigation } from '../WizardNavigation';
import { useState } from 'react';

export function BasicInfoForm() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const { markStepComplete, nextStep } = useProvisioningStore();

  const [formData, setFormData] = useState<Partial<RestaurantDetails> & {
    ownerName?: string;
    ownerEmail?: string;
    ownerPassword?: string;
  }>({
    name: settings.name || '',
    tagline: settings.tagline || '',
    address: settings.address || {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
    },
    phone: settings.phone || '',
    email: settings.email || '',
    website: settings.website || '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

    // Restaurant details
    if (!formData.name?.trim()) {
      newErrors.name = 'Restaurant name is required';
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
    if (!formData.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    // Owner details
    if (!formData.ownerName?.trim()) {
      newErrors.ownerName = 'Owner name is required';
    }
    if (!formData.ownerEmail?.trim()) {
      newErrors.ownerEmail = 'Owner email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      newErrors.ownerEmail = 'Invalid email format';
    }
    if (!formData.ownerPassword?.trim()) {
      newErrors.ownerPassword = 'Owner password is required';
    } else if (formData.ownerPassword.length < 8) {
      newErrors.ownerPassword = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);

  const generateTenantId = (companyName: string): string => {
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${slug}-${random}`;
  };

  const handleNext = async () => {
    if (!validate()) return;

    setIsProvisioning(true);
    setProvisioningError(null);

    try {
      // First, update local settings store
      updateSettings({
        ...settings,
        name: formData.name || '',
        tagline: formData.tagline,
        address: formData.address as RestaurantDetails['address'],
        phone: formData.phone || '',
        email: formData.email,
        website: formData.website,
      });

      // Then, create tenant on platform if not already created
      // Check if we already have an activation code from previous attempt
      const existingCode = useSetupWizardStore.getState().activationCode;

      if (!existingCode) {
        console.log('[BasicInfoForm] Creating tenant on platform...');

        const tenantId = generateTenantId(formData.name || 'restaurant');
        // Use the new dedicated provisioning worker
        const provisioningUrl = import.meta.env.VITE_PROVISIONING_URL ||
          'https://handsfree-restaurant-provisioning.suyesh.workers.dev';

        const response = await fetch(`${provisioningUrl}/api/provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            companyName: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: `${formData.address?.line1}, ${formData.address?.line2 || ''}`.trim(),
            city: formData.address?.city,
            state: formData.address?.state,
            pincode: formData.address?.pincode,
            businessCategory: 'RESTAURANT',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create restaurant on platform');
        }

        const result = await response.json();
        const activationCode = result.activationCode;

        if (!activationCode) {
          throw new Error('No activation code received from platform');
        }

        // Store activation code in SQLite for later use in activation screen
        await useSetupWizardStore.getState().setActivationCode(activationCode);
        // Note: We don't store tenant_id in SQLite as it's stored in tenant-storage by activation

        console.log('[BasicInfoForm] Tenant created successfully:', tenantId);
        console.log('[BasicInfoForm] Activation code:', activationCode);
      }

      markStepComplete('business_basic');
      nextStep();
    } catch (err) {
      console.error('[BasicInfoForm] Error creating tenant:', err);
      setProvisioningError(err instanceof Error ? err.message : 'Failed to create restaurant');
      setIsProvisioning(false);
    } finally {
      // Don't reset isProvisioning here if successful, let the next step handle it
      if (!provisioningError) {
        setIsProvisioning(false);
      }
    }
  };

  const isFormValid =
    formData.name?.trim() &&
    formData.address?.line1?.trim() &&
    formData.address?.city?.trim() &&
    formData.address?.state?.trim() &&
    formData.address?.pincode?.trim() &&
    formData.phone?.trim() &&
    formData.ownerName?.trim() &&
    formData.ownerEmail?.trim() &&
    formData.ownerPassword?.trim();

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="glass-panel border border-border p-12 animate-fade-in">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-accent/20 flex items-center justify-center">
              <span className="text-3xl">🏪</span>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">
                Restaurant Setup
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Configure your restaurant details and owner account
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-accent via-accent/50 to-transparent"></div>
        </div>

        {/* Form - Two Column Layout */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          {/* Left Column - Restaurant Details */}
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-accent"></span>
                Restaurant Details
              </h2>
            </div>

            {/* Restaurant Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Restaurant Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter restaurant name"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors.name ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1.5">{errors.name}</p>}
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Tagline <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={(e) => handleInputChange('tagline', e.target.value)}
                placeholder="e.g., Authentic Indian Cuisine Since 1990"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors.phone ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
              />
              {errors.phone && <p className="text-red-400 text-xs mt-1.5">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Email <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="restaurant@example.com"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Website <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="www.restaurant.com"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all"
              />
            </div>
          </div>

          {/* Right Column - Owner Account */}
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-accent"></span>
                Owner Account
              </h2>
            </div>

            {/* Owner Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Owner Name *
              </label>
              <input
                type="text"
                value={formData.ownerName || ''}
                onChange={(e) => handleInputChange('ownerName', e.target.value)}
                placeholder="Enter owner's full name"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors.ownerName ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
              />
              {errors.ownerName && <p className="text-red-400 text-xs mt-1.5">{errors.ownerName}</p>}
            </div>

            {/* Owner Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Owner Email *
              </label>
              <input
                type="email"
                value={formData.ownerEmail || ''}
                onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                placeholder="owner@example.com"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors.ownerEmail ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
              />
              {errors.ownerEmail && <p className="text-red-400 text-xs mt-1.5">{errors.ownerEmail}</p>}
            </div>

            {/* Owner Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Password *
              </label>
              <input
                type="password"
                value={formData.ownerPassword || ''}
                onChange={(e) => handleInputChange('ownerPassword', e.target.value)}
                placeholder="Minimum 8 characters"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors.ownerPassword ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
              />
              {errors.ownerPassword && <p className="text-red-400 text-xs mt-1.5">{errors.ownerPassword}</p>}
            </div>

            <div className="bg-accent/5 border border-accent/20 p-4 mt-6">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-accent">Note:</span> This account will have full administrative access to the system. Make sure to use a strong password.
              </p>
            </div>
          </div>
        </div>

        {/* Address Section - Full Width */}
        <div className="col-span-2 pt-8 mt-8 border-t border-border">
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent"></span>
              Restaurant Address
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={formData.address?.line1 || ''}
                onChange={(e) => handleInputChange('address.line1', e.target.value)}
                placeholder="Building Number, Street Name"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors['address.line1'] ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
              />
              {errors['address.line1'] && (
                <p className="text-red-400 text-xs mt-1.5">{errors['address.line1']}</p>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Address Line 2 <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.address?.line2 || ''}
                onChange={(e) => handleInputChange('address.line2', e.target.value)}
                placeholder="Area, Landmark"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                City *
              </label>
              <input
                type="text"
                value={formData.address?.city || ''}
                onChange={(e) => handleInputChange('address.city', e.target.value)}
                placeholder="City"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors['address.city'] ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
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
                value={formData.address?.state || ''}
                onChange={(e) => handleInputChange('address.state', e.target.value)}
                placeholder="State"
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors['address.state'] ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
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
                value={formData.address?.pincode || ''}
                onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                placeholder="560001"
                maxLength={6}
                className={`w-full px-4 py-3.5 bg-white/5 border ${
                  errors['address.pincode'] ? 'border-red-500' : 'border-white/10'
                } text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent focus:bg-white/[0.07] transition-all`}
              />
              {errors['address.pincode'] && (
                <p className="text-red-400 text-xs mt-1.5">{errors['address.pincode']}</p>
              )}
            </div>
          </div>
        </div>

        {/* Provisioning Status */}
        {isProvisioning && (
          <div className="col-span-2 mt-8 p-5 bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent" />
              <p className="text-blue-400 text-sm font-medium">Creating restaurant on platform...</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {provisioningError && (
          <div className="col-span-2 mt-8 p-5 bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 text-sm text-center font-medium">{provisioningError}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="col-span-2 mt-10 pt-8 border-t border-border">
          <WizardNavigation
            onNext={handleNext}
            canGoNext={!!isFormValid && !isProvisioning}
            isLoading={isProvisioning}
          />
        </div>
      </div>
    </div>
  );
}

export default BasicInfoForm;
