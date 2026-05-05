/**
 * Handsfree Tech Theme - Main Module
 * Tech-oriented theme with voice and gesture controls
 *
 * @version 1.0.0
 * @author Stonepot Platform
 * @license MIT
 *
 * @features
 * - Voice-controlled navigation
 * - Gesture-based interactions
 * - Glassmorphism effects
 * - Holographic gradients
 * - Code/terminal displays
 * - Product showcases
 * - Scroll-driven animations
 * - Dark-first design
 */

// Types
export * from './types';

// Design Tokens
export * from './design-tokens';

// Animation Templates
export * from './animation-templates';

// Primitives
export * from './primitives';

// Layouts
export * from './layouts';

// Presets
export { HandsfreeDefaultTheme } from './presets/default';

// Default export
export { HandsfreeDefaultTheme as default } from './presets/default';

/**
 * Module metadata
 */
export const HANDSFREE_THEME_INFO = {
  name: 'Handsfree Tech Theme',
  version: '1.0.0',
  description: 'Modern tech-oriented theme with voice and gesture controls inspired by Music Zajno',
  author: 'Stonepot Platform',
  features: [
    'Voice-controlled navigation',
    'Gesture-based interactions',
    'Glassmorphism effects',
    'Holographic gradients',
    'Scroll-driven animations',
    'Code/terminal displays',
    'Product showcases',
    'WCAG AA accessibility',
    'Dark-first design',
    'GPU-accelerated animations',
  ],
  platforms: ['web', 'mobile', 'pwa'],
  frameworks: ['react', 'vanilla-js'],
  inspiration: ['Music Zajno', 'Linear', 'Stripe', 'Vercel'],
};
