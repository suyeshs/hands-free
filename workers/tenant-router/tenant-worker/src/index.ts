/**
 * Tenant Worker - Deployed to handsfree-tenants dispatch namespace
 *
 * Each tenant gets their own instance with a D1 database binding.
 * Handles order operations with direct D1 access for atomic transactions.
 */

import {
  handleCreateOrder,
  handleListOrders,
  handleGetOrder,
  handleUpdateOrderStatus,
  handleOrdersSync,
} from './handlers/orders';
import {
  handleCreateCustomer,
  handleGetCustomerByPhone,
  handleGetCustomerAddresses,
  handleSaveCustomerAddress,
} from './handlers/customers';
import {
  handleAggregatorOrdersSync,
  handleAggregatorOrdersFetch,
  handleAggregatorOrderArchive,
  handleAggregatorOrdersArchivedFetch,
  handleAggregatorOrderArchiveAll,
} from './handlers/aggregator-orders';
import {
  handleSalesSync,
  handleSalesSummary,
  handleSalesBreakdown,
  handleTopItems,
  handleCombinedSales,
} from './handlers/sales';
import {
  handleTipsSync,
  handleTipsSummary,
  handleTipsList,
  handleTipsByStaff,
  handleTipDelete,
} from './handlers/tips';
import {
  handleSyncMetrics,
  handleSyncMetricsClear,
} from './handlers/sync-metrics';
import {
  handleGetSettings,
  handleSaveSettings,
} from './handlers/settings';
import {
  handleGetFloorPlan,
  handleSaveFloorPlan,
} from './handlers/floor-plan';
import {
  activateTable,
  validateTableSession,
  deactivateTable,
  getActiveSessions,
  cleanupExpiredSessions,
} from './handlers/table-sessions';
import {
  handleGetStaff,
  handleSaveStaff,
  handleStaffUsersSync,
} from './handlers/staff';
import {
  handleStaffLoginHistorySync,
} from './handlers/staff-login';
import {
  handleCashRegistersSync,
  handleCashPayoutsSync,
} from './handlers/cash-management';
import {
  handleGetOutOfStock,
  handleSaveOutOfStock,
} from './handlers/out-of-stock';
import {
  handleGetPrinterConfig,
  handleSavePrinterConfig,
  handleGetAggregatorSettings,
  handleSaveAggregatorSettings,
} from './handlers/config';
import {
  handleListMenu,
  handleCreateMenuItem,
  handleGetMenuItem,
  handleUpdateMenuItem,
  handleDeleteMenuItem,
  handleListCategories,
  handleCreateCategory,
  handleGetCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleMenuItemsSync,
  handleMenuCategoriesSync,
  handleUploadPhotos,
} from './handlers/menu';
import {
  handleInventorySuppliersSync,
  handleInventoryItemsSync,
  handleInventoryDocumentsSync,
  handleInventoryTransactionsSync,
  handleInventoryRecipesSync,
  handleInventoryRecipeIngredientsSync,
  handleListSuppliers,
  handleCreateSupplier,
  handleGetSupplier,
  handleUpdateSupplier,
  handleDeleteSupplier,
  handleListInventoryItems,
  handleCreateInventoryItem,
  handleGetInventoryItem,
  handleUpdateInventoryItem,
  handleDeleteInventoryItem,
} from './handlers/inventory';
import {
  handleListDevices,
  handleDeviceHeartbeat,
  handleSuspendDevice,
  handleRevokeDevice,
  handleUpdateDeviceName,
  handleReactivateDevice,
} from './handlers/devices';
import {
  handlePullMasterMenu,
  handleGetMenuOverrides,
  handleSetMenuOverride,
  handleRemoveMenuOverride,
} from './handlers/location-group-menu';
import {
  handleGetLocationGroup,
  handleCreateLocationGroup,
  handleListLocationGroupLocations,
  handleAddLocationGroupLocation,
} from './handlers/location-groups';
import {
  handleLocationGroupSalesReport,
  handleLocationGroupMenuAnalytics,
  handleLocationGroupStaffReport,
} from './handlers/location-group-reports';
import {
  handleChainSalesSync,
  handleGetChainSales,
  handleGetChainSalesSummary,
} from './handlers/chain-sync';
import {
  handleOwnerDashboardStats,
  handleOwnerSalesData,
  handleOwnerLocations,
  handleOwnerActivity,
} from './handlers/owner-app';
import {
  handleStaffClockIn,
  handleStaffClockOut,
  handleStaffAttendanceStats,
  handleKDSOrders,
  handleKDSOrderReady,
  handleKDSOrderDelay,
  handleTeamStatus,
  handleKDSWebSocket,
} from './handlers/staff-app';
import {
  verifyOwnerPhone,
  verifyOwnerOTP,
  verifyStaffCredentials,
  refreshToken,
} from './handlers/auth';
import {
  generateQRToken,
  registerDevice,
  deviceLogin,
  listDevices,
  revokeDevice,
  checkQRTokenStatus,
} from './handlers/device-auth';
import {
  handleListSubscriptionPlans,
  handleListCuisineTypes,
  handleListWeeklyMenus,
  handleGetWeeklyMenu,
  handleGetWeekItems,
  handleCreateSubscription,
  handleGetCustomerSubscription,
  handleSavePreferences,
  handleListDeliveries,
  handlePlansSync,
  handleCuisineTypesSync,
  handleWeeksSync,
  handleMenuItemsSync,
  handleDeliveriesSync,
} from './handlers/subscriptions';
import { RealtimeCoordinator } from './durable-objects/RealtimeCoordinator';

interface Env {
  DB: D1Database;
  TENANTS_DB?: D1Database; // Central database for device tracking and chains
  TENANT_METADATA?: any; // KV namespace for caching
  TABLE_SESSION_SECRET?: string; // Secret for HMAC signing of table sessions
  REALTIME_COORDINATOR: DurableObjectNamespace;
  MSG91_VERIFY_WORKER_URL?: string; // URL for MSG91 verification worker
  JWT_SECRET?: string; // Secret for JWT token generation
  TOKEN_MANAGER: Fetcher; // Service binding for encryption key management
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id, X-Device-Id',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        service: 'tenant-worker',
        hasDatabase: !!env.DB,
        timestamp: new Date().toISOString(),
      }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Extract tenant ID from the worker name (set during deployment)
    // The router passes tenantId in the URL, but we can also derive it
    // For now, we'll extract from the incoming request path

    try {
      // Extract tenantId from header (set by the router)
      const tenantId = request.headers.get('X-Tenant-Id') || 'unknown';

      // Passive heartbeat: update last_seen on every API call
      const deviceId = request.headers.get('X-Device-Id');
      if (deviceId && env.TENANT_METADATA) {
        // Non-blocking KV update (fire and forget)
        env.TENANT_METADATA.put(
          `device:${deviceId}:last_seen`,
          new Date().toISOString(),
          { expirationTtl: 86400 }
        ).catch(() => {}); // Silently fail - don't block request
      }

      // ==================== ORDERS SYNC ====================

      // Route: /orders/sync - POST to sync orders from POS
      if (url.pathname === '/orders/sync' && request.method === 'POST') {
        return handleOrdersSync(request, env, tenantId);
      }

      // ==================== AGGREGATOR ORDERS ====================

      // Route: /aggregator-orders/sync - POST to sync orders from POS
      if (url.pathname === '/aggregator-orders/sync' && request.method === 'POST') {
        return handleAggregatorOrdersSync(request, env, tenantId);
      }

      // Route: /aggregator-orders/archived - GET to fetch archived orders by channel
      if (url.pathname === '/aggregator-orders/archived' && request.method === 'GET') {
        return handleAggregatorOrdersArchivedFetch(request, env, tenantId);
      }

      // Route: /aggregator-orders/archive-all - POST to archive all orders
      if (url.pathname === '/aggregator-orders/archive-all' && request.method === 'POST') {
        return handleAggregatorOrderArchiveAll(request, env, tenantId);
      }

      // Route: /aggregator-orders/:orderId/archive - PATCH to archive an order
      const archiveMatch = url.pathname.match(/^\/aggregator-orders\/([^/]+)\/archive$/);
      if (archiveMatch && request.method === 'PATCH') {
        const orderId = archiveMatch[1];
        return handleAggregatorOrderArchive(request, env, tenantId, orderId);
      }

      // Route: /aggregator-orders - GET to fetch orders
      if (url.pathname === '/aggregator-orders' && request.method === 'GET') {
        return handleAggregatorOrdersFetch(request, env, tenantId);
      }

      // ==================== SALES TRANSACTIONS ====================

      // Route: /sales/sync - POST to sync sales transactions from POS
      if (url.pathname === '/sales/sync' && request.method === 'POST') {
        return handleSalesSync(request, env, tenantId);
      }

      // Route: /sales/summary - GET sales summary
      if (url.pathname === '/sales/summary' && request.method === 'GET') {
        return handleSalesSummary(request, env, tenantId);
      }

      // Route: /sales/breakdown - GET sales breakdown
      if (url.pathname === '/sales/breakdown' && request.method === 'GET') {
        return handleSalesBreakdown(request, env, tenantId);
      }

      // Route: /sales/items - GET top selling items
      if (url.pathname === '/sales/items' && request.method === 'GET') {
        return handleTopItems(request, env, tenantId);
      }

      // Route: /sales/combined - GET combined POS + aggregator sales
      if (url.pathname === '/sales/combined' && request.method === 'GET') {
        return handleCombinedSales(request, env, tenantId);
      }

      // ==================== SYNC METRICS ====================

      // Route: /sync/metrics - GET sync health metrics
      if (url.pathname === '/sync/metrics' && request.method === 'GET') {
        return handleSyncMetrics(request, env, tenantId);
      }

      // Route: /sync/metrics - DELETE to clear sync metrics
      if (url.pathname === '/sync/metrics' && request.method === 'DELETE') {
        return handleSyncMetricsClear(request, env, tenantId);
      }

      // ==================== TIPS ====================

      // Route: /tips/sync - POST to sync tips from POS
      if (url.pathname === '/tips/sync' && request.method === 'POST') {
        return handleTipsSync(request, env, tenantId);
      }

      // Route: /tips/summary - GET tips summary
      if (url.pathname === '/tips/summary' && request.method === 'GET') {
        return handleTipsSummary(request, env, tenantId);
      }

      // Route: /tips/list - GET tips list
      if (url.pathname === '/tips/list' && request.method === 'GET') {
        return handleTipsList(request, env, tenantId);
      }

      // Route: /tips/by-staff/:staffId - GET tips by staff
      const tipsByStaffMatch = url.pathname.match(/^\/tips\/by-staff\/([^/]+)$/);
      if (tipsByStaffMatch && request.method === 'GET') {
        const staffId = tipsByStaffMatch[1];
        return handleTipsByStaff(request, env, tenantId, staffId);
      }

      // Route: /tips/:tipId - DELETE tip
      const tipDeleteMatch = url.pathname.match(/^\/tips\/([^/]+)$/);
      if (tipDeleteMatch && request.method === 'DELETE') {
        const tipId = tipDeleteMatch[1];
        return handleTipDelete(request, env, tenantId, tipId);
      }

      // ==================== RESTAURANT SETTINGS ====================

      // Route: /settings - GET restaurant settings
      if (url.pathname === '/settings' && request.method === 'GET') {
        return handleGetSettings(request, env, tenantId);
      }

      // Route: /settings - PUT to save restaurant settings
      if (url.pathname === '/settings' && request.method === 'PUT') {
        return handleSaveSettings(request, env, tenantId);
      }

      // ==================== FLOOR PLAN ====================

      // Route: /floor-plan - GET floor plan
      if (url.pathname === '/floor-plan' && request.method === 'GET') {
        return handleGetFloorPlan(request, env, tenantId);
      }

      // Route: /floor-plan - PUT to save floor plan
      if (url.pathname === '/floor-plan' && request.method === 'PUT') {
        return handleSaveFloorPlan(request, env, tenantId);
      }

      // ==================== DEVICE MANAGEMENT ====================

      // Route: /devices - GET to list all devices
      if (url.pathname === '/devices' && request.method === 'GET') {
        return handleListDevices(request, env, tenantId);
      }

      // Route: /devices/heartbeat - POST to update heartbeat
      if (url.pathname === '/devices/heartbeat' && request.method === 'POST') {
        return handleDeviceHeartbeat(request, env, tenantId);
      }

      // Route: /devices/:deviceId/* - Device-specific operations
      const deviceActionMatch = url.pathname.match(/^\/devices\/([^/]+)\/(suspend|revoke|name|reactivate)$/);
      if (deviceActionMatch && request.method === 'PATCH') {
        const [_, deviceId, action] = deviceActionMatch;
        switch (action) {
          case 'suspend':
            return handleSuspendDevice(request, env, tenantId, deviceId);
          case 'revoke':
            return handleRevokeDevice(request, env, tenantId, deviceId);
          case 'name':
            return handleUpdateDeviceName(request, env, tenantId, deviceId);
          case 'reactivate':
            return handleReactivateDevice(request, env, tenantId, deviceId);
        }
      }

      // ==================== CHAIN MANAGEMENT ====================

      // Route: /chains/:chainId - GET chain details
      const chainGetMatch = url.pathname.match(/^\/chains\/([^/]+)$/);
      if (chainGetMatch && request.method === 'GET') {
        const chainId = chainGetMatch[1];
        return handleGetLocationGroup(request, env, chainId);
      }

      // Route: /chains - POST to create chain
      if (url.pathname === '/chains' && request.method === 'POST') {
        return handleCreateLocationGroup(request, env);
      }

      // Route: /chains/:chainId/locations - GET list locations
      const chainLocationsMatch = url.pathname.match(/^\/chains\/([^/]+)\/locations$/);
      if (chainLocationsMatch && request.method === 'GET') {
        const chainId = chainLocationsMatch[1];
        return handleListLocationGroupLocations(request, env, chainId);
      }

      // Route: /chains/:chainId/locations - POST add location
      if (chainLocationsMatch && request.method === 'POST') {
        const chainId = chainLocationsMatch[1];
        return handleAddLocationGroupLocation(request, env, chainId);
      }

      // Route: /chain/pull-menu - POST to pull master menu
      if (url.pathname === '/chain/pull-menu' && request.method === 'POST') {
        return handlePullMasterMenu(request, env, tenantId);
      }

      // Route: /chain/menu-overrides - GET list overrides
      if (url.pathname === '/chain/menu-overrides' && request.method === 'GET') {
        return handleGetMenuOverrides(request, env, tenantId);
      }

      // Route: /chain/menu-overrides/:itemId - POST/DELETE override
      const overrideMatch = url.pathname.match(/^\/chain\/menu-overrides\/([^/]+)$/);
      if (overrideMatch && request.method === 'POST') {
        const itemId = overrideMatch[1];
        return handleSetMenuOverride(request, env, tenantId, itemId);
      }
      if (overrideMatch && request.method === 'DELETE') {
        const itemId = overrideMatch[1];
        return handleRemoveMenuOverride(request, env, tenantId, itemId);
      }

      // Route: /chains/:chainId/reports/sales - GET sales report
      const salesReportMatch = url.pathname.match(/^\/chains\/([^/]+)\/reports\/sales$/);
      if (salesReportMatch && request.method === 'GET') {
        const chainId = salesReportMatch[1];
        return handleLocationGroupSalesReport(request, env, chainId);
      }

      // Route: /chains/:chainId/reports/menu - GET menu analytics
      const menuAnalyticsMatch = url.pathname.match(/^\/chains\/([^/]+)\/reports\/menu$/);
      if (menuAnalyticsMatch && request.method === 'GET') {
        const chainId = menuAnalyticsMatch[1];
        return handleLocationGroupMenuAnalytics(request, env, chainId);
      }

      // Route: /chains/:chainId/reports/staff - GET staff report
      const staffReportMatch = url.pathname.match(/^\/chains\/([^/]+)\/reports\/staff$/);
      if (staffReportMatch && request.method === 'GET') {
        const chainId = staffReportMatch[1];
        return handleLocationGroupStaffReport(request, env, chainId);
      }

      // ==================== CHAIN SALES SYNC ====================

      // Route: /chain/:chainId/location/:locationId/sync-sales - POST to sync sales from location
      const chainSalesSyncMatch = url.pathname.match(/^\/chain\/([^/]+)\/location\/([^/]+)\/sync-sales$/);
      if (chainSalesSyncMatch && request.method === 'POST') {
        const chainId = chainSalesSyncMatch[1];
        const locationId = chainSalesSyncMatch[2];
        return handleChainSalesSync(request, env, chainId, locationId);
      }

      // Route: /chain/:chainId/sales - GET chain sales
      const chainSalesMatch = url.pathname.match(/^\/chain\/([^/]+)\/sales$/);
      if (chainSalesMatch && request.method === 'GET') {
        const chainId = chainSalesMatch[1];
        return handleGetChainSales(request, env, chainId);
      }

      // Route: /chain/:chainId/sales/summary - GET chain sales summary
      const chainSalesSummaryMatch = url.pathname.match(/^\/chain\/([^/]+)\/sales\/summary$/);
      if (chainSalesSummaryMatch && request.method === 'GET') {
        const chainId = chainSalesSummaryMatch[1];
        return handleGetChainSalesSummary(request, env, chainId);
      }

      // ==================== TABLE SESSIONS ====================

      // Route: /tables/active-sessions - GET active table sessions
      if (url.pathname === '/tables/active-sessions' && request.method === 'GET') {
        return getActiveSessions(env, tenantId);
      }

      // Route: /tables/cleanup-expired - POST to cleanup expired sessions
      if (url.pathname === '/tables/cleanup-expired' && request.method === 'POST') {
        return cleanupExpiredSessions(env, tenantId);
      }

      // Route: /tables/:tableId/activate - POST to activate table
      const activateMatch = url.pathname.match(/^\/tables\/([^/]+)\/activate$/);
      if (activateMatch && request.method === 'POST') {
        const tableId = activateMatch[1];
        return activateTable(request, env, tenantId, tableId);
      }

      // Route: /tables/:tableId/validate - POST to validate table session
      const validateMatch = url.pathname.match(/^\/tables\/([^/]+)\/validate$/);
      if (validateMatch && request.method === 'POST') {
        const tableId = validateMatch[1];
        return validateTableSession(request, env, tenantId, tableId);
      }

      // Route: /tables/:tableId/deactivate - POST to deactivate table
      const deactivateMatch = url.pathname.match(/^\/tables\/([^/]+)\/deactivate$/);
      if (deactivateMatch && request.method === 'POST') {
        const tableId = deactivateMatch[1];
        return deactivateTable(request, env, tenantId, tableId);
      }

      // ==================== STAFF ====================

      // Route: /staff/sync - POST to sync staff users from POS
      if (url.pathname === '/staff/sync' && request.method === 'POST') {
        return handleStaffUsersSync(request, env, tenantId);
      }

      // Route: /staff/login-history/sync - POST to sync staff login history from POS
      if (url.pathname === '/staff/login-history/sync' && request.method === 'POST') {
        return handleStaffLoginHistorySync(request, env, tenantId);
      }

      // Route: /staff - GET staff members
      if (url.pathname === '/staff' && request.method === 'GET') {
        return handleGetStaff(request, env, tenantId);
      }

      // Route: /staff - PUT to save staff members
      if (url.pathname === '/staff' && request.method === 'PUT') {
        return handleSaveStaff(request, env, tenantId);
      }

      // ==================== CASH MANAGEMENT ====================

      // Route: /cash-registers/sync - POST to sync cash registers from POS
      if (url.pathname === '/cash-registers/sync' && request.method === 'POST') {
        return handleCashRegistersSync(request, env, tenantId);
      }

      // Route: /cash-payouts/sync - POST to sync cash payouts from POS
      if (url.pathname === '/cash-payouts/sync' && request.method === 'POST') {
        return handleCashPayoutsSync(request, env, tenantId);
      }

      // ==================== OUT OF STOCK ====================

      // Route: /out-of-stock - GET out-of-stock items
      if (url.pathname === '/out-of-stock' && request.method === 'GET') {
        return handleGetOutOfStock(request, env, tenantId);
      }

      // Route: /out-of-stock - PUT to save out-of-stock items
      if (url.pathname === '/out-of-stock' && request.method === 'PUT') {
        return handleSaveOutOfStock(request, env, tenantId);
      }

      // ==================== PRINTER CONFIG ====================

      // Route: /printer-config - GET printer configuration
      if (url.pathname === '/printer-config' && request.method === 'GET') {
        return handleGetPrinterConfig(request, env, tenantId);
      }

      // Route: /printer-config - PUT to save printer configuration
      if (url.pathname === '/printer-config' && request.method === 'PUT') {
        return handleSavePrinterConfig(request, env, tenantId);
      }

      // ==================== AGGREGATOR SETTINGS ====================

      // Route: /aggregator-settings - GET aggregator settings
      if (url.pathname === '/aggregator-settings' && request.method === 'GET') {
        return handleGetAggregatorSettings(request, env, tenantId);
      }

      // Route: /aggregator-settings - PUT to save aggregator settings
      if (url.pathname === '/aggregator-settings' && request.method === 'PUT') {
        return handleSaveAggregatorSettings(request, env, tenantId);
      }

      // ==================== MENU ====================

      // Route: /menu/sync - POST to sync menu items from POS
      if (url.pathname === '/menu/sync' && request.method === 'POST') {
        return handleMenuItemsSync(request, env, tenantId);
      }

      // Route: /menu/upload-photos - POST to match photos to menu items using fuzzy logic
      if (url.pathname === '/menu/upload-photos' && request.method === 'POST') {
        return handleUploadPhotos(request, env, tenantId);
      }

      // Route: /menu - GET list menu items
      if (url.pathname === '/menu' && request.method === 'GET') {
        return handleListMenu(request, env, tenantId);
      }

      // Route: /menu - POST create new menu item
      if (url.pathname === '/menu' && request.method === 'POST') {
        return handleCreateMenuItem(request, env, tenantId);
      }

      // Route: /menu/:itemId - GET, PATCH, DELETE
      const menuItemMatch = url.pathname.match(/^\/menu\/([^/]+)$/);
      if (menuItemMatch) {
        const itemId = menuItemMatch[1];

        if (request.method === 'GET') {
          return handleGetMenuItem(request, env, tenantId, itemId);
        }
        if (request.method === 'PATCH') {
          return handleUpdateMenuItem(request, env, tenantId, itemId);
        }
        if (request.method === 'DELETE') {
          return handleDeleteMenuItem(request, env, tenantId, itemId);
        }
      }

      // ==================== CATEGORIES ====================

      // Route: /categories/sync - POST to sync categories from POS
      if (url.pathname === '/categories/sync' && request.method === 'POST') {
        return handleMenuCategoriesSync(request, env, tenantId);
      }

      // Match individual category: /categories/{categoryId}
      const categoryItemMatch = url.pathname.match(/^\/categories\/([^\/]+)$/);
      if (categoryItemMatch) {
        const categoryId = categoryItemMatch[1];

        // GET /categories/{categoryId} - Get specific category
        if (request.method === 'GET') {
          return handleGetCategory(request, env, tenantId, categoryId);
        }

        // PATCH /categories/{categoryId} - Update category
        if (request.method === 'PATCH') {
          return handleUpdateCategory(request, env, tenantId, categoryId);
        }

        // DELETE /categories/{categoryId} - Delete category
        if (request.method === 'DELETE') {
          return handleDeleteCategory(request, env, tenantId, categoryId);
        }

        // Unsupported method for this category route
        return Response.json({
          error: 'Method not allowed',
          path: url.pathname,
          method: request.method,
        }, { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      // GET /categories - List all categories
      if (url.pathname === '/categories' && request.method === 'GET') {
        return handleListCategories(request, env, tenantId);
      }

      // POST /categories - Create new category
      if (url.pathname === '/categories' && request.method === 'POST') {
        return handleCreateCategory(request, env, tenantId);
      }

      // ==================== INVENTORY ====================

      // Route: /inventory/suppliers/sync - POST to sync inventory suppliers from POS
      if (url.pathname === '/inventory/suppliers/sync' && request.method === 'POST') {
        return handleInventorySuppliersSync(request, env, tenantId);
      }

      // Route: /inventory/suppliers - GET list suppliers, POST create supplier
      if (url.pathname === '/inventory/suppliers' && request.method === 'GET') {
        return handleListSuppliers(request, env, tenantId);
      }
      if (url.pathname === '/inventory/suppliers' && request.method === 'POST') {
        return handleCreateSupplier(request, env, tenantId);
      }

      // Route: /inventory/suppliers/:id - GET, PUT, DELETE
      const supplierMatch = url.pathname.match(/^\/inventory\/suppliers\/([^/]+)$/);
      if (supplierMatch) {
        const supplierId = supplierMatch[1];
        if (request.method === 'GET') {
          return handleGetSupplier(request, env, tenantId, supplierId);
        }
        if (request.method === 'PUT') {
          return handleUpdateSupplier(request, env, tenantId, supplierId);
        }
        if (request.method === 'DELETE') {
          return handleDeleteSupplier(request, env, tenantId, supplierId);
        }
      }

      // Route: /inventory/items/sync - POST to sync inventory items from POS
      if (url.pathname === '/inventory/items/sync' && request.method === 'POST') {
        return handleInventoryItemsSync(request, env, tenantId);
      }

      // Route: /inventory/items - GET list items, POST create item
      if (url.pathname === '/inventory/items' && request.method === 'GET') {
        return handleListInventoryItems(request, env, tenantId);
      }
      if (url.pathname === '/inventory/items' && request.method === 'POST') {
        return handleCreateInventoryItem(request, env, tenantId);
      }

      // Route: /inventory/items/:id - GET, PUT, DELETE
      const itemMatch = url.pathname.match(/^\/inventory\/items\/([^/]+)$/);
      if (itemMatch) {
        const itemId = itemMatch[1];
        if (request.method === 'GET') {
          return handleGetInventoryItem(request, env, tenantId, itemId);
        }
        if (request.method === 'PUT') {
          return handleUpdateInventoryItem(request, env, tenantId, itemId);
        }
        if (request.method === 'DELETE') {
          return handleDeleteInventoryItem(request, env, tenantId, itemId);
        }
      }

      // Route: /inventory - Alias for /inventory/items (GET only)
      if (url.pathname === '/inventory' && request.method === 'GET') {
        return handleListInventoryItems(request, env, tenantId);
      }

      // Route: /inventory/documents/sync - POST to sync inventory documents from POS
      if (url.pathname === '/inventory/documents/sync' && request.method === 'POST') {
        return handleInventoryDocumentsSync(request, env, tenantId);
      }

      // Route: /inventory/transactions/sync - POST to sync inventory transactions from POS
      if (url.pathname === '/inventory/transactions/sync' && request.method === 'POST') {
        return handleInventoryTransactionsSync(request, env, tenantId);
      }

      // Route: /inventory/recipes/sync - POST to sync inventory recipes from POS
      if (url.pathname === '/inventory/recipes/sync' && request.method === 'POST') {
        return handleInventoryRecipesSync(request, env, tenantId);
      }

      // Route: /inventory/recipe-ingredients/sync - POST to sync recipe ingredients from POS
      if (url.pathname === '/inventory/recipe-ingredients/sync' && request.method === 'POST') {
        return handleInventoryRecipeIngredientsSync(request, env, tenantId);
      }

      // ==================== SUBSCRIPTIONS ====================

      // Route: /subscriptions/plans - GET list subscription plans
      if (url.pathname === '/subscriptions/plans' && request.method === 'GET') {
        return handleListSubscriptionPlans(request, env, tenantId);
      }

      // Route: /subscriptions/plans/sync - POST sync subscription plans from POS
      if (url.pathname === '/subscriptions/plans/sync' && request.method === 'POST') {
        return handlePlansSync(request, env, tenantId);
      }

      // Route: /subscriptions/cuisine-types - GET list cuisine types
      if (url.pathname === '/subscriptions/cuisine-types' && request.method === 'GET') {
        return handleListCuisineTypes(request, env, tenantId);
      }

      // Route: /subscriptions/cuisine-types/sync - POST sync cuisine types from POS
      if (url.pathname === '/subscriptions/cuisine-types/sync' && request.method === 'POST') {
        return handleCuisineTypesSync(request, env, tenantId);
      }

      // Route: /subscriptions/weeks - GET list weekly menus
      if (url.pathname === '/subscriptions/weeks' && request.method === 'GET') {
        return handleListWeeklyMenus(request, env, tenantId);
      }

      // Route: /subscriptions/weeks/sync - POST sync weekly menus from POS
      if (url.pathname === '/subscriptions/weeks/sync' && request.method === 'POST') {
        return handleWeeksSync(request, env, tenantId);
      }

      // Route: /subscriptions/weeks/:weekId - GET specific weekly menu
      const weekMatch = url.pathname.match(/^\/subscriptions\/weeks\/([^/]+)$/);
      if (weekMatch && request.method === 'GET') {
        const weekId = weekMatch[1];
        return handleGetWeeklyMenu(request, env, tenantId, weekId);
      }

      // Route: /subscriptions/weeks/:weekId/items - GET items for a specific week
      const weekItemsMatch = url.pathname.match(/^\/subscriptions\/weeks\/([^/]+)\/items$/);
      if (weekItemsMatch && request.method === 'GET') {
        const weekId = weekItemsMatch[1];
        return handleGetWeekItems(request, env, tenantId, weekId);
      }

      // Route: /subscriptions/menu-items/sync - POST sync subscription menu items from POS
      if (url.pathname === '/subscriptions/menu-items/sync' && request.method === 'POST') {
        return handleMenuItemsSync(request, env, tenantId);
      }

      // Route: /subscriptions/customers - POST create new subscription
      if (url.pathname === '/subscriptions/customers' && request.method === 'POST') {
        return handleCreateSubscription(request, env, tenantId);
      }

      // Route: /subscriptions/customers/:customerId - GET customer subscription details
      const customerMatch = url.pathname.match(/^\/subscriptions\/customers\/([^/]+)$/);
      if (customerMatch && request.method === 'GET') {
        const customerId = customerMatch[1];
        return handleGetCustomerSubscription(request, env, tenantId, customerId);
      }

      // Route: /subscriptions/preferences - POST save customer meal preferences
      if (url.pathname === '/subscriptions/preferences' && request.method === 'POST') {
        return handleSavePreferences(request, env, tenantId);
      }

      // Route: /subscriptions/deliveries - GET list deliveries
      if (url.pathname === '/subscriptions/deliveries' && request.method === 'GET') {
        return handleListDeliveries(request, env, tenantId);
      }

      // Route: /subscriptions/deliveries/sync - POST sync deliveries from POS
      if (url.pathname === '/subscriptions/deliveries/sync' && request.method === 'POST') {
        return handleDeliveriesSync(request, env, tenantId);
      }

      // ==================== CUSTOMERS ====================

      // Route: /customers - POST create or find customer
      if (url.pathname === '/customers' && request.method === 'POST') {
        return handleCreateCustomer(request, env, tenantId);
      }

      // Route: /customers/phone/:phone - GET customer by phone
      if (url.pathname.match(/^\/customers\/phone\/[^\/]+$/) && request.method === 'GET') {
        return handleGetCustomerByPhone(request, env, tenantId);
      }

      // Route: /customers/phone/:phone/addresses - GET customer addresses
      if (url.pathname.match(/^\/customers\/phone\/[^\/]+\/addresses$/) && request.method === 'GET') {
        return handleGetCustomerAddresses(request, env, tenantId);
      }

      // Route: /customers/phone/:phone/addresses - POST save customer address
      if (url.pathname.match(/^\/customers\/phone\/[^\/]+\/addresses$/) && request.method === 'POST') {
        return handleSaveCustomerAddress(request, env, tenantId);
      }

      // Route: /orders or /orders/...
      const ordersMatch = url.pathname.match(/^\/orders(\/(.+))?$/);
      const categoriesMatch = url.pathname.match(/^\/categories(\/.*)?$/);

      // Allow /categories routes to pass through, only check orders
      if (!ordersMatch && !categoriesMatch) {
        return Response.json({
          error: 'Not found',
          path: url.pathname,
        }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      // If it's a categories route but we didn't handle it above, return 404
      if (categoriesMatch && !ordersMatch) {
        return Response.json({
          error: 'Not found',
          path: url.pathname,
        }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      // At this point, ordersMatch must exist (we returned 404 above if it didn't)
      if (!ordersMatch) {
        return Response.json({
          error: 'Not found',
          path: url.pathname,
        }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }

      const subPath = ordersMatch[2] || '';

      // POST /orders - Create order
      if (request.method === 'POST' && !subPath) {
        return handleCreateOrder(request, env, tenantId);
      }

      // GET /orders - List orders
      if (request.method === 'GET' && !subPath) {
        return handleListOrders(request, env, tenantId);
      }

      // Check for orderId in path
      const orderIdMatch = subPath.match(/^([^\/]+)(\/status)?$/);

      if (orderIdMatch) {
        const orderId = orderIdMatch[1];
        const isStatusUpdate = orderIdMatch[2] === '/status';

        // PATCH /orders/:orderId/status - Update status
        if (request.method === 'PATCH' && isStatusUpdate) {
          return handleUpdateOrderStatus(request, env, tenantId, orderId);
        }

        // GET /orders/:orderId - Get single order
        if (request.method === 'GET') {
          return handleGetOrder(request, env, tenantId, orderId);
        }
      }

      // ==================== AUTHENTICATION API ====================

      // Route: /api/auth/owner/verify-phone - POST verify owner phone and send OTP
      if (url.pathname === '/api/auth/owner/verify-phone' && request.method === 'POST') {
        return verifyOwnerPhone(request, env, tenantId);
      }

      // Route: /api/auth/owner/verify-otp - POST verify OTP and get token
      if (url.pathname === '/api/auth/owner/verify-otp' && request.method === 'POST') {
        return verifyOwnerOTP(request, env, tenantId);
      }

      // Route: /api/auth/staff/verify-credentials - POST verify staff phone+PIN
      if (url.pathname === '/api/auth/staff/verify-credentials' && request.method === 'POST') {
        return verifyStaffCredentials(request, env, tenantId);
      }

      // Route: /api/auth/refresh - POST refresh token
      if (url.pathname === '/api/auth/refresh' && request.method === 'POST') {
        return refreshToken(request, env);
      }

      // ==================== DEVICE REGISTRATION API ====================

      // Route: /api/auth/qr/generate - POST generate QR code for device registration
      if (url.pathname === '/api/auth/qr/generate' && request.method === 'POST') {
        return generateQRToken(request, env, tenantId);
      }

      // Route: /api/auth/device/register - POST register device via QR token (no auth required)
      if (url.pathname === '/api/auth/device/register' && request.method === 'POST') {
        return registerDevice(request, env);
      }

      // Route: /api/auth/device/login - POST auto-login with device token
      if (url.pathname === '/api/auth/device/login' && request.method === 'POST') {
        return deviceLogin(request, env);
      }

      // Route: /api/auth/devices - GET list registered devices
      if (url.pathname === '/api/auth/devices' && request.method === 'GET') {
        return listDevices(request, env, tenantId);
      }

      // Route: /api/auth/devices/:deviceId/revoke - POST revoke device
      if (url.pathname.startsWith('/api/auth/devices/') && url.pathname.endsWith('/revoke') && request.method === 'POST') {
        const deviceId = url.pathname.split('/')[4];
        return revokeDevice(request, env, tenantId, deviceId);
      }

      // Route: /api/auth/qr/:tokenId/status - GET check if QR token has been used
      if (url.pathname.startsWith('/api/auth/qr/') && url.pathname.endsWith('/status') && request.method === 'GET') {
        const tokenId = url.pathname.split('/')[4];
        return checkQRTokenStatus(request, env, tokenId);
      }

      // ==================== OWNER MOBILE APP API ====================

      // Route: /api/owner/dashboard/stats - GET dashboard stats
      if (url.pathname === '/api/owner/dashboard/stats' && request.method === 'GET') {
        return handleOwnerDashboardStats(request, env, tenantId);
      }

      // Route: /api/owner/dashboard/sales-data - GET sales chart data
      if (url.pathname === '/api/owner/dashboard/sales-data' && request.method === 'GET') {
        return handleOwnerSalesData(request, env, tenantId);
      }

      // Route: /api/owner/locations - GET all locations
      if (url.pathname === '/api/owner/locations' && request.method === 'GET') {
        return handleOwnerLocations(request, env, tenantId);
      }

      // Route: /api/owner/activity - GET activity feed
      if (url.pathname === '/api/owner/activity' && request.method === 'GET') {
        return handleOwnerActivity(request, env, tenantId);
      }

      // ==================== STAFF MOBILE APP API ====================

      // Route: /api/staff/attendance/clock-in - POST clock in
      if (url.pathname === '/api/staff/attendance/clock-in' && request.method === 'POST') {
        return handleStaffClockIn(request, env, tenantId);
      }

      // Route: /api/staff/attendance/clock-out - POST clock out
      if (url.pathname === '/api/staff/attendance/clock-out' && request.method === 'POST') {
        return handleStaffClockOut(request, env, tenantId);
      }

      // Route: /api/staff/attendance/stats - GET attendance stats
      if (url.pathname === '/api/staff/attendance/stats' && request.method === 'GET') {
        return handleStaffAttendanceStats(request, env, tenantId);
      }

      // Route: /api/staff/kds/orders - GET KDS orders
      if (url.pathname === '/api/staff/kds/orders' && request.method === 'GET') {
        return handleKDSOrders(request, env, tenantId);
      }

      // Route: /api/staff/kds/orders/:orderId/ready - POST mark order ready
      const kdsReadyMatch = url.pathname.match(/^\/api\/staff\/kds\/orders\/([^/]+)\/ready$/);
      if (kdsReadyMatch && request.method === 'POST') {
        const orderId = kdsReadyMatch[1];
        return handleKDSOrderReady(request, env, tenantId, orderId);
      }

      // Route: /api/staff/kds/orders/:orderId/delay - POST report delay
      const kdsDelayMatch = url.pathname.match(/^\/api\/staff\/kds\/orders\/([^/]+)\/delay$/);
      if (kdsDelayMatch && request.method === 'POST') {
        const orderId = kdsDelayMatch[1];
        return handleKDSOrderDelay(request, env, tenantId, orderId);
      }

      // Route: /api/staff/team/status - GET team status
      if (url.pathname === '/api/staff/team/status' && request.method === 'GET') {
        return handleTeamStatus(request, env, tenantId);
      }

      // Route: /api/staff/kds/ws - WebSocket for real-time KDS updates
      if (url.pathname === '/api/staff/kds/ws' && request.headers.get('Upgrade') === 'websocket') {
        return handleKDSWebSocket(request, env, tenantId);
      }

      // Route: /api/realtime/ws - WebSocket for real-time updates (Owner & Staff)
      if (url.pathname === '/api/realtime/ws' && request.headers.get('Upgrade') === 'websocket') {
        const realtimeId = env.REALTIME_COORDINATOR.idFromName(tenantId);
        const realtimeStub = env.REALTIME_COORDINATOR.get(realtimeId);
        return realtimeStub.fetch(request);
      }

      return Response.json({
        error: 'Method not allowed',
        method: request.method,
        path: url.pathname,
      }, { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

    } catch (error: any) {
      console.error('[TenantWorker] Unhandled error:', error);
      return Response.json({
        error: 'Internal server error',
        message: error.message,
      }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
  },
};

// Export Durable Objects
export { RealtimeCoordinator };
