import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { DEFAULT_TENANT_ID } from '../lib/appConfig';
import { UserRole } from '../types/auth';

interface LoginProps {
  onSuccess: () => void;
}

export function Login({ onSuccess }: LoginProps) {
  // Auto-login: Skip authentication entirely and go straight to hub
  useEffect(() => {
    console.log('[Login] Auto-login bypass - setting mock authentication');

    // Set mock authentication to satisfy app routing checks
    const mockUser = {
      id: 'auto-login-user',
      tenantId: DEFAULT_TENANT_ID || 'default-tenant',
      email: 'auto@login.local',
      role: UserRole.MANAGER,
    };

    const mockTokens = {
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
    };

    useAuthStore.setState({
      user: mockUser,
      tokens: mockTokens,
      role: UserRole.MANAGER,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    console.log('[Login] Authentication set, calling onSuccess');
    onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return null; // Component immediately calls onSuccess() and navigates away
}
