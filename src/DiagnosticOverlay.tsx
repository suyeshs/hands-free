import { useEffect, useState } from 'react';

export function DiagnosticOverlay() {
  const [storage, setStorage] = useState<any>({});
  const [sessionData, setSessionData] = useState<any>({});
  const [env, setEnv] = useState<any>({});
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  useEffect(() => {
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
    });
  }, []);

  const handleClearStorage = () => {
    if (confirm('Clear all storage and reload?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
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
      <h1 style={{ color: 'red', marginBottom: '20px' }}>🔍 DIAGNOSTIC MODE</h1>

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
