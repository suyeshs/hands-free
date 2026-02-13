/**
 * Voice Orb Component Primitive
 *
 * Factory function for creating pulsating AI assistant orbs with audio visualization
 */

import type { VoiceOrbComponent, GradientConfig } from '../types';
import { VoiceStateGradients } from '../design-tokens';

export interface VoiceOrbOptions {
  id?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | number;  // 64px, 80px, 96px or custom
  position?: 'bottom-center' | 'bottom-right' | 'floating';
  showLabel?: boolean;
  showVisualizer?: boolean;
  visualizerType?: 'circular' | 'waveform' | 'spectrum';
  pulseIntensity?: 'low' | 'medium' | 'high';
}

/**
 * Get orb size in pixels
 */
function getOrbSize(size: 'sm' | 'md' | 'lg' | number): number {
  if (typeof size === 'number') return size;

  const sizeMap = {
    sm: 64,
    md: 80,
    lg: 96,
  };

  return sizeMap[size];
}

/**
 * Get glow configuration based on intensity
 */
function getGlowConfig(intensity: 'low' | 'medium' | 'high') {
  const configs = {
    low: {
      blur: '8px',
      spread: '4px',
    },
    medium: {
      blur: '16px',
      spread: '8px',
    },
    high: {
      blur: '24px',
      spread: '12px',
    },
  };

  return configs[intensity];
}

/**
 * Create a voice orb component
 */
export function createVoiceOrb(options: VoiceOrbOptions = {}): VoiceOrbComponent {
  const {
    id = 'voice-orb-1',
    name = 'Voice Orb',
    size = 'md',
    position = 'bottom-center',
    showLabel = true,
    showVisualizer = true,
    visualizerType = 'circular',
    pulseIntensity = 'medium',
  } = options;

  const orbSize = getOrbSize(size);
  const glowConfig = getGlowConfig(pulseIntensity);

  return {
    id,
    name,
    type: 'voice-orb',
    description: 'Pulsating AI voice assistant orb with real-time audio visualization',
    category: 'action',

    // Visual dimensions
    dimensions: {
      width: `${orbSize}px`,
      height: `${orbSize}px`,
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
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: '1.25',
    },

    // Orb size
    size: orbSize,

    // Visualizer configuration
    visualizer: {
      type: visualizerType,
      bars: visualizerType === 'circular' ? 16 : 32,
      sensitivity: 1.0,
    },

    // State-based gradients
    stateColors: {
      idle: VoiceStateGradients.idle,
      listening: VoiceStateGradients.listening,
      thinking: VoiceStateGradients.thinking,
      speaking: VoiceStateGradients.speaking,
    },

    // Glow effect
    glowEffect: {
      intensity: pulseIntensity,
      blur: glowConfig.blur,
      spread: glowConfig.spread,
    },

    // States (neumorphic with gradients)
    states: {
      default: {
        colors: {
          background: `linear-gradient(145deg, ${VoiceStateGradients.idle.from}, ${VoiceStateGradients.idle.to})`,
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: `0 0 ${glowConfig.blur} ${glowConfig.spread} rgba(148, 163, 184, 0.3)`,
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
      },
      hover: {
        colors: {
          background: `linear-gradient(145deg, ${VoiceStateGradients.idle.from}, ${VoiceStateGradients.idle.to})`,
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: `0 0 ${parseInt(glowConfig.blur) * 1.5}px ${parseInt(glowConfig.spread) * 1.5}px rgba(148, 163, 184, 0.4)`,
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
        transform: 'scale(1.05)',
      },
      active: {
        colors: {
          background: `linear-gradient(145deg, ${VoiceStateGradients.listening.from}, ${VoiceStateGradients.listening.to})`,
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: `0 0 ${parseInt(glowConfig.blur) * 2}px ${parseInt(glowConfig.spread) * 2}px rgba(56, 189, 248, 0.5)`,
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
        transform: 'scale(1.0)',
      },
      pressed: {
        colors: {
          background: `linear-gradient(145deg, ${VoiceStateGradients.listening.from}, ${VoiceStateGradients.listening.to})`,
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: `0 0 ${parseInt(glowConfig.blur) * 2}px ${parseInt(glowConfig.spread) * 2}px rgba(56, 189, 248, 0.6)`,
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
        transform: 'scale(0.95)',
      },
      focused: {
        colors: {
          background: `linear-gradient(145deg, ${VoiceStateGradients.idle.from}, ${VoiceStateGradients.idle.to})`,
          text: '#ffffff',
          border: '#0ea5e9',
        },
        shadows: {
          outer: `0 0 ${glowConfig.blur} ${glowConfig.spread} rgba(148, 163, 184, 0.3), 0 0 0 3px rgba(14, 165, 233, 0.3)`,
          inner: 'none',
        },
        border: {
          width: '2px',
          style: 'solid',
          radius: '50%',
        },
      },
      disabled: {
        colors: {
          background: 'linear-gradient(145deg, #cbd5e1, #94a3b8)',
          text: '#64748b',
          border: 'transparent',
        },
        shadows: {
          outer: 'none',
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
      },
      loading: {
        colors: {
          background: `linear-gradient(145deg, ${VoiceStateGradients.thinking.from}, ${VoiceStateGradients.thinking.to})`,
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: `0 0 ${parseInt(glowConfig.blur) * 2}px ${parseInt(glowConfig.spread) * 2}px rgba(251, 191, 36, 0.5)`,
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
      },
      error: {
        colors: {
          background: 'linear-gradient(145deg, #fca5a5, #ef4444)',
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: `0 0 ${glowConfig.blur} ${glowConfig.spread} rgba(239, 68, 68, 0.5)`,
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
      },
      success: {
        colors: {
          background: `linear-gradient(145deg, ${VoiceStateGradients.speaking.from}, ${VoiceStateGradients.speaking.to})`,
          text: '#ffffff',
          border: 'transparent',
        },
        shadows: {
          outer: `0 0 ${parseInt(glowConfig.blur) * 2}px ${parseInt(glowConfig.spread) * 2}px rgba(34, 197, 94, 0.5)`,
          inner: 'none',
        },
        border: {
          width: '0',
          style: 'solid',
          radius: '50%',
        },
      },
    },

    // Transitions with spring animations
    transitions: [
      {
        from: 'default',
        to: 'hover',
        animation: { duration: 200, easing: 'ease-out' },
        haptic: false,
      },
      {
        from: 'hover',
        to: 'active',
        animation: { duration: 150, easing: 'ease-in' },
        haptic: true,
      },
      {
        from: 'active',
        to: 'default',
        animation: {
          duration: 400,
          easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          spring: {
            stiffness: 300,
            damping: 20,
            mass: 1.0,
          },
        },
        haptic: true,
      },
    ],

    defaultState: 'default',

    // Multimodal interaction
    interaction: {
      primary: 'touch',
      alternatives: ['voice', 'keyboard'],
      touch: {
        minTouchSize: { width: orbSize, height: orbSize },
        haptic: 'heavy',
        delay: 0,
      },
      voice: [
        {
          triggers: ['hey assistant', 'start listening', 'activate voice'],
          feedback: 'Voice assistant activated',
          visualIndicator: true,
        },
        {
          triggers: ['stop listening', 'deactivate', 'cancel'],
          feedback: 'Voice assistant deactivated',
          visualIndicator: true,
        },
      ],
      keyboard: [
        { key: ' ', modifiers: [] },
        { key: 'v', modifiers: ['ctrl'] },
      ],
      gesture: [
        {
          type: 'long-press',
          duration: 500,
          action: 'activate-continuous',
        },
        {
          type: 'tap',
          action: 'toggle',
        },
      ],
    },

    // Accessibility
    accessibility: {
      role: 'button',
      ariaLabel: 'Voice assistant control',
      focusable: true,
      keyboardNavigable: true,
      screenReaderText: 'Activate voice assistant for hands-free ordering',
    },

    // Metadata
    platform: 'web',
    frameworks: ['react', 'react-native'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['voice', 'assistant', 'ai', 'microphone', 'orb'],
  };
}

/**
 * Create a small voice orb for compact layouts
 */
export function createSmallVoiceOrb(options: VoiceOrbOptions = {}): VoiceOrbComponent {
  return createVoiceOrb({
    ...options,
    size: 'sm',
    showLabel: false,
    pulseIntensity: 'low',
  });
}

/**
 * Create a large immersive voice orb
 */
export function createLargeVoiceOrb(options: VoiceOrbOptions = {}): VoiceOrbComponent {
  return createVoiceOrb({
    ...options,
    size: 'lg',
    showLabel: true,
    showVisualizer: true,
    pulseIntensity: 'high',
  });
}

/**
 * Create a floating voice FAB
 */
export function createVoiceFAB(options: VoiceOrbOptions = {}): VoiceOrbComponent {
  return createVoiceOrb({
    ...options,
    size: 'md',
    position: 'bottom-right',
    showLabel: true,
    showVisualizer: true,
    pulseIntensity: 'medium',
  });
}
