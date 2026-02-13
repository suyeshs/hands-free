/**
 * Grab Food - Search Bar Component
 *
 * Sticky search bar with voice input, filter chips, and suggestions.
 * Mobile-optimized for restaurant and dish searches.
 */

import type { SearchBarComponent, FilterChip } from '../types';

export interface SearchBarOptions {
  id?: string;
  name?: string;
  placeholder?: string;
  showVoiceButton?: boolean;
  showFilters?: boolean;
  sticky?: boolean;
}

/**
 * Create a search bar component
 */
export function createSearchBar(
  options: SearchBarOptions = {}
): SearchBarComponent {
  const defaultFilterOptions: FilterChip[] = [
    {
      id: 'cuisine',
      label: 'Cuisine',
      type: 'cuisine',
      options: ['Asian', 'Italian', 'Mexican', 'Indian', 'Chinese', 'Thai'],
    },
    {
      id: 'price',
      label: 'Price',
      icon: '💰',
      type: 'price',
      options: ['$', '$$', '$$$', '$$$$'],
    },
    {
      id: 'rating',
      label: 'Rating',
      icon: '⭐',
      type: 'rating',
      options: ['4+', '4.5+'],
    },
    {
      id: 'delivery-time',
      label: 'Delivery Time',
      icon: '⚡',
      type: 'delivery-time',
      options: ['Fast (< 30 min)', 'Normal'],
    },
    {
      id: 'offers',
      label: 'Offers',
      icon: '🏷️',
      type: 'offers',
      options: ['Free Delivery', 'Discounts', 'New User'],
    },
  ];

  const {
    id = 'search-bar-1',
    name = 'Search Bar',
    placeholder = 'Search for restaurants or dishes',
    showVoiceButton = true,
    showFilters = true,
    sticky = true,
  } = options;

  return {
    id,
    name,
    type: 'search-bar',
    description: 'Search bar with voice input and filter chips',
    category: 'input',

    dimensions: {
      width: '100%',
      height: '48px',
    },

    padding: {
      top: 8,
      right: 16,
      bottom: 8,
      left: 16,
    },

    margin: {
      top: 0,
      right: 0,
      bottom: 12,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: '1.5',
    },

    layout: {
      position: sticky ? 'sticky' : 'static',
      height: '48px',
      backgroundColor: '#ffffff',
    },

    input: {
      placeholder,
      showIcon: true,
      showClearButton: true,
      showVoiceButton,
      autofocus: false,
    },

    filters: {
      show: showFilters,
      style: 'chips',
      options: defaultFilterOptions,
    },

    suggestions: {
      show: true,
      showHistory: true,
      showTrending: true,
      maxItems: 5,
    },

    states: {
      default: {
        colors: {
          background: '#f3f4f6',
          text: '#1f2937',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '0.5rem',
        },
      },
      focused: {
        colors: {
          background: '#ffffff',
          text: '#1f2937',
          border: '#00B14F',
        },
        shadows: {
          outer: '0 2px 8px rgba(0, 0, 0, 0.08)',
          inner: 'none',
        },
        border: {
          width: '1px',
          style: 'solid',
          radius: '0.5rem',
        },
      },
    },

    transitions: [
      {
        from: 'default',
        to: 'focused',
        animation: { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        haptic: false,
      },
    ],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['voice', 'keyboard'],
      touch: {
        minTouchSize: { width: 320, height: 48 },
        haptic: 'light',
      },
      voice: [
        {
          triggers: ['search', 'find', 'show'],
          action: 'search',
          feedback: 'Searching',
          visualIndicator: true,
        },
      ],
    },

    accessibility: {
      role: 'search',
      ariaLabel: 'Search restaurants and dishes',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Search bar with voice input and filter options',
    },

    platform: 'both',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['search', 'input', 'voice', 'filter', 'chips'],
  };
}
