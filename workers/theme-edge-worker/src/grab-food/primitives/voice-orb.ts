/**
 * Grab Food - Voice FAB Component
 *
 * Floating action button for voice commands, adapted from restaurant theme.
 * Grab green branding with smaller, less prominent design.
 */

import type { VoiceFABComponent, GradientConfig } from '../types';

export interface VoiceFABOptions {
  id?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  position?: 'bottom-right' | 'bottom-center' | 'floating';
  showLabel?: boolean;
  pulseIntensity?: 'low' | 'medium' | 'high';
}

/**
 * Create a voice FAB component
 */
export function createVoiceFAB(
  options: VoiceFABOptions = {}
): VoiceFABComponent {
  const {
    id = 'voice-fab-1',
    name = 'Voice FAB',
    size = 'md',
    position = 'bottom-right',
    showLabel = false,
    pulseIntensity = 'medium',
  } = options;

  const sizeMap = {
    sm: '48px',
    md: '56px',
    lg: '64px',
  };

  const stateColors: {
    idle: GradientConfig;
    listening: GradientConfig;
    thinking: GradientConfig;
    speaking: GradientConfig;
  } = {
    idle: {
      from: '#9ca3af',
      to: '#6b7280',
      direction: 'to-br',
    },
    listening: {
      from: '#00B14F',
      to: '#00983F',
      direction: 'to-br',
    },
    thinking: {
      from: '#ff6c31',
      to: '#ea580c',
      direction: 'to-br',
    },
    speaking: {
      from: '#00B14F',
      to: '#00983F',
      direction: 'to-br',
    },
  };

  return {
    id,
    name,
    type: 'voice-fab',
    description: 'Floating action button for voice commands',
    category: 'input',

    dimensions: {
      width: sizeMap[size],
      height: sizeMap[size],
    },

    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    margin: {
      top: 0,
      right: 16,
      bottom: 80,  // Above bottom nav
      left: 0,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: '1.2',
    },

    size,
    position,
    showLabel,
    pulseIntensity,
    stateColors,

    glowEffect: {
      intensity: pulseIntensity,
      blur: '16px',
      spread: '8px',
    },

    states: {
      default: {
        colors: {
          background: '#9ca3af',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '0 4px 16px rgba(0, 177, 79, 0.3)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '9999px',
        },
      },
      listening: {
        colors: {
          background: '#00B14F',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '0 4px 16px rgba(0, 177, 79, 0.5), 0 0 0 0 rgba(0, 177, 79, 0.4)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '9999px',
        },
        transform: 'scale(1.1)',
      },
      thinking: {
        colors: {
          background: '#ff6c31',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '0 4px 16px rgba(255, 108, 49, 0.4)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '9999px',
        },
      },
      speaking: {
        colors: {
          background: '#00B14F',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: '0 4px 16px rgba(0, 177, 79, 0.5)',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '9999px',
        },
      },
    },

    transitions: [
      {
        from: 'default',
        to: 'listening',
        animation: { duration: 300, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
        haptic: true,
      },
      {
        from: 'listening',
        to: 'thinking',
        animation: { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        haptic: false,
      },
      {
        from: 'thinking',
        to: 'speaking',
        animation: { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        haptic: false,
      },
      {
        from: 'speaking',
        to: 'default',
        animation: { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        haptic: false,
      },
    ],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['keyboard'],
      touch: {
        minTouchSize: { width: 56, height: 56 },
        haptic: 'heavy',
      },
      voice: [
        {
          triggers: ['hey grab', 'voice search', 'listen'],
          action: 'activate-voice',
          feedback: 'Voice activated',
          visualIndicator: true,
        },
      ],
      keyboard: [
        { key: 'v', modifiers: [] },
      ],
    },

    accessibility: {
      role: 'button',
      ariaLabel: 'Voice search and commands',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Activate voice search and commands',
    },

    platform: 'both',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['voice', 'fab', 'floating', 'button', 'speech'],
  };
}

/**
 * Create a small voice FAB
 */
export function createSmallVoiceFAB(
  options: VoiceFABOptions = {}
): VoiceFABComponent {
  return createVoiceFAB({ ...options, size: 'sm' });
}

/**
 * Create a medium voice FAB (default)
 */
export function createMediumVoiceFAB(
  options: VoiceFABOptions = {}
): VoiceFABComponent {
  return createVoiceFAB({ ...options, size: 'md' });
}

/**
 * Create a large voice FAB
 */
export function createLargeVoiceFAB(
  options: VoiceFABOptions = {}
): VoiceFABComponent {
  return createVoiceFAB({ ...options, size: 'lg' });
}
