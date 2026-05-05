import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export function createModal(options: any = {}): NeumorphicComponent {
  const id = crypto.randomUUID();
  const states = NeumorphicStyleGenerator.generateAllStates('#FFFFFF', 10, 'top-left', 24);
  return {
    id, name: 'Modal', type: 'modal', description: 'Modal dialog', category: 'feedback',
    dimensions: { width: '90%', height: 'auto', maxWidth: 600 },
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 400, lineHeight: 1.6 },
    states, defaultState: 'default', transitions: [],
    interaction: { primary: 'touch', alternatives: ['keyboard'] },
    interactive: true,
    accessibility: { label: 'Modal', role: 'dialog', focusable: true, tabIndex: -1, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['modal', 'dialog', 'overlay'],
  };
}

export function createDialog(options: any = {}): NeumorphicComponent {
  return { ...createModal(options), name: 'Dialog', type: 'modal' };
}

export function createBottomSheet(options: any = {}): NeumorphicComponent {
  const modal = createModal(options);
  return { ...modal, name: 'Bottom Sheet', dimensions: { ...modal.dimensions, width: '100%' } };
}
