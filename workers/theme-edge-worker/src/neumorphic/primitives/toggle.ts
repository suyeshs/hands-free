import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export function createToggle(options: any = {}): NeumorphicComponent {
  const id = crypto.randomUUID();
  const states = NeumorphicStyleGenerator.generateAllStates('#E0E5EC', 2, 'top-left', 16);
  return {
    id, name: 'Toggle', type: 'toggle', description: 'Toggle switch', category: 'input',
    dimensions: { width: 52, height: 32 },
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
    margin: { top: 8, right: 8, bottom: 8, left: 8 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: 400, lineHeight: 1 },
    states, defaultState: 'default', transitions: [{ from: 'default', to: 'active', animation: { duration: 200, easing: 'ease-out' }, haptic: true }],
    interaction: { primary: 'touch', alternatives: ['voice'], touch: { minTouchSize: { width: 52, height: 32 }, haptic: 'light' }, voice: [{ triggers: ['toggle', 'switch', 'on', 'off'], feedback: 'Toggled', visualIndicator: false }] },
    interactive: true,
    accessibility: { label: 'Toggle', role: 'switch', focusable: true, tabIndex: 0, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['toggle', 'switch', 'control'],
  };
}

export function createSwitch(options: any = {}) { return createToggle(options); }
export function createCheckbox(options: any = {}) { const toggle = createToggle(options); return { ...toggle, name: 'Checkbox', dimensions: { width: 24, height: 24 }, states: { ...toggle.states, default: { ...toggle.states.default, surface: { ...toggle.states.default.surface, borderRadius: 6 } } } }; }
