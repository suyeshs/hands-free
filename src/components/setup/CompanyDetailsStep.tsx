/**
 * Company Details Step
 * Collects company/chain-level information (not location-specific)
 */

import { useState, useEffect } from 'react';
import { Building2, Mail, Phone, FileText, Loader2 } from 'lucide-react';

export interface CompanyInfo {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  companyRegistrationNumber?: string;
  operationalScale: 'single-location' | 'multi-location' | 'chain';
}

interface CompanyDetailsStepProps {
  initialData?: Partial<CompanyInfo>;
  onComplete: (data: CompanyInfo) => void;
  onBack?: () => void;
}

export function CompanyDetailsStep({ initialData, onComplete, onBack }: CompanyDetailsStepProps) {
  const [formData, setFormData] = useState<CompanyInfo>({
    companyName: initialData?.companyName || '',
    ownerName: initialData?.ownerName || '',
    ownerEmail: initialData?.ownerEmail || '',
    ownerPhone: initialData?.ownerPhone || '',
    companyRegistrationNumber: initialData?.companyRegistrationNumber || '',
    operationalScale: initialData?.operationalScale || 'single-location',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: keyof CompanyInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on input
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required';
    }

    if (!formData.ownerEmail.trim()) {
      newErrors.ownerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      newErrors.ownerEmail = 'Invalid email format';
    }

    if (!formData.ownerPhone.trim()) {
      newErrors.ownerPhone = 'Phone number is required';
    } else if (formData.ownerPhone.replace(/[^\d]/g, '').length < 7) {
      newErrors.ownerPhone = 'Phone number must be at least 7 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      // Simulate async save (could save to temp store or directly to backend)
      await new Promise((resolve) => setTimeout(resolve, 300));
      onComplete(formData);
    } catch (error) {
      console.error('[CompanyDetailsStep] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid =
    formData.companyName.trim() &&
    formData.ownerName.trim() &&
    formData.ownerEmail.trim() &&
    formData.ownerPhone.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Company Details</h2>
        <p className="text-gray-600 text-base sm:text-lg px-4">
          Let's start by registering your restaurant business or chain
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Company / Restaurant Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => handleInputChange('companyName', e.target.value)}
            placeholder="e.g., Kalyani Restaurant Group"
            className={`w-full px-4 py-3 border ${
              errors.companyName ? 'border-red-500' : 'border-gray-300'
            } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {errors.companyName && (
            <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
          )}
        </div>

        {/* Owner Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Owner / Manager Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.ownerName}
            onChange={(e) => handleInputChange('ownerName', e.target.value)}
            placeholder="Full name"
            className={`w-full px-4 py-3 border ${
              errors.ownerName ? 'border-red-500' : 'border-gray-300'
            } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {errors.ownerName && (
            <p className="text-red-500 text-sm mt-1">{errors.ownerName}</p>
          )}
        </div>

        {/* Email & Phone Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                placeholder="owner@example.com"
                className={`w-full pl-10 pr-4 py-3 border ${
                  errors.ownerEmail ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            {errors.ownerEmail && (
              <p className="text-red-500 text-sm mt-1">{errors.ownerEmail}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData.ownerPhone}
                onChange={(e) => handleInputChange('ownerPhone', e.target.value)}
                placeholder="+1 234 567 8900"
                className={`w-full pl-10 pr-4 py-3 border ${
                  errors.ownerPhone ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            {errors.ownerPhone && (
              <p className="text-red-500 text-sm mt-1">{errors.ownerPhone}</p>
            )}
          </div>
        </div>

        {/* Company Registration Number (Optional) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Company Registration / Tax ID <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.companyRegistrationNumber}
              onChange={(e) => handleInputChange('companyRegistrationNumber', e.target.value)}
              placeholder="Business registration or tax ID"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Optional: Business registration number, tax ID, or similar identifier
          </p>
        </div>

        {/* Operational Scale */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Operational Scale <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                value: 'single-location',
                title: 'Single Location',
                description: 'One restaurant',
              },
              {
                value: 'multi-location',
                title: 'Multiple Locations',
                description: 'Independent branches',
              },
              {
                value: 'chain',
                title: 'Restaurant Chain',
                description: 'Centralized management',
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleInputChange('operationalScale', option.value as any)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  formData.operationalScale === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <h3 className="font-bold text-gray-900 text-sm mb-1">{option.title}</h3>
                <p className="text-xs text-gray-600">{option.description}</p>
              </button>
            ))}
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
          className="ml-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-semibold"
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
