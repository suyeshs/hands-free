/**
 * Durable Object for theme coordination and caching
 */

import { Env, ThemeJSON } from './types';

export class ThemeDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private theme: ThemeJSON | null = null;
  private lastAccessed: number = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Load theme from storage on initialization
    this.state.blockConcurrencyWhile(async () => {
      this.theme = (await this.state.storage.get<ThemeJSON>('theme')) || null;
      this.lastAccessed = (await this.state.storage.get<number>('lastAccessed')) || Date.now();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // GET /theme - retrieve theme
      if (method === 'GET' && url.pathname === '/theme') {
        return this.getTheme();
      }

      // PUT /theme - update theme
      if (method === 'PUT' && url.pathname === '/theme') {
        return this.putTheme(request);
      }

      // DELETE /theme - clear theme
      if (method === 'DELETE' && url.pathname === '/theme') {
        return this.deleteTheme();
      }

      // GET /stats - get statistics
      if (method === 'GET' && url.pathname === '/stats') {
        return this.getStats();
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Durable Object error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Get theme from storage
   */
  private async getTheme(): Promise<Response> {
    if (!this.theme) {
      return new Response(JSON.stringify({ error: 'Theme not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update last accessed time
    this.lastAccessed = Date.now();
    await this.state.storage.put('lastAccessed', this.lastAccessed);

    return new Response(JSON.stringify(this.theme), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=3600',
        'X-DO-Cache': 'hit',
      },
    });
  }

  /**
   * Store theme in Durable Object
   */
  private async putTheme(request: Request): Promise<Response> {
    try {
      const theme = await request.json() as ThemeJSON;

      // Store in memory and persistent storage
      this.theme = theme;
      this.lastAccessed = Date.now();

      await this.state.storage.put({
        theme: theme,
        lastAccessed: this.lastAccessed,
      });

      return new Response(JSON.stringify({
        success: true,
        version: theme.version,
        updatedAt: theme.meta.updatedAt,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Invalid theme data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Delete theme from storage
   */
  private async deleteTheme(): Promise<Response> {
    this.theme = null;
    await this.state.storage.deleteAll();

    return new Response(JSON.stringify({
      success: true,
      message: 'Theme deleted successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Get statistics about this Durable Object
   */
  private async getStats(): Promise<Response> {
    return new Response(JSON.stringify({
      hasTheme: !!this.theme,
      lastAccessed: this.lastAccessed,
      version: this.theme?.version,
      author: this.theme?.meta.author,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Alarm handler for automatic cleanup (optional)
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    const inactiveTime = now - this.lastAccessed;
    
    // If inactive for more than 7 days, clear memory (data persists in storage)
    if (inactiveTime > 7 * 24 * 60 * 60 * 1000) {
      console.log('Clearing inactive Durable Object from memory');
      this.theme = null;
    }
  }
}

