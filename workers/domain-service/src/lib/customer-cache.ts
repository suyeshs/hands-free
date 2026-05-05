/**
 * Customer KV Cache Layer
 *
 * Provides fast edge caching for customer data to reduce D1 latency
 *
 * Features:
 * - Sub-50ms customer lookups at the edge
 * - 1-hour TTL with automatic invalidation
 * - Phone number-based cache keys
 * - Caches decrypted data for performance
 * - Automatic cache invalidation on updates
 */

import type { Customer } from './customer-manager';

/**
 * Cache TTL: 1 hour (3600 seconds)
 */
const CACHE_TTL = 3600;

/**
 * Cached customer data (decrypted for fast access)
 */
interface CachedCustomer {
  customer: Customer;
  cachedAt: string;
  tags?: string[]; // Tag IDs
}

/**
 * Generate cache key for customer by ID
 */
function getCacheKey(tenantId: string, customerId: string): string {
  return `customer:${tenantId}:id:${customerId}`;
}

/**
 * Generate cache key for customer by phone
 */
function getPhoneCacheKey(tenantId: string, phoneHash: string): string {
  return `customer:${tenantId}:phone:${phoneHash}`;
}

/**
 * Get customer from cache by ID
 *
 * @param customerId - Customer ID
 * @param tenantId - Tenant ID
 * @param kv - KV namespace
 * @returns Cached customer or null if not found
 */
export async function getCachedCustomer(
  customerId: string,
  tenantId: string,
  kv: KVNamespace
): Promise<Customer | null> {
  try {
    const key = getCacheKey(tenantId, customerId);
    const cached = await kv.get<CachedCustomer>(key, 'json');

    if (!cached) return null;

    // Check if cache is still fresh (within TTL)
    const cachedTime = new Date(cached.cachedAt).getTime();
    const now = Date.now();
    const age = (now - cachedTime) / 1000; // Age in seconds

    if (age > CACHE_TTL) {
      // Cache expired, delete it
      await kv.delete(key);
      return null;
    }

    return cached.customer;
  } catch (error) {
    console.error('KV cache read error:', error);
    return null; // Fall back to database on error
  }
}

/**
 * Get customer from cache by phone hash
 *
 * @param phoneHash - Hashed phone number
 * @param tenantId - Tenant ID
 * @param kv - KV namespace
 * @returns Cached customer or null if not found
 */
export async function getCachedCustomerByPhone(
  phoneHash: string,
  tenantId: string,
  kv: KVNamespace
): Promise<Customer | null> {
  try {
    const key = getPhoneCacheKey(tenantId, phoneHash);
    const cached = await kv.get<CachedCustomer>(key, 'json');

    if (!cached) return null;

    // Check if cache is still fresh
    const cachedTime = new Date(cached.cachedAt).getTime();
    const now = Date.now();
    const age = (now - cachedTime) / 1000;

    if (age > CACHE_TTL) {
      await kv.delete(key);
      return null;
    }

    return cached.customer;
  } catch (error) {
    console.error('KV cache read error:', error);
    return null;
  }
}

/**
 * Cache customer data (decrypted)
 *
 * @param customer - Customer data to cache
 * @param phoneHash - Phone hash for phone-based lookup
 * @param tags - Customer tag IDs
 * @param kv - KV namespace
 */
export async function cacheCustomer(
  customer: Customer,
  phoneHash: string,
  tags: string[] = [],
  kv: KVNamespace
): Promise<void> {
  try {
    const cached: CachedCustomer = {
      customer,
      cachedAt: new Date().toISOString(),
      tags,
    };

    // Cache by customer ID
    const idKey = getCacheKey(customer.tenantId, customer.id);
    await kv.put(idKey, JSON.stringify(cached), {
      expirationTtl: CACHE_TTL,
    });

    // Also cache by phone hash for fast phone lookups
    const phoneKey = getPhoneCacheKey(customer.tenantId, phoneHash);
    await kv.put(phoneKey, JSON.stringify(cached), {
      expirationTtl: CACHE_TTL,
    });
  } catch (error) {
    console.error('KV cache write error:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Invalidate customer cache
 *
 * Call this after customer updates, tag changes, or deletions
 *
 * @param customerId - Customer ID
 * @param tenantId - Tenant ID
 * @param phoneHash - Phone hash
 * @param kv - KV namespace
 */
export async function invalidateCustomerCache(
  customerId: string,
  tenantId: string,
  phoneHash: string,
  kv: KVNamespace
): Promise<void> {
  try {
    // Delete both cache keys
    const idKey = getCacheKey(tenantId, customerId);
    const phoneKey = getPhoneCacheKey(tenantId, phoneHash);

    await Promise.all([kv.delete(idKey), kv.delete(phoneKey)]);
  } catch (error) {
    console.error('KV cache invalidation error:', error);
    // Don't throw - cache invalidation failure is not critical
  }
}

/**
 * Invalidate all customer caches for a tenant
 *
 * Use this for bulk operations or when migrating data
 *
 * @param tenantId - Tenant ID
 * @param kv - KV namespace
 */
export async function invalidateTenantCustomerCache(
  tenantId: string,
  kv: KVNamespace
): Promise<number> {
  try {
    // List all keys for this tenant
    const prefix = `customer:${tenantId}:`;
    let cursor: string | undefined = undefined;
    let deletedCount = 0;

    do {
      const result = await kv.list({
        prefix,
        cursor,
      });

      // Delete keys in batches
      const deletePromises = result.keys.map((key) => kv.delete(key.name));
      await Promise.all(deletePromises);

      deletedCount += result.keys.length;
      cursor = result.cursor;
    } while (cursor);

    return deletedCount;
  } catch (error) {
    console.error('Tenant cache invalidation error:', error);
    return 0;
  }
}

/**
 * Get cache statistics for monitoring
 *
 * @param tenantId - Tenant ID
 * @param kv - KV namespace
 * @returns Cache statistics
 */
export async function getCacheStats(
  tenantId: string,
  kv: KVNamespace
): Promise<{
  totalKeys: number;
  estimatedSize: number;
}> {
  try {
    const prefix = `customer:${tenantId}:`;
    let cursor: string | undefined = undefined;
    let totalKeys = 0;
    let estimatedSize = 0;

    do {
      const result = await kv.list({
        prefix,
        cursor,
      });

      totalKeys += result.keys.length;

      // Estimate size (approximate)
      for (const key of result.keys) {
        estimatedSize += key.name.length;
        // Add estimated size of value (rough estimate: 2KB per customer)
        estimatedSize += 2048;
      }

      cursor = result.cursor;
    } while (cursor);

    return {
      totalKeys,
      estimatedSize,
    };
  } catch (error) {
    console.error('Cache stats error:', error);
    return {
      totalKeys: 0,
      estimatedSize: 0,
    };
  }
}

/**
 * Warm up cache by preloading frequently accessed customers
 *
 * Useful for high-traffic tenants or after cache invalidation
 *
 * @param tenantId - Tenant ID
 * @param customerIds - Customer IDs to preload
 * @param fetchCustomer - Function to fetch customer from database
 * @param kv - KV namespace
 */
export async function warmUpCache(
  tenantId: string,
  customerIds: string[],
  fetchCustomer: (customerId: string) => Promise<{
    customer: Customer;
    phoneHash: string;
    tags: string[];
  } | null>,
  kv: KVNamespace
): Promise<number> {
  let warmedUp = 0;

  for (const customerId of customerIds) {
    try {
      const data = await fetchCustomer(customerId);
      if (data) {
        await cacheCustomer(data.customer, data.phoneHash, data.tags, kv);
        warmedUp++;
      }
    } catch (error) {
      console.error(`Failed to warm up cache for customer ${customerId}:`, error);
    }
  }

  return warmedUp;
}

/**
 * Cache hit rate tracking (for monitoring)
 *
 * This can be stored in KV with a daily TTL for analytics
 */
interface CacheMetrics {
  date: string;
  hits: number;
  misses: number;
  hitRate: number; // Percentage
}

/**
 * Record cache hit
 */
export async function recordCacheHit(tenantId: string, kv: KVNamespace): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `metrics:${tenantId}:cache:${today}`;

  try {
    const existing = await kv.get<CacheMetrics>(key, 'json');
    const metrics: CacheMetrics = existing || {
      date: today,
      hits: 0,
      misses: 0,
      hitRate: 0,
    };

    metrics.hits++;
    metrics.hitRate = (metrics.hits / (metrics.hits + metrics.misses)) * 100;

    await kv.put(key, JSON.stringify(metrics), {
      expirationTtl: 86400 * 7, // Keep for 7 days
    });
  } catch (error) {
    console.error('Failed to record cache hit:', error);
  }
}

/**
 * Record cache miss
 */
export async function recordCacheMiss(tenantId: string, kv: KVNamespace): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `metrics:${tenantId}:cache:${today}`;

  try {
    const existing = await kv.get<CacheMetrics>(key, 'json');
    const metrics: CacheMetrics = existing || {
      date: today,
      hits: 0,
      misses: 0,
      hitRate: 0,
    };

    metrics.misses++;
    metrics.hitRate = (metrics.hits / (metrics.hits + metrics.misses)) * 100;

    await kv.put(key, JSON.stringify(metrics), {
      expirationTtl: 86400 * 7,
    });
  } catch (error) {
    console.error('Failed to record cache miss:', error);
  }
}

/**
 * Get cache metrics for a date range
 */
export async function getCacheMetrics(
  tenantId: string,
  startDate: string,
  endDate: string,
  kv: KVNamespace
): Promise<CacheMetrics[]> {
  const metrics: CacheMetrics[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (
    let date = new Date(start);
    date <= end;
    date.setDate(date.getDate() + 1)
  ) {
    const dateStr = date.toISOString().split('T')[0];
    const key = `metrics:${tenantId}:cache:${dateStr}`;

    try {
      const metric = await kv.get<CacheMetrics>(key, 'json');
      if (metric) {
        metrics.push(metric);
      }
    } catch (error) {
      console.error(`Failed to fetch metrics for ${dateStr}:`, error);
    }
  }

  return metrics;
}
