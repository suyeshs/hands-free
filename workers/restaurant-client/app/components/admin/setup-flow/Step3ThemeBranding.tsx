'use client';

import React from 'react';
import { useSetup } from '@/app/contexts/SetupContext';
import { LogoUpload } from '@/app/components/admin/LogoUpload';

/**
 * Theme preset options
 */
const THEME_PRESETS = [
  {
    id: 'coorg-food-company',
    name: 'Coorg Food Company',
    description: 'Warm orange tones with modern design',
    primaryColor: '#ff9500',
    preview: 'bg-gradient-to-br from-orange-400 to-orange-600',
  },
  {
    id: 'modern-minimalist',
    name: 'Modern Minimalist',
    description: 'Clean and simple with neutral tones',
    primaryColor: '#2c3e50',
    preview: 'bg-gradient-to-br from-slate-600 to-slate-800',
  },
  {
    id: 'vibrant-fusion',
    name: 'Vibrant Fusion',
    description: 'Bold and colorful for trendy restaurants',
    primaryColor: '#e91e63',
    preview: 'bg-gradient-to-br from-pink-500 to-purple-600',
  },
  {
    id: 'elegant-classic',
    name: 'Elegant Classic',
    description: 'Sophisticated gold and black theme',
    primaryColor: '#d4af37',
    preview: 'bg-gradient-to-br from-yellow-600 to-amber-700',
  },
  {
    id: 'fresh-green',
    name: 'Fresh & Green',
    description: 'Natural green tones for healthy dining',
    primaryColor: '#27ae60',
    preview: 'bg-gradient-to-br from-green-500 to-emerald-600',
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    description: 'Calm blue tones for seafood restaurants',
    primaryColor: '#3498db',
    preview: 'bg-gradient-to-br from-blue-500 to-cyan-600',
  },
];

/**
 * Preset color options
 */
const COLOR_PRESETS = [
  { name: 'Orange', value: '#ff9500' },
  { name: 'Red', value: '#e74c3c' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Purple', value: '#9b59b6' },
  { name: 'Blue', value: '#3498db' },
  { name: 'Green', value: '#27ae60' },
  { name: 'Yellow', value: '#f39c12' },
  { name: 'Teal', value: '#1abc9c' },
  { name: 'Gold', value: '#d4af37' },
  { name: 'Slate', value: '#2c3e50' },
];

/**
 * Step 3: Theme & Branding
 * Selects theme preset and brand colors
 */
export function Step3ThemeBranding() {
  const { setupState, updateSetupState } = useSetup();

  const handleThemeSelect = (preset: typeof THEME_PRESETS[0]) => {
    updateSetupState({
      themePreset: preset.id,
      primaryColor: preset.primaryColor,
    });
  };

  const handleColorSelect = (color: string) => {
    updateSetupState({ primaryColor: color });
  };

  return (
    <div className="space-y-6">
      {/* Theme Preset Selection */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Theme Preset <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-neu-text-secondary mb-4">
          Choose a pre-designed theme that matches your restaurant style
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleThemeSelect(preset)}
              className={`relative overflow-hidden rounded-xl transition-all ${
                setupState.themePreset === preset.id
                  ? 'ring-4 ring-neu-accent shadow-xl scale-105'
                  : 'neu-flat hover:shadow-lg'
              }`}
            >
              {/* Color Preview */}
              <div
                className={`h-24 w-full ${preset.preview}`}
              />

              {/* Theme Details */}
              <div className="p-4 bg-neu-surface text-left">
                <h4 className="font-bold text-sm text-neu-text mb-1">
                  {preset.name}
                </h4>
                <p className="text-xs text-neu-text-secondary">
                  {preset.description}
                </p>
              </div>

              {/* Selected Indicator */}
              {setupState.themePreset === preset.id && (
                <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg">
                  <span className="text-lg">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Brand Color */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Primary Brand Color <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-neu-text-secondary mb-4">
          Choose your brand's primary color (you can customize this later)
        </p>

        {/* Color Preset Buttons */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3 mb-4">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color.value}
              onClick={() => handleColorSelect(color.value)}
              className={`aspect-square rounded-lg transition-all hover:scale-110 ${
                setupState.primaryColor === color.value
                  ? 'ring-4 ring-offset-2 ring-neu-accent shadow-xl'
                  : 'shadow-md hover:shadow-lg'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>

        {/* Custom Color Picker */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-neu-text-secondary">
            Or enter custom color:
          </label>
          <input
            type="color"
            value={setupState.primaryColor}
            onChange={(e) => handleColorSelect(e.target.value)}
            className="h-10 w-20 rounded-lg cursor-pointer neu-convex"
          />
          <input
            type="text"
            value={setupState.primaryColor}
            onChange={(e) => handleColorSelect(e.target.value)}
            placeholder="#ff9500"
            className="flex-1 px-4 py-2 neu-convex text-neu-text rounded-lg focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all"
          />
        </div>

        {/* Color Preview */}
        <div className="mt-4 p-4 neu-flat rounded-xl">
          <p className="text-xs text-neu-text-secondary mb-2">Preview:</p>
          <div className="flex gap-2 items-center">
            <div
              className="w-12 h-12 rounded-lg shadow-lg"
              style={{ backgroundColor: setupState.primaryColor }}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-neu-text">
                {setupState.restaurantName || 'Your Restaurant'}
              </p>
              <p className="text-xs text-neu-text-secondary">
                Primary color: {setupState.primaryColor}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Restaurant Logo
        </label>
        <p className="text-xs text-neu-text-secondary mb-3">
          Upload your restaurant logo. It will appear in the header and on receipts.
        </p>
        <LogoUpload
          onLogoChange={(logoUrl) => {
            updateSetupState({ logo: logoUrl || null });
          }}
        />
      </div>

      {/* Tagline (Optional) */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Tagline
        </label>
        <input
          type="text"
          value={setupState.tagline}
          onChange={(e) => updateSetupState({ tagline: e.target.value })}
          placeholder="e.g., Authentic Flavors, Modern Dining"
          className="w-full px-4 py-3 neu-convex text-neu-text placeholder-neu-text-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-neu-accent transition-all"
        />
        <p className="text-xs text-neu-text-secondary mt-1">
          Optional: A short, catchy phrase that describes your restaurant
        </p>
      </div>

      {/* Validation Status */}
      {setupState.step3Complete && (
        <div className="flex items-center gap-2 px-4 py-3 neu-flat rounded-xl">
          <span className="text-2xl">✓</span>
          <span className="text-sm font-semibold text-neu-success">
            Step 3 Complete
          </span>
        </div>
      )}
    </div>
  );
}
