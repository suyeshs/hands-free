/**
 * Framer Motion Animation Presets
 * Shadesynchronism Design System - Subtle & Professional animations
 */

import type { Transition, Variants } from 'framer-motion';

// =============================================================================
// Spring Configurations - Professional feel, snappy but not bouncy
// =============================================================================

export const springConfig = {
  /** Snappy response - for immediate feedback */
  snappy: { type: 'spring', damping: 30, stiffness: 400 } as Transition,
  /** Gentle movement - for larger elements */
  gentle: { type: 'spring', damping: 25, stiffness: 300 } as Transition,
  /** Soft landing - for modal/overlay animations */
  soft: { type: 'spring', damping: 20, stiffness: 200 } as Transition,
  /** Quick snap - for micro-interactions */
  quick: { type: 'spring', damping: 35, stiffness: 500 } as Transition,
};

// =============================================================================
// Dock Item Variants - macOS-style magnification
// =============================================================================

export const dockItemVariants: Variants = {
  initial: {
    scale: 1,
    y: 0,
  },
  hover: {
    scale: 1.25,
    y: -8,
    transition: springConfig.snappy,
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1 },
  },
  neighbor: {
    scale: 1.1,
    y: -4,
    transition: springConfig.snappy,
  },
};

// Scale values for dock magnification based on distance
export const getDockScale = (distance: number, maxDistance: number = 2): number => {
  if (distance > maxDistance) return 1;
  // Gaussian-like falloff: scale decreases with distance
  const normalizedDistance = distance / maxDistance;
  const scale = 1 + (0.25 * Math.cos(normalizedDistance * Math.PI / 2));
  return scale;
};

// =============================================================================
// Dashboard Card Variants - For HubPage cards
// =============================================================================

export const cardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springConfig.gentle,
  },
  hover: {
    scale: 1.03,
    y: -4,
    transition: springConfig.snappy,
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// =============================================================================
// Modal Variants - For floating cart modal and other overlays
// =============================================================================

export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springConfig.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 },
  },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// =============================================================================
// Cart Item Variants - For add/remove animations
// =============================================================================

export const cartItemVariants: Variants = {
  initial: {
    opacity: 0,
    x: -20,
    height: 0,
    marginBottom: 0,
  },
  animate: {
    opacity: 1,
    x: 0,
    height: 'auto',
    marginBottom: 8,
    transition: springConfig.snappy,
  },
  exit: {
    opacity: 0,
    x: 20,
    height: 0,
    marginBottom: 0,
    transition: { duration: 0.2 },
  },
};

// =============================================================================
// Stagger Container - For list animations
// =============================================================================

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04, // 40ms stagger
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

export const staggerItem: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: springConfig.snappy,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.1 },
  },
};

// =============================================================================
// Pulse Variants - For notifications/badges
// =============================================================================

export const pulseVariants: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.3 },
  },
};

// Badge counter animation
export const badgeVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: springConfig.quick,
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.1 },
  },
  bump: {
    scale: [1, 1.3, 1],
    transition: { duration: 0.25 },
  },
};

// =============================================================================
// Floating Element Variants - For dock and mini-cart
// =============================================================================

export const floatingElementVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springConfig.gentle,
  },
  exit: {
    opacity: 0,
    y: 30,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

// =============================================================================
// Button Variants - Subtle press effect
// =============================================================================

export const buttonVariants: Variants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: springConfig.quick,
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

// =============================================================================
// Slide Variants - For panels and drawers
// =============================================================================

export const slideFromRight: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: springConfig.gentle,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export const slideFromBottom: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: springConfig.gentle,
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// =============================================================================
// Utility: Reduced Motion Check
// =============================================================================

export const shouldReduceMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Get animation props that respect reduced motion preference
export const getMotionProps = (variants: Variants) => {
  if (shouldReduceMotion()) {
    return {
      initial: false,
      animate: 'animate',
      exit: 'exit',
      transition: { duration: 0 },
    };
  }
  return {
    variants,
    initial: 'initial',
    animate: 'animate',
    exit: 'exit',
  };
};
