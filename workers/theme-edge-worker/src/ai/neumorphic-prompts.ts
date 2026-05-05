/**
 * AI Prompt Templates for Neumorphic Component Generation
 * Guides Grok to generate multimodal neumorphic components following LDSG principles
 */

import type {
  ComponentGenerationRequest,
  LibraryGenerationRequest,
  LayoutGenerationRequest,
} from '../neumorphic/types';

/**
 * System prompt for neumorphic component generation with design tokens
 */
export const NEUMORPHIC_SYSTEM_PROMPT = `You are an expert UI/UX designer specializing in neumorphic (soft UI) design and multimodal interaction patterns following LDSG (LINE Design System Guidelines) principles.

Your expertise includes:
- Neumorphic design: Soft shadows, tactile depth, extruded and inset surfaces
- Multimodal interaction: Touch, voice, gesture, and keyboard input
- Accessibility: WCAG 2.1 AA/AAA compliance, contrast ratios, semantic labels
- Color theory: HSL manipulation, shadow generation, accessible palettes
- Component architecture: State machines, transitions, animations
- Design tokens: Systematic spacing, typography, border radius
- Responsive design: Pixel-perfect rendering across all device sizes

CRITICAL: Use ONLY the design tokens specified below for pixel-perfect consistency:

=== COLOR SYSTEM ===
Light Mode:
- bgSurface: #F0F0F3 (main background surface)
- bgRaised: #F5F5F8 (raised/elevated surface)
- bgPressed: #E8E8EB (pressed/inset surface)
- shadowLight: #FFFFFF (light outer shadow)
- shadowDark: #CBD2E0 (dark inner shadow)
- shadowSoft: #B6B9C5 (softer dark shadow for subtle depth)
- textPrimary: #1A1A1A (primary text, AA contrast)
- accentPrimary: #2563EB (primary blue accent)

Dark Mode:
- bgSurface: #14141C (main background surface)
- bgRaised: #1C1C28 (raised/elevated surface)
- bgPressed: #0F0F16 (pressed/inset surface)
- shadowLight: #252530 (light outer shadow, subtle in dark)
- shadowDark: #08080C (dark inner shadow)
- textPrimary: #FFFFFF (primary text)
- accentPrimary: #3B82F6 (primary blue accent)

=== SPACING SCALE (8px increments) ===
ONLY use these values: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128

=== BORDER RADIUS SYSTEM ===
- Small elements (badges, tags): 8px
- Medium elements (inputs, small buttons): 12px
- Large elements (cards, large buttons): 16px - 24px for containers
- FAB (Floating Action Buttons): 32px minimum (32-40px)
- Pills/Chips: 9999px (fully rounded)
- Circles: 50%

=== TYPOGRAPHY ===
- Font Family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif
- Base Size: 16px
- Headings: Use large, legible sizes (24px, 30px, 36px, 48px)
- Headings: Less contrast, add subtle drop-shadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
- Paragraphs: Line height 1.5-1.75 (ample spacing)
- Active elements: Add slight elevation

=== ELEVATION & SHADOWS ===
**Dual Shadow System** (animate between on interaction):
- Outset (Raised): Light shadow top-left, dark shadow bottom-right
- Inset (Pressed): Reverse the shadow directions
- Transition: 150ms ease-out for hover, 100ms ease-in for press, 200ms spring for release

Shadow Formula:
- Light: offset (-depth, -depth), blur (depth * 2), spread (depth * 0.5), color (#FFFFFF for light mode)
- Dark: offset (depth, depth), blur (depth * 2), spread (depth * 0.5), color (#CBD2E0 for light mode)

=== RESPONSIVE BREAKPOINTS (for all device sizes) ===
- xs: 320px (small phones)
- sm: 375px (standard phones like iPhone 12/13/14)
- md: 428px (large phones like iPhone 14 Pro Max)
- tablet: 768px (iPad Mini)
- tabletLg: 1024px (iPad Pro)
- laptop: 1280px (small laptops)
- desktop: 1440px (standard desktop)
- desktopLg: 1920px (large desktop)
- desktopXl: 2560px (4K displays)

=== TOUCH TARGETS ===
- Minimum: 44x44px (Apple HIG requirement)
- Comfortable: 48x48px (Android Material)
- Large: 56x56px
- FAB: 56x56px minimum

=== ANIMATION TIMINGS ===
- Hover: 150ms cubic-bezier(0, 0, 0.2, 1)
- Press: 100ms cubic-bezier(0.4, 0, 1, 1)
- Release: 200ms cubic-bezier(0.34, 1.56, 0.64, 1) (spring effect)

Neumorphic Design Principles:
1. **Soft Shadows**: ALWAYS use dual shadows (light highlight + dark depth) for 3D effect
2. **Subtle Depth**: Depth levels 1-10, where 5 is medium, affects shadow intensity
3. **Tactile Feedback**: Raised (outset shadows) for default, inset shadows for pressed state
4. **Smooth Surfaces**: Use EXACT border radius from tokens (16-24px containers, 32px+ FABs)
5. **Low Contrast**: Use EXACT colors from tokens, 8% lighter/darker for shadows
6. **Pixel-Perfect**: ALL spacing MUST be multiples of 8px, ALL colors from token system

Multimodal Interaction Patterns:
1. **Touch**: Primary modality, minimum 44x44px touch targets, haptic feedback
2. **Voice**: Alternative input, clear trigger phrases, audio/visual confirmation
3. **Gesture**: Swipe, pinch, camera-based, direction-aware
4. **Keyboard**: Navigation and shortcuts, tab-indexing

LDSG Principles:
- Clarity over decoration
- Consistent spacing (8px grid system - STRICT)
- Readable typography (16px base, 1.5+ line-height)
- Semantic color usage (from token system ONLY)
- Responsive and adaptive (use breakpoints)

Output Format:
Generate valid JSON matching the NeumorphicComponent schema with:
- Complete state definitions (default, hover, active, pressed, focused, disabled)
- Proper shadow configurations (light source, depth, inset/outset)
- EXACT token values for spacing, colors, border radius
- Responsive dimensions for all breakpoints
- Multimodal interaction specifications
- Accessibility labels and ARIA roles
- Platform-specific optimizations`;


/**
 * Generate component creation prompt
 */
export function generateComponentPrompt(request: ComponentGenerationRequest): string {
  const {
    prompt,
    type,
    platform,
    style = {},
    modalities = ['touch', 'voice'],
    accessibility = 'wcag-aa',
  } = request;

  const platformContext =
    platform === 'web'
      ? 'This is a web component. Use standard border-radius and consider mouse hover states.'
      : platform === 'mobile'
      ? 'This is a mobile component. Ensure touch targets are 44x44px minimum. Include haptic feedback.'
      : 'This component works on both web and mobile. Provide adaptive sizing and interactions.';

  const styleGuidance = `
Style Preferences:
${style.depth ? `- Depth Level: ${style.depth}/10` : '- Depth: Medium (5/10)'}
${style.lightSource ? `- Light Source: ${style.lightSource}` : '- Light Source: top-left'}
${style.primaryColor ? `- Primary Color: ${style.primaryColor}` : '- Primary Color: Use neutral gray (#E0E5EC)'}
${style.textColor ? `- Text Color: ${style.textColor}` : '- Text Color: Auto-contrast'}
`;

  const modalityGuidance = `
Interaction Modalities:
${modalities.map((m) => `- ${m.charAt(0).toUpperCase() + m.slice(1)}: ${getModalityGuidance(m)}`).join('\n')}
`;

  const componentSchema = JSON.stringify(COMPONENT_SCHEMA_EXAMPLE, null, 2);

  return `${platformContext}

User Request:
"${prompt}"

${type ? `Component Type Hint: ${type}` : ''}

${styleGuidance}

${modalityGuidance}

Accessibility Target: ${accessibility.toUpperCase()}

Generate a complete NeumorphicComponent matching this schema:

${componentSchema}

Requirements:
1. Generate ALL component states with proper neumorphic styling
2. Calculate dual shadows (light + dark) for depth effect
3. Ensure pressed state uses inset shadows
4. Include smooth state transitions (150-200ms)
5. Provide multimodal interaction configurations
6. Meet ${accessibility.toUpperCase()} contrast requirements (${accessibility === 'wcag-aa' ? '4.5:1' : '7:1'})
7. Include descriptive ARIA labels
8. Add voice command triggers if voice modality enabled
9. Specify haptic feedback for touch interactions
10. ${platform === 'mobile' ? 'Ensure 44x44px minimum touch targets' : 'Include hover state'}

Return ONLY valid JSON, no markdown code blocks.`;
}

/**
 * Generate library creation prompt
 */
export function generateLibraryPrompt(request: LibraryGenerationRequest): string {
  const {
    prompt,
    brand,
    platform,
    componentCount = 8,
    componentTypes,
    style = {},
  } = request;

  const brandContext = brand ? `
Brand Information:
- Name: ${brand.name}
- Industry: ${brand.industry}
${brand.values ? `- Values: ${brand.values.join(', ')}` : ''}
${brand.targetAudience ? `- Target Audience: ${brand.targetAudience}` : ''}
` : '';

  const componentsGuidance = componentTypes
    ? `Include these component types: ${componentTypes.join(', ')}`
    : `Generate ${componentCount} essential components (button, input, card, FAB, navigation, modal, toggle, list)`;

  return `You are creating a complete neumorphic component library for a ${platform} application.

${brandContext}

User Request:
"${prompt}"

${componentsGuidance}

Style Configuration:
- Color Scheme: ${style.colorScheme || 'auto (light/dark adaptive)'}
- Depth Level: ${style.depth || 5}/10
- Light Source: ${style.lightSource || 'top-left'}

Generate a ComponentLibrary with:
1. ${componentCount}+ neumorphic components
2. Consistent design tokens (colors, spacing, typography, shadows)
3. Each component with full state definitions
4. Multimodal interactions across all components
5. WCAG AA compliant color combinations (minimum 4.5:1 contrast ratio)
6. Platform-optimized (${platform})

CRITICAL REQUIREMENTS:
- ALL states (including disabled) MUST have text color with 4.5:1 minimum contrast ratio
- For disabled states: Use textColor #666666 or darker on light backgrounds (#F0F0F3)
- EVERY state MUST have complete shadow structure with BOTH light and dark shadows
- Shadow structure format: { light: {...7 required fields}, dark: {...7 required fields} }
- Never omit shadow fields or use simplified shadow arrays

Example valid shadow structure:
{
  "light": {
    "lightSource": "top-left",
    "depth": 4,
    "inset": false,
    "color": "#FFFFFF",
    "blurRadius": 8,
    "spreadRadius": 2,
    "opacity": 0.9
  },
  "dark": {
    "lightSource": "top-left",
    "depth": 4,
    "inset": false,
    "color": "#CBD2E0",
    "blurRadius": 8,
    "spreadRadius": 2,
    "opacity": 0.4
  }
}

Return JSON matching ComponentLibrary schema.`;
}

/**
 * Generate layout creation prompt
 */
export function generateLayoutPrompt(request: LayoutGenerationRequest): string {
  const {
    prompt,
    platform,
    viewport = { width: platform === 'mobile' ? 375 : 1440, height: platform === 'mobile' ? 812 : 900 },
    sections = [],
    libraryId,
  } = request;

  return `Create a complete screen layout for ${platform}.

User Request:
"${prompt}"

Viewport: ${viewport.width}x${viewport.height}${platform === 'mobile' ? ' (mobile portrait)' : ' (desktop)'}

Required Sections: ${sections.length > 0 ? sections.join(', ') : 'header, content, footer, navigation (as needed)'}

${libraryId ? `Use components from library: ${libraryId}` : 'Create necessary components inline'}

IMPORTANT: Return JSON in THIS EXACT format (wrapped in {layout, reasoning}):

{
  "layout": {
    "id": "dashboard-layout",
    "name": "Dashboard Layout",
    "description": "Main dashboard with header, sidebar, and content area",
    "platform": "${platform}",
    "viewport": {
      "width": ${viewport.width},
      "height": ${viewport.height},
      "orientation": "${platform === 'mobile' ? 'portrait' : 'landscape'}"
    },
    "structure": {
      "header": { ...full NeumorphicComponent with all required fields... },
      "content": [
        { ...full NeumorphicComponent... },
        { ...full NeumorphicComponent... }
      ],
      "footer": { ...full NeumorphicComponent (optional)... },
      "navigation": { ...full NeumorphicComponent (optional)... },
      "fab": { ...full NeumorphicComponent (optional)... }
    },
    "meta": {
      "createdAt": "${new Date().toISOString()}",
      "updatedAt": "${new Date().toISOString()}"
    }
  },
  "reasoning": "Explanation of layout decisions"
}

CRITICAL: Each component in structure MUST be a complete NeumorphicComponent with:
- id, name, type, description, category
- dimensions, padding, margin, typography
- states (with surface.shadows.light and surface.shadows.dark for EACH state)
- transitions, defaultState, interaction, interactive
- accessibility (label, role, focusable, minContrast)
- platform, frameworks, createdAt, updatedAt, version, tags

Return ONLY valid JSON with {layout: {...}, reasoning: "..."} structure.`;
}

/**
 * Get modality-specific guidance
 */
function getModalityGuidance(modality: string): string {
  switch (modality) {
    case 'touch':
      return 'Minimum 44x44px targets, haptic feedback on press, clear pressed state';
    case 'voice':
      return 'Clear trigger phrases, audio confirmation, visual indicator during listening';
    case 'gesture':
      return 'Swipe, pinch, or camera-based gestures with visual feedback';
    case 'keyboard':
      return 'Tab navigation, keyboard shortcuts, focus states';
    default:
      return 'Standard interaction pattern';
  }
}

/**
 * Example component schema for prompt
 */
const COMPONENT_SCHEMA_EXAMPLE = {
  id: 'unique-uuid',
  name: 'Component Name',
  type: 'button | input | card | modal | etc.',
  description: 'Clear description',
  category: 'action | input | content | feedback | navigation | layout',
  dimensions: { width: 'auto', height: 48, minWidth: 88 },
  padding: { top: 12, right: 24, bottom: 12, left: 24 },
  margin: { top: 8, right: 8, bottom: 8, left: 8 },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  icon: { name: 'icon-name', size: 20, position: 'left', spacing: 8 },
  states: {
    default: {
      surface: {
        backgroundColor: '#E0E5EC',
        borderRadius: 24,
        shadows: {
          light: {
            lightSource: 'top-left',
            depth: 5,
            inset: false,
            color: '#FFFFFF',
            blurRadius: 10,
            spreadRadius: 2.5,
            opacity: 0.6,
          },
          dark: {
            lightSource: 'top-left',
            depth: 5,
            inset: false,
            color: '#000000',
            blurRadius: 10,
            spreadRadius: 2.5,
            opacity: 0.5,
          },
        },
      },
      textColor: '#2D3748',
      iconColor: '#2D3748',
      opacity: 1,
      scale: 1,
    },
    // ... other states (hover, active, pressed, focused, disabled, loading, error, success)
  },
  transitions: [
    {
      from: 'default',
      to: 'hover',
      animation: { duration: 150, easing: 'ease-out' },
    },
  ],
  defaultState: 'default',
  interaction: {
    primary: 'touch',
    alternatives: ['voice', 'keyboard'],
    touch: { minTouchSize: { width: 88, height: 48 }, haptic: 'medium' },
    voice: [
      {
        triggers: ['click', 'press', 'button'],
        feedback: 'Button activated',
        visualIndicator: true,
      },
    ],
    keyboard: [{ key: 'Enter', modifiers: [] }],
  },
  interactive: true,
  accessibility: {
    label: 'Action Button',
    role: 'button',
    focusable: true,
    tabIndex: 0,
    minContrast: 4.5,
  },
  platform: 'both',
  frameworks: ['react', 'react-native', 'flutter'],
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
  version: '1.0.0',
  tags: ['button', 'action', 'neumorphic'],
};
