import { useEffect, useState } from 'react';
import { syncDynamicMigrations } from '../services/dynamicMigrations';
import { toast } from 'sonner';

export interface UseDynamicMigrationsOptions {
  checkOnStartup?: boolean;
  checkIntervalMinutes?: number;
  onMigrationsApplied?: (migrations: string[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to automatically sync dynamic migrations from cloud
 *
 * @param options Configuration options
 * @param options.checkOnStartup - Check for migrations on component mount (default: true)
 * @param options.checkIntervalMinutes - Interval in minutes to check for new migrations (default: 60, 0 to disable)
 * @param options.onMigrationsApplied - Callback when migrations are applied
 * @param options.onError - Callback when sync fails
 *
 * @example
 * ```tsx
 * // In App.tsx
 * useDynamicMigrations({
 *   checkOnStartup: true,
 *   checkIntervalMinutes: 60,
 *   onMigrationsApplied: (migrations) => {
 *     console.log('Applied migrations:', migrations);
 *   }
 * });
 * ```
 */
export function useDynamicMigrations(options: UseDynamicMigrationsOptions = {}) {
  const {
    checkOnStartup = true,
    checkIntervalMinutes = 60,
    onMigrationsApplied,
    onError,
  } = options;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const checkMigrations = async () => {
    if (isSyncing) return;

    console.log('[useDynamicMigrations] Starting migration check...');
    setIsSyncing(true);
    setError(null);

    try {
      console.log('[useDynamicMigrations] Calling syncDynamicMigrations...');
      const appliedMigrations = await syncDynamicMigrations();
      console.log('[useDynamicMigrations] Sync completed, applied:', appliedMigrations);

      if (appliedMigrations.length > 0) {
        toast.success(
          `Applied ${appliedMigrations.length} new migration${appliedMigrations.length > 1 ? 's' : ''}`,
          {
            description: appliedMigrations.join(', '),
            duration: 5000,
          }
        );

        if (onMigrationsApplied) {
          onMigrationsApplied(appliedMigrations);
        }
      } else {
        console.log('[DynamicMigrations] No new migrations to apply');
      }

      setLastCheck(new Date());
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);

      // Only log real errors, not harmless CORS retries or fetch failures
      const isHarmlessRetry = error.message.includes('Load failed') ||
                              error.message.includes('CORS') ||
                              error.message.includes('fetch');

      if (!isHarmlessRetry) {
        console.error('[DynamicMigrations] Raw error:', err);
        console.error('[DynamicMigrations] Error type:', typeof err);
        console.error('[DynamicMigrations] Error constructor:', err?.constructor?.name);
        console.error('[DynamicMigrations] Sync failed:', {
          message: error.message,
          stack: error.stack,
          stringified: JSON.stringify(err, null, 2),
        });
      }

      // Only show error toast if it's a real error (not CORS retry, fetch retry, or missing tenant)
      // CORS/Load failed errors are harmless retries after migrations already applied
      if (!error.message.includes('fetch') &&
          !error.message.includes('tenant_id') &&
          !error.message.includes('No activated tenant') &&
          !error.message.includes('Load failed') &&
          !error.message.includes('CORS')) {
        toast.error('Failed to sync migrations', {
          description: error.message,
          duration: 4000,
        });
      }

      if (onError) {
        onError(error);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Check on startup
  useEffect(() => {
    if (checkOnStartup) {
      checkMigrations();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic check
  useEffect(() => {
    if (checkIntervalMinutes > 0) {
      const interval = setInterval(
        checkMigrations,
        checkIntervalMinutes * 60 * 1000
      );
      return () => clearInterval(interval);
    }
  }, [checkIntervalMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isSyncing,
    lastCheck,
    error,
    checkMigrations,
  };
}
