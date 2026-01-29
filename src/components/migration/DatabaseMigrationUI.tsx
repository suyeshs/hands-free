/**
 * Database Migration UI
 * Shows progress when upgrading database schema from v3.0 to v3.1
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { runPendingMigrations } from '../../lib/databaseMigration';

interface DatabaseMigrationUIProps {
  onComplete: () => void;
}

type MigrationStep = 'running' | 'success' | 'error';

export function DatabaseMigrationUI({ onComplete }: DatabaseMigrationUIProps) {
  const [step, setStep] = useState<MigrationStep>('running');
  const [appliedMigrations, setAppliedMigrations] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    runMigrations();
  }, []);

  const runMigrations = async () => {
    try {
      console.log('[DatabaseMigrationUI] Running database migrations...');
      const result = await runPendingMigrations();

      setAppliedMigrations(result.migrations);
      setErrors(result.errors);

      if (result.success) {
        console.log('[DatabaseMigrationUI] ✅ Migrations completed successfully');
        setStep('success');
        // Auto-proceed after showing success
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        console.error('[DatabaseMigrationUI] ❌ Migrations failed:', result.errors);
        setStep('error');
      }
    } catch (err) {
      console.error('[DatabaseMigrationUI] Fatal error:', err);
      setErrors([err instanceof Error ? err.message : 'Unknown error']);
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep('running');
    setAppliedMigrations([]);
    setErrors([]);
    runMigrations();
  };

  const handleProceed = () => {
    console.log('[DatabaseMigrationUI] User chose to proceed despite errors');
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-1 to-surface-2 flex items-center justify-center p-6">
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

      <div className="relative z-10 w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {/* Running Migrations */}
          {step === 'running' && (
            <motion.div
              key="running"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border text-center"
            >
              <Loader2 className="w-16 h-16 mx-auto mb-6 text-saffron animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Upgrading Database</h2>
              <p className="text-muted-foreground mb-6">
                Applying schema updates for v3.1...
              </p>

              {/* Migration list */}
              {appliedMigrations.length > 0 && (
                <div className="space-y-2">
                  {appliedMigrations.map((migration, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-border"
                    >
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                      <span className="text-sm text-foreground">{migration}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border text-center"
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
              <h2 className="text-2xl font-bold mb-2">Database Updated!</h2>
              <p className="text-muted-foreground mb-6">
                Your database has been successfully upgraded to v3.1
              </p>

              {/* Show applied migrations */}
              {appliedMigrations.length > 0 && (
                <div className="mb-4 p-4 rounded-xl bg-surface-2 border border-border">
                  <p className="text-sm font-bold mb-2">Applied Migrations:</p>
                  <div className="space-y-1 text-sm text-left">
                    {appliedMigrations.map((migration, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-success">✓</span>
                        <span className="text-foreground">{migration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Error */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-destructive text-center"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Migration Failed</h2>
              <p className="text-muted-foreground mb-6">
                Some database migrations encountered errors
              </p>

              {/* Show errors */}
              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-left">
                <p className="text-sm font-bold text-destructive mb-2">Errors:</p>
                <div className="space-y-1 text-sm">
                  {errors.map((error, index) => (
                    <p key={index} className="text-destructive-foreground">
                      • {error}
                    </p>
                  ))}
                </div>
              </div>

              {/* Show successful migrations if any */}
              {appliedMigrations.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-surface-2 border border-border text-left">
                  <p className="text-sm font-bold mb-2">Successful:</p>
                  <div className="space-y-1 text-sm">
                    {appliedMigrations.map((migration, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-success">✓</span>
                        <span className="text-foreground">{migration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-paprika to-saffron"
                >
                  Retry Migrations
                </button>
                <button
                  onClick={handleProceed}
                  className="flex-1 px-6 py-3 rounded-xl font-medium border-2 border-border hover:border-border-strong"
                >
                  Proceed Anyway
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
