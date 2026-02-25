'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email?: string;
  currentTenantId?: string;
  tenants?: Array<{
    tenantId: string;
    companyName: string;
    role: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('[AuthContext] Checking auth with auth worker');

      // Check session with auth worker (cookies are sent automatically)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('[AuthContext] Local dev detected - bypassing auth worker CORS');
        setUser({
          id: 'dev-user',
          name: 'Developer',
          email: 'dev@stonepot.tech',
          currentTenantId: 'khao-piyo-7766'
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch('https://auth.handsfree.tech/auth/session', {
        credentials: 'include', // Important: Send cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json() as any;
      console.log('[AuthContext] Session check response:', data);

      if (response.ok && data.authenticated && data.user) {
        console.log('[AuthContext] User authenticated via auth worker');
        setUser(data.user);

        // Also update localStorage for backward compatibility
        localStorage.setItem('admin_user', JSON.stringify(data.user));
      } else {
        console.log('[AuthContext] Not authenticated');
        setUser(null);

        // Clear localStorage
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_refresh_token');
        localStorage.removeItem('admin_user');
      }
    } catch (error) {
      console.error('[AuthContext] Check auth error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    console.log('[AuthContext] Login with tokens:', userData);

    // Store tokens and user data in localStorage
    localStorage.setItem('admin_access_token', accessToken);
    localStorage.setItem('admin_refresh_token', refreshToken);
    localStorage.setItem('admin_user', JSON.stringify(userData));

    setUser(userData);
  };

  const logout = async () => {
    console.log('[AuthContext] Logout - calling auth worker');

    try {
      // Call auth worker logout endpoint to clear cookies
      await fetch('https://auth.handsfree.tech/auth/logout', {
        method: 'POST',
        credentials: 'include', // Important: Send cookies to be cleared
      });

      console.log('[AuthContext] Logout successful, cookies cleared');
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    } finally {
      // Clear localStorage
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('admin_user');

      setUser(null);
      router.push('/auth/login');
    }
  };

  const getAccessToken = (): string | null => {
    return localStorage.getItem('admin_access_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
