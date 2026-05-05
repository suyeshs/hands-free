/**
 * Neumorphic Style Generator
 * Handles shadow calculations, color blending, and CSS generation
 * for neumorphic components
 */

import type {
  NeumorphicShadow,
  NeumorphicShadows,
  NeumorphicSurface,
  LightSource,
  StateStyle,
  ComponentState,
} from './types';

/**
 * Color utilities for neumorphic effects
 */
export class ColorUtils {
  /**
   * Convert hex to RGB
   */
  static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  /**
   * Convert RGB to hex
   */
  static rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => {
      const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /**
   * Lighten a color by percentage
   */
  static lighten(hex: string, percent: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    const amount = (255 * percent) / 100;
    return this.rgbToHex(r + amount, g + amount, b + amount);
  }

  /**
   * Darken a color by percentage
   */
  static darken(hex: string, percent: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    const amount = (255 * percent) / 100;
    return this.rgbToHex(r - amount, g - amount, b - amount);
  }

  /**
   * Calculate luminance for contrast checking
   */
  static getLuminance(hex: string): number {
    const { r, g, b } = this.hexToRgb(hex);
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Check if color combination meets WCAG contrast requirements
   */
  static meetsWCAG(background: string, text: string, level: 'AA' | 'AAA' = 'AA'): boolean {
    const ratio = this.getContrastRatio(background, text);
    return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
  }

  /**
   * Find best contrasting text color (black or white)
   */
  static getBestTextColor(background: string): string {
    const whiteContrast = this.getContrastRatio(background, '#FFFFFF');
    const blackContrast = this.getContrastRatio(background, '#000000');
    return whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
  }

  /**
   * Blend two colors
   */
  static blendColors(color1: string, color2: string, weight: number = 0.5): string {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    return this.rgbToHex(
      rgb1.r * (1 - weight) + rgb2.r * weight,
      rgb1.g * (1 - weight) + rgb2.g * weight,
      rgb1.b * (1 - weight) + rgb2.b * weight
    );
  }
}

/**
 * Shadow generation for neumorphic effects
 */
export class ShadowGenerator {
  /**
   * Generate dual shadows based on light source and depth
   */
  static generateNeumorphicShadows(
    baseColor: string,
    depth: number = 5,
    lightSource: LightSource = 'top-left',
    inset: boolean = false
  ): NeumorphicShadows {
    // Depth affects shadow intensity and blur
    const shadowIntensity = Math.min(10, Math.max(1, depth));
    const blurMultiplier = shadowIntensity * 2;
    const spreadMultiplier = shadowIntensity * 0.5;

    // Calculate light and dark colors based on base
    const lightColor = ColorUtils.lighten(baseColor, 8);
    const darkColor = ColorUtils.darken(baseColor, 8);

    // Determine offset based on light source
    const offsets = this.getLightSourceOffsets(lightSource, shadowIntensity);

    const lightShadow: NeumorphicShadow = {
      lightSource,
      depth,
      inset,
      color: lightColor,
      blurRadius: blurMultiplier * 2,
      spreadRadius: inset ? 0 : spreadMultiplier,
      opacity: 0.6,
    };

    const darkShadow: NeumorphicShadow = {
      lightSource,
      depth,
      inset,
      color: darkColor,
      blurRadius: blurMultiplier * 2,
      spreadRadius: inset ? 0 : spreadMultiplier,
      opacity: 0.5,
    };

    return {
      light: lightShadow,
      dark: darkShadow,
    };
  }

  /**
   * Get shadow offsets based on light source
   */
  static getLightSourceOffsets(
    lightSource: LightSource,
    depth: number
  ): { light: { x: number; y: number }; dark: { x: number; y: number } } {
    const offset = depth;

    switch (lightSource) {
      case 'top-left':
        return {
          light: { x: -offset, y: -offset },
          dark: { x: offset, y: offset },
        };
      case 'top-right':
        return {
          light: { x: offset, y: -offset },
          dark: { x: -offset, y: offset },
        };
      case 'bottom-left':
        return {
          light: { x: -offset, y: offset },
          dark: { x: offset, y: -offset },
        };
      case 'bottom-right':
        return {
          light: { x: offset, y: offset },
          dark: { x: -offset, y: -offset },
        };
    }
  }

  /**
   * Convert shadow configuration to CSS box-shadow string
   */
  static toCSS(shadows: NeumorphicShadows, state: 'default' | 'pressed' = 'default'): string {
    const offsets = this.getLightSourceOffsets(shadows.light.lightSource, shadows.light.depth);
    const inset = state === 'pressed' ? 'inset ' : '';

    const lightShadow = `${inset}${offsets.light.x}px ${offsets.light.y}px ${shadows.light.blurRadius}px ${shadows.light.spreadRadius}px rgba(255, 255, 255, ${shadows.light.opacity})`;
    const darkShadow = `${inset}${offsets.dark.x}px ${offsets.dark.y}px ${shadows.dark.blurRadius}px ${shadows.dark.spreadRadius}px rgba(0, 0, 0, ${shadows.dark.opacity})`;

    return `${lightShadow}, ${darkShadow}`;
  }

  /**
   * Generate pressed (inset) variant
   */
  static toPressedState(shadows: NeumorphicShadows): NeumorphicShadows {
    return {
      light: { ...shadows.light, inset: true },
      dark: { ...shadows.dark, inset: true },
    };
  }

  /**
   * Generate more elevated variant
   */
  static toElevated(shadows: NeumorphicShadows, elevationIncrease: number = 2): NeumorphicShadows {
    return {
      light: {
        ...shadows.light,
        depth: shadows.light.depth + elevationIncrease,
        blurRadius: shadows.light.blurRadius * 1.5,
        spreadRadius: shadows.light.spreadRadius * 1.2,
      },
      dark: {
        ...shadows.dark,
        depth: shadows.dark.depth + elevationIncrease,
        blurRadius: shadows.dark.blurRadius * 1.5,
        spreadRadius: shadows.dark.spreadRadius * 1.2,
      },
    };
  }
}

/**
 * Complete neumorphic style generator
 */
export class NeumorphicStyleGenerator {
  /**
   * Generate complete neumorphic surface
   */
  static generateSurface(
    backgroundColor: string,
    depth: number = 5,
    lightSource: LightSource = 'top-left',
    borderRadius: number = 16,
    inset: boolean = false
  ): NeumorphicSurface {
    const shadows = ShadowGenerator.generateNeumorphicShadows(
      backgroundColor,
      depth,
      lightSource,
      inset
    );

    return {
      backgroundColor,
      borderRadius,
      shadows,
      border: {
        width: 0,
        color: 'transparent',
        style: 'solid',
      },
    };
  }

  /**
   * Generate pressed state surface
   */
  static generatePressedSurface(surface: NeumorphicSurface): NeumorphicSurface {
    return {
      ...surface,
      shadows: ShadowGenerator.toPressedState(surface.shadows),
      backgroundColor: ColorUtils.darken(surface.backgroundColor, 2),
    };
  }

  /**
   * Generate hover state surface
   */
  static generateHoverSurface(surface: NeumorphicSurface): NeumorphicSurface {
    return {
      ...surface,
      shadows: ShadowGenerator.toElevated(surface.shadows, 1),
      backgroundColor: ColorUtils.lighten(surface.backgroundColor, 1),
    };
  }

  /**
   * Generate disabled state surface
   */
  static generateDisabledSurface(surface: NeumorphicSurface): NeumorphicSurface {
    return {
      ...surface,
      backgroundColor: ColorUtils.blendColors(surface.backgroundColor, '#CCCCCC', 0.3),
      shadows: {
        light: { ...surface.shadows.light, opacity: 0.3 },
        dark: { ...surface.shadows.dark, opacity: 0.3 },
      },
    };
  }

  /**
   * Generate all component states
   */
  static generateAllStates(
    baseBackgroundColor: string,
    depth: number = 5,
    lightSource: LightSource = 'top-left',
    borderRadius: number = 16
  ): Record<ComponentState, StateStyle> {
    const defaultSurface = this.generateSurface(baseBackgroundColor, depth, lightSource, borderRadius);
    const textColor = ColorUtils.getBestTextColor(baseBackgroundColor);

    return {
      default: {
        surface: defaultSurface,
        textColor,
        iconColor: textColor,
        opacity: 1,
        scale: 1,
      },
      hover: {
        surface: this.generateHoverSurface(defaultSurface),
        textColor,
        iconColor: textColor,
        opacity: 1,
        scale: 1.02,
      },
      active: {
        surface: this.generatePressedSurface(defaultSurface),
        textColor,
        iconColor: textColor,
        opacity: 1,
        scale: 0.98,
      },
      pressed: {
        surface: this.generatePressedSurface(defaultSurface),
        textColor: ColorUtils.darken(textColor, 10),
        iconColor: ColorUtils.darken(textColor, 10),
        opacity: 1,
        scale: 0.95,
      },
      focused: {
        surface: {
          ...defaultSurface,
          border: {
            width: 2,
            color: ColorUtils.lighten(baseBackgroundColor, 20),
            style: 'solid',
          },
        },
        textColor,
        iconColor: textColor,
        opacity: 1,
        scale: 1,
      },
      disabled: {
        surface: this.generateDisabledSurface(defaultSurface),
        textColor: ColorUtils.blendColors(textColor, '#AAAAAA', 0.5),
        iconColor: ColorUtils.blendColors(textColor, '#AAAAAA', 0.5),
        opacity: 0.6,
        scale: 1,
      },
      loading: {
        surface: defaultSurface,
        textColor: ColorUtils.blendColors(textColor, baseBackgroundColor, 0.3),
        iconColor: ColorUtils.blendColors(textColor, baseBackgroundColor, 0.3),
        opacity: 0.8,
        scale: 1,
      },
      error: {
        surface: {
          ...defaultSurface,
          backgroundColor: ColorUtils.blendColors(baseBackgroundColor, '#EF4444', 0.1),
        },
        textColor: '#DC2626',
        iconColor: '#DC2626',
        opacity: 1,
        scale: 1,
      },
      success: {
        surface: {
          ...defaultSurface,
          backgroundColor: ColorUtils.blendColors(baseBackgroundColor, '#10B981', 0.1),
        },
        textColor: '#059669',
        iconColor: '#059669',
        opacity: 1,
        scale: 1,
      },
    };
  }

  /**
   * Convert surface to CSS object
   */
  static surfaceToCSS(surface: NeumorphicSurface, pressed: boolean = false): Record<string, string> {
    const borderRadius = typeof surface.borderRadius === 'number'
      ? `${surface.borderRadius}px`
      : `${surface.borderRadius.topLeft}px ${surface.borderRadius.topRight}px ${surface.borderRadius.bottomRight}px ${surface.borderRadius.bottomLeft}px`;

    const css: Record<string, string> = {
      backgroundColor: surface.backgroundColor,
      borderRadius,
      boxShadow: ShadowGenerator.toCSS(surface.shadows, pressed ? 'pressed' : 'default'),
    };

    if (surface.border && surface.border.width > 0) {
      css.border = `${surface.border.width}px ${surface.border.style} ${surface.border.color}`;
    }

    if (surface.gradient) {
      if (surface.gradient.type === 'linear') {
        css.backgroundImage = `linear-gradient(${surface.gradient.angle || 0}deg, ${surface.gradient.from}, ${surface.gradient.to})`;
      } else {
        css.backgroundImage = `radial-gradient(${surface.gradient.from}, ${surface.gradient.to})`;
      }
    }

    return css;
  }

  /**
   * Convert state style to complete CSS
   */
  static stateToCSS(state: StateStyle, pressed: boolean = false): Record<string, string> {
    const surfaceCSS = this.surfaceToCSS(state.surface, pressed);

    return {
      ...surfaceCSS,
      color: state.textColor,
      opacity: state.opacity?.toString() || '1',
      transform: `scale(${state.scale || 1}) translate(${state.translate?.x || 0}px, ${state.translate?.y || 0}px) rotate(${state.rotate || 0}deg)`,
      ...(state.custom || {}),
    };
  }

  /**
   * Generate animation CSS
   */
  static generateAnimationCSS(from: ComponentState, to: ComponentState, fromStyle: StateStyle, toStyle: StateStyle, duration: number = 200): string {
    const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

    return `
      transition:
        background-color ${duration}ms ${easing},
        box-shadow ${duration}ms ${easing},
        color ${duration}ms ${easing},
        opacity ${duration}ms ${easing},
        transform ${duration}ms ${easing},
        border ${duration}ms ${easing};
    `;
  }

  /**
   * Validate accessibility of colors
   */
  static validateAccessibility(backgroundColor: string, textColor: string, targetLevel: 'AA' | 'AAA' = 'AA'): {
    passes: boolean;
    ratio: number;
    recommendation?: string;
  } {
    const ratio = ColorUtils.getContrastRatio(backgroundColor, textColor);
    const passes = ColorUtils.meetsWCAG(backgroundColor, textColor, targetLevel);

    if (!passes) {
      const bestColor = ColorUtils.getBestTextColor(backgroundColor);
      return {
        passes: false,
        ratio,
        recommendation: `Use ${bestColor} for better contrast (current: ${ratio.toFixed(2)}:1, required: ${targetLevel === 'AA' ? '4.5' : '7'}:1)`,
      };
    }

    return { passes: true, ratio };
  }
}
