/**
 * Logo Color Extraction Service
 * Uses node-vibrant to extract prominent colors from restaurant logos
 * Generates brand-matched themes automatically
 */

import * as Vibrant from 'node-vibrant';
import type { Palette } from 'node-vibrant/lib/color';

export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  palette: string[];
}

export interface ColorSwatch {
  color: string;
  population: number;
  name: string;
}

/**
 * Extract colors from an image URL or file
 */
export async function extractColorsFromImage(
  imageSource: string | Buffer
): Promise<ExtractedColors> {
  try {
    // Extract palette using node-vibrant
    const palette = await Vibrant.from(imageSource).getPalette();

    // Get all color swatches
    const swatches = getSwatchesFromPalette(palette);

    // Determine the best colors for theme
    const primary = swatches.vibrant || swatches.darkVibrant || swatches[0].color;
    const secondary = swatches.muted || swatches.lightMuted || swatches[1].color;
    const accent = swatches.vibrant || swatches.darkVibrant || primary;
    const background = swatches.lightVibrant || swatches.lightMuted || '#ffffff';
    const text = swatches.darkMuted || swatches.darkVibrant || '#1a1d23';

    // Get full color palette (all extracted colors)
    const allColors = swatches.map(s => s.color);

    return {
      primary,
      secondary,
      accent,
      background,
      text,
      palette: allColors,
    };
  } catch (error) {
    console.error('[LogoColorExtractor] Error extracting colors:', error);
    throw new Error('Failed to extract colors from image');
  }
}

/**
 * Extract colors from logo URL
 */
export async function extractColorsFromLogoUrl(logoUrl: string): Promise<ExtractedColors> {
  return extractColorsFromImage(logoUrl);
}

/**
 * Extract colors from uploaded logo file
 */
export async function extractColorsFromFile(file: File): Promise<ExtractedColors> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const imageData = e.target?.result as string;
        const colors = await extractColorsFromImage(imageData);
        resolve(colors);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get color swatches from Vibrant palette
 */
function getSwatchesFromPalette(palette: Palette): ColorSwatch[] {
  const swatches: ColorSwatch[] = [];

  // Extract all available swatches
  if (palette.Vibrant) {
    swatches.push({
      color: palette.Vibrant.hex,
      population: palette.Vibrant.population,
      name: 'vibrant',
    });
  }

  if (palette.DarkVibrant) {
    swatches.push({
      color: palette.DarkVibrant.hex,
      population: palette.DarkVibrant.population,
      name: 'darkVibrant',
    });
  }

  if (palette.LightVibrant) {
    swatches.push({
      color: palette.LightVibrant.hex,
      population: palette.LightVibrant.population,
      name: 'lightVibrant',
    });
  }

  if (palette.Muted) {
    swatches.push({
      color: palette.Muted.hex,
      population: palette.Muted.population,
      name: 'muted',
    });
  }

  if (palette.DarkMuted) {
    swatches.push({
      color: palette.DarkMuted.hex,
      population: palette.DarkMuted.population,
      name: 'darkMuted',
    });
  }

  if (palette.LightMuted) {
    swatches.push({
      color: palette.LightMuted.hex,
      population: palette.LightMuted.population,
      name: 'lightMuted',
    });
  }

  // Sort by population (most prominent first)
  swatches.sort((a, b) => b.population - a.population);

  return swatches;
}

/**
 * Analyze image and suggest theme category based on colors
 */
export async function suggestThemeCategory(
  imageSource: string | Buffer
): Promise<'modern' | 'dark' | 'bright' | 'colorful' | 'classic'> {
  const colors = await extractColorsFromImage(imageSource);

  // Analyze color characteristics
  const palette = await Vibrant.from(imageSource).getPalette();

  // Count vibrant vs muted colors
  const vibrantColors = [
    palette.Vibrant,
    palette.DarkVibrant,
    palette.LightVibrant,
  ].filter(Boolean);

  const mutedColors = [
    palette.Muted,
    palette.DarkMuted,
    palette.LightMuted,
  ].filter(Boolean);

  // Determine category based on color characteristics
  if (vibrantColors.length >= 2) {
    return 'colorful';
  } else if (palette.DarkVibrant || palette.DarkMuted) {
    return 'dark';
  } else if (palette.LightVibrant) {
    return 'bright';
  } else if (mutedColors.length >= 2) {
    return 'classic';
  }

  return 'modern';
}
