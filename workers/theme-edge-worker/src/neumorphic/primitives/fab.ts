/**
 * Neumorphic FAB (Floating Action Button) Primitives
 */

import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export interface FABOptions {
  id?: string;
  icon: string;
  label?: string;
  backgroundColor?: string;
}

export function createFAB(options: FABOptions): NeumorphicComponent {
  const { id = crypto.randomUUID(), icon, label = 'Action', backgroundColor = '#2563EB' } = options;
  const states = NeumorphicStyleGenerator.generateAllStates(backgroundColor, 8, 'top-left', 28);

  return {
    id, name: 'FAB', type: 'fab', description: `Floating action button: ${label}`, category: 'action',
    dimensions: { width: 56, height: 56 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 0, right: 16, bottom: 16, left: 0 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 600, lineHeight: 1 },
    icon: { name: icon, size: 24 },
    states, defaultState: 'default',
    transitions: [
      { from: 'default', to: 'hover', animation: { duration: 150, easing: 'ease-out' }, haptic: false },
      { from: 'hover', to: 'pressed', animation: { duration: 100, easing: 'ease-in' }, haptic: true },
    ],
    interaction: {
      primary: 'touch',
      alternatives: ['voice'],
      touch: { minTouchSize: { width: 56, height: 56 }, haptic: 'medium' },
      voice: [{ triggers: [label.toLowerCase(), 'action', 'fab'], feedback: `${label} activated`, visualIndicator: true }],
    },
    interactive: true,
    accessibility: { label, role: 'button', focusable: true, tabIndex: 0, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native', 'flutter'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['fab', 'floating', 'action', 'neumorphic'],
  };
}

export function createMiniFAB(options: FABOptions): NeumorphicComponent {
  const fab = createFAB(options);
  return { ...fab, name: 'Mini FAB', dimensions: { width: 40, height: 40 }, icon: { ...fab.icon!, size: 18 } };
}

export function createExtendedFAB(options: FABOptions & { text: string }): NeumorphicComponent {
  const fab = createFAB(options);
  return {
    ...fab,
    name: 'Extended FAB',
    dimensions: { width: 'auto', height: 56 },
    padding: { top: 16, right: 24, bottom: 16, left: 24 },
    icon: { ...fab.icon!, position: 'left', spacing: 12 },
  };
}
