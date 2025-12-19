/**
 * NeoCard Component
 * Primary surface component with neomorphic styling
 */

import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface NeoCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Variant of the card */
  variant?: 'raised' | 'flat' | 'inset';
  /** Size of the card (affects shadow depth) */
  size?: 'sm' | 'md' | 'lg';
  /** Enable hover effect */
  hoverable?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const NeoCard = forwardRef<HTMLDivElement, NeoCardProps>(
  (
    {
      className,
      variant = 'raised',
      size = 'md',
      hoverable = false,
      padding = 'md',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'transition-neo',

          // Variant styles
          variant === 'raised' && size === 'sm' && 'neo-raised-sm',
          variant === 'raised' && size === 'md' && 'neo-raised',
          variant === 'raised' && size === 'lg' && 'neo-raised-lg',
          variant === 'flat' && 'bg-card rounded-[var(--radius)]',
          variant === 'inset' && 'neo-inset',

          // Hover effect
          hoverable && variant === 'raised' && 'neo-hover cursor-pointer',

          // Padding
          padding === 'none' && 'p-0',
          padding === 'sm' && 'p-4',
          padding === 'md' && 'p-6',
          padding === 'lg' && 'p-8',

          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

NeoCard.displayName = 'NeoCard';

export { NeoCard };
