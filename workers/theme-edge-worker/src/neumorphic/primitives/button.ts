/**
 * Neumorphic Button Primitives
 * Various button styles with multimodal support
 */

import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export interface ButtonOptions {
  id?: string;
  name?: string;
  label: string;
  backgroundColor?: string;
  depth?: number;
  width?: number | string;
  height?: number;
  icon?: {
    name: string;
    position?: 'left' | 'right';
  };
  voiceCommands?: string[];
  platform?: 'web' | 'mobile' | 'both';
}

/**
 * Create standard neumorphic button
 */
export function createButton(options: ButtonOptions): NeumorphicComponent {
  const {
    id = crypto.randomUUID(),
    name = 'Button',
    label,
    backgroundColor = '#E0E5EC',
    depth = 5,
    width = 'auto',
    height = 48,
    icon,
    voiceCommands = ['click', 'press', 'activate'],
    platform = 'both',
  } = options;

  const states = NeumorphicStyleGenerator.generateAllStates(backgroundColor, depth, 'top-left', 24);

  return {
    id,
    name,
    type: 'button',
    description: `Neumorphic button with label "${label}"`,
    category: 'action',

    dimensions: {
      width,
      height,
      minWidth: 88,
      minHeight: 44,
    },

    padding: {
      top: 12,
      right: 24,
      bottom: 12,
      left: 24,
    },

    margin: {
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    },

    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 1.5,
      textTransform: 'none',
    },

    icon: icon ? {
      name: icon.name,
      size: 20,
      position: icon.position || 'left',
      spacing: 8,
    } : undefined,

    states,

    transitions: [
      {
        from: 'default',
        to: 'hover',
        animation: {
          duration: 150,
          easing: 'ease-out',
        },
        haptic: false,
      },
      {
        from: 'hover',
        to: 'pressed',
        animation: {
          duration: 100,
          easing: 'ease-in',
        },
        haptic: true,
      },
      {
        from: 'pressed',
        to: 'default',
        animation: {
          duration: 200,
          easing: 'spring',
          spring: {
            stiffness: 300,
            damping: 20,
            mass: 1,
          },
        },
        haptic: true,
      },
    ],

    defaultState: 'default',

    interaction: {
      primary: 'touch',
      alternatives: ['voice', 'keyboard'],
      touch: {
        minTouchSize: { width: 88, height: 48 },
        haptic: 'medium',
      },
      voice: voiceCommands.map((trigger) => ({
        triggers: [trigger, `${trigger} ${label.toLowerCase()}`],
        feedback: `${label} activated`,
        visualIndicator: true,
      })),
      keyboard: [
        { key: 'Enter', modifiers: [] },
        { key: ' ', modifiers: [] },
      ],
    },

    interactive: true,

    accessibility: {
      label,
      role: 'button',
      focusable: true,
      tabIndex: 0,
      minContrast: 4.5,
    },

    platform,
    frameworks: ['react', 'react-native', 'flutter'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
    tags: ['button', 'action', 'neumorphic', 'multimodal'],
  };
}

/**
 * Create icon-only button
 */
export function createIconButton(options: Omit<ButtonOptions, 'label'> & { iconName: string; ariaLabel: string }): NeumorphicComponent {
  const { iconName, ariaLabel, ...rest } = options;

  const button = createButton({
    ...rest,
    label: ariaLabel,
    width: options.width || 56,
    height: options.height || 56,
  });

  return {
    ...button,
    name: 'Icon Button',
    description: `Neumorphic icon button (${iconName})`,
    padding: {
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    },
    icon: {
      name: iconName,
      size: 24,
    },
    dimensions: {
      ...button.dimensions,
      width: options.width || 56,
      height: options.height || 56,
    },
    states: {
      ...button.states,
      default: {
        ...button.states.default,
        surface: {
          ...button.states.default.surface,
          borderRadius: 28, // Circular
        },
      },
    },
  };
}

/**
 * Create text-only button (flat, minimal shadow)
 */
export function createTextButton(options: ButtonOptions): NeumorphicComponent {
  const button = createButton(options);

  const minimalStates = NeumorphicStyleGenerator.generateAllStates(
    options.backgroundColor || '#E0E5EC',
    1, // Very shallow depth
    'top-left',
    16
  );

  return {
    ...button,
    name: 'Text Button',
    description: `Neumorphic text button with label "${options.label}"`,
    states: minimalStates,
    padding: {
      top: 8,
      right: 16,
      bottom: 8,
      left: 16,
    },
    tags: ['button', 'text-button', 'minimal', 'neumorphic'],
  };
}
