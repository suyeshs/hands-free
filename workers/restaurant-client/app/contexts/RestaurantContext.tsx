/**
 * Restaurant Config Context - Provides restaurant profile to all components
 */

'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { RestaurantProfile } from '../types/restaurant';
import { fetchRestaurantProfileClient, getTenantId } from '../lib/restaurant-config-loader';

interface RestaurantContextValue {
  profile: RestaurantProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: (tenantId?: string) => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within RestaurantProvider');
  }
  return context;
}

interface RestaurantProviderProps {
  children: ReactNode;
  initialProfile: RestaurantProfile | null;
}

export function RestaurantProvider({ children, initialProfile }: RestaurantProviderProps) {
  const [profile, setProfile] = useState<RestaurantProfile | null>(initialProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async (tenantId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Use provided tenantId or fallback to current profile's tenantId
      const targetTenantId = tenantId || profile?.tenantId;
      const newProfile = await fetchRestaurantProfileClient(targetTenantId);

      if (newProfile) {
        setProfile(newProfile);
      } else {
        setError('Restaurant profile not found');
      }
    } catch (err) {
      console.error('[RestaurantContext] Failed to fetch profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply brand color to CSS variables when profile changes
  useEffect(() => {
    if (profile?.brandIdentity?.primaryColor) {
      document.documentElement.style.setProperty(
        '--color-brand-primary',
        profile.brandIdentity.primaryColor
      );
      // Also update legacy neumorphic variables
      document.documentElement.style.setProperty(
        '--neu-accent',
        profile.brandIdentity.primaryColor
      );
    }
  }, [profile]);

  const value: RestaurantContextValue = {
    profile,
    isLoading,
    error,
    refetch,
  };

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}
