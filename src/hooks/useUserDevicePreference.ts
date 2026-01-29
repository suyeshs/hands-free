import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UserDevicePreference {
  userId: string;
  userRole: string;
  preferredDeviceMode: string;
  lastLoginAt: number | null;
  loginCount: number;
}

export function useUserDevicePreference(userId: string | null) {
  const [preference, setPreference] = useState<UserDevicePreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPreference(null);
      setLoading(false);
      return;
    }

    loadPreference();
  }, [userId]);

  const loadPreference = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      const pref = await invoke<UserDevicePreference | null>(
        'get_user_device_preference',
        { userId }
      );
      setPreference(pref);
    } catch (err) {
      console.error('Failed to load user preference:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preference');
      setPreference(null);
    } finally {
      setLoading(false);
    }
  };

  const setPreferredMode = async (mode: string) => {
    if (!userId || !preference) {
      throw new Error('User ID or preference not available');
    }

    try {
      await invoke('set_user_device_preference', {
        userId,
        userRole: preference.userRole,
        preferredMode: mode,
      });
      await loadPreference();
    } catch (err) {
      console.error('Failed to set preference:', err);
      throw err;
    }
  };

  return {
    preference,
    loading,
    error,
    setPreferredMode,
    reload: loadPreference,
  };
}
