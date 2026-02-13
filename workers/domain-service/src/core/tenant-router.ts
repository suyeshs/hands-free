/**
 * Tenant Router
 * 
 * Routes requests to the correct tenant's storage resources based on subdomain.
 * Implements hybrid multi-tenancy: shared worker, isolated storage per tenant.
 */

import type { TenantStorageConfig } from './tenant-storage-provisioner';

export interface TenantBindings {
  DATA_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  DATABASE: D1Database;
  STORAGE_BUCKET: R2Bucket;
}

export class TenantRouter {
  private env: any;
  private tenantConfigCache: Map<string, TenantStorageConfig>;

  constructor(env: any) {
    this.env = env;
    this.tenantConfigCache = new Map();
  }

  /**
   * Get tenant bindings by subdomain
   */
  async getTenantBindings(subdomain: string): Promise<TenantBindings | null> {
    const config = await this.getTenantConfig(subdomain);
    if (!config) {
      console.log(`No tenant config found for subdomain: ${subdomain}`);
      return null;
    }

    // Dynamically create bindings to tenant-specific resources
    // Note: In production, you'd use Cloudflare's dynamic dispatch or Service Bindings
    return {
      DATA_KV: await this.getKVBinding(config.resources.kvNamespaces.data),
      CACHE_KV: await this.getKVBinding(config.resources.kvNamespaces.cache),
      SESSIONS_KV: await this.getKVBinding(config.resources.kvNamespaces.sessions),
      DATABASE: await this.getD1Binding(config.resources.d1DatabaseId),
      STORAGE_BUCKET: await this.getR2Binding(config.resources.r2BucketName),
    };
  }

  /**
   * Get tenant configuration with caching
   */
  private async getTenantConfig(subdomain: string): Promise<TenantStorageConfig | null> {
    // Check cache first
    if (this.tenantConfigCache.has(subdomain)) {
      return this.tenantConfigCache.get(subdomain)!;
    }

    // Fetch from KV
    const config = await this.env.DOMAIN_METADATA.get(
      `tenant:storage:${subdomain}`,
      'json'
    ) as TenantStorageConfig | null;

    if (config) {
      // Cache for 5 minutes
      this.tenantConfigCache.set(subdomain, config);
      setTimeout(() => this.tenantConfigCache.delete(subdomain), 5 * 60 * 1000);
    }

    return config;
  }

  /**
   * Get KV binding by namespace ID
   * Note: This is a simplified version. In production, use Cloudflare Service Bindings
   */
  private async getKVBinding(namespaceId: string): Promise<KVNamespace> {
    // In a real implementation, you would use dynamic dispatch or service bindings
    // For now, we'll store the namespace ID and use it for API calls
    return {
      get: async (key: string, type?: any) => {
        return this.makeKVRequest(namespaceId, 'GET', key, type);
      },
      put: async (key: string, value: string | ArrayBuffer, options?: any) => {
        return this.makeKVRequest(namespaceId, 'PUT', key, 'text', value, options);
      },
      delete: async (key: string) => {
        return this.makeKVRequest(namespaceId, 'DELETE', key);
      },
      list: async (options?: any) => {
        return this.makeKVRequest(namespaceId, 'LIST', '', 'json', undefined, options);
      },
    } as any;
  }

  /**
   * Get D1 binding by database ID
   */
  private async getD1Binding(databaseId: string): Promise<D1Database> {
    // Similar to KV, in production you'd use service bindings
    return {
      prepare: (query: string) => {
        return {
          bind: (...values: any[]) => ({
            all: async () => this.executeD1Query(databaseId, query, values),
            first: async () => {
              const result = await this.executeD1Query(databaseId, query, values);
              return result.results?.[0] || null;
            },
            run: async () => this.executeD1Query(databaseId, query, values),
          }),
          all: async () => this.executeD1Query(databaseId, query, []),
          first: async () => {
            const result = await this.executeD1Query(databaseId, query, []);
            return result.results?.[0] || null;
          },
          run: async () => this.executeD1Query(databaseId, query, []),
        };
      },
      dump: async () => { throw new Error('Not implemented'); },
      batch: async (statements: any[]) => {
        throw new Error('Not implemented');
      },
      exec: async (query: string) => {
        return this.executeD1Query(databaseId, query, []);
      },
    } as any;
  }

  /**
   * Get R2 binding by bucket name
   */
  private async getR2Binding(bucketName: string): Promise<R2Bucket> {
    return {
      get: async (key: string) => {
        return this.makeR2Request(bucketName, 'GET', key);
      },
      put: async (key: string, value: any, options?: any) => {
        return this.makeR2Request(bucketName, 'PUT', key, value, options);
      },
      delete: async (key: string) => {
        return this.makeR2Request(bucketName, 'DELETE', key);
      },
      head: async (key: string) => {
        return this.makeR2Request(bucketName, 'HEAD', key);
      },
      list: async (options?: any) => {
        return this.makeR2Request(bucketName, 'LIST', '', undefined, options);
      },
    } as any;
  }

  /**
   * Make KV API request
   */
  private async makeKVRequest(
    namespaceId: string,
    method: string,
    key: string,
    type?: string,
    value?: any,
    options?: any
  ): Promise<any> {
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}`;
    
    let url = baseUrl;
    let fetchOptions: RequestInit = {
      method: method === 'LIST' ? 'GET' : method,
      headers: {
        'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    if (method === 'GET') {
      url = `${baseUrl}/values/${key}`;
    } else if (method === 'PUT') {
      url = `${baseUrl}/values/${key}`;
      fetchOptions.body = value;
    } else if (method === 'DELETE') {
      url = `${baseUrl}/values/${key}`;
    } else if (method === 'LIST') {
      url = `${baseUrl}/keys`;
      if (options?.prefix) {
        url += `?prefix=${options.prefix}`;
      }
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`KV request failed: ${response.statusText}`);
    }

    if (method === 'GET') {
      if (type === 'json') {
        return response.json();
      }
      return response.text();
    }

    if (method === 'LIST') {
      const data = await response.json() as any;
      return { keys: data.result || [] };
    }

    return null;
  }

  /**
   * Execute D1 query
   */
  private async executeD1Query(
    databaseId: string,
    query: string,
    params: any[]
  ): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: query,
          params,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`D1 query failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      results: data.result[0]?.results || [],
      success: data.success,
    };
  }

  /**
   * Make R2 API request
   */
  private async makeR2Request(
    bucketName: string,
    method: string,
    key: string,
    value?: any,
    options?: any
  ): Promise<any> {
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucketName}/objects`;
    
    let url = `${baseUrl}/${key}`;
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
      },
    };

    if (method === 'PUT' && value) {
      fetchOptions.body = value;
    }

    if (method === 'LIST') {
      url = baseUrl;
      if (options?.prefix) {
        url += `?prefix=${options.prefix}`;
      }
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok && method !== 'GET') {
      throw new Error(`R2 request failed: ${response.statusText}`);
    }

    if (method === 'GET') {
      if (!response.ok) return null;
      return {
        body: response.body,
        text: () => response.text(),
        json: () => response.json(),
        arrayBuffer: () => response.arrayBuffer(),
      };
    }

    if (method === 'LIST') {
      const data = await response.json() as any;
      return { objects: data.result || [] };
    }

    return null;
  }

  /**
   * Extract subdomain from hostname
   */
  static extractSubdomain(hostname: string, baseDomain: string): string | null {
    const regex = new RegExp(`^(.+?)\\.${baseDomain.replace('.', '\\.')}$`);
    const match = hostname.match(regex);
    return match?.[1] || null;
  }

  /**
   * Middleware to inject tenant bindings into request
   */
  static async withTenantBindings(
    request: Request,
    env: any,
    handler: (request: Request, env: any, tenantBindings: TenantBindings) => Promise<Response>
  ): Promise<Response> {
    const url = new URL(request.url);
    const subdomain = TenantRouter.extractSubdomain(url.hostname, env.BASE_DOMAIN);

    if (!subdomain) {
      return new Response('Invalid subdomain', { status: 400 });
    }

    const router = new TenantRouter(env);
    const tenantBindings = await router.getTenantBindings(subdomain);

    if (!tenantBindings) {
      return new Response('Tenant not found', { status: 404 });
    }

    return handler(request, env, tenantBindings);
  }
}

