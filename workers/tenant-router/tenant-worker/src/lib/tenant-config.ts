/**
 * Tenant Configuration Management
 *
 * Handles tenant-specific business logic based on tenant type
 */

export type TenantType = 'RESTAURANT' | 'PHARMACY' | 'RETAIL' | 'GROCERY';

export interface TenantConfig {
  tenantId: string;
  tenantType: TenantType;
  features: {
    // Restaurant-specific
    tableManagement?: boolean;
    kitchenDisplay?: boolean;
    menuManagement?: boolean;
    reservations?: boolean;

    // Pharmacy-specific
    prescriptionManagement?: boolean;
    drugInventory?: boolean;
    medicationReminders?: boolean;

    // Retail/Grocery-specific
    inventoryTracking?: boolean;
    barcodeScanning?: boolean;
    supplierManagement?: boolean;

    // Common features
    orders?: boolean;
    customers?: boolean;
    payments?: boolean;
    analytics?: boolean;
  };
}

/**
 * Get tenant configuration from metadata
 */
export async function getTenantConfig(
  tenantId: string,
  tenantsDb?: D1Database,
  metadataKV?: KVNamespace
): Promise<TenantConfig> {
  // Try to fetch from KV first (faster)
  if (metadataKV) {
    try {
      const cached = await metadataKV.get(`tenant_config:${tenantId}`, 'json') as TenantConfig | null;
      if (cached) {
        console.log(`[TenantConfig] Loaded from KV cache: ${tenantId} (type: ${cached.tenantType})`);
        return cached;
      }
    } catch (error) {
      console.warn(`[TenantConfig] KV cache miss for ${tenantId}:`, error);
    }
  }

  // Fallback to database
  if (tenantsDb) {
    try {
      const result = await tenantsDb.prepare(
        'SELECT business_category FROM restaurant_tenants WHERE tenant_id = ?'
      ).bind(tenantId).first() as { business_category: string } | null;

      if (result) {
        const tenantType = result.business_category as TenantType || 'RESTAURANT';
        const config = buildDefaultConfig(tenantId, tenantType);

        // Cache for next time
        if (metadataKV) {
          await metadataKV.put(`tenant_config:${tenantId}`, JSON.stringify(config), {
            expirationTtl: 3600, // 1 hour cache
          });
        }

        console.log(`[TenantConfig] Loaded from DB: ${tenantId} (type: ${tenantType})`);
        return config;
      }
    } catch (error) {
      console.error(`[TenantConfig] Database error for ${tenantId}:`, error);
    }
  }

  // Ultimate fallback - assume restaurant
  console.warn(`[TenantConfig] No config found, using default for ${tenantId}`);
  return buildDefaultConfig(tenantId, 'RESTAURANT');
}

/**
 * Build default configuration based on tenant type
 */
function buildDefaultConfig(tenantId: string, tenantType: TenantType): TenantConfig {
  const baseFeatures = {
    orders: true,
    customers: true,
    payments: true,
    analytics: true,
  };

  switch (tenantType) {
    case 'RESTAURANT':
      return {
        tenantId,
        tenantType,
        features: {
          ...baseFeatures,
          tableManagement: true,
          kitchenDisplay: true,
          menuManagement: true,
          reservations: true,
        },
      };

    case 'PHARMACY':
      return {
        tenantId,
        tenantType,
        features: {
          ...baseFeatures,
          prescriptionManagement: true,
          drugInventory: true,
          medicationReminders: true,
        },
      };

    case 'RETAIL':
    case 'GROCERY':
      return {
        tenantId,
        tenantType,
        features: {
          ...baseFeatures,
          inventoryTracking: true,
          barcodeScanning: true,
          supplierManagement: true,
        },
      };

    default:
      return {
        tenantId,
        tenantType: 'RESTAURANT',
        features: baseFeatures,
      };
  }
}

/**
 * Check if a feature is enabled for the tenant
 */
export function isFeatureEnabled(config: TenantConfig, feature: keyof TenantConfig['features']): boolean {
  return config.features[feature] === true;
}
