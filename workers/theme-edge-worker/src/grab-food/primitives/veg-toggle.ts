/**
 * Veg Toggle Primitive - Dietary filter toggle
 *
 * Features:
 * - Toggle between "All" and "Veg" menu items
 * - Pill-style switcher design
 * - Positioned in category pills header
 * - Filters items client-side by dietary indicators
 */

import type { VegToggleComponent } from '../types';

export interface VegToggleOptions {
  name?: string;
  defaultFilter?: 'all' | 'veg' | 'non-veg';
  showVegIcon?: boolean;
  showNonVegIcon?: boolean;
  position?: 'category-header' | 'top-header' | 'search-bar';
}

export function createVegToggle(options: VegToggleOptions = {}): VegToggleComponent {
  const {
    name = 'Veg Toggle',
    defaultFilter = 'all',
    showVegIcon = true,
    showNonVegIcon = false,
    position = 'category-header',
  } = options;

  return {
    id: 'veg-toggle',
    type: 'veg-toggle',
    name,
    description: 'Dietary filter toggle for vegetarian/non-vegetarian items',
    category: 'input',
    dimensions: { width: 'auto', height: '32px' },
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '0.8125rem',
      fontWeight: 600,
      lineHeight: '1',
    },
    states: {},
    transitions: [],
    defaultState: 'default',
    interaction: { primary: 'touch', alternatives: [] },
    platform: 'web',
    frameworks: ['react'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['filter', 'dietary', 'toggle'],

    layout: {
      position,
      alignment: 'right',
    },

    options: [
      {
        id: 'all',
        label: 'All',
        icon: null,
        filter: null, // Show all items
        default: defaultFilter === 'all',
      },
      {
        id: 'veg',
        label: 'Veg',
        icon: showVegIcon ? '🟢' : null,
        filter: 'vegetarian', // Show only vegetarian items
        default: defaultFilter === 'veg',
      },
      ...(showNonVegIcon ? [{
        id: 'non-veg',
        label: 'Non-Veg',
        icon: '🔴',
        filter: 'non-vegetarian',
        default: defaultFilter === 'non-veg',
      }] : []),
    ],

    styling: {
      container: {
        backgroundColor: '#f3f4f6', // Grab light gray
        borderRadius: '24px',
        padding: '4px',
        gap: '4px',
      },
      option: {
        padding: '6px 16px',
        borderRadius: '20px',
        fontSize: 13,
        fontWeight: 600,
        color: '#1f2937',
        transition: '0.2s ease',
      },
      active: {
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      hover: {
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
      },
    },

    behavior: {
      filterMode: 'client-side', // Filter in browser
      animateTransition: true,
      persistSelection: true, // Remember user preference
      localStorageKey: 'khao-piyo-dietary-filter',
    },

    interactions: {
      onClick: 'toggle-filter',
      keyboardShortcut: 'v', // Press 'v' to toggle veg filter
    },

    accessibility: {
      role: 'radiogroup',
      ariaLabel: 'Filter menu by dietary preference',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Filter menu by dietary preference. Press V to toggle.',
    },
  };
}

/**
 * Veg-only toggle (simplified two-option toggle)
 */
export function createSimpleVegToggle(options: VegToggleOptions = {}): VegToggleComponent {
  return createVegToggle({
    ...options,
    showVegIcon: true,
    showNonVegIcon: false,
  });
}

/**
 * Full dietary toggle (All/Veg/Non-Veg)
 */
export function createFullDietaryToggle(options: VegToggleOptions = {}): VegToggleComponent {
  return createVegToggle({
    ...options,
    showVegIcon: true,
    showNonVegIcon: true,
  });
}
