/**
 * SaaS Store Creation Workflow Integration
 * 
 * This file demonstrates how to integrate the automated domain service
 * deployment into your SaaS store creation workflow.
 * 
 * Use this as a reference for integrating with your platform's
 * tenant onboarding and store provisioning systems.
 */

import {
  deployDomainService,
  generateWebhookSecret,
  validateConfig,
  type DeploymentConfig,
  type DeploymentResult,
} from '../automation/deployment';

// ============================================================================
// WORKFLOW INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example 1: One-time initial deployment
 * Use this when setting up the domain service for the first time
 */
export async function initialDomainServiceSetup(): Promise<DeploymentResult> {
  console.log('🎯 Initial Domain Service Setup');
  console.log('This will provision all resources and deploy the worker\n');

  const config: DeploymentConfig = {
    // Cloudflare credentials (fetch from your secure vault)
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN!,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID!,
    
    // Domain configuration
    baseDomain: process.env.BASE_DOMAIN || 'handsfree.tech',
    platformDomain: process.env.PLATFORM_DOMAIN || 'platform.handsfree.tech',

    // SSL configuration
    letsencryptEmail: process.env.LETSENCRYPT_EMAIL || 'admin@handsfree.tech',
    
    // Security (generate new secret for each environment)
    webhookSecret: generateWebhookSecret(),
    
    // Environment
    environment: (process.env.NODE_ENV === 'production' ? 'production' : 'staging') as 'staging' | 'production',
  };

  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  // Deploy
  const result = await deployDomainService(config);
  
  if (result.success) {
    console.log('\n✅ Domain service is ready!');
    console.log(`📍 Worker URL: ${result.workerUrl}`);
    console.log('\nNext steps:');
    console.log('1. Save the worker URL to your configuration');
    console.log('2. Test the health endpoint');
    console.log('3. Integrate with your tenant onboarding flow');
  }

  return result;
}

/**
 * Example 2: Tenant Store Creation Workflow
 * Integrate subdomain assignment into your tenant onboarding
 */
export async function createTenantStore(tenantData: {
  tenantId: string;
  tenantSlug: string;
  companyName: string;
  email: string;
}): Promise<{
  success: boolean;
  storeUrl?: string;
  subdomain?: string;
  error?: string;
}> {
  console.log(`🏪 Creating store for tenant: ${tenantData.companyName}`);

  try {
    const domainServiceUrl = process.env.DOMAIN_SERVICE_URL;
    
    if (!domainServiceUrl) {
      throw new Error('DOMAIN_SERVICE_URL environment variable is not set');
    }

    // Step 1: Assign subdomain via Domain Service
    console.log('📍 Assigning subdomain...');
    const response = await fetch(`${domainServiceUrl}/api/subdomains/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantData.tenantId,
        tenantSlug: tenantData.tenantSlug,
      }),
    });

    const result = await response.json() as any;

    if (!result.success) {
      throw new Error(result.error || 'Failed to assign subdomain');
    }

    const { subdomain, fullDomain, url } = result.data;

    console.log(`✅ Subdomain assigned: ${fullDomain}`);

    // Step 2: Store subdomain in your database
    console.log('💾 Saving store configuration...');
    await saveStoreConfiguration({
      tenantId: tenantData.tenantId,
      subdomain: fullDomain,
      storeUrl: url,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    // Step 3: Initialize store data (products, settings, etc.)
    console.log('🎨 Initializing store data...');
    await initializeStoreData(tenantData.tenantId);

    // Step 4: Send welcome email with store URL
    console.log('📧 Sending welcome email...');
    await sendWelcomeEmail(tenantData.email, {
      storeName: tenantData.companyName,
      storeUrl: url,
      subdomain: fullDomain,
    });

    console.log(`✅ Store created successfully: ${url}`);

    return {
      success: true,
      storeUrl: url,
      subdomain: fullDomain,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to create store: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Example 3: Bulk Store Migration
 * Migrate existing tenants to use the domain service
 */
export async function bulkMigrateStores(tenants: Array<{
  tenantId: string;
  tenantSlug: string;
  companyName: string;
}>): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{ tenantId: string; success: boolean; error?: string }>;
}> {
  console.log(`🔄 Starting bulk migration of ${tenants.length} stores...`);

  const results: Array<{ tenantId: string; success: boolean; error?: string }> = [];
  let successful = 0;
  let failed = 0;

  for (const tenant of tenants) {
    try {
      console.log(`\n📍 Migrating: ${tenant.companyName}`);
      
      const result = await createTenantStore({
        ...tenant,
        email: '', // Email not needed for migration
      });

      if (result.success) {
        successful++;
        results.push({ tenantId: tenant.tenantId, success: true });
        console.log(`  ✅ Success: ${result.subdomain}`);
      } else {
        failed++;
        results.push({ 
          tenantId: tenant.tenantId, 
          success: false, 
          ...(result.error && { error: result.error })
        });
        console.log(`  ❌ Failed: ${result.error}`);
      }

      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({ 
        tenantId: tenant.tenantId, 
        success: false, 
        error: errorMessage 
      });
      console.log(`  ❌ Error: ${errorMessage}`);
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`  Total: ${tenants.length}`);
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);

  return {
    total: tenants.length,
    successful,
    failed,
    results,
  };
}

/**
 * Example 4: Check subdomain availability during signup
 */
export async function checkSubdomainAvailability(
  subdomain: string
): Promise<{
  available: boolean;
  fullDomain?: string;
  suggestions?: string[];
}> {
  const domainServiceUrl = process.env.DOMAIN_SERVICE_URL;
  
  if (!domainServiceUrl) {
    throw new Error('DOMAIN_SERVICE_URL environment variable is not set');
  }

  const response = await fetch(`${domainServiceUrl}/api/subdomains/check-availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subdomain }),
  });

  const result = await response.json() as any;

  if (result.success) {
    return {
      available: result.data.available,
      fullDomain: result.data.fullDomain,
      ...(!result.data.available && { suggestions: generateSubdomainSuggestions(subdomain) }),
    };
  }

  throw new Error('Failed to check subdomain availability');
}

/**
 * Example 5: Update store subdomain
 */
export async function updateStoreSubdomain(
  tenantId: string,
  newSubdomain: string
): Promise<{ success: boolean; newUrl?: string; error?: string }> {
  const domainServiceUrl = process.env.DOMAIN_SERVICE_URL;
  
  if (!domainServiceUrl) {
    throw new Error('DOMAIN_SERVICE_URL environment variable is not set');
  }

  try {
    // Check availability first
    const availabilityCheck = await checkSubdomainAvailability(newSubdomain);
    if (!availabilityCheck.available) {
      return {
        success: false,
        error: 'Subdomain is not available',
      };
    }

    // Update subdomain
    const response = await fetch(`${domainServiceUrl}/api/subdomains`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        newSubdomain,
      }),
    });

    const result = await response.json() as any;

    if (result.success) {
      // Update in your database
      await updateStoreConfiguration(tenantId, {
        subdomain: result.data.fullDomain,
        storeUrl: result.data.url,
      });

      return {
        success: true,
        newUrl: result.data.url,
      };
    }

    return {
      success: false,
      error: result.error || 'Failed to update subdomain',
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Example 6: Delete store (cleanup)
 */
export async function deleteStore(tenantId: string): Promise<boolean> {
  const domainServiceUrl = process.env.DOMAIN_SERVICE_URL;
  
  if (!domainServiceUrl) {
    throw new Error('DOMAIN_SERVICE_URL environment variable is not set');
  }

  try {
    console.log(`🗑️  Deleting store for tenant: ${tenantId}`);

    // Delete subdomain from Domain Service
    const response = await fetch(`${domainServiceUrl}/api/subdomains`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId }),
    });

    const result = await response.json() as any;

    if (result.success) {
      // Clean up your database
      await deleteStoreConfiguration(tenantId);
      console.log('✅ Store deleted successfully');
      return true;
    }

    console.error('❌ Failed to delete store:', result.error);
    return false;

  } catch (error) {
    console.error('❌ Error deleting store:', error);
    return false;
  }
}

/**
 * Example 7: Health monitoring integration
 */
export async function monitorDomainServiceHealth(): Promise<{
  healthy: boolean;
  checks: any;
  metrics: any;
}> {
  const domainServiceUrl = process.env.DOMAIN_SERVICE_URL;
  
  if (!domainServiceUrl) {
    throw new Error('DOMAIN_SERVICE_URL environment variable is not set');
  }

  try {
    const response = await fetch(`${domainServiceUrl}/api/health`);
    const result = await response.json() as any;

    if (result.success) {
      return {
        healthy: result.data?.status === 'healthy',
        checks: result.data?.checks || {},
        metrics: result.data?.metrics || {},
      };
    }

    return {
      healthy: false,
      checks: {},
      metrics: {},
    };

  } catch (error) {
    console.error('❌ Health check failed:', error);
    return {
      healthy: false,
      checks: {},
      metrics: {},
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS (implement these based on your platform)
// ============================================================================

async function saveStoreConfiguration(config: any): Promise<void> {
  // TODO: Implement database save
  console.log('  💾 Saving to database:', config.subdomain);
}

async function initializeStoreData(tenantId: string): Promise<void> {
  // TODO: Initialize store products, settings, templates, etc.
  console.log('  🎨 Initializing store data');
}

async function sendWelcomeEmail(email: string, data: any): Promise<void> {
  // TODO: Implement email sending
  console.log('  📧 Sending welcome email to:', email);
}

async function updateStoreConfiguration(tenantId: string, updates: any): Promise<void> {
  // TODO: Implement database update
  console.log('  💾 Updating store configuration');
}

async function deleteStoreConfiguration(tenantId: string): Promise<void> {
  // TODO: Implement database deletion
  console.log('  🗑️  Deleting store configuration');
}

function generateSubdomainSuggestions(subdomain: string): string[] {
  const year = new Date().getFullYear();
  return [
    `${subdomain}${year}`,
    `${subdomain}-store`,
    `${subdomain}-shop`,
    `my-${subdomain}`,
    `${subdomain}-online`,
  ];
}

// ============================================================================
// WEBHOOKS & EVENTS
// ============================================================================

/**
 * Example webhook handler for store events
 */
export async function handleStoreWebhook(event: {
  type: string;
  tenantId: string;
  data: any;
}): Promise<void> {
  switch (event.type) {
    case 'store.created':
      console.log(`📢 Store created: ${event.data.subdomain}`);
      // Send notifications, track analytics, etc.
      break;

    case 'store.updated':
      console.log(`📢 Store updated: ${event.data.subdomain}`);
      break;

    case 'store.deleted':
      console.log(`📢 Store deleted: ${event.tenantId}`);
      break;

    default:
      console.log(`📢 Unknown event: ${event.type}`);
  }
}

// ============================================================================
// SCHEDULED TASKS
// ============================================================================

/**
 * Daily health check of all stores
 */
export async function dailyStoreHealthCheck(): Promise<void> {
  console.log('🏥 Running daily store health check...');

  const health = await monitorDomainServiceHealth();
  
  if (!health.healthy) {
    console.error('❌ Domain service is unhealthy!');
    // Send alerts to operations team
    await sendAlert({
      type: 'critical',
      service: 'domain-service',
      message: 'Domain service health check failed',
      checks: health.checks,
    });
  }

  console.log('✅ Health check complete');
}

async function sendAlert(alert: any): Promise<void> {
  // TODO: Implement alerting (Slack, PagerDuty, email, etc.)
  console.error('🚨 ALERT:', alert.message);
}

// ============================================================================
// EXPORT FOR USE IN YOUR PLATFORM
// ============================================================================

export default {
  // Setup
  initialDomainServiceSetup,
  
  // Store Management
  createTenantStore,
  updateStoreSubdomain,
  deleteStore,
  bulkMigrateStores,
  
  // Validation
  checkSubdomainAvailability,
  
  // Monitoring
  monitorDomainServiceHealth,
  dailyStoreHealthCheck,
  
  // Webhooks
  handleStoreWebhook,
};

