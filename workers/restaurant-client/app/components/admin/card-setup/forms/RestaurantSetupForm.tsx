'use client';

import React, { useState, useEffect } from 'react';
import { Save, Building2, MapPin, Phone, Clock, FileText } from 'lucide-react';
import { useCardSetup } from '../../../../contexts/CardSetupContext';
import { useRestaurant } from '../../../../contexts/RestaurantContext';
import { RestaurantData, PaymentConfig, SetupCardId } from '../types/setup-cards';

/**
 * Cuisine type options
 */
const CUISINE_OPTIONS = [
  'Italian',
  'Mexican',
  'Chinese',
  'Indian',
  'American',
  'Japanese',
  'Thai',
  'Mediterranean',
  'Fusion',
  'Other',
];

/**
 * Restaurant Setup Form
 * Combines restaurant details and payment configuration
 *
 * Section 1: Restaurant Details
 * Section 2: Payment Configuration (Use Handsfree account or own keys)
 */
export function RestaurantSetupForm() {
  const { profile, refetch } = useRestaurant();
  const { state, saveRestaurantData, savePaymentConfig, markCardInProgress } = useCardSetup();

  // Form state
  const [restaurantData, setRestaurantData] = useState<RestaurantData>({
    name: profile?.name || '',
    cuisine: profile?.cuisine || '',
    address: profile?.address || '',
    phone: profile?.phone || '',
    email: '',
    hours: profile?.hours || '',
    about: profile?.about || '',
  });

  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(
    state.paymentConfig || {
      useHandsfreeAccount: true,
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mark as in progress when form is opened
  useEffect(() => {
    markCardInProgress(SetupCardId.RESTAURANT);
  }, [markCardInProgress]);

  // Sync form data with profile when it loads
  useEffect(() => {
    if (profile) {
      setRestaurantData({
        name: profile.name || '',
        cuisine: profile.cuisine || '',
        address: profile.address || '',
        phone: profile.phone || '',
        email: '', // TODO: Add email to profile if available
        hours: profile.hours || '',
        about: profile.about || '',
      });
    }
  }, [profile]);

  // Handle input changes
  const handleInputChange = (field: keyof RestaurantData, value: string) => {
    setRestaurantData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle payment config changes
  const handlePaymentToggle = () => {
    setPaymentConfig((prev) => ({
      ...prev,
      useHandsfreeAccount: !prev.useHandsfreeAccount,
    }));
  };

  const handlePaymentInputChange = (field: keyof PaymentConfig, value: string) => {
    setPaymentConfig((prev) => ({ ...prev, [field]: value }));
  };

  // Validate form
  const isFormValid = () => {
    const basicValid =
      restaurantData.name.trim() &&
      restaurantData.cuisine.trim() &&
      restaurantData.address.trim() &&
      restaurantData.phone.trim();

    if (!basicValid) return false;

    // If using own keys, validate that all keys are provided
    if (!paymentConfig.useHandsfreeAccount) {
      return (
        paymentConfig.porterApiKey?.trim() &&
        paymentConfig.porterSecretKey?.trim() &&
        paymentConfig.razorpayKeyId?.trim() &&
        paymentConfig.razorpaySecretKey?.trim()
      );
    }

    return true;
  };

  // Handle save
  const handleSave = async () => {
    if (!isFormValid()) {
      setSaveError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Save restaurant data
      await saveRestaurantData(restaurantData);

      // Save payment config
      await savePaymentConfig(paymentConfig);

      // Refetch profile to update UI
      await refetch();

      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('[RestaurantSetupForm] Save error:', error);
      setSaveError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Restaurant Details */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-saffron/30 to-paprika/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-warm-white" />
          </div>
          <h3 className="text-xl font-bold text-warm-white font-display">
            Restaurant Details
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Restaurant Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-warm-white mb-2">
              Restaurant Name <span className="text-saffron">*</span>
            </label>
            <input
              type="text"
              value={restaurantData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., The Coorg Food Company"
              className="glass-input w-full"
              required
            />
          </div>

          {/* Cuisine Type */}
          <div>
            <label className="block text-sm font-semibold text-warm-white mb-2">
              Cuisine Type <span className="text-saffron">*</span>
            </label>
            <select
              value={restaurantData.cuisine}
              onChange={(e) => handleInputChange('cuisine', e.target.value)}
              className="glass-input w-full appearance-none cursor-pointer"
              required
            >
              <option value="">Select cuisine type</option>
              {CUISINE_OPTIONS.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-warm-white mb-2">
              Phone Number <span className="text-saffron">*</span>
            </label>
            <input
              type="tel"
              value={restaurantData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="glass-input w-full"
              required
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-warm-white mb-2">
              Full Address <span className="text-saffron">*</span>
            </label>
            <input
              type="text"
              value={restaurantData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="123 Main Street, City, State, ZIP"
              className="glass-input w-full"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-warm-white mb-2">
              Email
            </label>
            <input
              type="email"
              value={restaurantData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="contact@restaurant.com"
              className="glass-input w-full"
            />
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-semibold text-warm-white mb-2">
              Operating Hours
            </label>
            <input
              type="text"
              value={restaurantData.hours}
              onChange={(e) => handleInputChange('hours', e.target.value)}
              placeholder="Mon-Sun: 11:00 AM - 10:00 PM"
              className="glass-input w-full"
            />
          </div>

          {/* About */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-warm-white mb-2">
              About Your Restaurant
            </label>
            <textarea
              value={restaurantData.about}
              onChange={(e) => handleInputChange('about', e.target.value)}
              placeholder="Tell customers about your restaurant..."
              className="glass-input w-full min-h-[100px] resize-none"
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Payment Configuration */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-honey/30 to-coffee/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-warm-white" />
          </div>
          <h3 className="text-xl font-bold text-warm-white font-display">
            Payment Configuration
          </h3>
        </div>

        {/* Toggle Card */}
        <div className="glass-panel border-warm-white/15 p-5 cursor-pointer hover:border-saffron/30 transition-all"
          onClick={handlePaymentToggle}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-warm-white font-display mb-1">
                Use Handsfree Account
              </h4>
              <p className="text-sm text-warm-white/60">
                Start accepting payments immediately with our integrated gateway
              </p>
            </div>
            <div className="ml-4">
              <button
                type="button"
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${paymentConfig.useHandsfreeAccount ? 'bg-saffron' : 'bg-warm-white/20'}
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePaymentToggle();
                }}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-warm-white transition-transform
                    ${paymentConfig.useHandsfreeAccount ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Own Keys Section */}
        {!paymentConfig.useHandsfreeAccount && (
          <div className="glass-panel border-saffron/30 p-6 space-y-4">
            <h4 className="text-lg font-semibold text-warm-white font-display mb-4">
              Your Payment Gateway Keys
            </h4>

            <div className="space-y-4">
              {/* Porter Keys */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-warm-white/80">Porter (Payment Gateway)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-warm-white/60 mb-2">
                      API Key <span className="text-saffron">*</span>
                    </label>
                    <input
                      type="password"
                      value={paymentConfig.porterApiKey || ''}
                      onChange={(e) => handlePaymentInputChange('porterApiKey', e.target.value)}
                      placeholder="Enter Porter API Key"
                      className="glass-input w-full"
                      required={!paymentConfig.useHandsfreeAccount}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-warm-white/60 mb-2">
                      Secret Key <span className="text-saffron">*</span>
                    </label>
                    <input
                      type="password"
                      value={paymentConfig.porterSecretKey || ''}
                      onChange={(e) => handlePaymentInputChange('porterSecretKey', e.target.value)}
                      placeholder="Enter Porter Secret Key"
                      className="glass-input w-full"
                      required={!paymentConfig.useHandsfreeAccount}
                    />
                  </div>
                </div>
              </div>

              {/* Razorpay Keys */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-warm-white/80">Razorpay (Payment Processing)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-warm-white/60 mb-2">
                      Key ID <span className="text-saffron">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentConfig.razorpayKeyId || ''}
                      onChange={(e) => handlePaymentInputChange('razorpayKeyId', e.target.value)}
                      placeholder="rzp_live_xxxxxxxx"
                      className="glass-input w-full"
                      required={!paymentConfig.useHandsfreeAccount}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-warm-white/60 mb-2">
                      Secret Key <span className="text-saffron">*</span>
                    </label>
                    <input
                      type="password"
                      value={paymentConfig.razorpaySecretKey || ''}
                      onChange={(e) => handlePaymentInputChange('razorpaySecretKey', e.target.value)}
                      placeholder="Enter Razorpay Secret"
                      className="glass-input w-full"
                      required={!paymentConfig.useHandsfreeAccount}
                    />
                  </div>
                </div>
              </div>

              <div className="glass-panel bg-honey/10 border-honey/20 p-4 mt-4">
                <p className="text-xs text-warm-white/70 leading-relaxed">
                  <strong className="text-honey">Note:</strong> Your payment keys are encrypted and stored securely.
                  We recommend using environment-specific keys and rotating them regularly.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {saveError && (
        <div className="glass-panel bg-paprika/10 border-paprika/30 p-4">
          <p className="text-sm text-paprika-light">{saveError}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="glass-panel bg-honey/10 border-honey/30 p-4">
          <p className="text-sm text-honey">✓ Restaurant details saved successfully!</p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handleSave}
          disabled={!isFormValid() || isSaving}
          className={`
            inline-flex items-center gap-2 px-6 py-3 rounded-lg
            font-semibold text-sm transition-all duration-200
            ${
              isFormValid() && !isSaving
                ? 'bg-gradient-to-r from-paprika to-saffron hover:from-paprika/90 hover:to-saffron/90 text-warm-charcoal shadow-warm-glow hover:shadow-saffron-glow'
                : 'bg-warm-white/10 text-warm-white/40 cursor-not-allowed'
            }
          `}
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save & Continue'}</span>
        </button>
      </div>
    </div>
  );
}
