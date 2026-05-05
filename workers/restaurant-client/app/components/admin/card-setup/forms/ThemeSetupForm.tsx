'use client';

import React, { useState, useEffect } from 'react';
import { Save, Palette, Check } from 'lucide-react';
import { useCardSetup } from '../../../../contexts/CardSetupContext';
import { SetupCardId, ThemeConfig } from '../types/setup-cards';

/**
 * Available theme presets from theme-edge-worker
 */
const THEME_PRESETS = [
  {
    id: 'grab-food-default',
    name: 'Grab Food Default',
    description: 'Mobile-first design with Grab-inspired green branding',
    category: 'grab-food',
    screenshot: '/themes/grab-food-default.png',
    preview: {
      primary: '#00B14F',
      secondary: '#FFA500',
      background: '#FFFFFF',
    },
    features: ['Mobile-first', 'App-like interface', 'Bottom navigation', 'Voice search'],
  },
  {
    id: 'khao-piyo-custom',
    name: 'Khao Piyo Custom',
    description: 'Custom Khao Piyo theme with warm, inviting colors',
    category: 'grab-food',
    screenshot: '/themes/khao-piyo-custom.png',
    preview: {
      primary: '#FF6F00',
      secondary: '#FFA000',
      background: '#FFF8E1',
    },
    features: ['Warm colors', 'Food-focused', 'Promo carousel', 'Order tracking'],
  },
  {
    id: 'coorg-food-company',
    name: 'Coorg Food Company',
    description: 'Premium restaurant theme with authentic South Indian aesthetics',
    category: 'multimodal-restaurant',
    screenshot: '/themes/coorg-food-company.png',
    preview: {
      primary: '#8B4513',
      secondary: '#D2691E',
      background: '#FFF5E6',
    },
    features: ['Voice ordering', 'Neumorphic design', 'Multi-modal', 'Accessibility'],
  },
  {
    id: 'generic',
    name: 'Generic Restaurant',
    description: 'Clean, modern theme suitable for any restaurant type',
    category: 'multimodal-restaurant',
    screenshot: '/themes/generic.png',
    preview: {
      primary: '#2196F3',
      secondary: '#FF9800',
      background: '#FFFFFF',
    },
    features: ['Voice-assisted', 'Responsive', 'Category carousel', 'Modern UI'],
  },
];

/**
 * Theme Setup Form
 * Allows selection of theme preset
 */
export function ThemeSetupForm() {
  const { state, saveThemeConfig, markCardInProgress } = useCardSetup();

  // Form state
  const [selectedPreset, setSelectedPreset] = useState<string>(
    state.themeConfig?.preset || 'grab-food-default'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mark as in progress when form is opened
  useEffect(() => {
    markCardInProgress(SetupCardId.THEME);
  }, [markCardInProgress]);

  // Validate form
  const isFormValid = () => {
    return selectedPreset.trim() !== '';
  };

  // Handle save
  const handleSave = async () => {
    if (!isFormValid()) {
      setSaveError('Please select a theme');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const preset = THEME_PRESETS.find((p) => p.id === selectedPreset);

      const themeConfig: ThemeConfig = {
        preset: selectedPreset,
        primaryColor: preset?.preview.primary,
        secondaryColor: preset?.preview.secondary,
      };

      await saveThemeConfig(themeConfig);

      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('[ThemeSetupForm] Save error:', error);
      setSaveError('Failed to save theme configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Theme Selection */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-saffron/30 to-paprika/30 flex items-center justify-center">
            <Palette className="w-5 h-5 text-warm-white" />
          </div>
          <h3 className="text-xl font-bold text-warm-white font-display">
            Choose Your Theme
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset.id)}
              className={`
                relative glass-panel overflow-hidden text-left cursor-pointer
                transition-all duration-300
                hover:scale-102 hover:shadow-warm-glow
                ${
                  selectedPreset === preset.id
                    ? 'ring-2 ring-saffron border-saffron/50 shadow-saffron-glow'
                    : 'border-warm-white/10 hover:border-saffron/30'
                }
              `}
            >
              {/* Selected Indicator */}
              {selectedPreset === preset.id && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="w-8 h-8 rounded-full bg-saffron flex items-center justify-center shadow-lg">
                    <Check className="w-5 h-5 text-warm-charcoal" />
                  </div>
                </div>
              )}

              {/* Theme Screenshot */}
              <div className="relative w-full h-48 bg-warm-white/5 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Palette className="w-12 h-12 text-warm-white/30 mx-auto" />
                    <p className="text-xs text-warm-white/40">Theme Preview</p>
                  </div>
                </div>
                {/* Placeholder for screenshot - will show when images are added */}
                {/* <img
                  src={preset.screenshot}
                  alt={preset.name}
                  className="w-full h-full object-cover"
                /> */}
              </div>

              {/* Theme Info */}
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-warm-white font-display mb-2">
                    {preset.name}
                  </h4>
                  <p className="text-sm text-warm-white/60">
                    {preset.description}
                  </p>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2">
                  {preset.features.slice(0, 3).map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warm-white/10 text-warm-white/70"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Color Indicators */}
                <div className="flex gap-2 pt-2 border-t border-warm-white/10">
                  <div
                    className="w-6 h-6 rounded-md shadow-sm"
                    style={{ backgroundColor: preset.preview.primary }}
                    title="Primary color"
                  />
                  <div
                    className="w-6 h-6 rounded-md shadow-sm"
                    style={{ backgroundColor: preset.preview.secondary }}
                    title="Secondary color"
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info Message */}
      <div className="glass-panel bg-honey/10 border-honey/20 p-4">
        <p className="text-sm text-warm-white/70 leading-relaxed">
          <strong className="text-honey">Note:</strong> Your theme will be applied to your customer-facing storefront.
          You can preview it by visiting your store URL after saving.
        </p>
      </div>

      {/* Error/Success Messages */}
      {saveError && (
        <div className="glass-panel bg-paprika/10 border-paprika/30 p-4">
          <p className="text-sm text-paprika-light">{saveError}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="glass-panel bg-honey/10 border-honey/30 p-4">
          <p className="text-sm text-honey">✓ Theme configuration saved successfully!</p>
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
