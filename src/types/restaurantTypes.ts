import { Store, Utensils, Coffee, Truck, Beer, Building2, Network, Warehouse } from 'lucide-react';

/**
 * Restaurant Type Classification
 * Determines the operational model and feature requirements
 */
export enum RestaurantType {
  FULL_SERVICE = 'full-service',           // Traditional dine-in restaurant with table service
  CAFE_BAKERY = 'cafe-bakery',             // Cafe or bakery with counter service
  DARK_KITCHEN = 'dark-kitchen',           // Cloud kitchen - delivery only, no dine-in
  BAR_LOUNGE = 'bar-lounge',               // Bar or lounge with drink focus
  QSR_FAST_FOOD = 'qsr-fast-food',         // Quick service restaurant
  FOOD_TRUCK = 'food-truck',               // Mobile food service
  MULTI_BRAND = 'multi-brand',             // Multiple brands under single owner
  LARGE_CHAIN = 'large-chain',             // 10+ locations with centralized operations
}

/**
 * Operational Scale
 */
export enum OperationalScale {
  SINGLE_LOCATION = 'single-location',
  MULTI_LOCATION = 'multi-location',       // 2-9 locations
  LARGE_CHAIN = 'large-chain',             // 10+ locations
}

/**
 * Feature configuration for a restaurant
 */
export interface RestaurantFeatures {
  // Core Operational Features
  tableService: boolean;                    // Enable table/floor plan management
  takeawayOrders: boolean;                  // Enable takeaway/pickup orders
  dineIn: boolean;                          // Enable dine-in service
  delivery: boolean;                        // Enable delivery orders

  // Channel Features
  onlineOrders: boolean;                    // Enable online ordering integration
  aggregatorIntegration: boolean;           // Enable Swiggy/Zomato integration
  qrOrdering: boolean;                      // Enable QR code table ordering

  // Specialized Features
  barManagement: boolean;                   // Enable bar inventory, recipes, closing workflows
  chainManagement: boolean;                 // Enable chain/multi-location management
  kitchenDisplay: boolean;                  // Enable KDS (Kitchen Display System)

  // Management Features
  inventoryManagement: boolean;             // Enable full inventory tracking
  staffManagement: boolean;                 // Enable staff roster, attendance, payroll
  customerManagement: boolean;              // Enable customer database and loyalty
  advancedReports: boolean;                 // Enable detailed analytics and reports
  multiCurrencySupport: boolean;            // Enable multi-currency pricing
}

/**
 * Restaurant type metadata for UI display
 */
export interface RestaurantTypeConfig {
  type: RestaurantType;
  label: string;
  description: string;
  icon: any;
  defaultScale: OperationalScale;
  featurePreset: RestaurantFeatures;
  setupPriority: string[];                  // Order of setup steps to show
}

/**
 * Feature Presets for each restaurant type
 */
export const RESTAURANT_TYPE_CONFIGS: Record<RestaurantType, RestaurantTypeConfig> = {
  [RestaurantType.FULL_SERVICE]: {
    type: RestaurantType.FULL_SERVICE,
    label: 'Full-Service Restaurant',
    description: 'Traditional dine-in restaurant with table service, waiters, and complete POS',
    icon: Utensils,
    defaultScale: OperationalScale.SINGLE_LOCATION,
    featurePreset: {
      tableService: true,
      takeawayOrders: true,
      dineIn: true,
      delivery: true,
      onlineOrders: true,
      aggregatorIntegration: true,
      qrOrdering: true,
      barManagement: false,
      chainManagement: false,
      kitchenDisplay: true,
      inventoryManagement: true,
      staffManagement: true,
      customerManagement: true,
      advancedReports: true,
      multiCurrencySupport: false,
    },
    setupPriority: ['details', 'features', 'floor-plan', 'menu', 'staff', 'payments'],
  },

  [RestaurantType.CAFE_BAKERY]: {
    type: RestaurantType.CAFE_BAKERY,
    label: 'Cafe / Bakery',
    description: 'Counter service cafe or bakery with takeaway focus and minimal table seating',
    icon: Coffee,
    defaultScale: OperationalScale.SINGLE_LOCATION,
    featurePreset: {
      tableService: false,
      takeawayOrders: true,
      dineIn: true,
      delivery: true,
      onlineOrders: true,
      aggregatorIntegration: true,
      qrOrdering: false,
      barManagement: false,
      chainManagement: false,
      kitchenDisplay: false,
      inventoryManagement: true,
      staffManagement: false,
      customerManagement: true,
      advancedReports: false,
      multiCurrencySupport: false,
    },
    setupPriority: ['details', 'menu', 'payments', 'features'],
  },

  [RestaurantType.DARK_KITCHEN]: {
    type: RestaurantType.DARK_KITCHEN,
    label: 'Dark Kitchen / Cloud Kitchen',
    description: 'Delivery-only kitchen with no dine-in. Manages aggregator orders only',
    icon: Warehouse,
    defaultScale: OperationalScale.SINGLE_LOCATION,
    featurePreset: {
      tableService: false,
      takeawayOrders: false,
      dineIn: false,
      delivery: true,
      onlineOrders: false,
      aggregatorIntegration: true,
      qrOrdering: false,
      barManagement: false,
      chainManagement: false,
      kitchenDisplay: true,
      inventoryManagement: true,
      staffManagement: true,
      customerManagement: false,
      advancedReports: true,
      multiCurrencySupport: false,
    },
    setupPriority: ['details', 'menu', 'aggregators', 'staff'],
  },

  [RestaurantType.BAR_LOUNGE]: {
    type: RestaurantType.BAR_LOUNGE,
    label: 'Bar / Lounge',
    description: 'Bar or lounge with drink focus, bar inventory management, and optional food service',
    icon: Beer,
    defaultScale: OperationalScale.SINGLE_LOCATION,
    featurePreset: {
      tableService: true,
      takeawayOrders: false,
      dineIn: true,
      delivery: false,
      onlineOrders: false,
      aggregatorIntegration: false,
      qrOrdering: true,
      barManagement: true,
      chainManagement: false,
      kitchenDisplay: false,
      inventoryManagement: true,
      staffManagement: true,
      customerManagement: true,
      advancedReports: true,
      multiCurrencySupport: false,
    },
    setupPriority: ['details', 'features', 'bar-setup', 'floor-plan', 'menu', 'staff', 'payments'],
  },

  [RestaurantType.QSR_FAST_FOOD]: {
    type: RestaurantType.QSR_FAST_FOOD,
    label: 'QSR / Fast Food',
    description: 'Quick service restaurant with counter ordering and fast-paced operations',
    icon: Store,
    defaultScale: OperationalScale.SINGLE_LOCATION,
    featurePreset: {
      tableService: false,
      takeawayOrders: true,
      dineIn: true,
      delivery: true,
      onlineOrders: true,
      aggregatorIntegration: true,
      qrOrdering: false,
      barManagement: false,
      chainManagement: false,
      kitchenDisplay: true,
      inventoryManagement: true,
      staffManagement: true,
      customerManagement: true,
      advancedReports: true,
      multiCurrencySupport: false,
    },
    setupPriority: ['details', 'menu', 'payments', 'staff', 'features'],
  },

  [RestaurantType.FOOD_TRUCK]: {
    type: RestaurantType.FOOD_TRUCK,
    label: 'Food Truck / Mobile',
    description: 'Mobile food service with simplified menu and minimal inventory',
    icon: Truck,
    defaultScale: OperationalScale.SINGLE_LOCATION,
    featurePreset: {
      tableService: false,
      takeawayOrders: true,
      dineIn: false,
      delivery: false,
      onlineOrders: false,
      aggregatorIntegration: false,
      qrOrdering: false,
      barManagement: false,
      chainManagement: false,
      kitchenDisplay: false,
      inventoryManagement: false,
      staffManagement: false,
      customerManagement: false,
      advancedReports: false,
      multiCurrencySupport: false,
    },
    setupPriority: ['details', 'menu', 'payments'],
  },

  [RestaurantType.MULTI_BRAND]: {
    type: RestaurantType.MULTI_BRAND,
    label: 'Multi-Brand Owner',
    description: 'Multiple restaurant brands under single ownership with independent operations',
    icon: Building2,
    defaultScale: OperationalScale.MULTI_LOCATION,
    featurePreset: {
      tableService: true,
      takeawayOrders: true,
      dineIn: true,
      delivery: true,
      onlineOrders: true,
      aggregatorIntegration: true,
      qrOrdering: true,
      barManagement: false,
      chainManagement: true,
      kitchenDisplay: true,
      inventoryManagement: true,
      staffManagement: true,
      customerManagement: true,
      advancedReports: true,
      multiCurrencySupport: false,
    },
    setupPriority: ['details', 'features', 'brands', 'menu', 'staff', 'payments'],
  },

  [RestaurantType.LARGE_CHAIN]: {
    type: RestaurantType.LARGE_CHAIN,
    label: 'Large Chain (10+ locations)',
    description: 'Enterprise chain with centralized menu, pricing, and multi-location management',
    icon: Network,
    defaultScale: OperationalScale.LARGE_CHAIN,
    featurePreset: {
      tableService: true,
      takeawayOrders: true,
      dineIn: true,
      delivery: true,
      onlineOrders: true,
      aggregatorIntegration: true,
      qrOrdering: true,
      barManagement: false,
      chainManagement: true,
      kitchenDisplay: true,
      inventoryManagement: true,
      staffManagement: true,
      customerManagement: true,
      advancedReports: true,
      multiCurrencySupport: true,
    },
    setupPriority: ['details', 'features', 'chain-setup', 'locations', 'menu', 'staff', 'payments'],
  },
};

/**
 * Get feature preset for a restaurant type
 */
export function getFeaturePreset(type: RestaurantType): RestaurantFeatures {
  return { ...RESTAURANT_TYPE_CONFIGS[type].featurePreset };
}

/**
 * Get setup priority steps for a restaurant type
 */
export function getSetupPriority(type: RestaurantType): string[] {
  return [...RESTAURANT_TYPE_CONFIGS[type].setupPriority];
}

/**
 * Check if a feature is recommended for a restaurant type
 */
export function isFeatureRecommended(type: RestaurantType, feature: keyof RestaurantFeatures): boolean {
  return RESTAURANT_TYPE_CONFIGS[type].featurePreset[feature];
}

/**
 * Get restaurant type configuration
 */
export function getRestaurantTypeConfig(type: RestaurantType): RestaurantTypeConfig {
  return RESTAURANT_TYPE_CONFIGS[type];
}

/**
 * Settings Criticality Levels
 * Determines how important a setting is for a specific restaurant type
 */
export enum SettingCriticality {
  CRITICAL = 'critical',      // Must be configured (orange badge)
  RECOMMENDED = 'recommended', // Should be configured (blue badge)
  OPTIONAL = 'optional',       // Nice to have (no badge)
  HIDDEN = 'hidden',          // Not applicable for this type (don't show)
}

/**
 * Settings criticality configuration for each restaurant type
 */
export interface RestaurantTypeSettingsCriticality {
  tabs: {
    basics: SettingCriticality;
    legal: SettingCriticality;
    invoice: SettingCriticality;
    tax: SettingCriticality;
    print: SettingCriticality;
    staff: SettingCriticality;
    appearance: SettingCriticality;
  };
  fields: {
    ownerName: SettingCriticality;
    tagline: SettingCriticality;
    email: SettingCriticality;
    gstNumber: SettingCriticality;
    fssaiNumber: SettingCriticality;
    panNumber: SettingCriticality;
    taxEnabled: SettingCriticality;
    serviceCharge: SettingCriticality;
    printLogo: SettingCriticality;
    qrCode: SettingCriticality;
    staffPin: SettingCriticality;
    tableFiltering: SettingCriticality;
  };
}

/**
 * Settings criticality matrix for all restaurant types
 */
export const SETTINGS_CRITICALITY: Record<RestaurantType, RestaurantTypeSettingsCriticality> = {
  [RestaurantType.FULL_SERVICE]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.RECOMMENDED,
      invoice: SettingCriticality.RECOMMENDED,
      tax: SettingCriticality.CRITICAL,
      print: SettingCriticality.RECOMMENDED,
      staff: SettingCriticality.CRITICAL,
      appearance: SettingCriticality.OPTIONAL,
    },
    fields: {
      ownerName: SettingCriticality.RECOMMENDED,
      tagline: SettingCriticality.OPTIONAL,
      email: SettingCriticality.RECOMMENDED,
      gstNumber: SettingCriticality.CRITICAL,
      fssaiNumber: SettingCriticality.CRITICAL,
      panNumber: SettingCriticality.RECOMMENDED,
      taxEnabled: SettingCriticality.CRITICAL,
      serviceCharge: SettingCriticality.OPTIONAL,
      printLogo: SettingCriticality.RECOMMENDED,
      qrCode: SettingCriticality.RECOMMENDED,
      staffPin: SettingCriticality.RECOMMENDED,
      tableFiltering: SettingCriticality.RECOMMENDED,
    },
  },

  [RestaurantType.CAFE_BAKERY]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.RECOMMENDED,
      invoice: SettingCriticality.OPTIONAL,
      tax: SettingCriticality.CRITICAL,
      print: SettingCriticality.RECOMMENDED,
      staff: SettingCriticality.OPTIONAL,
      appearance: SettingCriticality.OPTIONAL,
    },
    fields: {
      ownerName: SettingCriticality.OPTIONAL,
      tagline: SettingCriticality.RECOMMENDED,
      email: SettingCriticality.RECOMMENDED,
      gstNumber: SettingCriticality.CRITICAL,
      fssaiNumber: SettingCriticality.CRITICAL,
      panNumber: SettingCriticality.RECOMMENDED,
      taxEnabled: SettingCriticality.CRITICAL,
      serviceCharge: SettingCriticality.HIDDEN,
      printLogo: SettingCriticality.RECOMMENDED,
      qrCode: SettingCriticality.OPTIONAL,
      staffPin: SettingCriticality.OPTIONAL,
      tableFiltering: SettingCriticality.HIDDEN,
    },
  },

  [RestaurantType.DARK_KITCHEN]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.RECOMMENDED,
      invoice: SettingCriticality.OPTIONAL,
      tax: SettingCriticality.CRITICAL,
      print: SettingCriticality.HIDDEN,
      staff: SettingCriticality.HIDDEN,
      appearance: SettingCriticality.HIDDEN,
    },
    fields: {
      ownerName: SettingCriticality.RECOMMENDED,
      tagline: SettingCriticality.HIDDEN,
      email: SettingCriticality.CRITICAL,
      gstNumber: SettingCriticality.CRITICAL,
      fssaiNumber: SettingCriticality.CRITICAL,
      panNumber: SettingCriticality.RECOMMENDED,
      taxEnabled: SettingCriticality.CRITICAL,
      serviceCharge: SettingCriticality.HIDDEN,
      printLogo: SettingCriticality.HIDDEN,
      qrCode: SettingCriticality.HIDDEN,
      staffPin: SettingCriticality.HIDDEN,
      tableFiltering: SettingCriticality.HIDDEN,
    },
  },

  [RestaurantType.BAR_LOUNGE]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.CRITICAL,
      invoice: SettingCriticality.RECOMMENDED,
      tax: SettingCriticality.CRITICAL,
      print: SettingCriticality.RECOMMENDED,
      staff: SettingCriticality.CRITICAL,
      appearance: SettingCriticality.OPTIONAL,
    },
    fields: {
      ownerName: SettingCriticality.RECOMMENDED,
      tagline: SettingCriticality.OPTIONAL,
      email: SettingCriticality.RECOMMENDED,
      gstNumber: SettingCriticality.CRITICAL,
      fssaiNumber: SettingCriticality.RECOMMENDED,
      panNumber: SettingCriticality.RECOMMENDED,
      taxEnabled: SettingCriticality.CRITICAL,
      serviceCharge: SettingCriticality.RECOMMENDED,
      printLogo: SettingCriticality.RECOMMENDED,
      qrCode: SettingCriticality.RECOMMENDED,
      staffPin: SettingCriticality.CRITICAL,
      tableFiltering: SettingCriticality.RECOMMENDED,
    },
  },

  [RestaurantType.QSR_FAST_FOOD]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.RECOMMENDED,
      invoice: SettingCriticality.OPTIONAL,
      tax: SettingCriticality.CRITICAL,
      print: SettingCriticality.RECOMMENDED,
      staff: SettingCriticality.RECOMMENDED,
      appearance: SettingCriticality.OPTIONAL,
    },
    fields: {
      ownerName: SettingCriticality.OPTIONAL,
      tagline: SettingCriticality.RECOMMENDED,
      email: SettingCriticality.RECOMMENDED,
      gstNumber: SettingCriticality.CRITICAL,
      fssaiNumber: SettingCriticality.CRITICAL,
      panNumber: SettingCriticality.RECOMMENDED,
      taxEnabled: SettingCriticality.CRITICAL,
      serviceCharge: SettingCriticality.HIDDEN,
      printLogo: SettingCriticality.RECOMMENDED,
      qrCode: SettingCriticality.OPTIONAL,
      staffPin: SettingCriticality.OPTIONAL,
      tableFiltering: SettingCriticality.HIDDEN,
    },
  },

  [RestaurantType.FOOD_TRUCK]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.OPTIONAL,
      invoice: SettingCriticality.OPTIONAL,
      tax: SettingCriticality.RECOMMENDED,
      print: SettingCriticality.OPTIONAL,
      staff: SettingCriticality.HIDDEN,
      appearance: SettingCriticality.HIDDEN,
    },
    fields: {
      ownerName: SettingCriticality.OPTIONAL,
      tagline: SettingCriticality.RECOMMENDED,
      email: SettingCriticality.OPTIONAL,
      gstNumber: SettingCriticality.RECOMMENDED,
      fssaiNumber: SettingCriticality.RECOMMENDED,
      panNumber: SettingCriticality.OPTIONAL,
      taxEnabled: SettingCriticality.RECOMMENDED,
      serviceCharge: SettingCriticality.HIDDEN,
      printLogo: SettingCriticality.OPTIONAL,
      qrCode: SettingCriticality.HIDDEN,
      staffPin: SettingCriticality.HIDDEN,
      tableFiltering: SettingCriticality.HIDDEN,
    },
  },

  [RestaurantType.MULTI_BRAND]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.CRITICAL,
      invoice: SettingCriticality.RECOMMENDED,
      tax: SettingCriticality.CRITICAL,
      print: SettingCriticality.RECOMMENDED,
      staff: SettingCriticality.CRITICAL,
      appearance: SettingCriticality.OPTIONAL,
    },
    fields: {
      ownerName: SettingCriticality.CRITICAL,
      tagline: SettingCriticality.OPTIONAL,
      email: SettingCriticality.CRITICAL,
      gstNumber: SettingCriticality.CRITICAL,
      fssaiNumber: SettingCriticality.CRITICAL,
      panNumber: SettingCriticality.CRITICAL,
      taxEnabled: SettingCriticality.CRITICAL,
      serviceCharge: SettingCriticality.OPTIONAL,
      printLogo: SettingCriticality.RECOMMENDED,
      qrCode: SettingCriticality.RECOMMENDED,
      staffPin: SettingCriticality.CRITICAL,
      tableFiltering: SettingCriticality.RECOMMENDED,
    },
  },

  [RestaurantType.LARGE_CHAIN]: {
    tabs: {
      basics: SettingCriticality.CRITICAL,
      legal: SettingCriticality.CRITICAL,
      invoice: SettingCriticality.CRITICAL,
      tax: SettingCriticality.CRITICAL,
      print: SettingCriticality.CRITICAL,
      staff: SettingCriticality.CRITICAL,
      appearance: SettingCriticality.OPTIONAL,
    },
    fields: {
      ownerName: SettingCriticality.CRITICAL,
      tagline: SettingCriticality.OPTIONAL,
      email: SettingCriticality.CRITICAL,
      gstNumber: SettingCriticality.CRITICAL,
      fssaiNumber: SettingCriticality.CRITICAL,
      panNumber: SettingCriticality.CRITICAL,
      taxEnabled: SettingCriticality.CRITICAL,
      serviceCharge: SettingCriticality.OPTIONAL,
      printLogo: SettingCriticality.CRITICAL,
      qrCode: SettingCriticality.RECOMMENDED,
      staffPin: SettingCriticality.CRITICAL,
      tableFiltering: SettingCriticality.CRITICAL,
    },
  },
};

/**
 * Get setting criticality for a specific restaurant type
 */
export function getSettingCriticality(
  type: RestaurantType,
  category: 'tabs' | 'fields',
  key: string
): SettingCriticality {
  const config = SETTINGS_CRITICALITY[type];
  if (!config) return SettingCriticality.OPTIONAL;

  const categoryConfig = config[category] as any;
  return categoryConfig?.[key] || SettingCriticality.OPTIONAL;
}
