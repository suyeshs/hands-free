/**
 * Category Accordion Component
 *
 * Expandable accordion for hierarchical menu navigation:
 * - Top level: Category pills (horizontal scroll, sticky)
 * - Mid level: Sub-category accordion (expand/collapse)
 * - Bottom level: Item cards (2-column grid)
 *
 * Based on Grab Food design with smooth animations
 */

import type { BaseComponent } from '../types';

export interface CategoryAccordionConfig {
  name?: string;
  variant?: 'accordion' | 'tabs' | 'list';
  singleExpand?: boolean; // Only one sub-category expanded at a time
  defaultExpanded?: boolean; // All sub-categories expanded by default
  showItemCount?: boolean; // Show item count in sub-category header
  expandIcon?: string;
  collapseIcon?: string;
  enableLazyLoad?: boolean; // Lazy load items when expanded
  showCategoryIcons?: boolean;
}

export function createCategoryAccordion(
  config: CategoryAccordionConfig = {}
): BaseComponent {
  const {
    name = 'Category Accordion',
    variant = 'accordion',
    singleExpand = false,
    defaultExpanded = false,
    showItemCount = true,
    expandIcon = '▼',
    collapseIcon = '▲',
    enableLazyLoad = true,
    showCategoryIcons = true,
  } = config;

  return {
    id: 'category-accordion',
    name,
    type: 'accordion',
    description: 'Hierarchical menu navigation with expandable sub-categories',
    category: 'navigation',

    dimensions: {
      width: '100%',
      height: 'auto',
    },

    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: '1.5',
    },

    // Configuration
    config: {
      variant,
      singleExpand,
      defaultExpanded,
      showItemCount,
      expandIcon,
      collapseIcon,
      enableLazyLoad,
      showCategoryIcons,
    },

    // Styling
    style: {
      // Category header
      categoryHeader: {
        padding: '16px',
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        sticky: true,
        stickyTop: '0',
        zIndex: 90,
      },

      // Sub-category header
      subCategoryHeader: {
        padding: '12px 16px',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        hover: {
          background: '#f3f4f6',
        },
      },

      // Sub-category content
      subCategoryContent: {
        padding: '16px',
        background: '#ffffff',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
      },

      // Expand/collapse icon
      expandIcon: {
        fontSize: '12px',
        color: '#6b7280',
        transition: 'transform 0.3s ease',
        transformExpanded: 'rotate(180deg)',
      },

      // Item count badge
      itemCount: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#6b7280',
        background: '#f3f4f6',
        padding: '4px 8px',
        borderRadius: '12px',
      },
    },

    // Animations
    animations: {
      expand: {
        duration: 300,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        keyframes: {
          from: {
            maxHeight: '0',
            opacity: '0',
          },
          to: {
            maxHeight: '1000px', // Large enough for most content
            opacity: '1',
          },
        },
      },
      collapse: {
        duration: 250,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        keyframes: {
          from: {
            maxHeight: '1000px',
            opacity: '1',
          },
          to: {
            maxHeight: '0',
            opacity: '0',
          },
        },
      },
    },

    // States
    states: {
      default: {
        expanded: defaultExpanded,
      },
      expanded: {
        icon: collapseIcon,
      },
      collapsed: {
        icon: expandIcon,
      },
    },

    // Transitions
    transitions: [
      {
        from: 'collapsed',
        to: 'expanded',
        trigger: 'click',
        animation: 'expand',
      },
      {
        from: 'expanded',
        to: 'collapsed',
        trigger: 'click',
        animation: 'collapse',
      },
    ],

    defaultState: 'collapsed',

    // Interaction
    interaction: {
      primary: 'touch',
      alternatives: ['voice', 'keyboard'],
    },

    // Accessibility
    accessibility: {
      role: 'region',
      ariaLabel: 'Menu categories',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Expandable menu categories with sub-sections',
      ariaExpanded: false,
    },

    // Platform support
    platform: 'web',
    frameworks: ['react', 'react-native'],

    // Metadata
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['category', 'accordion', 'hierarchical', 'navigation'],
  };
}

/**
 * Export factory function
 */
export default createCategoryAccordion;
