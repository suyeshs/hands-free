/**
 * Appearance Settings Page
 * Centralized theme and color customization for all screens
 */

import { useState } from 'react';
import { Palette, Monitor, Smartphone, ChefHat, Wine, Save, RefreshCw, Download, Upload } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { POSThemeCustomizer } from '../components/themes/POSThemeCustomizer';
import { ColorCustomizer } from '../components/themes/ColorCustomizer';
import { ThemeCard } from '../components/themes/ThemeCard';
import { cn } from '../lib/utils';

interface ScreenThemeSection {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  screenType: 'pos' | 'kds' | 'bds' | 'aggregator';
}

const SCREEN_SECTIONS: ScreenThemeSection[] = [
  {
    id: 'pos',
    label: 'Point of Sale',
    description: 'Customize POS terminal appearance for cashiers',
    icon: Monitor,
    screenType: 'pos',
  },
  {
    id: 'kds',
    label: 'Kitchen Display',
    description: 'Theme for kitchen staff display screens',
    icon: ChefHat,
    screenType: 'kds',
  },
  {
    id: 'bds',
    label: 'Bar Display',
    description: 'Bar station display customization',
    icon: Wine,
    screenType: 'bds',
  },
  {
    id: 'aggregator',
    label: 'Aggregator Display',
    description: 'Third-party orders display theme',
    icon: Smartphone,
    screenType: 'aggregator',
  },
];

export default function AppearancePage() {
  const {
    installedThemes,
    activeThemeId,
    activateTheme,
    screenOverrides,
    setScreenOverride,
  } = useThemeStore();

  const [activeSection, setActiveSection] = useState<string>('global');
  const [showPOSCustomizer, setShowPOSCustomizer] = useState(false);
  const [showColorCustomizer, setShowColorCustomizer] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<'pos' | 'kds' | 'bds' | 'aggregator' | null>(null);

  // Get active theme
  const activeTheme = installedThemes.find(t => t.id === activeThemeId);

  // Handle theme activation
  const handleActivateTheme = async (themeId: string) => {
    try {
      await activateTheme(themeId);
    } catch (error) {
      console.error('Failed to activate theme:', error);
    }
  };

  // Handle screen-specific customization
  const handleCustomizeScreen = (screenType: 'pos' | 'kds' | 'bds' | 'aggregator') => {
    setSelectedScreen(screenType);
    if (screenType === 'pos') {
      setShowPOSCustomizer(true);
    } else {
      setShowColorCustomizer(true);
    }
  };

  // Reset screen override
  const handleResetScreenOverride = async (screenType: string) => {
    if (confirm(`Reset ${screenType.toUpperCase()} theme to default?`)) {
      try {
        await setScreenOverride(screenType as any, {});
      } catch (error) {
        console.error('Failed to reset screen override:', error);
      }
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d97542] to-[#c85a2a] flex items-center justify-center">
            <Palette className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#e8d4b8]">Appearance</h1>
            <p className="text-[#e8d4b8]/60 text-sm">
              Customize themes and colors for all screens
            </p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveSection('global')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
            activeSection === 'global'
              ? 'bg-[#d97542] text-white'
              : 'bg-[#e8d4b8]/5 text-[#e8d4b8]/80 hover:bg-[#e8d4b8]/10'
          )}
        >
          Global Theme
        </button>
        <button
          onClick={() => setActiveSection('screens')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
            activeSection === 'screens'
              ? 'bg-[#d97542] text-white'
              : 'bg-[#e8d4b8]/5 text-[#e8d4b8]/80 hover:bg-[#e8d4b8]/10'
          )}
        >
          Screen-Specific
        </button>
      </div>

      {/* Global Theme Section */}
      {activeSection === 'global' && (
        <div className="space-y-6">
          {/* Active Theme Info */}
          {activeTheme && (
            <div className="bg-[#e8d4b8]/5 border border-[#e8d4b8]/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#e8d4b8] mb-2">
                Current Theme
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[#e8d4b8] font-medium">{activeTheme.name}</p>
                  <p className="text-[#e8d4b8]/60 text-sm mt-1">
                    {activeTheme.description || 'No description'}
                  </p>
                </div>
                <button
                  onClick={() => setShowColorCustomizer(true)}
                  className="px-4 py-2 bg-[#d97542] text-white rounded-lg hover:bg-[#c85a2a] transition-colors text-sm font-medium"
                >
                  Customize Colors
                </button>
              </div>
            </div>
          )}

          {/* Available Themes */}
          <div>
            <h3 className="text-lg font-semibold text-[#e8d4b8] mb-4">
              Available Themes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {installedThemes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={theme.id === activeThemeId}
                  onActivate={() => handleActivateTheme(theme.id)}
                />
              ))}
            </div>

            {installedThemes.length === 0 && (
              <div className="text-center py-12 bg-[#e8d4b8]/5 rounded-xl border border-[#e8d4b8]/10">
                <Palette className="w-16 h-16 text-[#e8d4b8]/20 mx-auto mb-4" />
                <p className="text-[#e8d4b8]/60">No themes installed</p>
                <p className="text-[#e8d4b8]/40 text-sm mt-2">
                  Install themes from the Plugin Store
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screen-Specific Section */}
      {activeSection === 'screens' && (
        <div className="space-y-6">
          <p className="text-[#e8d4b8]/60 mb-4">
            Customize appearance for specific screen types. These settings override the global theme for each screen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SCREEN_SECTIONS.map(section => {
              const Icon = section.icon;
              const hasOverride = screenOverrides[section.screenType] &&
                Object.keys(screenOverrides[section.screenType] || {}).length > 0;

              return (
                <div
                  key={section.id}
                  className={cn(
                    'bg-[#e8d4b8]/5 border rounded-xl p-6 transition-all',
                    hasOverride
                      ? 'border-[#d97542] shadow-lg shadow-[#d97542]/20'
                      : 'border-[#e8d4b8]/10 hover:border-[#d97542]/30'
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        hasOverride
                          ? 'bg-gradient-to-br from-[#d97542] to-[#c85a2a]'
                          : 'bg-[#e8d4b8]/10'
                      )}>
                        <Icon className={cn(
                          'w-6 h-6',
                          hasOverride ? 'text-white' : 'text-[#e8d4b8]/60'
                        )} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[#e8d4b8]">
                          {section.label}
                        </h3>
                        <p className="text-sm text-[#e8d4b8]/60 mt-1">
                          {section.description}
                        </p>
                      </div>
                    </div>
                    {hasOverride && (
                      <span className="px-2 py-1 bg-[#d97542] text-white text-xs font-semibold rounded-full">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCustomizeScreen(section.screenType)}
                      className="flex-1 px-4 py-2 bg-[#d97542] text-white rounded-lg hover:bg-[#c85a2a] transition-colors text-sm font-medium"
                    >
                      Customize
                    </button>
                    {hasOverride && (
                      <button
                        onClick={() => handleResetScreenOverride(section.screenType)}
                        className="px-4 py-2 bg-[#e8d4b8]/10 text-[#e8d4b8] rounded-lg hover:bg-[#e8d4b8]/20 transition-colors text-sm"
                        title="Reset to default"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4">
        <button
          className="flex items-center gap-2 px-4 py-2 bg-[#e8d4b8]/5 text-[#e8d4b8] rounded-lg hover:bg-[#e8d4b8]/10 transition-colors text-sm font-medium"
          title="Export theme settings"
        >
          <Download className="w-4 h-4" />
          Export Settings
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-[#e8d4b8]/5 text-[#e8d4b8] rounded-lg hover:bg-[#e8d4b8]/10 transition-colors text-sm font-medium"
          title="Import theme settings"
        >
          <Upload className="w-4 h-4" />
          Import Settings
        </button>
      </div>

      {/* Modals */}
      {showPOSCustomizer && (
        <POSThemeCustomizer
          isOpen={showPOSCustomizer}
          onClose={() => {
            setShowPOSCustomizer(false);
            setSelectedScreen(null);
          }}
        />
      )}

      {showColorCustomizer && (
        <ColorCustomizer
          isOpen={showColorCustomizer}
          onClose={() => {
            setShowColorCustomizer(false);
            setSelectedScreen(null);
          }}
          screenType={selectedScreen || undefined}
        />
      )}
    </div>
  );
}
