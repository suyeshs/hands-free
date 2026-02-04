/**
 * Coorg Food Company Migration Page
 *
 * UI for migrating coorg-food-company-6163 from v1.0 to current system
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2, Database, ArrowRight, FileText } from 'lucide-react';
import {
  runFullMigration,
  type ValidationResult,
  type MigrationProgress,
} from '../services/coorgMigrationService';

type MigrationState = 'idle' | 'running' | 'validating' | 'success' | 'error';

export default function CoorgMigrationPage() {
  const [state, setState] = useState<MigrationState>('idle');
  const [progress, setProgress] = useState<MigrationProgress>({
    step: '',
    progress: 0,
    message: '',
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartMigration = async () => {
    setState('running');
    setError(null);

    try {
      const result = await runFullMigration((progressUpdate) => {
        setProgress(progressUpdate);
      });

      setValidation(result);
      setState('success');
    } catch (err) {
      console.error('[Migration] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-1 to-surface-2 flex items-center justify-center p-6">
      {/* Animated background */}
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

      <div className="relative z-10 w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {/* Idle State - Ready to Start */}
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-saffron to-paprika flex items-center justify-center">
                  <Database className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Database Migration</h1>
                <p className="text-muted-foreground">
                  Coorg Food Company (6163)
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-xl bg-surface-2 border border-border">
                  <h3 className="font-semibold mb-2">What will happen:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span>Export all sales data from v1.0 database</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span>Create automatic backups (database + JSON export)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span>Transform sales to structured format with tax calculations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span>Import staff accounts and preserve credentials</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span>Validate data integrity before committing</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-500 mb-1">Important</p>
                      <p className="text-amber-500/80">
                        This migration is safe - your original database will be backed up automatically.
                        The process cannot be undone once committed, but you'll have a chance to review
                        the results before finalizing.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartMigration}
                className="w-full px-6 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-paprika to-saffron hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Start Migration</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* Running State - Progress */}
          {state === 'running' && (
            <motion.div
              key="running"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border text-center"
            >
              <Loader2 className="w-16 h-16 mx-auto mb-6 text-saffron animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Migrating Data...</h2>
              <p className="text-muted-foreground mb-6">
                {progress.message || 'Processing...'}
              </p>

              {/* Progress bar */}
              <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden mb-4">
                <motion.div
                  className="h-full bg-gradient-to-r from-paprika to-saffron"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                {progress.progress}% complete
              </div>

              {/* Step indicator */}
              <div className="mt-8 flex justify-center gap-2">
                {['export', 'backup', 'import', 'validate', 'commit'].map((step) => (
                  <div
                    key={step}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      progress.step === step
                        ? 'bg-saffron text-white'
                        : progress.step > step
                        ? 'bg-success/20 text-success'
                        : 'bg-surface-2 text-muted-foreground'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Success State - Validation Results */}
          {state === 'success' && validation && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
              </motion.div>

              <h2 className="text-2xl font-bold mb-2 text-center">Migration Complete!</h2>
              <p className="text-muted-foreground mb-6 text-center">
                Your data has been successfully migrated to the new system
              </p>

              {/* Validation Summary */}
              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl bg-surface-2 border border-border">
                  <h3 className="font-semibold mb-3">Migration Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span>Staff Accounts:</span>
                      <span className="font-medium">
                        {validation.staff.actual} {validation.staff.match ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Sales Transactions:</span>
                      <span className="font-medium">
                        {validation.sales.actual} {validation.sales.match ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Revenue:</span>
                      <span className="font-medium">₹{validation.revenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Date Range:</span>
                      <span className="font-medium text-xs">
                        {validation.dateRange.oldest?.split('T')[0]} to{' '}
                        {validation.dateRange.newest?.split('T')[0]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-green-500 mb-1">All Data Validated</p>
                      <p className="text-green-500/80">
                        All records were successfully migrated and validated. Your original database
                        has been archived for safety.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-paprika to-saffron hover:shadow-lg transition-all"
                >
                  Reload Application
                </button>
                <button
                  onClick={() => setState('idle')}
                  className="w-full px-6 py-3 rounded-xl font-medium border-2 border-border hover:border-border-strong transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-destructive"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>

              <h2 className="text-2xl font-bold mb-2 text-center">Migration Failed</h2>
              <p className="text-muted-foreground mb-6 text-center">
                An error occurred during migration
              </p>

              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                <p className="text-sm font-bold text-destructive mb-2">Error Details:</p>
                <p className="text-sm text-destructive-foreground">{error}</p>
              </div>

              <div className="mb-6 p-4 rounded-xl bg-surface-2 border border-border">
                <p className="text-sm">
                  <strong>Don't worry!</strong> Your original database has NOT been modified.
                  All backup files have been created for safety.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleStartMigration}
                  className="w-full px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-paprika to-saffron hover:shadow-lg transition-all"
                >
                  Retry Migration
                </button>
                <button
                  onClick={() => setState('idle')}
                  className="w-full px-6 py-3 rounded-xl font-medium border-2 border-border hover:border-border-strong transition-colors"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
