declare global {
  interface CloudflareEnv {
    // Service Bindings
    DOMAIN_SERVICE: Fetcher;

    // KV Namespaces
    TENANT_METADATA: KVNamespace;

    // D1 Databases
    TENANTS_DB: D1Database;
    MENU_DB: D1Database;

    // R2 Buckets
    MENU_UPLOADS_BUCKET: R2Bucket;
  }
}

export {};
