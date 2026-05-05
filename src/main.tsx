import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './index.css';
import { clearMigratedZustandStores } from './lib/clearZustandStorage';

// ========== STARTUP DIAGNOSTICS ==========
// Enable with: localStorage.setItem('debug:startup', 'true')
const DEBUG_STARTUP = localStorage.getItem('debug:startup') === 'true';

if (DEBUG_STARTUP) {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              🔍 STARTUP DIAGNOSTICS                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Log ALL localStorage keys and values
  console.log('📦 localStorage contents:');
  if (localStorage.length === 0) {
    console.log('  ✅ localStorage is EMPTY (clean state)');
  } else {
    console.log(`  ⚠️  localStorage has ${localStorage.length} items:`);
    Object.keys(localStorage).forEach(key => {
      const value = localStorage.getItem(key);
      // Truncate long values for readability
      const displayValue = value && value.length > 200
        ? value.substring(0, 200) + '... (truncated)'
        : value;
      console.log(`    - ${key}:`, displayValue);

      // Special check for tenant data
      if (key === 'tenant-storage') {
        console.log('      ⚠️  TENANT DATA FOUND IN LOCALSTORAGE!');
        try {
          const parsed = JSON.parse(value || '{}');
          console.log('      Tenant state:', {
            isActivated: parsed?.state?.isActivated,
            tenantId: parsed?.state?.tenant?.tenantId,
            companyName: parsed?.state?.tenant?.companyName,
          });
        } catch (e) {
          console.log('      Failed to parse tenant data:', e);
        }
      }
    });
  }

  console.log('');
  console.log('💾 sessionStorage contents:');
  if (sessionStorage.length === 0) {
    console.log('  ✅ sessionStorage is EMPTY');
  } else {
    console.log(`  sessionStorage has ${sessionStorage.length} items:`);
    Object.keys(sessionStorage).forEach(key => {
      const value = sessionStorage.getItem(key);
      console.log(`    - ${key}:`, value);
    });
  }

  console.log('');
  console.log('🌐 Environment:');
  console.log('  - URL:', window.location.href);
  console.log('  - User Agent:', navigator.userAgent);
  console.log('  - Is Tauri:', '__TAURI__' in window);

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              ⚡ LOADING APP                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
}

// Clean up migrated Zustand stores on every app start
// This ensures old localStorage data doesn't interfere with SQLite as single source of truth
console.log('[App Init] Cleaning up localStorage...');
clearMigratedZustandStores();

// Always use Tauri App with authentication
// StrictMode disabled to reduce noise - enable it for React debugging only
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
