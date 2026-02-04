/**
 * Build Configuration
 * Controls feature access based on build variant (Staff vs Owner)
 */

export type AppVariant = 'staff' | 'owner';
export type DeviceMode = 'owner' | 'pos' | 'kds' | 'bds' | 'aggregator' | 'customer' | 'manager';

export interface BuildConfig {
  variant: AppVariant;
  isStaffBuild: boolean;
  allowedModes: string[];
}

// Read from environment variables set at build time
const variant = (import.meta.env.VITE_APP_VARIANT || 'owner') as AppVariant;
const isStaffBuild = import.meta.env.VITE_STAFF_BUILD === 'true';
const allowedModesStr = import.meta.env.VITE_ALLOWED_MODES || 'owner,pos,kds,bds,aggregator,customer,manager';

export const buildConfig: BuildConfig = {
  variant,
  isStaffBuild,
  allowedModes: allowedModesStr.split(',').map(m => m.trim()),
};

// Helper functions
export const isFeatureEnabled = (feature: string): boolean => {
  if (!isStaffBuild) return true; // Owner build has all features

  const staffAllowedFeatures = [
    'pos', 'kds', 'bds', 'customer',
    'attendance', 'payroll-view', 'leave-request',
    'phone-ordering', 'service-dashboard'
  ];

  return staffAllowedFeatures.includes(feature);
};

/**
 * Check if a route is allowed based on build variant and user role
 * @param path - The route path to check
 * @param userRole - Optional user role for role-based checks
 * @returns true if route is allowed, false otherwise
 */
export const isRouteAllowed = (path: string, _userRole?: string): boolean => {
  if (!isStaffBuild) return true; // Owner build has all routes

  // Staff build restrictions - BLOCKED routes (owner and management features)
  const blockedRoutes = [
    '/settings',           // System settings, cloud sync, provisioning
    '/chain-management',   // Multi-location management
    '/user-management',    // User account management
    '/aggregator/settings',// Aggregator integrations
    '/image-management',   // Corporate image management
    '/plugins',            // Plugin management
    '/menu-management',    // Menu editing (BLOCKED in staff)
    '/inventory',          // Inventory management (BLOCKED in staff)
    '/sales-report',       // Sales reports (BLOCKED in staff)
    '/roster',             // Staff scheduling (BLOCKED in staff)
    '/scheduling',         // Shift planning (BLOCKED in staff)
  ];

  // Check if path starts with any blocked route
  if (blockedRoutes.some(route => path.startsWith(route))) {
    return false;
  }

  // Staff build allows these core self-service routes
  const staffAllowedRoutes = [
    '/attendance',  // Clock in/out, view own attendance
    '/payroll',     // View own payroll, tips, advances
    '/advances',    // Request salary advances
    '/hub',         // Home dashboard
    '/login',       // Login screen
  ];

  // Allow staff self-service routes
  if (staffAllowedRoutes.some(route => path.startsWith(route))) {
    return true;
  }

  // Settings-based optional routes (KDS/POS - checked in component based on role and settings)
  const optionalRoutes = ['/kds', '/pos', '/table-order', '/kitchen', '/aggregator'];

  if (optionalRoutes.some(route => path.startsWith(route))) {
    return true; // Role and settings will be checked in the component
  }

  // All other routes are allowed (e.g., /hub, /diagnostic, etc.)
  return true;
};

/**
 * Check if a navigation item should be visible based on build variant
 * @param itemId - The navigation item ID
 * @param userRole - Optional user role for role-based checks
 * @returns true if item should be visible, false otherwise
 */
export const isNavItemAllowed = (itemId: string, _userRole?: string): boolean => {
  if (!isStaffBuild) return true; // Owner build shows all nav items

  // Staff build: only show these navigation items
  const staffAllowedNavItems = [
    'attendance',  // Clock in/out
    'payroll',     // View payroll, tips, advances
    'advances',    // Request salary advances
    'hub',         // Home dashboard
    // Optional items (added conditionally based on role and settings):
    // 'kds' - Kitchen Display System (for kitchen staff)
    // 'pos' - Point of Sale (for server staff)
  ];

  // Staff build: hide all management and owner features
  const blockedNavItems = [
    'settings',
    'plugins',
    'chain',
    'menu',
    'inventory',
    'reports',
    'roster',
    'scheduling',
  ];

  if (blockedNavItems.includes(itemId)) {
    return false;
  }

  // Allow staff-specific items
  if (staffAllowedNavItems.includes(itemId)) {
    return true;
  }

  // For other items, allow them (will be filtered by role in component)
  return true;
};

/**
 * Check if a dashboard card should be visible based on build variant
 * @param cardId - The dashboard card ID
 * @param userRole - Optional user role for role-based checks
 * @returns true if card should be visible, false otherwise
 */
export const isDashboardCardAllowed = (cardId: string, _userRole?: string): boolean => {
  if (!isStaffBuild) return true; // Owner build shows all cards

  // Staff build: hide owner-only dashboard cards
  const ownerOnlyCards = ['plugins', 'chain-management', 'system-settings'];

  if (ownerOnlyCards.includes(cardId)) {
    return false;
  }

  return true;
};

// Log build configuration on load (development only)
if (import.meta.env.DEV) {
  console.log('[BuildConfig] Loaded configuration:', {
    variant,
    isStaffBuild,
    allowedModes: buildConfig.allowedModes,
  });
}
