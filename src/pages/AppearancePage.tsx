/**
 * AppearancePage
 * Main appearance settings page with theme selection and screen-specific customization
 * Allows users to customize theme for KDS, POS, Reports, and Settings
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Palette,
  Sun,
  Moon,
  MonitorSmartphone,
  ChefHat,
  ShoppingCart,
  BarChart3,
  Settings as SettingsIcon,
  Paintbrush,
} from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { ThemeCard } from '@/components/themes/ThemeCard';
import { ColorCustomizer } from '@/components/themes/ColorCustomizer';
import { POSThemeCustomizer } from '@/components/themes/POSThemeCustomizer';
import type { ScreenType, ThemeMode } from '@/types/theme';
import { cn } from '@/lib/utils';

export default function AppearancePage() {
  const navigate = useNavigate();
  const {
    installedThemes,
    activeThemeId,
    themeMode,
    screenOverrides,
    activateTheme,
    setThemeMode,
    setScreenOverride,
    removeScreenOverride,
  } = useThemeStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showColorCustomizer, setShowColorCustomizer] = useState(false);
  const [showPOSCustomizer, setShowPOSCustomizer] = useState(false);

  // Get active theme
  const activeTheme = installedThemes.find(t => t.id === activeThemeId);

  // Filter themes by category
  const filteredThemes = selectedCategory === 'all'
    ? installedThemes
    : installedThemes.filter(t => t.category === selectedCategory);

  // Handle theme activation
  const handleThemeSelect = async (themeId: string) => {
    try {
      await activateTheme(themeId);
    } catch (error) {
      console.error('Failed to activate theme:', error);
    }
  };

  // Handle mode change
  const handleModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  // Check if screen has override
  const hasScreenOverride = (screen: ScreenType) => {
    return Object.keys(screenOverrides[screen] || {}).length > 0;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Appearance</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Customize how your app looks across different screens
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Current Theme Preview */}
        <section className="settings-section">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Current Theme</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTheme?.name || 'No theme selected'}
              </p>
            </div>
            {activeTheme && (
              <div className="px-3 py-1 rounded-md bg-accent/10 text-accent text-sm font-medium">
                Active
              </div>
            )}
          </div>

          {/* Live Preview */}
          {activeTheme && (
            <div className="rounded-xl overflow-hidden border-2 border-border">
              <div className="relative aspect-video bg-gradient-to-br from-surface-2 to-surface-3">
                {activeTheme.previewUrl ? (
                  <img
                    src={activeTheme.previewUrl}
                    alt={activeTheme.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Palette className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customize Colors Button */}
          <button
            onClick={() => setShowColorCustomizer(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors font-medium"
          >
            <Paintbrush className="w-5 h-5" />
            Customize Colors
          </button>
        </section>

        {/* Display Mode */}
        <section className="settings-section">
          <h2 className="text-lg font-semibold mb-4">Display Mode</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Choose how the theme appears
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModeOption
              icon={<Sun className="w-6 h-6" />}
              label="Light Mode"
              description="Bright interface for daytime"
              active={themeMode === 'light'}
              onClick={() => handleModeChange('light')}
            />
            <ModeOption
              icon={<Moon className="w-6 h-6" />}
              label="Dark Mode"
              description="Easy on eyes for evening"
              active={themeMode === 'dark'}
              onClick={() => handleModeChange('dark')}
            />
            <ModeOption
              icon={<MonitorSmartphone className="w-6 h-6" />}
              label="Auto"
              description="Matches system settings"
              active={themeMode === 'auto'}
              onClick={() => handleModeChange('auto')}
            />
          </div>
        </section>

        {/* Screen-Specific Customization */}
        <section className="settings-section">
          <h2 className="text-lg font-semibold mb-4">Screen-Specific Customization</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Customize appearance for specific screens while keeping the base theme
          </p>

          <div className="space-y-4">
            <ScreenOverrideCard
              icon={<ChefHat className="w-6 h-6" />}
              screenType="kds"
              title="Kitchen Display (KDS)"
              description="High contrast, large text for kitchen staff"
              hasOverride={hasScreenOverride('kds')}
              onConfigure={() => {
                // TODO: Open screen customizer modal
                console.log('Configure KDS theme');
              }}
              onRemove={() => removeScreenOverride('kds')}
            />

            <ScreenOverrideCard
              icon={<ShoppingCart className="w-6 h-6" />}
              screenType="pos"
              title="Point of Sale (POS)"
              description="Optimized for cashier speed and clarity"
              hasOverride={hasScreenOverride('pos')}
              onConfigure={() => setShowPOSCustomizer(true)}
              onRemove={() => removeScreenOverride('pos')}
            />

            <ScreenOverrideCard
              icon={<BarChart3 className="w-6 h-6" />}
              screenType="reports"
              title="Reports & Analytics"
              description="Data visualization optimized colors"
              hasOverride={hasScreenOverride('reports')}
              onConfigure={() => {
                console.log('Configure Reports theme');
              }}
              onRemove={() => removeScreenOverride('reports')}
            />

            <ScreenOverrideCard
              icon={<SettingsIcon className="w-6 h-6" />}
              screenType="settings"
              title="Settings"
              description="All settings screens share the same theme"
              hasOverride={hasScreenOverride('settings')}
              onConfigure={() => {
                console.log('Configure Settings theme');
              }}
              onRemove={() => removeScreenOverride('settings')}
              disabled
            />
          </div>
        </section>

        {/* Theme Gallery */}
        <section className="settings-section">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Available Themes</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredThemes.length} theme{filteredThemes.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            {['all', 'modern', 'dark', 'bright', 'colorful', 'classic', 'industry'].map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  selectedCategory === category
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 hover:bg-surface-3'
                )}
              >
                {category === 'all' ? 'All Themes' : getCategoryLabel(category)}
              </button>
            ))}
          </div>

          {/* Theme Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredThemes.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                active={theme.id === activeThemeId}
                onClick={() => handleThemeSelect(theme.id)}
                size="md"
                showBadge
              />
            ))}
          </div>

          {filteredThemes.length === 0 && (
            <div className="text-center py-12">
              <Palette className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No themes found in this category</p>
            </div>
          )}
        </section>
      </div>

      {/* Color Customizer Modal */}
      <ColorCustomizer
        isOpen={showColorCustomizer}
        onClose={() => setShowColorCustomizer(false)}
      />

      {/* POS Theme Customizer Modal */}
      <POSThemeCustomizer
        isOpen={showPOSCustomizer}
        onClose={() => setShowPOSCustomizer(false)}
      />
    </div>
  );
}

/**
 * Mode Option Component
 */
interface ModeOptionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}

function ModeOption({ icon, label, description, active, onClick }: ModeOptionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-3 p-6 rounded-xl transition-all',
        'border-2',
        active
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-accent/50 hover:bg-surface-2'
      )}
    >
      <div className={cn('text-muted-foreground', active && 'text-accent')}>
        {icon}
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-sm">{label}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
}

/**
 * Screen Override Card Component
 */
interface ScreenOverrideCardProps {
  icon: React.ReactNode;
  screenType: ScreenType;
  title: string;
  description: string;
  hasOverride: boolean;
  onConfigure: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

function ScreenOverrideCard({
  icon,
  title,
  description,
  hasOverride,
  onConfigure,
  onRemove,
  disabled = false,
}: ScreenOverrideCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border transition-all',
        hasOverride
          ? 'border-accent bg-accent/5'
          : 'border-border bg-surface-1',
        disabled && 'opacity-50'
      )}
    >
      <div className={cn(
        'w-12 h-12 rounded-lg flex items-center justify-center',
        hasOverride ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-muted-foreground'
      )}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        {hasOverride && !disabled && (
          <button
            onClick={onRemove}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            Reset
          </button>
        )}
        {!disabled && (
          <button
            onClick={onConfigure}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              hasOverride
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'bg-surface-2 hover:bg-surface-3'
            )}
          >
            {hasOverride ? 'Edit' : 'Customize'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Get human-readable category label
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    modern: '✨ Modern',
    dark: '🌙 Dark',
    bright: '☀️ Bright',
    colorful: '🎨 Colorful',
    classic: '📋 Classic',
    industry: '🏪 Industry',
  };
  return labels[category] || category;
}
