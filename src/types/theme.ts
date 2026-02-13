/**
 * Theme Plugin System - Type Definitions
 * Defines all TypeScript interfaces and types for the theme system
 */

// Screen Types for screen-specific theme overrides
export type ScreenType = 'global' | 'kds' | 'pos' | 'reports' | 'settings';

// Theme mode
export type ThemeMode = 'light' | 'dark' | 'auto';

// Theme categories for filtering and organization
export type ThemeCategory =
  | 'modern'       // ✨ Modern & Clean
  | 'dark'         // 🌙 Dark & Sophisticated
  | 'bright'       // ☀️ Bright & Energetic
  | 'colorful'     // 🎨 Colorful
  | 'classic'      // 📋 Classic & Simple
  | 'industry';    // 🏪 Industry-Specific

// Design patterns supported by themes
export type DesignPattern = 'glassmorphism' | 'neomorphism' | 'flat' | 'material';

/**
 * Core theme configuration structure
 * Stored in theme.json file within theme bundles
 */
export interface ThemeConfiguration {
  version: '1.0';
  name: string;
  description: string;

  // Global CSS Variables (apply to all screens by default)
  variables: {
    colors: {
      // Base colors
      background: string;
      foreground: string;
      card: string;
      'card-foreground': string;
      border: string;
      muted: string;
      'muted-foreground': string;

      // Brand colors
      primary: string;
      'primary-foreground': string;
      secondary: string;
      'secondary-foreground': string;
      accent: string;
      'accent-foreground': string;

      // Status colors
      success: string;
      warning: string;
      destructive: string;
      info: string;

      // Glassmorphism colors (with alpha)
      'glass-bg'?: string;
      'glass-border'?: string;
    };

    typography: {
      'font-family': string;
      'font-heading': string;
      'font-body'?: string;
      'font-scale': 'compact' | 'normal' | 'large';
    };

    spacing: {
      radius: string;
      'radius-sm': string;
      'radius-lg': string;
      'radius-xl'?: string;
    };

    effects: {
      'glass-bg': string;
      'glass-blur': string;
      shadow: string;
      'shadow-strong'?: string;
      'neo-light'?: string;
      'neo-dark'?: string;
    };

    // Component-specific variables (optional)
    components?: {
      button?: Record<string, string>;
      card?: Record<string, string>;
      input?: Record<string, string>;
      [key: string]: Record<string, string> | undefined;
    };
  };

  // Screen-specific overrides (optional)
  screenOverrides?: {
    kds?: {
      variables: Partial<ThemeConfiguration['variables']>;
    };
    pos?: {
      variables: Partial<ThemeConfiguration['variables']>;
    };
    reports?: {
      variables: Partial<ThemeConfiguration['variables']>;
    };
  };

  // Optional brightness adaptation
  brightness?: {
    enabled: boolean;
    adapters: Array<{
      range: [number, number];  // e.g., [0, 30] for light mode
      variables: Record<string, string>;
    }>;
  };

  // Dark mode overrides (if not using separate dark.css)
  darkMode?: {
    variables: Partial<ThemeConfiguration['variables']>;
  };
}

/**
 * Loaded theme structure
 * Represents a fully loaded theme with all resources
 */
export interface LoadedTheme {
  manifest: ThemePluginManifest;
  config: ThemeConfiguration;
  css: {
    light: string | null;
    dark: string | null;
    common: string | null;
    components: string | null;
  };
}

/**
 * Installed theme metadata
 * Stored in local database
 */
export interface InstalledTheme {
  id: string;
  name: string;
  description: string;
  category: ThemeCategory;
  previewUrl: string;
  installedAt: string;
  version: string;
  enabled: boolean;
}

/**
 * Theme Plugin Manifest
 * Extends the base PluginManifest with theme-specific fields
 */
export interface ThemePluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'theme';
  visibility: 'public' | 'private' | 'tenant-whitelist';

  theme: {
    // Category for filtering
    category: ThemeCategory;

    // Preview image URL (screenshot of theme)
    preview_url: string;

    // Compatible platforms
    compatible_apps: Array<'pos' | 'owner-mobile' | 'staff-mobile' | 'customer-web'>;

    // Theme composition support
    extends?: string;           // Base theme ID to extend
    overrides_only: boolean;    // If true, only applies overrides

    // CSS resources in R2
    resources: {
      manifest: string;         // theme.json path
      light_mode?: string;      // light.css path
      dark_mode?: string;       // dark.css path
      common?: string;          // common.css path
      components?: string;      // components.css path
    };

    // Customization capabilities
    customizable: {
      colors: boolean;
      typography: boolean;
      spacing: boolean;
      borders: boolean;
      components: boolean;
    };

    // Design system features
    supports_brightness_adaptation: boolean;
    supports_border_style: boolean;
    design_patterns: DesignPattern[];
  };

  // Metadata
  created_at: string;
  updated_at: string;
  checksum?: string;
}

/**
 * Tenant theme configuration
 * Stored per tenant for theme preferences
 */
export interface TenantThemeConfig {
  tenantId: string;
  activeThemeId: string;
  themeMode: ThemeMode;
  customVariables?: Record<string, string>;
  updatedAt: string;
}

/**
 * Screen-specific theme override
 * Allows customization per screen type (KDS, POS, Reports)
 */
export interface ScreenThemeOverride {
  id: number;
  tenantId: string;
  screenType: ScreenType;
  overrideVariables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Theme cache entry
 * Stores theme resources locally for offline use
 */
export interface ThemeCacheEntry {
  themeId: string;
  configJson: string;
  lightCss: string | null;
  darkCss: string | null;
  commonCss: string | null;
  componentsCss: string | null;
  cachedAt: string;
  lastUsed: string;
}

/**
 * Theme store state
 * Zustand store interface
 */
export interface ThemeStoreState {
  // State
  installedThemes: InstalledTheme[];
  activeThemeId: string | null;
  themeMode: ThemeMode;
  brightness: number;  // 0-100 (for brightness adaptation if theme supports it)
  customVariables: Record<string, string>;
  screenOverrides: Record<ScreenType, Record<string, string>>;
  isPreviewMode: boolean;
  previewThemeId: string | null;

  // Actions
  loadInstalledThemes: () => Promise<void>;
  installTheme: (themeId: string) => Promise<void>;
  uninstallTheme: (themeId: string) => Promise<void>;
  activateTheme: (themeId: string) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  setBrightness: (level: number) => void;
  updateCustomVariables: (vars: Record<string, string>) => void;
  setScreenOverride: (screenType: ScreenType, vars: Record<string, string>) => Promise<void>;
  removeScreenOverride: (screenType: ScreenType) => Promise<void>;

  // Preview mode
  previewTheme: (themeId: string) => Promise<void>;
  confirmPreview: () => Promise<void>;
  cancelPreview: () => void;

  // Theme generation (with integrated libraries)
  generateThemeFromColor: (name: string, primaryColor: string) => Promise<ThemeConfiguration>;
  generateThemeFromLogo: (name: string, logoUrl: string) => Promise<ThemeConfiguration>;
  extractLogoColors: (logoFile: File) => Promise<import('../services/themes/logoColorExtractor').ExtractedColors>;
  customizeThemeColors: (colorOverrides: Record<string, string>) => Promise<void>;
}

/**
 * Theme application options
 */
export interface ThemeApplicationOptions {
  mode: ThemeMode;
  screenType: ScreenType;
  brightness?: number;
  screenOverride?: Record<string, string>;
  customVariables?: Record<string, string>;
}

/**
 * Theme recommendation result
 */
export interface ThemeRecommendation {
  theme: InstalledTheme;
  matchReason: string;  // e.g., "Matches your brand colors", "Popular in Fine Dining"
  confidence: number;   // 0-1
}

/**
 * Brand color extraction result
 */
export interface BrandColors {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  palette: string[];  // Full color palette extracted
}
