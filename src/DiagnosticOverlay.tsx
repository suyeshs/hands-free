import { useEffect, useState } from 'react';
import { useTenantStore, useNeedsActivation } from './stores/tenantStore';
import { useSetupWizardStore } from './stores/setupWizardStore';
import { isTauri } from './lib/platform';
import { telemetry } from './lib/telemetry';

export function DiagnosticOverlay() {
  const [storage, setStorage] = useState<any>({});
  const [sessionData, setSessionData] = useState<any>({});
  const [env, setEnv] = useState<any>({});
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [dbFileExists, setDbFileExists] = useState<boolean | null>(null);
  const [dbFilePath, setDbFilePath] = useState<string>('');
  const [buildInfo, setBuildInfo] = useState<any>({});
  const [activationState, setActivationState] = useState<any>({});
  const [installationId, setInstallationId] = useState<string>('');
  const [telemetryEvents, setTelemetryEvents] = useState<any[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  // Get live store states
  const needsActivation = useNeedsActivation();
  const tenantStore = useTenantStore();
  const setupWizard = useSetupWizardStore();

  useEffect(() => {
    const loadDiagnostics = async () => {
      // Read build info
      try {
        let version = 'unknown';
        let name = 'unknown';

        // Try to read from package.json (web only)
        if (!isTauri()) {
          try {
            const packageJson = await fetch('/package.json').then(r => r.json());
            version = packageJson.version || 'unknown';
            name = packageJson.name || 'unknown';
          } catch (e) {
            console.log('Could not read package.json (expected in production builds)');
          }
        }

        // For Tauri, try to get version from Tauri API
        if (isTauri()) {
          try {
            const { getVersion } = await import('@tauri-apps/api/app');
            version = await getVersion();
            name = 'guanix-restaurant-os';
          } catch (e) {
            console.log('Could not read app version from Tauri');
          }
        }

        setBuildInfo({
          version,
          name,
          buildDate: new Date().toISOString(),
          isTauri: isTauri(),
          platform: navigator.platform,
          userAgent: navigator.userAgent,
        });
      } catch (e) {
        console.error('Failed to load build info:', e);
      }

      // Check for database file (Tauri only)
      if (isTauri()) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const { appDataDir } = await import('@tauri-apps/api/path');

          const appDir = await appDataDir();
          const dbPath = appDir.endsWith('/') || appDir.endsWith('\\')
            ? `${appDir}guanix.db`
            : `${appDir}/guanix.db`;
          setDbFilePath(dbPath);

          // Check if file exists
          try {
            const exists = await invoke<boolean>('check_db_exists');
            setDbFileExists(exists);
          } catch (err) {
            console.error('DB check failed:', err);
            setDbFileExists(false);
          }
        } catch (e) {
          console.error('Failed to check DB:', e);
        }
      }

      // Get activation state from stores
      setActivationState({
        needsActivation,
        isActivated: tenantStore.isActivated,
        hasTenant: !!tenantStore.tenant,
        tenantId: tenantStore.tenant?.tenantId,
        awaitingActivation: setupWizard.awaitingActivation,
        isComplete: setupWizard.isComplete,
        activationCode: setupWizard.activationCode ? '***' + setupWizard.activationCode.slice(-4) : null,
      });

      // Get installation ID
      const installedId = localStorage.getItem('installation-id') || 'Not set';
      setInstallationId(installedId);

      // Read all localStorage
      const localStorageData: any = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            localStorageData[key] = JSON.parse(localStorage.getItem(key) || '');
          } catch {
            localStorageData[key] = localStorage.getItem(key);
          }
        }
      }
      setStorage(localStorageData);

    // Read all sessionStorage
    const sessionStorageData: any = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          sessionStorageData[key] = JSON.parse(sessionStorage.getItem(key) || '');
        } catch {
          sessionStorageData[key] = sessionStorage.getItem(key);
        }
      }
    }
    setSessionData(sessionStorageData);

    // Extract tenant info if exists
    if (localStorageData['tenant-storage']) {
      try {
        const tenantStorage = typeof localStorageData['tenant-storage'] === 'string'
          ? JSON.parse(localStorageData['tenant-storage'])
          : localStorageData['tenant-storage'];
        setTenantInfo({
          isActivated: tenantStorage?.state?.isActivated,
          tenantId: tenantStorage?.state?.tenant?.tenantId,
          companyName: tenantStorage?.state?.tenant?.companyName,
          apiUrl: tenantStorage?.state?.tenant?.apiUrl,
        });
      } catch (e) {
        console.error('Failed to parse tenant info:', e);
      }
    }

      // Read env vars
      setEnv({
        VITE_SKIP_AUTH: import.meta.env.VITE_SKIP_AUTH,
        VITE_DEFAULT_TENANT_ID: import.meta.env.VITE_DEFAULT_TENANT_ID,
        VITE_BACKEND_API_URL: import.meta.env.VITE_BACKEND_API_URL,
        VITE_PROVISIONING_URL: import.meta.env.VITE_PROVISIONING_URL,
        VITE_HANDSFREE_API_URL: import.meta.env.VITE_HANDSFREE_API_URL,
        DEV: import.meta.env.DEV,
        MODE: import.meta.env.MODE,
      });
    };

    loadDiagnostics();
  }, [needsActivation, tenantStore, setupWizard]);

  const handleClearStorage = () => {
    if (confirm('Clear all storage and reload?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const handleExitDiagnostic = () => {
    localStorage.removeItem('show-diagnostic');
    window.location.hash = '';
    window.location.reload();
  };

  const handleCopyInstallationId = () => {
    navigator.clipboard.writeText(installationId).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = installationId;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  };

  const fetchTelemetryEvents = async () => {
    if (!tenantStore.tenant?.tenantId) {
      console.log('No tenant ID available for fetching telemetry');
      return;
    }

    setLoadingTelemetry(true);
    try {
      const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT || 'https://handsfree-telemetry.suyesh.workers.dev';
      const response = await fetch(`${endpoint}/api/telemetry/tenant/${tenantStore.tenant.tenantId}?limit=20`);

      if (response.ok) {
        const data = await response.json();
        setTelemetryEvents(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch telemetry:', response.status);
        setTelemetryEvents([]);
      }
    } catch (error) {
      console.error('Error fetching telemetry:', error);
      setTelemetryEvents([]);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const hasTenantData = !!tenantInfo;
  const isStorageEmpty = Object.keys(storage).length === 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'white',
      zIndex: 999999,
      padding: '20px',
      overflow: 'auto',
      fontFamily: 'monospace',
      fontSize: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: 'red', margin: 0 }}>🔍 DIAGNOSTIC MODE</h1>
        <button
          onClick={handleExitDiagnostic}
          style={{
            padding: '10px 20px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          ← EXIT DIAGNOSTIC MODE
        </button>
      </div>

      <p style={{ marginBottom: '20px', color: '#666' }}>
        Press <kbd>Cmd/Ctrl + Shift + D</kbd> or click the button above to exit diagnostic mode
      </p>

      {/* Telemetry Status */}
      <div style={{
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '8px',
        background: import.meta.env.PROD ? '#d4edda' : '#fff3cd',
        border: `2px solid ${import.meta.env.PROD ? '#28a745' : '#ffc107'}`,
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: import.meta.env.PROD ? '#155724' : '#856404' }}>
          📊 TELEMETRY STATUS
        </h2>
        <div style={{ fontSize: '12px', marginBottom: '10px' }}>
          <div style={{ marginBottom: '5px' }}>
            <strong>Enabled:</strong>{' '}
            <span style={{ color: import.meta.env.PROD ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
              {import.meta.env.PROD ? 'YES (Production Mode)' : 'NO (Development Mode)'}
            </span>
          </div>
          <div style={{ marginBottom: '5px' }}>
            <strong>Endpoint:</strong>{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
              {import.meta.env.VITE_TELEMETRY_ENDPOINT || 'https://handsfree-telemetry.suyesh.workers.dev'}
            </span>
          </div>
          <div style={{ marginBottom: '5px' }}>
            <strong>Mode:</strong> {import.meta.env.DEV ? 'Development (Debug Mode)' : 'Production'}
          </div>
        </div>
        {!import.meta.env.PROD && (
          <div style={{
            padding: '10px',
            background: '#fff8e1',
            borderRadius: '4px',
            border: '1px solid #ffc107',
            marginTop: '10px'
          }}>
            <p style={{ margin: '0 0 5px 0', color: '#856404', fontSize: '11px', fontWeight: 'bold' }}>
              ℹ️ Telemetry is disabled in development mode
            </p>
            <p style={{ margin: 0, color: '#856404', fontSize: '10px' }}>
              Events are logged to console but not sent to the server. Enable in production builds only.
            </p>
          </div>
        )}
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              telemetry.captureInfo('Test telemetry event from diagnostic overlay', {
                source: 'diagnostic-overlay',
                timestamp: new Date().toISOString(),
              });
              alert('Test event captured! Check browser console for debug output.');
            }}
            style={{
              padding: '8px 12px',
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            🧪 Send Test Event
          </button>
          <button
            onClick={fetchTelemetryEvents}
            disabled={loadingTelemetry || !tenantStore.tenant?.tenantId}
            style={{
              padding: '8px 12px',
              background: loadingTelemetry ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loadingTelemetry ? 'wait' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: !tenantStore.tenant?.tenantId ? 0.5 : 1,
            }}
          >
            {loadingTelemetry ? '⏳ Loading...' : '🔍 Fetch Events'}
          </button>
        </div>

        {/* Display fetched telemetry events */}
        {telemetryEvents.length > 0 && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            background: '#fff',
            borderRadius: '4px',
            border: '1px solid #dee2e6',
            maxHeight: '300px',
            overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>
              Recent Events ({telemetryEvents.length})
            </h3>
            <div style={{ fontSize: '10px', fontFamily: 'monospace' }}>
              {telemetryEvents.map((event, index) => (
                <div
                  key={index}
                  style={{
                    padding: '6px',
                    marginBottom: '4px',
                    background: event.type === 'error' ? '#f8d7da' :
                      event.type === 'warning' ? '#fff3cd' :
                      event.type === 'provision_flow' ? '#d1ecf1' : '#e7f3ff',
                    borderLeft: `3px solid ${
                      event.type === 'error' ? '#dc3545' :
                      event.type === 'warning' ? '#ffc107' :
                      event.type === 'provision_flow' ? '#17a2b8' : '#007bff'
                    }`,
                    borderRadius: '2px',
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#212529' }}>
                    [{event.type?.toUpperCase()}] {event.message}
                  </div>
                  <div style={{ color: '#6c757d', marginTop: '2px' }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                  {event.context && (
                    <div style={{
                      marginTop: '4px',
                      padding: '4px',
                      background: 'rgba(0,0,0,0.05)',
                      borderRadius: '2px',
                      fontSize: '9px',
                    }}>
                      {JSON.stringify(event.context, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {telemetryEvents.length === 0 && !loadingTelemetry && tenantStore.tenant?.tenantId && (
          <div style={{
            marginTop: '10px',
            padding: '8px',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#6c757d',
            fontStyle: 'italic',
          }}>
            No telemetry events found. Click "Fetch Events" to load recent events.
          </div>
        )}
      </div>

      {/* Build Info */}
      <div style={{
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '8px',
        background: '#e3f2fd',
        border: '2px solid #2196f3',
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>📦 BUILD INFO</h2>
        <pre style={{ margin: 0 }}>{JSON.stringify(buildInfo, null, 2)}</pre>
        <div style={{ marginTop: '10px', padding: '10px', background: '#bbdefb', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <strong style={{ color: '#0d47a1' }}>Installation ID:</strong>
            <button
              onClick={handleCopyInstallationId}
              style={{
                padding: '4px 8px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              📋 COPY
            </button>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#1565c0', wordBreak: 'break-all' }}>
            {installationId}
          </div>
        </div>
      </div>

      {/* Database File Check (Tauri only) */}
      {isTauri() && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          background: dbFileExists === true ? '#d4edda' : dbFileExists === false ? '#f8d7da' : '#fff3cd',
          border: `2px solid ${dbFileExists === true ? '#28a745' : dbFileExists === false ? '#dc3545' : '#ffc107'}`,
        }}>
          <h2 style={{ margin: '0 0 10px 0' }}>
            {dbFileExists === true ? '✅ DATABASE FILE EXISTS' : dbFileExists === false ? '❌ DATABASE FILE MISSING' : '⏳ CHECKING...'}
          </h2>
          <p style={{ margin: 0 }}>Path: {dbFilePath || 'Unknown'}</p>
        </div>
      )}

      {/* Activation State */}
      <div style={{
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '8px',
        background: needsActivation ? '#f8d7da' : '#d4edda',
        border: `2px solid ${needsActivation ? '#dc3545' : '#28a745'}`,
      }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          {needsActivation ? '❌ NEEDS ACTIVATION' : '✅ ACTIVATED'}
        </h2>
        <pre style={{ margin: 0 }}>{JSON.stringify(activationState, null, 2)}</pre>
        {needsActivation && (
          <p style={{ marginTop: '10px', color: '#721c24', fontWeight: 'bold' }}>
            ⚠️ This is why you're seeing the Tenant Activation screen!
          </p>
        )}
      </div>

      {/* Storage Status Summary */}
      <div style={{
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '8px',
        background: isStorageEmpty ? '#d4edda' : '#f8d7da',
        border: `2px solid ${isStorageEmpty ? '#28a745' : '#dc3545'}`,
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: isStorageEmpty ? '#155724' : '#721c24' }}>
          {isStorageEmpty ? '✅ CLEAN STATE' : '⚠️ DATA FOUND'}
        </h2>
        <p style={{ margin: 0 }}>
          localStorage: {isStorageEmpty ? 'EMPTY (fresh start)' : `${Object.keys(storage).length} items found`}
        </p>
      </div>

      {/* Tenant Info if exists */}
      {hasTenantData && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          background: '#fff3cd',
          border: '2px solid #ffc107',
        }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#856404' }}>🏢 TENANT DATA DETECTED</h2>
          <pre style={{ margin: 0 }}>{JSON.stringify(tenantInfo, null, 2)}</pre>
          <p style={{ marginTop: '10px', color: '#856404', fontWeight: 'bold' }}>
            ⚠️ This is why you're seeing the Hub page instead of Tenant Activation!
          </p>
        </div>
      )}

      <button
        onClick={handleClearStorage}
        style={{
          padding: '10px 20px',
          background: 'red',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
          marginBottom: '20px',
          fontWeight: 'bold',
        }}
      >
        🔥 CLEAR STORAGE & RELOAD
      </button>

      <hr style={{ margin: '20px 0' }} />

      <h2>Environment Variables:</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        {JSON.stringify(env, null, 2)}
      </pre>

      <h2>sessionStorage ({Object.keys(sessionData).length} items):</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        {Object.keys(sessionData).length === 0 ? 'EMPTY' : JSON.stringify(sessionData, null, 2)}
      </pre>

      <h2>localStorage ({Object.keys(storage).length} items):</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        {isStorageEmpty ? 'EMPTY' : JSON.stringify(storage, null, 2)}
      </pre>

      <h2>URL:</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        {window.location.href}
      </pre>

      <h2>User Agent:</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', fontSize: '10px' }}>
        {navigator.userAgent}
      </pre>
    </div>
  );
}
