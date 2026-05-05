/**
 * Toggle Component
 * Reusable toggle switch with theme support
 * Used throughout settings for boolean options
 */

import { cn } from '@/lib/utils';

export interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  enabled,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: ToggleProps) {
  return (
    <div className={cn('settings-toggle-row', className)}>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-foreground">{label}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={cn(
          'relative w-16 h-9 rounded-full transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          enabled ? 'bg-accent' : 'bg-muted'
        )}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
      >
        <div
          className={cn(
            'absolute top-1 w-7 h-7 bg-card shadow-md rounded-full transition-transform',
            enabled ? 'translate-x-8' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
