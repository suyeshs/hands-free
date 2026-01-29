/**
 * Tauri POS App Entry Point
 * Handles tenant activation, device registration + authentication, then loads role-based dashboards
 */

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMenuStore } from './stores/menuStore';
import { useRestaurantSettingsStore } from './stores/restaurantSettingsStore';
import { useInventoryStore } from './stores/inventoryStore';
import { UserRole } from './types/auth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ManagerDashboard from './pages/ManagerDashboard';
import AggregatorDashboard from './pages-v2/AggregatorDashboard';
import AggregatorSettings from './pages-v2/AggregatorSettings';
import DiagnosticsPage from './pages-v2/DiagnosticsPage';
import SettingsPage from './pages-v2/SettingsPage';
import SettingsApp from './pages-v2/SettingsApp';
import WebsiteOrdersDashboard from './pages-v2/WebsiteOrdersDashboard';
import OrderStatusDashboard from './pages-v2/OrderStatusDashboard';
import KitchenDashboard from './pages-v2/KitchenDashboard';
import POSDashboard from './pages-v2/POSDashboard';
import GuestOrderPage from './pages-v2/GuestOrderPage';
import GuestOrderConfirmation from './pages-v2/GuestOrderConfirmation';
// ServiceDashboard replaced with OrderStatusDashboard for /service route
import TrackOrderPage from './pages-v2/TrackOrderPage';
import DailySalesReport from './pages-v2/DailySalesReport';
import { InventoryDashboard } from './pages-v2/InventoryDashboard';
import { BillScanPage } from './pages-v2/BillScanPage';
import { SuppliersPage } from './pages-v2/SuppliersPage';
import HubPage from './pages-v2/HubPage';
import ImageManagement from './pages-v2/ImageManagement';
import ChainManagementPage from './pages-v2/ChainManagementPage';
import { Login } from './pages/Login';
import TenantActivation from './pages/TenantActivation';
import { TrainingWalkthrough } from './pages/TrainingWalkthrough';
import ResetSetup from './pages/ResetSetup';
import { useTenantStore, useNeedsActivation } from './stores/tenantStore';
import { useProvisioningStore } from './stores/provisioningStore';
import { useSetupWizardStore } from './stores/setupWizardStore';
import { RestaurantDetailsWizard } from './components/settings/RestaurantDetailsWizard';
import { activateAllMenuItems } from './lib/menuSync';
import { WebSocketManager } from './components/WebSocketManager';
import { GuestOrderListener } from './components/pos/GuestOrderListener';
import { StaffCallListener } from './components/pos/StaffCallListener';
// import { TranslationGenerationProgress } from './components/TranslationGenerationProgress'; // Disabled for now
import { AppLayout } from './components/layout-v2/AppLayout';
// TEMPORARILY DISABLED: Infinite loop issue
// import { HandsfreeSetupButton } from './components/handsfree/HandsfreeSetupButton';

// Import mock orders for console testing (development)
import './lib/mockAggregatorOrders';

import { useDeviceStore } from './stores/deviceStore';
import { LockedModeGuard, getLockedModeRoute } from './components/LockedModeGuard';
import { useNavigate } from 'react-router-dom';
import { DiagnosticOverlay } from './DiagnosticOverlay';
import { useTheme } from './hooks/useTheme';
import { SKIP_AUTH } from './lib/appConfig';
import { useAuthStore } from './stores/authStore';
import { getManagerSession, checkManagerAuth } from './services/tauriAuth';
import { SettingsMigrationUI } from './components/migration/SettingsMigrationUI';
import { checkMigrationStatus } from './services/settingsMigration';
import { DatabaseMigrationUI } from './components/migration/DatabaseMigrationUI';
import { isTauri } from './lib/platform';
import { useDynamicMigrations } from './hooks/useDynamicMigrations';
import { cleanupProvisioningWebSocket } from './services/tauriSetupWizard';
import { useQROrderingStore } from './stores/qrOrderingStore';
import { listen } from '@tauri-apps/api/event';

/**
 * Wrapper for Login component that provides navigation
 */
function LoginWrapper({ onSuccess }: { onSuccess: () => void }) {
  const navigate = useNavigate();

  const handleSuccess = async () => {
    console.log('[LoginWrapper] Login success callback triggered');
    await onSuccess();
    console.log('[LoginWrapper] onSuccess completed, navigating to /');
    // Navigate to root after login - DefaultRoute will redirect to appropriate dashboard
    navigate('/', { replace: true });
    console.log('[LoginWrapper] Navigate called');
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
  // Silent render - removed excessive logging
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // FORCE RESET MODE: Clear all storage and reset app
  // To enable: Navigate to /#/reset
  const forceReset = window.location.hash === '#/reset';
  if (forceReset) {
    console.debug('[App] ===== FORCE RESET MODE =====');
    console.debug('[App] Clearing all storage...');
    localStorage.clear();
    sessionStorage.clear();
    console.debug('[App] Storage cleared, redirecting to home...');
    window.location.hash = '#/';
    window.location.reload();
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '40px',
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
          Resetting app and clearing all storage...
        </div>
      </div>
    );
  }

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    console.debug('[App] User confirmed reset');
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '#/';
    window.location.reload();
  };

  const handleResetCancel = () => {
    setShowResetConfirm(false);
  };

  // Reusable Reset Button Component
  const ResetButton = () => (
    <>
      <button
        onClick={handleResetClick}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          border: 'none',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          zIndex: 999999,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.5)';
        }}
        title="Force Reset App"
      >
        🔄
      </button>

      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
            padding: '20px',
          }}
          onClick={handleResetCancel}
        >
          <div
            style={{
              background: 'white',
              padding: '30px',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '20px' }}>
              ⚠️
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#111',
              marginBottom: '15px',
              textAlign: 'center',
            }}>
              Force Reset App?
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#666',
              marginBottom: '25px',
              textAlign: 'center',
              lineHeight: '1.5',
            }}>
              This will clear all local storage, session storage, and restart the app from scratch. You'll need to go through setup again.
            </p>
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center',
            }}>
              <button
                onClick={handleResetCancel}
                style={{
                  padding: '12px 30px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#666',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                style={{
                  padding: '12px 30px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // DIAGNOSTIC MODE: Show diagnostic overlay if localStorage has diagnostic flag
  // To enable: Open dev tools and run: localStorage.setItem('show-diagnostic', 'true')
  // Or the app will auto-show it if you navigate to /#/diagnostic
  const showDiagnostic = localStorage.getItem('show-diagnostic') === 'true' ||
    window.location.hash === '#/diagnostic';
  if (showDiagnostic) {
    return <DiagnosticOverlay />;
  }

  const [syncingMenu, setSyncingMenu] = useState(false);
  const [showDatabaseMigration, setShowDatabaseMigration] = useState(false);
  const [databaseMigrationComplete, setDatabaseMigrationComplete] = useState(false);
  const [showMigration, setShowMigration] = useState(false);

  // Skip migration check if SKIP_AUTH is enabled
  const [checkingMigration, setCheckingMigration] = useState(!SKIP_AUTH);
  const [wizardStateLoaded, setWizardStateLoaded] = useState(false);

  // CRITICAL: Load wizard state AND settings from SQLite BEFORE routing check
  useEffect(() => {
    const loadWizardState = async () => {
      try {
        console.debug('[App] 🔄 Loading wizard state from SQLite (before routing)...');
        await useSetupWizardStore.getState().loadFromSQLite();
        console.debug('[App] ✅ Wizard state loaded from SQLite');

        // CRITICAL: Load tenant config before routing check
        console.debug('[App] 🔄 Loading tenant config from SQLite...');
        await useTenantStore.getState().loadFromSQLite();
        console.debug('[App] ✅ Tenant config loaded from SQLite');

        // Clean up stale provisioning WebSocket URL if provisioning is complete
        try {
          const cleaned = await cleanupProvisioningWebSocket();
          if (cleaned) {
            // Reload wizard state to update the store with null WebSocket URL
            await useSetupWizardStore.getState().loadFromSQLite();
            console.debug('[App] ✅ Provisioning WebSocket URL cleaned up');
          }
        } catch (error) {
          console.warn('[App] Failed to cleanup provisioning WebSocket:', error);
        }

        // CRITICAL: Also load restaurant settings before routing check
        // This prevents auto-reset logic from seeing default values
        console.debug('[App] 🔄 Loading restaurant settings from SQLite (before routing)...');
        await useRestaurantSettingsStore.getState().loadFromSQLite();
        console.debug('[App] ✅ Restaurant settings loaded from SQLite');

        setWizardStateLoaded(true);
      } catch (error) {
        console.error('[App] ❌ Failed to load wizard state/settings:', error);
        // Set loaded anyway to prevent infinite loading
        setWizardStateLoaded(true);
      }
    };

    if (isTauri()) {
      loadWizardState();
    } else {
      // Not in Tauri, no SQLite - mark as loaded
      setWizardStateLoaded(true);
    }
  }, []);

  console.debug('[App] Checking activation/setup/provisioning status...');
  const needsActivation = useNeedsActivation();
  const { tenant, isActivated } = useTenantStore();
  const { isTrainingMode } = useProvisioningStore();
  const { awaitingActivation } = useSetupWizardStore();

  // Add loading state for activation completion to prevent flicker
  const [isCompletingActivation, setIsCompletingActivation] = useState(false);

  // Add loading state for auto-login to prevent routing flicker
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // Routing decision variables computed silently (no logging on every render)
  const { setUser, setTokens, switchRole, isAuthenticated } = useAuthStore();

  // Initialize theme on app load (applies dark/light class to document)
  useTheme();

  // Auto-sync dynamic migrations from cloud (on startup and every hour)
  useDynamicMigrations({
    checkOnStartup: true,
    checkIntervalMinutes: 60,
    onMigrationsApplied: (migrations) => {
      console.log('[App] Applied dynamic migrations:', migrations);
    },
    onError: (error) => {
      console.error('[App] Dynamic migration sync failed - Error message:', error.message);
      console.error('[App] Dynamic migration sync failed - Stack:', error.stack);
    },
  });

  // Restore auth state from Tauri backend session on app load
  useEffect(() => {
    const restoreAuthState = async () => {
      try {
        console.debug('[App] Checking for existing manager session...');
        const hasAuth = await checkManagerAuth();

        if (hasAuth) {
          const session = await getManagerSession();

          if (session) {
            console.debug('[App] Found valid manager session, restoring auth state');

            // Create user object from session
            const user = {
              id: session.userId,
              name: 'Manager', // Backend doesn't store name
              email: session.userId, // Use userId as email placeholder
              role: UserRole.MANAGER,
              tenantId: session.tenantId,
            };

            // Restore auth store state
            setUser(user);
            setTokens({
              accessToken: 'tauri-session',
              expiresAt: session.expiresAt,
            });
            switchRole(UserRole.MANAGER);

            console.debug('[App] Auth state restored from backend session');
          }
        } else {
          console.debug('[App] No valid manager session found');
        }
      } catch (error) {
        console.error('[App] Failed to restore auth state:', error);
      }
    };

    restoreAuthState();
  }, []);

  // Trigger database migration UI after tenant activation
  useEffect(() => {
    const checkAndRunMigrations = async () => {
      // Only start database migration if tenant is activated and not pending activation
      if (needsActivation) {
        return;
      }

      try {
        // Check if database migration was already completed in this session
        const migrationCompleted = sessionStorage.getItem('db-migration-v3.1-complete');
        if (migrationCompleted === 'true') {
          console.debug('[App] Database migration already completed this session');
          setDatabaseMigrationComplete(true);
          return;
        }

        // Check if migrations are actually needed (without running them)
        console.debug('[App] Checking if database migrations are needed...');
        const { checkMigrationsNeeded } = await import('./lib/databaseMigration');
        const needsMigration = await checkMigrationsNeeded();

        if (!needsMigration) {
          console.debug('[App] No migrations needed, database is up to date');
          setDatabaseMigrationComplete(true);
          sessionStorage.setItem('db-migration-v3.1-complete', 'true');
          return;
        }

        // Show database migration UI only if migrations are needed
        console.debug('[App] Migrations needed, showing migration UI...');
        setShowDatabaseMigration(true);
      } catch (error) {
        console.error('[App] Error checking database migrations:', error);
        // On error, assume fresh database and mark as complete
        console.debug('[App] Assuming fresh database, marking migration as complete');
        setDatabaseMigrationComplete(true);
        sessionStorage.setItem('db-migration-v3.1-complete', 'true');
      }
    };

    checkAndRunMigrations();
  }, [needsActivation]);

  // Check if settings migration is needed (from localStorage to SQLite)
  // This runs AFTER database migration is complete
  useEffect(() => {
    // Skip migration check if setup just completed
    if (sessionStorage.getItem('setup-just-completed')) {
      console.debug('[App] Setup just completed, skipping migration check');
      setCheckingMigration(false);
      return;
    }

    // In development with SKIP_AUTH, skip migration check entirely
    if (SKIP_AUTH) {
      console.debug('[App] SKIP_AUTH enabled, skipping settings migration check');
      setCheckingMigration(false);
      return;
    }

    const checkMigration = async () => {
      // Only check migration if tenant is activated and database migration is done
      if (needsActivation || !databaseMigrationComplete) {
        setCheckingMigration(false);
        return;
      }

      // Safety timeout - don't hang forever
      const timeoutId = setTimeout(() => {
        console.warn('[App] Settings migration check timed out, proceeding anyway');
        setCheckingMigration(false);
      }, 2000); // 2 second timeout

      try {
        console.debug('[App] Checking settings migration status...');
        const status = await checkMigrationStatus();
        console.debug('[App] Migration status:', status);
        setShowMigration(status.needsMigration);
      } catch (error) {
        console.error('[App] Failed to check migration status:', error);
        // On error, assume no migration needed
        setShowMigration(false);
      } finally {
        clearTimeout(timeoutId);
        setCheckingMigration(false);
      }
    };

    checkMigration();
  }, [needsActivation, databaseMigrationComplete]);

  // Dev keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+R: Reset device mode
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        const deviceStore = useDeviceStore.getState();
        deviceStore.setDeviceMode('owner');
        deviceStore.setLocked(false);
        console.debug('[App] DEV: Device mode reset to owner, unlocked');
        alert('Device mode reset to Owner and unlocked. Reloading...');
        window.location.reload();
      }

      // Ctrl+Shift+Delete OR Cmd+Shift+Backspace: NUCLEAR RESET - Clear everything and reload
      const isResetShortcut =
        (e.ctrlKey && e.shiftKey && e.key === 'Delete') ||
        (e.metaKey && e.shiftKey && e.key === 'Backspace');

      if (isResetShortcut) {
        e.preventDefault();
        console.debug('[App] NUCLEAR RESET: Clearing all storage...');
        alert('NUCLEAR RESET: Clearing all storage and reloading...');

        // Clear all localStorage
        localStorage.clear();

        // Clear all sessionStorage
        sessionStorage.clear();

        console.debug('[App] All storage cleared, reloading...');
        window.location.reload();
      }

      // Cmd+Shift+D or Ctrl+Shift+D: Toggle diagnostic overlay
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const currentValue = localStorage.getItem('show-diagnostic');
        if (currentValue === 'true') {
          localStorage.removeItem('show-diagnostic');
          console.debug('[App] Diagnostic overlay disabled');
        } else {
          localStorage.setItem('show-diagnostic', 'true');
          console.debug('[App] Diagnostic overlay enabled');
        }
        window.location.reload();
      }

    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load data from local SQLite only (no cloud sync)
  const loadLocalDataOnly = async () => {
    try {
      console.log("[App] Loading data from SQLite (no cloud sync)...");
      setSyncingMenu(true);

      // Load setup wizard state from SQLite (CRITICAL for routing)
      console.log("[App] Loading setup wizard state from SQLite...");
      await useSetupWizardStore.getState().loadFromSQLite();

      // Load restaurant settings from SQLite
      await useRestaurantSettingsStore.getState().loadFromSQLite();

      // Load menu from database
      await useMenuStore.getState().loadMenuFromDatabase();

      // Load inventory from SQLite
      if (tenant?.tenantId) {
        console.log("[App] Loading inventory from SQLite...");
        await useInventoryStore.getState().loadFromSQLite(tenant.tenantId);
      }

      console.log("[App] Local data loaded successfully");
    } catch (error) {
      console.error("[App] Failed to load local data:", error);
    } finally {
      setSyncingMenu(false);
    }
  };

  // Inventory sync on app start
  useEffect(() => {
    const { settings } = useRestaurantSettingsStore.getState();
    const onlineEnabled = settings.posSettings?.activateOnline ?? false;
    const inventorySyncEnabled = settings.posSettings?.enableInventorySync ?? false;

    if (tenant?.tenantId && isTauri() && isActivated && onlineEnabled && inventorySyncEnabled) {
      console.debug('[App] 📦 Starting inventory sync on app start (online mode enabled)...');

      // Load from SQLite first (instant)
      useInventoryStore.getState().loadFromSQLite(tenant.tenantId)
        .then(() => {
          console.debug('[App] ✅ Inventory loaded from SQLite');

          // Sync from cloud in background (non-blocking)
          useInventoryStore.getState().syncFromCloud(tenant.tenantId)
            .then(() => console.debug('[App] ✅ Inventory synced from cloud'))
            .catch((err) => console.warn('[App] ⚠️ Inventory cloud sync failed:', err));
        })
        .catch((err) => console.error('[App] ❌ Failed to load inventory from SQLite:', err));
    } else if (tenant?.tenantId && isTauri()) {
      console.debug('[App] 📦 Online mode disabled - loading inventory from SQLite only');
      // Still load from SQLite even if sync is disabled
      useInventoryStore.getState().loadFromSQLite(tenant.tenantId)
        .catch((err) => console.error('[App] ❌ Failed to load inventory from SQLite:', err));
    }
  }, [tenant?.tenantId, isActivated]);

  // Periodic inventory sync (every 5 minutes)
  useEffect(() => {
    if (!tenant?.tenantId || !isTauri()) return;

    const { settings } = useRestaurantSettingsStore.getState();
    const onlineEnabled = settings.posSettings?.activateOnline ?? false;
    const inventorySyncEnabled = settings.posSettings?.enableInventorySync ?? false;

    if (!onlineEnabled || !inventorySyncEnabled) {
      console.debug('[App] 📦 Periodic inventory sync disabled (online:', onlineEnabled, 'inventorySync:', inventorySyncEnabled, ')');
      return;
    }

    const interval = setInterval(() => {
      if (navigator.onLine && isActivated) {
        console.debug('[App] 📦 Periodic inventory sync...');
        useInventoryStore.getState().processSyncQueue()
          .catch((err) => console.warn('[App] ⚠️ Periodic sync failed:', err));
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [tenant?.tenantId, isActivated]);

  // Inventory sync on network reconnect
  useEffect(() => {
    if (!tenant?.tenantId || !isTauri()) return;

    const { settings } = useRestaurantSettingsStore.getState();
    const onlineEnabled = settings.posSettings?.activateOnline ?? false;
    const inventorySyncEnabled = settings.posSettings?.enableInventorySync ?? false;

    if (!onlineEnabled || !inventorySyncEnabled) {
      console.debug('[App] 🌐 Network reconnect inventory sync disabled (online:', onlineEnabled, ')');
      return;
    }

    const handleOnline = () => {
      if (isActivated) {
        console.debug('[App] 🌐 Network reconnected, syncing inventory to cloud...');
        useInventoryStore.getState().syncToCloud(tenant.tenantId)
          .then(() => console.debug('[App] ✅ Inventory synced after reconnect'))
          .catch((err) => console.warn('[App] ⚠️ Sync after reconnect failed:', err));
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [tenant?.tenantId, isActivated]);

  // Global tunnel URL listener - captures tunnel URL automatically when started
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        // Listen for tunnel URL events
        unlisten = await listen<string>('tunnel-url-ready', (event) => {
          const tunnelUrl = event.payload;
          console.log('[App] 🌐 Tunnel URL ready:', tunnelUrl);

          // Save to QR ordering store
          const { setTunnelUrl, setTunnelStatus } = useQROrderingStore.getState();
          setTunnelUrl(tunnelUrl);
          setTunnelStatus('online');

          console.log('[App] ✅ Tunnel URL saved to store, button should now appear in Floor Plan Manager');
        });

        console.debug('[App] ✅ Global tunnel URL listener registered');

        // Check if tunnel is already running and fetch URL
        const { invoke } = await import('@tauri-apps/api/core');
        try {
          const isRunning = await invoke<boolean>('is_tunnel_running');
          if (isRunning) {
            console.debug('[App] 🔍 Tunnel is already running, fetching URL...');
            try {
              const tunnelUrl = await invoke<string>('get_tunnel_url');
              console.log('[App] 🌐 Retrieved existing tunnel URL:', tunnelUrl);

              // Save to store
              const { setTunnelUrl, setTunnelStatus } = useQROrderingStore.getState();
              setTunnelUrl(tunnelUrl);
              setTunnelStatus('online');

              console.log('[App] ✅ Existing tunnel URL saved to store');
            } catch (urlError) {
              console.debug('[App] Tunnel running but URL not ready yet (will be caught by listener)');
            }
          }
        } catch (error) {
          console.debug('[App] Could not check tunnel status:', error);
        }
      } catch (error) {
        console.error('[App] Failed to setup tunnel URL listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Check authentication and device registration
  useEffect(() => {
    console.debug('[App] Current URL:', window.location.href);
    console.debug('[App] Hash:', window.location.hash);
    console.debug('[App] Pathname:', window.location.pathname);
    console.debug('[App] Tenant activated:', isActivated, tenant?.tenantId);

    // Skip initial sync if setup was just completed
    const setupJustCompleted = sessionStorage.getItem('setup-just-completed');
    if (setupJustCompleted === 'true') {
      console.debug('[App] Setup just completed, loading from SQLite only (no cloud sync)');
      sessionStorage.removeItem('setup-just-completed');
      loadLocalDataOnly();
      return;
    }

    // Auto-login if tenant is activated but user not authenticated (for local POS app)
    if (isActivated && tenant && !isAuthenticated && !isAutoLoggingIn) {
      console.debug('[App] Tenant activated but not authenticated, auto-logging in...');

      // Set loading state to prevent routing flicker
      setIsAutoLoggingIn(true);

      // Small delay to ensure loading screen is rendered before state changes
      setTimeout(() => {
        // Force auto-login regardless of SKIP_AUTH flag (local POS doesn't need real auth)
        const mockUser = {
          id: 'owner-1',
          email: 'owner@restaurant.local',
          name: tenant.companyName || 'Restaurant Owner',
          role: UserRole.MANAGER,
          tenantId: tenant.tenantId,
        };
        const mockTokens = {
          accessToken: 'local-access-token',
          refreshToken: 'local-refresh-token',
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        };
        useAuthStore.setState({
          user: mockUser,
          tokens: mockTokens,
          role: UserRole.MANAGER,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        console.debug('[App] ✅ Auto-login complete');

        // Brief delay before clearing loading state to ensure smooth transition
        setTimeout(() => {
          setIsAutoLoggingIn(false);
        }, 100);
      }, 50);
    }

    // Only check auth if tenant is activated
    if (isActivated && tenant) {
      checkAuth();
    }
  }, [isActivated, tenant, isAuthenticated]);

  const checkAuth = async () => {
    // Use tenant ID from store, fallback to env (no hardcoded default)
    const tenantId = tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID;

    // Post-activation processing (if coming from fresh activation)
    // NOTE: Setup completion now happens BEFORE reload in TenantActivation.tsx
    // This only handles cloud push which can be async
    const needsCloudPush = sessionStorage.getItem('activation-needs-cloud-push') === 'true';

    if (needsCloudPush && tenantId) {
      console.debug('[App] 🔄 Post-activation cloud push detected');

      try {
        console.debug('[App] Pushing local data to cloud...');
        const { initialSyncService } = await import('./lib/initialSyncService');
        const syncResult = await initialSyncService.pushAllToCloud(tenantId);

        if (syncResult.success) {
          console.debug('[App] ✅ Local data pushed to cloud successfully');
        } else {
          console.warn('[App] ⚠️ Push to cloud completed with errors:', syncResult.errors);
        }

        // Mark sync complete
        localStorage.setItem(`pos_last_sync_${tenantId}`, new Date().toISOString());
      } catch (error) {
        console.error('[App] Post-activation cloud push failed:', error);
        // Don't block app load on errors
      } finally {
        // Clear flags
        sessionStorage.removeItem('activation-needs-cloud-push');
        console.debug('[App] Post-activation cloud push complete, flags cleared');
      }
    }

    // Auto-sync menu on app load
    try {
      console.log("[App] Starting auto sync for tenant:", tenantId);
      setSyncingMenu(true);

      // Check if this is right after activation of a new restaurant
      const skipInitialSync = sessionStorage.getItem('skip-initial-sync') === 'true';
      const setupJustCompleted = sessionStorage.getItem('setup-just-completed') === 'true';

      if (skipInitialSync || setupJustCompleted) {
        console.debug('[App] ⏭️  Skipping cloud sync - new restaurant just activated (data already pushed to cloud)');

        // Load from local database only (no cloud sync)

        // CRITICAL: Load setup wizard state first (for routing)
        console.log("[App] Loading setup wizard state from SQLite...");
        await useSetupWizardStore.getState().loadFromSQLite();

        console.log("[App] Loading restaurant settings from SQLite...");
        await useRestaurantSettingsStore.getState().loadFromSQLite();

        // HOTFIX: Activate all menu items
        await activateAllMenuItems();

        // Load menu into store from database
        await useMenuStore.getState().loadMenuFromDatabase();

        // Load dine-in pricing overrides
        await useMenuStore.getState().loadDineInOverrides(tenantId);

        // Load inventory from SQLite
        if (isTauri()) {
          console.log("[App] Loading inventory from SQLite...");
          await useInventoryStore.getState().loadFromSQLite(tenantId);
        }

        // Clear the skip flag
        sessionStorage.removeItem('skip-initial-sync');
        sessionStorage.removeItem('setup-just-completed');

        console.debug('[App] ✅ Loaded from local database, skipped cloud sync');
      } else {
        // Normal flow: Load from local database only

        // CRITICAL: Load setup wizard state first (for routing)
        console.log("[App] Loading setup wizard state from SQLite...");
        await useSetupWizardStore.getState().loadFromSQLite();

        console.log("[App] Loading restaurant settings from SQLite...");
        await useRestaurantSettingsStore.getState().loadFromSQLite();

        // HOTFIX: Activate all menu items
        await activateAllMenuItems();

        // Load menu into store from database
        await useMenuStore.getState().loadMenuFromDatabase();

        // Load dine-in pricing overrides
        await useMenuStore.getState().loadDineInOverrides(tenantId);

        // Load inventory from SQLite
        if (isTauri()) {
          console.log("[App] Loading inventory from SQLite...");
          await useInventoryStore.getState().loadFromSQLite(tenantId);
        }

        console.debug('[App] ✅ Loaded from local database');
      }
    } catch (error) {
      console.error("[App] Sync/load failed:", error);
    } finally {
      setSyncingMenu(false);
    }
  };

  const handleLoginSuccess = async () => {
    console.log("[App] Login successful - navigation will proceed immediately");
    const tenantId = tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID;

    // Run sync in background after navigation (don't block UI)
    setTimeout(async () => {
      try {
        // Check if we should skip sync for new restaurant
        const skipInitialSync = sessionStorage.getItem('skip-initial-sync') === 'true';
        const setupJustCompleted = sessionStorage.getItem('setup-just-completed') === 'true';

        if (skipInitialSync || setupJustCompleted) {
          console.debug('[App] ⏭️  Skipping background sync - new restaurant (already synced)');
          return;
        }

        console.log("[App] Loading local data...");

        // Load restaurant settings from SQLite
        await useRestaurantSettingsStore.getState().loadFromSQLite();

        await useMenuStore.getState().loadMenuFromDatabase();

        // Load dine-in pricing overrides
        await useMenuStore.getState().loadDineInOverrides(tenantId);

        // Load inventory from SQLite
        if (isTauri()) {
          await useInventoryStore.getState().loadFromSQLite(tenantId);
        }

        console.log("[App] Local data loaded");
      } catch (error) {
        console.error("[App] Background sync failed:", error);
      }
    }, 100);
  };

  const handleTenantActivated = async () => {
    console.debug('[App] Tenant activated, clearing awaitingActivation flag');

    // Set loading state to prevent routing flicker during data load
    setIsCompletingActivation(true);

    try {
      // CRITICAL: Clear awaiting activation flag FIRST and AWAIT it
      // This prevents race condition where loadFromSQLite reloads the old value
      await useSetupWizardStore.getState().setAwaitingActivation(false);
      console.debug('[App] ✅ awaitingActivation flag cleared in SQLite');

      // Load tenant data from SQLite (already saved by activateTenant)
      await useTenantStore.getState().loadFromSQLite();

      // Load restaurant settings from SQLite
      await useRestaurantSettingsStore.getState().loadFromSQLite();

      // Load setup wizard state (this will now have awaitingActivation: false)
      await useSetupWizardStore.getState().loadFromSQLite();

      console.debug('[App] Tenant activation complete, data loaded - React will re-render automatically');

      // Brief delay to ensure stores have updated before removing loading state
      await new Promise(resolve => setTimeout(resolve, 100));
    } finally {
      // Clear loading state to allow routing to hub
      setIsCompletingActivation(false);
    }
  };

  // Show loading screen while completing activation to prevent routing flicker
  if (isCompletingActivation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-neutral-900 to-stone-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-300 text-lg">Completing activation...</p>
        </div>
      </div>
    );
  }

  // Show tenant activation screen if setup completed and awaiting activation
  if (awaitingActivation || needsActivation) {
    return (
      <>
        <TenantActivation onActivated={handleTenantActivated} />
        <ResetButton />
      </>
    );
  }

  // Show database migration UI
  if (showDatabaseMigration) {
    console.debug('[App] Showing database migration UI');
    return (
      <>
        <DatabaseMigrationUI
          onComplete={() => {
            console.debug('[App] Database migration complete');
            setShowDatabaseMigration(false);
            setDatabaseMigrationComplete(true);
            // Mark as complete for this session
            sessionStorage.setItem('db-migration-v3.1-complete', 'true');
          }}
        />
        <ResetButton />
      </>
    );
  }

  // Wait for migration check to complete
  if (checkingMigration) {
    console.debug('[App] Checking migration status...');
    return (
      <>
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="text-center p-8 border-4 border-blue-500 bg-blue-50 rounded-lg">
            <h1 className="text-2xl font-bold text-blue-900 mb-4">CHECKING MIGRATION STATUS</h1>
            <div className="w-10 h-10 mx-auto mb-4">
              <div className="animate-spin rounded-full h-full w-full border-3 border-blue-600 border-t-transparent"></div>
            </div>
            <p className="text-blue-800">Initializing...</p>
            <p className="text-xs text-blue-600 mt-4">If stuck, press Cmd+Option+I to open dev tools</p>
            <p className="text-xs text-blue-600">or navigate to /#/diagnostic</p>
          </div>
        </div>
        <ResetButton />
      </>
    );
  }

  // Show migration UI if old settings detected
  if (showMigration) {
    console.debug('[App] Showing settings migration UI');
    return (
      <>
        <SettingsMigrationUI
          onComplete={() => {
            console.debug('[App] Migration complete, continuing to app');
            setShowMigration(false);
            // Reload to reinitialize with migrated settings
            window.location.reload();
          }}
        />
        <ResetButton />
      </>
    );
  }

  // CRITICAL: Wait for wizard state to load from SQLite before routing
  if (!wizardStateLoaded) {
    console.debug('[App] ⏳ Waiting for wizard state to load from SQLite...');
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading wizard state...</p>
        </div>
      </div>
    );
  }

  // DEPRECATED: Skip old setup wizard - use new SimpleRestaurantOnboarding instead
  // The old SetupWizard is replaced by SimpleRestaurantOnboarding in TenantActivation

  // Show loading spinner while syncing menu
  if (syncingMenu) {
    return (
      <>
        <div className="flex items-center justify-center h-screen bg-gradient-to-b from-amber-50 to-white">
          <div className="text-center">
            {/* Logo */}
            <div className="w-32 h-32 mx-auto mb-6">
              <img
                src="/logo.png"
                alt="HandsFree Restarant OS"
                className="w-full h-full object-contain drop-shadow-lg"
                onError={(e) => {
                  // Fallback if logo not found
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            {/* Loading spinner */}
            <div className="w-10 h-10 mx-auto mb-4">
              <div className="animate-spin rounded-full h-full w-full border-3 border-amber-500 border-t-transparent"></div>
            </div>
            <p className="text-amber-800 font-bold">Syncing menu...</p>
            {tenant && (
              <p className="text-sm text-amber-600/70 mt-2">{tenant.companyName}</p>
            )}
          </div>
        </div>
        <ResetButton />
      </>
    );
  }

  // Show loading screen while auto-login is in progress
  if (isAutoLoggingIn || (isActivated && !isAuthenticated)) {
    console.debug('[App] Auto-login in progress, showing loading screen');
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-neutral-900 to-stone-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-300 text-lg">Setting up your session...</p>
        </div>
      </div>
    );
  }

  // NOTE: Login is now handled through the /login route in the HashRouter
  // No need to render Login component here - DefaultRoute will redirect unauthenticated users
  console.debug('[App] Showing main app with routes');

  return (
    <HashRouter>
      <WebSocketManager />
      <div className="h-screen w-screen overflow-x-hidden overflow-y-auto bg-background text-foreground">
        {/* Training Mode Indicator */}
        {isTrainingMode && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-950 text-center py-1 text-xs font-bold uppercase tracking-wider">
            Training Mode - Orders are not synced
          </div>
        )}
        <div className={isTrainingMode ? 'pt-6' : ''}>
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

              {/* Protected Routes - Restaurant Setup Wizard (New Hub Entry) */}
              <Route
                path="/restaurant-setup"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <AppLayout>
                      <RestaurantDetailsWizard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes - Settings (unified settings app) */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <SettingsApp />
                  </ProtectedRoute>
                }
              />

              {/* Legacy Settings Page (deprecated, keeping for migration) */}
              <Route
                path="/settings-old"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Menu Management - Shortcut to Settings > Menu */}
              <Route
                path="/menu"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <Navigate to="/settings" state={{ openCategory: 'menu-products', openSetting: 'menu' }} replace />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes - Image Management */}
              <Route
                path="/images"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                    <ImageManagement />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes - Multi Location Management */}
              <Route
                path="/multi-location"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <AppLayout>
                      <ChainManagementPage />
                    </AppLayout>
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

              {/* Protected Routes - Service Dashboard (Order Status Overview) */}
              <Route
                path="/service"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.SERVER, UserRole.MANAGER]}
                    requiredPermission="canViewPOS"
                  >
                    <AppLayout>
                      <OrderStatusDashboard />
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

              {/* Protected Routes - Suppliers Management */}
              <Route
                path="/inventory/suppliers"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.MANAGER]}
                    requiredPermission="canViewReports"
                  >
                    <AppLayout>
                      <SuppliersPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes - Voice AI Training Walkthrough */}
              <Route
                path="/training"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.SERVER, UserRole.KITCHEN, UserRole.AGGREGATOR, UserRole.MANAGER]}
                  >
                    <TrainingWalkthrough />
                  </ProtectedRoute>
                }
              />

              {/* Development Utility - Reset Setup */}
              <Route path="/reset-setup" element={<ResetSetup />} />

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

        {/* Guest Order Listener - Listen for QR code orders */}
        <GuestOrderListener />

        {/* Staff Call Listener - Listen for customer service requests */}
        <StaffCallListener />

        {/* Handsfree Setup Assistant - Voice-based settings assistant */}
        {/* TEMPORARILY DISABLED: Infinite loop issue - TODO: Fix and re-enable */}
        {/* <HandsfreeSetupButton variant="floating" size="md" showTranscript={false} /> */}

        {/* Translation Generation - Auto-generates translations after setup */}
        {/* COMMENTED OUT: Translation generation disabled for now */}
        {/* <TranslationGenerationProgress autoStart={true} /> */}

        {/* Floating Reset Button - Always visible */}
        <ResetButton />
      </div>
    </HashRouter>
  );
}

export default App;
