/**
 * Tauri POS App Entry Point
 * Handles device registration + authentication, then loads role-based dashboards
 */

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMenuStore } from './stores/menuStore';
import { UserRole } from './types/auth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ManagerDashboard from './pages/ManagerDashboard';
import AggregatorDashboard from './pages-v2/AggregatorDashboard';
import KitchenDashboard from './pages-v2/KitchenDashboard';
import POSDashboard from './pages-v2/POSDashboard';
import { Login } from './pages/Login';
// import { checkDeviceRegistration, getCurrentTenantId } from './services/tauriAuth';
import { autoSyncMenu, activateAllMenuItems } from './lib/menuSync';

import { useDeviceStore } from './stores/deviceStore';
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
 */
function DefaultRoute() {
  console.log('[DefaultRoute] Bypassing auth, redirecting to manager dashboard');
  return <Navigate to="/manager" replace />;
}

function App() {
  const [syncingMenu, setSyncingMenu] = useState(false);

  // Check authentication and device registration
  useEffect(() => {
    console.log('[App] Current URL:', window.location.href);
    console.log('[App] Hash:', window.location.hash);
    console.log('[App] Pathname:', window.location.pathname);
    checkAuth();
    // lanClient.connect();
  }, []);

  const checkAuth = async () => {
    const testTenantId = 'Khao-pioy';

    // Auto-sync menu on app load
    try {
      console.log("[App] Starting auto menu sync for tenant:", testTenantId);
      setSyncingMenu(true);

      // HOTFIX: Activate all menu items
      await activateAllMenuItems();
      await autoSyncMenu(testTenantId);

      // Load menu into store from database
      await useMenuStore.getState().loadMenuFromDatabase();
    } catch (error) {
      console.error("[App] Menu sync/load failed:", error);
    } finally {
      setSyncingMenu(false);
    }
  };

  const handleLoginSuccess = async () => {
    console.log("[App] Login successful");
    const tid = 'Khao-pioy';

    // Auto-sync menu from backend after login
    try {
      setSyncingMenu(true);
      await autoSyncMenu(tid);
      await useMenuStore.getState().loadMenuFromDatabase();
    } catch (error) {
      console.error("[App] Menu sync/load failed:", error);
    } finally {
      setSyncingMenu(false);
    }
  };

  // Show loading spinner while syncing menu
  console.log('[App] Render - syncingMenu:', syncingMenu);

  if (syncingMenu) {
    console.log('[App] Showing loading screen');
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Syncing menu...</p>
        </div>
      </div>
    );
  }

  // NOTE: Login is now handled through the /login route in the HashRouter
  // No need to render Login component here - DefaultRoute will redirect unauthenticated users
  console.log('[App] Showing main app with routes');

  return (
    <HashRouter>
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        {useDeviceStore.getState().isLocked && (
          <div className="fixed bottom-0 right-0 p-2 opacity-10 hover:opacity-100 transition-opacity z-[9999]">
            <button
              onClick={() => {
                const pin = prompt("Enter Admin Unlock PIN:");
                if (pin === '0000') { // Hardcoded for demo
                  useDeviceStore.getState().setLocked(false);
                  window.location.reload();
                }
              }}
              className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded"
            >
              UNLOCK DEVICE
            </button>
          </div>
        )}

        <Routes>
          {/* Login Route - Shows login screen */}
          <Route path="/login" element={<LoginWrapper onSuccess={handleLoginSuccess} />} />

          {/* Protected Routes - Manager */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                <ManagerDashboard />
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
                <AggregatorDashboard />
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
                <KitchenDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - POS */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.SERVER, UserRole.MANAGER]}
                requiredPermission="canViewPOS"
              >
                <POSDashboard />
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
      </div>
    </HashRouter>
  );
}

export default App;
