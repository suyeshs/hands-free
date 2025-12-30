/**
 * ContextualHeader Component
 * Minimal header with just screen title
 */

import { cn } from '../../lib/utils';

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
  return (
    <header className={cn('contextual-header', className)}>
      <div className="flex-1">
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
