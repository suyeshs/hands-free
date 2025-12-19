import React from 'react';
import { cn } from '../../lib/utils';

interface IndustrialInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const IndustrialInput = React.forwardRef<HTMLInputElement, IndustrialInputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-bold uppercase tracking-wider text-gray-700 mb-1">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        'w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 focus:bg-white focus:border-slate-800 focus:outline-none transition-colors text-lg font-medium placeholder:text-gray-400',
                        error && 'border-red-500 bg-red-50 focus:border-red-600 focus:bg-white',
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm font-bold text-red-600">{error}</p>
                )}
            </div>
        );
    }
);

IndustrialInput.displayName = 'IndustrialInput';
