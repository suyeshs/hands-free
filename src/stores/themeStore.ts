/**
 * Theme Store
 * Zustand store for managing theme state and actions
 * Handles theme installation, activation, mode switching, and screen overrides
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ThemeStoreState,
  InstalledTheme,
  ThemeMode,
  ScreenType,
} from '@/types/theme';
import { themeManager } from '@/services/themes/themeManager';
import { initDatabase } from '@/lib/database';
import { useTenantStore } from './tenantStore';

interface ThemeStore extends ThemeStoreState {}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // Initial state
      installedThemes: [],
      activeThemeId: null,
      themeMode: 'auto',
      brightness: 0,
      customVariables: {},
      screenOverrides: {
        global: {},
        kds: {},
        pos: {},
        reports: {},
        settings: {},
      },
      isPreviewMode: false,
      previewThemeId: null,

      /**
       * Load installed themes from database
       */
      loadInstalledThemes: async () => {
        try {
          const db = await initDatabase();
          const tenantId = useTenantStore.getState().tenant?.id;

          if (!tenantId) {
            console.warn('[ThemeStore] No tenant ID available');
            return;
          }

          const result = await db.select<Array<{
            plugin_id: string;
            manifest: string;
            installed_at: string;
            enabled: number;
          }>>(
            `SELECT plugin_id, manifest, installed_at, enabled
             FROM plugin_metadata
             WHERE type = 'theme'`,
            []
          );

          const themes: InstalledTheme[] = result.map(row => {
            const manifest = JSON.parse(row.manifest);
            return {
              id: row.plugin_id,
              name: manifest.name,
              description: manifest.description,
              category: manifest.theme.category,
              previewUrl: manifest.theme.preview_url,
              installedAt: row.installed_at,
              version: manifest.version,
              enabled: row.enabled === 1,
            };
          });

          set({ installedThemes: themes });
          console.log(`[ThemeStore] Loaded ${themes.length} installed themes`);
        } catch (error) {
          console.error('[ThemeStore] Error loading installed themes:', error);
        }
      },

      /**
       * Install a theme from registry
       */
      installTheme: async (themeId: string) => {
        try {
          console.log(`[ThemeStore] Installing theme: ${themeId}`);

          // Load theme (will download and cache if not already cached)
          const theme = await themeManager.loadTheme(themeId);

          // Reload installed themes to update UI
          await get().loadInstalledThemes();

          console.log(`[ThemeStore] Theme ${themeId} installed successfully`);
        } catch (error) {
          console.error('[ThemeStore] Error installing theme:', error);
          throw error;
        }
      },

      /**
       * Uninstall a theme
       */
      uninstallTheme: async (themeId: string) => {
        try {
          const db = await initDatabase();

          // Remove from plugin_metadata
          await db.execute(
            'DELETE FROM plugin_metadata WHERE plugin_id = ? AND type = ?',
            [themeId, 'theme']
          );

          // Remove from theme_cache
          await db.execute(
            'DELETE FROM theme_cache WHERE theme_id = ?',
            [themeId]
          );

          // If this was the active theme, switch to default
          if (get().activeThemeId === themeId) {
            await get().activateTheme('handsfree-default');
          }

          // Reload installed themes
          await get().loadInstalledThemes();

          console.log(`[ThemeStore] Theme ${themeId} uninstalled successfully`);
        } catch (error) {
          console.error('[ThemeStore] Error uninstalling theme:', error);
          throw error;
        }
      },

      /**
       * Activate a theme
       */
      activateTheme: async (themeId: string) => {
        try {
          console.log(`[ThemeStore] Activating theme: ${themeId}`);

          const state = get();
          const tenantId = useTenantStore.getState().tenant?.id;

          if (!tenantId) {
            throw new Error('No tenant ID available');
          }

          // Load and apply theme
          const theme = await themeManager.loadTheme(themeId);
          themeManager.applyTheme(theme, {
            mode: state.themeMode,
            screenType: 'global',
            brightness: state.brightness,
            customVariables: state.customVariables,
          });

          // Save to database
          const db = await initDatabase();
          const now = new Date().toISOString();

          await db.execute(
            `INSERT OR REPLACE INTO tenant_theme_config
             (tenant_id, active_theme_id, theme_mode, custom_variables, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              tenantId,
              themeId,
              state.themeMode,
              JSON.stringify(state.customVariables),
              now,
            ]
          );

          set({ activeThemeId: themeId });

          console.log(`[ThemeStore] Theme ${themeId} activated successfully`);
        } catch (error) {
          console.error('[ThemeStore] Error activating theme:', error);
          throw error;
        }
      },

      /**
       * Set theme mode (light/dark/auto)
       */
      setThemeMode: (mode: ThemeMode) => {
        console.log(`[ThemeStore] Setting theme mode: ${mode}`);

        set({ themeMode: mode });

        // Reapply current theme with new mode
        const state = get();
        if (state.activeThemeId) {
          themeManager.loadTheme(state.activeThemeId).then(theme => {
            themeManager.applyTheme(theme, {
              mode,
              screenType: 'global',
              brightness: state.brightness,
              customVariables: state.customVariables,
            });
          });
        }

        // Save to database
        const tenantId = useTenantStore.getState().tenant?.id;
        if (tenantId) {
          getDatabase().then(db => {
            db.execute(
              'UPDATE tenant_theme_config SET theme_mode = ?, updated_at = ? WHERE tenant_id = ?',
              [mode, new Date().toISOString(), tenantId]
            );
          });
        }
      },

      /**
       * Set brightness level (0-100)
       */
      setBrightness: (level: number) => {
        console.log(`[ThemeStore] Setting brightness: ${level}`);

        set({ brightness: level });

        // Reapply current theme with new brightness
        const state = get();
        if (state.activeThemeId) {
          themeManager.loadTheme(state.activeThemeId).then(theme => {
            themeManager.applyTheme(theme, {
              mode: state.themeMode,
              screenType: 'global',
              brightness: level,
              customVariables: state.customVariables,
            });
          });
        }
      },

      /**
       * Update custom variable overrides
       */
      updateCustomVariables: (vars: Record<string, string>) => {
        console.log('[ThemeStore] Updating custom variables');

        set({ customVariables: vars });

        // Reapply current theme with new variables
        const state = get();
        if (state.activeThemeId) {
          themeManager.loadTheme(state.activeThemeId).then(theme => {
            themeManager.applyTheme(theme, {
              mode: state.themeMode,
              screenType: 'global',
              brightness: state.brightness,
              customVariables: vars,
            });
          });
        }

        // Save to database
        const tenantId = useTenantStore.getState().tenant?.id;
        if (tenantId) {
          getDatabase().then(db => {
            db.execute(
              'UPDATE tenant_theme_config SET custom_variables = ?, updated_at = ? WHERE tenant_id = ?',
              [JSON.stringify(vars), new Date().toISOString(), tenantId]
            );
          });
        }
      },

      /**
       * Set screen-specific override
       */
      setScreenOverride: async (screenType: ScreenType, vars: Record<string, string>) => {
        try {
          console.log(`[ThemeStore] Setting override for screen: ${screenType}`);

          const tenantId = useTenantStore.getState().tenant?.id;
          if (!tenantId) {
            throw new Error('No tenant ID available');
          }

          // Update state
          const state = get();
          const newOverrides = {
            ...state.screenOverrides,
            [screenType]: vars,
          };
          set({ screenOverrides: newOverrides });

          // Save to database
          const db = await initDatabase();
          const now = new Date().toISOString();

          await db.execute(
            `INSERT OR REPLACE INTO screen_theme_overrides
             (tenant_id, screen_type, override_variables, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [tenantId, screenType, JSON.stringify(vars), now, now]
          );

          console.log(`[ThemeStore] Screen override for ${screenType} saved`);
        } catch (error) {
          console.error('[ThemeStore] Error setting screen override:', error);
          throw error;
        }
      },

      /**
       * Remove screen-specific override
       */
      removeScreenOverride: async (screenType: ScreenType) => {
        try {
          console.log(`[ThemeStore] Removing override for screen: ${screenType}`);

          const tenantId = useTenantStore.getState().tenant?.id;
          if (!tenantId) {
            throw new Error('No tenant ID available');
          }

          // Update state
          const state = get();
          const newOverrides = {
            ...state.screenOverrides,
            [screenType]: {},
          };
          set({ screenOverrides: newOverrides });

          // Remove from database
          const db = await initDatabase();
          await db.execute(
            'DELETE FROM screen_theme_overrides WHERE tenant_id = ? AND screen_type = ?',
            [tenantId, screenType]
          );

          console.log(`[ThemeStore] Screen override for ${screenType} removed`);
        } catch (error) {
          console.error('[ThemeStore] Error removing screen override:', error);
          throw error;
        }
      },

      /**
       * Preview a theme (temporary, doesn't persist)
       */
      previewTheme: async (themeId: string) => {
        try {
          console.log(`[ThemeStore] Previewing theme: ${themeId}`);

          const state = get();

          // Store current state for rollback
          set({
            isPreviewMode: true,
            previewThemeId: themeId,
          });

          // Load and apply preview theme
          const theme = await themeManager.loadTheme(themeId);
          themeManager.applyTheme(theme, {
            mode: state.themeMode,
            screenType: 'global',
            brightness: state.brightness,
            customVariables: state.customVariables,
          });

          console.log(`[ThemeStore] Preview mode active for theme: ${themeId}`);
        } catch (error) {
          console.error('[ThemeStore] Error previewing theme:', error);
          throw error;
        }
      },

      /**
       * Confirm preview and activate theme
       */
      confirmPreview: async () => {
        try {
          const state = get();
          if (!state.isPreviewMode || !state.previewThemeId) {
            console.warn('[ThemeStore] Not in preview mode');
            return;
          }

          console.log(`[ThemeStore] Confirming preview of theme: ${state.previewThemeId}`);

          // Activate the previewed theme
          await get().activateTheme(state.previewThemeId);

          // Exit preview mode
          set({
            isPreviewMode: false,
            previewThemeId: null,
          });

          console.log('[ThemeStore] Preview confirmed and theme activated');
        } catch (error) {
          console.error('[ThemeStore] Error confirming preview:', error);
          throw error;
        }
      },

      /**
       * Cancel preview and revert to previous theme
       */
      cancelPreview: () => {
        const state = get();
        if (!state.isPreviewMode) {
          console.warn('[ThemeStore] Not in preview mode');
          return;
        }

        console.log('[ThemeStore] Cancelling preview, reverting to previous theme');

        // Reapply previous theme
        if (state.activeThemeId) {
          themeManager.loadTheme(state.activeThemeId).then(theme => {
            themeManager.applyTheme(theme, {
              mode: state.themeMode,
              screenType: 'global',
              brightness: state.brightness,
              customVariables: state.customVariables,
            });
          });
        }

        // Exit preview mode
        set({
          isPreviewMode: false,
          previewThemeId: null,
        });

        console.log('[ThemeStore] Preview cancelled');
      },

      /**
       * Generate theme from primary color
       */
      generateThemeFromColor: async (name: string, primaryColor: string) => {
        try {
          console.log(`[ThemeStore] Generating theme from color: ${primaryColor}`);

          const { generateThemeFromColor } = await import('@/services/themes/themeGenerator');

          const theme = generateThemeFromColor({
            name,
            primaryColor,
            description: `Custom theme generated from ${primaryColor}`,
          });

          // Save as custom theme
          const themeId = `custom-${Date.now()}`;
          // TODO: Save theme to database and cache

          console.log(`[ThemeStore] Generated theme: ${themeId}`);
          return theme;
        } catch (error) {
          console.error('[ThemeStore] Error generating theme from color:', error);
          throw error;
        }
      },

      /**
       * Generate theme from logo
       */
      generateThemeFromLogo: async (name: string, logoUrl: string) => {
        try {
          console.log(`[ThemeStore] Generating theme from logo: ${logoUrl}`);

          const { generateThemeFromLogo } = await import('@/services/themes/themeGenerator');

          const theme = await generateThemeFromLogo({
            name,
            logoUrl,
            description: `Auto-generated from your brand logo`,
          });

          // Save as custom theme
          const themeId = `custom-${Date.now()}`;
          // TODO: Save theme to database and cache

          console.log(`[ThemeStore] Generated theme from logo: ${themeId}`);
          return theme;
        } catch (error) {
          console.error('[ThemeStore] Error generating theme from logo:', error);
          throw error;
        }
      },

      /**
       * Extract colors from logo file
       */
      extractLogoColors: async (logoFile: File) => {
        try {
          console.log(`[ThemeStore] Extracting colors from logo file`);

          const { extractColorsFromFile } = await import('@/services/themes/logoColorExtractor');

          const colors = await extractColorsFromFile(logoFile);

          console.log(`[ThemeStore] Extracted colors:`, colors);
          return colors;
        } catch (error) {
          console.error('[ThemeStore] Error extracting logo colors:', error);
          throw error;
        }
      },

      /**
       * Customize theme colors with live preview
       */
      customizeThemeColors: async (colorOverrides: Record<string, string>) => {
        try {
          console.log(`[ThemeStore] Customizing theme colors`);

          const state = get();

          // Merge with current custom variables
          const newVariables = {
            ...state.customVariables,
            ...colorOverrides,
          };

          // Update state
          set({ customVariables: newVariables });

          // Reapply theme with new colors
          if (state.activeThemeId) {
            const theme = await themeManager.loadTheme(state.activeThemeId);
            themeManager.applyTheme(theme, {
              mode: state.themeMode,
              screenType: 'global',
              brightness: state.brightness,
              customVariables: newVariables,
            });
          }

          console.log(`[ThemeStore] Theme colors customized`);
        } catch (error) {
          console.error('[ThemeStore] Error customizing theme colors:', error);
          throw error;
        }
      },
    }),
    {
      name: 'theme-store',
      // Only persist activeThemeId and themeMode
      // Other state will be loaded from database
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        themeMode: state.themeMode,
      }),
    }
  )
);

/**
 * Initialize theme system on app start
 */
export async function initializeThemeSystem() {
  console.log('[ThemeStore] Initializing theme system...');

  try {
    const db = await initDatabase();
    const tenantId = useTenantStore.getState().tenant?.id;

    if (!tenantId) {
      console.warn('[ThemeStore] No tenant ID, skipping theme initialization');
      return;
    }

    // Initialize theme manager
    await themeManager.initialize(db, tenantId);

    // Load installed themes
    await useThemeStore.getState().loadInstalledThemes();

    // Load tenant theme config from database
    const result = await db.select<Array<{
      active_theme_id: string;
      theme_mode: string;
      custom_variables: string | null;
    }>>(
      'SELECT active_theme_id, theme_mode, custom_variables FROM tenant_theme_config WHERE tenant_id = ?',
      [tenantId]
    );

    if (result.length > 0) {
      const config = result[0];

      // Update store with database values
      useThemeStore.setState({
        activeThemeId: config.active_theme_id,
        themeMode: config.theme_mode as ThemeMode,
        customVariables: config.custom_variables ? JSON.parse(config.custom_variables) : {},
      });

      // Load screen overrides
      const overrideResult = await db.select<Array<{
        screen_type: string;
        override_variables: string;
      }>>(
        'SELECT screen_type, override_variables FROM screen_theme_overrides WHERE tenant_id = ?',
        [tenantId]
      );

      if (overrideResult.length > 0) {
        const screenOverrides: Record<ScreenType, Record<string, string>> = {
          global: {},
          kds: {},
          pos: {},
          reports: {},
          settings: {},
        };

        overrideResult.forEach(row => {
          screenOverrides[row.screen_type as ScreenType] = JSON.parse(row.override_variables);
        });

        useThemeStore.setState({ screenOverrides });
      }

      // Apply active theme
      const activeThemeId = config.active_theme_id;
      const theme = await themeManager.loadTheme(activeThemeId);
      themeManager.applyTheme(theme, {
        mode: config.theme_mode as ThemeMode,
        screenType: 'global',
        customVariables: config.custom_variables ? JSON.parse(config.custom_variables) : {},
      });

      console.log(`[ThemeStore] Theme system initialized with theme: ${activeThemeId}`);
    } else {
      // No theme config, install and activate default theme
      console.log('[ThemeStore] No theme config found, activating default theme');
      await useThemeStore.getState().installTheme('handsfree-default');
      await useThemeStore.getState().activateTheme('handsfree-default');
    }
  } catch (error) {
    console.error('[ThemeStore] Error initializing theme system:', error);
  }
}
