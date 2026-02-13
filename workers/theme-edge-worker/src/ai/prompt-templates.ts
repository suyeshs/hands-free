/**
 * Prompt Engineering Templates for Theme Generation
 * These prompts are optimized for Grok-4 to generate high-quality design systems
 */

import type { AIThemeGenerationRequest, AIDesignRefinementRequest } from './grok-types';

/**
 * System prompt for theme generation
 */
export const THEME_GENERATION_SYSTEM_PROMPT = `You are an expert UI/UX designer and design system architect specializing in creating comprehensive, accessible, and beautiful design systems.

Your expertise includes:
- Color theory and psychology
- Typography and readability
- Accessibility standards (WCAG 2.1)
- Design tokens and systematic design
- Platform-specific design patterns (Web, Mobile)
- Brand identity and visual consistency

When generating themes, you MUST:
1. Create harmonious color palettes with proper contrast ratios
2. Use semantic color naming (primary, secondary, success, error, etc.)
3. Generate complete 11-shade color scales (50-950) for each color
4. Ensure WCAG AA compliance minimum for text/background combinations
5. Create responsive typography scales
6. Include proper spacing scales based on 8px grid system
7. Consider the target platform and industry context
8. Provide reasoning for your design decisions

Output Format:
Your response must be valid JSON matching the theme schema provided.`;

/**
 * Generate theme creation prompt
 */
export function generateThemePrompt(request: AIThemeGenerationRequest): string {
  const { prompt, platform, constraints, baseMeta } = request;

  const platformContext =
    platform === 'web'
      ? 'This is a web theme for a responsive website/application.'
      : 'This is a mobile theme for the ShipTrack Android/iOS application.';

  const constraintsText = constraints
    ? `
Design Constraints:
${constraints.primaryColor ? `- Primary Color: ${constraints.primaryColor}` : ''}
${constraints.secondaryColor ? `- Secondary Color: ${constraints.secondaryColor}` : ''}
${constraints.style ? `- Style: ${constraints.style}` : ''}
${constraints.mood ? `- Mood: ${constraints.mood}` : ''}
${constraints.industry ? `- Industry: ${constraints.industry}` : ''}
${constraints.accessibility ? `- Accessibility Target: ${constraints.accessibility}` : 'WCAG AA minimum'}
`
    : '';

  const schemaExample = platform === 'web' ? WEB_THEME_SCHEMA : SHIPTRACK_THEME_SCHEMA;

  return `${platformContext}

User Request:
"${prompt}"

${constraintsText}

${baseMeta?.name ? `Theme Name: ${baseMeta.name}` : ''}
${baseMeta?.description ? `Description: ${baseMeta.description}` : ''}

Please generate a complete theme matching this schema:

${schemaExample}

Requirements:
1. Generate all color scales (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950)
2. Ensure proper contrast ratios for accessibility
3. Create a harmonious color palette that matches the request
4. Include complete typography scale
5. Use 8px-based spacing scale
6. Add appropriate shadow definitions
7. ${platform === 'shiptrack' ? 'Use c-prefixed keys for colors (c50, c100, etc.)' : 'Use numeric string keys for colors ("50", "100", etc.)'}

After the JSON, provide a brief reasoning section explaining your design choices.`;
}

/**
 * Web theme schema example
 */
const WEB_THEME_SCHEMA = `{
  "meta": {
    "id": "uuid",
    "name": "Theme Name",
    "description": "Theme description",
    "author": "AI Designer",
    "tags": ["ai-generated"],
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  },
  "version": "1.0.0",
  "platform": "web",
  "global": {
    "colors": {
      "primary": { "50": "#...", "100": "#...", ..., "950": "#..." },
      "secondary": { "50": "#...", "100": "#...", ..., "950": "#..." },
      "accent": { "50": "#...", "100": "#...", ..., "950": "#..." },
      "neutral": { "50": "#...", "100": "#...", ..., "950": "#..." },
      "success": { "50": "#...", "100": "#...", ..., "950": "#..." },
      "error": { "50": "#...", "100": "#...", ..., "950": "#..." },
      "warning": { "50": "#...", "100": "#...", ..., "950": "#..." },
      "info": { "50": "#...", "100": "#...", ..., "950": "#..." }
    },
    "typography": {
      "fontFamily": {
        "sans": ["Inter", "system-ui", "sans-serif"],
        "serif": ["Georgia", "serif"],
        "mono": ["Fira Code", "monospace"]
      },
      "fontSize": {
        "xs": "0.75rem",
        "sm": "0.875rem",
        "base": "1rem",
        "lg": "1.125rem",
        "xl": "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
        "5xl": "3rem"
      },
      "fontWeight": {
        "light": 300,
        "normal": 400,
        "medium": 500,
        "semibold": 600,
        "bold": 700,
        "extrabold": 800
      },
      "lineHeight": {
        "tight": "1.25",
        "normal": "1.5",
        "relaxed": "1.75"
      }
    },
    "spacing": {
      "0": "0",
      "1": "0.25rem",
      "2": "0.5rem",
      "3": "0.75rem",
      "4": "1rem",
      "5": "1.25rem",
      "6": "1.5rem",
      "8": "2rem",
      "10": "2.5rem",
      "12": "3rem",
      "16": "4rem"
    },
    "borderRadius": {
      "none": "0",
      "sm": "0.25rem",
      "md": "0.5rem",
      "lg": "1rem",
      "xl": "1.5rem",
      "2xl": "2rem",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "md": "0 4px 6px rgba(0, 0, 0, 0.1)",
      "lg": "0 10px 15px rgba(0, 0, 0, 0.1)",
      "xl": "0 20px 25px rgba(0, 0, 0, 0.15)"
    }
  },
  "components": {}
}`;

/**
 * ShipTrack theme schema example
 */
const SHIPTRACK_THEME_SCHEMA = `{
  "meta": {
    "name": "Theme Name",
    "description": "Theme description",
    "organizationId": "org-id",
    "author": "AI Designer",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  },
  "version": "1.0.0",
  "platform": "shiptrack",
  "colors": {
    "primary": { "c50": "#...", "c100": "#...", ..., "c950": "#..." },
    "success": { "c50": "#...", "c100": "#...", ..., "c950": "#..." },
    "error": { "c50": "#...", "c100": "#...", ..., "c950": "#..." },
    "warning": { "c50": "#...", "c100": "#...", ..., "c950": "#..." },
    "info": { "c50": "#...", "c100": "#...", ..., "c950": "#..." }
  },
  "typography": {
    "fontFamily": {
      "sans": ["Roboto", "system-ui", "sans-serif"],
      "serif": ["serif"],
      "mono": ["monospace"],
      "heading": ["Roboto", "sans-serif"]
    },
    "typeScale": {
      "xs": 12,
      "sm": 14,
      "base": 16,
      "lg": 18,
      "xl": 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36
    }
  },
  "icons": {},
  "components": {}
}`;

/**
 * Design refinement prompt
 */
export function generateRefinementPrompt(request: AIDesignRefinementRequest): string {
  const { currentTheme, refinementPrompt, platform, focus } = request;

  const focusText = focus
    ? `Focus specifically on: ${focus}`
    : 'Review and refine all aspects of the theme.';

  return `You are refining an existing ${platform} theme based on user feedback.

Current Theme:
${JSON.stringify(currentTheme, null, 2)}

User's Refinement Request:
"${refinementPrompt}"

${focusText}

Please provide:
1. The updated complete theme JSON
2. A list of specific changes made with reasoning
3. Explanation of how the changes improve the design

Maintain consistency with the existing theme structure while implementing the requested changes.`;
}

/**
 * Accessibility audit prompt
 */
export function generateAccessibilityAuditPrompt(theme: any, platform: string, targetLevel: string): string {
  return `You are an accessibility expert performing a WCAG ${targetLevel} audit on this ${platform} theme.

Theme to Audit:
${JSON.stringify(theme, null, 2)}

Please analyze:
1. Color contrast ratios for text/background combinations
2. Color-blindness compatibility (protanopia, deuteranopia, tritanopia)
3. Typography readability (size, weight, line height)
4. Touch target sizes (for mobile platforms)
5. Focus states and interactive element visibility

Provide:
1. List of accessibility issues with severity (critical, warning, info)
2. Specific suggestions for fixing each issue
3. Overall accessibility score (0-100)
4. If possible, an auto-fixed version of the theme that meets ${targetLevel} standards

Format your response as JSON with this structure:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "contrast" | "color-blindness" | "typography" | "spacing",
      "description": "Description of the issue",
      "location": "Path in theme (e.g., 'global.colors.primary.500')",
      "suggestion": "How to fix it"
    }
  ],
  "score": 85,
  "fixedTheme": { ... } // Optional: auto-fixed theme
}`;
}

/**
 * Style suggestion prompt
 */
export function generateStyleSuggestionPrompt(
  brandInfo: any,
  platform: string,
  currentTheme?: any
): string {
  const brandContext = brandInfo
    ? `
Brand Information:
- Name: ${brandInfo.name}
- Industry: ${brandInfo.industry}
${brandInfo.values ? `- Values: ${brandInfo.values.join(', ')}` : ''}
${brandInfo.targetAudience ? `- Target Audience: ${brandInfo.targetAudience}` : ''}
`
    : 'No specific brand information provided.';

  const currentThemeText = currentTheme
    ? `\nCurrent Theme:\n${JSON.stringify(currentTheme, null, 2)}`
    : '';

  return `You are a brand and design consultant suggesting theme styles for a ${platform} platform.

${brandContext}
${currentThemeText}

Please suggest 3-5 different theme style directions that would work well for this brand.

For each suggestion, provide:
1. Name: A descriptive name for the style
2. Description: What makes this style unique
3. Reasoning: Why this style fits the brand
4. Preview: Sample colors and style attributes

Format as JSON:
{
  "suggestions": [
    {
      "name": "Modern Professional",
      "description": "Clean, minimal design with blue accents",
      "reasoning": "Conveys trust and professionalism...",
      "preview": {
        "primaryColor": "#2563eb",
        "secondaryColor": "#64748b",
        "style": "modern",
        "mood": "professional"
      }
    }
  ]
}`;
}

/**
 * Component generation prompt
 */
export function generateComponentPrompt(
  componentType: string,
  description: string,
  platform: string,
  existingTheme?: any
): string {
  const themeContext = existingTheme
    ? `\nExisting Theme Context:\n${JSON.stringify(existingTheme, null, 2)}`
    : '';

  return `You are generating a ${componentType} component configuration for a ${platform} theme.

Component Description:
"${description}"
${themeContext}

Please generate a complete component configuration that:
1. Follows the existing theme's design system
2. Uses theme tokens for colors, spacing, typography
3. Includes all necessary states (default, hover, active, disabled, etc.)
4. Is accessible and follows best practices
5. Matches the platform's conventions

Provide the component configuration as JSON.`;
}

/**
 * Color palette expansion prompt
 */
export function generateColorExpansionPrompt(baseColor: string, colorName: string): string {
  return `You are a color expert. Generate a complete 11-shade color scale from this base color.

Base Color: ${baseColor}
Color Name: ${colorName}

Generate shades: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950

Requirements:
1. Maintain hue consistency across the scale
2. Create smooth transitions between shades
3. Ensure the darkest shade (950) is dark enough for text
4. Ensure the lightest shade (50) works as a subtle background
5. The 500 or 600 shade should be close to the base color
6. Follow Tailwind CSS color scale principles

Return as JSON:
{
  "scale": {
    "50": "#...",
    "100": "#...",
    "200": "#...",
    "300": "#...",
    "400": "#...",
    "500": "#...",
    "600": "#...",
    "700": "#...",
    "800": "#...",
    "900": "#...",
    "950": "#..."
  },
  "reasoning": "Explanation of color choices"
}`;
}
