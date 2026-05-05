/**
 * First Location Step
 * Collects details for the first restaurant location
 */

import { useState } from 'react';
import { MapPin, Phone, Mail, Loader2 } from 'lucide-react';

export interface FirstLocationInfo {
  locationName: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  phone?: string;
  email?: string;
}

interface FirstLocationStepProps {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  initialData?: Partial<FirstLocationInfo>;
  onComplete: (data: FirstLocationInfo) => void;
  onBack?: () => void;
}

export function FirstLocationStep({
  companyName,
  companyPhone,
  companyEmail,
  initialData,
  onComplete,
  onBack,
}: FirstLocationStepProps) {
  const [formData, setFormData] = useState<FirstLocationInfo>({
    locationName: initialData?.locationName || '',
    address: {
      line1: initialData?.address?.line1 || '',
      line2: initialData?.address?.line2 || '',
      city: initialData?.address?.city || '',
      state: initialData?.address?.state || '',
      pincode: initialData?.address?.pincode || '',
    },
    phone: initialData?.phone || companyPhone,
    email: initialData?.email || companyEmail,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    const keys = field.split('.');
    if (keys.length === 1) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      const [parent, child] = keys;
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as object),
          [child]: value,
        },
      }));
    }
    // Clear error on input
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.locationName.trim()) {
      newErrors.locationName = 'Location name is required';
    }

    if (!formData.address.line1.trim()) {
      newErrors['address.line1'] = 'Address is required';
    }

    if (!formData.address.city.trim()) {
      newErrors['address.city'] = 'City is required';
    }

    if (!formData.address.state.trim()) {
      newErrors['address.state'] = 'State is required';
    }

    if (!formData.address.pincode.trim()) {
      newErrors['address.pincode'] = 'Pincode is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      onComplete(formData);
    } catch (error) {
      console.error('[FirstLocationStep] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid =
    formData.locationName.trim() &&
    formData.address.line1.trim() &&
    formData.address.city.trim() &&
    formData.address.state.trim() &&
    formData.address.pincode.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Add Your First Location</h2>
        <p className="text-gray-600 text-base sm:text-lg px-4">
          Company <span className="font-semibold text-blue-600">{companyName}</span> registered successfully!
        </p>
        <p className="text-gray-600 px-4">Now let's add your first restaurant location</p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Location Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Location Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.locationName}
            onChange={(e) => handleInputChange('locationName', e.target.value)}
            placeholder="e.g., Indiranagar Branch, Downtown Location, Main Street"
            className={`w-full px-4 py-3 border ${
              errors.locationName ? 'border-red-500' : 'border-gray-300'
            } rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500`}
          />
          {errors.locationName && (
            <p className="text-red-500 text-sm mt-1">{errors.locationName}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Give this location a unique name to distinguish it from other branches
          </p>
        </div>

        {/* Address Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Location Address
          </h3>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address Line 1 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.address.line1}
              onChange={(e) => handleInputChange('address.line1', e.target.value)}
              placeholder="Building Number, Street Name"
              className={`w-full px-4 py-3 border ${
                errors['address.line1'] ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500`}
            />
            {errors['address.line1'] && (
              <p className="text-red-500 text-sm mt-1">{errors['address.line1']}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address Line 2 <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.address.line2}
              onChange={(e) => handleInputChange('address.line2', e.target.value)}
              placeholder="Area, Landmark"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address.city}
                onChange={(e) => handleInputChange('address.city', e.target.value)}
                placeholder="City"
                className={`w-full px-4 py-3 border ${
                  errors['address.city'] ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
              {errors['address.city'] && (
                <p className="text-red-500 text-sm mt-1">{errors['address.city']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address.state}
                onChange={(e) => handleInputChange('address.state', e.target.value)}
                placeholder="State"
                className={`w-full px-4 py-3 border ${
                  errors['address.state'] ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
              {errors['address.state'] && (
                <p className="text-red-500 text-sm mt-1">{errors['address.state']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pincode <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address.pincode}
                onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                placeholder="560001"
                maxLength={6}
                className={`w-full px-4 py-3 border ${
                  errors['address.pincode'] ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
              {errors['address.pincode'] && (
                <p className="text-red-500 text-sm mt-1">{errors['address.pincode']}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Info (Optional) */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Location Contact <span className="text-gray-500">(Optional)</span>
          </h3>
          <p className="text-xs text-gray-500">
            Leave blank to use company contact: {companyPhone} / {companyEmail}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder={companyPhone}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder={companyEmail}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            disabled={isSaving}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            Back
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isFormValid || isSaving}
          className="ml-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Continue</span>
          )}
        </button>
      </div>
    </div>
  );
}
