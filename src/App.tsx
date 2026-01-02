/**
 * Tauri POS App Entry Point
 * Handles tenant activation, device registration + authentication, then loads role-based dashboards
 */

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMenuStore } from './stores/menuStore';
import { UserRole } from './types/auth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ManagerDashboard from './pages/ManagerDashboard';
import AggregatorDashboard from './pages-v2/AggregatorDashboard';
import AggregatorSettings from './pages-v2/AggregatorSettings';
import DiagnosticsPage from './pages-v2/DiagnosticsPage';
import SettingsPage from './pages-v2/SettingsPage';
import WebsiteOrdersDashboard from './pages-v2/WebsiteOrdersDashboard';
import OrderStatusDashboard from './pages-v2/OrderStatusDashboard';
import KitchenDashboard from './pages-v2/KitchenDashboard';
import POSDashboard from './pages-v2/POSDashboard';
import GuestOrderPage from './pages-v2/GuestOrderPage';
import GuestOrderConfirmation from './pages-v2/GuestOrderConfirmation';
import ServiceDashboard from './pages-v2/ServiceDashboard';
import TrackOrderPage from './pages-v2/TrackOrderPage';
import DailySalesReport from './pages-v2/DailySalesReport';
import { InventoryDashboard } from './pages-v2/InventoryDashboard';
import { BillScanPage } from './pages-v2/BillScanPage';
import HubPage from './pages-v2/HubPage';
import { Login } from './pages/Login';
import TenantActivation from './pages/TenantActivation';
import { useTenantStore, useNeedsActivation } from './stores/tenantStore';
import { autoSyncMenu, activateAllMenuItems } from './lib/menuSync';
import { WebSocketManager } from './components/WebSocketManager';
import { AppLayout } from './components/layout-v2/AppLayout';

import { useDeviceStore } from './stores/deviceStore';
import { LockedModeGuard, getLockedModeRoute } from './components/LockedModeGuard';
import { useNavigate } from 'react-router-dom';

/**
 * Wrapper for Login component that provides navigation
 */
function LoginWrapper({ onSuccess }: { onSuccess: () => void }) {
  const navigate = useNavigate();

  const handleSuccess = async () => {
    await onSuccess();
    // Navigate to root after login - DefaultRoute will redirect to appropriate dashboard
    navigate('/', { replace: true });
  };

  return <Login onSuccess={handleSuccess} />;
}

/**
 * Role-based default route redirect
 * When device is locked to a mode, redirects to that mode's screen
 */
function DefaultRoute() {
  const lockedRoute = getLockedModeRoute();
  if (lockedRoute) {
    console.log('[DefaultRoute] Device locked, redirecting to:', lockedRoute);
    return <Navigate to={lockedRoute} replace />;
  }
  console.log('[DefaultRoute] Redirecting to hub page');
  return <Navigate to="/hub" replace />;
}

function App() {
  const [syncingMenu, setSyncingMenu] = useState(false);
  const needsActivation = useNeedsActivation();
  const { tenant, isActivated } = useTenantStore();

  // Dev keyboard shortcut: Ctrl+Shift+R to reset device mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        const deviceStore = useDeviceStore.getState();
        deviceStore.setDeviceMode('generic');
        deviceStore.setLocked(false);
        console.log('[App] DEV: Device mode reset to generic, unlocked');
        alert('Device mode reset to Generic and unlocked. Reloading...');
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check authentication and device registration
  useEffect(() => {
    console.log('[App] Current URL:', window.location.href);
    console.log('[App] Hash:', window.location.hash);
    console.log('[App] Pathname:', window.location.pathname);
    console.log('[App] Tenant activated:', isActivated, tenant?.tenantId);

    // Only check auth if tenant is activated
    if (isActivated && tenant) {
      checkAuth();
    }
  }, [isActivated, tenant]);

  const checkAuth = async () => {
    // Use tenant ID from store, fallback to env or default
    const tenantId = tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID || 'coorg-food-company-6163';

    // Auto-sync menu on app load
    try {
      console.log("[App] Starting auto menu sync for tenant:", tenantId);
      setSyncingMenu(true);

      // HOTFIX: Activate all menu items
      await activateAllMenuItems();
      await autoSyncMenu(tenantId);

      // Load menu into store from database
      await useMenuStore.getState().loadMenuFromDatabase();

      // Load dine-in pricing overrides
      await useMenuStore.getState().loadDineInOverrides(tenantId);
    } catch (error) {
      console.error("[App] Menu sync/load failed:", error);
    } finally {
      setSyncingMenu(false);
    }
  };

  const handleLoginSuccess = async () => {
    console.log("[App] Login successful");
    const tenantId = tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID || 'coorg-food-company-6163';

    // Auto-sync menu from backend after login
    try {
      setSyncingMenu(true);
      await autoSyncMenu(tenantId);
      await useMenuStore.getState().loadMenuFromDatabase();

      // Load dine-in pricing overrides
      await useMenuStore.getState().loadDineInOverrides(tenantId);
    } catch (error) {
      console.error("[App] Menu sync/load failed:", error);
    } finally {
      setSyncingMenu(false);
    }
  };

  const handleTenantActivated = () => {
    console.log('[App] Tenant activated, reloading app');
    // Reload to reinitialize with new tenant config
    window.location.reload();
  };

  // Show tenant activation screen if not activated
  if (needsActivation) {
    console.log('[App] Showing tenant activation screen');
    return <TenantActivation onActivated={handleTenantActivated} />;
  }

  // Show loading spinner while syncing menu
  console.log('[App] Render - syncingMenu:', syncingMenu);

  if (syncingMenu) {
    console.log('[App] Showing loading screen');
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
          </div>
          <p className="text-muted-foreground font-bold">Syncing menu...</p>
          {tenant && (
            <p className="text-xs text-muted-foreground/50 mt-2">{tenant.companyName}</p>
          )}
        </div>
      </div>
    );
  }

  // NOTE: Login is now handled through the /login route in the HashRouter
  // No need to render Login component here - DefaultRoute will redirect unauthenticated users
  console.log('[App] Showing main app with routes');

  return (
    <HashRouter>
      <WebSocketManager />
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        <LockedModeGuard>
        <Routes>
          {/* PUBLIC ROUTES - Guest QR Ordering (no auth required) */}
          <Route path="/table/:tableId" element={<GuestOrderPage />} />
          <Route path="/table/:tableId/confirmed/:orderId" element={<GuestOrderConfirmation />} />

          {/* PUBLIC ROUTE - Customer Order Tracking (no auth required) */}
          <Route path="/track/:orderNumber" element={<TrackOrderPage />} />

          {/* Login Route - Shows login screen */}
          <Route path="/login" element={<LoginWrapper onSuccess={handleLoginSuccess} />} />

          {/* Hub Page - Unified Home (all authenticated users) */}
          <Route
            path="/hub"
            element={
              <ProtectedRoute allowedRoles={[UserRole.SERVER, UserRole.KITCHEN, UserRole.AGGREGATOR, UserRole.MANAGER]}>
                <AppLayout>
                  <HubPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Manager */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                <AppLayout>
                  <ManagerDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Settings (dedicated page) */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Aggregator */}
          <Route
            path="/aggregator"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.AGGREGATOR, UserRole.MANAGER]}
                requiredPermission="canViewAggregators"
              >
                <AppLayout>
                  <AggregatorDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Aggregator Settings (Partner Dashboard Login) */}
          <Route
            path="/aggregator/settings"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.AGGREGATOR, UserRole.MANAGER]}
                requiredPermission="canViewAggregators"
              >
                <AppLayout>
                  <AggregatorSettings />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Diagnostics Page - Available to managers */}
          <Route
            path="/diagnostics"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.MANAGER]}
                requiredPermission="canViewReports"
              >
                <AppLayout>
                  <DiagnosticsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Website Orders (Legacy) */}
          <Route
            path="/website-orders"
            element={
              <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                <AppLayout>
                  <WebsiteOrdersDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Order Status Dashboard (All Channels) */}
          <Route
            path="/order-status"
            element={
              <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                <AppLayout>
                  <OrderStatusDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Kitchen */}
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.KITCHEN, UserRole.MANAGER]}
                requiredPermission="canViewKDS"
              >
                <AppLayout>
                  <KitchenDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - POS (has its own cart, no floating cart) */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.SERVER, UserRole.MANAGER]}
                requiredPermission="canViewPOS"
              >
                <AppLayout hideCart>
                  <POSDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Service Dashboard */}
          <Route
            path="/service"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.SERVER, UserRole.MANAGER]}
                requiredPermission="canViewPOS"
              >
                <AppLayout>
                  <ServiceDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Daily Sales Report */}
          <Route
            path="/sales-report"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.MANAGER]}
                requiredPermission="canViewReports"
              >
                <AppLayout>
                  <DailySalesReport />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Inventory Management */}
          <Route
            path="/inventory"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.MANAGER]}
                requiredPermission="canViewReports"
              >
                <AppLayout>
                  <InventoryDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Bill Scanning */}
          <Route
            path="/inventory/scan"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.MANAGER]}
                requiredPermission="canViewReports"
              >
                <AppLayout>
                  <BillScanPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Default Route - Redirects based on role */}
          <Route path="/" element={<DefaultRoute />} />

          {/* 404 - Not Found */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
                  <p className="text-muted-foreground">Page not found</p>
                </div>
              </div>
            }
          />
        </Routes>
        </LockedModeGuard>
      </div>
    </HashRouter>
  );
}

export default App;
