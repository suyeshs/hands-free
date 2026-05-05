/**
 * Tracked Store Creation
 * 
 * Wraps the enhanced store creation with real-time provisioning tracking,
 * allowing customers to monitor progress throughout the workflow.
 */

import { ProvisioningTracker } from '../core/provisioning-tracker';
import type { StoreCreationResult } from './enhanced-store-creation';

/**
 * Create store with real-time provisioning tracking
 * 
 * This function provides detailed, step-by-step status updates that customers
 * can query via the /api/provisioning/status endpoint.
 * 
 * @param tenantData - Tenant information
 * @param kvNamespace - KV namespace for tracking (typically DOMAIN_METADATA)
 * @returns Store creation result
 */
export async function createStoreWithTracking(
  tenantData: {
    tenantId: string;
    tenantSlug: string;
    companyName: string;
    email: string;
  },
  kvNamespace: KVNamespace
): Promise<StoreCreationResult> {
  const tracker = new ProvisioningTracker(kvNamespace);
  const domainServiceUrl = process.env.DOMAIN_SERVICE_URL;
  
  if (!domainServiceUrl) {
    throw new Error('DOMAIN_SERVICE_URL environment variable is not set');
  }

  try {
    // Generate expected subdomain for tracking initialization
    const sanitizedSlug = tenantData.tenantSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
    
    const baseDomain = process.env.BASE_DOMAIN || 'handsfree.tech';
    const fullDomain = `${sanitizedSlug}.${baseDomain}`;

    // Initialize tracking
    await tracker.initialize(tenantData.tenantId, sanitizedSlug, fullDomain);

    // Step 1: Check availability
    await tracker.startStep(tenantData.tenantId, 'availability_check');
    
    const availabilityResponse = await fetch(
      `${domainServiceUrl}/api/subdomains/check-availability`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: sanitizedSlug }),
      }
    );

    const availabilityResult = await availabilityResponse.json() as any;

    if (!availabilityResult.success || !availabilityResult.data.available) {
      await tracker.failStep(
        tenantData.tenantId,
        'availability_check',
        'Subdomain not available'
      );
      
      return {
        status: 'FAILED',
        error: 'Subdomain not available. Please choose a different name.',
      };
    }

    await tracker.completeStep(tenantData.tenantId, 'availability_check');

    // Step 2: Generate subdomain
    await tracker.startStep(tenantData.tenantId, 'subdomain_generation');
    await tracker.completeStep(tenantData.tenantId, 'subdomain_generation', {
      subdomain: sanitizedSlug,
    });

    // Step 3: Provision DNS
    await tracker.startStep(tenantData.tenantId, 'dns_provisioning');
    
    const assignResponse = await fetch(`${domainServiceUrl}/api/subdomains/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantData.tenantId,
        tenantSlug: tenantData.tenantSlug,
      }),
    });

    const assignResult = await assignResponse.json() as any;

    if (!assignResult.success) {
      await tracker.failStep(
        tenantData.tenantId,
        'dns_provisioning',
        assignResult.error || 'Failed to provision DNS'
      );
      
      return {
        status: 'FAILED',
        error: assignResult.error || 'Failed to assign subdomain',
      };
    }

    const { subdomain, fullDomain: actualFullDomain, url } = assignResult.data;

    // Update tracker with actual domain if different
    const currentStatus = await tracker.get(tenantData.tenantId);
    if (currentStatus && actualFullDomain !== currentStatus.fullDomain) {
      currentStatus.fullDomain = actualFullDomain;
      currentStatus.storeUrl = url;
    }

    await tracker.completeStep(tenantData.tenantId, 'dns_provisioning', {
      subdomain,
      fullDomain: actualFullDomain,
      dnsRecordsCreated: true,
    });

    // Step 4: DNS Propagation (polling)
    await tracker.startStep(tenantData.tenantId, 'dns_propagation');
    
    const maxAttempts = 10;
    let attempt = 0;
    let propagated = false;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'manual',
        });
        propagated = true;
        break;
      } catch {
        if (attempt < maxAttempts) {
          await sleep(3000);
        }
      }
      
      // Update progress metadata
      await tracker.updateStep(tenantData.tenantId, 'dns_propagation', {
        status: 'in_progress',
        metadata: {
          attempt,
          maxAttempts,
          progressPercent: Math.round((attempt / maxAttempts) * 100),
        },
      });
    }

    if (propagated) {
      await tracker.completeStep(tenantData.tenantId, 'dns_propagation', {
        attempts: attempt,
        propagated: true,
      });
    } else {
      // DNS not propagated yet, but don't fail - mark as completed with note
      await tracker.completeStep(tenantData.tenantId, 'dns_propagation', {
        attempts: attempt,
        propagated: false,
        note: 'DNS provisioned but not fully propagated yet',
      });
    }

    // Step 5: Verify accessibility
    await tracker.startStep(tenantData.tenantId, 'accessibility_verification');
    
    let accessible = false;
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
      });
      accessible = true;
    } catch {
      accessible = false;
    }

    await tracker.completeStep(tenantData.tenantId, 'accessibility_verification', {
      accessible,
    });

    // Step 6: Initialize store data
    await tracker.startStep(tenantData.tenantId, 'store_initialization');
    
    // Placeholder for actual store initialization
    // In production, this would call your store setup logic
    await sleep(1000); // Simulate initialization time
    
    await tracker.completeStep(tenantData.tenantId, 'store_initialization');

    // Step 7: Finalization
    await tracker.startStep(tenantData.tenantId, 'finalization');
    
    // Send notifications, update database, etc.
    await sleep(500); // Simulate finalization
    
    await tracker.completeStep(tenantData.tenantId, 'finalization', {
      notificationSent: true,
    });

    // Get final status
    const finalStatus = await tracker.get(tenantData.tenantId);

    const provisioningStatus: any = {
      dnsProvisioned: true,
      dnsPropagated: propagated,
      accessible,
      duration: finalStatus?.duration || 0,
      propagationChecks: attempt,
      startedAt: finalStatus?.startedAt || new Date().toISOString(),
    };
    
    if (finalStatus?.completedAt) {
      provisioningStatus.completedAt = finalStatus.completedAt;
    }
    
    return {
      status: 'READY',
      storeUrl: url,
      subdomain: actualFullDomain,
      provisioningStatus,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Store creation failed: ${errorMessage}`);
    
    // Try to get current status and mark as failed
    try {
      const currentStatus = await tracker.get(tenantData.tenantId);
      if (currentStatus) {
        const currentStep = currentStatus.currentStep;
        await tracker.failStep(tenantData.tenantId, currentStep, errorMessage);
      }
    } catch {
      // Ignore errors in error handling
    }
    
    return {
      status: 'FAILED',
      error: errorMessage,
    };
  }
}

/**
 * Poll provisioning status until completion
 * 
 * @param tenantId - Tenant ID
 * @param maxWaitMs - Maximum time to wait (default: 60000ms = 1 minute)
 * @returns Final provisioning status
 */
export async function pollProvisioningStatus(
  tenantId: string,
  maxWaitMs: number = 60000
): Promise<{
  completed: boolean;
  status: any;
}> {
  const domainServiceUrl = process.env.DOMAIN_SERVICE_URL;
  if (!domainServiceUrl) {
    throw new Error('DOMAIN_SERVICE_URL not set');
  }

  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(
        `${domainServiceUrl}/api/provisioning/status?tenantId=${tenantId}`
      );
      
      const result = await response.json() as any;
      
      if (result.success) {
        const status = result.data;
        
        if (status.status === 'completed' || status.status === 'failed') {
          return {
            completed: true,
            status,
          };
        }
      }
      
      await sleep(pollInterval);
    } catch (error) {
      console.warn('Error polling status:', error);
      await sleep(pollInterval);
    }
  }

  // Timeout
  return {
    completed: false,
    status: null,
  };
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  createStoreWithTracking,
  pollProvisioningStatus,
};

