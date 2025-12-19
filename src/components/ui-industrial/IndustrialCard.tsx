import React from 'react';
import { cn } from '../../lib/utils';

interface IndustrialCardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'raised' | 'sunken' | 'bordered' | 'dark';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const IndustrialCard = React.forwardRef<HTMLDivElement, IndustrialCardProps>(
    ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'relative',

                    // Backgrounds
                    variant !== 'dark' && 'bg-white',

                    // Variants
                    variant === 'default' && 'shadow-sm border border-gray-200',
                    variant === 'raised' && 'shadow-md border-b-4 border-r-4 border-gray-300 rounded-lg',
                    variant === 'sunken' && 'bg-gray-100 inner-shadow border border-gray-200',
                    variant === 'bordered' && 'border-2 border-gray-800',
                    variant === 'dark' && 'bg-slate-800 text-white border-2 border-slate-600 shadow-md',

                    // Padding
                    padding === 'none' && 'p-0',
                    padding === 'sm' && 'p-2',
                    padding === 'md' && 'p-4',
                    padding === 'lg' && 'p-6',

                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

IndustrialCard.displayName = 'IndustrialCard';
