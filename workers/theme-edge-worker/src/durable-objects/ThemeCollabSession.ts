/**
 * Theme Collaboration Session
 * Real-time theme synchronization using @stonepot/realtime-collab
 */

import { CollabSession } from '@stonepot/realtime-collab/server';

/**
 * Theme data structure
 */
export interface Theme {
  id?: string;
  name?: string;
  colors?: Record<string, string>;
  typography?: Record<string, any>;
  spacing?: Record<string, string>;
  shadows?: Record<string, string>;
  borderRadius?: Record<string, string>;
  [key: string]: any;
}

/**
 * Default theme
 */
const defaultTheme: Theme = {
  id: 'default',
  name: 'Default Theme',
  colors: {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    accent: '#10B981',
    background: '#FFFFFF',
    text: '#1F2937',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: {
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
};

/**
 * Theme Collaboration Session Durable Object
 *
 * Extends the generic CollabSession with theme-specific logic
 */
export class ThemeCollabSession extends CollabSession<Theme> {
  /**
   * Get initial theme data
   * Loads from Durable Object storage
   */
  async getInitialData(): Promise<Theme> {
    // Try to load from storage
    let theme = await this.state.storage.get<Theme>('theme');

    // If no theme exists, create default
    if (!theme) {
      theme = defaultTheme;
      await this.state.storage.put('theme', theme);
    }

    return theme;
  }

  /**
   * Handle theme updates
   * Merges changes and persists to storage
   */
  async onUpdate(changes: Partial<Theme>, userId: string): Promise<Theme> {
    // Get current theme
    const currentTheme = await this.getInitialData();

    // Deep merge changes (handles nested objects like colors, typography, etc.)
    const updatedTheme = this.deepMerge(currentTheme, changes);

    // Persist to storage
    await this.state.storage.put('theme', updatedTheme);

    // Optional: Save version history
    await this.saveVersion(changes, userId);

    console.log(`[ThemeCollabSession] Theme updated by ${userId}`);

    return updatedTheme;
  }

  /**
   * Validate theme changes
   * Ensures changes are valid before applying
   */
  onValidate(changes: Partial<Theme>, _userId: string): boolean {
    // Basic validation - can be extended
    if (changes.colors) {
      // Validate color format (basic check)
      for (const [key, value] of Object.entries(changes.colors)) {
        if (typeof value !== 'string') {
          console.error(`[ThemeCollabSession] Invalid color value for ${key}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Called when a user joins
   */
  async onUserJoined(user: any): Promise<void> {
    console.log(`[ThemeCollabSession] User joined: ${user.userName || user.userId}`);
    // Could track analytics, send notifications, etc.
  }

  /**
   * Called when a user leaves
   */
  async onUserLeft(user: any): Promise<void> {
    console.log(`[ThemeCollabSession] User left: ${user.userName || user.userId}`);
  }

  /**
   * Deep merge utility for nested objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  /**
   * Check if value is a plain object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Save version to history (optional)
   * Keeps last 100 versions
   */
  private async saveVersion(changes: Partial<Theme>, userId: string): Promise<void> {
    try {
      // Get current versions
      let versions = await this.state.storage.get<any[]>('versions') || [];

      // Add new version
      versions.push({
        id: `v-${Date.now()}`,
        changes,
        userId,
        timestamp: Date.now(),
      });

      // Keep only last 100 versions
      if (versions.length > 100) {
        versions = versions.slice(-100);
      }

      // Save versions
      await this.state.storage.put('versions', versions);
    } catch (error) {
      console.error('[ThemeCollabSession] Failed to save version:', error);
    }
  }
}
