/**
 * ContextualHeader Component
 * Minimal header with just screen title and restaurant logo
 */

import { cn } from '../../lib/utils';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';

export interface ContextualHeaderProps {
  /** Screen title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Additional className */
  className?: string;
}

export function ContextualHeader({
  title,
  subtitle,
  className,
}: ContextualHeaderProps) {
  const { settings } = useRestaurantSettingsStore();
  const logoUrl = settings.logoUrl;

  return (
    <header className={cn('contextual-header', className)}>
      {/* Restaurant Logo */}
      {logoUrl && (
        <div className="mr-4 flex-shrink-0">
          <img
            src={logoUrl}
            alt={settings.name || 'Restaurant'}
            className="h-10 w-auto object-contain"
          />
        </div>
      )}

      {/* Title and Subtitle */}
      <div className="flex-1">
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
