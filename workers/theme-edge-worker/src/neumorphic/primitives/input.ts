/**
 * Neumorphic Input Primitives
 */

import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export interface InputOptions {
  id?: string;
  label: string;
  placeholder?: string;
  backgroundColor?: string;
  multiline?: boolean;
  voiceInput?: boolean;
}

export function createTextField(options: InputOptions): NeumorphicComponent {
  const { id = crypto.randomUUID(), label, placeholder = '', backgroundColor = '#E0E5EC', voiceInput = true } = options;

  const states = NeumorphicStyleGenerator.generateAllStates(backgroundColor, 3, 'top-left', 16);
  // Make default state inset
  states.default.surface.shadows = NeumorphicStyleGenerator.generateSurface(backgroundColor, 3, 'top-left', 16, true).shadows;

  return {
    id, name: 'Text Field', type: 'text-field', description: `Input field for ${label}`, category: 'input',
    dimensions: { width: '100%', height: 56, minWidth: 200 },
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
    states, defaultState: 'default',
    transitions: [
      { from: 'default', to: 'focused', animation: { duration: 200, easing: 'ease-out' } },
    ],
    interaction: {
      primary: 'touch',
      alternatives: voiceInput ? ['voice', 'keyboard'] : ['keyboard'],
      touch: { minTouchSize: { width: 200, height: 56 } },
      voice: voiceInput ? [{ triggers: ['type', 'input', `enter ${label.toLowerCase()}`], feedback: 'Voice input ready', visualIndicator: true }] : undefined,
    },
    interactive: true,
    accessibility: { label, role: 'textbox', focusable: true, tabIndex: 0, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['input', 'text-field', 'neumorphic', 'multimodal'],
  };
}

export function createTextArea(options: InputOptions): NeumorphicComponent {
  const field = createTextField({ ...options, multiline: true });
  return { ...field, name: 'Text Area', type: 'input', dimensions: { ...field.dimensions, height: 120 } };
}

export function createSearchField(options: Omit<InputOptions, 'label'>): NeumorphicComponent {
  const field = createTextField({ ...options, label: 'Search', placeholder: 'Search...' });
  return {
    ...field, name: 'Search Field', icon: { name: 'search', size: 20, position: 'left', spacing: 12 },
    interaction: {
      ...field.interaction,
      voice: [
        { triggers: ['search', 'find', 'look for'], feedback: 'Voice search ready', visualIndicator: true },
      ],
    },
  };
}
