/**
 * Form Field Component
 * Reusable form field wrapper with label, input, and error state
 * Provides consistent styling across all settings forms
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export function FormField({
  label,
  required = false,
  error,
  description,
  children,
  htmlFor,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <label htmlFor={htmlFor} className="block text-sm font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {/* Input/Content */}
      {children}

      {/* Description */}
      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <span>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
