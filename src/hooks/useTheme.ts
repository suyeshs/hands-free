/**
 * Theme Hook
 * Integrates with the new Theme Plugin System
 * Supports screen-specific overrides and modern theme management
 */

import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { themeManager } from '@/services/themes/themeManager';
import type { ScreenType, ThemeMode } from '@/types/theme';

// Legacy type for backward compatibility
export type Theme = 'dark' | 'light';

/**
 * Detect screen type from current route
 */
function detectScreenType(pathname: string): ScreenType {
  if (pathname.startsWith('/kds')) return 'kds';
  if (pathname.startsWith('/pos')) return 'pos';
  if (pathname.startsWith('/reports') || pathname.startsWith('/analytics')) return 'reports';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/table-ordering')) return 'table-ordering';
  if (pathname.startsWith('/service-status')) return 'service-status';
  return 'global';
}

/**
 * Main theme hook
 * Automatically applies theme based on current route and screen type
 */
export function useTheme() {
  const location = useLocation();

  const {
    activeThemeId,
    themeMode,
    brightness,
    customVariables,
    screenOverrides,
    setThemeMode,
  } = useThemeStore();

  // Detect current screen type from route
  const screenType = detectScreenType(location.pathname);

  // Apply theme when dependencies change
  useEffect(() => {
    const loadAndApplyTheme = async () => {
      if (!activeThemeId) {
        console.warn('[useTheme] No active theme ID');
        return;
      }

      try {
        // Load theme from cache or download
        const theme = await themeManager.loadTheme(activeThemeId);

        // Get screen-specific override if exists
        const screenOverride = screenOverrides[screenType];

        // Apply theme with all options
        themeManager.applyTheme(theme, {
          mode: themeMode,
          screenType,
          brightness,
          screenOverride,
          customVariables,
        });

        console.log(`[useTheme] Applied theme ${activeThemeId} for screen ${screenType}`);
      } catch (error) {
        console.error('[useTheme] Error applying theme:', error);
      }
    };

    loadAndApplyTheme();
  }, [
    activeThemeId,
    themeMode,
    screenType,
    brightness,
    customVariables,
    screenOverrides,
    location.pathname,
  ]);

  // Legacy setTheme function (maps to new theme mode)
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeMode(newTheme as ThemeMode);
  }, [setThemeMode]);

  // Legacy toggleTheme function
  const toggleTheme = useCallback(() => {
    const currentMode = themeMode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : themeMode;
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
  }, [themeMode, setThemeMode]);

  // Resolve effective theme mode (handle 'auto')
  const effectiveMode = themeMode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;

  return {
    // Legacy API (for backward compatibility)
    theme: effectiveMode as Theme,
    setTheme,
    toggleTheme,
    isDark: effectiveMode === 'dark',

    // New API
    themeMode,
    setThemeMode,
    screenType,
    activeThemeId,
    currentTheme: activeThemeId,
  };
}

/**
 * Hook for listening to system dark mode preference changes
 */
export function useSystemTheme() {
  const { setThemeMode, themeMode } = useThemeStore();

  useEffect(() => {
    // Only listen if mode is 'auto'
    if (themeMode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      console.log(`[useSystemTheme] System preference changed to ${e.matches ? 'dark' : 'light'}`);
      // The theme will automatically update via useTheme hook
      // We don't need to do anything here since themeMode is still 'auto'
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [themeMode, setThemeMode]);
}
