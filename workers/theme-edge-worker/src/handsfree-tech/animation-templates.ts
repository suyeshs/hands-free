/**
 * Handsfree Tech Theme - Animation Templates
 * Inspired by Music Zajno design patterns
 *
 * @features
 * - Scroll-triggered animations
 * - Sophisticated easing functions
 * - GPU-accelerated transforms
 * - Voice/gesture feedback animations
 * - Code/terminal typewriter effects
 */

import { EasingFunctions, AnimationDuration } from './design-tokens';

// ===========================
// Core Animation Keyframes
// ===========================

/**
 * Fade In - Music Zajno inspired
 */
export const fadeInKeyframes = `
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
`;

/**
 * Fade In Up - Scroll reveal effect
 */
export const fadeInUpKeyframes = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
`;

/**
 * Fade In Down
 */
export const fadeInDownKeyframes = `
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-100px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
`;

/**
 * Slide In Left
 */
export const slideInLeftKeyframes = `
@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
`;

/**
 * Slide In Right
 */
export const slideInRightKeyframes = `
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
`;

/**
 * Scale In - Product card entrance
 */
export const scaleInKeyframes = `
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
`;

/**
 * Rotate In - Icon animations
 */
export const rotateInKeyframes = `
@keyframes rotateIn {
  from {
    opacity: 0;
    transform: rotate(-180deg) scale(0.5);
  }
  to {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
}
`;

/**
 * Glow Pulse - Voice orb effect
 */
export const glowPulseKeyframes = `
@keyframes glowPulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 20px var(--glow-color, #0066ff),
                0 0 40px var(--glow-color, #0066ff);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 40px var(--glow-color, #0066ff),
                0 0 80px var(--glow-color, #0066ff);
  }
}
`;

/**
 * Typewriter Effect - Terminal/code blocks
 */
export const typewriterKeyframes = `
@keyframes typewriter {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}
`;

/**
 * Cursor Blink - Terminal cursor
 */
export const cursorBlinkKeyframes = `
@keyframes cursorBlink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
`;

/**
 * Wave Animation - Loading/processing indicator
 */
export const waveKeyframes = `
@keyframes wave {
  0%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.5);
  }
}
`;

/**
 * Shimmer - Loading skeleton effect
 */
export const shimmerKeyframes = `
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}
`;

/**
 * Float - Subtle hover effect
 */
export const floatKeyframes = `
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
`;

/**
 * Gradient Shift - Holographic effect
 */
export const gradientShiftKeyframes = `
@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
`;

// ===========================
// Scroll-Based Animations
// ===========================

/**
 * Product Card Scroll Reveal
 */
export const productCardScrollReveal = `
.product-card {
  opacity: 0;
  transform: translateY(100px) scale(0.8);
  transition: opacity ${AnimationDuration.slower} ${EasingFunctions.standard},
              transform ${AnimationDuration.slower} ${EasingFunctions.standard};
}

.product-card.in-view {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Stagger effect for multiple cards */
.product-card.in-view:nth-child(1) { transition-delay: 0ms; }
.product-card.in-view:nth-child(2) { transition-delay: 100ms; }
.product-card.in-view:nth-child(3) { transition-delay: 200ms; }
.product-card.in-view:nth-child(4) { transition-delay: 300ms; }
`;

/**
 * Feature Card Entrance
 */
export const featureCardEntrance = `
.feature-card {
  opacity: 0;
  transform: translateX(-50px);
  transition: opacity ${AnimationDuration.slow} ${EasingFunctions.decelerate},
              transform ${AnimationDuration.slow} ${EasingFunctions.decelerate};
}

.feature-card.in-view {
  opacity: 1;
  transform: translateX(0);
}
`;

/**
 * Parallax Layer Effect
 */
export const parallaxLayers = `
.parallax-layer-1 {
  transform: translateY(calc(var(--scroll-progress) * 0.3));
}

.parallax-layer-2 {
  transform: translateY(calc(var(--scroll-progress) * 0.5));
}

.parallax-layer-3 {
  transform: translateY(calc(var(--scroll-progress) * 1));
}
`;

// ===========================
// Hover Effects
// ===========================

/**
 * Product Card Hover - Lift effect
 */
export const productCardHover = `
.product-card {
  transform: scale(1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all ${AnimationDuration.normal} ${EasingFunctions.standard};
}

.product-card:hover {
  transform: scale(1.05) translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 102, 255, 0.3);
}
`;

/**
 * Glow Hover Effect
 */
export const glowHover = `
.glow-on-hover {
  position: relative;
  transition: all ${AnimationDuration.normal} ${EasingFunctions.standard};
}

.glow-on-hover::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, #0066ff, #8000ff);
  border-radius: inherit;
  opacity: 0;
  z-index: -1;
  filter: blur(20px);
  transition: opacity ${AnimationDuration.normal} ${EasingFunctions.standard};
}

.glow-on-hover:hover::before {
  opacity: 0.8;
}
`;

/**
 * Button Ripple Effect
 */
export const buttonRipple = `
.btn-ripple {
  position: relative;
  overflow: hidden;
}

.btn-ripple::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  transform: scale(0);
  transition: transform ${AnimationDuration.slow} ${EasingFunctions.standard};
}

.btn-ripple:active::after {
  transform: scale(1);
}
`;

// ===========================
// Voice Orb Animations
// ===========================

/**
 * Voice Orb Active State
 */
export const voiceOrbActive = `
.voice-orb {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0066ff, #8000ff);
  box-shadow: 0 4px 12px rgba(0, 102, 255, 0.3);
  transition: all ${AnimationDuration.normal} ${EasingFunctions.standard};
}

.voice-orb.active {
  animation: glowPulse 2s ${EasingFunctions.smooth} infinite;
  box-shadow: 0 0 40px #0066ff, 0 0 80px #8000ff;
}
`;

/**
 * Waveform Bars Animation
 */
export const waveformBars = `
.waveform-bar {
  width: 4px;
  background: linear-gradient(180deg, #0066ff, #00ff80);
  transform-origin: bottom;
  animation: wave 1s ease-in-out infinite;
}

.waveform-bar:nth-child(1) { animation-delay: 0ms; }
.waveform-bar:nth-child(2) { animation-delay: 100ms; }
.waveform-bar:nth-child(3) { animation-delay: 200ms; }
.waveform-bar:nth-child(4) { animation-delay: 300ms; }
.waveform-bar:nth-child(5) { animation-delay: 400ms; }
`;

// ===========================
// Terminal/Code Animations
// ===========================

/**
 * Terminal Typewriter Effect
 */
export const terminalTypewriter = `
.terminal-line {
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid #00ff80;
  animation: typewriter 2s steps(40) 1s forwards,
             cursorBlink 0.75s step-end infinite;
}

.terminal-line.typed {
  border-right: none;
}
`;

/**
 * Code Block Reveal
 */
export const codeBlockReveal = `
.code-block {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity ${AnimationDuration.slow} ${EasingFunctions.decelerate},
              transform ${AnimationDuration.slow} ${EasingFunctions.decelerate};
}

.code-block.in-view {
  opacity: 1;
  transform: translateY(0);
}

.code-block pre {
  position: relative;
  overflow: hidden;
}

.code-block pre::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(0, 102, 255, 0.2),
    transparent
  );
  animation: shimmer 2s ease-in-out;
}
`;

// ===========================
// Glassmorphism Animations
// ===========================

/**
 * Glass Card Entrance
 */
export const glassCardEntrance = `
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  opacity: 0;
  transform: scale(0.9);
  transition: all ${AnimationDuration.slow} ${EasingFunctions.backOut};
}

.glass-card.in-view {
  opacity: 1;
  transform: scale(1);
}
`;

// ===========================
// Particle Effects
// ===========================

/**
 * Floating Particles
 */
export const floatingParticles = `
.particle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: radial-gradient(circle, #0066ff, transparent);
  border-radius: 50%;
  opacity: 0.6;
  animation: float 10s ease-in-out infinite;
}

.particle:nth-child(odd) {
  animation-delay: -5s;
  animation-duration: 12s;
}

.particle:nth-child(even) {
  animation-delay: -2s;
  animation-duration: 8s;
}
`;

// ===========================
// Progress Indicators
// ===========================

/**
 * Loading Bar
 */
export const loadingBar = `
.loading-bar {
  width: 0%;
  height: 3px;
  background: linear-gradient(90deg, #0066ff, #8000ff, #00ff80);
  background-size: 200% 100%;
  animation: gradientShift 3s ease-in-out infinite;
  transition: width ${AnimationDuration.normal} ${EasingFunctions.decelerate};
}

.loading-bar.active {
  width: 100%;
}
`;

/**
 * Spinner
 */
export const spinner = `
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 102, 255, 0.2);
  border-top-color: #0066ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
`;

// ===========================
// Export All Animations
// ===========================

export const HandsfreeAnimations = {
  keyframes: {
    fadeIn: fadeInKeyframes,
    fadeInUp: fadeInUpKeyframes,
    fadeInDown: fadeInDownKeyframes,
    slideInLeft: slideInLeftKeyframes,
    slideInRight: slideInRightKeyframes,
    scaleIn: scaleInKeyframes,
    rotateIn: rotateInKeyframes,
    glowPulse: glowPulseKeyframes,
    typewriter: typewriterKeyframes,
    cursorBlink: cursorBlinkKeyframes,
    wave: waveKeyframes,
    shimmer: shimmerKeyframes,
    float: floatKeyframes,
    gradientShift: gradientShiftKeyframes,
    spin: spinner,
  },

  scrollBased: {
    productCardReveal: productCardScrollReveal,
    featureCardEntrance: featureCardEntrance,
    parallaxLayers: parallaxLayers,
  },

  hover: {
    productCard: productCardHover,
    glow: glowHover,
    ripple: buttonRipple,
  },

  voice: {
    orb: voiceOrbActive,
    waveform: waveformBars,
  },

  terminal: {
    typewriter: terminalTypewriter,
    codeReveal: codeBlockReveal,
  },

  glass: {
    cardEntrance: glassCardEntrance,
  },

  particles: {
    floating: floatingParticles,
  },

  loading: {
    bar: loadingBar,
    spinner: spinner,
  },
} as const;

/**
 * Generate CSS for all animations
 */
export function generateAnimationCSS(): string {
  return `
    ${fadeInKeyframes}
    ${fadeInUpKeyframes}
    ${fadeInDownKeyframes}
    ${slideInLeftKeyframes}
    ${slideInRightKeyframes}
    ${scaleInKeyframes}
    ${rotateInKeyframes}
    ${glowPulseKeyframes}
    ${typewriterKeyframes}
    ${cursorBlinkKeyframes}
    ${waveKeyframes}
    ${shimmerKeyframes}
    ${floatKeyframes}
    ${gradientShiftKeyframes}
    ${spinner}

    ${productCardScrollReveal}
    ${featureCardEntrance}
    ${parallaxLayers}
    ${productCardHover}
    ${glowHover}
    ${buttonRipple}
    ${voiceOrbActive}
    ${waveformBars}
    ${terminalTypewriter}
    ${codeBlockReveal}
    ${glassCardEntrance}
    ${floatingParticles}
    ${loadingBar}
  `;
}
