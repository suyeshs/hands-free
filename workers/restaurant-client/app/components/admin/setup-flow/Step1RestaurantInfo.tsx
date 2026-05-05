'use client';

import React from 'react';
import { useSetup } from '@/app/contexts/SetupContext';

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
 * Step 1: Restaurant Information
 * Collects basic restaurant details required for provisioning
 */
export function Step1RestaurantInfo() {
  const { setupState, updateSetupState } = useSetup();

  return (
    <div className="space-y-6">
      {/* Restaurant Name */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Restaurant Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={setupState.restaurantName}
          onChange={(e) =>
            updateSetupState({ restaurantName: e.target.value })
          }
          placeholder="e.g., The Coorg Food Company"
          className="w-full px-4 py-3 neu-convex text-neu-text placeholder-neu-text-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all"
          required
        />
      </div>

      {/* Cuisine Type */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Cuisine Type <span className="text-red-500">*</span>
        </label>
        <select
          value={setupState.cuisine}
          onChange={(e) => updateSetupState({ cuisine: e.target.value })}
          className="w-full px-4 py-3 neu-convex text-neu-text rounded-xl focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all appearance-none cursor-pointer"
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

      {/* Address */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Full Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={setupState.address}
          onChange={(e) => updateSetupState({ address: e.target.value })}
          placeholder="e.g., 123 Main Street, City, State, ZIP"
          className="w-full px-4 py-3 neu-convex text-neu-text placeholder-neu-text-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all"
          required
        />
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={setupState.phone}
          onChange={(e) => updateSetupState({ phone: e.target.value })}
          placeholder="e.g., +1-555-123-4567"
          className="w-full px-4 py-3 neu-convex text-neu-text placeholder-neu-text-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all"
          required
        />
      </div>

      {/* Business Hours */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Business Hours <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={setupState.hours}
          onChange={(e) => updateSetupState({ hours: e.target.value })}
          placeholder="e.g., Mon-Sun: 9 AM - 10 PM"
          className="w-full px-4 py-3 neu-convex text-neu-text placeholder-neu-text-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all"
          required
        />
      </div>

      {/* About Us */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          About Us
        </label>
        <textarea
          value={setupState.about}
          onChange={(e) => updateSetupState({ about: e.target.value })}
          placeholder="Tell customers about your restaurant..."
          rows={4}
          className="w-full px-4 py-3 neu-convex text-neu-text placeholder-neu-text-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all resize-none"
        />
        <p className="text-xs text-neu-text-secondary mt-1">
          Optional: Describe your restaurant's story, specialties, or unique offerings
        </p>
      </div>

      {/* Validation Status */}
      {setupState.step1Complete && (
        <div className="flex items-center gap-2 px-4 py-3 neu-flat rounded-xl">
          <span className="text-2xl">✓</span>
          <span className="text-sm font-semibold text-neu-success">
            Step 1 Complete
          </span>
        </div>
      )}
    </div>
  );
}
