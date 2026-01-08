/**
 * Basic Info Form for Provisioning
 * Restaurant name, tagline, address, and contact information
 */

import { useRestaurantSettingsStore, RestaurantDetails } from '../../../stores/restaurantSettingsStore';
import { useProvisioningStore } from '../../../stores/provisioningStore';
import { WizardNavigation } from '../WizardNavigation';
import { useState } from 'react';

export function BasicInfoForm() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const { markStepComplete, nextStep } = useProvisioningStore();

  const [formData, setFormData] = useState<Partial<RestaurantDetails>>({
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;

    // Update the settings store
    updateSettings({
      ...settings,
      name: formData.name || '',
      tagline: formData.tagline,
      address: formData.address as RestaurantDetails['address'],
      phone: formData.phone || '',
      email: formData.email,
      website: formData.website,
    });

    markStepComplete('business_basic');
    nextStep();
  };

  const isFormValid =
    formData.name?.trim() &&
    formData.address?.line1?.trim() &&
    formData.address?.city?.trim() &&
    formData.address?.state?.trim() &&
    formData.address?.pincode?.trim() &&
    formData.phone?.trim();

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🏪</span>
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          Basic Information
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your restaurant details for invoices and receipts
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Restaurant Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Restaurant Name *
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter restaurant name"
            className={`w-full p-4 rounded-xl bg-white/5 border ${
              errors.name ? 'border-red-500' : 'border-white/10'
            } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Tagline */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Tagline (optional)
          </label>
          <input
            type="text"
            value={formData.tagline || ''}
            onChange={(e) => handleInputChange('tagline', e.target.value)}
            placeholder="e.g., Authentic Indian Cuisine Since 1990"
            className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>

        {/* Address Section */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Address</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={formData.address?.line1 || ''}
                onChange={(e) => handleInputChange('address.line1', e.target.value)}
                placeholder="Building, Street"
                className={`w-full p-4 rounded-xl bg-white/5 border ${
                  errors['address.line1'] ? 'border-red-500' : 'border-white/10'
                } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
              />
              {errors['address.line1'] && (
                <p className="text-red-400 text-xs mt-1">{errors['address.line1']}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.address?.line2 || ''}
                onChange={(e) => handleInputChange('address.line2', e.target.value)}
                placeholder="Area, Landmark"
                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.address?.city || ''}
                  onChange={(e) => handleInputChange('address.city', e.target.value)}
                  placeholder="City"
                  className={`w-full p-4 rounded-xl bg-white/5 border ${
                    errors['address.city'] ? 'border-red-500' : 'border-white/10'
                  } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
                />
                {errors['address.city'] && (
                  <p className="text-red-400 text-xs mt-1">{errors['address.city']}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  State *
                </label>
                <input
                  type="text"
                  value={formData.address?.state || ''}
                  onChange={(e) => handleInputChange('address.state', e.target.value)}
                  placeholder="State"
                  className={`w-full p-4 rounded-xl bg-white/5 border ${
                    errors['address.state'] ? 'border-red-500' : 'border-white/10'
                  } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
                />
                {errors['address.state'] && (
                  <p className="text-red-400 text-xs mt-1">{errors['address.state']}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Pincode *
                </label>
                <input
                  type="text"
                  value={formData.address?.pincode || ''}
                  onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                  placeholder="560001"
                  maxLength={6}
                  className={`w-full p-4 rounded-xl bg-white/5 border ${
                    errors['address.pincode'] ? 'border-red-500' : 'border-white/10'
                  } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
                />
                {errors['address.pincode'] && (
                  <p className="text-red-400 text-xs mt-1">{errors['address.pincode']}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className={`w-full p-4 rounded-xl bg-white/5 border ${
                    errors.phone ? 'border-red-500' : 'border-white/10'
                  } text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
                />
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="restaurant@example.com"
                  className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="www.restaurant.com"
                  className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <WizardNavigation onNext={handleNext} canGoNext={!!isFormValid} />
    </div>
  );
}

export default BasicInfoForm;
