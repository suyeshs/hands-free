/**
 * Hook to detect if current tenant is a location (vs master)
 * Uses the is_location flag from restaurant_settings
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface LocationMetadata {
  isLocation: boolean;
  locationGroupId?: string;
  masterTenantId?: string;
  currentLocationName?: string;
  chainSyncEnabled?: boolean;
}

export function useIsLocationTenant(): {
  isLocation: boolean;
  locationMetadata: LocationMetadata | null;
  loading: boolean;
  error: string | null;
} {
  const [isLocation, setIsLocation] = useState(false);
  const [locationMetadata, setLocationMetadata] = useState<LocationMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkLocationStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get location metadata from restaurant_settings
        const result = await invoke<{
          is_location: number;
          location_group_id?: string;
          master_tenant_id?: string;
          current_location_name?: string;
          chain_sync_enabled?: number;
        }>('get_restaurant_settings_location_info');

        if (!mounted) return;

        const isLoc = result.is_location === 1;
        setIsLocation(isLoc);

        if (isLoc) {
          setLocationMetadata({
            isLocation: true,
            locationGroupId: result.location_group_id,
            masterTenantId: result.master_tenant_id,
            currentLocationName: result.current_location_name,
            chainSyncEnabled: result.chain_sync_enabled === 1,
          });
        } else {
          setLocationMetadata({
            isLocation: false,
          });
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[useIsLocationTenant] Error checking location status:', err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLocation(false);
        setLocationMetadata(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkLocationStatus();

    // Listen for tenant switches
    const handleTenantSwitch = () => {
      console.log('[useIsLocationTenant] Tenant switched, rechecking location status');
      checkLocationStatus();
    };

    window.addEventListener('tenant-switched', handleTenantSwitch);

    return () => {
      mounted = false;
      window.removeEventListener('tenant-switched', handleTenantSwitch);
    };
  }, []);

  return { isLocation, locationMetadata, loading, error };
}
