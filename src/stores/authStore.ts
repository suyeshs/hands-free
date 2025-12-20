/**
 * Authentication Store
 * Manages user authentication and role-based access
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  User,
  UserRole,
  AuthTokens,
  LoginCredentials,
  PinLoginCredentials,
  rolePermissions,
} from '../types/auth';
import { backendApi } from '../lib/backendApi';

interface AuthStore {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions - Authentication
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithPin: (credentials: PinLoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  autoLogin: () => void;

  // Actions - User management
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  switchRole: (role: UserRole) => void;

  // Actions - Loading & Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  hasPermission: (permission: keyof typeof rolePermissions[UserRole]) => boolean;
  isTokenValid: () => boolean;
  getTenantId: () => string | null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: {
        id: 'default-manager',
        email: 'manager@khaopiyo.com',
        name: 'Khao Piyo Manager',
        role: UserRole.MANAGER,
        tenantId: 'Khao-pioy',
      },
      tokens: {
        accessToken: 'bypass-token',
        refreshToken: 'bypass-refresh',
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      },
      role: UserRole.MANAGER,
      isAuthenticated: true,
      isLoading: false,
      error: null,

      // Authentication
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          console.log('[AuthStore] Login:', credentials.email);

          // Call backend API
          const { user, tokens } = await backendApi.login(credentials);

          set({
            user,
            tokens,
            role: user.role,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('[AuthStore] Login successful:', user.email, user.role);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Login failed';
          console.error('[AuthStore] Login failed:', message);
          set({
            error: message,
            isLoading: false,
            isAuthenticated: false,
            user: null,
            tokens: null,
            role: null,
          });
          throw error;
        }
      },

      loginWithPin: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          console.log('[AuthStore] PIN Login for tenant:', credentials.tenantId);

          // Call backend API
          const { user, tokens } = await backendApi.loginWithPin(credentials);

          set({
            user,
            tokens,
            role: user.role,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('[AuthStore] PIN login successful:', user.role);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'PIN login failed';
          console.error('[AuthStore] PIN login failed:', message);
          set({
            error: message,
            isLoading: false,
            isAuthenticated: false,
            user: null,
            tokens: null,
            role: null,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          // Call backend API to invalidate token
          await backendApi.logout();
          console.log('[AuthStore] Logout successful');
        } catch (error) {
          console.error('[AuthStore] Logout API call failed:', error);
          // Continue with local logout anyway
        }

        // Clear local state
        set({
          user: null,
          tokens: null,
          role: null,
          isAuthenticated: false,
          error: null,
        });
      },

      refreshToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          console.log('[AuthStore] Refreshing token...');

          // Call backend API
          const { tokens: newTokens } = await backendApi.refreshToken(tokens.refreshToken);

          set({ tokens: newTokens });

          console.log('[AuthStore] Token refreshed successfully');
        } catch (error) {
          console.error('[AuthStore] Token refresh failed:', error);
          // If refresh fails, logout
          get().logout();
          throw error;
        }
      },

      autoLogin: () => {
        // Auto-login for testing (bypasses authentication)
        const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
        const tenantId = import.meta.env.VITE_DEFAULT_TENANT_ID || 'resttest2020';

        if (skipAuth) {
          console.log('[AuthStore] Auto-login enabled for testing with tenantId:', tenantId);

          const mockUser: User = {
            id: 'test-user-1',
            email: 'test@restaurant.com',
            name: 'Test User',
            role: UserRole.MANAGER,
            tenantId: tenantId,
          };

          const mockTokens: AuthTokens = {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          };

          set({
            user: mockUser,
            tokens: mockTokens,
            role: UserRole.MANAGER,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('[AuthStore] Auto-login successful - all permissions granted');
        }
      },

      // User management
      setUser: (user) => set({ user, role: user?.role || null }),
      setTokens: (tokens) => set({ tokens }),

      switchRole: (role) => {
        const { user } = get();
        if (user) {
          set({ role, user: { ...user, role } });
        }
      },

      // Loading & Error
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Computed
      hasPermission: (permission) => {
        const { role } = get();
        if (!role) return false;
        return rolePermissions[role][permission];
      },

      isTokenValid: () => {
        const { tokens } = get();
        if (!tokens) return false;
        return Date.now() < tokens.expiresAt;
      },

      getTenantId: () => {
        return 'Khao-pioy';
      },
    }),
    {
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        tokens: state.tokens,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
