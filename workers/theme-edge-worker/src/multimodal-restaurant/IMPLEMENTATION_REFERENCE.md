# Multimodal Restaurant Theme - Implementation Reference

**Version:** 1.0.0
**Last Updated:** 2025-12-03
**Author:** Stonepot Platform Team

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Type System](#type-system)
4. [Design Tokens](#design-tokens)
5. [Component Primitives](#component-primitives)
6. [Layout Configurations](#layout-configurations)
7. [Animation System](#animation-system)
8. [Preset Themes](#preset-themes)
9. [API Handlers](#api-handlers)
10. [Integration Guide](#integration-guide)
11. [Usage Examples](#usage-examples)

---

## Overview

The **Multimodal Restaurant Theme** is a comprehensive theming system designed for restaurant ordering interfaces with support for both voice-assisted and standard browsing workflows. It's built on neumorphic design principles with Tailwind CSS integration and provides a complete solution for creating accessible, multimodal restaurant experiences.

### Key Features

- **Voice-assisted ordering** with real-time audio visualization
- **Standard browse mode** with grid/magazine/tabbed layouts
- **Neumorphic design system** with soft shadows and depth
- **Tailwind CSS integration** for utility-first styling
- **Multimodal interactions** supporting touch, voice, and keyboard
- **WCAG AA accessibility** compliance
- **Responsive layouts** for mobile, tablet, and desktop
- **Comprehensive animation templates** using Framer Motion
- **Type-safe** with full TypeScript support
- **Runtime validation** with Zod schemas

---

## Architecture

### Module Structure

```
multimodal-restaurant/
├── index.ts                    # Main module exports
├── types.ts                    # TypeScript type definitions
├── schema.ts                   # Zod validation schemas
├── design-tokens.ts            # Color palettes, typography, etc.
├── animation-templates.ts      # Framer Motion variants
├── api-handlers.ts             # Edge worker API handlers
├── ANIMATION_GUIDE.md         # Animation usage guide
├── layouts/
│   └── index.ts               # Layout configurations
├── primitives/
│   ├── index.ts               # Component registry
│   ├── menu-card.ts           # Menu card component
│   ├── voice-orb.ts           # Voice assistant orb
│   ├── cart-island.ts         # Floating cart indicator
│   └── category-carousel.ts   # Category navigation
└── presets/
    ├── coorg-food-company.ts  # CFC preset theme
    └── generic-restaurant.ts  # Generic restaurant theme
```

### Integration with Theme Edge Worker

The multimodal-restaurant module is integrated into the main theme edge worker at [src/index.ts:100-102](src/index.ts#L100-L102):

```typescript
// Route: /api/multimodal-restaurant/* - Multimodal Restaurant theme API
if (url.pathname.startsWith('/api/multimodal-restaurant')) {
  return handleMultimodalRestaurantAPI(request, url.pathname);
}
```

---

## Type System

### Core Types

#### MultimodalRestaurantTheme

The main theme structure containing all configuration:

```typescript
interface MultimodalRestaurantTheme {
  version: string;
  meta: ThemeMeta;
  designTokens: RestaurantDesignTokens;
  layouts: {
    landing: LandingLayoutConfig;
    voiceAssisted: VoiceAssistedLayoutConfig;
    standardBrowse: StandardBrowseLayoutConfig;
  };
  components: RestaurantComponents;
  interactions: RestaurantInteractions;
  accessibility: AccessibilityConfig;
  customCSS?: string;
}
```

#### Design Token Types

**RestaurantColorPalette** - Food-optimized color system:
- `primary`: Warm appetizing colors (typically orange/red)
- `secondary`: Supporting colors (browns for comfort food)
- `accent`: CTA and highlight colors
- `background`: Main, surface, and elevated backgrounds
- `text`: Primary, secondary, tertiary, disabled, inverse
- `dietary`: Veg, non-veg, vegan, gluten-free indicators
- `status`: Success, warning, error, info states
- `voiceStates`: Idle, listening, thinking, speaking colors

**ColorScale** - 11-shade color palette (50-950):
```typescript
interface ColorScale {
  50: string;   // Lightest
  100: string;
  ...
  500: string;  // Base color
  ...
  950: string;  // Darkest
}
```

#### Component Types

**MenuCardComponent** - Menu item card configuration:
- Layout options (image, rating, badges, description, price)
- Image configuration (aspect ratio, lazy loading)
- Badge styles (bestseller, new, spicy, dietary)
- Price display settings
- Action button configuration

**VoiceOrbComponent** - AI assistant orb:
- Size and position settings
- Audio visualizer configuration (circular/waveform/spectrum)
- State colors and gradients
- Glow effect intensity

---

## Design Tokens

### Color Palettes

#### Warm Orange (Primary)
Appetizing color for food contexts:
```typescript
{
  50: '#fff7ed',
  100: '#ffedd5',
  ...
  500: '#f97316',  // Base - Vibrant orange
  ...
  950: '#431407'
}
```

#### Fresh Green (Vegetarian)
```typescript
{
  500: '#22c55e'  // Vibrant green for veg indicators
}
```

#### Rich Red (Non-Vegetarian)
```typescript
{
  500: '#ef4444'  // Clear red for non-veg indicators
}
```

#### Voice State Colors
```typescript
voiceStates: {
  idle: '#94a3b8',      // Neutral gray
  listening: '#0ea5e9',  // Sky blue
  thinking: '#f59e0b',   // Amber
  speaking: '#22c55e'    // Fresh green
}
```

### Typography

**Font System:**
- Sans-serif: Inter, -apple-system, BlinkMacSystemFont, Segoe UI
- Scale: xs (12px) → 4xl (36px)
- Weights: normal (400), medium (500), semibold (600), bold (700)
- Line heights: tight (1.25) → loose (2)

### Spacing Scale

8px base unit system:
```typescript
{
  0: '0',
  1: '4px',   // 0.5 unit
  2: '8px',   // 1 unit
  3: '12px',  // 1.5 units
  4: '16px',  // 2 units
  ...
  24: '96px'  // 12 units
}
```

### Neumorphic Shadows

Soft shadows for depth:
```typescript
{
  sm: '-4px -4px 8px rgba(255,255,255,0.8), 4px 4px 8px rgba(0,0,0,0.15)',
  md: '-8px -8px 16px rgba(255,255,255,0.8), 8px 8px 16px rgba(0,0,0,0.15)',
  ...
}
```

### Animation Configuration

```typescript
{
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms'
  },
  easing: {
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
}
```

---

## Component Primitives

### Menu Card

Factory function for creating menu item cards:

```typescript
createMenuCard(options?: MenuCardOptions): MenuCardComponent
```

**Options:**
- `layout`: 'standard' | 'compact' | 'detailed'
- `showImage`: boolean
- `showRating`: boolean
- `showBadges`: boolean
- `showDescription`: boolean
- `imageHeight`: string (CSS value)
- `cardSize`: 'compact' | 'comfortable' | 'spacious'

**Variants:**
- `createMenuCard()` - Standard card
- `createCompactMenuCard()` - List view card
- `createDetailedMenuCard()` - Modal/detail view card
- `createComboCard()` - Combo meal with choice selection

**Example:**
```typescript
const menuCard = createMenuCard({
  layout: 'standard',
  cardSize: 'comfortable',
  showImage: true,
  showRating: true,
  showBadges: true,
  imageHeight: '12rem'
});
```

### Voice Orb

Pulsating AI assistant orb with audio visualizer:

```typescript
createVoiceOrb(options?: VoiceOrbOptions): VoiceOrbComponent
```

**Features:**
- Circular audio visualizer
- State-based color gradients (idle/listening/thinking/speaking)
- Pulse animations
- Glow effects
- Position options (bottom-center, bottom-right, floating)

### Cart Island

Floating cart indicator with item count and total:

```typescript
createCartIsland(options?: CartIslandOptions): CartIslandComponent
```

**Features:**
- Item count badge
- Total price display
- Pulse animation on add
- Expandable on click/hover
- Position options (bottom-left, bottom-right, top-right)

### Category Carousel

Horizontal/vertical category navigation:

```typescript
createCategoryCarousel(options?: CategoryCarouselOptions): CategoryCarouselComponent
```

**Features:**
- Pills, cards, or tabs style
- Icon support
- Item count display
- Scroll behaviors (snap, smooth, momentum)
- Active indicators (underline, background, border)

---

## Layout Configurations

### Landing Layout

**Two-Path Layout** - Choice between voice and standard:
```typescript
{
  type: 'two-path',
  choiceCards: {
    voice: {
      label: 'Voice Ordering',
      description: 'Order naturally with your voice',
      benefits: [...],
      gradient: { from: '#e6f0ff', to: '#dae5f5', direction: 'to-br' }
    },
    standard: {
      label: 'Browse Menu',
      description: 'Traditional menu browsing',
      benefits: [...],
      gradient: { from: '#fff3e6', to: '#ffe8d5', direction: 'to-br' }
    }
  }
}
```

**Menu-First Layout** - Direct to menu with voice FAB:
```typescript
{
  type: 'menu-first',
  hero: {
    showLogo: true,
    showTagline: true,
    height: 'sm'
  }
}
```

### Voice-Assisted Layout

**Split-View** - Voice panel + visual feed:
```typescript
{
  type: 'split-view',
  voicePanel: {
    width: 'medium',  // 40%
    position: 'left',
    showTranscript: true,
    showCartSummary: true
  },
  voiceOrb: {
    size: 'lg',
    position: 'floating',
    showVisualizer: true
  },
  visualFeed: {
    showCategories: true,
    highlightMentioned: true,
    autoScroll: true,
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 }
  }
}
```

**Overlay** - Full menu with contextual overlays:
```typescript
{
  type: 'overlay',
  voiceOrb: {
    size: 'md',
    position: 'bottom-right',
    pulseAnimation: 'strong'
  }
}
```

**Immersive** - Voice-first with minimal distractions:
```typescript
{
  type: 'immersive',
  voiceOrb: {
    size: 'lg',
    position: 'bottom-center'
  },
  visualFeed: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 }
  }
}
```

### Standard Browse Layout

**Enhanced Grid** - Traditional grid with filters:
```typescript
{
  type: 'grid',
  categoryNav: {
    type: 'carousel',
    position: 'sticky',
    showIcons: true,
    showCount: true
  },
  menuGrid: {
    columns: { mobile: 1, tablet: 2, desktop: 3 },
    gap: '1.5rem',
    cardSize: 'comfortable'
  },
  filters: {
    show: true,
    position: 'top',
    options: [dietary, price, rating, spice]
  }
}
```

**Magazine** - Visual-first editorial style:
```typescript
{
  type: 'magazine',
  categoryNav: { type: 'tabs', position: 'top' },
  menuGrid: {
    columns: { mobile: 1, tablet: 2, desktop: 3 },
    gap: '2rem',
    cardSize: 'spacious'
  }
}
```

**Tabbed Dashboard** - App-like interface:
```typescript
{
  type: 'tabbed',
  categoryNav: { type: 'tabs', showIcons: true, showCount: true },
  menuGrid: {
    columns: { mobile: 1, tablet: 1, desktop: 1 },
    cardSize: 'compact'
  }
}
```

---

## Animation System

### Framer Motion Integration

All animations use Framer Motion variants for declarative animations.

See [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md) for complete reference.

### Animation Categories

1. **Page Transitions** - Navigation between screens
   - `landingEntry`, `slideInRight`, `slideInLeft`, `slideUpModal`, `crossFade`

2. **Element Transitions** - Component entry/exit
   - `menuCardEntry`, `voiceOrbEntry`, `cartIslandEntry`, `backdropFade`

3. **Interaction Animations** - Hover/tap/focus states
   - `buttonPress`, `cardLift`, `voiceOrbPulse`, `focusRing`

4. **List Animations** - Staggered multi-item animations
   - `menuGridContainer`, `menuGridItem`, `categoryCarouselContainer`

5. **Voice Animations** - Voice-specific feedback
   - `voiceMentionHighlight`, `transcriptEntry`, `voiceVisualizerBar`

### Built-in Motion Variants

Included in design tokens at `theme.designTokens.animations.motion`:

```typescript
{
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  slideUp: { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 } },
  scaleIn: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 }
  },
  cardHover: {
    whileHover: { y: -4, scale: 1.02 },
    whileTap: { scale: 0.98 }
  },
  orbPulse: {
    animate: {
      scale: [1, 1.05, 1],
      boxShadow: [...]
    }
  }
}
```

---

## Preset Themes

### Coorg Food Company Theme

Complete preset for South Indian restaurant:

**File:** [presets/coorg-food-company.ts](presets/coorg-food-company.ts)

**Key Features:**
- Warm orange primary color (#f97316)
- Bilingual support (English/Hindi)
- Split-view voice layout
- Comfortable card sizing
- Category carousel navigation
- Voice commands for browsing and ordering
- WCAG AA accessibility

**Custom CSS:**
```css
:root {
  --cfc-primary: #f97316;
  --cfc-secondary: #fb923c;
  --cfc-background: #e0e5ec;
}

.cfc-hero-text {
  background: linear-gradient(145deg, #f97316, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

**Voice Commands:**
- Browse: "show menu", "show combos"
- Order: "add", "order", "I want"
- Cart: "show cart", "my order", "checkout"
- Navigation: "go back", "previous"

### Generic Restaurant Theme

Versatile theme for any restaurant type:

**File:** [presets/generic-restaurant.ts](presets/generic-restaurant.ts)

Provides sensible defaults that can be customized.

---

## API Handlers

### Available Endpoints

#### GET /api/multimodal-restaurant/themes
List all available preset themes.

**Response:**
```json
{
  "presets": [
    {
      "id": "coorg-food-company",
      "name": "The Coorg Food Company",
      "description": "South Indian comfort food...",
      "version": "1.0.0",
      "tags": ["restaurant", "south-indian", "voice-ordering"]
    }
  ],
  "count": 2
}
```

#### GET /api/multimodal-restaurant/themes/:preset
Get specific preset theme.

**Example:**
```bash
GET /api/multimodal-restaurant/themes/coorg-food-company
```

**Response:**
```json
{
  "theme": { /* Complete theme object */ },
  "preset": "coorg-food-company",
  "timestamp": "2025-12-03T..."
}
```

**Cache Headers:**
- `Cache-Control: public, max-age=3600, s-maxage=86400`
- `CDN-Cache-Control: public, max-age=86400`

#### POST /api/multimodal-restaurant/themes/validate
Validate theme JSON against schema.

**Request:**
```json
{
  "version": "1.0.0",
  "meta": { ... },
  "designTokens": { ... },
  "layouts": { ... },
  "components": { ... },
  "interactions": { ... },
  "accessibility": { ... }
}
```

**Response (valid):**
```json
{
  "valid": true,
  "message": "Theme is valid",
  "data": { /* Validated theme */ }
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "errors": [
    "designTokens.colors.primary: Invalid color scale",
    "layouts.landing.type: Must be one of [two-path, menu-first, hero]"
  ]
}
```

#### GET /api/multimodal-restaurant/animations
Get all animation templates.

**Response:**
```json
{
  "animations": { /* AnimationTemplates object */ },
  "categories": ["page", "element", "interaction", "list", "voice"]
}
```

#### GET /api/multimodal-restaurant/design-tokens
Get default design tokens.

**Response:**
```json
{
  "designTokens": { /* DefaultRestaurantDesignTokens */ }
}
```

#### GET /api/multimodal-restaurant/layouts/:type
Get layout configuration.

**Types:** `landing`, `voice-assisted`, `standard-browse`

**Response:**
```json
{
  "layout": { /* Layout configuration */ },
  "type": "landing"
}
```

---

## Integration Guide

### 1. Install Dependencies

```bash
npm install zod framer-motion
```

### 2. Import Theme

```typescript
import {
  CoorgFoodCompanyTheme,
  GenericRestaurantTheme,
  getRestaurantThemePreset
} from '@/multimodal-restaurant';

// Use preset
const theme = CoorgFoodCompanyTheme;

// Or get by name
const theme = getRestaurantThemePreset('coorg-food-company');
```

### 3. Access Design Tokens

```typescript
const colors = theme.designTokens.colors;
const typography = theme.designTokens.typography;
const animations = theme.designTokens.animations;

// Use in components
<div style={{
  color: colors.text.primary,
  fontFamily: typography.fontFamily.sans.join(', '),
  fontSize: typography.scale.lg
}}>
  Menu Item
</div>
```

### 4. Use Primitives

```typescript
import {
  createMenuCard,
  createVoiceOrb,
  createCartIsland
} from '@/multimodal-restaurant';

// Create components
const menuCard = createMenuCard({
  cardSize: 'comfortable',
  showImage: true,
  showRating: true
});

const voiceOrb = createVoiceOrb({
  size: 'lg',
  position: 'bottom-center',
  showVisualizer: true
});
```

### 5. Apply Layouts

```typescript
const layout = theme.layouts.voiceAssisted;

// Use configuration
<div className={`grid-cols-${layout.visualFeed.gridColumns.mobile}`}>
  {/* Menu items */}
</div>
```

### 6. Use Animations

```typescript
import { motion } from 'framer-motion';

const cardVariants = theme.designTokens.animations.motion.cardHover;

<motion.div
  variants={cardVariants}
  whileHover="whileHover"
  whileTap="whileTap"
>
  <MenuCard />
</motion.div>
```

### 7. Validate Custom Themes

```typescript
import { validateMultimodalRestaurantTheme } from '@/multimodal-restaurant';

const customTheme = { /* your theme */ };
const validation = validateMultimodalRestaurantTheme(customTheme);

if (validation.valid) {
  console.log('Theme is valid!', validation.data);
} else {
  console.error('Validation errors:', validation.errors);
}
```

---

## Usage Examples

### Example 1: Basic Restaurant Menu

```typescript
import { CoorgFoodCompanyTheme, createMenuCard } from '@/multimodal-restaurant';

const theme = CoorgFoodCompanyTheme;
const menuCard = createMenuCard({
  cardSize: 'comfortable',
  showImage: true,
  showBadges: true
});

// Apply theme colors
const styles = {
  primary: theme.designTokens.colors.primary[500],
  background: theme.designTokens.colors.background.main,
  text: theme.designTokens.colors.text.primary
};
```

### Example 2: Voice-Assisted Ordering

```typescript
import { CoorgFoodCompanyTheme, createVoiceOrb } from '@/multimodal-restaurant';

const theme = CoorgFoodCompanyTheme;
const layout = theme.layouts.voiceAssisted;
const voiceOrb = createVoiceOrb({
  size: layout.voiceOrb.size,
  position: layout.voiceOrb.position,
  showVisualizer: layout.voiceOrb.showVisualizer
});

// Voice commands
const commands = theme.interactions.voiceCommands;
console.log('Browse commands:', commands.browse);
console.log('Order commands:', commands.order);
```

### Example 3: Animated Menu Grid

```typescript
import { motion } from 'framer-motion';
import { CoorgFoodCompanyTheme } from '@/multimodal-restaurant';

const theme = CoorgFoodCompanyTheme;
const animations = theme.designTokens.animations.motion;

function MenuGrid({ items }) {
  return (
    <motion.div
      variants={animations.staggerChildren}
      initial="initial"
      animate="animate"
      className="grid grid-cols-3 gap-6"
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          variants={animations.slideUp}
          whileHover={animations.cardHover.whileHover}
          whileTap={animations.cardHover.whileTap}
        >
          <MenuCard item={item} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Example 4: Dietary Badge Rendering

```typescript
import { CoorgFoodCompanyTheme, DietaryBadgeColors } from '@/multimodal-restaurant';

function DietaryBadge({ type }: { type: 'veg' | 'nonVeg' | 'vegan' }) {
  const badge = DietaryBadgeColors[type];

  return (
    <span
      style={{
        backgroundColor: badge.backgroundColor,
        color: badge.textColor,
        border: `1px solid ${badge.borderColor}`,
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '0.85rem'
      }}
    >
      {badge.icon} {type}
    </span>
  );
}
```

### Example 5: Custom Theme Creation

```typescript
import {
  DefaultRestaurantDesignTokens,
  DefaultLayouts,
  createMenuCard,
  createVoiceOrb,
  MultimodalRestaurantTheme
} from '@/multimodal-restaurant';

const customTheme: MultimodalRestaurantTheme = {
  version: '1.0.0',
  meta: {
    name: 'My Restaurant',
    description: 'Custom restaurant theme',
    author: 'Your Name',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0'
  },
  designTokens: {
    ...DefaultRestaurantDesignTokens,
    colors: {
      ...DefaultRestaurantDesignTokens.colors,
      primary: {
        ...DefaultRestaurantDesignTokens.colors.primary,
        500: '#ff0000' // Custom red
      }
    }
  },
  layouts: DefaultLayouts,
  components: {
    menuCard: createMenuCard(),
    voiceOrb: createVoiceOrb(),
    // ... other components
  },
  interactions: {
    // ... interaction config
  },
  accessibility: {
    wcagLevel: 'AA',
    // ... accessibility config
  }
};
```

---

## Best Practices

### 1. Color Usage
- Use warm colors (orange/red) for primary actions to stimulate appetite
- Use green for vegetarian indicators (#22c55e)
- Use red for non-vegetarian indicators (#ef4444)
- Ensure WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)

### 2. Typography
- Use sans-serif fonts for body text (Inter recommended)
- Scale: xs (badges) → sm (captions) → base (body) → lg (items) → xl+ (headings)
- Line height: tight (1.25) for headings, normal (1.5) for body text

### 3. Spacing
- Use 8px base unit for consistent spacing
- Card padding: 16px (comfortable), 20px (spacious)
- Grid gaps: 1.5rem (24px) for comfortable layouts

### 4. Animations
- Use `motion.div` with variants for declarative animations
- Stagger children animations for lists (0.08s delay)
- Use spring physics for natural interactions
- Respect `prefers-reduced-motion` for accessibility

### 5. Voice Interactions
- Provide clear visual feedback for voice states
- Use color coding: blue (listening), amber (thinking), green (speaking)
- Show transcripts for transparency
- Highlight mentioned items in visual feed

### 6. Accessibility
- Maintain WCAG AA compliance minimum
- Provide keyboard navigation for all interactions
- Use ARIA labels and live regions
- Support alternative input methods (voice, keyboard, touch)

### 7. Performance
- Use lazy loading for images (`lazyLoad: true`)
- Prefer `transform` and `opacity` for animations
- Cache themes at CDN edge (24 hours)
- Minimize animation complexity on low-end devices

---

## Validation

All themes are validated at runtime using Zod schemas:

```typescript
import { validateMultimodalRestaurantTheme } from '@/multimodal-restaurant';

const result = validateMultimodalRestaurantTheme(theme);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
  // errors: ["designTokens.colors.primary.500: Invalid hex color"]
}
```

**Common Validation Errors:**
- Invalid hex colors (must be #RGB or #RRGGBB)
- Missing required fields
- Invalid enum values
- Invalid number ranges (e.g., font weights 100-900)
- Invalid gradient directions
- Invalid layout types

---

## Extension Points

### Custom Primitives

Create custom component primitives:

```typescript
export function createCustomCard(options: CustomCardOptions): CustomCardComponent {
  return {
    id: 'custom-card',
    type: 'custom-card',
    // ... component configuration
  };
}
```

### Custom Layouts

Add custom layout variants:

```typescript
export const CustomVoiceLayout: VoiceAssistedLayoutConfig = {
  type: 'overlay',
  // ... custom layout configuration
};
```

### Custom Animation Variants

Define custom Framer Motion variants:

```typescript
export const customAnimations = {
  specialEntry: {
    initial: { opacity: 0, rotate: -180 },
    animate: { opacity: 1, rotate: 0 },
    exit: { opacity: 0, rotate: 180 }
  }
};
```

---

## Troubleshooting

### Theme Not Loading
- Check API endpoint: `/api/multimodal-restaurant/themes/:preset`
- Verify preset name matches available presets
- Check cache headers and CDN propagation

### Validation Errors
- Use `validateMultimodalRestaurantTheme()` to get detailed errors
- Check hex color format (#RGB or #RRGGBB)
- Verify all required fields are present
- Check enum values match allowed options

### Animation Issues
- Ensure Framer Motion is installed (`npm install framer-motion`)
- Check `AnimatePresence` wrapping for exit animations
- Verify variant names match defined variants
- Test with `prefers-reduced-motion` disabled

### Voice Orb Not Displaying
- Check voice orb position and size configuration
- Verify visualizer bars are rendering
- Check state colors are valid hex colors
- Ensure WebAudio API is available

---

## Related Documentation

- [Animation Guide](ANIMATION_GUIDE.md) - Complete animation reference
- [Theme Edge Worker](../index.ts) - Main worker integration
- [Neumorphic Types](../neumorphic/types.ts) - Base component types
- [Design Tokens](design-tokens.ts) - Color palettes and tokens
- [Zod Schemas](schema.ts) - Validation schemas

---

## Version History

### v1.0.0 (2025-12-03)
- Initial release
- Complete type system and validation
- Design tokens with food-optimized colors
- Component primitives (menu card, voice orb, cart island, category carousel)
- Layout configurations (landing, voice-assisted, standard browse)
- Animation templates with Framer Motion
- Coorg Food Company preset theme
- Generic restaurant preset theme
- API handlers for edge serving
- Comprehensive documentation

---

## License

Copyright © 2025 Stonepot Platform. All rights reserved.

---

## Support

For questions or issues:
- GitHub: https://github.com/stonepot-platform
- Email: support@stonepot.com
- Docs: https://docs.stonepot.com/multimodal-restaurant
