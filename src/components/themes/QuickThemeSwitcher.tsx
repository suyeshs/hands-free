/**
 * QuickThemeSwitcher Component
 * Header dropdown for quick theme switching
 * Shows recent/popular themes with one-click apply
 */

import { useState, useRef, useEffect } from 'react';
import { Palette, ChevronDown, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { ThemeCardCompact } from './ThemeCard';
import { cn } from '@/lib/utils';

export function QuickThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    installedThemes,
    activeThemeId,
    activateTheme,
  } = useThemeStore();

  // Get active theme info
  const activeTheme = installedThemes.find(t => t.id === activeThemeId);

  // Get recent/popular themes (limit to 6)
  const quickThemes = installedThemes.slice(0, 6);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle theme selection
  const handleThemeSelect = async (themeId: string) => {
    try {
      await activateTheme(themeId);
      // Auto-close after short delay for visual feedback
      setTimeout(() => setIsOpen(false), 500);
    } catch (error) {
      console.error('Failed to activate theme:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'transition-all duration-200',
          'hover:bg-surface-2',
          isOpen && 'bg-surface-2'
        )}
      >
        <Palette className="w-5 h-5 text-accent" />
        <span className="text-sm font-medium hidden md:inline">
          {activeTheme?.name || 'Choose Theme'}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 z-50">
          <div className="bg-card rounded-xl border border-border shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-surface-1">
              <h3 className="font-semibold text-sm">Choose Theme</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quick access to your themes
              </p>
            </div>

            {/* Theme List */}
            <div className="p-2 max-h-96 overflow-y-auto">
              {quickThemes.length > 0 ? (
                <div className="space-y-1">
                  {quickThemes.map(theme => (
                    <ThemeCardCompact
                      key={theme.id}
                      theme={theme}
                      active={theme.id === activeThemeId}
                      onClick={() => handleThemeSelect(theme.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No themes installed</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-2 py-3 border-t border-border bg-surface-1 space-y-2">
              <button
                onClick={() => {
                  navigate('/settings/appearance');
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                Browse All Themes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
