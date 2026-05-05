/**
 * Neumorphic Card Primitives
 */

import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export interface CardOptions {
  id?: string;
  backgroundColor?: string;
  depth?: number;
  interactive?: boolean;
}

export function createCard(options: CardOptions = {}): NeumorphicComponent {
  const { id = crypto.randomUUID(), backgroundColor = '#E0E5EC', depth = 4, interactive = false } = options;
  const states = NeumorphicStyleGenerator.generateAllStates(backgroundColor, depth, 'top-left', 20);

  return {
    id, name: 'Card', type: 'card', description: 'Neumorphic card container', category: 'content',
    dimensions: { width: '100%', height: 'auto', minHeight: 100 },
    padding: { top: 20, right: 20, bottom: 20, left: 20 },
    margin: { top: 12, right: 12, bottom: 12, left: 12 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: 400, lineHeight: 1.6 },
    states, defaultState: 'default',
    transitions: interactive ? [{ from: 'default', to: 'hover', animation: { duration: 200, easing: 'ease-out' } }] : [],
    interaction: interactive ? {
      primary: 'touch',
      alternatives: ['keyboard'],
      touch: { minTouchSize: { width: 200, height: 100 } },
    } : { primary: 'touch', alternatives: [] },
    interactive,
    layout: { display: 'flex', flexDirection: 'column', gap: 12 },
    accessibility: { label: 'Card', role: 'article', focusable: interactive, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native', 'flutter'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['card', 'container', 'neumorphic'],
  };
}

export function createElevatedCard(options: CardOptions = {}): NeumorphicComponent {
  return createCard({ ...options, depth: 7 });
}

export function createInsetCard(options: CardOptions = {}): NeumorphicComponent {
  const card = createCard({ ...options, depth: 3 });
  card.states.default.surface.shadows = NeumorphicStyleGenerator.generateSurface(options.backgroundColor || '#E0E5EC', 3, 'top-left', 20, true).shadows;
  return card;
}
