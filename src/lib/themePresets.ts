/**
 * Theme Presets for Online Presence
 *
 * Defines available theme presets for customer-facing menus
 * covering various restaurant types.
 */

export interface ThemePreset {
  id: string;
  name: string;
  family: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  tags: string[];
}

export interface FontOption {
  id: string;
  name: string;
  style: 'sans-serif' | 'serif';
  tags: string[];
  cssValue: string;
}

export const THEME_FAMILIES = [
  'multimodal-restaurant',
  'grab-food',
  'handsfree-tech',
  'travel',
] as const;

export const THEME_CATEGORIES = [
  { id: 'all', label: 'All Themes', count: 16 },
  { id: 'indian', label: 'Indian', count: 4 },
  { id: 'pizza', label: 'Pizza', count: 3 },
  { id: 'cafe', label: 'Cafe', count: 3 },
  { id: 'fine-dining', label: 'Fine Dining', count: 3 },
  { id: 'fast-food', label: 'Fast Food', count: 2 },
  { id: 'generic', label: 'Versatile', count: 1 },
] as const;

export const THEME_PRESETS: ThemePreset[] = [
  // Indian Restaurants (4 presets)
  {
    id: 'coorg-food-company',
    name: 'Coorg Food Company',
    family: 'multimodal-restaurant',
    description: 'Warm, traditional South Indian restaurant theme with earthy tones',
    primaryColor: '#FF6B35',
    secondaryColor: '#004E89',
    tags: ['traditional', 'warm', 'indian', 'south-indian'],
  },
  {
    id: 'khao-piyo-custom',
    name: 'Khao Piyo Custom',
    family: 'multimodal-restaurant',
    description: 'Energetic street food theme with bold colors and modern typography',
    primaryColor: '#EAB308',
    secondaryColor: '#DC2626',
    tags: ['vibrant', 'street-food', 'casual', 'north-indian', 'indian'],
  },
  {
    id: 'tandoor-grill',
    name: 'Tandoor Grill',
    family: 'multimodal-restaurant',
    description: 'Rich, luxurious theme for upscale North Indian restaurants',
    primaryColor: '#B91C1C',
    secondaryColor: '#92400E',
    tags: ['elegant', 'north-indian', 'tandoor', 'premium', 'indian'],
  },
  {
    id: 'masala-modern',
    name: 'Masala Modern',
    family: 'multimodal-restaurant',
    description: 'Clean, modern theme for contemporary Indian cuisine',
    primaryColor: '#F97316',
    secondaryColor: '#059669',
    tags: ['modern', 'fusion', 'contemporary', 'indian'],
  },

  // Pizza Places (3 presets)
  {
    id: 'neapolitan-classic',
    name: 'Neapolitan Classic',
    family: 'multimodal-restaurant',
    description: 'Classic Italian pizzeria with red, white, and green color palette',
    primaryColor: '#DC2626',
    secondaryColor: '#16A34A',
    tags: ['italian', 'traditional', 'authentic', 'neapolitan', 'pizza'],
  },
  {
    id: 'ny-slice',
    name: 'NY Slice',
    family: 'multimodal-restaurant',
    description: 'Bold, urban theme for New York-style pizza joints',
    primaryColor: '#1E40AF',
    secondaryColor: '#EAB308',
    tags: ['ny-style', 'urban', 'bold', 'american', 'pizza'],
  },
  {
    id: 'artisan-sourdough',
    name: 'Artisan Sourdough',
    family: 'multimodal-restaurant',
    description: 'Rustic, artisanal theme for craft pizza restaurants',
    primaryColor: '#78350F',
    secondaryColor: '#F59E0B',
    tags: ['artisan', 'craft', 'rustic', 'gourmet', 'pizza'],
  },

  // Cafes (3 presets)
  {
    id: 'modern-minimalist-cafe',
    name: 'Modern Minimalist Cafe',
    family: 'multimodal-restaurant',
    description: 'Clean, minimal Scandinavian-inspired cafe theme',
    primaryColor: '#0F172A',
    secondaryColor: '#E2E8F0',
    tags: ['modern', 'minimalist', 'clean', 'scandinavian', 'cafe'],
  },
  {
    id: 'vintage-coffee-house',
    name: 'Vintage Coffee House',
    family: 'multimodal-restaurant',
    description: 'Warm, nostalgic theme for traditional coffee houses',
    primaryColor: '#92400E',
    secondaryColor: '#FDE68A',
    tags: ['vintage', 'cozy', 'traditional', 'coffee', 'cafe'],
  },
  {
    id: 'botanical-cafe',
    name: 'Botanical Cafe',
    family: 'multimodal-restaurant',
    description: 'Fresh, natural theme with botanical accents for healthy cafes',
    primaryColor: '#059669',
    secondaryColor: '#F3F4F6',
    tags: ['botanical', 'fresh', 'natural', 'healthy', 'cafe'],
  },

  // Fine Dining (3 presets)
  {
    id: 'michelin-noir',
    name: 'Michelin Noir',
    family: 'multimodal-restaurant',
    description: 'Sophisticated dark theme with gold accents for upscale restaurants',
    primaryColor: '#0F172A',
    secondaryColor: '#D4AF37',
    tags: ['luxury', 'fine-dining', 'elegant', 'dark'],
  },
  {
    id: 'michelin-blanc',
    name: 'Michelin Blanc',
    family: 'multimodal-restaurant',
    description: 'Refined light theme with subtle accents for haute cuisine',
    primaryColor: '#F8FAFC',
    secondaryColor: '#64748B',
    tags: ['luxury', 'fine-dining', 'elegant', 'light'],
  },
  {
    id: 'modern-luxury',
    name: 'Modern Luxury',
    family: 'multimodal-restaurant',
    description: 'Contemporary luxury theme with bold color palette',
    primaryColor: '#6366F1',
    secondaryColor: '#EC4899',
    tags: ['luxury', 'modern', 'contemporary', 'upscale'],
  },

  // Fast Food / Quick Service (2 presets)
  {
    id: 'grab-food-default',
    name: 'Grab Food Default',
    family: 'grab-food',
    description: 'Modern, delivery-focused theme optimized for speed',
    primaryColor: '#10B981',
    secondaryColor: '#059669',
    tags: ['delivery', 'modern', 'fast', 'quick-service', 'fast-food'],
  },
  {
    id: 'quick-serve-bright',
    name: 'Quick Serve Bright',
    family: 'multimodal-restaurant',
    description: 'High-energy theme with bright colors for quick service restaurants',
    primaryColor: '#EF4444',
    secondaryColor: '#FBBF24',
    tags: ['fast-food', 'quick', 'energetic', 'casual'],
  },

  // Generic / Versatile (1 preset)
  {
    id: 'universal-restaurant',
    name: 'Universal Restaurant',
    family: 'multimodal-restaurant',
    description: 'Clean, professional theme that works for any restaurant type',
    primaryColor: '#2563EB',
    secondaryColor: '#64748B',
    tags: ['versatile', 'professional', 'clean', 'generic'],
  },
];

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'inter',
    name: 'Inter',
    style: 'sans-serif',
    tags: ['modern', 'clean'],
    cssValue: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    style: 'sans-serif',
    tags: ['friendly', 'rounded'],
    cssValue: 'Poppins, sans-serif',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    style: 'sans-serif',
    tags: ['professional', 'neutral'],
    cssValue: 'Roboto, sans-serif',
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    style: 'sans-serif',
    tags: ['elegant', 'modern'],
    cssValue: 'Montserrat, sans-serif',
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    style: 'serif',
    tags: ['elegant', 'traditional'],
    cssValue: '"Playfair Display", serif',
  },
  {
    id: 'lora',
    name: 'Lora',
    style: 'serif',
    tags: ['classic', 'readable'],
    cssValue: 'Lora, serif',
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    style: 'serif',
    tags: ['traditional', 'warm'],
    cssValue: 'Merriweather, serif',
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    style: 'serif',
    tags: ['luxury', 'refined'],
    cssValue: '"Cormorant Garamond", serif',
  },
];

/**
 * Get theme preset by ID
 */
export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get font option by ID
 */
export function getFontOption(id: string): FontOption | undefined {
  return FONT_OPTIONS.find((font) => font.id === id);
}

/**
 * Filter themes by category
 */
export function filterThemesByCategory(category: string): ThemePreset[] {
  if (category === 'all') {
    return THEME_PRESETS;
  }
  return THEME_PRESETS.filter((preset) => preset.tags.includes(category));
}

/**
 * Filter themes by search query
 */
export function searchThemes(query: string): ThemePreset[] {
  const lowercaseQuery = query.toLowerCase();
  return THEME_PRESETS.filter(
    (preset) =>
      preset.name.toLowerCase().includes(lowercaseQuery) ||
      preset.description.toLowerCase().includes(lowercaseQuery) ||
      preset.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
  );
}
