/**
 * Tauri POS App Entry Point
 * Handles tenant activation, device registration + authentication, then loads role-based dashboards
 */

import { useEffect, useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMenuStore } from './stores/menuStore';
import { useRestaurantSettingsStore } from './stores/restaurantSettingsStore';
// NOTE: Inventory store import removed - will be imported by inventory plugin
// import { useInventoryStore } from './stores/inventoryStore';
import { UserRole } from './types/auth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { buildConfig, isRouteAllowed } from './config/buildConfig';
import ManagerDashboard from './pages/ManagerDashboard';
import AggregatorDashboard from './pages-v2/AggregatorDashboard';
import AggregatorSettings from './pages-v2/AggregatorSettings';
import DiagnosticsPage from './pages-v2/DiagnosticsPage';
import SettingsPage from './pages-v2/SettingsPage';
import SettingsApp from './pages-v2/SettingsApp';
import D1SyncTest from './pages-v2/D1SyncTest';
import CoorgMigrationPage from './pages/CoorgMigrationPage';
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
import CameraFeedPage from './pages-v2/CameraFeedPage';
// Subscription components
import { SubscriptionDashboard } from './components/subscriptions/SubscriptionDashboard';
import { SubscriptionPlans } from './components/subscriptions/SubscriptionPlans';
import { SubscriptionMenuManager } from './components/subscriptions/SubscriptionMenuManager';
import { SubscriptionKDS } from './components/subscriptions/SubscriptionKDS';
import { ParcelDispatchScreen } from './components/subscriptions/ParcelDispatchScreen';
import { SubscriptionChangelog } from './components/subscriptions/SubscriptionChangelog';
import { SubscriptionMenuImporter } from './components/subscriptions/SubscriptionMenuImporter';
// Debug utilities - lazy loaded to improve startup time
// Access via: await import('./lib/kdsDebugUtils') when needed
// import './lib/kdsDebugUtils';
// import './lib/kotDiagnostic';
// import './lib/getActivationCode';
import { Login } from './pages/Login';
import TenantActivation from './pages/TenantActivation';
import { TrainingWalkthrough } from './pages/TrainingWalkthrough';
import ResetSetup from './pages/ResetSetup';
import CompleteReset from './pages/CompleteReset';
import { useTenantStore, useNeedsActivation } from './stores/tenantStore';
import { useProvisioningStore } from './stores/provisioningStore';
import { useSetupWizardStore } from './stores/setupWizardStore';
import { RestaurantDetailsWizard } from './components/settings/RestaurantDetailsWizard';
import { CompanyRegistrationWizard } from './components/setup/CompanyRegistrationWizard';
import { useNeedsCompanySetup } from './hooks/useNeedsCompanySetup';
import { activateAllMenuItems } from './lib/menuSync';
import { WebSocketManager } from './components/WebSocketManager';
import { GuestOrderListener } from './components/pos/GuestOrderListener';
import { StaffCallListener } from './components/pos/StaffCallListener';
// import { TranslationGenerationProgress } from './components/TranslationGenerationProgress'; // Disabled for now
import { AppLayout } from './components/layout-v2/AppLayout';
// TEMPORARILY DISABLED: Infinite loop issue
// import { HandsfreeSetupButton } from './components/handsfree/HandsfreeSetupButton';

// Mock orders - lazy loaded to improve startup time
// Access via: await import('./lib/mockAggregatorOrders') when needed
// import './lib/mockAggregatorOrders';

import { useDeviceStore } from './stores/deviceStore';
import { LockedModeGuard, getLockedModeRoute } from './components/LockedModeGuard';
import { useNavigate } from 'react-router-dom';
import { DiagnosticOverlay } from './DiagnosticOverlay';
import { ThemeProvider } from './components/ThemeProvider';
import { SKIP_AUTH } from './lib/appConfig';
import { useAuthStore } from './stores/authStore';
import { getManagerSession, checkManagerAuth } from './services/tauriAuth';
import { SettingsMigrationUI } from './components/migration/SettingsMigrationUI';
import { checkMigrationStatus } from './services/settingsMigration';
import { DatabaseMigrationUI } from './components/migration/DatabaseMigrationUI';
import { isTauri } from './lib/platform';
import { useDynamicMigrations } from './hooks/useDynamicMigrations';
// import { cleanupProvisioningWebSocket } from './services/tauriSetupWizard'; // Removed - no store loading on startup
// Tunnel/QR ordering moved to settings - no longer needed on startup
// import { useQROrderingStore } from './stores/qrOrderingStore';
// import { listen } from '@tauri-apps/api/event';
import { NetworkProvider } from './contexts/NetworkContext';
import { useAutoAttendance } from './hooks/useAutoAttendance';
import { useLeaveStore } from './stores/leaveStore';
import { KOTPrintModal } from './components/print/KOTPrintModal';
import { printerService } from './lib/printerService';
// import { usePrinterStore } from './stores/printerStore';
import { KitchenOrder } from './types/kds';
import { getTieredSyncManager } from './services/sync/TieredSyncManager';
import { getDatabaseFilePath } from './lib/database';

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
 * Build Variant Route Guard
 * Blocks routes not allowed in staff build
 */
function BuildVariantGuard({ children, path }: { children: ReactNode; path: string }) {
  if (!isRouteAllowed(path)) {
    console.warn(`[BuildVariantGuard] Route ${path} not allowed in ${buildConfig.variant} build`);
    return <Navigate to="/hub" replace />;
  }
  return <>{children}</>;
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

/**
 * Auto-Attendance Initializer
 * Calls useAutoAttendance hook to set up WiFi-based auto clock-in
 * Must be inside NetworkProvider
 */
function AutoAttendanceInitializer() {
  useAutoAttendance();
  return null; // This component only sets up the hook, renders nothing
}

function App() {
  // Silent render - removed excessive logging

  // KOT Print Modal State
  const [kotPrintModalOpen, setKotPrintModalOpen] = useState(false);
  const [kotPrintOrder, setKotPrintOrder] = useState<KitchenOrder | null>(null);
  const [kotPrintRestaurantName, setKotPrintRestaurantName] = useState<string>('Restaurant');
  const [kotPrintStationFilter, setKotPrintStationFilter] = useState<string | undefined>(undefined);
  const [kotPrintResolve, setKotPrintResolve] = useState<((success: boolean) => void) | null>(null);
  // const { config: printerConfig } = usePrinterStore();

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
  const [showPluginMigration, setShowPluginMigration] = useState(false); // Disabled: Phase 3 feature
  const [checkingPluginMigration, setCheckingPluginMigration] = useState(false);

  // No migration check on startup - fresh installs don't need it
  // Prior installs use separate migration app (Coorg Migration Tool)
  // Stores load on-demand when needed, not on app startup
  const [checkingMigration] = useState(false);
  const [wizardStateLoaded] = useState(true);

  // Auth state (needed early for routing logic)
  const { setUser, setTokens, switchRole, isAuthenticated } = useAuthStore();

  // Activation/setup status
  const needsActivation = useNeedsActivation();
  const needsCompanySetup = useNeedsCompanySetup();
  const { tenant, isActivated } = useTenantStore();
  const { isTrainingMode } = useProvisioningStore();
  const { awaitingActivation } = useSetupWizardStore();

  // Add loading state for activation completion to prevent flicker
  const [isCompletingActivation, setIsCompletingActivation] = useState(false);

  // Add loading state for tenant config loading to prevent routing before tenant is checked
  const [isLoadingTenantConfig, setIsLoadingTenantConfig] = useState(true);

  // Debug logging for routing decisions (only in dev)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[App] 🔄 Routing state check:', {
        needsActivation,
        needsCompanySetup,
        isActivated,
        hasTenant: !!tenant,
        tenantId: tenant?.tenantId,
        awaitingActivation,
        isCompletingActivation,
        isLoadingTenantConfig,
      });
    }
  }, [needsActivation, needsCompanySetup, isActivated, tenant, awaitingActivation, isCompletingActivation, isLoadingTenantConfig]);

  // Add loading state for auto-login to prevent routing flicker
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

  // CRITICAL: Load tenant config from SQLite on app startup
  useEffect(() => {
    const loadTenantConfig = async () => {
      try {
        console.debug('[App] 🔄 Loading tenant config from SQLite on startup...');
        setIsLoadingTenantConfig(true);
        await useTenantStore.getState().loadFromSQLite();
        console.debug('[App] ✅ Tenant config loaded from SQLite');
      } catch (error) {
        console.error('[App] ❌ Failed to load tenant config:', error);
      } finally {
        setIsLoadingTenantConfig(false);
      }
    };

    loadTenantConfig();
  }, []); // Run once on mount

  // Register KOT Print Modal callback with printerService
  useEffect(() => {
    const callback = (
      order: KitchenOrder,
      restaurantName: string,
      stationFilter?: string
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setKotPrintOrder(order);
        setKotPrintRestaurantName(restaurantName);
        setKotPrintStationFilter(stationFilter);
        setKotPrintModalOpen(true);
        setKotPrintResolve(() => resolve);
      });
    };

    printerService.setKotModalCallback(callback);
    console.log('[App] ✓ KOT print modal callback registered');

    return () => {
      // Cleanup on unmount (though App rarely unmounts)
      printerService.setKotModalCallback(undefined as any);
    };
  }, []);

  // Handle KOT Print Modal close
  const handleKotPrintModalClose = (success: boolean) => {
    setKotPrintModalOpen(false);
    if (kotPrintResolve) {
      kotPrintResolve(success);
      setKotPrintResolve(null);
    }
    setKotPrintOrder(null);
  };

  // DISABLED: Global dynamic migrations replaced by plugin-based migrations
  // With the new WASM plugin architecture, migrations are applied when plugins are installed
  // Each plugin defines its own migrations via manifest.data.migration_path
  // Dynamic migrations from R2 (Option 3: Hybrid Clean)
  // - Fresh installs: Use 001_init_schema.sql (complete schema, fast)
  // - Upgrades: Fetch and apply incremental migrations from R2
  // - Plugins: Separate migration system (see pluginManager.ts)
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
      // Migration check removed - using separate migration app
      return;
    }

    // In development with SKIP_AUTH, skip migration check entirely
    if (SKIP_AUTH) {
      console.debug('[App] SKIP_AUTH enabled, skipping settings migration check');
      // Migration check removed - using separate migration app
      return;
    }

    const checkMigration = async () => {
      // Only check migration if tenant is activated and database migration is done
      if (needsActivation || !databaseMigrationComplete) {
        // Migration check removed - using separate migration app
        return;
      }

      // Safety timeout - don't hang forever
      const timeoutId = setTimeout(() => {
        console.warn('[App] Settings migration check timed out, proceeding anyway');
        // Migration check removed - using separate migration app
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
        // Migration check removed - using separate migration app
      }
    };

    checkMigration();
  }, [needsActivation, databaseMigrationComplete]);

  // Check if plugin migration is needed
  useEffect(() => {
    const checkPluginMigration = async () => {
      if (needsActivation || !databaseMigrationComplete) {
        return;
      }

      setCheckingPluginMigration(true);

      try {
        const { initializePluginManager } = await import('./services/plugins/pluginManager');
        const pluginManager = await initializePluginManager(tenant?.tenantId || 'default');

        // DISABLED: Plugin migration UI (Phase 3 feature)
        // const needsMigration = await pluginManager.needsPluginMigration();
        const needsMigration = false; // Always skip migration for now

        if (needsMigration) {
          console.log('[App] Plugin migration needed - core features will be extracted to plugins');
          setShowPluginMigration(true);
        } else {
          // Auto-install required plugins if missing (for fresh installs or after migration)
          console.log('[App] Checking for required plugins...');

          // Get restaurant settings for auto-detection
          const restaurantSettings = useRestaurantSettingsStore.getState().settings;

          await pluginManager.autoInstallRequiredPlugins({
            restaurantType: restaurantSettings.restaurantType,
            address: {
              state: restaurantSettings.address?.state,
              city: restaurantSettings.address?.city,
              pincode: restaurantSettings.address?.pincode,
            },
          });
        }
      } catch (error) {
        console.error('[App] Failed to check plugin migration:', error);
      } finally {
        setCheckingPluginMigration(false);
      }
    };

    checkPluginMigration();
  }, [needsActivation, databaseMigrationComplete, tenant?.tenantId]);

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

      // NOTE: Inventory loading removed - will be handled by inventory plugin
      // // Load inventory from SQLite
      // if (tenant?.tenantId) {
      //   console.log("[App] Loading inventory from SQLite...");
      //   await useInventoryStore.getState().loadFromSQLite(tenant.tenantId);
      // }

      // Load leave requests from database (critical for auto-attendance)
      if (tenant?.tenantId) {
        console.log("[App] Loading leave requests from database...");
        await useLeaveStore.getState().loadRequestsFromDatabase(tenant.tenantId);
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

    // NOTE: Inventory sync removed - will be handled by inventory plugin
    // if (tenant?.tenantId && isTauri() && isActivated && onlineEnabled && inventorySyncEnabled) {
    //   console.debug('[App] 📦 Starting inventory sync on app start (online mode enabled)...');
    //   useInventoryStore.getState().loadFromSQLite(tenant.tenantId)
    //     .then(() => {
    //       console.debug('[App] ✅ Inventory loaded from SQLite');
    //       useInventoryStore.getState().syncFromCloud(tenant.tenantId)
    //         .then(() => console.debug('[App] ✅ Inventory synced from cloud'))
    //         .catch((err) => console.warn('[App] ⚠️ Inventory cloud sync failed:', err));
    //     })
    //     .catch((err) => console.error('[App] ❌ Failed to load inventory from SQLite:', err));
    // } else if (tenant?.tenantId && isTauri()) {
    //   console.debug('[App] 📦 Online mode disabled - loading inventory from SQLite only');
    //   useInventoryStore.getState().loadFromSQLite(tenant.tenantId)
    //     .catch((err) => console.error('[App] ❌ Failed to load inventory from SQLite:', err));
    // }
  }, [tenant?.tenantId, isActivated]);

  // Initialize theme system on app start
  useEffect(() => {
    if (!tenant?.tenantId || !isActivated) return;

    console.log('[App] 🎨 Initializing theme system...');

    // Dynamically import to avoid circular dependencies
    import('./stores/themeStore').then(({ initializeThemeSystem }) => {
      initializeThemeSystem()
        .then(() => {
          console.log('[App] ✅ Theme system initialized successfully');
        })
        .catch((err) => {
          console.error('[App] ❌ Failed to initialize theme system:', err);
          // Don't block app if theme fails - continue with default styling
        });
    });
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

    // NOTE: Inventory periodic sync removed - will be handled by inventory plugin
    // const interval = setInterval(() => {
    //   if (navigator.onLine && isActivated) {
    //     console.debug('[App] 📦 Periodic inventory sync...');
    //     useInventoryStore.getState().processSyncQueue()
    //       .catch((err) => console.warn('[App] ⚠️ Periodic sync failed:', err));
    //   }
    // }, 5 * 60 * 1000); // 5 minutes
    // return () => clearInterval(interval);
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

    // NOTE: Inventory online sync removed - will be handled by inventory plugin
    // const handleOnline = () => {
    //   if (isActivated) {
    //     console.debug('[App] 🌐 Network reconnected, syncing inventory to cloud...');
    //     useInventoryStore.getState().syncToCloud(tenant.tenantId)
    //       .then(() => console.debug('[App] ✅ Inventory synced after reconnect'))
    //       .catch((err) => console.warn('[App] ⚠️ Sync after reconnect failed:', err));
    //   }
    // };

    // window.addEventListener('online', handleOnline);
    // return () => window.removeEventListener('online', handleOnline);
  }, [tenant?.tenantId, isActivated]);

  // Global tunnel URL listener - captures tunnel URL automatically when started
  // Tunnel listener moved to QR ordering settings component
  // Only loads when QR ordering is explicitly enabled
  // Previously registered on app startup - now deferred to settings
  // useEffect(() => { ... }, []);

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
        // Get owner name from restaurant settings if available
        const { settings } = useRestaurantSettingsStore.getState();
        const ownerName = settings?.ownerName || 'Restaurant Owner';

        const mockUser = {
          id: 'owner-1',
          email: 'owner@restaurant.local',
          name: ownerName,
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

      // Initialize TieredSyncManager ONLY after complete setup
      // Don't start sync if setup is incomplete or just completed
      if (isTauri() && tenantId && isActivated && !skipInitialSync && !setupJustCompleted && !needsActivation) {
        try {
          const dbPath = await getDatabaseFilePath();
          const syncManager = getTieredSyncManager(tenantId, dbPath);
          await syncManager.start();
          console.log('[App] ✅ TieredSyncManager started - background operations will be coordinated');
        } catch (error) {
          console.warn('[App] Failed to start TieredSyncManager:', error);
          // Don't block app load if sync manager fails
        }
      } else {
        console.log('[App] ⏭️  Skipping TieredSyncManager - setup not complete or just completed');
      }

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

        // NOTE: Inventory loading removed - will be handled by inventory plugin
        // // Load inventory from SQLite
        // if (isTauri()) {
        //   console.log("[App] Loading inventory from SQLite...");
        //   await useInventoryStore.getState().loadFromSQLite(tenantId);
        // }

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

        // NOTE: Inventory loading removed - will be handled by inventory plugin
        // // Load inventory from SQLite
        // if (isTauri()) {
        //   console.log("[App] Loading inventory from SQLite...");
        //   await useInventoryStore.getState().loadFromSQLite(tenantId);
        // }

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

        // NOTE: Inventory loading removed - will be handled by inventory plugin
        // // Load inventory from SQLite
        // if (isTauri()) {
        //   await useInventoryStore.getState().loadFromSQLite(tenantId);
        // }

        console.log("[App] Local data loaded");
      } catch (error) {
        console.error("[App] Background sync failed:", error);
      }
    }, 100);
  };

  const handleTenantActivated = async () => {
    console.debug('[App] ===== TENANT ACTIVATION COMPLETE CALLBACK =====');
    console.debug('[App] Timestamp:', new Date().toISOString());

    // Set loading state to prevent routing flicker during data load
    setIsCompletingActivation(true);

    try {
      // CRITICAL: Clear awaiting activation flag FIRST and AWAIT it
      // This prevents race condition where loadFromSQLite reloads the old value
      console.debug('[App] Clearing awaitingActivation flag...');
      await useSetupWizardStore.getState().setAwaitingActivation(false);
      console.debug('[App] ✅ awaitingActivation flag cleared in SQLite');

      // Load tenant data from SQLite (already saved by activateTenant)
      console.debug('[App] Loading tenant from SQLite...');
      await useTenantStore.getState().loadFromSQLite();
      const { tenant, isActivated } = useTenantStore.getState();
      console.debug('[App] Tenant loaded - isActivated:', isActivated, 'tenantId:', tenant?.tenantId);

      if (!tenant || !isActivated) {
        console.error('[App] ❌ CRITICAL: Tenant not loaded from SQLite after activation!');
        alert('Activation completed but tenant data not loaded. Please restart the app.');
        return;
      }

      // Load restaurant settings from SQLite
      console.debug('[App] Loading restaurant settings from SQLite...');
      await useRestaurantSettingsStore.getState().loadFromSQLite();
      console.debug('[App] ✅ Restaurant settings loaded');

      // Load setup wizard state (this will now have awaitingActivation: false)
      console.debug('[App] Loading setup wizard state from SQLite...');
      await useSetupWizardStore.getState().loadFromSQLite();
      const { awaitingActivation, isComplete } = useSetupWizardStore.getState();
      console.debug('[App] Setup wizard loaded - awaitingActivation:', awaitingActivation, 'isComplete:', isComplete);

      console.debug('[App] ✅ Tenant activation complete, data loaded - React will re-render automatically');
      console.debug('[App] ===============================================');

      // Brief delay to ensure stores have updated before removing loading state
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('[App] ❌ Error in handleTenantActivated:', error);
      alert('Error completing activation. Please restart the app. Error: ' + (error instanceof Error ? error.message : 'Unknown'));
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

  // Show loading screen while tenant config is being loaded from SQLite
  // This prevents routing decisions before we know if a tenant exists
  if (isLoadingTenantConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-neutral-900 to-stone-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-300 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show tenant activation screen if setup completed and awaiting activation
  if (awaitingActivation || needsActivation) {
    console.debug('[App] 🔄 Showing TenantActivation screen because:', {
      awaitingActivation,
      needsActivation,
      reason: awaitingActivation ? 'awaitingActivation=true' : 'needsActivation=true',
    });
    return (
      <>
        <TenantActivation onActivated={handleTenantActivated} />
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
      </>
    );
  }

  // Wait for migration check to complete
  if (checkingMigration) {
    console.debug('[App] Checking migration status...');
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-surface-1 to-surface-2 flex items-center justify-center">
          {/* Animated background orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-saffron/10 to-transparent blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          <div className="relative z-10 text-center">
            {/* Animated Guanix Logo */}
            <motion.div
              className="relative mx-auto w-32 h-32 mb-8"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <img
                src="/guanix-logo.jpeg"
                alt="Guanix Restaurant"
                className="w-full h-full object-contain rounded-2xl"
              />
              {/* Spinning ring around logo */}
              <motion.div
                className="absolute inset-0 rounded-2xl border-4 border-saffron/30 border-t-saffron"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            </motion.div>

            <h2 className="text-2xl font-bold mb-2">Guanix Restaurant</h2>
            <p className="text-muted-foreground">Starting up...</p>
          </div>
        </div>
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
      </>
    );
  }

  // Show plugin migration UI if needed
  if (showPluginMigration) {
    console.debug('[App] Showing plugin migration UI');
    // Note: PluginMigrationUI component will be created in Phase 3
    // For now, just skip migration and continue
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-surface-2 flex items-center justify-center">
        <div className="max-w-md w-full bg-card p-8 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Upgrading to Plugin Architecture</h2>
          <p className="text-muted-foreground mb-6">
            Plugin migration UI will be implemented in Phase 3
          </p>
          <button
            onClick={() => setShowPluginMigration(false)}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold"
          >
            Continue
          </button>
        </div>
      </div>
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
                alt="Guanix Restaurant OS"
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
      </>
    );
  }

  // Staff build: Redirect to login after activation (before auto-login check)
  // This ensures staff members are prompted to log in with their PIN
  if (buildConfig.isStaffBuild && isActivated && !isAuthenticated && !awaitingActivation && !isAutoLoggingIn) {
    console.debug('[App] Staff build: Redirecting to login after activation');
    return (
      <HashRouter>
        <Navigate to="/login" replace />
      </HashRouter>
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

  // Redirect to company setup for fresh installs
  if (needsCompanySetup && !isLoadingTenantConfig && isAuthenticated) {
    console.log('[App] 🏢 Fresh install detected - redirecting to company setup');
    return (
      <HashRouter>
        <Navigate to="/company-setup" replace />
      </HashRouter>
    );
  }

  // NOTE: Login is now handled through the /login route in the HashRouter
  // No need to render Login component here - DefaultRoute will redirect unauthenticated users
  console.debug('[App] Showing main app with routes');

  return (
    <HashRouter>
      <NetworkProvider>
        <AutoAttendanceInitializer />
        <WebSocketManager />
        <ThemeProvider />
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

              {/* Protected Routes - Company Registration Wizard (First-Time Setup) */}
              <Route
                path="/company-setup"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <CompanyRegistrationWizard />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes - Restaurant Setup Wizard (Location Details Editing) */}
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
                  <BuildVariantGuard path="/settings">
                    <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                      <SettingsApp />
                    </ProtectedRoute>
                  </BuildVariantGuard>
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

              {/* Coorg Food Company Migration Page */}
              <Route
                path="/coorg-migration"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <CoorgMigrationPage />
                  </ProtectedRoute>
                }
              />

              {/* D1 Sync Test Page */}
              <Route
                path="/d1-sync-test"
                element={
                  <BuildVariantGuard path="/d1-sync-test">
                    <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                      <D1SyncTest />
                    </ProtectedRoute>
                  </BuildVariantGuard>
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
                  <BuildVariantGuard path="/images">
                    <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                      <ImageManagement />
                    </ProtectedRoute>
                  </BuildVariantGuard>
                }
              />

              {/* Protected Routes - Multi Location Management */}
              <Route
                path="/multi-location"
                element={
                  <BuildVariantGuard path="/multi-location">
                    <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                      <AppLayout>
                        <ChainManagementPage />
                      </AppLayout>
                    </ProtectedRoute>
                  </BuildVariantGuard>
                }
              />

              {/* Protected Routes - Camera Feed (Vision AI) */}
              <Route
                path="/camera-feed"
                element={
                  <BuildVariantGuard path="/camera-feed">
                    <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER, UserRole.SERVER]}>
                      <CameraFeedPage />
                    </ProtectedRoute>
                  </BuildVariantGuard>
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
                  <BuildVariantGuard path="/aggregator/settings">
                    <ProtectedRoute
                      allowedRoles={[UserRole.AGGREGATOR, UserRole.MANAGER]}
                      requiredPermission="canViewAggregators"
                    >
                      <AppLayout>
                        <AggregatorSettings />
                      </AppLayout>
                    </ProtectedRoute>
                  </BuildVariantGuard>
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

              {/* Protected Routes - Subscription Meals Plugin */}
              <Route
                path="/subscriptions"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <AppLayout>
                      <SubscriptionDashboard tenantId={tenant?.tenantId || ''} />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions/plans"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <AppLayout>
                      <SubscriptionPlans tenantId={tenant?.tenantId || ''} />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions/menu"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <AppLayout>
                      <SubscriptionMenuManager tenantId={tenant?.tenantId || ''} />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions/kds"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER, UserRole.SERVER]}>
                    <AppLayout>
                      <SubscriptionKDS tenantId={tenant?.tenantId || ''} weekStartDate={new Date().toISOString().split('T')[0]} />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions/dispatch"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER, UserRole.SERVER]}>
                    <AppLayout>
                      <ParcelDispatchScreen tenantId={tenant?.tenantId || ''} deliveryDate={new Date().toISOString().split('T')[0]} />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscriptions/changelog"
                element={
                  <AppLayout>
                    <SubscriptionChangelog />
                  </AppLayout>
                }
              />
              <Route
                path="/subscriptions/import"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.OWNER]}>
                    <AppLayout>
                      <SubscriptionMenuImporter />
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

              {/* Development Utility - Complete Reset (deletes everything) */}
              <Route path="/complete-reset" element={<CompleteReset />} />

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

        {/* KOT Print Modal - Global print modal for KOT tickets */}
        {kotPrintModalOpen && kotPrintOrder && (
          <KOTPrintModal
            isOpen={kotPrintModalOpen}
            onClose={() => handleKotPrintModalClose(false)}
            order={kotPrintOrder}
            restaurantName={kotPrintRestaurantName}
            stationFilter={kotPrintStationFilter}
            onPrintComplete={(success) => handleKotPrintModalClose(success)}
          />
        )}

      </div>
      </NetworkProvider>
    </HashRouter>
  );
}

export default App;
