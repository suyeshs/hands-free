/**
 * Theme Manager
 * Core service for loading, caching, and applying themes
 * Handles screen-specific overrides and smooth theme transitions
 */

import type {
  LoadedTheme,
  ThemeConfiguration,
  ThemePluginManifest,
  ThemeMode,
  ScreenType,
  ThemeApplicationOptions,
} from '@/types/theme';
import type { Database } from '@tauri-apps/plugin-sql';

export class ThemeManager {
  private db: Database | null = null;
  private currentTheme: LoadedTheme | null = null;
  private registryUrl: string;
  private tenantId: string | null = null;

  constructor(registryUrl?: string) {
    this.registryUrl = registryUrl || 'https://plugins.handsfree.app';
  }

  /**
   * Initialize the theme manager with database and tenant context
   */
  async initialize(db: Database, tenantId: string) {
    this.db = db;
    this.tenantId = tenantId;
  }

  /**
   * Load theme from cache or download from R2
   */
  async loadTheme(themeId: string): Promise<LoadedTheme> {
    if (!this.db) {
      throw new Error('ThemeManager not initialized');
    }

    // 1. Check SQLite cache
    const cached = await this.getCachedTheme(themeId);
    if (cached) {
      console.log(`[ThemeManager] Loaded theme ${themeId} from cache`);
      return cached;
    }

    console.log(`[ThemeManager] Theme ${themeId} not in cache, downloading...`);

    // 2. Fetch from R2 plugin registry
    const manifest = await this.fetchThemeManifest(themeId);
    const config = await this.fetchThemeConfig(manifest.theme.resources.manifest);

    // 3. Download CSS files
    const css = {
      light: manifest.theme.resources.light_mode
        ? await this.fetchCSS(manifest.theme.resources.light_mode)
        : null,
      dark: manifest.theme.resources.dark_mode
        ? await this.fetchCSS(manifest.theme.resources.dark_mode)
        : null,
      common: manifest.theme.resources.common
        ? await this.fetchCSS(manifest.theme.resources.common)
        : null,
      components: manifest.theme.resources.components
        ? await this.fetchCSS(manifest.theme.resources.components)
        : null,
    };

    // 4. Cache in SQLite
    await this.cacheTheme(themeId, manifest, config, css);

    console.log(`[ThemeManager] Theme ${themeId} downloaded and cached`);

    return { manifest, config, css };
  }

  /**
   * Apply theme to document
   * Handles screen-specific overrides and mode (light/dark)
   */
  applyTheme(
    theme: LoadedTheme,
    options: ThemeApplicationOptions
  ): void {
    const { mode, screenType, brightness, screenOverride, customVariables } = options;

    console.log(`[ThemeManager] Applying theme ${theme.manifest.id}`, {
      mode,
      screenType,
      brightness,
    });

    // 1. Remove previous theme styles
    this.removePreviousTheme();

    // 2. Determine effective mode (resolve 'auto')
    const effectiveMode = this.resolveThemeMode(mode);

    // 3. Apply base theme CSS variables
    this.applyVariables(theme.config.variables);

    // 4. Apply dark mode overrides if in dark mode
    if (effectiveMode === 'dark' && theme.config.darkMode) {
      this.applyVariables(theme.config.darkMode.variables as any);
    }

    // 5. Apply screen-specific overrides
    if (screenType !== 'global' && theme.config.screenOverrides?.[screenType]) {
      const screenVars = theme.config.screenOverrides[screenType]?.variables;
      if (screenVars) {
        this.applyVariables(screenVars as any);
      }
    }

    // 6. Apply tenant's screen overrides (if any)
    if (screenOverride) {
      this.applyVariableOverrides(screenOverride);
    }

    // 7. Apply custom variable overrides
    if (customVariables) {
      this.applyVariableOverrides(customVariables);
    }

    // 8. Inject CSS stylesheets
    if (theme.css.common) {
      this.injectCSS('theme-common', theme.css.common);
    }

    if (effectiveMode === 'dark' && theme.css.dark) {
      this.injectCSS('theme-mode', theme.css.dark);
    } else if (effectiveMode === 'light' && theme.css.light) {
      this.injectCSS('theme-mode', theme.css.light);
    }

    if (theme.css.components) {
      this.injectCSS('theme-components', theme.css.components);
    }

    // 9. Apply brightness adaptation (if supported and provided)
    if (brightness !== undefined && theme.config.brightness?.enabled) {
      this.applyBrightnessAdaptation(theme, brightness);
    }

    // 10. Set data attributes for CSS selectors
    document.documentElement.setAttribute('data-theme', theme.manifest.id);
    document.documentElement.setAttribute('data-screen', screenType);
    document.documentElement.setAttribute('data-mode', effectiveMode);

    // 11. Update dark class for Tailwind
    if (effectiveMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 12. Store current theme reference
    this.currentTheme = theme;

    console.log(`[ThemeManager] Theme ${theme.manifest.id} applied successfully`);
  }

  /**
   * Hot-swap theme (for live preview)
   */
  async switchTheme(
    themeId: string,
    options: ThemeApplicationOptions
  ): Promise<void> {
    const theme = await this.loadTheme(themeId);
    this.applyTheme(theme, options);
  }

  /**
   * Get cached theme from SQLite
   */
  private async getCachedTheme(themeId: string): Promise<LoadedTheme | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.select<Array<{
        config_json: string;
        light_css: string | null;
        dark_css: string | null;
        common_css: string | null;
        components_css: string | null;
      }>>(
        'SELECT config_json, light_css, dark_css, common_css, components_css FROM theme_cache WHERE theme_id = ?',
        [themeId]
      );

      if (result.length === 0) return null;

      const cached = result[0];

      // Also get manifest from plugin_metadata
      const manifestResult = await this.db.select<Array<{
        manifest: string;
      }>>(
        'SELECT manifest FROM plugin_metadata WHERE plugin_id = ? AND type = ?',
        [themeId, 'theme']
      );

      if (manifestResult.length === 0) return null;

      const manifest: ThemePluginManifest = JSON.parse(manifestResult[0].manifest);
      const config: ThemeConfiguration = JSON.parse(cached.config_json);

      return {
        manifest,
        config,
        css: {
          light: cached.light_css,
          dark: cached.dark_css,
          common: cached.common_css,
          components: cached.components_css,
        },
      };
    } catch (error) {
      console.error('[ThemeManager] Error getting cached theme:', error);
      return null;
    }
  }

  /**
   * Cache theme in SQLite
   */
  private async cacheTheme(
    themeId: string,
    manifest: ThemePluginManifest,
    config: ThemeConfiguration,
    css: LoadedTheme['css']
  ): Promise<void> {
    if (!this.db) return;

    try {
      const now = new Date().toISOString();

      // Insert/update theme cache
      await this.db.execute(
        `INSERT OR REPLACE INTO theme_cache
         (theme_id, config_json, light_css, dark_css, common_css, components_css, cached_at, last_used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          themeId,
          JSON.stringify(config),
          css.light,
          css.dark,
          css.common,
          css.components,
          now,
          now,
        ]
      );

      // Also ensure it's in plugin_metadata
      await this.db.execute(
        `INSERT OR REPLACE INTO plugin_metadata
         (plugin_id, manifest, installed_at, enabled, cached, cache_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          themeId,
          JSON.stringify(manifest),
          now,
          1, // enabled
          1, // cached
          0, // cache_size (not used for themes)
        ]
      );

      console.log(`[ThemeManager] Theme ${themeId} cached successfully`);
    } catch (error) {
      console.error('[ThemeManager] Error caching theme:', error);
    }
  }

  /**
   * Fetch theme manifest from R2
   */
  private async fetchThemeManifest(themeId: string): Promise<ThemePluginManifest> {
    const url = `${this.registryUrl}/themes/${themeId}/manifest.json`;
    console.log(`[ThemeManager] Fetching manifest from ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch theme manifest: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ThemeManager] Error fetching theme manifest:', error);
      throw error;
    }
  }

  /**
   * Fetch theme configuration (theme.json) from R2
   */
  private async fetchThemeConfig(resourcePath: string): Promise<ThemeConfiguration> {
    const url = `${this.registryUrl}/${resourcePath}`;
    console.log(`[ThemeManager] Fetching theme config from ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch theme config: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ThemeManager] Error fetching theme config:', error);
      throw error;
    }
  }

  /**
   * Fetch CSS file from R2
   */
  private async fetchCSS(resourcePath: string): Promise<string> {
    const url = `${this.registryUrl}/${resourcePath}`;
    console.log(`[ThemeManager] Fetching CSS from ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch CSS: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error('[ThemeManager] Error fetching CSS:', error);
      throw error;
    }
  }

  /**
   * Apply CSS variables to document root
   */
  private applyVariables(variables: ThemeConfiguration['variables']): void {
    const root = document.documentElement;

    // Apply colors
    if (variables.colors) {
      Object.entries(variables.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
    }

    // Apply typography
    if (variables.typography) {
      Object.entries(variables.typography).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
    }

    // Apply spacing
    if (variables.spacing) {
      Object.entries(variables.spacing).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
    }

    // Apply effects
    if (variables.effects) {
      Object.entries(variables.effects).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
    }

    // Apply component-specific variables
    if (variables.components) {
      Object.entries(variables.components).forEach(([component, componentVars]) => {
        if (componentVars) {
          Object.entries(componentVars).forEach(([key, value]) => {
            root.style.setProperty(`--${component}-${key}`, value);
          });
        }
      });
    }
  }

  /**
   * Apply variable overrides (custom or screen-specific)
   */
  private applyVariableOverrides(overrides: Record<string, string>): void {
    const root = document.documentElement;
    Object.entries(overrides).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  /**
   * Inject CSS into document
   */
  private injectCSS(id: string, css: string): void {
    // Remove existing stylesheet with this ID
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    // Create new stylesheet
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Remove previous theme styles
   */
  private removePreviousTheme(): void {
    // Remove theme stylesheets
    const ids = ['theme-common', 'theme-mode', 'theme-components'];
    ids.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.remove();
    });
  }

  /**
   * Apply brightness-based color adaptation
   */
  private applyBrightnessAdaptation(theme: LoadedTheme, brightness: number): void {
    if (!theme.config.brightness?.enabled) return;

    const root = document.documentElement;

    // Find matching adapter for brightness level
    const adapter = theme.config.brightness.adapters.find(
      a => brightness >= a.range[0] && brightness <= a.range[1]
    );

    if (adapter) {
      Object.entries(adapter.variables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }

    // Set brightness data attribute for CSS selectors
    root.setAttribute('data-brightness', brightness.toString());
  }

  /**
   * Resolve theme mode (handle 'auto')
   */
  private resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'auto') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return mode;
  }

  /**
   * Clear theme cache
   */
  async clearCache(themeId?: string): Promise<void> {
    if (!this.db) return;

    try {
      if (themeId) {
        await this.db.execute('DELETE FROM theme_cache WHERE theme_id = ?', [themeId]);
        console.log(`[ThemeManager] Cleared cache for theme ${themeId}`);
      } else {
        await this.db.execute('DELETE FROM theme_cache');
        console.log('[ThemeManager] Cleared all theme cache');
      }
    } catch (error) {
      console.error('[ThemeManager] Error clearing cache:', error);
    }
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): LoadedTheme | null {
    return this.currentTheme;
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();
