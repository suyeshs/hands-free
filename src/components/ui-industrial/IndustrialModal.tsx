import React, { useEffect } from 'react';
import { IndustrialCard } from './IndustrialCard';
import { cn } from '../../lib/utils';

interface IndustrialModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}

export function IndustrialModal({
    open,
    onClose,
    title,
    children,
    size = 'md',
    className,
}: IndustrialModalProps) {

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={cn(
                    'relative w-full transform transition-all',
                    size === 'sm' && 'max-w-md',
                    size === 'md' && 'max-w-xl',
                    size === 'lg' && 'max-w-3xl',
                    size === 'xl' && 'max-w-5xl',
                    size === 'full' && 'max-w-[95vw]',
                    className
                )}
            >
                <IndustrialCard variant="raised" padding="none" className="bg-white text-left overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-slate-800 p-4 border-b-4 border-slate-900 flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase tracking-wider text-white">
                            {title}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-red-400 font-black text-2xl px-2 leading-none"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 max-h-[85vh] overflow-y-auto">
                        {children}
                    </div>
                </IndustrialCard>
            </div>
        </div>
    );
}
