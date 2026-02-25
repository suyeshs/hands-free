'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin User Interface
 */
export interface AdminUser {
  id: string;
  currentTenantId: string;
  currentRole: 'owner' | 'manager' | 'staff' | null;
  tenants: Array<{
    tenantId: string;
    companyName: string;
    role: 'owner' | 'manager' | 'staff';
  }>;
}

/**
 * Auth Context Value
 */
interface AuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phoneNumber: string, code: string, verificationSid: string) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  /**
   * Check current session
   */
  const checkSession = async () => {
    try {
      // Check session with auth worker (cookies are sent automatically)
      const response = await fetch('https://auth.handsfree.tech/auth/session', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json() as any;
        if (data.authenticated && data.user) {
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[AuthProvider] Session check error:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login with phone verification
   */
  const login = async (phoneNumber: string, code: string, verificationSid: string) => {
    // Get tenant ID from current hostname
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const tenantId = parts.length >= 3 ? parts[0] : 'demo';

    const response = await fetch('/api/auth/admin/login/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        phoneNumber,
        code,
        verificationSid,
        tenantId
      })
    });

    if (!response.ok) {
      const data = await response.json() as any;
      throw new Error(data.error || 'Login failed');
    }

    const data = await response.json() as any;
    if (data.success && data.user) {
      setUser(data.user);
      setIsAuthenticated(true);
    }
  };

  /**
   * Logout and clear session
   */
  const logout = async () => {
    try {
      // Call auth worker logout endpoint to clear cookies
      await fetch('https://auth.handsfree.tech/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      setUser(null);
      setIsAuthenticated(false);
      router.push('/auth/login');
    } catch (error) {
      console.error('[AuthProvider] Logout error:', error);
      // Force redirect even if API fails
      setUser(null);
      setIsAuthenticated(false);
      router.push('/auth/login');
    }
  };

  /**
   * Switch to another tenant
   */
  const switchTenant = async (targetTenantId: string) => {
    try {
      const response = await fetch('/api/auth/admin/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetTenantId })
      });

      if (!response.ok) {
        throw new Error('Failed to switch tenant');
      }

      const data = await response.json() as any;
      if (data.success && data.redirectUrl) {
        // Redirect to new tenant subdomain
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      console.error('[AuthProvider] Switch tenant error:', error);
      throw error;
    }
  };

  /**
   * Refresh session (check for updates)
   */
  const refreshSession = async () => {
    await checkSession();
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    switchTenant,
    refreshSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAdminAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AuthProvider');
  }
  return context;
}
