import { useState, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';

interface FeatureGuardProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUnauthorized?: boolean;
}

/**
 * Feature Guard Component with Backend Enforcement
 *
 * Verifies user has permission for a feature by checking with backend.
 * This prevents bypassing frontend-only permission checks.
 */
export function FeatureGuard({
  feature,
  children,
  fallback = null,
  showUnauthorized = false,
}: FeatureGuardProps) {
  const user = useAuthStore((state) => state.user);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    checkPermission();
  }, [user?.id, feature]);

  const checkPermission = async () => {
    if (!user) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Backend verification - prevents frontend bypass
      const permitted = await invoke<boolean>('verify_feature_permission', {
        userId: user.id,
        feature,
      });

      setHasPermission(permitted);
    } catch (error) {
      console.error(`[FeatureGuard] Failed to verify permission for ${feature}:`, error);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Or a loading spinner
  }

  if (!hasPermission) {
    if (showUnauthorized) {
      return (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-sm text-gray-600">
            You don't have permission to access this feature.
          </p>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook to check feature permission programmatically
 */
export function useFeaturePermission(feature: string): {
  hasPermission: boolean;
  loading: boolean;
  checkPermission: () => Promise<void>;
} {
  const user = useAuthStore((state) => state.user);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, [user?.id, feature]);

  const checkPermission = async () => {
    if (!user) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const permitted = await invoke<boolean>('verify_feature_permission', {
        userId: user.id,
        feature,
      });
      setHasPermission(permitted);
    } catch (error) {
      console.error(`Failed to verify permission for ${feature}:`, error);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  return { hasPermission, loading, checkPermission };
}
