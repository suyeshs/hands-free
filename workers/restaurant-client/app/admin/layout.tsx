'use client';

import { ReactNode, useEffect } from 'react';
import './admin.css';
import { Outfit } from 'next/font/google';
import { AuthProvider, useAdminAuth } from '@/components/auth/AuthProvider';
import { SetupProvider } from '../contexts/SetupContext';
import TenantSwitcher from '@/components/admin/TenantSwitcher';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
});

/**
 * Admin Navigation Component
 */
function AdminNav() {
  const { user, logout, isLoading } = useAdminAuth();

  if (isLoading) {
    return null; // Don't show nav while loading
  }

  return (
    <nav className="sticky top-0 z-50 bg-[rgba(26,15,11,0.8)] backdrop-blur-md border-b border-[rgba(232,185,35,0.15)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-[#FFF8F0]">Admin Panel</span>
            </div>
          </div>

          {/* Right: User Info & Actions */}
          {user && (
            <div className="flex items-center space-x-4">
              {/* Tenant Switcher */}
              <TenantSwitcher />

              {/* Logout Button */}
              <button
                onClick={logout}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-[rgba(255,248,240,0.05)] hover:bg-[rgba(255,248,240,0.1)] border border-[rgba(232,185,35,0.15)] transition-colors"
              >
                <svg className="h-4 w-4 text-[rgba(255,248,240,0.7)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm text-[rgba(255,248,240,0.7)]">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

/**
 * Admin Layout Inner Component (with auth context)
 */
function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAdminAuth();

  useEffect(() => {
    // Override restaurant theme with admin glassmorphic theme
    const styleElement = document.getElementById('theme-variables');
    if (styleElement) {
      styleElement.innerHTML = `
        :root {
          /* Admin theme - warm glassmorphic dark mode */
          --color-bg-main: #1A0F0B;
          --color-bg-surface: #1A0F0B;
          --color-bg-elevated: rgba(255, 248, 240, 0.05);
          --color-text-primary: #FFF8F0;
          --color-text-secondary: rgba(255, 248, 240, 0.7);
          --color-primary-500: #F28C38;
          --color-primary-600: #D9453E;
          --color-accent-500: #E8B923;

          /* Warm glassmorphic colors */
          --warm-white: #FFF8F0;
          --warm-charcoal: #1A0F0B;
          --warm-darker: #120907;
          --warm-border: rgba(232, 185, 35, 0.15);
          --saffron: #F28C38;
          --saffron-glow: rgba(242, 140, 56, 0.4);
          --paprika: #D9453E;
          --honey: #E8B923;
        }
      `;
    }

    // Set dark background
    document.body.style.background = '#1A0F0B';
    document.body.style.color = '#FFF8F0';
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A0F0B]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="text-[rgba(255,248,240,0.7)] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // User not authenticated (middleware should have redirected, but double-check)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A0F0B]">
        <div className="text-center">
          <p className="text-[rgba(255,248,240,0.7)] text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <SetupProvider>
      <div className={`admin-container ${outfit.variable} min-h-screen`}>
        <AdminNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </SetupProvider>
  );
}

/**
 * Admin Layout (with AuthProvider wrapper)
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AuthProvider>
  );
}
