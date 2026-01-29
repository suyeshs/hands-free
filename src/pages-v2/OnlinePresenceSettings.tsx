/**
 * Online Presence Settings
 *
 * Configure customer-facing website theme, appearance, and branding.
 * Includes theme selection, customization, and live preview.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Copy,
  ExternalLink,
  Check,
  Info,
  Palette,
  Image as ImageIcon,
  Type,
  Layout,
  Monitor,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { useTenantStore } from '../stores/tenantStore';
import {
  THEME_CATEGORIES,
  FONT_OPTIONS,
  getThemePreset,
  filterThemesByCategory,
  type ThemePreset,
} from '../lib/themePresets';
import {
  generateCustomerSiteUrl,
  hasSubdomainConfigured,
  getTenantSubdomain,
} from '../lib/urlGenerator';

export function OnlinePresenceSettings() {
  const { settings, updateOnlinePresence } = useRestaurantSettingsStore();
  const { tenant } = useTenantStore();

  // Local state
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTheme, setSelectedTheme] = useState(settings.onlinePresence.themePreset);
  const [customColors, setCustomColors] = useState(settings.onlinePresence.themeConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewLoading, setPreviewLoading] = useState(true);

  // Computed values
  const customerSiteUrl = useMemo(() => generateCustomerSiteUrl(), [tenant?.subdomain]);
  const isOnline = settings.posSettings.activateOnline && hasSubdomainConfigured();
  const filteredThemes = useMemo(() => filterThemesByCategory(selectedCategory), [selectedCategory]);

  const hasChanges = useMemo(() => {
    return (
      selectedTheme !== settings.onlinePresence.themePreset ||
      JSON.stringify(customColors) !== JSON.stringify(settings.onlinePresence.themeConfig)
    );
  }, [selectedTheme, customColors, settings.onlinePresence]);

  // Sync subdomain from tenant store
  useEffect(() => {
    const subdomain = getTenantSubdomain();
    if (subdomain && subdomain !== settings.onlinePresence.subdomain) {
      updateOnlinePresence({ subdomain });
    }
  }, [tenant?.subdomain]);

  // Copy URL to clipboard
  const copyUrlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(customerSiteUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Handle theme selection
  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
    const preset = getThemePreset(themeId);
    if (preset) {
      // Apply preset colors
      setCustomColors(prev => ({
        ...prev,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
      }));
    }
  };

  // Handle color changes
  const handleColorChange = (colorKey: string, value: string) => {
    setCustomColors(prev => ({
      ...prev,
      [colorKey]: value,
    }));
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateOnlinePresence({
        themePreset: selectedTheme,
        themeConfig: customColors,
      });

      // Reload preview
      setPreviewLoading(true);
      setTimeout(() => setPreviewLoading(false), 1000);
    } catch (error) {
      console.error('Failed to save online presence settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to preset defaults
  const resetToDefaults = () => {
    const preset = getThemePreset(selectedTheme);
    if (preset) {
      setCustomColors({
        ...settings.onlinePresence.themeConfig,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Globe className="w-7 h-7" />
          Online Presence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your customer-facing website theme and appearance
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Website Status
        </h2>

        <div className="space-y-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {!isOnline && (
              <span className="text-sm text-muted-foreground">
                (Enable online features in POS Settings to go live)
              </span>
            )}
          </div>

          {/* URL Display */}
          {hasSubdomainConfigured() ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Your Website URL
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 p-3 bg-muted rounded border border-border">
                  <code className="flex-1 text-sm font-mono truncate">
                    {customerSiteUrl}
                  </code>
                  <button
                    onClick={copyUrlToClipboard}
                    className="px-3 py-1.5 text-sm bg-background hover:bg-accent hover:text-accent-foreground border border-border rounded transition-colors flex items-center gap-1"
                  >
                    {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedUrl ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={customerSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-sm bg-accent text-accent-foreground hover:bg-accent/90 rounded transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Visit Site
                  </a>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                URL is set during tenant activation and cannot be changed here.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Tenant Not Activated
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Complete tenant activation to get your website URL.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Theme Selection Card */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Theme Selection
        </h2>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {THEME_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {category.label} ({category.count})
            </button>
          ))}
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredThemes.map((theme) => (
            <ThemePresetCard
              key={theme.id}
              theme={theme}
              selected={selectedTheme === theme.id}
              onSelect={() => handleThemeSelect(theme.id)}
            />
          ))}
        </div>
      </div>

      {/* Theme Customization Card */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layout className="w-5 h-5" />
            Customize Theme
          </h2>
          <button
            onClick={resetToDefaults}
            className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-muted-foreground rounded transition-colors"
          >
            Reset to Defaults
          </button>
        </div>

        <div className="space-y-6">
          {/* Color Pickers */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ColorPicker
                label="Primary Color"
                value={customColors.primaryColor || '#2563EB'}
                onChange={(value) => handleColorChange('primaryColor', value)}
              />
              <ColorPicker
                label="Secondary Color"
                value={customColors.secondaryColor || '#64748B'}
                onChange={(value) => handleColorChange('secondaryColor', value)}
              />
              <ColorPicker
                label="Accent Color"
                value={customColors.accentColor || '#3B82F6'}
                onChange={(value) => handleColorChange('accentColor', value)}
              />
              <ColorPicker
                label="Background Color"
                value={customColors.backgroundColor || '#FFFFFF'}
                onChange={(value) => handleColorChange('backgroundColor', value)}
              />
              <ColorPicker
                label="Text Color (Primary)"
                value={customColors.textPrimaryColor || '#1F2937'}
                onChange={(value) => handleColorChange('textPrimaryColor', value)}
              />
              <ColorPicker
                label="Text Color (Secondary)"
                value={customColors.textSecondaryColor || '#6B7280'}
                onChange={(value) => handleColorChange('textSecondaryColor', value)}
              />
            </div>
          </div>

          {/* Background Type */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Background Style</h3>
            <div className="flex gap-2">
              {['solid', 'gradient', 'image'].map((type) => (
                <button
                  key={type}
                  onClick={() => handleColorChange('backgroundType', type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    (customColors.backgroundType || 'solid') === type
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Card Styles */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Card Appearance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Border Radius: {customColors.cardBorderRadius || 12}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={customColors.cardBorderRadius || 12}
                  onChange={(e) => handleColorChange('cardBorderRadius', e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Shadow
                </label>
                <select
                  value={customColors.cardShadow || 'subtle'}
                  onChange={(e) => handleColorChange('cardShadow', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  <option value="none">None</option>
                  <option value="subtle">Subtle</option>
                  <option value="medium">Medium</option>
                  <option value="strong">Strong</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Border
                </label>
                <select
                  value={customColors.cardBorder || 'none'}
                  onChange={(e) => handleColorChange('cardBorder', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  <option value="none">None</option>
                  <option value="thin">Thin</option>
                  <option value="medium">Medium</option>
                  <option value="thick">Thick</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Hover Effect
                </label>
                <select
                  value={customColors.cardHoverEffect || 'lift'}
                  onChange={(e) => handleColorChange('cardHoverEffect', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  <option value="none">None</option>
                  <option value="lift">Lift</option>
                  <option value="glow">Glow</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Type className="w-4 h-4" />
              Typography
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Heading Font
                </label>
                <select
                  value={customColors.headingFont || 'inter'}
                  onChange={(e) => handleColorChange('headingFont', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Body Font
                </label>
                <select
                  value={customColors.bodyFont || 'inter'}
                  onChange={(e) => handleColorChange('bodyFont', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Font Scale
                </label>
                <select
                  value={customColors.fontScale || 'normal'}
                  onChange={(e) => handleColorChange('fontScale', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
          </div>

          {/* Logo Settings */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Logo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Logo Size
                </label>
                <select
                  value={customColors.logoSize || 'medium'}
                  onChange={(e) => handleColorChange('logoSize', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Logo Position
                </label>
                <select
                  value={customColors.logoPosition || 'left'}
                  onChange={(e) => handleColorChange('logoPosition', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Live Preview
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${
                previewDevice === 'desktop'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Monitor className="w-4 h-4" />
              Desktop
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${
                previewDevice === 'mobile'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Mobile
            </button>
          </div>
        </div>

        <div className={`mx-auto ${previewDevice === 'mobile' ? 'max-w-sm' : 'w-full'}`}>
          <div className="relative bg-muted rounded-lg overflow-hidden border border-border">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading preview...</p>
                </div>
              </div>
            )}
            <iframe
              src={`${customerSiteUrl}/#/order`}
              className={`w-full border-0 ${previewDevice === 'mobile' ? 'h-[600px]' : 'h-[700px]'}`}
              onLoad={() => setPreviewLoading(false)}
              title="Menu Preview"
            />
          </div>
        </div>
      </div>

      {/* How It Works Card */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-2">How It Works</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">1.</span>
                <span>Select a theme that matches your restaurant's brand</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">2.</span>
                <span>Customize colors, fonts, and appearance to your liking</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">3.</span>
                <span>Preview changes in real-time before saving</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">4.</span>
                <span>Share your website URL with customers for online ordering</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>
    </div>
  );
}

// Theme Preset Card Component
function ThemePresetCard({
  theme,
  selected,
  onSelect
}: {
  theme: ThemePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`p-4 border-2 rounded-lg text-left transition-all ${
        selected
          ? 'border-accent bg-accent/10 shadow-md'
          : 'border-border hover:border-accent/50 hover:shadow-sm'
      }`}
    >
      {/* Color Swatches */}
      <div className="flex gap-2 mb-3">
        <div
          className="w-12 h-12 rounded shadow-sm"
          style={{ backgroundColor: theme.primaryColor }}
        />
        <div
          className="w-12 h-12 rounded shadow-sm"
          style={{ backgroundColor: theme.secondaryColor }}
        />
      </div>

      {/* Theme Info */}
      <h3 className="font-semibold text-sm mb-1">{theme.name}</h3>
      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
        {theme.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {theme.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-muted text-xs rounded capitalize"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Selected Indicator */}
      {selected && (
        <div className="mt-3 flex items-center gap-1 text-accent text-xs font-medium">
          <Check className="w-3 h-3" />
          Selected
        </div>
      )}
    </button>
  );
}

// Color Picker Component
function ColorPicker({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-2 block">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded cursor-pointer border border-border"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-3 py-2 bg-background border border-border rounded font-mono text-sm"
        />
      </div>
    </div>
  );
}
