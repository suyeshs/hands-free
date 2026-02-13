/**
 * Form Grid Component
 * Responsive grid wrapper for form layouts
 * Automatically adjusts columns based on screen size
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FormGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl';
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gapClasses = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export function FormGrid({
  children,
  columns = 2,
  breakpoint = 'lg',
  gap = 'md',
  className,
}: FormGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1',
        `${breakpoint}:grid-cols-${columns}`,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}
