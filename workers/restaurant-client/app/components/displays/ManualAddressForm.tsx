'use client';

import { useState } from 'react';
import { MapPin, X } from 'lucide-react';

interface ManualAddressFormProps {
  data: {
    show: boolean;
    reason?: string;
    prefillApartment?: string | null;
  };
  onAction?: (action: string, data: any) => void;
  onClose?: () => void;
}

export function ManualAddressForm({ data, onAction, onClose }: ManualAddressFormProps) {
  const [apartment, setApartment] = useState(data.prefillApartment || '');
  const [building, setBuilding] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = apartment.trim() && area.trim() && city.trim() && pincode.trim().length === 6;

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const addressData = {
        apartment: apartment.trim(),
        building: building.trim(),
        area: area.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        landmark: landmark.trim() || undefined
      };

      // Trigger action to submit manual address
      onAction?.('submit_manual_address', addressData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="neu-card rounded-2xl overflow-hidden w-full max-w-md">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Enter Delivery Address</h3>
              {data.reason && (
                <p className="text-sm text-white/80 mt-1">{data.reason}</p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-4">
        <div className="space-y-3">
          {/* Flat/House Number */}
          <div>
            <label className="block text-sm font-medium neu-text mb-2">
              Flat / House Number *
            </label>
            <input
              type="text"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              placeholder="e.g., Flat 501"
              className="w-full px-4 py-3 rounded-xl neu-concave focus:outline-none focus:ring-2 focus:ring-primary/50 neu-text"
              disabled={isSubmitting}
            />
          </div>

          {/* Building Name */}
          <div>
            <label className="block text-sm font-medium neu-text mb-2">
              Building / Society Name
            </label>
            <input
              type="text"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="e.g., Prestige Towers"
              className="w-full px-4 py-3 rounded-xl neu-concave focus:outline-none focus:ring-2 focus:ring-primary/50 neu-text"
              disabled={isSubmitting}
            />
          </div>

          {/* Area / Street */}
          <div>
            <label className="block text-sm font-medium neu-text mb-2">
              Area / Street *
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., Koramangala 5th Block"
              className="w-full px-4 py-3 rounded-xl neu-concave focus:outline-none focus:ring-2 focus:ring-primary/50 neu-text"
              disabled={isSubmitting}
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium neu-text mb-2">
              City *
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Bangalore"
              className="w-full px-4 py-3 rounded-xl neu-concave focus:outline-none focus:ring-2 focus:ring-primary/50 neu-text"
              disabled={isSubmitting}
            />
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-sm font-medium neu-text mb-2">
              Pincode *
            </label>
            <input
              type="text"
              value={pincode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPincode(val);
              }}
              placeholder="e.g., 560034"
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl neu-concave focus:outline-none focus:ring-2 focus:ring-primary/50 neu-text"
              disabled={isSubmitting}
            />
          </div>

          {/* Landmark */}
          <div>
            <label className="block text-sm font-medium neu-text mb-2">
              Nearby Landmark (Optional)
            </label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g., Near City Mall"
              className="w-full px-4 py-3 rounded-xl neu-concave focus:outline-none focus:ring-2 focus:ring-primary/50 neu-text"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 ${
            isValid && !isSubmitting
              ? 'neu-button-accent hover-lift'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            'Confirm Address'
          )}
        </button>

        <p className="text-xs text-center neu-text-secondary">
          * Required fields
        </p>
      </div>
    </div>
  );
}
