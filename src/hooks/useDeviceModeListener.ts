import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'react-hot-toast';

interface DeviceModeChangePayload {
  previousMode: string;
  newMode: string;
  featuresUpdated: Record<string, boolean>;
  userPreferenceApplied: boolean;
}

interface UserLogoutPayload {
  userId: string;
  reason: 'manual' | 'timeout' | 'forced';
}

/**
 * Hook to listen for device mode changes and handle UI updates
 */
export function useDeviceModeListener() {
  useEffect(() => {
    // Listen for device mode changes
    const modeChangedUnlisten = listen<DeviceModeChangePayload>(
      'device-mode-changed',
      (event) => {
        const { previousMode, newMode } = event.payload;

        console.log('[DeviceModeListener] Mode changed:', previousMode, '→', newMode);

        // Show notification to user
        const modeNames: Record<string, string> = {
          pos: 'Point of Sale',
          kds: 'Kitchen Display',
          bds: 'Bar Display',
          mobile: 'Mobile',
          server: 'Server',
        };

        const message = `Device switched to ${modeNames[newMode] || newMode.toUpperCase()} mode`;
        toast.success(message, {
          duration: 4000,
          icon: '🔄',
        });

        // Optionally reload page or refresh components
        // This could be replaced with more granular state updates
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    );

    // Listen for user logout events
    const logoutUnlisten = listen<UserLogoutPayload>(
      'user-logged-out',
      (event) => {
        const { reason } = event.payload;

        console.log('[DeviceModeListener] User logged out:', reason);

        if (reason === 'timeout') {
          toast.error('Session expired due to inactivity', {
            duration: 5000,
            icon: '⏱️',
          });
        }
      }
    );

    // Cleanup listeners
    return () => {
      modeChangedUnlisten.then((unlisten) => unlisten());
      logoutUnlisten.then((unlisten) => unlisten());
    };
  }, []);
}
