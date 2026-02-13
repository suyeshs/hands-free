import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export function createList(options: any = {}): NeumorphicComponent {
  const id = crypto.randomUUID();
  const states = NeumorphicStyleGenerator.generateAllStates('#E0E5EC', 2, 'top-left', 12);
  return {
    id, name: 'List', type: 'list', description: 'Neumorphic list container', category: 'content',
    dimensions: { width: '100%', height: 'auto' },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 8, right: 8, bottom: 8, left: 8 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
    states, defaultState: 'default', transitions: [],
    interaction: { primary: 'touch', alternatives: [] },
    interactive: false,
    layout: { display: 'flex', flexDirection: 'column', gap: 0 },
    accessibility: { label: 'List', role: 'list', focusable: false, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['list', 'container'],
  };
}

export function createListItem(options: any = {}): NeumorphicComponent {
  const id = crypto.randomUUID();
  const states = NeumorphicStyleGenerator.generateAllStates('#E0E5EC', 1, 'top-left', 0);
  return {
    id, name: 'List Item', type: 'list-item', description: 'List item', category: 'content',
    dimensions: { width: '100%', height: 56 },
    padding: { top: 12, right: 16, bottom: 12, left: 16 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
    states, defaultState: 'default', transitions: [{ from: 'default', to: 'hover', animation: { duration: 150, easing: 'ease-out' } }],
    interaction: { primary: 'touch', alternatives: ['voice'], touch: { minTouchSize: { width: 200, height: 56 } } },
    interactive: true,
    accessibility: { label: 'List item', role: 'listitem', focusable: true, tabIndex: 0, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['list-item', 'item'],
  };
}

export function createDivider(options: any = {}): NeumorphicComponent {
  const id = crypto.randomUUID();
  const states = NeumorphicStyleGenerator.generateAllStates('#E0E5EC', 1, 'top-left', 0);
  return {
    id, name: 'Divider', type: 'custom', description: 'Horizontal divider', category: 'layout',
    dimensions: { width: '100%', height: 1 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 0, fontWeight: 400, lineHeight: 1 },
    states, defaultState: 'default', transitions: [],
    interaction: { primary: 'touch', alternatives: [] },
    interactive: false,
    accessibility: { label: 'Divider', role: 'separator', focusable: false, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['divider', 'separator'],
  };
}
