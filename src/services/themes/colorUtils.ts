/**
 * Color Manipulation Utilities
 * Uses Chroma.js for color operations, palette generation, and accessibility
 */

import chroma from 'chroma-js';

/**
 * Generate a complete color palette from a primary color
 * Returns semantically named colors for a theme
 */
export function generateColorPalette(primaryColor: string) {
  const primary = chroma(primaryColor);

  // Generate shades of the primary color
  const primaryScale = chroma.scale([
    primary.brighten(2),
    primary,
    primary.darken(2)
  ]).mode('lab').colors(5);

  // Generate complementary colors
  const complementary = chroma(primaryColor).set('hsl.h', '+180');
  const analogous1 = chroma(primaryColor).set('hsl.h', '+30');
  const analogous2 = chroma(primaryColor).set('hsl.h', '-30');
  const triadic1 = chroma(primaryColor).set('hsl.h', '+120');
  const triadic2 = chroma(primaryColor).set('hsl.h', '+240');

  // Generate accent color (slightly lighter/more saturated)
  const accent = primary.saturate(0.5).brighten(0.3);

  // Generate secondary (desaturated version)
  const secondary = primary.desaturate(1.5).brighten(1);

  // Generate neutral grays
  const neutrals = chroma.scale(['#ffffff', '#1a1a1a']).mode('lab').colors(10);

  return {
    // Primary color scale
    primary: {
      lightest: primaryScale[0],
      light: primaryScale[1],
      base: primaryScale[2],
      dark: primaryScale[3],
      darkest: primaryScale[4],
    },

    // Accent color
    accent: {
      base: accent.hex(),
      light: accent.brighten(0.5).hex(),
      dark: accent.darken(0.5).hex(),
    },

    // Secondary color
    secondary: {
      base: secondary.hex(),
      light: secondary.brighten(0.5).hex(),
      dark: secondary.darken(0.5).hex(),
    },

    // Complementary colors
    complementary: complementary.hex(),
    analogous: [analogous1.hex(), analogous2.hex()],
    triadic: [triadic1.hex(), triadic2.hex()],

    // Neutral grays
    neutrals: {
      white: neutrals[0],
      gray100: neutrals[1],
      gray200: neutrals[2],
      gray300: neutrals[3],
      gray400: neutrals[4],
      gray500: neutrals[5],
      gray600: neutrals[6],
      gray700: neutrals[7],
      gray800: neutrals[8],
      black: neutrals[9],
    },

    // Status colors (generated from primary)
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      destructive: '#ef4444',
      info: primary.set('hsl.h', '210').hex(),
    },
  };
}

/**
 * Generate foreground color with proper contrast
 * Ensures WCAG AA compliance (4.5:1 contrast ratio)
 */
export function generateForegroundColor(backgroundColor: string): string {
  const bg = chroma(backgroundColor);
  const luminance = bg.luminance();

  // If background is dark, return light foreground
  if (luminance < 0.5) {
    return '#ffffff';
  }

  // If background is light, return dark foreground
  return '#1a1d23';
}

/**
 * Check contrast ratio between two colors
 * Returns the WCAG contrast ratio
 */
export function getContrastRatio(color1: string, color2: string): number {
  return chroma.contrast(color1, color2);
}

/**
 * Check if color combination meets WCAG AA standard (4.5:1)
 */
export function meetsWCAG_AA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

/**
 * Check if color combination meets WCAG AAA standard (7:1)
 */
export function meetsWCAG_AAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 7;
}

/**
 * Adjust color to meet minimum contrast ratio
 */
export function ensureContrast(
  foreground: string,
  background: string,
  minRatio: number = 4.5
): string {
  let adjusted = chroma(foreground);
  const bg = chroma(background);
  let ratio = chroma.contrast(adjusted, bg);

  // If contrast is already sufficient, return original
  if (ratio >= minRatio) {
    return foreground;
  }

  // Determine if we need to lighten or darken
  const shouldLighten = bg.luminance() < 0.5;

  // Iteratively adjust until we meet the ratio
  let attempts = 0;
  const maxAttempts = 20;

  while (ratio < minRatio && attempts < maxAttempts) {
    if (shouldLighten) {
      adjusted = adjusted.brighten(0.2);
    } else {
      adjusted = adjusted.darken(0.2);
    }
    ratio = chroma.contrast(adjusted, bg);
    attempts++;
  }

  return adjusted.hex();
}

/**
 * Generate a color scale between two colors
 */
export function generateColorScale(
  startColor: string,
  endColor: string,
  steps: number = 10
): string[] {
  return chroma.scale([startColor, endColor]).mode('lab').colors(steps);
}

/**
 * Lighten a color by a certain amount (0-1)
 */
export function lighten(color: string, amount: number = 0.5): string {
  return chroma(color).brighten(amount).hex();
}

/**
 * Darken a color by a certain amount (0-1)
 */
export function darken(color: string, amount: number = 0.5): string {
  return chroma(color).darken(amount).hex();
}

/**
 * Saturate a color by a certain amount (0-1)
 */
export function saturate(color: string, amount: number = 0.5): string {
  return chroma(color).saturate(amount).hex();
}

/**
 * Desaturate a color by a certain amount (0-1)
 */
export function desaturate(color: string, amount: number = 0.5): string {
  return chroma(color).desaturate(amount).hex();
}

/**
 * Add alpha transparency to a color
 */
export function addAlpha(color: string, alpha: number): string {
  return chroma(color).alpha(alpha).css();
}

/**
 * Get color's luminance (0-1)
 */
export function getLuminance(color: string): number {
  return chroma(color).luminance();
}

/**
 * Convert color to different formats
 */
export function convertColor(color: string) {
  const c = chroma(color);
  return {
    hex: c.hex(),
    rgb: c.css(),
    rgba: c.css(),
    hsl: c.css('hsl'),
    lab: c.lab(),
    luminance: c.luminance(),
  };
}

/**
 * Mix two colors
 */
export function mixColors(color1: string, color2: string, ratio: number = 0.5): string {
  return chroma.mix(color1, color2, ratio, 'lab').hex();
}

/**
 * Get color temperature (warm vs cool)
 * Returns 'warm' or 'cool'
 */
export function getColorTemperature(color: string): 'warm' | 'cool' | 'neutral' {
  const [h] = chroma(color).hsl();

  // Hue ranges (in degrees):
  // Warm: 0-60 (red-yellow) and 300-360 (magenta-red)
  // Cool: 180-300 (cyan-blue-violet)
  // Neutral: 60-180 (yellow-green-cyan)

  if ((h >= 0 && h <= 60) || (h >= 300 && h <= 360)) {
    return 'warm';
  } else if (h >= 180 && h <= 300) {
    return 'cool';
  }
  return 'neutral';
}

/**
 * Generate gradient CSS from color array
 */
export function generateGradient(colors: string[], direction: string = '135deg'): string {
  return `linear-gradient(${direction}, ${colors.join(', ')})`;
}

/**
 * Get readable color name/description
 */
export function getColorName(color: string): string {
  const c = chroma(color);
  const [h, s, l] = c.hsl();

  // Determine lightness
  let lightness = '';
  if (l < 0.2) lightness = 'Very Dark';
  else if (l < 0.4) lightness = 'Dark';
  else if (l < 0.6) lightness = 'Medium';
  else if (l < 0.8) lightness = 'Light';
  else lightness = 'Very Light';

  // Determine hue name
  let hueName = '';
  if (s < 0.1) hueName = 'Gray';
  else if (h >= 0 && h < 30) hueName = 'Red';
  else if (h >= 30 && h < 60) hueName = 'Orange';
  else if (h >= 60 && h < 90) hueName = 'Yellow';
  else if (h >= 90 && h < 150) hueName = 'Green';
  else if (h >= 150 && h < 210) hueName = 'Cyan';
  else if (h >= 210 && h < 270) hueName = 'Blue';
  else if (h >= 270 && h < 330) hueName = 'Purple';
  else hueName = 'Pink';

  return `${lightness} ${hueName}`;
}

/**
 * Validate if string is a valid color
 */
export function isValidColor(color: string): boolean {
  try {
    chroma(color);
    return true;
  } catch {
    return false;
  }
}
