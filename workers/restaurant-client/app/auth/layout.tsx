'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';

/**
 * Auth Layout - Wraps auth pages with AuthProvider
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    );
}
