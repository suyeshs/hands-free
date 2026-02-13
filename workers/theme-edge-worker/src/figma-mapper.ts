/**
 * Figma Token Mapper
 * Maps extracted Figma tokens to platform-specific theme formats
 */

import type {
  ExtractedTokens,
  ExtractedColor,
  ExtractedTypography,
  TokenMapping,
  MappingRule,
} from './figma-types';
import { ColorScaleGenerator } from './color-scale-generator';

// Import theme types
type WebColorScale = Record<string, string>;
type ShipTrackColorScale = Record<string, string>;

// Simplified theme types for mapper
interface WebTheme {
  meta: {
    id: string;
    name: string;
    description: string;
    author: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  version: string;
  platform: 'web';
  global: {
    colors: {
      primary: WebColorScale;
      secondary: WebColorScale;
      accent: WebColorScale;
      neutral: WebColorScale;
      success: WebColorScale;
      error: WebColorScale;
      warning: WebColorScale;
      info: WebColorScale;
    };
    typography: {
      fontFamily: {
        sans: string[];
        serif: string[];
        mono: string[];
      };
      fontSize: Record<string, string>;
      fontWeight: Record<string, number>;
      lineHeight: Record<string, string>;
    };
    spacing: Record<string, string>;
    borderRadius: Record<string, string>;
    shadows: Record<string, string>;
  };
  components: Record<string, any>;
}

interface ShipTrackTheme {
  meta: {
    name: string;
    description?: string;
    organizationId: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  };
  version: string;
  platform: 'shiptrack';
  signature?: string;
  colors: {
    primary: ShipTrackColorScale;
    success: ShipTrackColorScale;
    error: ShipTrackColorScale;
    warning: ShipTrackColorScale;
    info: ShipTrackColorScale;
  };
  typography: {
    fontFamily: {
      sans: string[];
      serif: string[];
      mono: string[];
      heading: string[];
    };
    typeScale: Record<string, number>;
  };
  icons: Record<string, any>;
  components: Record<string, any>;
}

export class FigmaTokenMapper {
  private scaleGenerator: ColorScaleGenerator;

  constructor() {
    this.scaleGenerator = new ColorScaleGenerator();
  }

  /**
   * Map extracted tokens to Web theme
   */
  mapToWebTheme(
    tokens: ExtractedTokens,
    mapping?: TokenMapping,
    baseMeta?: Partial<WebTheme['meta']>
  ): WebTheme {
    const colors = this.mapWebColors(tokens.colors, mapping?.colors);
    const typography = this.mapWebTypography(
      tokens.typography,
      mapping?.typography
    );
    const spacing = this.mapWebSpacing(tokens.spacing);

    const theme: WebTheme = {
      meta: {
        id: baseMeta?.id || crypto.randomUUID(),
        name: baseMeta?.name || tokens.metadata.fileName,
        description:
          baseMeta?.description ||
          `Imported from Figma: ${tokens.metadata.fileName}`,
        author: baseMeta?.author || 'Figma Import',
        tags: baseMeta?.tags || ['figma-import'],
        createdAt: baseMeta?.createdAt || tokens.metadata.extractedAt,
        updatedAt: baseMeta?.updatedAt || tokens.metadata.extractedAt,
      },
      version: '1.0.0',
      platform: 'web',
      global: {
        colors: {
          primary: colors.primary,
          secondary: colors.secondary,
          accent: colors.accent,
          neutral: colors.neutral,
          success: colors.success,
          error: colors.error,
          warning: colors.warning,
          info: colors.info,
        },
        typography: {
          fontFamily: {
            sans: typography.sans,
            serif: typography.serif,
            mono: typography.mono,
          },
          fontSize: typography.fontSize,
          fontWeight: typography.fontWeight,
          lineHeight: typography.lineHeight,
        },
        spacing: spacing.scale,
        borderRadius: {
          none: '0',
          sm: '0.25rem',
          md: '0.5rem',
          lg: '1rem',
          xl: '1.5rem',
          '2xl': '2rem',
          full: '9999px',
        },
        shadows: this.mapWebShadows(tokens.effects),
      },
      components: {},
    };

    return theme;
  }

  /**
   * Map extracted tokens to ShipTrack theme
   */
  mapToShipTrackTheme(
    tokens: ExtractedTokens,
    mapping?: TokenMapping,
    baseMeta?: Partial<ShipTrackTheme['meta']>
  ): ShipTrackTheme {
    const colors = this.mapShipTrackColors(tokens.colors, mapping?.colors);
    const typography = this.mapShipTrackTypography(
      tokens.typography,
      mapping?.typography
    );

    const theme: ShipTrackTheme = {
      meta: {
        name: baseMeta?.name || tokens.metadata.fileName,
        description:
          baseMeta?.description ||
          `Imported from Figma: ${tokens.metadata.fileName}`,
        organizationId: baseMeta?.organizationId || `figma-${tokens.metadata.fileName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        author: baseMeta?.author || 'Figma Import',
        createdAt: baseMeta?.createdAt || tokens.metadata.extractedAt,
        updatedAt: baseMeta?.updatedAt || tokens.metadata.extractedAt,
      },
      version: '1.0.0',
      platform: 'shiptrack',
      colors: {
        primary: colors.primary,
        success: colors.success,
        error: colors.error,
        warning: colors.warning,
        info: colors.info,
      },
      typography: {
        fontFamily: {
          sans: typography.sans,
          serif: typography.serif,
          mono: typography.mono,
          heading: typography.heading,
        },
        typeScale: typography.typeScale,
      },
      icons: {},
      components: {},
    };

    return theme;
  }

  /**
   * Map colors for Web platform
   */
  private mapWebColors(
    colors: ExtractedColor[],
    mappingRules?: MappingRule[]
  ): WebTheme['global']['colors'] {
    const colorMap: WebTheme['global']['colors'] = {
      primary: this.getDefaultWebColorScale(),
      secondary: this.getDefaultWebColorScale(),
      accent: this.getDefaultWebColorScale(),
      neutral: this.getDefaultWebColorScale(),
      success: this.getDefaultWebColorScale(),
      error: this.getDefaultWebColorScale(),
      warning: this.getDefaultWebColorScale(),
      info: this.getDefaultWebColorScale(),
    };

    // Apply extracted colors by category
    for (const color of colors) {
      if (color.category !== 'custom') {
        colorMap[color.category] = color.scale as WebColorScale;
      }
    }

    // Apply manual mapping rules
    if (mappingRules) {
      for (const rule of mappingRules) {
        const sourceColor = colors.find((c) => c.name === rule.source);
        if (sourceColor && rule.target in colorMap) {
          colorMap[rule.target as keyof WebTheme['global']['colors']] =
            sourceColor.scale as WebColorScale;
        }
      }
    }

    // Fill missing colors with fallbacks
    if (!this.hasValidScale(colorMap.neutral)) {
      colorMap.neutral = this.generateGrayScale();
    }

    return colorMap;
  }

  /**
   * Map colors for ShipTrack platform
   */
  private mapShipTrackColors(
    colors: ExtractedColor[],
    mappingRules?: MappingRule[]
  ): ShipTrackTheme['colors'] {
    const colorMap: ShipTrackTheme['colors'] = {
      primary: this.getDefaultShipTrackColorScale(),
      success: this.getDefaultShipTrackColorScale(),
      error: this.getDefaultShipTrackColorScale(),
      warning: this.getDefaultShipTrackColorScale(),
      info: this.getDefaultShipTrackColorScale(),
    };

    // Convert web scale to ShipTrack format (c50, c100, etc.)
    for (const color of colors) {
      if (
        color.category === 'primary' ||
        color.category === 'success' ||
        color.category === 'error' ||
        color.category === 'warning' ||
        color.category === 'info'
      ) {
        // Convert numeric keys to c-prefixed keys
        colorMap[color.category] = Object.fromEntries(
          Object.entries(color.scale).map(([shade, value]) => [`c${shade}`, value])
        ) as ShipTrackTheme['colors']['primary'];
      }
    }

    // Apply manual mapping rules
    if (mappingRules) {
      for (const rule of mappingRules) {
        const sourceColor = colors.find((c) => c.name === rule.source);
        if (sourceColor && rule.target in colorMap) {
          // Convert numeric keys to c-prefixed keys
          colorMap[rule.target as keyof ShipTrackTheme['colors']] =
            Object.fromEntries(
              Object.entries(sourceColor.scale).map(([shade, value]) => [`c${shade}`, value])
            ) as ShipTrackTheme['colors']['primary'];
        }
      }
    }

    return colorMap;
  }

  /**
   * Map typography for Web platform
   */
  private mapWebTypography(
    typography: ExtractedTypography[],
    mappingRules?: MappingRule[]
  ): {
    sans: string[];
    serif: string[];
    mono: string[];
    fontSize: WebTheme['global']['typography']['fontSize'];
    fontWeight: WebTheme['global']['typography']['fontWeight'];
    lineHeight: WebTheme['global']['typography']['lineHeight'];
  } {
    const fontFamilies = {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Georgia', 'serif'],
      mono: ['Menlo', 'monospace'],
    };

    const fontSize: WebTheme['global']['typography']['fontSize'] = {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
    };

    // Extract unique font families
    const uniqueFonts = new Set<string>();
    for (const typo of typography) {
      uniqueFonts.add(typo.fontFamily);
    }

    // Categorize fonts
    const fonts = Array.from(uniqueFonts);
    if (fonts.length > 0) {
      // First font as primary sans
      fontFamilies.sans = [fonts[0], 'system-ui', 'sans-serif'];
    }

    // Map font sizes from extracted typography (sorted by size)
    if (typography.length >= 6) {
      const sizeKeys = Object.keys(fontSize);
      typography.forEach((typo, index) => {
        if (index < sizeKeys.length) {
          fontSize[sizeKeys[index] as keyof typeof fontSize] = `${
            typo.fontSize / 16
          }rem`;
        }
      });
    }

    return {
      sans: fontFamilies.sans,
      serif: fontFamilies.serif,
      mono: fontFamilies.mono,
      fontSize,
      fontWeight: {
        thin: 100,
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
        black: 900,
      },
      lineHeight: {
        none: '1',
        tight: '1.25',
        snug: '1.375',
        normal: '1.5',
        relaxed: '1.625',
        loose: '2',
      },
    };
  }

  /**
   * Map typography for ShipTrack platform
   */
  private mapShipTrackTypography(
    typography: ExtractedTypography[],
    mappingRules?: MappingRule[]
  ): {
    sans: string[];
    serif: string[];
    mono: string[];
    heading: string[];
    typeScale: ShipTrackTheme['typography']['typeScale'];
  } {
    const fontFamilies = {
      sans: ['Roboto', 'system-ui', 'sans-serif'],
      serif: ['Georgia', 'serif'],
      mono: ['Roboto Mono', 'monospace'],
      heading: ['Roboto', 'system-ui', 'sans-serif'],
    };

    const typeScale: ShipTrackTheme['typography']['typeScale'] = {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
    };

    // Extract unique font families
    const uniqueFonts = new Set<string>();
    for (const typo of typography) {
      uniqueFonts.add(typo.fontFamily);
    }

    const fonts = Array.from(uniqueFonts);
    if (fonts.length > 0) {
      fontFamilies.sans = [fonts[0], 'system-ui', 'sans-serif'];
      fontFamilies.heading = [fonts[0], 'system-ui', 'sans-serif'];
    }

    // Map type scale from extracted typography
    if (typography.length >= 6) {
      const scaleKeys = Object.keys(typeScale);
      typography.forEach((typo, index) => {
        if (index < scaleKeys.length) {
          typeScale[scaleKeys[index] as keyof typeof typeScale] =
            typo.fontSize;
        }
      });
    }

    return {
      sans: fontFamilies.sans,
      serif: fontFamilies.serif,
      mono: fontFamilies.mono,
      heading: fontFamilies.heading,
      typeScale,
    };
  }

  /**
   * Map spacing for Web platform
   */
  private mapWebSpacing(spacing: { scale: Record<string, string> }): {
    scale: WebTheme['global']['spacing'];
  } {
    const defaultSpacing: WebTheme['global']['spacing'] = {
      0: '0',
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      8: '2rem',
      10: '2.5rem',
      12: '3rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
    };

    // Use extracted spacing if available
    if (Object.keys(spacing.scale).length > 0) {
      return { scale: spacing.scale as WebTheme['global']['spacing'] };
    }

    return { scale: defaultSpacing };
  }

  /**
   * Map effects to web shadows
   */
  private mapWebShadows(effects: ExtractedTokens['effects']): Record<
    string,
    string
  > {
    const shadows: Record<string, string> = {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    };

    // Add extracted shadows
    for (const effect of effects) {
      if (effect.type === 'shadow') {
        shadows[effect.name] = effect.value;
      }
    }

    return shadows;
  }

  /**
   * Generate a default gray scale
   */
  private generateGrayScale(): WebColorScale {
    const scale = this.scaleGenerator.generateScale('#6B7280', 500);
    return this.scaleGenerator.toPlatformFormat(scale, 'web') as WebColorScale;
  }

  /**
   * Get default web color scale
   */
  private getDefaultWebColorScale(): WebColorScale {
    const scale = this.scaleGenerator.generateScale('#3B82F6', 500);
    return this.scaleGenerator.toPlatformFormat(scale, 'web') as WebColorScale;
  }

  /**
   * Get default ShipTrack color scale
   */
  private getDefaultShipTrackColorScale(): ShipTrackColorScale {
    const webScale = this.getDefaultWebColorScale();
    // Convert numeric keys to c-prefixed keys
    return Object.fromEntries(
      Object.entries(webScale).map(([shade, value]) => [`c${shade}`, value])
    ) as ShipTrackColorScale;
  }

  /**
   * Check if a color scale has valid values
   */
  private hasValidScale(scale: any): boolean {
    return scale && scale[500] && scale[500] !== '#000000';
  }

  /**
   * Create an auto-mapping suggestion based on color names
   */
  suggestMapping(tokens: ExtractedTokens): TokenMapping {
    const colorMappings: MappingRule[] = [];

    // Auto-suggest color mappings based on naming
    for (const color of tokens.colors) {
      if (color.category !== 'custom') {
        colorMappings.push({
          source: color.name,
          target: color.category,
        });
      }
    }

    return {
      colors: colorMappings,
      typography: [],
    };
  }
}
