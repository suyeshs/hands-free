/**
 * Figma API Types
 * Type definitions for Figma REST API responses
 */

export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
  components: Record<string, FigmaComponent>;
  styles: Record<string, FigmaStyle>;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: Paint[];
  strokes?: Paint[];
  effects?: Effect[];
  layoutGrids?: LayoutGrid[];
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  style?: TypeStyle;
  styles?: {
    fill?: string;
    text?: string;
    effect?: string;
    grid?: string;
  };
}

export interface Paint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color: Color;
  opacity?: number;
  visible?: boolean;
}

export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible: boolean;
  radius: number;
  color?: Color;
  offset?: { x: number; y: number };
  spread?: number;
}

export interface LayoutGrid {
  pattern: 'COLUMNS' | 'ROWS' | 'GRID';
  sectionSize: number;
  visible: boolean;
  color: Color;
  alignment: string;
  gutterSize: number;
  offset: number;
  count: number;
}

export interface TypeStyle {
  fontFamily: string;
  fontPostScriptName: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal: string;
  textAlignVertical: string;
  letterSpacing: number;
  lineHeightPx: number;
  lineHeightPercent: number;
}

export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  remote: boolean;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
}

// Extracted Token Types
export interface ExtractedTokens {
  colors: ExtractedColor[];
  typography: ExtractedTypography[];
  spacing: ExtractedSpacing;
  effects: ExtractedEffect[];
  metadata: {
    fileName: string;
    fileKey: string;
    lastModified: string;
    extractedAt: string;
  };
}

export interface ExtractedColor {
  name: string;
  originalValue: string;
  category: 'primary' | 'secondary' | 'accent' | 'success' | 'error' | 'warning' | 'info' | 'custom';
  scale: Record<string, string>;  // 50-950 shades
  figmaStyleId?: string;
}

export interface ExtractedTypography {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: string;
  letterSpacing: number;
  figmaStyleId?: string;
}

export interface ExtractedSpacing {
  scale: Record<string, string>;
  values: number[];
}

export interface ExtractedEffect {
  name: string;
  type: 'shadow' | 'blur' | 'inner-shadow';
  value: string;
  figmaStyleId?: string;
}

// Token Mapping Types
export interface MappingRule {
  source: string;  // Figma style name
  target: string;  // Theme property name
}

export interface TokenMapping {
  colors?: MappingRule[];
  typography?: MappingRule[];
}

// API Request/Response Types
export interface FigmaExtractRequest {
  fileKey?: string;
  fileUrl?: string;
  accessToken: string;
  useCache?: boolean;
}

export interface FigmaValidateRequest {
  accessToken: string;
}

export interface FigmaImportRequest {
  fileKey?: string;
  fileUrl?: string;
  accessToken: string;
  platform: 'web' | 'shiptrack';
  mapping?: TokenMapping;
  baseMeta?: {
    id?: string;
    name?: string;
    description?: string;
    author?: string;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface FigmaExtractResponse {
  success: boolean;
  data?: ExtractedTokens;
  error?: string;
}

export interface FigmaValidateResponse {
  valid: boolean;
  accessible: boolean;
  info?: {
    name: string;
    hasColorStyles: boolean;
    hasTextStyles: boolean;
    colorCount: number;
    textStyleCount: number;
  };
  error?: string;
}
