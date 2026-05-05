/**
 * Figma Token Extractor
 * Extracts design tokens (colors, typography, spacing, effects) from Figma files
 */

import type {
  FigmaFile,
  FigmaNode,
  FigmaStyle,
  ExtractedTokens,
  ExtractedColor,
  ExtractedTypography,
  ExtractedSpacing,
  ExtractedEffect,
  Color,
} from './figma-types';
import { FigmaClient } from './figma-client';
import { ColorScaleGenerator } from './color-scale-generator';

export class FigmaTokenExtractor {
  private figmaClient: FigmaClient;
  private scaleGenerator: ColorScaleGenerator;

  constructor(accessToken: string) {
    this.figmaClient = new FigmaClient(accessToken);
    this.scaleGenerator = new ColorScaleGenerator();
  }

  /**
   * Extract all design tokens from a Figma file
   */
  async extractTokens(fileKey: string): Promise<ExtractedTokens> {
    const file = await this.figmaClient.getFile(fileKey);
    const styles = await this.figmaClient.getFileStyles(fileKey);

    const colors = await this.extractColors(file, styles);
    const typography = await this.extractTypography(file, styles);
    const spacing = this.extractSpacing(file);
    const effects = this.extractEffects(file, styles);

    return {
      colors,
      typography,
      spacing,
      effects,
      metadata: {
        fileName: file.name,
        fileKey,
        lastModified: file.lastModified,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract color tokens and generate scales
   */
  private async extractColors(
    file: FigmaFile,
    styles: Record<string, FigmaStyle>
  ): Promise<ExtractedColor[]> {
    const colors: ExtractedColor[] = [];
    const processedColors = new Set<string>();

    // Extract from color styles
    for (const [styleId, style] of Object.entries(styles)) {
      if (style.styleType !== 'FILL') continue;

      // Find node with this style
      const node = this.findNodeWithStyle(file.document, styleId);
      if (!node || !node.fills || node.fills.length === 0) continue;

      const fill = node.fills[0];
      if (fill.type !== 'SOLID' || !fill.color) continue;

      const color = fill.color;
      const hex = this.scaleGenerator.figmaColorToHex(color);

      // Avoid duplicates
      if (processedColors.has(hex)) continue;
      processedColors.add(hex);

      // Parse style name for semantic meaning
      const { category, shade } = this.parseColorStyleName(style.name);

      // Generate 11-shade scale
      const scale = this.scaleGenerator.generateScale(hex, shade);

      colors.push({
        name: this.sanitizeName(style.name),
        originalValue: hex,
        category,
        scale: this.scaleGenerator.toPlatformFormat(scale, 'web'),
        figmaStyleId: styleId,
      });
    }

    // Also extract from prominent fill colors (even without styles)
    const prominentColors = this.extractProminentColors(file.document);
    for (const { name, color } of prominentColors) {
      const hex = this.scaleGenerator.figmaColorToHex(color);
      if (processedColors.has(hex)) continue;
      processedColors.add(hex);

      const scale = this.scaleGenerator.generateScale(hex, 500);
      colors.push({
        name: this.sanitizeName(name),
        originalValue: hex,
        category: 'custom',
        scale: this.scaleGenerator.toPlatformFormat(scale, 'web'),
      });
    }

    return colors;
  }

  /**
   * Extract typography tokens
   */
  private async extractTypography(
    file: FigmaFile,
    styles: Record<string, FigmaStyle>
  ): Promise<ExtractedTypography[]> {
    const typography: ExtractedTypography[] = [];

    // Extract from text styles
    for (const [styleId, style] of Object.entries(styles)) {
      if (style.styleType !== 'TEXT') continue;

      // Find node with this style
      const node = this.findNodeWithStyle(file.document, styleId);
      if (!node || node.type !== 'TEXT' || !node.style) continue;

      const textStyle = node.style;

      typography.push({
        name: this.sanitizeName(style.name),
        fontFamily: textStyle.fontFamily || 'sans-serif',
        fontSize: textStyle.fontSize || 16,
        fontWeight: this.mapFigmaFontWeight(textStyle.fontWeight || 400),
        lineHeight: textStyle.lineHeightPx
          ? `${textStyle.lineHeightPx}px`
          : textStyle.lineHeightPercent
          ? `${textStyle.lineHeightPercent}%`
          : '1.5',
        letterSpacing: textStyle.letterSpacing || 0,
        figmaStyleId: styleId,
      });
    }

    // Sort by font size to create a type scale
    typography.sort((a, b) => a.fontSize - b.fontSize);

    return typography;
  }

  /**
   * Extract spacing tokens from layout grids and component spacing
   */
  private extractSpacing(file: FigmaFile): ExtractedSpacing {
    const spacingValues = new Set<number>();

    // Traverse all nodes and collect spacing patterns
    this.traverseNode(file.document, (node) => {
      // Extract from layout grids
      if (node.layoutGrids) {
        for (const grid of node.layoutGrids) {
          if (grid.pattern === 'COLUMNS' || grid.pattern === 'ROWS') {
            spacingValues.add(grid.gutterSize || 0);
            spacingValues.add(grid.sectionSize || 0);
          }
        }
      }

      // Extract from auto layout
      if (node.itemSpacing !== undefined) {
        spacingValues.add(node.itemSpacing);
      }

      // Extract from padding
      if (node.paddingLeft) spacingValues.add(node.paddingLeft);
      if (node.paddingRight) spacingValues.add(node.paddingRight);
      if (node.paddingTop) spacingValues.add(node.paddingTop);
      if (node.paddingBottom) spacingValues.add(node.paddingBottom);
    });

    // Convert to sorted array and create spacing scale
    const values = Array.from(spacingValues)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    // Create spacing scale with common names
    const scale: Record<string, string> = {};
    const names = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];

    values.forEach((value, index) => {
      if (index < names.length) {
        scale[names[index]] = `${value}px`;
      } else {
        scale[`${index + 1}`] = `${value}px`;
      }
    });

    return { scale, values };
  }

  /**
   * Extract effect tokens (shadows, blurs)
   */
  private extractEffects(
    file: FigmaFile,
    styles: Record<string, FigmaStyle>
  ): ExtractedEffect[] {
    const effects: ExtractedEffect[] = [];

    // Extract from effect styles
    for (const [styleId, style] of Object.entries(styles)) {
      if (style.styleType !== 'EFFECT') continue;

      // Find node with this style
      const node = this.findNodeWithStyle(file.document, styleId);
      if (!node || !node.effects || node.effects.length === 0) continue;

      for (const effect of node.effects) {
        if (!effect.visible) continue;

        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
          const color = effect.color || { r: 0, g: 0, b: 0, a: 0.25 };
          const rgba = `rgba(${Math.round(color.r * 255)}, ${Math.round(
            color.g * 255
          )}, ${Math.round(color.b * 255)}, ${color.a || 1})`;

          effects.push({
            name: this.sanitizeName(style.name),
            type: effect.type === 'DROP_SHADOW' ? 'shadow' : 'inner-shadow',
            value: `${effect.offset?.x || 0}px ${effect.offset?.y || 0}px ${
              effect.radius || 0
            }px ${effect.spread || 0}px ${rgba}`,
            figmaStyleId: styleId,
          });
        } else if (effect.type === 'LAYER_BLUR') {
          effects.push({
            name: this.sanitizeName(style.name),
            type: 'blur',
            value: `blur(${effect.radius || 0}px)`,
            figmaStyleId: styleId,
          });
        }
      }
    }

    return effects;
  }

  /**
   * Find prominent fill colors from nodes (even without styles)
   */
  private extractProminentColors(
    node: FigmaNode,
    colors: Array<{ name: string; color: Color }> = []
  ): Array<{ name: string; color: Color }> {
    if (node.fills && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'SOLID' && fill.visible !== false && fill.color) {
          const name = node.name || 'unnamed';
          // Only include if it looks like a color swatch (common naming patterns)
          if (
            name.toLowerCase().includes('color') ||
            name.toLowerCase().includes('swatch') ||
            name.toLowerCase().includes('palette')
          ) {
            colors.push({ name, color: fill.color });
          }
        }
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractProminentColors(child, colors);
      }
    }

    return colors;
  }

  /**
   * Find a node that uses a specific style
   */
  private findNodeWithStyle(
    node: FigmaNode,
    styleId: string
  ): FigmaNode | null {
    // Check current node
    if (
      node.styles?.fill === styleId ||
      node.styles?.text === styleId ||
      node.styles?.effect === styleId
    ) {
      return node;
    }

    // Search children
    if (node.children) {
      for (const child of node.children) {
        const result = this.findNodeWithStyle(child, styleId);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Traverse all nodes in the tree
   */
  private traverseNode(node: FigmaNode, callback: (node: FigmaNode) => void) {
    callback(node);
    if (node.children) {
      for (const child of node.children) {
        this.traverseNode(child, callback);
      }
    }
  }

  /**
   * Parse color style name to extract category and shade
   * Examples: "Primary/500", "Colors/Success/600", "Accent"
   */
  private parseColorStyleName(name: string): {
    category: ExtractedColor['category'];
    shade: 500 | 600;
  } {
    const lowerName = name.toLowerCase();

    // Detect category
    let category: ExtractedColor['category'] = 'custom';
    if (lowerName.includes('primary')) category = 'primary';
    else if (lowerName.includes('secondary')) category = 'secondary';
    else if (lowerName.includes('accent')) category = 'accent';
    else if (lowerName.includes('success')) category = 'success';
    else if (lowerName.includes('error') || lowerName.includes('danger'))
      category = 'error';
    else if (lowerName.includes('warning')) category = 'warning';
    else if (lowerName.includes('info')) category = 'info';

    // Detect shade (default to 500)
    const shadeMatch = name.match(/(\d{3})/);
    const shade = shadeMatch && shadeMatch[1] === '600' ? 600 : 500;

    return { category, shade };
  }

  /**
   * Map Figma font weight to CSS font weight
   */
  private mapFigmaFontWeight(weight: number): number {
    // Figma uses numeric weights: 100, 200, 300, 400, 500, 600, 700, 800, 900
    // Map common named weights
    const weightMap: Record<number, number> = {
      100: 100, // Thin
      200: 200, // Extra Light
      300: 300, // Light
      400: 400, // Regular/Normal
      500: 500, // Medium
      600: 600, // Semi Bold
      700: 700, // Bold
      800: 800, // Extra Bold
      900: 900, // Black
    };
    return weightMap[weight] || 400;
  }

  /**
   * Sanitize name for use as identifier
   */
  private sanitizeName(name: string): string {
    return name
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/\//g, '-') // Replace slashes with hyphens
      .toLowerCase()
      .replace(/^-+|-+$/g, ''); // Trim hyphens
  }
}
