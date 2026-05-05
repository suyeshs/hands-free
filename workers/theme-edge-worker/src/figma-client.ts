/**
 * Figma API Client
 * Wrapper for Figma REST API calls
 */

import type { FigmaFile, FigmaStyle } from './figma-types';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

export class FigmaAPIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'FigmaAPIError';
  }
}

export class FigmaClient {
  private accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken || !accessToken.startsWith('figd_')) {
      throw new Error('Invalid Figma access token format');
    }
    this.accessToken = accessToken;
  }

  /**
   * Make authenticated request to Figma API
   */
  private async request<T>(endpoint: string): Promise<T> {
    const url = `${FIGMA_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': this.accessToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new FigmaAPIError(
        response.status,
        `Figma API Error (${response.status}): ${errorText}`
      );
    }

    return response.json<T>();
  }

  /**
   * Get file metadata and document tree
   */
  async getFile(fileKey: string): Promise<FigmaFile> {
    return this.request<FigmaFile>(`/files/${fileKey}`);
  }

  /**
   * Get all styles in a file
   */
  async getFileStyles(fileKey: string): Promise<Record<string, FigmaStyle>> {
    const response = await this.request<{ meta: { styles: FigmaStyle[] } }>(
      `/files/${fileKey}/styles`
    );

    // Convert array to keyed object
    const styles: Record<string, FigmaStyle> = {};
    if (response.meta?.styles) {
      for (const style of response.meta.styles) {
        styles[style.key] = style;
      }
    }

    return styles;
  }

  /**
   * Get style details by node ID
   */
  async getStyleNode(fileKey: string, nodeId: string): Promise<any> {
    return this.request(`/files/${fileKey}/nodes?ids=${nodeId}`);
  }

  /**
   * Validate file access
   */
  async validateFileAccess(fileKey: string): Promise<boolean> {
    try {
      await this.getFile(fileKey);
      return true;
    } catch (error) {
      if (error instanceof FigmaAPIError) {
        if (error.status === 403 || error.status === 404) {
          return false;
        }
      }
      throw error;
    }
  }
}

/**
 * Extract file key from Figma URL
 */
export function extractFileKeyFromURL(url: string): string | null {
  // Match: https://www.figma.com/file/ABC123/...
  // Or: https://figma.com/file/ABC123/...
  // Or: https://www.figma.com/design/ABC123/...
  const match = url.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[2] : null;
}

/**
 * Validate Figma file key format
 */
export function isValidFileKey(fileKey: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(fileKey) && fileKey.length > 10;
}
