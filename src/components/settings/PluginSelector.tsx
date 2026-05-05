/**
 * Plugin Selector Component
 * Dynamically loads the appropriate settings plugin based on restaurant type and region
 */

import { useRestaurantSettingsStore } from '@/stores/restaurantSettingsStore';
import { RestaurantType } from '@/types/restaurantTypes';

// Import all plugin components directly
import { RestaurantSettings as IndiaFullService } from '../../../plugins/settings-india-full-service/src/components/RestaurantSettings';
import { RestaurantSettings as IndiaQuickService } from '../../../plugins/settings-india-quick-service/src/components/RestaurantSettings';
import { RestaurantSettings as IndiaCloudKitchen } from '../../../plugins/settings-india-cloud-kitchen/src/components/RestaurantSettings';
import { RestaurantSettings as IndiaCafe } from '../../../plugins/settings-india-cafe/src/components/RestaurantSettings';
import { RestaurantSettings as USAFullService } from '../../../plugins/settings-usa-full-service/src/components/RestaurantSettings';

// Fallback to legacy component only as last resort
import { RestaurantSettingsInline } from '../admin/RestaurantSettingsInline';

/**
 * Plugin registry mapping restaurant types and regions to components
 */
const PLUGIN_REGISTRY = {
  // India plugins - All use new plugin architecture
  'india-full-service': IndiaFullService,
  'india-quick-service': IndiaQuickService,
  'india-cloud-kitchen': IndiaCloudKitchen,
  'india-cafe': IndiaCafe,

  // USA plugins
  'usa-full-service': USAFullService,

  // Add more as needed
  // 'uk-full-service': UKFullService,
  // 'india-multi-brand': IndiaMultiBrand,
};

/**
 * Map RestaurantType enum to plugin keys
 */
const getPluginKey = (type: RestaurantType, region: string): string => {
  const typeMap: Record<RestaurantType, string> = {
    [RestaurantType.FULL_SERVICE]: 'full-service',
    [RestaurantType.QUICK_SERVICE]: 'quick-service',
    [RestaurantType.CLOUD_KITCHEN]: 'cloud-kitchen',
    [RestaurantType.CAFE]: 'cafe',
    [RestaurantType.FINE_DINING]: 'full-service', // Use full-service plugin
    [RestaurantType.CASUAL_DINING]: 'full-service', // Use full-service plugin
    [RestaurantType.BAR_LOUNGE]: 'full-service', // Use full-service plugin
    [RestaurantType.FOOD_TRUCK]: 'quick-service', // Use QSR plugin
    [RestaurantType.BAKERY]: 'cafe', // Use cafe plugin
    [RestaurantType.MULTI_BRAND]: 'full-service', // Use full-service plugin
    [RestaurantType.LARGE_CHAIN]: 'full-service', // Use full-service plugin
  };

  const mappedType = typeMap[type] || 'full-service';
  return `${region.toLowerCase()}-${mappedType}`;
};

/**
 * Detect region from settings or default to India
 */
const detectRegion = (settings: any): string => {
  // Check if country code is set
  if (settings.countryCode) {
    const countryToRegion: Record<string, string> = {
      'IN': 'india',
      'US': 'usa',
      'GB': 'uk',
      'CA': 'usa', // Use USA plugin for Canada (similar tax system)
      'AU': 'usa', // Use USA plugin for Australia
      'AE': 'india', // Use India plugin for UAE temporarily
      // Add more mappings as needed
    };
    return countryToRegion[settings.countryCode] || 'india';
  }

  // Default to India
  return 'india';
};

/**
 * PluginSelector Component
 * Selects and renders the appropriate settings plugin
 */
export function PluginSelector() {
  const { settings } = useRestaurantSettingsStore();

  // Determine restaurant type and region
  // Default to FULL_SERVICE on first startup (no chicken-and-egg problem)
  const restaurantType = (settings.restaurantType as RestaurantType) || RestaurantType.FULL_SERVICE;
  const region = detectRegion(settings);

  // Get plugin key
  const pluginKey = getPluginKey(restaurantType, region);

  // Get component from registry
  let PluginComponent = PLUGIN_REGISTRY[pluginKey as keyof typeof PLUGIN_REGISTRY];

  // If plugin not found, try to fallback to full-service variant of same region
  if (!PluginComponent) {
    const fallbackKey = `${region}-full-service`;
    PluginComponent = PLUGIN_REGISTRY[fallbackKey as keyof typeof PLUGIN_REGISTRY];

    if (PluginComponent) {
      console.log(`[PluginSelector] Plugin ${pluginKey} not found, falling back to ${fallbackKey}`);
    } else {
      // Last resort: use India Full Service plugin as universal default
      console.warn(`[PluginSelector] No plugin found for key: ${pluginKey} or fallback ${fallbackKey}, using India Full Service as default`);
      PluginComponent = IndiaFullService;
    }
  } else {
    console.log(`[PluginSelector] Loading plugin: ${pluginKey} for ${restaurantType} in ${region}`);
  }

  return <PluginComponent />;
}
