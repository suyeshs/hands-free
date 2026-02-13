/**
 * Promo Carousel Component Primitive
 *
 * Factory function for creating promotional carousel with voice ordering
 * promos and specials announcements
 */

import type { PromoCarouselComponent, PromoItem, GradientConfig } from '../types';

export interface PromoCarouselOptions {
  id?: string;
  name?: string;
  height?: string;
  autoPlayInterval?: number;
  showIndicators?: boolean;
  showArrows?: boolean;
  position?: 'top' | 'bottom' | 'hero' | 'inline';
  items?: PromoItem[];
}

/**
 * Create a promotional carousel component
 */
export function createPromoCarousel(options: PromoCarouselOptions = {}): PromoCarouselComponent {
  const {
    id = 'promo-carousel-1',
    name = 'Promo Carousel',
    height = '160px',
    autoPlayInterval = 5000,
    showIndicators = true,
    showArrows = false,
    position = 'top',
    items = [],
  } = options;

  return {
    id,
    name,
    type: 'promo-carousel',
    description: 'Promotional carousel for voice ordering promos and specials',
    category: 'content',

    // Visual dimensions
    dimensions: {
      width: '100%',
      height,
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
      bottom: 16,
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: '1.4',
    },

    // Layout configuration
    layout: {
      height,
      aspectRatio: '3:1',
      gap: '12px',
      position,
    },

    // Auto-play configuration
    autoPlay: {
      enabled: true,
      interval: autoPlayInterval,
      pauseOnHover: true,
    },

    // Indicator dots
    indicators: {
      show: showIndicators,
      position: 'bottom-center',
      style: 'dots',
      activeColor: '#78350f',
      inactiveColor: 'rgba(120, 53, 15, 0.3)',
    },

    // Navigation arrows
    navigation: {
      showArrows,
      showOnHover: true,
      arrowStyle: 'circle',
    },

    // Touch/swipe gestures
    gestures: {
      swipe: true,
      momentum: true,
    },

    // Promotional items
    items,

    // States (neumorphic)
    states: {
      default: {
        colors: {
          background: 'transparent',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
      hover: {
        colors: {
          background: 'transparent',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
      active: {
        colors: {
          background: 'transparent',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
      pressed: {
        colors: {
          background: 'transparent',
          text: '#1e293b',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
      focused: {
        colors: {
          background: 'transparent',
          text: '#1e293b',
          border: '#0ea5e9',
        },
        shadows: {
          outer: '0 0 0 3px rgba(14, 165, 233, 0.3)',
          inner: 'none',
        },
        border: {
          width: '2px',
          style: 'solid',
          radius: '1rem',
        },
      },
      disabled: {
        colors: {
          background: 'transparent',
          text: '#cbd5e1',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
      loading: {
        colors: {
          background: 'transparent',
          text: '#94a3b8',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
      error: {
        colors: {
          background: 'transparent',
          text: '#b91c1c',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
      success: {
        colors: {
          background: 'transparent',
          text: '#15803d',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '1rem',
        },
      },
    },

    // Transitions
    transitions: [
      {
        from: 'default',
        to: 'hover',
        animation: { duration: 200, easing: 'ease-out' },
        haptic: false,
      },
    ],

    defaultState: 'default',

    // Interaction
    interaction: {
      primary: 'touch',
      alternatives: ['keyboard'],
    },

    // Accessibility
    accessibility: {
      role: 'region',
      ariaLabel: 'Promotional announcements carousel',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Carousel with promotional announcements and offers',
    },

    // Metadata
    platform: 'web',
    frameworks: ['react'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['promo', 'carousel', 'announcements', 'voice-ordering'],
  };
}

/**
 * Create a voice ordering promo item
 */
export function createVoicePromoItem(options: {
  id?: string;
  primaryColor?: string;
  accentColor?: string;
} = {}): PromoItem {
  const {
    id = 'voice-promo-1',
    primaryColor = '#78350f',
    accentColor = '#c9a87a',
  } = options;

  return {
    id,
    type: 'voice-promo',
    title: 'Try Voice Ordering!',
    subtitle: 'Order in English or Hindi',
    description: 'Just tap the microphone and tell us what you\'d like',
    icon: '🎤',
    backgroundColor: '#faf8f5',
    textColor: primaryColor,
    accentColor,
    gradient: {
      from: '#faf8f5',
      to: '#f5f0e8',
      direction: 'to-br',
    },
    action: {
      type: 'action',
      target: 'start-voice-ordering',
      label: 'Start Voice Order',
    },
    badge: {
      text: 'NEW',
      color: accentColor,
    },
  };
}

/**
 * Create a specials promo item
 */
export function createSpecialsPromoItem(options: {
  id?: string;
  title?: string;
  description?: string;
  primaryColor?: string;
  accentColor?: string;
} = {}): PromoItem {
  const {
    id = 'specials-1',
    title = "Today's Specials",
    description = 'Check out our chef\'s recommendations',
    primaryColor = '#78350f',
    accentColor = '#c9a87a',
  } = options;

  return {
    id,
    type: 'special',
    title,
    subtitle: 'Limited time offers',
    description,
    icon: '⭐',
    backgroundColor: '#f5f0e8',
    textColor: primaryColor,
    accentColor,
    gradient: {
      from: '#f5f0e8',
      to: '#ebe0d0',
      direction: 'to-br',
    },
    action: {
      type: 'link',
      target: '/specials',
      label: 'View Specials',
    },
    badge: {
      text: 'HOT',
      color: '#ef4444',
    },
  };
}

/**
 * Create a custom announcement item
 */
export function createAnnouncementItem(options: {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
  gradient?: GradientConfig;
}): PromoItem {
  return {
    id: options.id,
    type: 'announcement',
    title: options.title,
    subtitle: options.subtitle,
    description: options.description,
    icon: options.icon || '📢',
    backgroundColor: options.backgroundColor || '#faf8f5',
    textColor: options.textColor || '#78350f',
    gradient: options.gradient,
  };
}
