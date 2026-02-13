/**
 * Grab Food - Animation Templates
 *
 * Mobile-optimized Framer Motion animation variants for app-like interactions.
 * Fast, snappy animations for responsive feel.
 */

/**
 * Page transitions (navigation between screens)
 */
export const pageTransitions = {
  // Slide in from right (forward navigation)
  slideInRight: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-100%', opacity: 0 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  // Slide in from left (back navigation)
  slideInLeft: {
    initial: { x: '-100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },

  // Fade transition
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
};

/**
 * Bottom sheet animations (modals, cart, filters)
 */
export const bottomSheetAnimations = {
  // Slide up from bottom
  slideUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },

  // Slide up with backdrop
  slideUpWithBackdrop: {
    sheet: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    backdrop: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.2 },
    },
  },
};

/**
 * Carousel animations
 */
export const carouselAnimations = {
  // Item snap into view
  itemSnap: {
    animate: {
      scale: [0.95, 1],
      opacity: [0.7, 1],
    },
    transition: { duration: 0.2 },
  },

  // Slide between items
  itemSlide: {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  },
};

/**
 * Card interactions
 */
export const cardAnimations = {
  // Lift on hover/press
  lift: {
    whileHover: { y: -4, scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.2 },
  },

  // Scale on press
  scalePress: {
    whileTap: { scale: 0.97 },
    transition: { duration: 0.1 },
  },

  // Pulse (for active cards)
  pulse: {
    animate: {
      scale: [1, 1.05, 1],
    },
    transition: {
      duration: 1.5,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};

/**
 * FAB (Floating Action Button) animations
 */
export const fabAnimations = {
  // Bounce in
  bounceIn: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },

  // Pulse (idle state)
  pulse: {
    animate: {
      scale: [1, 1.1, 1],
    },
    transition: {
      duration: 2,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatDelay: 3,
    },
  },

  // Voice orb pulse (listening state)
  voicePulse: {
    animate: {
      scale: [1, 1.15, 1],
      boxShadow: [
        '0 0 0 0 rgba(0, 177, 79, 0.4)',
        '0 0 0 16px rgba(0, 177, 79, 0)',
        '0 0 0 0 rgba(0, 177, 79, 0)',
      ],
    },
    transition: {
      duration: 1.5,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};

/**
 * Progress bar animations
 */
export const progressAnimations = {
  // Fill progress bar
  fill: {
    initial: { scaleX: 0 },
    animate: { scaleX: 1 },
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },

  // Indeterminate loading
  indeterminate: {
    animate: {
      x: ['-100%', '100%'],
    },
    transition: {
      duration: 1.5,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};

/**
 * Badge animations (for notifications, order updates)
 */
export const badgeAnimations = {
  // Pulse (for new notifications)
  pulse: {
    animate: {
      scale: [1, 1.2, 1],
      backgroundColor: ['#ff6c31', '#ea580c', '#ff6c31'],
    },
    transition: {
      duration: 1,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatDelay: 2,
    },
  },

  // Pop in
  popIn: {
    initial: { scale: 0 },
    animate: { scale: 1 },
    exit: { scale: 0 },
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25,
    },
  },
};

/**
 * List animations (staggered items)
 */
export const listAnimations = {
  // Stagger children
  container: {
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },

  // Individual item
  item: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 },
  },
};

/**
 * Swipe actions (remove from cart, dismiss)
 */
export const swipeAnimations = {
  // Swipe to remove
  swipeRemove: {
    exit: {
      x: -300,
      opacity: 0,
    },
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },

  // Swipe to reveal actions
  swipeReveal: {
    drag: 'x',
    dragConstraints: { left: -80, right: 0 },
    dragElastic: 0.2,
  },
};

/**
 * Pull to refresh
 */
export const pullToRefreshAnimations = {
  // Refresh indicator rotation
  indicator: {
    animate: {
      rotate: [0, 360],
    },
    transition: {
      duration: 1,
      ease: 'linear',
      repeat: Infinity,
    },
  },

  // Pull down container
  container: {
    initial: { y: -50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -50, opacity: 0 },
    transition: { duration: 0.2 },
  },
};

/**
 * Toast/Snackbar notifications
 */
export const toastAnimations = {
  // Slide in from top
  slideInTop: {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -100, opacity: 0 },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },

  // Slide in from bottom
  slideInBottom: {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 100, opacity: 0 },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
};

/**
 * Filter chip animations
 */
export const chipAnimations = {
  // Selected state
  selected: {
    scale: 1.05,
    backgroundColor: '#00B14F',
    color: '#ffffff',
    transition: { duration: 0.2 },
  },

  // Default state
  default: {
    scale: 1,
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    transition: { duration: 0.2 },
  },
};

/**
 * Search animations
 */
export const searchAnimations = {
  // Expand search bar
  expand: {
    initial: { width: '48px' },
    animate: { width: '100%' },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Collapse search bar
  collapse: {
    animate: { width: '48px' },
    transition: { duration: 0.3, ease: 'easeIn' },
  },
};

/**
 * Export all animations as a single object
 */
export const GrabFoodAnimations = {
  pageTransitions,
  bottomSheetAnimations,
  carouselAnimations,
  cardAnimations,
  fabAnimations,
  progressAnimations,
  badgeAnimations,
  listAnimations,
  swipeAnimations,
  pullToRefreshAnimations,
  toastAnimations,
  chipAnimations,
  searchAnimations,
};
