/**
 * Tenant Provisioning Service
 * Mirrors the Tenant KV metadata structure from the backend
 * Stores tenant data locally in SQLite
 */

import { initDatabase } from '../lib/database';

/**
 * Comprehensive restaurant/food business categories
 * Covers all types of food service establishments
 */
export type BusinessCategory =
  | 'QUICK_SERVICE_RESTAURANT'     // QSR / Fast Food (e.g., McDonald's, Subway)
  | 'FAST_CASUAL'                  // Higher-quality quick service (e.g., Chipotle, Sweetgreen)
  | 'CASUAL_DINING'                // Mid-range with table service (e.g., Applebee's, Chili's)
  | 'FINE_DINING'                  // Upscale, full-service gourmet (white-tablecloth experience)
  | 'CAFE'                         // Coffee shops, light meals, pastries
  | 'BAKERY'                       // Primarily baked goods, cakes, bread
  | 'CLOUD_KITCHEN'                // Delivery-only / ghost kitchen
  | 'VIRTUAL_KITCHEN'              // Multiple brands from one kitchen
  | 'FOOD_TRUCK'                   // Mobile street food
  | 'STREET_FOOD_VENDOR'           // Fixed or semi-fixed street stalls/kiosks
  | 'BAR_PUB'                      // Primarily drinks, but serves food
  | 'LOUNGE'                       // Nightlife + food
  | 'BUFFET'                       // All-you-can-eat style
  | 'FAMILY_STYLE'                 // Large-portion shared dishes
  | 'BISTRO'                       // Small, casual European-style
  | 'DINER'                        // Classic American-style 24/7 casual
  | 'CAFETERIA'                    // Institutional or self-service buffet
  | 'ICE_CREAM_PARLOR'             // Desserts, gelato, frozen yogurt focus
  | 'JUICE_SMOOTHIE_BAR'           // Healthy drinks & light bites
  | 'DESSERT_SHOP'                 // Sweets-focused (waffles, crepes, donuts)
  | 'SPECIALTY_FOOD'               // Niche (vegan, keto, organic, halal, kosher, gluten-free)
  | 'ETHNIC_RESTAURANT'            // Cuisine-specific (Italian, Chinese, Mexican, etc.)
  | 'OTHER';                       // Catch-all for anything not fitting above

export interface TenantMetadata {
  tenantId: string;
  companyName: string;
  email: string;
  phone: string;
  businessCategory: BusinessCategory;
  subdomain: string;
  activationCode: string;
  status: 'PROVISIONED' | 'ACTIVE' | 'SUSPENDED';

  // Cloudflare storage resources (provisioned by backend)
  cloudflareResources?: {
    kvNamespaceId?: string;      // KV namespace ID for tenant data
    kvCacheId?: string;          // KV namespace ID for cache
    kvSessionsId?: string;       // KV namespace ID for sessions
    r2BucketName?: string;        // R2 bucket name for images/files
    d1DatabaseId?: string;        // D1 database ID for tenant data
    d1DatabaseName?: string;      // D1 database name
  };

  // Restaurant details (filled later via Google Places or manual entry)
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  cuisine?: string[];
  description?: string;
  website?: string;

  // Setup progress tracking
  setupProgress: {
    provisioned: boolean;
    menuUploaded: boolean;
    photosUploaded: boolean;
    detailsCompleted: boolean;
    staffAdded: boolean;
    testOrderCompleted: boolean;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
}

/**
 * Store provisioned tenant data locally
 */
export async function storeTenantMetadata(metadata: Partial<TenantMetadata>): Promise<void> {
  const db = await initDatabase();

  const now = new Date().toISOString();
  const tenantData: TenantMetadata = {
    tenantId: metadata.tenantId || '',
    companyName: metadata.companyName || '',
    email: metadata.email || '',
    phone: metadata.phone || '',
    businessCategory: metadata.businessCategory || 'CASUAL_DINING',
    subdomain: metadata.subdomain || metadata.tenantId || '',
    activationCode: metadata.activationCode || '',
    status: metadata.status || 'PROVISIONED',
    setupProgress: metadata.setupProgress || {
      provisioned: true,
      menuUploaded: false,
      photosUploaded: false,
      detailsCompleted: false,
      staffAdded: false,
      testOrderCompleted: false,
    },
    createdAt: metadata.createdAt || now,
    updatedAt: now,
    activatedAt: metadata.activatedAt,
  };

  // Store in restaurant_settings table (leveraging existing table)
  await db.execute(
    `INSERT OR REPLACE INTO restaurant_settings
     (key, value)
     VALUES ('tenant_metadata', $1)`,
    [JSON.stringify(tenantData)]
  );

  console.log('[TenantProvisioning] Stored tenant metadata:', tenantData);
}

/**
 * Get tenant metadata from local storage
 */
export async function getTenantMetadata(): Promise<TenantMetadata | null> {
  try {
    // DEPRECATED: This function uses old restaurant_settings key-value table structure
    // We now use the tenant_config table via Tauri commands (src-tauri/src/commands/tenant.rs)
    // Returning null to avoid SQL errors on fresh databases
    // TODO: Migrate ContextualSetupGuide to use new tenant_config table
    console.log('[TenantProvisioning] getTenantMetadata is deprecated, returning null');
    return null;

    /* OLD CODE - causes "no such column: value" error on fresh databases
    const db = await initDatabase();

    const result = await db.select<Array<{ value: string }>>(
      `SELECT value FROM restaurant_settings WHERE key = 'tenant_metadata'`
    );

    if (result.length === 0) {
      return null;
    }

    return JSON.parse(result[0].value) as TenantMetadata;
    */
  } catch (error) {
    console.error('[TenantProvisioning] Failed to get tenant metadata:', error);
    return null;
  }
}

/**
 * Update tenant setup progress
 */
export async function updateSetupProgress(
  progress: Partial<TenantMetadata['setupProgress']>
): Promise<void> {
  const metadata = await getTenantMetadata();
  if (!metadata) {
    throw new Error('Tenant metadata not found');
  }

  const updatedMetadata: TenantMetadata = {
    ...metadata,
    setupProgress: {
      ...metadata.setupProgress,
      ...progress,
    },
    updatedAt: new Date().toISOString(),
  };

  await storeTenantMetadata(updatedMetadata);
  console.log('[TenantProvisioning] Updated setup progress:', progress);
}

/**
 * Update restaurant details (from Google Places or manual entry)
 */
export async function updateRestaurantDetails(
  details: Partial<Pick<TenantMetadata,
    'address' | 'city' | 'state' | 'country' | 'postalCode' |
    'googlePlaceId' | 'googleMapsUrl' | 'cuisine' | 'description' | 'website'>>
): Promise<void> {
  const metadata = await getTenantMetadata();
  if (!metadata) {
    throw new Error('Tenant metadata not found');
  }

  const updatedMetadata: TenantMetadata = {
    ...metadata,
    ...details,
    setupProgress: {
      ...metadata.setupProgress,
      detailsCompleted: true,
    },
    updatedAt: new Date().toISOString(),
  };

  await storeTenantMetadata(updatedMetadata);
  console.log('[TenantProvisioning] Updated restaurant details:', details);
}

/**
 * Activate tenant (mark as active)
 */
export async function activateTenant(): Promise<void> {
  const metadata = await getTenantMetadata();
  if (!metadata) {
    throw new Error('Tenant metadata not found');
  }

  const updatedMetadata: TenantMetadata = {
    ...metadata,
    status: 'ACTIVE',
    activatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await storeTenantMetadata(updatedMetadata);
  console.log('[TenantProvisioning] Tenant activated');
}

/**
 * Get next recommended action based on setup progress
 */
export function getNextAction(metadata: TenantMetadata): {
  action: string;
  title: string;
  description: string;
  route: string;
  priority: 'high' | 'medium' | 'low';
} | null {
  const { setupProgress } = metadata;

  if (!setupProgress.menuUploaded) {
    return {
      action: 'upload_menu',
      title: 'Upload Your Menu',
      description: 'The most magical experience! Upload your menu as PDF, Excel, or photos and watch AI extract everything.',
      route: '/menu',
      priority: 'high',
    };
  }

  if (!setupProgress.photosUploaded) {
    return {
      action: 'upload_photos',
      title: 'Add Menu Photos',
      description: 'Bulk upload photos and let AI match them to your menu items by name.',
      route: '/images',
      priority: 'high',
    };
  }

  if (!setupProgress.detailsCompleted) {
    return {
      action: 'complete_details',
      title: 'Complete Restaurant Details',
      description: 'Add your address, cuisine type, and other details. Or just paste your Google Maps link!',
      route: '/settings',
      priority: 'medium',
    };
  }

  if (!setupProgress.staffAdded) {
    return {
      action: 'add_staff',
      title: 'Add Staff Members',
      description: 'Set up staff accounts for waiters, kitchen staff, and managers.',
      route: '/staff',
      priority: 'medium',
    };
  }

  if (!setupProgress.testOrderCompleted) {
    return {
      action: 'test_order',
      title: 'Take a Test Order',
      description: 'Try placing an order to see how everything works.',
      route: '/pos',
      priority: 'low',
    };
  }

  return null;
}

/**
 * Calculate setup completion percentage
 */
export function calculateSetupCompletion(metadata: TenantMetadata): number {
  const { setupProgress } = metadata;
  const steps = Object.values(setupProgress);
  const completed = steps.filter(Boolean).length;
  return Math.round((completed / steps.length) * 100);
}
