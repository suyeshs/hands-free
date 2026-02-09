/**
 * ColorCustomizer Component
 * Modal for customizing theme colors with live preview
 * Uses Chroma.js for color manipulation and palette generation
 */

import { useState, useEffect } from 'react';
import { X, Palette, RefreshCw, Download, Upload } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import {
  generateColorPalette,
  getContrastRatio,
  meetsWCAG_AA,
  getColorName,
} from '@/services/themes/colorUtils';
import { cn } from '@/lib/utils';

interface ColorCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ColorCustomizer({ isOpen, onClose }: ColorCustomizerProps) {
  const { customizeThemeColors, extractLogoColors, generateThemeFromColor } = useThemeStore();

  const [primaryColor, setPrimaryColor] = useState('#ff8c00');
  const [accentColor, setAccentColor] = useState('#ff8c00');
  const [backgroundColor, setBackgroundColor] = useState('#f0f2f5');
  const [foregroundColor, setForegroundColor] = useState('#1a1d23');

  const [isGenerating, setIsGenerating] = useState(false);
  const [colorPalette, setColorPalette] = useState<any>(null);

  // Generate palette when primary color changes
  useEffect(() => {
    if (primaryColor) {
      const palette = generateColorPalette(primaryColor);
      setColorPalette(palette);

      // Auto-update accent and other colors
      setAccentColor(palette.accent.base);
    }
  }, [primaryColor]);

  // Calculate contrast ratios
  const contrastRatio = getContrastRatio(foregroundColor, backgroundColor);
  const meetsAccessibility = meetsWCAG_AA(foregroundColor, backgroundColor);

  // Handle apply colors
  const handleApplyColors = async () => {
    try {
      await customizeThemeColors({
        '--color-primary': primaryColor,
        '--color-accent': accentColor,
        '--color-background': backgroundColor,
        '--color-foreground': foregroundColor,
      });
    } catch (error) {
      console.error('Failed to apply colors:', error);
    }
  };

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsGenerating(true);
    try {
      const colors = await extractLogoColors(file);

      // Update colors from logo
      setPrimaryColor(colors.primary);
      setAccentColor(colors.accent);
      setBackgroundColor(colors.background);
      setForegroundColor(colors.text);

      // Auto-apply
      await handleApplyColors();
    } catch (error) {
      console.error('Failed to extract logo colors:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle reset to defaults
  const handleReset = () => {
    setPrimaryColor('#ff8c00');
    setAccentColor('#ff8c00');
    setBackgroundColor('#f0f2f5');
    setForegroundColor('#1a1d23');
  };

  // Handle generate theme
  const handleGenerateTheme = async () => {
    setIsGenerating(true);
    try {
      await generateThemeFromColor('Custom Theme', primaryColor);
      // TODO: Activate generated theme
    } catch (error) {
      console.error('Failed to generate theme:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Palette className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Customize Colors</h2>
              <p className="text-xs text-muted-foreground">
                Adjust your theme colors with live preview
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Color Controls */}
            <div className="space-y-6">
              {/* Logo Upload */}
              <div className="settings-section">
                <h3 className="font-semibold mb-3">Extract from Logo</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your logo to automatically extract brand colors
                </p>
                <label className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-accent/50 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Primary Color */}
              <ColorInput
                label="Primary Color"
                value={primaryColor}
                onChange={setPrimaryColor}
                description={getColorName(primaryColor)}
              />

              {/* Accent Color */}
              <ColorInput
                label="Accent Color"
                value={accentColor}
                onChange={setAccentColor}
                description={getColorName(accentColor)}
              />

              {/* Background Color */}
              <ColorInput
                label="Background Color"
                value={backgroundColor}
                onChange={setBackgroundColor}
                description={getColorName(backgroundColor)}
              />

              {/* Foreground Color */}
              <ColorInput
                label="Text Color"
                value={foregroundColor}
                onChange={setForegroundColor}
                description={getColorName(foregroundColor)}
              />

              {/* Contrast Check */}
              <div className="p-4 rounded-lg bg-surface-2">
                <h4 className="text-sm font-semibold mb-2">Accessibility Check</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Contrast Ratio: {contrastRatio.toFixed(2)}:1
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-1 rounded',
                      meetsAccessibility
                        ? 'bg-success/20 text-success'
                        : 'bg-destructive/20 text-destructive'
                    )}
                  >
                    {meetsAccessibility ? 'WCAG AA ✓' : 'Below WCAG AA'}
                  </span>
                </div>
              </div>

              {/* Color Palette Preview */}
              {colorPalette && (
                <div className="settings-section">
                  <h4 className="font-semibold mb-3">Generated Palette</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.values(colorPalette.primary).map((color: any, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg border border-border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Live Preview */}
            <div className="space-y-4">
              <div className="settings-section">
                <h3 className="font-semibold mb-3">Live Preview</h3>

                {/* Preview Components */}
                <div className="space-y-3">
                  {/* Card Preview */}
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: backgroundColor,
                      color: foregroundColor,
                      borderColor: primaryColor + '40',
                    }}
                  >
                    <h4
                      className="font-semibold mb-2"
                      style={{ color: foregroundColor }}
                    >
                      Preview Card
                    </h4>
                    <p className="text-sm opacity-75">
                      This is how your text will look with the selected colors
                    </p>
                  </div>

                  {/* Button Preview */}
                  <button
                    className="w-full px-4 py-3 rounded-lg font-medium transition-all"
                    style={{
                      backgroundColor: primaryColor,
                      color: '#ffffff',
                    }}
                  >
                    Primary Button
                  </button>

                  <button
                    className="w-full px-4 py-3 rounded-lg font-medium transition-all"
                    style={{
                      backgroundColor: accentColor,
                      color: '#ffffff',
                    }}
                  >
                    Accent Button
                  </button>

                  {/* Input Preview */}
                  <input
                    type="text"
                    placeholder="Input field preview"
                    className="w-full px-4 py-3 rounded-lg border"
                    style={{
                      backgroundColor: backgroundColor,
                      color: foregroundColor,
                      borderColor: primaryColor + '60',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface-1">
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleGenerateTheme}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate Theme'}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleApplyColors();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-medium"
            >
              Apply Colors
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Color Input Component
 */
interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

function ColorInput({ label, value, onChange, description }: ColorInputProps) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-14 h-14 rounded-lg border-2 border-border cursor-pointer"
        />
        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-sm font-mono"
            placeholder="#000000"
          />
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
