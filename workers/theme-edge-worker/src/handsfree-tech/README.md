# Handsfree Tech Theme

Modern, tech-oriented UI theme with voice and gesture controls, inspired by Music Zajno's sophisticated animation patterns.

## 🎨 Overview

Handsfree Tech is a dark-first design system built for modern SaaS products, AI tools, and developer platforms. It features glassmorphism effects, holographic gradients, and multimodal interaction patterns including voice, gestures, and keyboard shortcuts.

## ✨ Key Features

- **Voice Control** - Wake word activation ("Hey Tech") with bilingual support (EN/HI)
- **Gesture Support** - 5 gesture types (swipe, pinch-zoom, tap, long-press)
- **Glassmorphism** - Translucent backgrounds with blur effects
- **Holographic Gradients** - Animated color transitions
- **Scroll Animations** - Music Zajno inspired reveal effects
- **Code/Terminal Displays** - Syntax-highlighted code blocks
- **Dark-First Design** - Optimized for dark themes
- **WCAG AA Accessible** - 4.5:1 contrast ratios, keyboard navigation
- **GPU Accelerated** - Smooth 60fps animations

## 🎨 Design Tokens

### Colors

```typescript
// Primary
Cyber Blue: #0066ff
Neon Purple: #8000ff
Tech Green: #00ff80

// Backgrounds
Dark: #0d0d0d
Darker: #000000
Light: #212529

// Text
Primary: #f8f9fa
Secondary: #dee2e6
Tertiary: #6c757d
```

### Gradients

```typescript
// Holographic
linear-gradient(135deg, #0066ff, #8000ff, #00ff80)

// Glass
rgba(255, 255, 255, 0.1) → rgba(255, 255, 255, 0.05)
```

### Easing Functions

```typescript
// Music Zajno Inspired
Standard: cubic-bezier(0.4, 0, 0.2, 1)
Back Out: cubic-bezier(0.68, -0.55, 0.265, 1.55)
Smooth: cubic-bezier(0.45, 0, 0.55, 1)
```

## 🧩 Components

### 1. Product Card
Showcase tech products with glassmorphism and glow effects.

```typescript
import { renderProductCard, createProductCard } from '@handsfree-tech';

const config = createProductCard({
  showImage: true,
  gradientType: 'holographic',
  hoverEffect: 'glow',
  borderStyle: 'gradient',
});
```

### 2. Voice Orb
Animated voice activation UI with waveform visualization.

```typescript
import { renderVoiceOrb, createVoiceOrb } from '@handsfree-tech';

const config = createVoiceOrb({
  size: 'lg',
  position: 'bottom-center',
  showWaveform: true,
  waveformBars: 16,
  glowIntensity: 'medium',
});
```

### 3. Code Block
Syntax-highlighted code display with copy functionality.

```typescript
import { renderCodeBlock, createCodeBlock } from '@handsfree-tech';

const config = createCodeBlock({
  language: 'typescript',
  theme: 'dark',
  showLineNumbers: true,
  showCopyButton: true,
});
```

## 🎬 Animations

### Scroll-Based Animations

Based on Music Zajno patterns:

```css
/* Product Card Reveal */
.product-card {
  opacity: 0;
  transform: translateY(100px) scale(0.8);
  transition: opacity 800ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

.product-card.in-view {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Stagger Effect */
.product-card:nth-child(1) { transition-delay: 0ms; }
.product-card:nth-child(2) { transition-delay: 100ms; }
.product-card:nth-child(3) { transition-delay: 200ms; }
```

### Voice Orb Animation

```css
@keyframes glowPulse {
  0%, 100% {
    box-shadow: 0 0 40px #0066ff, 0 0 80px #0066ff;
  }
  50% {
    box-shadow: 0 0 60px #0066ff, 0 0 120px #0066ff;
  }
}

.voice-orb.active {
  animation: glowPulse 2s ease-in-out infinite;
}
```

### Parallax Layers

```css
.parallax-layer-1 { transform: translateY(calc(var(--scroll) * 0.3)); }
.parallax-layer-2 { transform: translateY(calc(var(--scroll) * 0.5)); }
.parallax-layer-3 { transform: translateY(calc(var(--scroll) * 1)); }
```

## 🎯 Interaction Patterns

### Voice Commands

```typescript
const voiceCommands = [
  { phrase: 'go home', action: 'navigate_home' },
  { phrase: 'search for', action: 'open_search' },
  { phrase: 'scroll down', action: 'scroll_down' },
  { phrase: 'scroll up', action: 'scroll_up' },
];
```

**Wake Word**: "Hey Tech"
**Languages**: English, Hindi
**Feedback**: Visual + Audio

### Gesture Support

- **Swipe Left/Right** - Navigation
- **Swipe Up/Down** - Scroll
- **Pinch Zoom** - Zoom in/out
- **Two-Finger Tap** - Secondary action
- **Long Press** - Context menu

### Keyboard Shortcuts

- `⌘K` - Open search
- `⌘V` - Toggle voice control
- `⌘D` - Open documentation
- `⌘T` - Toggle dark mode

## 📐 Layouts

### 1. Landing Layout
```typescript
{
  type: 'scroll',
  hero: {
    type: 'gradient',
    height: 'viewport',
    showParticles: true,
    particleCount: 50,
    textAnimation: 'typewriter',
  },
  scrollEffect: 'parallax',
}
```

### 2. Product Showcase
```typescript
{
  type: 'grid',
  filterBar: {
    show: true,
    filters: ['All', 'SaaS', 'AI Tools', 'APIs'],
  },
  defaultView: 'grid',
}
```

### 3. Documentation
```typescript
{
  sidebar: {
    position: 'left',
    width: '280px',
    collapsible: true,
  },
  search: {
    show: true,
    shortcut: '⌘K',
  },
}
```

### 4. Voice Control
```typescript
{
  orbPosition: 'bottom-center',
  showTranscript: true,
  showCommands: true,
  feedbackStyle: 'detailed',
}
```

## ♿ Accessibility

- **WCAG Level**: AA
- **Contrast Ratios**: 4.5:1 (normal), 3:1 (large)
- **Keyboard Navigation**: Full support
- **Screen Reader**: Optimized ARIA labels
- **Reduced Motion**: Respects user preferences
- **Focus Indicators**: Visible and clear
- **Touch Targets**: Minimum 44px

## 🚀 Usage Example

```typescript
import {
  HandsfreeDefaultTheme,
  renderProductCard,
  renderVoiceOrb,
  renderCodeBlock,
} from '@handsfree-tech';

// Create product card
const product: TechProduct = {
  id: 'prod-001',
  name: 'AI Code Assistant',
  description: 'Your intelligent coding companion',
  category: 'AI Tools',
  tags: ['AI', 'Developer Tools'],
  status: 'beta',
};

const cardHtml = renderProductCard(product, HandsfreeDefaultTheme.components.productCard);

// Create voice orb
const orbHtml = renderVoiceOrb(HandsfreeDefaultTheme.components.voiceOrb, true);

// Create code block
const snippet: CodeSnippet = {
  id: 'snippet-001',
  language: 'typescript',
  code: 'const greeting = "Hello, World!";',
};

const codeHtml = renderCodeBlock(snippet, HandsfreeDefaultTheme.components.codeBlock);
```

## 🎨 Design Inspiration

This theme is inspired by:

- **Music Zajno** - Scroll-driven animations, sophisticated easing
- **Linear** - Minimalist design, dark-first aesthetic
- **Stripe** - Gradient effects, glassmorphism
- **Vercel** - Developer-focused UX, code displays

## 📊 Performance

- **GPU Accelerated**: All animations use `transform` and `opacity`
- **Will-Change**: Applied to animating elements
- **Intersection Observer**: Lazy-load scroll animations
- **Reduced Motion**: Respects `prefers-reduced-motion`
- **Bundle Size**: Optimized for tree-shaking

## 📝 License

MIT License

## 🤝 Contributing

Contributions welcome! Please follow the design system guidelines.

---

**Version**: 1.0.0
**Author**: Stonepot Platform
**Platforms**: Web, Mobile, PWA
**Frameworks**: React, Vanilla JS
