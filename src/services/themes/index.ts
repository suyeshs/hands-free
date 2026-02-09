/**
 * Theme Services - Public API
 * Exports all theme-related services and utilities
 */

// Core theme manager
export { themeManager, ThemeManager } from './themeManager';

// Color utilities
export {
  generateColorPalette,
  generateForegroundColor,
  getContrastRatio,
  meetsWCAG_AA,
  meetsWCAG_AAA,
  ensureContrast,
  generateColorScale,
  lighten,
  darken,
  saturate,
  desaturate,
  addAlpha,
  getLuminance,
  convertColor,
  mixColors,
  getColorTemperature,
  generateGradient,
  getColorName,
  isValidColor,
} from './colorUtils';

// Logo color extraction
export {
  extractColorsFromImage,
  extractColorsFromLogoUrl,
  extractColorsFromFile,
  suggestThemeCategory,
} from './logoColorExtractor';

// Theme generation
export {
  generateThemeFromColor,
  generateThemeFromLogo,
  generateThemeVariations,
  generateKDSTheme,
  exportTheme,
} from './themeGenerator';

// Types
export type { ExtractedColors, ColorSwatch } from './logoColorExtractor';
export type {
  GenerateThemeOptions,
  GenerateThemeFromLogoOptions,
} from './themeGenerator';
