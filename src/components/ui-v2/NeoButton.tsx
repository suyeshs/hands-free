/**
 * NeoButton Component
 * Tactile button with neomorphic styling and press effect
 */

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const neoButtonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center font-medium transition-neo active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'neo-raised-sm hover:shadow-lg active:neo-pressed text-foreground',
        primary: 'neo-raised-sm hover:shadow-lg active:neo-pressed text-primary border border-primary/20',
        destructive: 'neo-raised-sm hover:shadow-lg active:neo-pressed text-destructive border border-destructive/20',
        ghost: 'hover:bg-muted active:bg-muted/80 text-foreground rounded-[var(--radius-sm)]',
        flat: 'bg-card hover:bg-muted active:bg-muted/80 rounded-[var(--radius-sm)] text-foreground',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-[0.875rem]',
        md: 'h-10 px-4 text-base rounded-[var(--radius-sm)]',
        lg: 'h-12 px-6 text-lg rounded-[var(--radius)]',
        icon: 'h-10 w-10 rounded-[var(--radius-sm)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface NeoButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof neoButtonVariants> {
  /** Show loading state */
  loading?: boolean;
}

const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(neoButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{children}</span>
          </div>
        ) : (
          children
        )}
      </button>
    );
  }
);

NeoButton.displayName = 'NeoButton';

export { NeoButton, neoButtonVariants };
