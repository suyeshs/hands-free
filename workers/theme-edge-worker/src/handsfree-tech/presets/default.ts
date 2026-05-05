/**
 * Handsfree Tech Theme - Default Preset
 */

import { HandsfreeDesignTokens } from '../design-tokens';
import { layouts } from '../layouts';
import {
  createProductCard,
  createVoiceOrb,
  createCodeBlock,
} from '../primitives';
import type { HandsfreeTheme } from '../types';

export const HandsfreeDefaultTheme: HandsfreeTheme = {
  id: 'handsfree-default',
  name: 'Handsfree Tech',
  version: '1.0.0',
  description: 'Modern tech-oriented theme with voice and gesture controls',

  designTokens: HandsfreeDesignTokens,

  components: {
    productCard: createProductCard({
      name: 'Product Showcase Card',
      showImage: true,
      imageHeight: '240px',
      showGradient: true,
      gradientType: 'holographic',
      showCTA: true,
      ctaStyle: 'primary',
      hoverEffect: 'glow',
      borderStyle: 'gradient',
    }),

    featureCard: {
      id: 'feature-card',
      name: 'Feature Card',
      layout: 'vertical',
      iconPosition: 'top',
      iconSize: 'lg',
      iconStyle: 'gradient',
      showAnimation: true,
      animationType: 'fade',
    },

    codeBlock: createCodeBlock({
      name: 'Code Display',
      language: 'javascript',
      theme: 'dark',
      showLineNumbers: true,
      showCopyButton: true,
      wrapLines: false,
    }),

    terminalWindow: {
      id: 'terminal',
      name: 'Terminal Window',
      showHeader: true,
      showPrompt: true,
      promptSymbol: '$',
      promptColor: HandsfreeDesignTokens.colors.success[500],
      typewriterEffect: true,
      typewriterSpeed: 50,
      showCursor: true,
      cursorStyle: 'block',
    },

    voiceOrb: createVoiceOrb({
      name: 'Voice Assistant',
      size: 'lg',
      position: 'bottom-center',
      showWaveform: true,
      waveformStyle: 'circular',
      waveformBars: 16,
      glowIntensity: 'medium',
      pulseOnActive: true,
      showTranscript: true,
      showStatus: true,
    }),

    gestureZone: {
      id: 'gesture-zone',
      name: 'Gesture Control Zone',
      gestures: ['swipe-left', 'swipe-right', 'pinch-zoom', 'two-finger-tap'],
      feedbackType: 'visual',
      sensitivity: 'medium',
      showHints: true,
      hintDuration: 3000,
    },

    pricingCard: {
      id: 'pricing-card',
      name: 'Pricing Card',
      layout: 'standard',
      showBadge: true,
      highlightFeatures: true,
      showComparison: false,
      ctaStyle: 'gradient',
    },

    apiDocCard: {
      id: 'api-doc-card',
      name: 'API Documentation',
      showEndpoint: true,
      showMethod: true,
      showParameters: true,
      showResponse: true,
      showExample: true,
      collapsible: true,
      syntaxHighlight: true,
    },

    techSpecs: {
      id: 'tech-specs',
      name: 'Technical Specifications',
      layout: 'grid',
      showIcons: true,
      groupByCategory: true,
      highlightKey: true,
      comparisonMode: false,
    },

    statusBadge: {
      id: 'status-badge',
      name: 'Status Indicator',
      style: 'pill',
      showPulse: true,
      size: 'md',
    },
  },

  layouts,

  interactions: {
    voice: {
      enabled: true,
      wakeWord: 'Hey Tech',
      languages: ['en', 'hi'],
      commands: [
        {
          id: 'nav-home',
          phrase: ['go home', 'home page', 'main page'],
          action: 'navigate_home',
          category: 'navigation',
          confirmation: false,
        },
        {
          id: 'search',
          phrase: ['search for', 'find', 'look for'],
          action: 'open_search',
          category: 'search',
          confirmation: false,
        },
        {
          id: 'scroll-down',
          phrase: ['scroll down', 'go down', 'next section'],
          action: 'scroll_down',
          category: 'navigation',
          confirmation: false,
        },
        {
          id: 'scroll-up',
          phrase: ['scroll up', 'go up', 'previous section'],
          action: 'scroll_up',
          category: 'navigation',
          confirmation: false,
        },
      ],
      feedback: 'both',
    },

    gestures: {
      enabled: true,
      types: ['swipe-left', 'swipe-right', 'swipe-up', 'swipe-down', 'pinch-zoom'],
      sensitivity: 'medium',
      feedback: 'visual',
    },

    keyboard: {
      search: {
        keys: 'Cmd+K',
        action: 'open_search',
        description: 'Open search',
      },
      voice: {
        keys: 'Cmd+V',
        action: 'toggle_voice',
        description: 'Toggle voice control',
      },
      docs: {
        keys: 'Cmd+D',
        action: 'open_docs',
        description: 'Open documentation',
      },
      theme: {
        keys: 'Cmd+T',
        action: 'toggle_theme',
        description: 'Toggle dark mode',
      },
    },

    scroll: {
      smoothScroll: true,
      parallaxLayers: 3,
      revealAnimations: true,
      progressIndicator: true,
      snapPoints: false,
    },
  },

  animations: {
    enabled: true,
    reducedMotion: false,
    presets: {
      fadeIn: {
        name: 'fadeIn',
        duration: '800ms',
        easing: HandsfreeDesignTokens.easing.standard,
        fillMode: 'both',
      },
      fadeInUp: {
        name: 'fadeInUp',
        duration: '800ms',
        easing: HandsfreeDesignTokens.easing.standard,
        fillMode: 'both',
      },
      fadeInDown: {
        name: 'fadeInDown',
        duration: '800ms',
        easing: HandsfreeDesignTokens.easing.decelerate,
        fillMode: 'both',
      },
      slideInLeft: {
        name: 'slideInLeft',
        duration: '500ms',
        easing: HandsfreeDesignTokens.easing.decelerate,
        fillMode: 'both',
      },
      slideInRight: {
        name: 'slideInRight',
        duration: '500ms',
        easing: HandsfreeDesignTokens.easing.decelerate,
        fillMode: 'both',
      },
      scaleIn: {
        name: 'scaleIn',
        duration: '500ms',
        easing: HandsfreeDesignTokens.easing.backOut,
        fillMode: 'both',
      },
      rotateIn: {
        name: 'rotateIn',
        duration: '800ms',
        easing: HandsfreeDesignTokens.easing.backOut,
        fillMode: 'both',
      },
      glowPulse: {
        name: 'glowPulse',
        duration: '2s',
        easing: HandsfreeDesignTokens.easing.smooth,
        iterations: 'infinite',
        fillMode: 'both',
      },
      typewriter: {
        name: 'typewriter',
        duration: '2s',
        easing: 'steps(40)',
        fillMode: 'both',
      },
      wave: {
        name: 'wave',
        duration: '1s',
        easing: 'ease-in-out',
        iterations: 'infinite',
        fillMode: 'both',
      },
    },
  },

  accessibility: {
    wcagLevel: 'AA',
    keyboardNavigation: true,
    screenReaderOptimized: true,
    focusIndicators: true,
    skipLinks: true,
    ariaLabels: true,
    reducedMotion: true,
    highContrast: false,
    minimumTouchTarget: '44px',
    contrastRatios: {
      normal: 4.5,
      large: 3.0,
    },
  },
};
