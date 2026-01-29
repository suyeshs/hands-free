import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';

interface IdleTimeoutOptions {
  timeoutMinutes?: number;
  checkIntervalSeconds?: number;
  onTimeout?: () => void;
}

/**
 * Hook to handle idle session timeout
 * Automatically logs out user after period of inactivity
 */
export function useIdleTimeout(options: IdleTimeoutOptions = {}) {
  const {
    timeoutMinutes = 30, // Default 30 minutes
    checkIntervalSeconds = 60, // Check every minute
    onTimeout,
  } = options;

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced activity update
  const updateActivity = useRef(
    debounce(async () => {
      try {
        await invoke('update_last_activity');
      } catch (error) {
        console.error('[IdleTimeout] Failed to update activity:', error);
      }
    }, 1000)
  );

  useEffect(() => {
    if (!user) {
      // Clear timers if no user is logged in
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      return;
    }

    // Track user activity
    const handleActivity = () => {
      updateActivity.current();
    };

    // Listen to various user activity events
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check for idle timeout periodically
    checkIntervalRef.current = setInterval(async () => {
      try {
        const timedOut = await invoke<boolean>('check_idle_timeout', {
          timeoutMinutes,
        });

        if (timedOut) {
          console.log('[IdleTimeout] Session timed out');

          // Clear interval immediately
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }

          // Trigger callback if provided
          if (onTimeout) {
            onTimeout();
          }

          // Logout locally
          await logout();
        }
      } catch (error) {
        console.error('[IdleTimeout] Failed to check timeout:', error);
      }
    }, checkIntervalSeconds * 1000);

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }

      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [user, timeoutMinutes, checkIntervalSeconds, onTimeout, logout]);
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
