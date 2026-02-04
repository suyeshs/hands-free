/**
 * RestaurantBasicsCard Component
 * Collects essential restaurant information for billing
 */

import { useState, useEffect } from 'react';
import { Store } from 'lucide-react';
import { SetupCardBase } from '../SetupCardBase';
import { useRestaurantSettingsStore } from '../../../stores/restaurantSettingsStore';
import { useHasRestaurantBasics } from '../../../stores/setupWizardStore';
import { lookupCityInfo } from '../../../lib/cityStateMapping';

export function RestaurantBasicsCard() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const completed = useHasRestaurantBasics();

  const [formData, setFormData] = useState({
    name: settings.name || '',
    phone: settings.phone || '',
    addressLine1: settings.address?.line1 || '',
    city: settings.address?.city || '',
    state: settings.address?.state || '',
    pincode: settings.address?.pincode || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim() || formData.name === 'Restaurant Name') {
      newErrors.name = 'Restaurant name is required';
    }

    const cleanPhone = formData.phone.replace(/[^\d]/g, '');
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (cleanPhone.length !== 10) {
      newErrors.phone = 'Phone number must be exactly 10 digits';
    }

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = 'Street address is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Pincode must be exactly 6 digits';
    }

    setErrors(newErrors);
  }, [formData]);

  const handleComplete = async () => {
    console.log('[RestaurantBasicsCard] ===== handleComplete called =====');
    console.log('[RestaurantBasicsCard] formData:', formData);
    console.log('[RestaurantBasicsCard] errors:', errors);

    if (Object.keys(errors).length > 0) {
      alert('Please fix all errors before completing');
      return;
    }

    const dataToSave = {
      name: formData.name,
      phone: formData.phone,
      address: {
        line1: formData.addressLine1,
        line2: settings.address?.line2 || '',
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
      },
    };

    console.log('[RestaurantBasicsCard] Data to save:', dataToSave);

    try {
      console.log('[RestaurantBasicsCard] 📝 Calling updateSettings...');
      await updateSettings(dataToSave);
      console.log('[RestaurantBasicsCard] ✅ updateSettings completed');

      // Verify data was actually saved by reading it back
      console.log('[RestaurantBasicsCard] 🔍 Verifying save - reading back from store...');

      // Wait a moment for stores to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentSettings = useRestaurantSettingsStore.getState().settings;
      console.log('[RestaurantBasicsCard] 🔍 Current settings in store:', {
        name: currentSettings.name,
        phone: currentSettings.phone,
        address: currentSettings.address,
      });

      // Manual validation check (without using hook in async context)
      const isValid = Boolean(
        currentSettings.name?.trim() &&
        currentSettings.name !== 'Restaurant Name' &&
        currentSettings.phone?.trim() &&
        currentSettings.phone.replace(/[^\d]/g, '').length === 10 &&
        currentSettings.address?.line1?.trim() &&
        currentSettings.address?.city?.trim() &&
        currentSettings.address?.state?.trim() &&
        currentSettings.address?.pincode?.trim() &&
        currentSettings.address?.pincode.length === 6
      );

      console.log('[RestaurantBasicsCard] 🔍 Validation result:', isValid);

      if (!isValid) {
        console.error('[RestaurantBasicsCard] ⚠️ WARNING: Data saved but validation still failing!');
      }
    } catch (error) {
      console.error('[RestaurantBasicsCard] ❌ Failed to save:', error);
      alert('Failed to save restaurant details. Please try again.');
    }
  };

  const isValid = Object.keys(errors).length === 0 && formData.name.trim().length > 0;

  return (
    <SetupCardBase
      id="restaurant-basics"
      title="Complete Restaurant Information"
      description="Essential details for billing and receipts"
      icon={Store}
      completed={completed}
      required={true}
      onComplete={isValid ? handleComplete : undefined}
      completionMessage="Restaurant details configured ✓"
    >
      <div className="space-y-4">
        {/* Help Text */}
        <p className="text-sm text-gray-400 mb-4">
          💡 This information appears on all customer bills and receipts. Make sure it's accurate!
        </p>

        {/* Name */}
        <div>
          <label className="block text-sm font-bold mb-2 text-warm-white">
            Restaurant Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Your Restaurant Name"
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-bold mb-2 text-warm-white">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="10-digit phone number"
            maxLength={10}
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
          />
          {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
          {!errors.phone && formData.phone && (
            <p className="text-green-400 text-xs mt-1">✓ Valid phone number</p>
          )}
        </div>

        {/* Address Line 1 */}
        <div>
          <label className="block text-sm font-bold mb-2 text-warm-white">
            Street Address <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.addressLine1}
            onChange={(e) => setFormData(prev => ({ ...prev, addressLine1: e.target.value }))}
            placeholder="Building number, street name"
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
          />
          {errors.addressLine1 && <p className="text-red-400 text-xs mt-1">{errors.addressLine1}</p>}
        </div>

        {/* City, State, Pincode */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-bold mb-2 text-warm-white">
              City <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => {
                const cityInput = e.target.value;
                const cityInfo = lookupCityInfo(cityInput);
                if (cityInfo) {
                  setFormData(prev => ({ ...prev, city: cityInput, state: cityInfo.state }));
                } else {
                  setFormData(prev => ({ ...prev, city: cityInput }));
                }
              }}
              placeholder="City"
              className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
            />
            {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-warm-white">
              State <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
              placeholder="State"
              className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
            />
            {errors.state && <p className="text-red-400 text-xs mt-1">{errors.state}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-warm-white">
              Pincode <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.pincode}
              onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value.replace(/[^\d]/g, '').slice(0, 6) }))}
              placeholder="6-digit"
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
            />
            {errors.pincode && <p className="text-red-400 text-xs mt-1">{errors.pincode}</p>}
            {!errors.pincode && formData.pincode.length === 6 && (
              <p className="text-green-400 text-xs mt-1">✓ Valid pincode</p>
            )}
          </div>
        </div>
      </div>
    </SetupCardBase>
  );
}
