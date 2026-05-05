/**
 * Multimodal Restaurant Theme - Layout Configurations
 *
 * Pre-built layout configurations for landing, voice-assisted, and standard browse modes
 */

import type {
  LandingLayoutConfig,
  VoiceAssistedLayoutConfig,
  StandardBrowseLayoutConfig,
} from '../types';

/**
 * Two-Path Landing Layout
 * Presents users with a choice between voice-assisted and standard browsing
 */
export const TwoPathLandingLayout: LandingLayoutConfig = {
  type: 'two-path',

  choiceCards: {
    voice: {
      label: 'Voice Ordering',
      description: 'Order naturally with your voice',
      icon: '🎤',
      gradient: {
        from: '#e6f0ff',
        to: '#dae5f5',
        direction: 'to-br',
      },
      benefits: [
        'Hands-free ordering',
        'Natural conversation',
        'Real-time suggestions',
        'Faster checkout',
      ],
    },
    standard: {
      label: 'Browse Menu',
      description: 'Traditional menu browsing',
      icon: '👆',
      gradient: {
        from: '#fff3e6',
        to: '#ffe8d5',
        direction: 'to-br',
      },
      benefits: [
        'Visual menu exploration',
        'Detailed dish information',
        'Filter and search',
        'Compare options',
      ],
    },
  },

  features: {
    show: true,
    items: [
      {
        icon: '⚡',
        title: 'Fast & Easy',
        description: 'Quick ordering with instant confirmation',
      },
      {
        icon: '🎯',
        title: 'Smart Suggestions',
        description: 'Personalized recommendations based on preferences',
      },
      {
        icon: '🌍',
        title: 'Multi-Language',
        description: 'Order in your preferred language',
      },
    ],
  },
};

/**
 * Menu-First Landing Layout
 * Shows menu immediately with voice FAB
 */
export const MenuFirstLandingLayout: LandingLayoutConfig = {
  type: 'menu-first',

  hero: {
    showLogo: true,
    showTagline: true,
    height: 'sm',
  },

  features: {
    show: false,
    items: [],
  },
};

/**
 * Split-View Voice-Assisted Layout
 * Voice panel on left, visual feed on right
 */
export const SplitViewVoiceLayout: VoiceAssistedLayoutConfig = {
  type: 'split-view',

  voicePanel: {
    width: 'medium',  // 40%
    position: 'left',
    showTranscript: true,
    showCartSummary: true,
  },

  voiceOrb: {
    size: 'lg',  // 96px
    position: 'floating',
    showLabel: true,
    showVisualizer: true,
    pulseAnimation: 'medium',
  },

  visualFeed: {
    showCategories: true,
    highlightMentioned: true,
    autoScroll: true,
    gridColumns: {
      mobile: 1,
      tablet: 2,
      desktop: 2,
    },
  },

  dishModal: {
    position: 'center',
    size: 'md',
    backdrop: 'blur',
  },
};

/**
 * Overlay Voice-Assisted Layout
 * Full menu with contextual voice overlays
 */
export const OverlayVoiceLayout: VoiceAssistedLayoutConfig = {
  type: 'overlay',

  voiceOrb: {
    size: 'md',  // 80px
    position: 'bottom-right',
    showLabel: true,
    showVisualizer: true,
    pulseAnimation: 'strong',
  },

  visualFeed: {
    showCategories: true,
    highlightMentioned: true,
    autoScroll: true,
    gridColumns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    },
  },

  dishModal: {
    position: 'center',
    size: 'lg',
    backdrop: 'blur',
  },
};

/**
 * Immersive Voice-Assisted Layout
 * Voice-first with minimal visual distractions
 */
export const ImmersiveVoiceLayout: VoiceAssistedLayoutConfig = {
  type: 'immersive',

  voiceOrb: {
    size: 'lg',  // 96px
    position: 'bottom-center',
    showLabel: true,
    showVisualizer: true,
    pulseAnimation: 'strong',
  },

  visualFeed: {
    showCategories: false,
    highlightMentioned: true,
    autoScroll: true,
    gridColumns: {
      mobile: 1,
      tablet: 1,
      desktop: 1,
    },
  },

  dishModal: {
    position: 'center',
    size: 'lg',
    backdrop: 'dark',
  },
};

/**
 * Enhanced Grid Standard Browse Layout
 * Traditional grid with advanced filters
 */
export const EnhancedGridBrowseLayout: StandardBrowseLayoutConfig = {
  type: 'grid',

  categoryNav: {
    type: 'carousel',
    position: 'sticky',
    showIcons: true,
    showCount: true,
  },

  menuGrid: {
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    },
    gap: '1.5rem',
    cardSize: 'comfortable',
  },

  filters: {
    show: true,
    position: 'top',
    options: [
      { type: 'dietary', label: 'Dietary', enabled: true },
      { type: 'price', label: 'Price Range', enabled: true },
      { type: 'rating', label: 'Rating', enabled: true },
      { type: 'spice', label: 'Spice Level', enabled: true },
    ],
  },

  search: {
    show: true,
    position: 'header',
    placeholder: 'Search dishes...',
  },
};

/**
 * Magazine-Style Standard Browse Layout
 * Visual-first with editorial presentation
 */
export const MagazineBrowseLayout: StandardBrowseLayoutConfig = {
  type: 'magazine',

  categoryNav: {
    type: 'tabs',
    position: 'top',
    showIcons: false,
    showCount: false,
  },

  menuGrid: {
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    },
    gap: '2rem',
    cardSize: 'spacious',
  },

  filters: {
    show: true,
    position: 'sidebar',
    options: [
      { type: 'dietary', label: 'Dietary Preferences', enabled: true },
      { type: 'category', label: 'Categories', enabled: true },
    ],
  },

  search: {
    show: true,
    position: 'top',
    placeholder: 'What are you craving?',
  },
};

/**
 * Tabbed Dashboard Standard Browse Layout
 * App-like interface with full category switching
 */
export const TabbedDashboardBrowseLayout: StandardBrowseLayoutConfig = {
  type: 'tabbed',

  categoryNav: {
    type: 'tabs',
    position: 'top',
    showIcons: true,
    showCount: true,
  },

  menuGrid: {
    columns: {
      mobile: 1,
      tablet: 1,
      desktop: 1,
    },
    gap: '1rem',
    cardSize: 'compact',
  },

  filters: {
    show: true,
    position: 'modal',
    options: [
      { type: 'dietary', label: 'Dietary', enabled: true },
      { type: 'price', label: 'Price', enabled: true },
      { type: 'rating', label: 'Rating', enabled: true },
      { type: 'spice', label: 'Spice Level', enabled: true },
    ],
  },

  search: {
    show: true,
    position: 'header',
    placeholder: 'Search menu...',
  },
};

/**
 * Default layouts export
 */
export const DefaultLayouts = {
  landing: TwoPathLandingLayout,
  voiceAssisted: SplitViewVoiceLayout,
  standardBrowse: EnhancedGridBrowseLayout,
};

/**
 * Get layout by name
 */
export function getLayout(
  type: 'landing' | 'voice-assisted' | 'standard-browse',
  variant?: string
): LandingLayoutConfig | VoiceAssistedLayoutConfig | StandardBrowseLayoutConfig {
  if (type === 'landing') {
    switch (variant) {
      case 'menu-first':
        return MenuFirstLandingLayout;
      case 'two-path':
      default:
        return TwoPathLandingLayout;
    }
  }

  if (type === 'voice-assisted') {
    switch (variant) {
      case 'overlay':
        return OverlayVoiceLayout;
      case 'immersive':
        return ImmersiveVoiceLayout;
      case 'split-view':
      default:
        return SplitViewVoiceLayout;
    }
  }

  if (type === 'standard-browse') {
    switch (variant) {
      case 'magazine':
        return MagazineBrowseLayout;
      case 'tabbed':
        return TabbedDashboardBrowseLayout;
      case 'grid':
      default:
        return EnhancedGridBrowseLayout;
    }
  }

  return TwoPathLandingLayout;
}
