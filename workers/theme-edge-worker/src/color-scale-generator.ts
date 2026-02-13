/**
 * Color Scale Generator
 * Generates 11-shade color scales from a single base color
 */

import type { Color } from './figma-types';

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export class ColorScaleGenerator {
  /**
   * Generate 11-shade color scale from a base color
   * @param baseColor - Hex color string (e.g., "#3B82F6")
   * @param baseShade - Which shade the base color represents (default: 500)
   */
  generateScale(baseColor: string, baseShade: 500 | 600 = 500): ColorScale {
    const hsl = this.hexToHSL(baseColor);

    // Lightness values for each shade
    // These are calibrated to match Tailwind CSS color scales
    const lightnessMap: Record<number, number> = {
      50: 98,
      100: 95,
      200: 90,
      300: 82,
      400: 70,
      500: 55,
      600: 45,
      700: 35,
      800: 25,
      900: 15,
      950: 8,
    };

    // Adjust all lightness values based on the base shade
    const baseLightness = hsl.l;
    const targetBaseLightness = lightnessMap[baseShade];
    const lightnessDelta = baseLightness - targetBaseLightness;

    const scale: Partial<ColorScale> = {};

    for (const [shade, targetLightness] of Object.entries(lightnessMap)) {
      const adjustedLightness = Math.max(
        0,
        Math.min(100, targetLightness + lightnessDelta)
      );

      // Slightly adjust saturation for very light/dark shades
      let adjustedSaturation = hsl.s;
      if (adjustedLightness > 90) {
        // Reduce saturation for very light shades
        adjustedSaturation = hsl.s * 0.8;
      } else if (adjustedLightness < 15) {
        // Slightly reduce saturation for very dark shades
        adjustedSaturation = hsl.s * 0.9;
      }

      scale[shade as unknown as keyof ColorScale] = this.hslToHex({
        h: hsl.h,
        s: adjustedSaturation,
        l: adjustedLightness,
      });
    }

    return scale as ColorScale;
  }

  /**
   * Convert Figma Color (0-1 RGB) to hex
   */
  figmaColorToHex(color: Color): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return this.rgbToHex({ r, g, b });
  }

  /**
   * Convert RGB (0-255) to hex
   */
  private rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
  }

  /**
   * Convert hex to HSL
   */
  private hexToHSL(hex: string): HSL {
    const rgb = this.hexToRGB(hex);
    return this.rgbToHSL(rgb);
  }

  /**
   * Convert hex to RGB
   */
  private hexToRGB(hex: string): RGB {
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
   * Convert RGB to HSL
   */
  private rgbToHSL(rgb: RGB): HSL {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / delta + 2) / 6;
          break;
        case b:
          h = ((r - g) / delta + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  /**
   * Convert HSL to hex
   */
  private hslToHex(hsl: HSL): string {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return this.rgbToHex({
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    });
  }

  /**
   * Convert color scale to platform-specific format
   */
  toPlatformFormat(
    scale: ColorScale,
    platform: 'web' | 'shiptrack'
  ): Record<string, string> {
    if (platform === 'shiptrack') {
      // Convert to c50, c100, ... c950 format
      return Object.fromEntries(
        Object.entries(scale).map(([shade, color]) => [`c${shade}`, color])
      );
    }
    // Web uses numeric keys as-is - convert to record
    return {
      '50': scale[50],
      '100': scale[100],
      '200': scale[200],
      '300': scale[300],
      '400': scale[400],
      '500': scale[500],
      '600': scale[600],
      '700': scale[700],
      '800': scale[800],
      '900': scale[900],
      '950': scale[950],
    };
  }
}
