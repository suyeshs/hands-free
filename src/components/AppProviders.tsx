import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { useDeviceModeListener } from '../hooks/useDeviceModeListener';

interface AppProvidersProps {
  children: ReactNode;
  idleTimeoutMinutes?: number;
}

/**
 * Global App Providers
 *
 * Wraps the app with essential providers and hooks:
 * - Idle timeout monitoring
 * - Device mode change listener
 * - Toast notifications
 */
export function AppProviders({
  children,
  idleTimeoutMinutes = 30,
}: AppProvidersProps) {
  // Monitor for idle session timeout
  useIdleTimeout({
    timeoutMinutes: idleTimeoutMinutes,
    checkIntervalSeconds: 60, // Check every minute
    onTimeout: () => {
      console.log('[AppProviders] Session timed out due to inactivity');
    },
  });

  // Listen for device mode changes
  useDeviceModeListener();

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}
