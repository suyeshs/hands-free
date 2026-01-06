/**
 * Theme Hook
 * Reads theme preference from restaurantSettingsStore and applies to DOM
 * Supports dark and light modes with automatic DOM class management
 */

import { useEffect, useCallback } from 'react';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const settings = useRestaurantSettingsStore((state) => state.settings);
  const updateSettings = useRestaurantSettingsStore((state) => state.updateSettings);

  // Default to dark mode if not set
  const theme: Theme = settings.posSettings?.theme ?? 'dark';

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Also set color-scheme for native elements (scrollbars, form controls)
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    updateSettings({
      posSettings: {
        ...settings.posSettings,
        theme: newTheme,
      },
    });
  }, [settings.posSettings, updateSettings]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };
}
