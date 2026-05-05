import type { NeumorphicComponent } from '../types';
import { NeumorphicStyleGenerator } from '../style-generator';

export function createNavigationBar(options: any = {}): NeumorphicComponent {
  const id = crypto.randomUUID();
  const states = NeumorphicStyleGenerator.generateAllStates('#E0E5EC', 3, 'top-left', 0);
  return {
    id, name: 'Navigation Bar', type: 'navigation-bar', description: 'Bottom navigation', category: 'navigation',
    dimensions: { width: '100%', height: 64 },
    padding: { top: 8, right: 16, bottom: 8, left: 16 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: 1 },
    states, defaultState: 'default', transitions: [],
    interaction: { primary: 'touch', alternatives: ['voice', 'keyboard'] },
    interactive: true,
    layout: { display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    accessibility: { label: 'Navigation', role: 'navigation', focusable: false, minContrast: 4.5 },
    platform: 'both', frameworks: ['react', 'react-native'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0',
    tags: ['navigation', 'bar', 'bottom-nav'],
  };
}

export function createTabBar(options: any = {}) { return createNavigationBar(options); }
export function createSideNav(options: any = {}) { return { ...createNavigationBar(options), name: 'Side Navigation', dimensions: { width: 280, height: '100%' }, layout: { display: 'flex', flexDirection: 'column' } }; }
