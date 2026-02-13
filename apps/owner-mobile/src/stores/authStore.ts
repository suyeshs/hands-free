import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TenantData {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  apiUrl: string;
}

interface UserData {
  id: string;
  phone: string;
  email?: string;
  role: string;
  tenantId: string;
  tenantName: string;
  subdomain: string;
}

interface AuthState {
  isAuthenticated: boolean;
  sessionToken: string | null;
  deviceToken: string | null;
  user: UserData | null;
  tenant: TenantData | null;

  // Actions
  setTenant: (tenant: TenantData) => void;
  setAuth: (sessionToken: string, deviceToken: string, user: UserData, tenant: TenantData) => void;
  setSessionToken: (sessionToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      sessionToken: null,
      deviceToken: null,
      user: null,
      tenant: null,

      setTenant: (tenant) => set({ tenant }),

      setAuth: (sessionToken, deviceToken, user, tenant) =>
        set({
          isAuthenticated: true,
          sessionToken,
          deviceToken,
          user,
          tenant,
        }),

      setSessionToken: (sessionToken) => set({ sessionToken }),

      logout: () => {
        // Clear device token on logout
        localStorage.removeItem('deviceToken');
        set({
          isAuthenticated: false,
          sessionToken: null,
          deviceToken: null,
          user: null,
          tenant: null,
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
