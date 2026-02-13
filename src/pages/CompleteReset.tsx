/**
 * Complete Reset Page
 * UI for completely resetting the system - deletes everything
 * Access at: /#/complete-reset
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetEverything } from '../lib/resetEverything';
import { AlertTriangle, Check, X, Loader2 } from 'lucide-react';

interface ResetProgress {
  step: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  message: string;
}

export function CompleteReset() {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);
  const [progress, setProgress] = useState<ResetProgress[]>([]);
  const [resetComplete, setResetComplete] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    setResetFailed(false);

    try {
      const success = await resetEverything((steps) => {
        setProgress([...steps]);
      });

      if (success) {
        setResetComplete(true);
      } else {
        setResetFailed(true);
        setIsResetting(false);
      }
    } catch (error) {
      console.error('[CompleteReset] Reset failed:', error);
      setResetFailed(true);
      setIsResetting(false);
    }
  };

  const getStatusIcon = (status: ResetProgress['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-6 h-6 rounded-full border-2 border-muted" />;
      case 'in-progress':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'complete':
        return <Check className="w-6 h-6 text-green-500" />;
      case 'error':
        return <X className="w-6 h-6 text-red-500" />;
    }
  };

  if (resetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-surface-1 to-surface-2 p-4">
        <div className="max-w-md w-full p-8">
          <div className="glass-panel rounded-2xl border border-border p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-wider mb-4">Reset Complete</h1>
            <p className="text-muted-foreground mb-6">
              All data has been permanently deleted. The application will now reload.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Reloading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isResetting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-surface-1 to-surface-2 p-4">
        <div className="max-w-2xl w-full p-8">
          <div className="glass-panel rounded-2xl border border-border p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-black uppercase tracking-wider mb-2">Resetting System</h1>
              <p className="text-muted-foreground text-sm">
                Please wait while we delete all data...
              </p>
            </div>

            <div className="space-y-4">
              {progress.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    step.status === 'in-progress'
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : step.status === 'complete'
                      ? 'bg-green-500/10 border border-green-500/20'
                      : step.status === 'error'
                      ? 'bg-red-500/10 border border-red-500/20'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {step.message}
                    </p>
                    {step.status === 'in-progress' && (
                      <p className="text-xs text-muted-foreground mt-1">In progress...</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {resetFailed && (
              <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
                  Reset failed. Please check the console for details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-surface-1 to-surface-2 p-4">
      <div className="max-w-2xl w-full p-8">
        <div className="glass-panel rounded-2xl border border-border p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wider mb-2">Complete System Reset</h1>
            <p className="text-muted-foreground text-sm">
              Permanently delete all data and start completely fresh
            </p>
          </div>

          {/* Warning Section */}
          <div className="space-y-4 mb-8">
            <div className="p-6 rounded-xl bg-red-500/10 border-2 border-red-500/30">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">
                    ⚠️ DANGER - This will permanently delete:
                  </p>
                  <ul className="text-xs text-red-600/90 dark:text-red-400/90 space-y-1.5 list-disc list-inside">
                    <li><strong>Database files</strong> (pos-dev.db, guanix.db) - cannot be recovered</li>
                    <li><strong>All menu items</strong> - categories, prices, photos, variants</li>
                    <li><strong>All staff members</strong> - names, PINs, assignments</li>
                    <li><strong>All orders & sales</strong> - complete history and transactions</li>
                    <li><strong>Restaurant settings</strong> - business details, tax, printing</li>
                    <li><strong>Floor plans & tables</strong> - seating layouts</li>
                    <li><strong>Inventory data</strong> - items, suppliers, stock levels</li>
                    <li><strong>Tenant activation</strong> - cloud sync configuration</li>
                    <li><strong>All browser storage</strong> - localStorage, sessionStorage</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>⚡ Important:</strong> After reset, you will need to:
              </p>
              <ol className="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-2 space-y-1 list-decimal list-inside ml-2">
                <li>Activate the device with a new activation code</li>
                <li>Complete the restaurant setup wizard</li>
                <li>Re-import or recreate your menu</li>
                <li>Re-add staff members and floor plan</li>
              </ol>
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>💡 Alternative:</strong> If you just want to test with fresh data, consider using{' '}
                <button
                  onClick={() => navigate('/reset-setup')}
                  className="underline hover:text-blue-500"
                >
                  Reset Setup
                </button>
                {' '}instead, which preserves the database file.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/hub')}
              disabled={isResetting}
              className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex-1 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold uppercase tracking-widest text-sm shadow-lg hover:from-red-700 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting...
                </span>
              ) : (
                'Delete Everything'
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-muted-foreground/60 text-xs mt-6">
          Development utility • This action cannot be undone
        </p>
      </div>
    </div>
  );
}

export default CompleteReset;
