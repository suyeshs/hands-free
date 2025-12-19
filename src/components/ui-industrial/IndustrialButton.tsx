import React from 'react';
import { cn } from '../../lib/utils';

interface IndustrialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  active?: boolean;
}

export const IndustrialButton = React.forwardRef<HTMLButtonElement, IndustrialButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, active = false, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'font-bold uppercase tracking-wider transition-all duration-100 active:scale-[0.98] border-2 focus:outline-none focus:ring-4 focus:ring-opacity-50',
          // Base sizes
          size === 'sm' && 'px-3 py-1.5 text-xs',
          size === 'md' && 'px-5 py-3 text-sm',
          size === 'lg' && 'px-8 py-4 text-base',
          size === 'xl' && 'px-10 py-6 text-xl',
          
          // Width
          fullWidth && 'w-full',
          
          // Variants
          variant === 'primary' && 'bg-slate-800 text-white border-slate-900 hover:bg-slate-700 active:bg-slate-900 focus:ring-slate-500',
          variant === 'secondary' && 'bg-gray-200 text-gray-900 border-gray-400 hover:bg-gray-300 active:bg-gray-400 focus:ring-gray-400',
          variant === 'danger' && 'bg-red-600 text-white border-red-800 hover:bg-red-500 active:bg-red-800 focus:ring-red-500',
          variant === 'success' && 'bg-green-600 text-white border-green-800 hover:bg-green-500 active:bg-green-800 focus:ring-green-500',
          variant === 'warning' && 'bg-yellow-500 text-black border-yellow-700 hover:bg-yellow-400 active:bg-yellow-600 focus:ring-yellow-500',
          variant === 'ghost' && 'bg-transparent text-gray-600 border-transparent hover:bg-gray-100 hover:border-gray-200',
          
          // Active state for toggles
          active && 'ring-4 ring-offset-2',
          active && variant === 'primary' && 'ring-slate-500',
          
          // Disabled
          props.disabled && 'opacity-50 cursor-not-allowed pointer-events-none grayscale',
          
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IndustrialButton.displayName = 'IndustrialButton';
