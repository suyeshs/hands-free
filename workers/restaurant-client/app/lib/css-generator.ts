/**
 * CSS Generator - Converts theme JSON to CSS variables
 */

import { MultimodalRestaurantTheme } from '../types/theme';

/**
 * Generate CSS variables from theme
 * Injects as inline <style> tag in document head
 */
export function generateCSSVariables(theme: MultimodalRestaurantTheme): string {
  const tokens = theme.designTokens;

  // Defensive checks for missing tokens
  if (!tokens) {
    console.warn('[CSS Generator] No design tokens found in theme');
    return ':root {}';
  }

  const colors = tokens.colors || {};
  const primary = colors.primary || {};
  const secondary = colors.secondary || {};
  const accent = colors.accent || {};
  const background = colors.background || {};
  const text = colors.text || {};

  return `
:root {
  /* Primary Colors */
  --color-primary-50: ${primary[50] || '#fef3e2'};
  --color-primary-100: ${primary[100] || '#fde6c4'};
  --color-primary-200: ${primary[200] || '#fbcc88'};
  --color-primary-300: ${primary[300] || '#f9b34c'};
  --color-primary-400: ${primary[400] || '#f79a10'};
  --color-primary-500: ${primary[500] || '#ff9500'};
  --color-primary-600: ${primary[600] || '#cc7700'};
  --color-primary-700: ${primary[700] || '#995900'};
  --color-primary-800: ${primary[800] || '#663b00'};
  --color-primary-900: ${primary[900] || '#331e00'};

  /* Secondary Colors */
  --color-secondary-500: ${secondary[500] || '#2c3e50'};

  /* Accent Colors */
  --color-accent-500: ${accent[500] || '#ff9500'};
  --color-accent-600: ${accent[600] || '#cc7700'};

  /* Background Colors */
  --color-bg-main: ${background.main || '#ffffff'};
  --color-bg-surface: ${background.surface || '#f9fafb'};
  --color-bg-elevated: ${background.elevated || '#ffffff'};

  /* Text Colors */
  --color-text-primary: ${text.primary || '#1f2937'};
  --color-text-secondary: ${text.secondary || '#6b7280'};
  --color-text-tertiary: ${text.tertiary || '#9ca3af'};
  --color-text-inverse: ${text.inverse || '#ffffff'};

  /* Dietary Colors */
  --color-veg-50: ${colors.dietary?.veg?.[50] || '#f0fdf4'};
  --color-veg-100: ${colors.dietary?.veg?.[100] || '#dcfce7'};
  --color-veg-500: ${colors.dietary?.veg?.[500] || '#22c55e'};
  --color-veg-600: ${colors.dietary?.veg?.[600] || '#16a34a'};
  --color-veg-700: ${colors.dietary?.veg?.[700] || '#15803d'};

  --color-non-veg-50: ${colors.dietary?.nonVeg?.[50] || '#fef2f2'};
  --color-non-veg-100: ${colors.dietary?.nonVeg?.[100] || '#fee2e2'};
  --color-non-veg-500: ${colors.dietary?.nonVeg?.[500] || '#ef4444'};
  --color-non-veg-600: ${colors.dietary?.nonVeg?.[600] || '#dc2626'};
  --color-non-veg-700: ${colors.dietary?.nonVeg?.[700] || '#b91c1c'};

  /* Voice State Colors */
  --color-voice-idle: ${colors.voiceStates?.idle || '#94a3b8'};
  --color-voice-listening: ${colors.voiceStates?.listening || '#0ea5e9'};
  --color-voice-thinking: ${colors.voiceStates?.thinking || '#f59e0b'};
  --color-voice-speaking: ${colors.voiceStates?.speaking || '#22c55e'};

  /* Status Colors */
  --color-success-500: ${colors.status?.success?.[500] || '#22c55e'};
  --color-warning-500: ${colors.status?.warning?.[500] || '#f59e0b'};
  --color-error-500: ${colors.status?.error?.[500] || '#ef4444'};
  --color-info-500: ${colors.status?.info?.[500] || '#3b82f6'};

  /* Typography */
  --font-family-sans: ${Array.isArray(tokens.typography?.fontFamily?.sans) ? tokens.typography.fontFamily.sans.join(', ') : (tokens.typography?.fontFamily?.sans || 'system-ui, sans-serif')};
  --font-size-xs: ${tokens.typography?.scale?.xs || '0.75rem'};
  --font-size-sm: ${tokens.typography?.scale?.sm || '0.875rem'};
  --font-size-base: ${tokens.typography?.scale?.base || '1rem'};
  --font-size-lg: ${tokens.typography?.scale?.lg || '1.125rem'};
  --font-size-xl: ${tokens.typography?.scale?.xl || '1.25rem'};
  --font-size-2xl: ${tokens.typography?.scale?.['2xl'] || '1.5rem'};
  --font-size-3xl: ${tokens.typography?.scale?.['3xl'] || '1.875rem'};
  --font-size-4xl: ${tokens.typography?.scale?.['4xl'] || '2.25rem'};

  --font-weight-normal: ${tokens.typography?.weights?.normal || 400};
  --font-weight-medium: ${tokens.typography?.weights?.medium || 500};
  --font-weight-semibold: ${tokens.typography?.weights?.semibold || 600};
  --font-weight-bold: ${tokens.typography?.weights?.bold || 700};

  /* Spacing */
  --spacing-0: ${tokens.spacing?.scale?.[0] || '0'};
  --spacing-1: ${tokens.spacing?.scale?.[1] || '4px'};
  --spacing-2: ${tokens.spacing?.scale?.[2] || '8px'};
  --spacing-3: ${tokens.spacing?.scale?.[3] || '12px'};
  --spacing-4: ${tokens.spacing?.scale?.[4] || '16px'};
  --spacing-6: ${tokens.spacing?.scale?.[6] || '24px'};
  --spacing-8: ${tokens.spacing?.scale?.[8] || '32px'};
  --spacing-12: ${tokens.spacing?.scale?.[12] || '48px'};
  --spacing-16: ${tokens.spacing?.scale?.[16] || '64px'};

  /* Border Radius */
  --radius-none: ${tokens.borderRadius?.none || '0'};
  --radius-sm: ${tokens.borderRadius?.sm || '0.25rem'};
  --radius-md: ${tokens.borderRadius?.md || '0.5rem'};
  --radius-lg: ${tokens.borderRadius?.lg || '0.75rem'};
  --radius-xl: ${tokens.borderRadius?.xl || '1rem'};
  --radius-2xl: ${tokens.borderRadius?.['2xl'] || '1.25rem'};
  --radius-full: ${tokens.borderRadius?.full || '9999px'};

  /* Shadows (Neumorphic) */
  --shadow-sm: ${tokens.shadows?.sm || '0 1px 2px rgba(0,0,0,0.05)'};
  --shadow-md: ${tokens.shadows?.md || '0 4px 6px rgba(0,0,0,0.1)'};
  --shadow-lg: ${tokens.shadows?.lg || '0 10px 15px rgba(0,0,0,0.1)'};
  --shadow-xl: ${tokens.shadows?.xl || '0 20px 25px rgba(0,0,0,0.1)'};
  --shadow-inner: ${tokens.shadows?.inner || 'inset 0 2px 4px rgba(0,0,0,0.05)'};

  /* Animation Durations */
  --duration-fast: ${tokens.animations?.duration?.fast || '150ms'};
  --duration-normal: ${tokens.animations?.duration?.normal || '300ms'};
  --duration-slow: ${tokens.animations?.duration?.slow || '500ms'};

  /* Animation Easing */
  --easing-ease: ${tokens.animations?.easing?.ease || 'ease'};
  --easing-ease-in: ${tokens.animations?.easing?.easeIn || 'cubic-bezier(0.4, 0, 1, 1)'};
  --easing-ease-out: ${tokens.animations?.easing?.easeOut || 'cubic-bezier(0, 0, 0.2, 1)'};
  --easing-ease-in-out: ${tokens.animations?.easing?.easeInOut || 'cubic-bezier(0.4, 0, 0.2, 1)'};
  --easing-spring: ${tokens.animations?.easing?.spring || 'cubic-bezier(0.34, 1.56, 0.64, 1)'};

  /* Legacy variables (for backwards compatibility with existing globals.css) */
  --neu-bg: var(--color-bg-main);
  --neu-surface: var(--color-bg-surface);
  --neu-text: var(--color-text-primary);
  --neu-text-secondary: var(--color-text-secondary);
  --neu-accent: var(--color-accent-500);
  --neu-accent-hover: var(--color-accent-600);
  --neu-success: var(--color-success-500);
  --neu-error: var(--color-error-500);

  --neu-shadow-light: ${tokens.shadows?.sm || '0 1px 2px rgba(0,0,0,0.05)'};
  --neu-shadow-dark: ${tokens.shadows?.md || '0 4px 6px rgba(0,0,0,0.1)'};
}
  `.trim();
}

/**
 * Inject CSS variables into document (client-side)
 */
export function injectCSSVariables(theme: MultimodalRestaurantTheme): void {
  if (typeof document === 'undefined') return;

  const css = generateCSSVariables(theme);

  // Remove existing theme style tag
  const existingStyle = document.getElementById('theme-variables');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create new style tag
  const styleTag = document.createElement('style');
  styleTag.id = 'theme-variables';
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
}
