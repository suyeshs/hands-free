/**
 * AI Theme Generator
 * Automatically generates complete themes from brand colors
 * Uses color utilities and logo extraction for intelligent theme creation
 */

import type { ThemeConfiguration, ThemeCategory } from '@/types/theme';
import { generateColorPalette, generateForegroundColor, ensureContrast } from './colorUtils';
import { extractColorsFromImage, suggestThemeCategory } from './logoColorExtractor';

export interface GenerateThemeOptions {
  name: string;
  primaryColor: string;
  category?: ThemeCategory;
  description?: string;
}

export interface GenerateThemeFromLogoOptions {
  name: string;
  logoUrl: string;
  description?: string;
}

/**
 * Generate a complete theme from a primary color
 */
export function generateThemeFromColor(options: GenerateThemeOptions): ThemeConfiguration {
  const { name, primaryColor, category = 'modern', description } = options;

  // Generate complete color palette
  const palette = generateColorPalette(primaryColor);

  // Generate theme configuration
  const theme: ThemeConfiguration = {
    version: '1.0',
    name,
    description: description || `Auto-generated theme from ${primaryColor}`,

    variables: {
      colors: {
        // Brand colors
        'warm-charcoal': palette.neutrals.gray800,
        'warm-white': palette.neutrals.gray100,
        'saffron': palette.accent.base,
        'paprika': palette.accent.dark,
        'warm-border': 'rgba(255, 255, 255, 0.08)',

        // Base colors
        background: palette.neutrals.white,
        foreground: palette.neutrals.black,
        card: palette.neutrals.white,
        'card-foreground': palette.neutrals.gray800,
        popover: palette.neutrals.white,
        'popover-foreground': palette.neutrals.gray800,

        // Surface layers
        'surface-1': palette.neutrals.white,
        'surface-2': palette.neutrals.gray100,
        'surface-3': palette.neutrals.gray200,

        // Accent colors
        primary: palette.primary.base,
        'primary-foreground': generateForegroundColor(palette.primary.base),
        accent: palette.accent.base,
        'accent-foreground': generateForegroundColor(palette.accent.base),
        secondary: palette.secondary.base,
        'secondary-foreground': generateForegroundColor(palette.secondary.base),
        muted: palette.neutrals.gray200,
        'muted-foreground': palette.neutrals.gray600,

        // Status colors
        success: palette.status.success,
        'success-light': '#d1fae5',
        warning: palette.status.warning,
        'warning-light': '#fef3c7',
        destructive: palette.status.destructive,
        'destructive-light': '#fee2e2',
        info: palette.status.info,
        'info-light': '#dbeafe',

        // Borders & inputs
        border: 'rgba(0, 0, 0, 0.06)',
        'border-strong': 'rgba(0, 0, 0, 0.12)',
        input: 'rgba(0, 0, 0, 0.03)',
        ring: palette.primary.base,
      },

      typography: {
        'font-family': "'Inter', system-ui, -apple-system, sans-serif",
        'font-heading': "'Inter', system-ui, -apple-system, sans-serif",
        'font-body': "'Inter', system-ui, -apple-system, sans-serif",
        'font-scale': 'normal',
      },

      spacing: {
        radius: '1rem',
        'radius-sm': '0.75rem',
        'radius-lg': '1.5rem',
        'radius-xl': '2rem',
      },

      effects: {
        'neo-light': 'rgba(255, 255, 255, 0.9)',
        'neo-dark': 'rgba(0, 0, 0, 0.08)',
        'neo-dark-strong': 'rgba(0, 0, 0, 0.12)',
        'glass-bg': 'rgba(255, 255, 255, 0.7)',
        'glass-bg-strong': 'rgba(255, 255, 255, 0.85)',
        'glass-border': 'rgba(255, 255, 255, 0.5)',
        'glass-shadow': 'rgba(0, 0, 0, 0.08)',
        'glass-blur': '16px',
        shadow: '0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'shadow-strong': '0 8px 32px rgba(0, 0, 0, 0.1)',
      },

      components: {
        button: {
          'primary-shadow': `4px 4px 12px ${palette.primary.base}40, -2px -2px 8px rgba(255, 255, 255, 0.8)`,
        },
        card: {
          'elevated-shadow': '0 4px 20px rgba(0, 0, 0, 0.06)',
        },
      },
    },

    darkMode: {
      variables: {
        colors: {
          background: palette.neutrals.gray800,
          foreground: palette.neutrals.gray100,
          card: palette.neutrals.gray700,
          'card-foreground': palette.neutrals.gray100,
          popover: palette.neutrals.gray700,
          'popover-foreground': palette.neutrals.gray100,
          'surface-1': palette.neutrals.gray700,
          'surface-2': palette.neutrals.gray600,
          'surface-3': palette.neutrals.gray500,
          secondary: palette.neutrals.gray600,
          'secondary-foreground': palette.neutrals.gray100,
          muted: palette.neutrals.gray600,
          'muted-foreground': palette.neutrals.gray400,
          border: 'rgba(255, 255, 255, 0.1)',
          'border-strong': 'rgba(255, 255, 255, 0.2)',
          input: 'rgba(255, 255, 255, 0.05)',
        },
        effects: {
          'neo-light': 'rgba(255, 255, 255, 0.05)',
          'neo-dark': 'rgba(0, 0, 0, 0.4)',
          'neo-dark-strong': 'rgba(0, 0, 0, 0.6)',
          'glass-bg': 'rgba(30, 41, 59, 0.8)',
          'glass-bg-strong': 'rgba(30, 41, 59, 0.95)',
          'glass-border': 'rgba(255, 255, 255, 0.1)',
          'glass-shadow': 'rgba(0, 0, 0, 0.3)',
        },
      },
    },

    brightness: {
      enabled: true,
      adapters: [
        {
          range: [0, 25],
          variables: {
            '--color-background': palette.neutrals.white,
            '--color-foreground': palette.neutrals.black,
            '--color-card': palette.neutrals.white,
          },
        },
        {
          range: [75, 100],
          variables: {
            '--color-background': palette.neutrals.gray800,
            '--color-foreground': palette.neutrals.gray100,
            '--color-card': palette.neutrals.gray700,
          },
        },
      ],
    },
  };

  return theme;
}

/**
 * Generate a theme from a restaurant logo
 */
export async function generateThemeFromLogo(
  options: GenerateThemeFromLogoOptions
): Promise<ThemeConfiguration> {
  const { name, logoUrl, description } = options;

  try {
    // Extract colors from logo
    const colors = await extractColorsFromImage(logoUrl);

    // Suggest category based on logo colors
    const category = await suggestThemeCategory(logoUrl);

    // Generate theme using primary color
    const theme = generateThemeFromColor({
      name,
      primaryColor: colors.primary,
      category,
      description: description || `Auto-generated from your brand logo`,
    });

    return theme;
  } catch (error) {
    console.error('[ThemeGenerator] Error generating theme from logo:', error);
    throw new Error('Failed to generate theme from logo');
  }
}

/**
 * Generate theme variations (light, dark, high contrast)
 */
export function generateThemeVariations(
  baseTheme: ThemeConfiguration
): {
  light: ThemeConfiguration;
  dark: ThemeConfiguration;
  highContrast: ThemeConfiguration;
} {
  const primaryColor = baseTheme.variables.colors.primary;

  // Light variation (base theme)
  const light = baseTheme;

  // Dark variation
  const dark: ThemeConfiguration = {
    ...baseTheme,
    name: `${baseTheme.name} (Dark)`,
    darkMode: baseTheme.darkMode,
  };

  // High contrast variation
  const palette = generateColorPalette(primaryColor);
  const highContrast: ThemeConfiguration = {
    ...baseTheme,
    name: `${baseTheme.name} (High Contrast)`,
    variables: {
      ...baseTheme.variables,
      colors: {
        ...baseTheme.variables.colors,
        background: '#ffffff',
        foreground: '#000000',
        card: '#ffffff',
        'card-foreground': '#000000',
        border: 'rgba(0, 0, 0, 0.2)',
        'border-strong': 'rgba(0, 0, 0, 0.4)',
        muted: '#f0f0f0',
        'muted-foreground': '#333333',
      },
    },
  };

  return { light, dark, highContrast };
}

/**
 * Generate KDS-optimized theme (high contrast, large text)
 */
export function generateKDSTheme(baseTheme: ThemeConfiguration): ThemeConfiguration {
  return {
    ...baseTheme,
    name: `${baseTheme.name} (KDS)`,
    description: 'Kitchen Display optimized with high contrast and large text',
    screenOverrides: {
      kds: {
        variables: {
          colors: {
            background: '#000000',
            foreground: '#ffffff',
            card: '#1a1a1a',
            'card-foreground': '#ffffff',
            border: 'rgba(255, 255, 255, 0.2)',
            'border-strong': 'rgba(255, 255, 255, 0.4)',
            // Status colors for orders
            'status-new': '#ff6b6b',
            'status-preparing': '#ffd93d',
            'status-ready': '#6bcf7f',
            'status-completed': '#a0a0a0',
          },
          typography: {
            'font-scale': 'large',
          },
        },
      },
    },
  };
}

/**
 * Export theme to different formats
 */
export function exportTheme(theme: ThemeConfiguration, format: 'json' | 'css' | 'scss') {
  switch (format) {
    case 'json':
      return JSON.stringify(theme, null, 2);

    case 'css':
      return generateCSSFromTheme(theme);

    case 'scss':
      return generateSCSSFromTheme(theme);

    default:
      return JSON.stringify(theme, null, 2);
  }
}

/**
 * Generate CSS variables from theme
 */
function generateCSSFromTheme(theme: ThemeConfiguration): string {
  let css = ':root {\n';

  // Colors
  Object.entries(theme.variables.colors).forEach(([key, value]) => {
    css += `  --color-${key}: ${value};\n`;
  });

  // Typography
  Object.entries(theme.variables.typography).forEach(([key, value]) => {
    css += `  --${key}: ${value};\n`;
  });

  // Spacing
  Object.entries(theme.variables.spacing).forEach(([key, value]) => {
    css += `  --${key}: ${value};\n`;
  });

  // Effects
  Object.entries(theme.variables.effects).forEach(([key, value]) => {
    css += `  --${key}: ${value};\n`;
  });

  css += '}\n';

  // Dark mode
  if (theme.darkMode) {
    css += '\nhtml.dark {\n';
    if (theme.darkMode.variables.colors) {
      Object.entries(theme.darkMode.variables.colors).forEach(([key, value]) => {
        css += `  --color-${key}: ${value};\n`;
      });
    }
    if (theme.darkMode.variables.effects) {
      Object.entries(theme.darkMode.variables.effects).forEach(([key, value]) => {
        css += `  --${key}: ${value};\n`;
      });
    }
    css += '}\n';
  }

  return css;
}

/**
 * Generate SCSS variables from theme
 */
function generateSCSSFromTheme(theme: ThemeConfiguration): string {
  let scss = '// Theme Variables\n\n';

  // Colors
  Object.entries(theme.variables.colors).forEach(([key, value]) => {
    scss += `$color-${key}: ${value};\n`;
  });

  scss += '\n';

  // Typography
  Object.entries(theme.variables.typography).forEach(([key, value]) => {
    scss += `$${key}: ${value};\n`;
  });

  scss += '\n';

  // Spacing
  Object.entries(theme.variables.spacing).forEach(([key, value]) => {
    scss += `$${key}: ${value};\n`;
  });

  return scss;
}
