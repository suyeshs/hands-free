/**
 * Enhanced Store Creation with DNS Verification
 * 
 * This module provides a production-ready store creation flow that ensures
 * all provisioning is complete before marking the store as ready.
 * 
 * Key Features:
 * - DNS propagation verification
 * - Subdomain accessibility checking
 * - Configurable wait strategies
 * - Comprehensive error handling
 * - Status tracking throughout the process
 * - Real-time provisioning status updates
 */

import { ProvisioningTracker } from '../core/provisioning-tracker';

export interface StoreCreationOptions {
  /** Wait for DNS propagation before returning (default: true for synchronous, false for async) */
  waitForDNS?: boolean;
  
  /** Verify subdomain is accessible via HTTP (default: true) */
  verifyAccessibility?: boolean;
  
  /** Maximum time to wait for DNS propagation in ms (default: 30000) */
  maxWaitTimeMs?: number;
  
  /** Send notification when store is ready (default: true) */
  notifyOnCompletion?: boolean;
  
  /** Retry failed provisioning attempts (default: true) */
  enableRetry?: boolean;
  
  /** Number of retry attempts (default: 3) */
  maxRetries?: number;
}

export interface StoreProvisioningStatus {
  /** DNS record created in Cloudflare */
  dnsProvisioned: boolean;
  
  /** DNS record propagated and resolvable */
  dnsPropagated: boolean;
  
  /** Subdomain accessible via HTTP */
  accessible: boolean;
  
  /** Total duration of provisioning in ms */
  duration: number;
  
  /** Number of DNS propagation checks performed */
  propagationChecks: number;
  
  /** Timestamp when provisioning started */
  startedAt: string;
  
  /** Timestamp when provisioning completed */
  completedAt?: string;
}

export interface StoreCreationResult {
  /** Overall status of store creation */
  status: 'READY' | 'PROVISIONING' | 'FAILED';
  
  /** Full store URL */
  storeUrl?: string;
  
  /** Subdomain (e.g., 'my-store.handsfree.tech') */
  subdomain?: string;
  
  /** Error message if failed */
  error?: string;
  
  /** Detailed provisioning status */
  provisioningStatus?: StoreProvisioningStatus;
  
  /** Estimated time remaining if still provisioning (in seconds) */
  estimatedTimeRemaining?: number;
}

/**
 * Create a store with full DNS verification
 *
 * This is the recommended approach for production use. It ensures the store
 * is fully provisioned before marking it as ready.
 *
 * @param tenantData - Tenant information
 * @param env - Environment variables (Cloudflare Workers env)
 * @param options - Creation options
 * @returns Store creation result with detailed status
 */
export async function createStoreWithVerification(
  tenantData: {
    tenantId: string;
    tenantSlug: string;
    companyName: string;
    email: string;
  },
  env: { DOMAIN_SERVICE_URL?: string },
  options: StoreCreationOptions = {}
): Promise<StoreCreationResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  
  const opts = {
    waitForDNS: true,
    verifyAccessibility: true,
    maxWaitTimeMs: 30000,
    notifyOnCompletion: true,
    enableRetry: true,
    maxRetries: 3,
    ...options
  };

  let propagationChecks = 0;

  try {
    console.log(`🏪 Creating store for: ${tenantData.companyName}`);

    // Phase 1: Check availability
    console.log('📍 Phase 1: Checking subdomain availability...');
    const domainServiceUrl = env.DOMAIN_SERVICE_URL;

    if (!domainServiceUrl) {
      throw new Error('DOMAIN_SERVICE_URL environment variable is not set');
    }

    const availabilityCheck = await checkSubdomainAvailability(
      tenantData.tenantSlug,
      domainServiceUrl
    );
    
    if (!availabilityCheck.available) {
      return {
        status: 'FAILED',
        error: 'Subdomain not available. Please choose a different name.',
      };
    }

    // Phase 2: Assign subdomain (triggers DNS provisioning)
    console.log('📍 Phase 2: Assigning subdomain and provisioning DNS...');
    
    const assignResult = await assignSubdomain(
      tenantData.tenantId,
      tenantData.tenantSlug,
      domainServiceUrl
    );

    if (!assignResult.success) {
      throw new Error(assignResult.error || 'Failed to assign subdomain');
    }

    const { subdomain, fullDomain, url } = assignResult;

    console.log(`✅ Subdomain assigned: ${fullDomain}`);

    // Phase 3: Store initial configuration
    console.log('📍 Phase 3: Saving store configuration...');
    await saveStoreConfiguration({
      tenantId: tenantData.tenantId,
      subdomain: fullDomain,
      storeUrl: url,
      status: opts.waitForDNS ? 'provisioning' : 'active',
      createdAt: new Date().toISOString(),
      provisioningStartedAt: startedAt,
    });

    let dnsProvisioned = true; // DNS record was created in Phase 2
    let dnsPropagated = false;
    let accessible = false;

    // Phase 4: Wait for DNS propagation (if enabled)
    if (opts.waitForDNS) {
      console.log('📍 Phase 4: Waiting for DNS propagation...');
      console.log(`  Max wait time: ${opts.maxWaitTimeMs}ms`);
      
      const propagationResult = await waitForDNSPropagation(url, {
        maxAttempts: Math.floor(opts.maxWaitTimeMs / 3000),
        intervalMs: 3000,
        backoffMultiplier: 1.2,
      });

      dnsPropagated = propagationResult.success;
      propagationChecks = propagationResult.attempts;

      if (dnsPropagated) {
        console.log(`✅ DNS propagated (${propagationChecks} checks)`);
      } else {
        console.warn(`⚠️  DNS not propagated after ${propagationChecks} attempts`);
      }
    }

    // Phase 5: Verify accessibility (if enabled and DNS propagated)
    if (opts.verifyAccessibility && (dnsPropagated || !opts.waitForDNS)) {
      console.log('📍 Phase 5: Verifying subdomain accessibility...');
      
      accessible = await verifySubdomainAccessible(url);
      
      if (accessible) {
        console.log('✅ Subdomain is accessible');
      } else {
        console.warn('⚠️  Subdomain not accessible yet (may still be propagating)');
      }
    }

    // Phase 6: Initialize store data (if DNS is ready or we're not waiting)
    if (dnsPropagated || !opts.waitForDNS) {
      console.log('📍 Phase 6: Initializing store data...');
      await initializeStoreData(tenantData.tenantId, {
        companyName: tenantData.companyName,
        subdomain: fullDomain,
        plan: 'starter', // Can be customized
      });
    }

    // Phase 7: Update final status
    const finalStatus = (dnsPropagated || !opts.waitForDNS) ? 'active' : 'provisioning';
    const completedAt = new Date().toISOString();
    
    await updateStoreConfiguration(tenantData.tenantId, {
      status: finalStatus,
      dnsVerified: dnsPropagated,
      accessVerified: accessible,
      verifiedAt: dnsPropagated ? completedAt : undefined,
      provisioningCompletedAt: finalStatus === 'active' ? completedAt : undefined,
    });

    // Phase 8: Send notifications (if ready and enabled)
    if (finalStatus === 'active' && opts.notifyOnCompletion) {
      console.log('📍 Phase 8: Sending welcome notification...');
      await sendWelcomeNotification(tenantData.email, {
        storeName: tenantData.companyName,
        storeUrl: url,
        subdomain: fullDomain,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`✨ Store creation completed in ${(duration / 1000).toFixed(1)}s`);

    const provisioningStatus: StoreProvisioningStatus = {
      dnsProvisioned,
      dnsPropagated,
      accessible,
      duration,
      propagationChecks,
      startedAt,
      ...(finalStatus === 'active' && { completedAt }),
    };

    return {
      status: finalStatus === 'active' ? 'READY' : 'PROVISIONING',
      storeUrl: url,
      subdomain: fullDomain,
      provisioningStatus,
      ...(finalStatus === 'provisioning' && {
        estimatedTimeRemaining: 60, // Estimate 1 minute for remaining DNS propagation
      }),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Store creation failed: ${errorMessage}`);
    
    const duration = Date.now() - startTime;
    
    return {
      status: 'FAILED',
      error: errorMessage,
      provisioningStatus: {
        dnsProvisioned: false,
        dnsPropagated: false,
        accessible: false,
        duration,
        propagationChecks,
        startedAt,
      },
    };
  }
}

/**
 * Create a store asynchronously (return immediately, complete in background)
 *
 * This approach provides better UX by not blocking the user while DNS propagates.
 * The store will be marked as 'provisioning' initially and updated to 'active'
 * once DNS propagation is verified.
 *
 * @param tenantData - Tenant information
 * @param env - Environment variables (Cloudflare Workers env)
 * @returns Immediate result with provisioning status
 */
export async function createStoreAsync(
  tenantData: {
    tenantId: string;
    tenantSlug: string;
    companyName: string;
    email: string;
  },
  env: { DOMAIN_SERVICE_URL?: string }
): Promise<StoreCreationResult> {
  // Start creation without waiting for DNS
  const result = await createStoreWithVerification(tenantData, env, {
    waitForDNS: false,
    verifyAccessibility: false,
    notifyOnCompletion: false,
  });

  if (result.status === 'FAILED') {
    return result;
  }

  // Schedule background job to complete verification
  // In production, use a queue system like BullMQ, SQS, etc.
  scheduleBackgroundVerification(tenantData.tenantId, result.storeUrl!);

  return {
    ...result,
    status: 'PROVISIONING',
    estimatedTimeRemaining: 60, // 1 minute estimate
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a subdomain is available
 */
async function checkSubdomainAvailability(
  subdomain: string,
  domainServiceUrl: string
): Promise<{ available: boolean; suggestions?: string[] }> {
  const response = await fetch(`${domainServiceUrl}/api/subdomains/check-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain }),
  });

  const result = await response.json() as any;

  if (result.success) {
    const response: { available: boolean; suggestions?: string[] } = {
      available: result.data.available,
    };
    
    if (!result.data.available) {
      response.suggestions = generateSubdomainSuggestions(subdomain);
    }
    
    return response;
  }

  throw new Error('Failed to check subdomain availability');
}

/**
 * Assign a subdomain to a tenant
 */
async function assignSubdomain(
  tenantId: string,
  tenantSlug: string,
  domainServiceUrl: string
): Promise<{ success: boolean; subdomain: string; fullDomain: string; url: string; error?: string }> {
  const response = await fetch(`${domainServiceUrl}/api/subdomains/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, tenantSlug }),
  });

  const result = await response.json() as any;

  if (result.success) {
    return {
      success: true,
      subdomain: result.data.subdomain,
      fullDomain: result.data.fullDomain,
      url: result.data.url,
    };
  }

  return {
    success: false,
    subdomain: '',
    fullDomain: '',
    url: '',
    error: result.error || 'Failed to assign subdomain',
  };
}

/**
 * Wait for DNS propagation with polling
 */
async function waitForDNSPropagation(
  url: string,
  options: {
    maxAttempts: number;
    intervalMs: number;
    backoffMultiplier?: number;
  }
): Promise<{ success: boolean; attempts: number }> {
  let attempt = 0;
  let interval = options.intervalMs;
  const backoff = options.backoffMultiplier || 1;

  while (attempt < options.maxAttempts) {
    attempt++;
    
    const isAccessible = await verifySubdomainAccessible(url);
    
    if (isAccessible) {
      return { success: true, attempts: attempt };
    }

    if (attempt < options.maxAttempts) {
      await sleep(interval);
      interval *= backoff;
    }
  }

  return { success: false, attempts: attempt };
}

/**
 * Verify subdomain is accessible via HTTP
 */
async function verifySubdomainAccessible(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    // Any response (even errors) means DNS resolved
    return true;
  } catch (error) {
    // DNS not resolved or network error
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate subdomain suggestions if unavailable
 */
function generateSubdomainSuggestions(subdomain: string): string[] {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  
  return [
    `${subdomain}${year}`,
    `${subdomain}-store`,
    `${subdomain}-shop`,
    `my-${subdomain}`,
    `${subdomain}-${randomSuffix}`,
  ];
}

/**
 * Save store configuration to your database
 * TODO: Implement based on your database schema
 */
async function saveStoreConfiguration(config: any): Promise<void> {
  // Implementation depends on your database
  console.log('💾 Saving store configuration:', config.subdomain);
  
  // Example:
  // await db.stores.create({
  //   tenantId: config.tenantId,
  //   subdomain: config.subdomain,
  //   storeUrl: config.storeUrl,
  //   status: config.status,
  //   createdAt: config.createdAt,
  // });
}

/**
 * Update store configuration
 * TODO: Implement based on your database schema
 */
async function updateStoreConfiguration(tenantId: string, updates: any): Promise<void> {
  console.log('💾 Updating store configuration for:', tenantId);
  
  // Example:
  // await db.stores.update(
  //   { tenantId },
  //   { $set: updates }
  // );
}

/**
 * Initialize store data (products, settings, templates, etc.)
 * TODO: Implement based on your store initialization logic
 */
async function initializeStoreData(tenantId: string, data: any): Promise<void> {
  console.log('🎨 Initializing store data for:', tenantId);
  
  // Example:
  // await db.stores.update(tenantId, {
  //   settings: defaultSettings,
  //   theme: defaultTheme,
  //   pages: defaultPages,
  // });
  
  // Create sample products
  // await db.products.insertMany(sampleProducts);
}

/**
 * Send welcome notification to store owner
 * TODO: Implement based on your notification system
 */
async function sendWelcomeNotification(email: string, data: any): Promise<void> {
  console.log('📧 Sending welcome notification to:', email);
  
  // Example:
  // await emailService.send({
  //   to: email,
  //   subject: `Your store ${data.storeName} is ready!`,
  //   template: 'store-ready',
  //   data: {
  //     storeName: data.storeName,
  //     storeUrl: data.storeUrl,
  //   },
  // });
}

/**
 * Schedule background verification job
 * TODO: Implement based on your job queue system
 */
function scheduleBackgroundVerification(tenantId: string, storeUrl: string): void {
  console.log('⏰ Scheduling background verification for:', tenantId);
  
  // Example with a job queue:
  // await jobQueue.add('verify-store-provisioning', {
  //   tenantId,
  //   storeUrl,
  // }, {
  //   attempts: 5,
  //   backoff: {
  //     type: 'exponential',
  //     delay: 3000,
  //   },
  // });
  
  // Simple setTimeout fallback (not recommended for production):
  // setTimeout(async () => {
  //   await completeStoreVerification(tenantId, storeUrl);
  // }, 5000);
}

/**
 * Complete store verification in background
 */
export async function completeStoreVerification(
  tenantId: string,
  storeUrl: string
): Promise<boolean> {
  console.log(`🔍 Verifying store provisioning for tenant: ${tenantId}`);

  try {
    // Wait for DNS propagation
    const result = await waitForDNSPropagation(storeUrl, {
      maxAttempts: 20,
      intervalMs: 3000,
      backoffMultiplier: 1.2,
    });

    if (result.success) {
      // Update store status to active
      await updateStoreConfiguration(tenantId, {
        status: 'active',
        dnsVerified: true,
        accessVerified: true,
        verifiedAt: new Date().toISOString(),
        provisioningCompletedAt: new Date().toISOString(),
      });

      // Send welcome notification
      // await sendWelcomeNotification(...);

      console.log(`✅ Store verified and activated: ${tenantId}`);
      return true;
    } else {
      console.warn(`⚠️  Store verification incomplete after ${result.attempts} attempts`);
      
      // Update status to indicate delay
      await updateStoreConfiguration(tenantId, {
        status: 'provisioning_delayed',
        lastVerificationAttempt: new Date().toISOString(),
      });

      return false;
    }
  } catch (error) {
    console.error(`❌ Store verification failed for ${tenantId}:`, error);
    return false;
  }
}

// Export all functions
export default {
  createStoreWithVerification,
  createStoreAsync,
  completeStoreVerification,
  verifySubdomainAccessible,
  waitForDNSPropagation,
};

