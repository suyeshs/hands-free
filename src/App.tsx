/**
 * Tauri POS App Entry Point
 * Handles device registration + authentication, then loads role-based dashboards
 */

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useMenuStore } from './stores/menuStore';
import { UserRole } from './types/auth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ManagerDashboard from './pages/ManagerDashboard';
import AggregatorDashboard from './pages-v2/AggregatorDashboard';
import KitchenDashboard from './pages-v2/KitchenDashboard';
import POSDashboard from './pages-v2/POSDashboard';
import { WebSocketManager } from './components/WebSocketManager';
import { Login } from './pages/Login';
// import { checkDeviceRegistration, getCurrentTenantId } from './services/tauriAuth';
import { autoSyncMenu, activateAllMenuItems } from './lib/menuSync';
import { lanClient } from './lib/lanClient';

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
  const { isAuthenticated, role } = useAuthStore();
  const { isLocked, deviceMode } = useDeviceStore();

  console.log('[DefaultRoute] Auth status:', { isAuthenticated, role, isLocked, deviceMode });

  // If locked, redirect to specific dashboard immediately
  if (isLocked) {
    switch (deviceMode) {
      case 'pos': return <Navigate to="/pos" replace />;
      case 'kds': return <Navigate to="/kitchen" replace />;
      case 'aggregator': return <Navigate to="/aggregator" replace />;
      // 'customer' would go to a kiosk view if implemented
      default: break;
    }
  }

  if (!isAuthenticated) {
    console.log('[DefaultRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  console.log('[DefaultRoute] Authenticated as:', role);
  switch (role) {
    case UserRole.MANAGER:
      return <Navigate to="/manager" replace />;
    case UserRole.AGGREGATOR:
      return <Navigate to="/aggregator" replace />;
    case UserRole.KITCHEN:
      return <Navigate to="/kitchen" replace />;
    case UserRole.SERVER:
      return <Navigate to="/pos" replace />;
    default:
      console.log('[DefaultRoute] Unknown role, defaulting to POS');
      return <Navigate to="/pos" replace />; // Default to POS for staff
  }
}

function App() {
  const [isDeviceRegistered, setIsDeviceRegistered] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncingMenu, setSyncingMenu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Check authentication and device registration
  useEffect(() => {
    console.log('[App] Current URL:', window.location.href);
    console.log('[App] Hash:', window.location.hash);
    console.log('[App] Pathname:', window.location.pathname);
    checkAuth();
    lanClient.connect();
  }, []);

  const checkAuth = async () => {
    try {
      // TESTING: Bypass keychain device registration
      // Uncomment below to re-enable keychain auth
      /*
      const deviceStatus = await checkDeviceRegistration();
      setIsDeviceRegistered(deviceStatus.isRegistered);

      if (deviceStatus.isRegistered && deviceStatus.tenantId) {
        setTenantId(deviceStatus.tenantId);
        const authenticated = await isAuthenticated();

        if (authenticated) {
          // Populate authStore with current session data
          const authStore = useAuthStore.getState();
          const { getManagerSession, getStaffSession } = await import('./services/tauriAuth');
          const managerSession = await getManagerSession();
          const staffSession = await getStaffSession();

          if (managerSession) {
            authStore.setUser({
              id: managerSession.userId,
              email: '',
              name: deviceStatus.tenantName || 'Manager',
              tenantId: deviceStatus.tenantId,
              role: UserRole.MANAGER,
            });
            authStore.switchRole(UserRole.MANAGER);
          } else if (staffSession) {
            const staffRole = staffSession.role === 'kitchen' ? UserRole.KITCHEN
                            : staffSession.role === 'waiter' ? UserRole.SERVER
                            : UserRole.SERVER;

            authStore.setUser({
              id: staffSession.staffId,
              email: '',
              name: staffSession.name,
              tenantId: deviceStatus.tenantId,
              role: staffRole,
            });
            authStore.switchRole(staffRole);
          }
        } else {
          setShowLogin(true);
        }
      }
      */

      // TESTING MODE: Check if we should skip auth entirely
      const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
      const testTenantId = import.meta.env.VITE_DEFAULT_TENANT_ID || 'khao-piyo-7766';
      console.log("[App] TESTING MODE: VITE_SKIP_AUTH =", skipAuth);

      setIsDeviceRegistered(true);
      setTenantId(testTenantId);

      const authStore = useAuthStore.getState();

      if (skipAuth) {
        // Complete bypass - no keychain access, use mock auth
        console.log("[App] Bypassing all authentication (no keychain access)");
        authStore.autoLogin();
        console.log("[App] Auto-login completed, authenticated:", authStore.isAuthenticated);
      } else {
        // Normal mode - check if user already has valid session from login
        console.log("[App] Checking for existing authentication session");

        // Check if there's a valid session in authStore (from previous login)
        if (authStore.isAuthenticated && authStore.isTokenValid()) {
          console.log("[App] Found valid existing session, user:", authStore.user?.id);
          // Session exists and is valid, don't show login
        } else {
          console.log("[App] No valid session found, showing login form");
          setShowLogin(true); // Show login form
        }
      }

      // Auto-sync menu on app load (only if authenticated)
      try {
        console.log("[App] Starting auto menu sync for tenant:", testTenantId);
        setSyncingMenu(true);

        // HOTFIX: Activate all menu items (fixes items with active=0)
        console.log("[App] Activating all menu items...");
        await activateAllMenuItems();

        await autoSyncMenu(testTenantId);
        console.log("[App] Menu sync complete");

        // Load menu into store from database
        console.log("[App] Loading menu into store from database");
        await useMenuStore.getState().loadMenuFromDatabase();
        console.log("[App] Menu loaded into store");
      } catch (error) {
        console.error("[App] Menu sync/load failed:", error);
      } finally {
        console.log("[App] Setting syncingMenu to false");
        setSyncingMenu(false);
      }

    } catch (error) {
      console.error("[App] Failed to check auth:", error);
    } finally {
      console.log("[App] Setting authLoading to false");
      setAuthLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    console.log("[App] Login successful");

    // Get tenant ID from device registration or env
    const tid = import.meta.env.VITE_DEFAULT_TENANT_ID || 'khao-piyo-7766';
    setTenantId(tid);

    // Load session from Tauri keychain and populate authStore
    const authStore = useAuthStore.getState();
    const { getManagerSession, getStaffSession } = await import('./services/tauriAuth');

    const managerSession = await getManagerSession();
    const staffSession = await getStaffSession();

    console.log("[App] Manager session:", managerSession);
    console.log("[App] Staff session:", staffSession);

    if (managerSession) {
      // Manager login - set tokens and user info
      console.log("[App] Loading manager session into authStore");

      authStore.setTokens({
        accessToken: 'tauri-session-token', // Placeholder - actual token is in keychain
        refreshToken: 'tauri-session-refresh',
        expiresAt: managerSession.expiresAt * 1000, // Convert to milliseconds
      });

      authStore.setUser({
        id: managerSession.userId,
        email: '',
        name: 'Manager',
        tenantId: tid,
        role: UserRole.MANAGER,
      });
      authStore.switchRole(UserRole.MANAGER);

      console.log("[App] Manager session loaded, user authenticated");
    } else if (staffSession) {
      // Staff login - set based on staff role
      console.log("[App] Loading staff session into authStore");

      const staffRole = staffSession.role === 'kitchen' ? UserRole.KITCHEN
        : staffSession.role === 'waiter' ? UserRole.SERVER
          : UserRole.SERVER;

      authStore.setTokens({
        accessToken: 'tauri-staff-token',
        refreshToken: 'tauri-staff-refresh',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      authStore.setUser({
        id: staffSession.staffId,
        email: '',
        name: staffSession.name,
        tenantId: tid,
        role: staffRole,
      });
      authStore.switchRole(staffRole);

      console.log("[App] Staff session loaded, user authenticated");
    }

    // Auto-sync menu from backend after login
    try {
      console.log("[App] Starting menu sync for tenant:", tid);
      setSyncingMenu(true);
      await autoSyncMenu(tid);
      console.log("[App] Menu sync complete");

      // Load menu into store from database
      console.log("[App] Loading menu into store from database");
      await useMenuStore.getState().loadMenuFromDatabase();
      console.log("[App] Menu loaded into store");
    } catch (error) {
      console.error("[App] Menu sync/load failed:", error);
    } finally {
      setSyncingMenu(false);
    }

    // Hide login screen and show app
    setShowLogin(false);
    console.log("[App] Login flow complete, authenticated:", authStore.isAuthenticated);
  };

  // Show loading spinner while checking auth or syncing menu
  console.log('[App] Render - authLoading:', authLoading, 'syncingMenu:', syncingMenu, 'isDeviceRegistered:', isDeviceRegistered, 'showLogin:', showLogin);

  if (authLoading || syncingMenu) {
    console.log('[App] Showing loading screen');
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Loading...' : 'Syncing menu...'}
          </p>
        </div>
      </div>
    );
  }

  // NOTE: Login is now handled through the /login route in the HashRouter
  // No need to render Login component here - DefaultRoute will redirect unauthenticated users
  console.log('[App] Showing main app with routes');

  return (
    <HashRouter>
      {/* WebSocket connection manager (active when user is authenticated) */}
      <WebSocketManager />

      {/* Admin Unlock Trigger for Locked Devices */}
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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-gray-600">Page not found</p>
              </div>
            </div>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App;
