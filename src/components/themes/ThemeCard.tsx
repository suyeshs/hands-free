/**
 * ThemeCard Component
 * Displays a theme preview card with thumbnail and metadata
 * Used in theme gallery and quick switcher
 */

import { Check } from 'lucide-react';
import type { InstalledTheme } from '@/types/theme';
import { cn } from '@/lib/utils';

interface ThemeCardProps {
  theme: InstalledTheme;
  active?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

export function ThemeCard({
  theme,
  active = false,
  onClick,
  size = 'md',
  showBadge = false,
}: ThemeCardProps) {
  const sizeClasses = {
    sm: 'w-32 h-32',
    md: 'w-40 h-40',
    lg: 'w-48 h-48',
  };

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300',
        'border-2',
        active
          ? 'border-accent ring-4 ring-accent/20'
          : 'border-border hover:border-accent/50 hover:shadow-lg',
        sizeClasses[size],
        'group'
      )}
      onClick={onClick}
    >
      {/* Preview Image */}
      <div className="relative w-full h-full">
        {theme.previewUrl ? (
          <img
            src={theme.previewUrl}
            alt={theme.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-2 to-surface-3 flex items-center justify-center">
            <span className="text-4xl opacity-50">🎨</span>
          </div>
        )}

        {/* Hover Overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300',
            active && 'bg-accent/10'
          )}
        />

        {/* Active Checkmark */}
        {active && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4" />
          </div>
        )}

        {/* Badge (if provided) */}
        {showBadge && theme.category && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
            {getCategoryLabel(theme.category)}
          </div>
        )}
      </div>

      {/* Theme Info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
        <h3 className="font-semibold text-sm truncate">{theme.name}</h3>
        {theme.description && (
          <p className="text-xs opacity-90 truncate mt-0.5">{theme.description}</p>
        )}
      </div>

      {/* Apply Button (shows on hover for non-active themes) */}
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="px-4 py-2 bg-accent text-white rounded-lg font-medium text-sm shadow-lg hover:bg-accent/90 transition-colors">
            Apply Theme
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact theme card for quick switcher dropdown
 */
export function ThemeCardCompact({
  theme,
  active = false,
  onClick,
}: Omit<ThemeCardProps, 'size' | 'showBadge'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all',
        'border',
        active
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-accent/50 hover:bg-surface-2'
      )}
      onClick={onClick}
    >
      {/* Preview Thumbnail */}
      <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
        {theme.previewUrl ? (
          <img
            src={theme.previewUrl}
            alt={theme.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-2 to-surface-3 flex items-center justify-center">
            <span className="text-lg">🎨</span>
          </div>
        )}
      </div>

      {/* Theme Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{theme.name}</h4>
        {theme.category && (
          <p className="text-xs text-muted-foreground">
            {getCategoryLabel(theme.category)}
          </p>
        )}
      </div>

      {/* Active Indicator */}
      {active && (
        <Check className="w-5 h-5 text-accent flex-shrink-0" />
      )}
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
