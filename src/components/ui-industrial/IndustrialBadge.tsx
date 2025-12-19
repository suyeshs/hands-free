import React from 'react';
import { cn } from '../../lib/utils';

interface IndustrialBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md' | 'lg';
}

export const IndustrialBadge = ({ className, variant = 'default', size = 'md', children, ...props }: IndustrialBadgeProps) => {
    return (
        <span
            className={cn(
                'inline-flex items-center justify-center font-bold uppercase tracking-wider border',

                // Variants
                variant === 'default' && 'bg-gray-100 text-gray-800 border-gray-300',
                variant === 'success' && 'bg-green-100 text-green-800 border-green-300',
                variant === 'warning' && 'bg-yellow-100 text-yellow-800 border-yellow-300',
                variant === 'danger' && 'bg-red-100 text-red-800 border-red-300',
                variant === 'info' && 'bg-blue-100 text-blue-800 border-blue-300',

                // Sizes
                size === 'sm' && 'px-2 py-0.5 text-xs',
                size === 'md' && 'px-3 py-1 text-sm',
                size === 'lg' && 'px-4 py-1.5 text-base',

                className
            )}
            {...props}
        >
            {children}
        </span>
    );
};
