/**
 * Zod schema for theme validation at edge
 */

import { z } from 'zod';

// Color scale schema
const ColorScaleSchema = z.object({
  50: z.string().regex(/^#[0-9A-F]{6}$/i),
  100: z.string().regex(/^#[0-9A-F]{6}$/i),
  200: z.string().regex(/^#[0-9A-F]{6}$/i),
  300: z.string().regex(/^#[0-9A-F]{6}$/i),
  400: z.string().regex(/^#[0-9A-F]{6}$/i),
  500: z.string().regex(/^#[0-9A-F]{6}$/i),
  600: z.string().regex(/^#[0-9A-F]{6}$/i),
  700: z.string().regex(/^#[0-9A-F]{6}$/i),
  800: z.string().regex(/^#[0-9A-F]{6}$/i),
  900: z.string().regex(/^#[0-9A-F]{6}$/i),
  950: z.string().regex(/^#[0-9A-F]{6}$/i),
});

// Global theme schema
const GlobalThemeSchema = z.object({
  colors: z.object({
    primary: ColorScaleSchema,
    secondary: ColorScaleSchema.optional(),
    accent: ColorScaleSchema.optional(),
    background: z.object({
      main: z.string(),
      gradient: z.object({
        from: z.string(),
        to: z.string(),
        direction: z.enum(['to-b', 'to-t', 'to-r', 'to-l', 'to-br', 'to-bl', 'to-tr', 'to-tl']),
      }).optional(),
    }),
  }),
  typography: z.object({
    fontFamily: z.object({
      sans: z.array(z.string()),
      serif: z.array(z.string()).optional(),
      mono: z.array(z.string()).optional(),
      heading: z.array(z.string()).optional(),
    }),
    scale: z.record(z.string()),
  }),
  spacing: z.object({
    scale: z.number().min(1).max(16),
    unit: z.enum(['px', 'rem']),
  }),
  borderRadius: z.record(z.string()),
  shadows: z.record(z.string()),
});

// Component schemas
const AvatarGridLayoutSchema = z.object({
  columns: z.object({
    mobile: z.number().min(1).max(4),
    tablet: z.number().min(2).max(6),
    desktop: z.number().min(3).max(8),
    largeDesktop: z.number().min(4).max(12),
  }),
  gap: z.string(),
  aspectRatio: z.string(),
});

const AvatarDetailLayoutSchema = z.object({
  style: z.enum(['stacked', 'split', 'overlay', 'minimal']),
  maxWidth: z.string(),
  imageAspectRatio: z.string(),
});

// Complete theme schema
export const ThemeJSONSchema = z.object({
  version: z.string(),
  meta: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    author: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  global: GlobalThemeSchema,
  components: z.object({
    avatarGrid: z.object({
      layout: AvatarGridLayoutSchema,
      card: z.record(z.any()),
      header: z.record(z.any()),
    }).optional(),
    avatarDetail: z.object({
      layout: AvatarDetailLayoutSchema,
      button: z.record(z.any()),
    }).optional(),
  }),
  customCSS: z.string().max(10000).optional(),
  animations: z.object({
    duration: z.record(z.string()),
    easing: z.string(),
  }).optional(),
  signature: z.string().optional(),
});

export type ThemeJSON = z.infer<typeof ThemeJSONSchema>;

/**
 * Validate theme JSON
 */
export function validateTheme(themeJSON: unknown): {
  valid: boolean;
  data?: ThemeJSON;
  errors?: string[];
} {
  try {
    const validated = ThemeJSONSchema.parse(themeJSON);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

