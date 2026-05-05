/**
 * Animation Templates for Multimodal Restaurant Theme
 *
 * Pre-configured Framer Motion animation variants for common UI patterns
 * Organized by: Page Transitions, Element Transitions, Interaction Patterns
 */

import type { MotionVariant, MotionVariants } from './types';

/**
 * PAGE TRANSITION ANIMATIONS
 * For navigating between major screens (Landing → Voice/Browse → Cart → Checkout)
 */
export const PageTransitions: MotionVariants = {
  /**
   * Landing page entry - elegant fade + scale
   */
  landingEntry: {
    initial: { opacity: 0, scale: 0.95 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      scale: 1.05,
      transition: { duration: 0.3 },
    },
  },

  /**
   * Slide from right - for forward navigation (Landing → Browse)
   */
  slideInRight: {
    initial: { x: '100%', opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    exit: {
      x: '-100%',
      opacity: 0,
      transition: { duration: 0.3 },
    },
  },

  /**
   * Slide from left - for backward navigation (Browse → Landing)
   */
  slideInLeft: {
    initial: { x: '-100%', opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    exit: {
      x: '100%',
      opacity: 0,
      transition: { duration: 0.3 },
    },
  },

  /**
   * Slide up from bottom - for modal pages (Cart overlay)
   */
  slideUpModal: {
    initial: { y: '100%', opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
    exit: {
      y: '100%',
      opacity: 0,
      transition: {
        type: 'tween',
        duration: 0.3,
        ease: 'easeIn',
      },
    },
  },

  /**
   * Fade cross-dissolve - for subtle page changes
   */
  crossFade: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.4, ease: 'easeInOut' },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
  },

  /**
   * Voice mode activation - scale + blur effect
   */
  voiceModeActivation: {
    initial: { scale: 1, filter: 'blur(0px)' },
    animate: {
      scale: 0.95,
      filter: 'blur(4px)',
      transition: { duration: 0.3 },
    },
    exit: {
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.3 },
    },
  },
};

/**
 * ELEMENT TRANSITION ANIMATIONS
 * For individual UI components appearing/disappearing
 */
export const ElementTransitions: MotionVariants = {
  /**
   * Menu card entry - stagger from bottom
   */
  menuCardEntry: {
    initial: { y: 30, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 20,
      },
    },
    exit: {
      y: -30,
      opacity: 0,
      transition: { duration: 0.2 },
    },
    whileHover: {
      y: -4,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Category pill entry - slide + fade
   */
  categoryPillEntry: {
    initial: { x: -20, opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    exit: {
      x: 20,
      opacity: 0,
      transition: { duration: 0.2 },
    },
    whileHover: {
      scale: 1.05,
      transition: { duration: 0.15 },
    },
    whileTap: {
      scale: 0.95,
    },
  },

  /**
   * Voice orb appearance - scale + glow
   */
  voiceOrbEntry: {
    initial: { scale: 0, opacity: 0 },
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 15,
        delay: 0.2,
      },
    },
    exit: {
      scale: 0,
      opacity: 0,
      transition: { duration: 0.3 },
    },
  },

  /**
   * Cart island pop-in - bounce effect
   */
  cartIslandEntry: {
    initial: { scale: 0, y: 50, opacity: 0 },
    animate: {
      scale: 1,
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 500,
        damping: 25,
      },
    },
    exit: {
      scale: 0,
      y: 50,
      opacity: 0,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Modal/overlay backdrop - fade
   */
  backdropFade: {
    initial: { opacity: 0, backdropFilter: 'blur(0px)' },
    animate: {
      opacity: 1,
      backdropFilter: 'blur(8px)',
      transition: { duration: 0.3 },
    },
    exit: {
      opacity: 0,
      backdropFilter: 'blur(0px)',
      transition: { duration: 0.2 },
    },
  },

  /**
   * Dish detail modal - scale + slide up
   */
  dishModalEntry: {
    initial: { scale: 0.9, y: 50, opacity: 0 },
    animate: {
      scale: 1,
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
    exit: {
      scale: 0.9,
      y: 50,
      opacity: 0,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Badge/tag appearance - pop
   */
  badgePop: {
    initial: { scale: 0, rotate: -10 },
    animate: {
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring',
        stiffness: 500,
        damping: 15,
      },
    },
    exit: {
      scale: 0,
      rotate: 10,
      transition: { duration: 0.15 },
    },
  },

  /**
   * Toast notification - slide from top
   */
  toastEntry: {
    initial: { y: -100, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 25,
      },
    },
    exit: {
      y: -100,
      opacity: 0,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Progress indicator - grow
   */
  progressGrow: {
    initial: { scale: 0, rotate: -180 },
    animate: {
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  },
};

/**
 * INTERACTION ANIMATIONS
 * For hover, tap, focus, and voice feedback
 */
export const InteractionAnimations: MotionVariants = {
  /**
   * Button press - subtle scale down
   */
  buttonPress: {
    whileTap: {
      scale: 0.95,
      transition: { duration: 0.1 },
    },
    whileHover: {
      scale: 1.02,
      y: -2,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Card lift on hover
   */
  cardLift: {
    whileHover: {
      y: -8,
      scale: 1.02,
      boxShadow: '-12px -12px 24px rgba(255,255,255,0.8), 12px 12px 24px rgba(0,0,0,0.15)',
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      },
    },
    whileTap: {
      scale: 0.98,
      transition: { duration: 0.1 },
    },
  },

  /**
   * Voice orb pulse - continuous animation
   */
  voiceOrbPulse: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [1, 0.9, 1],
      boxShadow: [
        '0 0 0 0 rgba(59, 130, 246, 0.4)',
        '0 0 0 20px rgba(59, 130, 246, 0)',
        '0 0 0 0 rgba(59, 130, 246, 0)',
      ],
    },
    transition: {
      duration: 2,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },

  /**
   * Voice listening - breathing effect
   */
  voiceListening: {
    animate: {
      scale: [1, 1.1, 1],
    },
    transition: {
      duration: 1.5,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },

  /**
   * Voice thinking - gentle rotation
   */
  voiceThinking: {
    animate: {
      rotate: [0, 360],
    },
    transition: {
      duration: 2,
      ease: 'linear',
      repeat: Infinity,
    },
  },

  /**
   * Voice speaking - wave animation
   */
  voiceSpeaking: {
    animate: {
      scale: [1, 1.05, 0.95, 1],
    },
    transition: {
      duration: 0.8,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },

  /**
   * Item added to cart - success bounce
   */
  addToCartSuccess: {
    animate: {
      scale: [1, 1.2, 1],
      rotate: [0, 5, -5, 0],
    },
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },

  /**
   * Focus ring animation
   */
  focusRing: {
    whileFocus: {
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
      transition: { duration: 0.15 },
    },
  },

  /**
   * Error shake
   */
  errorShake: {
    animate: {
      x: [0, -10, 10, -10, 10, 0],
    },
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },

  /**
   * Loading spinner - continuous rotation
   */
  loadingSpinner: {
    animate: {
      rotate: 360,
    },
    transition: {
      duration: 1,
      ease: 'linear',
      repeat: Infinity,
    },
  },
};

/**
 * LIST/GRID ANIMATIONS
 * For staggered animations of multiple items
 */
export const ListAnimations: MotionVariants = {
  /**
   * Staggered menu grid - parent container
   */
  menuGridContainer: {
    animate: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  },

  /**
   * Staggered menu grid - child items
   */
  menuGridItem: {
    initial: { y: 40, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24,
      },
    },
    exit: {
      y: -20,
      opacity: 0,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Category carousel - parent
   */
  categoryCarouselContainer: {
    animate: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  },

  /**
   * Category carousel - items
   */
  categoryCarouselItem: {
    initial: { x: -30, opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },

  /**
   * Cart items - parent
   */
  cartListContainer: {
    animate: {
      transition: {
        staggerChildren: 0.06,
      },
    },
  },

  /**
   * Cart items - individual
   */
  cartListItem: {
    initial: { x: 50, opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
    exit: {
      x: -50,
      opacity: 0,
      height: 0,
      marginBottom: 0,
      transition: { duration: 0.3 },
    },
  },

  /**
   * Choice selection (for combos) - parent
   */
  choiceListContainer: {
    animate: {
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.2,
      },
    },
  },

  /**
   * Choice selection - items
   */
  choiceListItem: {
    initial: { y: 20, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },
};

/**
 * VOICE-SPECIFIC ANIMATIONS
 * Special animations for voice interaction feedback
 */
export const VoiceAnimations: MotionVariants = {
  /**
   * Dish highlight when mentioned - pulse + glow
   */
  voiceMentionHighlight: {
    animate: {
      scale: [1, 1.05, 1],
      boxShadow: [
        '-8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(0,0,0,0.15)',
        '0 0 0 4px rgba(59, 130, 246, 0.4), -8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(0,0,0,0.15)',
        '-8px -8px 20px rgba(255,255,255,0.8), 8px 8px 20px rgba(0,0,0,0.15)',
      ],
    },
    transition: {
      duration: 1,
      ease: 'easeInOut',
      repeat: 2,
    },
  },

  /**
   * Transcript entry - slide from left
   */
  transcriptEntry: {
    initial: { x: -20, opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: { duration: 0.2 },
    },
  },

  /**
   * Voice visualizer bars - animated
   */
  voiceVisualizerBar: {
    animate: {
      scaleY: [1, 1.5, 1],
    },
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'reverse',
    },
  },

  /**
   * Voice command confirmation - success
   */
  voiceCommandSuccess: {
    animate: {
      scale: [1, 1.15, 1],
      rotate: [0, -5, 5, 0],
      backgroundColor: ['#e0e5ec', '#dcfce7', '#e0e5ec'],
    },
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },

  /**
   * Voice error feedback - shake
   */
  voiceCommandError: {
    animate: {
      x: [0, -8, 8, -8, 8, 0],
      backgroundColor: ['#e0e5ec', '#fee2e2', '#e0e5ec'],
    },
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },
};

/**
 * UTILITY: Get animation variant by name
 */
export function getAnimationVariant(
  category: 'page' | 'element' | 'interaction' | 'list' | 'voice',
  name: string
): MotionVariant | undefined {
  const categories = {
    page: PageTransitions,
    element: ElementTransitions,
    interaction: InteractionAnimations,
    list: ListAnimations,
    voice: VoiceAnimations,
  };

  return categories[category]?.[name];
}

/**
 * UTILITY: Combine multiple animation variants
 */
export function combineVariants(...variants: (MotionVariant | undefined)[]): MotionVariant {
  return variants.reduce<MotionVariant>((combined, variant) => {
    if (!variant) return combined;
    return {
      ...combined,
      ...variant,
      transition: {
        ...combined?.transition,
        ...variant.transition,
      },
    };
  }, {});
}

/**
 * Export all animation templates
 */
export const AnimationTemplates = {
  page: PageTransitions,
  element: ElementTransitions,
  interaction: InteractionAnimations,
  list: ListAnimations,
  voice: VoiceAnimations,
};

/**
 * Default export
 */
export default AnimationTemplates;
