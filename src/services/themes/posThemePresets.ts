/**
 * POS Theme Presets
 * Pre-configured themes optimized for Point of Sale cashier screens
 * Focus: Speed, clarity, large touch targets, minimal distractions
 */

import type { ThemeConfiguration } from '@/types/theme';

export interface POSThemePreset {
  id: string;
  name: string;
  description: string;
  preview: string;
  config: Partial<ThemeConfiguration['variables']>;
}

/**
 * POS Theme Requirements:
 * - Large touch targets (min 48px)
 * - High contrast for quick reading
 * - Clear button states
 * - Minimal distractions
 * - Fast color scanning
 */

export const POS_THEME_PRESETS: POSThemePreset[] = [
  {
    id: 'pos-high-contrast',
    name: 'High Contrast',
    description: 'Maximum readability with strong contrast for busy environments',
    preview: 'https://via.placeholder.com/400x300/000000/ffffff?text=High+Contrast',
    config: {
      colors: {
        background: '#ffffff',
        foreground: '#000000',
        card: '#ffffff',
        'card-foreground': '#000000',
        primary: '#0066cc',
        'primary-foreground': '#ffffff',
        secondary: '#f5f5f5',
        'secondary-foreground': '#000000',
        border: 'rgba(0, 0, 0, 0.2)',
        'border-strong': 'rgba(0, 0, 0, 0.4)',

        // POS-specific status colors
        'pos-pending': '#fbbf24',
        'pos-processing': '#3b82f6',
        'pos-complete': '#10b981',
        'pos-void': '#ef4444',
      },
      typography: {
        'font-scale': 'large',
        'font-family': "'Inter', system-ui, sans-serif",
      },
      spacing: {
        'button-size': '56px',
        'touch-target-min': '48px',
      },
    },
  },

  {
    id: 'pos-dark-mode',
    name: 'Dark Mode',
    description: 'Easy on eyes for extended shifts and low-light environments',
    preview: 'https://via.placeholder.com/400x300/1e293b/f1f5f9?text=Dark+Mode',
    config: {
      colors: {
        background: '#0f172a',
        foreground: '#f1f5f9',
        card: '#1e293b',
        'card-foreground': '#f1f5f9',
        primary: '#ff8c00',
        'primary-foreground': '#ffffff',
        secondary: '#334155',
        'secondary-foreground': '#f1f5f9',
        border: 'rgba(255, 255, 255, 0.1)',
        'border-strong': 'rgba(255, 255, 255, 0.2)',

        'pos-pending': '#fbbf24',
        'pos-processing': '#60a5fa',
        'pos-complete': '#34d399',
        'pos-void': '#f87171',
      },
      typography: {
        'font-scale': 'normal',
      },
      effects: {
        'glass-bg': 'rgba(30, 41, 59, 0.8)',
        'glass-border': 'rgba(255, 255, 255, 0.1)',
      },
    },
  },

  {
    id: 'pos-colorful',
    name: 'Colorful',
    description: 'Vibrant colors for quick visual scanning and category identification',
    preview: 'https://via.placeholder.com/400x300/4f46e5/ffffff?text=Colorful',
    config: {
      colors: {
        background: '#f8fafc',
        foreground: '#1e293b',
        card: '#ffffff',
        'card-foreground': '#1e293b',
        primary: '#4f46e5',
        'primary-foreground': '#ffffff',
        accent: '#ec4899',
        'accent-foreground': '#ffffff',
        secondary: '#14b8a6',
        'secondary-foreground': '#ffffff',

        // Category colors for menu items
        'category-food': '#10b981',
        'category-drinks': '#3b82f6',
        'category-desserts': '#f59e0b',
        'category-alcohol': '#8b5cf6',
      },
      typography: {
        'font-scale': 'normal',
      },
    },
  },

  {
    id: 'pos-minimal',
    name: 'Minimal',
    description: 'Clean and distraction-free for focused cashier workflow',
    preview: 'https://via.placeholder.com/400x300/f9fafb/111827?text=Minimal',
    config: {
      colors: {
        background: '#f9fafb',
        foreground: '#111827',
        card: '#ffffff',
        'card-foreground': '#111827',
        primary: '#1f2937',
        'primary-foreground': '#ffffff',
        secondary: '#e5e7eb',
        'secondary-foreground': '#374151',
        border: 'rgba(0, 0, 0, 0.08)',
        'border-strong': 'rgba(0, 0, 0, 0.15)',

        'pos-pending': '#6b7280',
        'pos-processing': '#374151',
        'pos-complete': '#059669',
        'pos-void': '#dc2626',
      },
      typography: {
        'font-scale': 'normal',
        'font-family': "'Inter', system-ui, sans-serif",
      },
      effects: {
        shadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
    },
  },

  {
    id: 'pos-large-text',
    name: 'Large Text',
    description: 'Extra large text and buttons for accessibility and visibility',
    preview: 'https://via.placeholder.com/400x300/ffffff/000000?text=Large+Text',
    config: {
      colors: {
        background: '#ffffff',
        foreground: '#1a1d23',
        card: '#ffffff',
        'card-foreground': '#1a1d23',
        primary: '#ff8c00',
        'primary-foreground': '#ffffff',
        border: 'rgba(0, 0, 0, 0.1)',
      },
      typography: {
        'font-scale': 'large',
        'base-font-size': '18px',
        'heading-font-size': '24px',
      },
      spacing: {
        'button-size': '64px',
        'touch-target-min': '56px',
        'padding-base': '1.5rem',
      },
    },
  },
];

/**
 * Get POS preset by ID
 */
export function getPOSPreset(presetId: string): POSThemePreset | undefined {
  return POS_THEME_PRESETS.find(p => p.id === presetId);
}

/**
 * Apply POS preset to theme configuration
 */
export function applyPOSPreset(
  baseTheme: ThemeConfiguration,
  preset: POSThemePreset
): ThemeConfiguration {
  return {
    ...baseTheme,
    screenOverrides: {
      ...baseTheme.screenOverrides,
      pos: {
        variables: preset.config as any,
      },
    },
  };
}

/**
 * Generate custom POS theme variables
 */
export interface POSCustomization {
  // Colors
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;

  // Typography
  fontSize?: 'small' | 'normal' | 'large' | 'xlarge';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';

  // Layout
  buttonSize?: 'small' | 'medium' | 'large' | 'xlarge';
  spacing?: 'compact' | 'normal' | 'comfortable';
  borderRadius?: 'none' | 'small' | 'medium' | 'large';

  // Features
  showPrices?: boolean;
  showImages?: boolean;
  gridColumns?: 3 | 4 | 5 | 6;
  enableAnimations?: boolean;
}

export function generatePOSThemeVariables(
  customization: POSCustomization
): Record<string, string> {
  const variables: Record<string, string> = {};

  // Colors
  if (customization.primaryColor) {
    variables['--color-primary'] = customization.primaryColor;
  }
  if (customization.backgroundColor) {
    variables['--color-background'] = customization.backgroundColor;
  }
  if (customization.textColor) {
    variables['--color-foreground'] = customization.textColor;
  }

  // Typography
  const fontSizeMap = {
    small: '14px',
    normal: '16px',
    large: '18px',
    xlarge: '20px',
  };
  if (customization.fontSize) {
    variables['--font-size-base'] = fontSizeMap[customization.fontSize];
  }

  const fontWeightMap = {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  };
  if (customization.fontWeight) {
    variables['--font-weight-base'] = fontWeightMap[customization.fontWeight];
  }

  // Button sizes
  const buttonSizeMap = {
    small: '40px',
    medium: '48px',
    large: '56px',
    xlarge: '64px',
  };
  if (customization.buttonSize) {
    variables['--button-size'] = buttonSizeMap[customization.buttonSize];
  }

  // Spacing
  const spacingMap = {
    compact: '0.5rem',
    normal: '1rem',
    comfortable: '1.5rem',
  };
  if (customization.spacing) {
    variables['--spacing-base'] = spacingMap[customization.spacing];
  }

  // Border radius
  const radiusMap = {
    none: '0',
    small: '0.375rem',
    medium: '0.75rem',
    large: '1rem',
  };
  if (customization.borderRadius) {
    variables['--radius'] = radiusMap[customization.borderRadius];
  }

  return variables;
}
