/**
 * POS Theme Customizer
 * Screen-specific customization for Point of Sale terminals
 * Optimized for cashier speed, clarity, and touch interaction
 */

import { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Eye, ShoppingCart, Grid3x3, Type, Palette as PaletteIcon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import {
  POS_THEME_PRESETS,
  generatePOSThemeVariables,
  type POSCustomization,
} from '@/services/themes/posThemePresets';
import { cn } from '@/lib/utils';

interface POSThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function POSThemeCustomizer({ isOpen, onClose }: POSThemeCustomizerProps) {
  const { setScreenOverride, screenOverrides } = useThemeStore();

  // Get current POS overrides
  const currentPOSOverrides = screenOverrides.pos || {};

  // Customization state
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customization, setCustomization] = useState<POSCustomization>({
    fontSize: 'normal',
    fontWeight: 'medium',
    buttonSize: 'large',
    spacing: 'normal',
    borderRadius: 'medium',
    gridColumns: 4,
    enableAnimations: true,
    showPrices: true,
    showImages: true,
  });

  const [previewMode, setPreviewMode] = useState(false);

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = POS_THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      // Apply preset immediately to preview
      applyPOSTheme(preset.config);
    }
  };

  // Apply POS theme
  const applyPOSTheme = async (variables: Record<string, any>) => {
    try {
      await setScreenOverride('pos', variables);
    } catch (error) {
      console.error('Failed to apply POS theme:', error);
    }
  };

  // Handle custom settings change
  const handleCustomizationChange = (updates: Partial<POSCustomization>) => {
    const newCustomization = { ...customization, ...updates };
    setCustomization(newCustomization);

    // Generate and apply variables
    const variables = generatePOSThemeVariables(newCustomization);
    applyPOSTheme(variables);
  };

  // Handle save
  const handleSave = async () => {
    try {
      if (selectedPreset) {
        const preset = POS_THEME_PRESETS.find(p => p.id === selectedPreset);
        if (preset) {
          await setScreenOverride('pos', preset.config);
        }
      } else {
        const variables = generatePOSThemeVariables(customization);
        await setScreenOverride('pos', variables);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save POS theme:', error);
    }
  };

  // Handle reset
  const handleReset = async () => {
    setSelectedPreset(null);
    setCustomization({
      fontSize: 'normal',
      fontWeight: 'medium',
      buttonSize: 'large',
      spacing: 'normal',
      borderRadius: 'medium',
      gridColumns: 4,
      enableAnimations: true,
      showPrices: true,
      showImages: true,
    });
    await setScreenOverride('pos', {});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[90vh] bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Customize POS Theme</h2>
              <p className="text-xs text-muted-foreground">
                Optimized for cashier speed and clarity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Presets */}
            <div className="lg:col-span-1 space-y-6">
              {/* Preset Selection */}
              <div className="settings-section">
                <h3 className="font-semibold mb-3">Quick Presets</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a pre-configured theme for your POS
                </p>

                <div className="space-y-2">
                  {POS_THEME_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border-2 transition-all',
                        selectedPreset === preset.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-accent/50'
                      )}
                    >
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Settings */}
              <div className="settings-section">
                <h3 className="font-semibold mb-3">Custom Settings</h3>

                {/* Font Size */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Type className="w-4 h-4" />
                    Font Size
                  </label>
                  <select
                    value={customization.fontSize}
                    onChange={(e) =>
                      handleCustomizationChange({
                        fontSize: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2"
                  >
                    <option value="small">Small</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                    <option value="xlarge">Extra Large</option>
                  </select>
                </div>

                {/* Button Size */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Grid3x3 className="w-4 h-4" />
                    Button Size
                  </label>
                  <select
                    value={customization.buttonSize}
                    onChange={(e) =>
                      handleCustomizationChange({
                        buttonSize: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2"
                  >
                    <option value="small">Small (40px)</option>
                    <option value="medium">Medium (48px)</option>
                    <option value="large">Large (56px)</option>
                    <option value="xlarge">Extra Large (64px)</option>
                  </select>
                </div>

                {/* Grid Columns */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">
                    Menu Grid Columns: {customization.gridColumns}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="6"
                    value={customization.gridColumns}
                    onChange={(e) =>
                      handleCustomizationChange({
                        gridColumns: parseInt(e.target.value) as any,
                      })
                    }
                    className="w-full"
                  />
                </div>

                {/* Spacing */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Spacing</label>
                  <select
                    value={customization.spacing}
                    onChange={(e) =>
                      handleCustomizationChange({
                        spacing: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2"
                  >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="comfortable">Comfortable</option>
                  </select>
                </div>

                {/* Border Radius */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">
                    Border Radius
                  </label>
                  <select
                    value={customization.borderRadius}
                    onChange={(e) =>
                      handleCustomizationChange({
                        borderRadius: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2"
                  >
                    <option value="none">None (Square)</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium">Show Prices</span>
                    <input
                      type="checkbox"
                      checked={customization.showPrices}
                      onChange={(e) =>
                        handleCustomizationChange({
                          showPrices: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium">Show Images</span>
                    <input
                      type="checkbox"
                      checked={customization.showImages}
                      onChange={(e) =>
                        handleCustomizationChange({
                          showImages: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />
                  </label>

                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium">Enable Animations</span>
                    <input
                      type="checkbox"
                      checked={customization.enableAnimations}
                      onChange={(e) =>
                        handleCustomizationChange({
                          enableAnimations: e.target.checked,
                        })
                      }
                      className="w-5 h-5"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Right Panel - Live Preview */}
            <div className="lg:col-span-2">
              <div className="settings-section h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Live Preview
                  </h3>
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="text-sm text-accent hover:text-accent/80"
                  >
                    {previewMode ? 'Exit Fullscreen' : 'Fullscreen Preview'}
                  </button>
                </div>

                {/* Mock POS Interface */}
                <div className="bg-background rounded-xl p-4 border-2 border-border min-h-[500px]">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Sample Menu Grid</h4>
                    <div
                      className="grid gap-3"
                      style={{
                        gridTemplateColumns: `repeat(${customization.gridColumns}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: customization.gridColumns! * 2 }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className="bg-card border border-border p-3 text-center transition-all hover:border-accent"
                            style={{
                              borderRadius: customization.borderRadius === 'none'
                                ? '0'
                                : customization.borderRadius === 'small'
                                ? '0.375rem'
                                : customization.borderRadius === 'medium'
                                ? '0.75rem'
                                : '1rem',
                            }}
                          >
                            {customization.showImages && (
                              <div className="w-full aspect-square bg-surface-2 rounded mb-2" />
                            )}
                            <div
                              className="font-medium"
                              style={{
                                fontSize: customization.fontSize === 'small'
                                  ? '14px'
                                  : customization.fontSize === 'large'
                                  ? '18px'
                                  : customization.fontSize === 'xlarge'
                                  ? '20px'
                                  : '16px',
                              }}
                            >
                              Item {i + 1}
                            </div>
                            {customization.showPrices && (
                              <div className="text-sm text-muted-foreground mt-1">
                                $12.99
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-semibold mb-2">Sample Buttons</h4>
                    <div className="flex gap-3">
                      <button
                        className="bg-primary text-white px-6 font-medium transition-all hover:opacity-90"
                        style={{
                          height: customization.buttonSize === 'small'
                            ? '40px'
                            : customization.buttonSize === 'medium'
                            ? '48px'
                            : customization.buttonSize === 'large'
                            ? '56px'
                            : '64px',
                          borderRadius: customization.borderRadius === 'none'
                            ? '0'
                            : customization.borderRadius === 'small'
                            ? '0.375rem'
                            : customization.borderRadius === 'medium'
                            ? '0.75rem'
                            : '1rem',
                          fontSize: customization.fontSize === 'small'
                            ? '14px'
                            : customization.fontSize === 'large'
                            ? '18px'
                            : customization.fontSize === 'xlarge'
                            ? '20px'
                            : '16px',
                        }}
                      >
                        Primary
                      </button>
                      <button
                        className="bg-secondary text-secondary-foreground px-6 font-medium transition-all hover:opacity-90"
                        style={{
                          height: customization.buttonSize === 'small'
                            ? '40px'
                            : customization.buttonSize === 'medium'
                            ? '48px'
                            : customization.buttonSize === 'large'
                            ? '56px'
                            : '64px',
                          borderRadius: customization.borderRadius === 'none'
                            ? '0'
                            : customization.borderRadius === 'small'
                            ? '0.375rem'
                            : customization.borderRadius === 'medium'
                            ? '0.75rem'
                            : '1rem',
                          fontSize: customization.fontSize === 'small'
                            ? '14px'
                            : customization.fontSize === 'large'
                            ? '18px'
                            : customization.fontSize === 'xlarge'
                            ? '20px'
                            : '16px',
                        }}
                      >
                        Secondary
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-1">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Default
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              Save POS Theme
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
