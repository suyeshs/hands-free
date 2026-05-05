/**
 * Multimodal Travel Theme - Animation Templates
 * Airbnb-inspired smooth, elegant animations using Framer Motion
 */

import type { Variants, Transition } from 'framer-motion';

// ===========================
// Easing Functions (Airbnb-style)
// ===========================

export const AirbnbEasing = {
  // Smooth, natural easing
  default: [0.25, 0.46, 0.45, 0.94],
  // Slightly bouncy for interactive elements
  interactive: [0.34, 1.56, 0.64, 1],
  // Gentle for large movements
  gentle: [0.25, 0.1, 0.25, 1],
  // Quick for small movements
  quick: [0.4, 0, 0.2, 1],
} as const;

// ===========================
// Transition Presets
// ===========================

export const transitionPresets: Record<string, Transition> = {
  default: {
    duration: 0.3,
    ease: AirbnbEasing.default,
  },
  quick: {
    duration: 0.15,
    ease: AirbnbEasing.quick,
  },
  gentle: {
    duration: 0.5,
    ease: AirbnbEasing.gentle,
  },
  interactive: {
    duration: 0.4,
    ease: AirbnbEasing.interactive,
  },
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  },
  springGentle: {
    type: 'spring',
    stiffness: 200,
    damping: 25,
  },
};

// ===========================
// Card Animations
// ===========================

export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitionPresets.default,
  },
  hover: {
    y: -4,
    scale: 1.02,
    boxShadow: '0 8px 28px rgba(0, 0, 0, 0.15)',
    transition: transitionPresets.quick,
  },
  tap: {
    scale: 0.98,
    transition: transitionPresets.quick,
  },
};

// Staggered card list animation
export const cardListVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// ===========================
// Modal & Overlay Animations
// ===========================

export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitionPresets.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: transitionPresets.quick,
  },
};

export const backdropVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

// Bottom sheet (mobile)
export const bottomSheetVariants: Variants = {
  hidden: {
    y: '100%',
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: transitionPresets.springGentle,
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: transitionPresets.quick,
  },
};

// ===========================
// Voice Orb Animations
// ===========================

export const voiceOrbVariants: Variants = {
  idle: {
    scale: 1,
    opacity: 0.8,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
  },
  listening: {
    scale: [1, 1.1, 1],
    opacity: 1,
    boxShadow: [
      '0 4px 16px rgba(56, 189, 248, 0.3)',
      '0 8px 32px rgba(56, 189, 248, 0.5)',
      '0 4px 16px rgba(56, 189, 248, 0.3)',
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  thinking: {
    scale: [1, 1.05, 1],
    opacity: 1,
    rotate: [0, 5, -5, 0],
    boxShadow: [
      '0 4px 16px rgba(251, 191, 36, 0.3)',
      '0 8px 32px rgba(251, 191, 36, 0.5)',
      '0 4px 16px rgba(251, 191, 36, 0.3)',
    ],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  speaking: {
    scale: [1, 1.08, 1],
    opacity: 1,
    boxShadow: [
      '0 4px 16px rgba(52, 211, 153, 0.3)',
      '0 8px 32px rgba(52, 211, 153, 0.5)',
      '0 4px 16px rgba(52, 211, 153, 0.3)',
    ],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Voice visualizer bars
export const voiceVisualizerBarVariants: Variants = {
  idle: {
    scaleY: 0.3,
    opacity: 0.5,
  },
  active: {
    scaleY: [0.3, 1, 0.5, 1, 0.3],
    opacity: 1,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ===========================
// Fade Animations
// ===========================

export const fadeInVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: transitionPresets.default,
  },
  exit: {
    opacity: 0,
    transition: transitionPresets.quick,
  },
};

export const fadeInUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionPresets.default,
  },
};

export const fadeInDownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionPresets.default,
  },
};

// ===========================
// Slide Animations
// ===========================

export const slideInLeftVariants: Variants = {
  hidden: {
    x: -100,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: transitionPresets.default,
  },
  exit: {
    x: -100,
    opacity: 0,
    transition: transitionPresets.quick,
  },
};

export const slideInRightVariants: Variants = {
  hidden: {
    x: 100,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: transitionPresets.default,
  },
  exit: {
    x: 100,
    opacity: 0,
    transition: transitionPresets.quick,
  },
};

// ===========================
// Scale Animations
// ===========================

export const scaleInVariants: Variants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: transitionPresets.spring,
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: transitionPresets.quick,
  },
};

export const scaleBounceVariants: Variants = {
  hidden: {
    scale: 0,
  },
  visible: {
    scale: 1,
    transition: transitionPresets.interactive,
  },
};

// ===========================
// Loading & Progress Animations
// ===========================

export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const skeletonVariants: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ===========================
// Notification Animations
// ===========================

export const notificationVariants: Variants = {
  hidden: {
    x: 400,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: transitionPresets.springGentle,
  },
  exit: {
    x: 400,
    opacity: 0,
    transition: transitionPresets.quick,
  },
};

// ===========================
// Accordion/Collapse Animations
// ===========================

export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: transitionPresets.quick,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: transitionPresets.default,
  },
};

// ===========================
// Hero/Banner Animations
// ===========================

export const heroVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 1.1,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.8,
      ease: AirbnbEasing.gentle,
    },
  },
};

export const heroTextVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: 0.2,
      ease: AirbnbEasing.default,
    },
  },
};

// ===========================
// Tab Animations
// ===========================

export const tabContentVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitionPresets.quick,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: transitionPresets.quick,
  },
};

// ===========================
// Carousel Animations
// ===========================

export const carouselItemVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: transitionPresets.default,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    transition: transitionPresets.quick,
  }),
};

// ===========================
// Booking Island Animations
// ===========================

export const bookingIslandVariants: Variants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: transitionPresets.spring,
  },
  pulse: {
    scale: [1, 1.15, 1],
    transition: {
      duration: 0.4,
      ease: AirbnbEasing.interactive,
    },
  },
};

// ===========================
// Filter Panel Animations
// ===========================

export const filterPanelVariants: Variants = {
  hidden: {
    x: '-100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: transitionPresets.default,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: transitionPresets.quick,
  },
};

// ===========================
// Animation Presets Export
// ===========================

export const TravelAnimationPresets = {
  // Card animations
  card: cardVariants,
  cardList: cardListVariants,

  // Modal & overlay
  modal: modalVariants,
  backdrop: backdropVariants,
  bottomSheet: bottomSheetVariants,

  // Voice orb
  voiceOrb: voiceOrbVariants,
  voiceVisualizerBar: voiceVisualizerBarVariants,

  // Fade
  fadeIn: fadeInVariants,
  fadeInUp: fadeInUpVariants,
  fadeInDown: fadeInDownVariants,

  // Slide
  slideInLeft: slideInLeftVariants,
  slideInRight: slideInRightVariants,

  // Scale
  scaleIn: scaleInVariants,
  scaleBounce: scaleBounceVariants,

  // Loading
  spinner: spinnerVariants,
  pulse: pulseVariants,
  skeleton: skeletonVariants,

  // Notification
  notification: notificationVariants,

  // Accordion
  accordion: accordionVariants,

  // Hero
  hero: heroVariants,
  heroText: heroTextVariants,

  // Tab
  tabContent: tabContentVariants,

  // Carousel
  carouselItem: carouselItemVariants,

  // Booking island
  bookingIsland: bookingIslandVariants,

  // Filter panel
  filterPanel: filterPanelVariants,
} as const;

export type TravelAnimationPresets = typeof TravelAnimationPresets;
