/**
 * StatusPill Component
 * Pill-shaped status indicator
 */

import { forwardRef, HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const statusPillVariants = cva(
  'inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-neo',
  {
    variants: {
      status: {
        default: 'bg-muted text-muted-foreground',
        pending: 'bg-muted text-muted-foreground neo-inset',
        active: 'bg-primary/15 text-primary border border-primary/30',
        success: 'bg-foreground/10 text-foreground',
        warning: 'bg-muted text-muted-foreground border border-muted-foreground/20',
        error: 'bg-destructive/15 text-destructive border border-destructive/30',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
        lg: 'text-base px-4 py-1.5',
      },
    },
    defaultVariants: {
      status: 'default',
      size: 'md',
    },
  }
);

export interface StatusPillProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  /** Optional icon to display */
  icon?: React.ReactNode;
}

const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, status, size, icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(statusPillVariants({ status, size, className }))}
        {...props}
      >
        {icon && <span className="mr-1">{icon}</span>}
        {children}
      </span>
    );
  }
);

StatusPill.displayName = 'StatusPill';

export { StatusPill, statusPillVariants };
