/**
 * Diagnostics Check Component
 * System checks before going live
 */

import { useState, useEffect } from 'react';
import { useProvisioningStore } from '../../stores/provisioningStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useMenuStore } from '../../stores/menuStore';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { WizardNavigation } from './WizardNavigation';

interface DiagnosticResult {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warning';
  message?: string;
}

export function DiagnosticsCheck() {
  const { markStepComplete, nextStep } = useProvisioningStore();
  const { tenant } = useTenantStore();
  const { items: menuItems } = useMenuStore();
  const { settings, isConfigured } = useRestaurantSettingsStore();

  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([
    {
      id: 'tenant',
      name: 'Tenant Configuration',
      description: 'Check if restaurant is properly configured',
      status: 'pending',
    },
    {
      id: 'settings',
      name: 'Restaurant Settings',
      description: 'Verify billing and tax settings',
      status: 'pending',
    },
    {
      id: 'menu',
      name: 'Menu Data',
      description: 'Check if menu items are loaded',
      status: 'pending',
    },
    {
      id: 'api',
      name: 'Cloud API',
      description: 'Test connection to HandsFree servers',
      status: 'pending',
    },
    {
      id: 'storage',
      name: 'Local Storage',
      description: 'Verify local database is working',
      status: 'pending',
    },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const updateDiagnostic = (id: string, update: Partial<DiagnosticResult>) => {
    setDiagnostics((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...update } : d))
    );
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setHasRun(true);

    // Reset all to checking
    setDiagnostics((prev) => prev.map((d) => ({ ...d, status: 'checking' as const })));

    // Small delay for visual effect
    await new Promise((r) => setTimeout(r, 300));

    // 1. Check Tenant Configuration
    if (tenant?.tenantId) {
      updateDiagnostic('tenant', {
        status: 'pass',
        message: `Connected to ${tenant.companyName || tenant.tenantId}`,
      });
    } else {
      updateDiagnostic('tenant', {
        status: 'fail',
        message: 'No tenant configured',
      });
    }

    await new Promise((r) => setTimeout(r, 200));

    // 2. Check Restaurant Settings
    if (isConfigured && settings.name) {
      updateDiagnostic('settings', {
        status: 'pass',
        message: `${settings.name} - GST: ${settings.cgstRate + settings.sgstRate}%`,
      });
    } else if (settings.name) {
      updateDiagnostic('settings', {
        status: 'warning',
        message: 'Basic settings configured, some fields missing',
      });
    } else {
      updateDiagnostic('settings', {
        status: 'fail',
        message: 'Restaurant settings not configured',
      });
    }

    await new Promise((r) => setTimeout(r, 200));

    // 3. Check Menu Data
    if (menuItems && menuItems.length > 0) {
      updateDiagnostic('menu', {
        status: 'pass',
        message: `${menuItems.length} items loaded`,
      });
    } else {
      updateDiagnostic('menu', {
        status: 'warning',
        message: 'No menu items found - you can add them later',
      });
    }

    await new Promise((r) => setTimeout(r, 200));

    // 4. Check Cloud API
    try {
      const apiUrl = tenant?.apiBaseUrl || import.meta.env.VITE_HANDSFREE_API_URL;
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          updateDiagnostic('api', {
            status: 'pass',
            message: 'Connected to HandsFree Cloud',
          });
        } else {
          updateDiagnostic('api', {
            status: 'warning',
            message: 'API responded with non-OK status',
          });
        }
      } else {
        updateDiagnostic('api', {
          status: 'pass',
          message: 'Using default API endpoint',
        });
      }
    } catch (error) {
      updateDiagnostic('api', {
        status: 'warning',
        message: 'Could not reach API - offline mode will work',
      });
    }

    await new Promise((r) => setTimeout(r, 200));

    // 5. Check Local Storage
    try {
      const testKey = '__diagnostics_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      updateDiagnostic('storage', {
        status: 'pass',
        message: 'Local storage working',
      });
    } catch (error) {
      updateDiagnostic('storage', {
        status: 'fail',
        message: 'Local storage not available',
      });
    }

    setIsRunning(false);
  };

  // Run diagnostics on mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  const allPassed = diagnostics.every((d) => d.status === 'pass' || d.status === 'warning');
  const hasCriticalFailure = diagnostics.some(
    (d) => d.status === 'fail' && ['tenant', 'storage'].includes(d.id)
  );

  const handleContinue = () => {
    markStepComplete('diagnostics');
    nextStep();
  };

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isRunning
              ? 'bg-accent/20'
              : allPassed
              ? 'bg-green-500/20'
              : 'bg-red-500/20'
          }`}
        >
          {isRunning ? (
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-accent border-t-transparent" />
          ) : allPassed ? (
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          {isRunning ? 'Running Diagnostics' : allPassed ? 'All Systems Ready' : 'Issues Found'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isRunning
            ? 'Checking your system configuration...'
            : allPassed
            ? 'Your restaurant is ready to go!'
            : 'Some checks need attention'}
        </p>
      </div>

      {/* Diagnostics List */}
      <div className="space-y-3 mb-6">
        {diagnostics.map((diagnostic) => (
          <DiagnosticRow key={diagnostic.id} diagnostic={diagnostic} />
        ))}
      </div>

      {/* Re-run button */}
      {hasRun && !isRunning && (
        <div className="text-center mb-6">
          <button
            onClick={runDiagnostics}
            className="text-accent text-sm hover:underline"
          >
            Run diagnostics again
          </button>
        </div>
      )}

      {/* Navigation */}
      <WizardNavigation
        onNext={handleContinue}
        canGoNext={allPassed && !isRunning}
        nextLabel={hasCriticalFailure ? 'Fix Issues First' : 'Continue'}
        isLoading={isRunning}
      />
    </div>
  );
}

interface DiagnosticRowProps {
  diagnostic: DiagnosticResult;
}

function DiagnosticRow({ diagnostic }: DiagnosticRowProps) {
  const statusIcons = {
    pending: '⏳',
    checking: null, // spinner
    pass: null, // checkmark
    fail: null, // x
    warning: null, // warning
  };

  const statusColors = {
    pending: 'bg-white/10 text-muted-foreground',
    checking: 'bg-accent/20 text-accent',
    pass: 'bg-green-500/20 text-green-400',
    fail: 'bg-red-500/20 text-red-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        diagnostic.status === 'fail'
          ? 'bg-red-500/5 border-red-500/30'
          : diagnostic.status === 'warning'
          ? 'bg-yellow-500/5 border-yellow-500/30'
          : diagnostic.status === 'pass'
          ? 'bg-green-500/5 border-green-500/30'
          : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Status icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusColors[diagnostic.status]}`}
        >
          {diagnostic.status === 'checking' ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
          ) : diagnostic.status === 'pass' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : diagnostic.status === 'fail' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : diagnostic.status === 'warning' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <span className="text-lg">{statusIcons[diagnostic.status]}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground">{diagnostic.name}</h3>
          <p className="text-sm text-muted-foreground">
            {diagnostic.message || diagnostic.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default DiagnosticsCheck;
