/**
 * GlassModal Component
 * Glass overlay for modals and dropdowns
 */

import { forwardRef, HTMLAttributes, useEffect } from 'react';
import { cn } from '../../lib/utils';

export interface GlassModalProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose?: () => void;
  /** Whether clicking outside closes the modal */
  closeOnOutsideClick?: boolean;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Title of the modal */
  title?: string;
  /** Size of the modal */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const GlassModal = forwardRef<HTMLDivElement, GlassModalProps>(
  (
    {
      className,
      open,
      onClose,
      closeOnOutsideClick = true,
      showCloseButton = true,
      title,
      size = 'md',
      children,
      ...props
    },
    ref
  ) => {
    // Handle escape key
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && open && onClose) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }

      return () => {
        document.body.style.overflow = '';
      };
    }, [open]);

    if (!open) return null;

    const sizeClasses = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      full: 'max-w-[90vw]',
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={closeOnOutsideClick ? onClose : undefined}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 glass-overlay" />

        {/* Modal content */}
        <div
          ref={ref}
          className={cn(
            'glass-panel relative w-full p-6 animate-in fade-in zoom-in-95 duration-200',
            sizeClasses[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between mb-4">
              {title && (
                <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              )}
              {showCloseButton && onClose && (
                <button
                  onClick={onClose}
                  className="neo-raised-sm h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-neo"
                  aria-label="Close modal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div>{children}</div>
        </div>
      </div>
    );
  }
);

GlassModal.displayName = 'GlassModal';

export { GlassModal };
