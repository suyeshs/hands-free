/**
 * Section Card Component
 * Themed card wrapper for settings sections
 * Provides consistent styling and theme integration
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/themeStore';

export interface SectionCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  description,
  children,
  className,
  noPadding = false,
}: SectionCardProps) {
  const theme = useThemeStore((state) => state);

  return (
    <div
      className={cn(
        'neo-raised transition-neo',
        !noPadding && 'p-8',
        className
      )}
    >
      {/* Header */}
      {(title || description) && (
        <div className={cn(!noPadding && 'mb-6', noPadding && 'p-8 pb-0')}>
          {title && (
            <h4 className="text-lg font-semibold text-foreground mb-2">{title}</h4>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn(noPadding && 'p-8 pt-0')}>
        {children}
      </div>
    </div>
  );
}
