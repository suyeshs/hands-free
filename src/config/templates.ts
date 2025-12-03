export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  gradient: string;
  size: 'large' | 'small';
}

export const templates: Template[] = [
  {
    id: 'modern-bistro',
    name: 'Modern Bistro',
    category: 'Contemporary',
    description: 'Clean, minimalist design with bold typography. Perfect for upscale casual dining.',
    features: ['QR Code Ordering', 'Dark Mode', 'Animated Menu'],
    gradient: 'from-slate-800 via-slate-700 to-slate-900',
    size: 'large',
  },
  {
    id: 'classic-trattoria',
    name: 'Classic Trattoria',
    category: 'Traditional',
    description: 'Warm, inviting aesthetic with rich colors. Ideal for Italian and Mediterranean cuisines.',
    features: ['Photo Gallery', 'Reservation System', 'Multi-language'],
    gradient: 'from-amber-900 via-orange-800 to-red-900',
    size: 'small',
  },
  {
    id: 'zen-sushi',
    name: 'Zen Sushi',
    category: 'Minimal',
    description: 'Japanese-inspired simplicity with elegant spacing. Built for sushi bars and Asian fusion.',
    features: ['Omakase Menu', 'Chef Stories', 'Sake Pairing'],
    gradient: 'from-stone-800 via-neutral-700 to-zinc-900',
    size: 'small',
  },
  {
    id: 'street-food',
    name: 'Street Food',
    category: 'Vibrant',
    description: 'Bold colors and energetic layout. Great for food trucks, taquerias, and casual spots.',
    features: ['Quick Order', 'Location Tracker', 'Social Feed'],
    gradient: 'from-pink-600 via-purple-600 to-indigo-700',
    size: 'small',
  },
  {
    id: 'farm-table',
    name: 'Farm to Table',
    category: 'Organic',
    description: 'Earthy tones with natural textures. Designed for farm-fresh and organic restaurants.',
    features: ['Sourcing Map', 'Seasonal Menu', 'Chef Blog'],
    gradient: 'from-green-800 via-emerald-700 to-teal-800',
    size: 'large',
  },
  {
    id: 'cafe-blend',
    name: 'Café Blend',
    category: 'Cozy',
    description: 'Warm coffee-shop vibes with comfortable aesthetics. Perfect for cafés and bakeries.',
    features: ['Loyalty Program', 'Pre-order', 'Gift Cards'],
    gradient: 'from-yellow-800 via-amber-700 to-orange-800',
    size: 'small',
  },
];

export const posIntegrations = [
  { id: 'square', name: 'Square', status: 'available' },
  { id: 'toast', name: 'Toast', status: 'coming-soon' },
  { id: 'clover', name: 'Clover', status: 'coming-soon' },
  { id: 'lightspeed', name: 'Lightspeed', status: 'coming-soon' },
];
