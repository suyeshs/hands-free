/**
 * Plugin Registry Worker
 * Cloudflare Worker that serves as the plugin registry backend
 * Handles plugin metadata, WASM file storage, and registry API
 */

export interface Env {
  PLUGIN_STORAGE: R2Bucket;
  PLUGIN_METADATA: KVNamespace;
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
}

interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  [key: string]: any;
}

/**
 * CORS headers for cross-origin requests
 */
function getCorsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight requests
 */
function handleOptions(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('Origin'), env),
  });
}

/**
 * List all available plugins
 */
async function listPlugins(env: Env): Promise<Response> {
  try {
    // Get list of all plugin IDs from KV
    const pluginList = await env.PLUGIN_METADATA.get('plugin-index', 'json') as string[] | null;

    if (!pluginList || pluginList.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch metadata for each plugin
    const plugins: PluginMetadata[] = [];
    for (const pluginId of pluginList) {
      const metadata = await env.PLUGIN_METADATA.get(`plugin:${pluginId}`, 'json') as PluginMetadata | null;
      if (metadata) {
        plugins.push(metadata);
      }
    }

    return new Response(JSON.stringify(plugins), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error listing plugins:', error);
    return new Response(JSON.stringify({ error: 'Failed to list plugins' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Search plugins by query and filters
 */
async function searchPlugins(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const category = url.searchParams.get('category');
    const verified = url.searchParams.get('verified');
    const minRating = url.searchParams.get('minRating');
    const tags = url.searchParams.get('tags')?.split(',');
    const sortBy = url.searchParams.get('sortBy') || 'rating';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // Get all plugins
    const listResponse = await listPlugins(env);
    let plugins = await listResponse.json() as PluginMetadata[];

    // Apply filters
    if (query) {
      const lowerQuery = query.toLowerCase();
      plugins = plugins.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))
      );
    }

    if (category) {
      plugins = plugins.filter(p => p.category === category);
    }

    if (verified !== null && verified !== undefined) {
      const isVerified = verified === 'true';
      plugins = plugins.filter(p => p.verified === isVerified);
    }

    if (minRating) {
      const minRatingNum = parseFloat(minRating);
      plugins = plugins.filter(p => (p.rating || 0) >= minRatingNum);
    }

    if (tags && tags.length > 0) {
      plugins = plugins.filter(p =>
        tags.some(tag => p.tags?.includes(tag))
      );
    }

    // Apply sorting
    plugins.sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortBy) {
        case 'rating':
          aVal = a.rating || 0;
          bVal = b.rating || 0;
          break;
        case 'downloads':
          aVal = a.download_count || 0;
          bVal = b.download_count || 0;
          break;
        case 'updated':
          aVal = new Date(a.updated_at).getTime();
          bVal = new Date(b.updated_at).getTime();
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return new Response(JSON.stringify(plugins), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error searching plugins:', error);
    return new Response(JSON.stringify({ error: 'Failed to search plugins' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get plugin info by ID
 */
async function getPluginInfo(pluginId: string, env: Env): Promise<Response> {
  try {
    const metadata = await env.PLUGIN_METADATA.get(`plugin:${pluginId}`, 'json') as PluginMetadata | null;

    if (!metadata) {
      return new Response(JSON.stringify({ error: 'Plugin not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(metadata), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting plugin info:', error);
    return new Response(JSON.stringify({ error: 'Failed to get plugin info' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get plugin reviews
 */
async function getPluginReviews(pluginId: string, env: Env): Promise<Response> {
  try {
    const reviews = await env.PLUGIN_METADATA.get(`reviews:${pluginId}`, 'json') as any[] | null;

    return new Response(JSON.stringify(reviews || []), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting reviews:', error);
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Submit a plugin review
 */
async function submitReview(pluginId: string, request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { tenant_id, rating, comment, plugin_version } = body;

    if (!rating || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Invalid rating' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get existing reviews
    const reviews = await env.PLUGIN_METADATA.get(`reviews:${pluginId}`, 'json') as any[] | null || [];

    // Add new review
    const newReview = {
      id: crypto.randomUUID(),
      tenant_id,
      rating,
      comment,
      plugin_version,
      created_at: new Date().toISOString(),
    };

    reviews.unshift(newReview);

    // Store reviews (keep last 100)
    await env.PLUGIN_METADATA.put(`reviews:${pluginId}`, JSON.stringify(reviews.slice(0, 100)));

    // Update plugin metadata with new average rating and review count
    const metadata = await env.PLUGIN_METADATA.get(`plugin:${pluginId}`, 'json') as PluginMetadata;
    if (metadata) {
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      metadata.rating = totalRating / reviews.length;
      metadata.reviews_count = reviews.length;
      await env.PLUGIN_METADATA.put(`plugin:${metadata.id}`, JSON.stringify(metadata));
    }

    return new Response(JSON.stringify({ success: true, review: newReview }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit review' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Download plugin WASM file
 * URL format: /download/{pluginId}/{version}/{type}
 * R2 path: global/plugins/{pluginId}/{version}/{basename}-{type}.wasm
 * Example: bar-management-v2 → bar-client.wasm
 */
async function downloadWasm(pluginId: string, version: string, type: 'client' | 'worker', env: Env): Promise<Response> {
  try {
    // Map plugin IDs to WASM filenames
    const fileNameMap: Record<string, string> = {
      'bar-management-v2': 'bar',
      'aggregator-integration-india': 'aggregator',
      'inventory-management': 'inventory-management',
      'people-payroll': 'people-payroll',
      'analytics-reports': 'analytics-reports',
      'customer-crm': 'customer-crm',
      'multi-location-sync': 'multi-location-sync',
      'online-ordering-qr': 'online-ordering-qr',
      'vision-ai': 'vision',
    };

    const baseName = fileNameMap[pluginId] || pluginId.split('-')[0];
    const fileName = `${baseName}-${type}.wasm`;
    const key = `global/plugins/${pluginId}/${version}/${fileName}`;

    console.log(`Attempting to download WASM: ${key}`);
    const object = await env.PLUGIN_STORAGE.get(key);

    if (!object) {
      console.error(`WASM file not found: ${key}`);
      return new Response(JSON.stringify({ error: 'WASM file not found', key }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/wasm',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error downloading WASM:', error);
    return new Response(JSON.stringify({ error: 'Failed to download WASM' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Serve migration files from R2
 * URL format: /plugins/{pluginId}/migrations/{filename}
 * R2 path: global/plugins/{pluginId}/migrations/{filename}
 */
async function serveMigrationFile(pluginId: string, filename: string, env: Env): Promise<Response> {
  try {
    const key = `global/plugins/${pluginId}/migrations/${filename}`;
    console.log(`Attempting to serve migration file: ${key}`);

    const object = await env.PLUGIN_STORAGE.get(key);

    if (!object) {
      console.error(`Migration file not found: ${key}`);
      return new Response(JSON.stringify({ error: 'Migration file not found', key }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = filename.endsWith('.json') ? 'application/json' :
                       filename.endsWith('.sql') ? 'text/plain' :
                       'application/octet-stream';

    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving migration file:', error);
    return new Response(JSON.stringify({ error: 'Failed to serve migration file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    try {
      // Route handling
      if (url.pathname === '/list' && request.method === 'GET') {
        const response = await listPlugins(env);
        return new Response(response.body, {
          status: response.status,
          headers: { ...response.headers, ...corsHeaders },
        });
      }

      if (url.pathname === '/search' && request.method === 'GET') {
        const response = await searchPlugins(request, env);
        return new Response(response.body, {
          status: response.status,
          headers: { ...response.headers, ...corsHeaders },
        });
      }

      if (url.pathname.startsWith('/info/') && request.method === 'GET') {
        const pluginId = url.pathname.split('/')[2];
        const response = await getPluginInfo(pluginId, env);
        return new Response(response.body, {
          status: response.status,
          headers: { ...response.headers, ...corsHeaders },
        });
      }

      if (url.pathname.endsWith('/reviews') && request.method === 'GET') {
        const pluginId = url.pathname.split('/')[1];
        const response = await getPluginReviews(pluginId, env);
        return new Response(response.body, {
          status: response.status,
          headers: { ...response.headers, ...corsHeaders },
        });
      }

      if (url.pathname.endsWith('/reviews') && request.method === 'POST') {
        const pluginId = url.pathname.split('/')[1];
        const response = await submitReview(pluginId, request, env);
        return new Response(response.body, {
          status: response.status,
          headers: { ...response.headers, ...corsHeaders },
        });
      }

      if (url.pathname.startsWith('/download/') && request.method === 'GET') {
        const parts = url.pathname.split('/');
        const pluginId = parts[2];
        const version = parts[3];
        const type = parts[4] as 'client' | 'worker';
        const response = await downloadWasm(pluginId, version, type, env);
        return new Response(response.body, {
          status: response.status,
          headers: { ...response.headers, ...corsHeaders },
        });
      }

      // Serve migration files
      // URL format: /plugins/{pluginId}/migrations/{filename}
      if (url.pathname.match(/^\/plugins\/[^/]+\/migrations\/[^/]+$/) && request.method === 'GET') {
        const parts = url.pathname.split('/');
        const pluginId = parts[2];
        const filename = parts[4];
        const response = await serveMigrationFile(pluginId, filename, env);
        return new Response(response.body, {
          status: response.status,
          headers: { ...response.headers, ...corsHeaders },
        });
      }

      // Serve manifest files from R2
      // URL format: /global/plugins/{pluginId}/{version}/manifest.json
      if (url.pathname.match(/^\/global\/plugins\/[^/]+\/[^/]+\/manifest\.json$/) && request.method === 'GET') {
        const key = url.pathname.substring(1); // Remove leading /
        console.log(`Serving manifest: ${key}`);

        const object = await env.PLUGIN_STORAGE.get(key);

        if (!object) {
          console.error(`Manifest not found: ${key}`);
          return new Response(JSON.stringify({ error: 'Manifest not found', key }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(object.body, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300', // 5 minutes
            ...corsHeaders,
          },
        });
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};
