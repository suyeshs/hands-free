/**
 * Settings Migration UI
 * Friendly interface for migrating from localStorage to SQLite
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from 'lucide-react';
import {
  checkMigrationStatus,
  migrateSettings,
  skipMigration,
  getOldSettingsPreview,
} from '../../services/settingsMigration';

interface SettingsMigrationUIProps {
  onComplete: () => void;
}

type MigrationStep = 'checking' | 'prompt' | 'migrating' | 'success' | 'error' | 'skipped';

export function SettingsMigrationUI({ onComplete }: SettingsMigrationUIProps) {
  const [step, setStep] = useState<MigrationStep>('checking');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof getOldSettingsPreview>>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const migrationStatus = await checkMigrationStatus();

      if (!migrationStatus.needsMigration) {
        // No migration needed, proceed immediately
        onComplete();
        return;
      }

      // Get preview of old settings
      const oldPreview = getOldSettingsPreview();
      setPreview(oldPreview);

      // Show migration prompt
      setStep('prompt');
    } catch (err) {
      console.error('[MigrationUI] Failed to check status:', err);
      setError('Failed to check migration status');
      setStep('error');
    }
  };

  const handleMigrate = async () => {
    setStep('migrating');
    setProgress(0);

    const result = await migrateSettings((message, prog) => {
      setProgressMessage(message);
      setProgress(prog);
    });

    if (result.success) {
      setStep('success');
      // Auto-proceed after showing success
      setTimeout(() => {
        onComplete();
      }, 2000);
    } else {
      setError(result.error || 'Migration failed');
      setStep('error');
    }
  };

  const handleSkip = () => {
    skipMigration();
    setStep('skipped');
    // Auto-proceed after showing message
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  const handleRetry = () => {
    setError(null);
    checkStatus();
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
          {/* Checking Status */}
          {step === 'checking' && (
            <motion.div
              key="checking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-saffron animate-spin" />
              <p className="text-muted-foreground">Checking for settings to migrate...</p>
            </motion.div>
          )}

          {/* Migration Prompt */}
          {step === 'prompt' && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border"
            >
              {/* Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-saffron/20 to-paprika/10 flex items-center justify-center">
                <Database className="w-10 h-10 text-saffron" />
              </div>

              {/* Title */}
              <h2 className="text-3xl font-black uppercase tracking-wider mb-3 text-center">
                Settings Migration
              </h2>
              <p className="text-center text-muted-foreground mb-6">
                We found settings from a previous version stored in your browser. Would you like to migrate them to the new database?
              </p>

              {/* Preview of old settings */}
              {preview && (
                <div className="mb-6 p-4 rounded-xl bg-surface-2 border border-border">
                  <p className="text-sm font-bold mb-2">Settings found:</p>
                  <div className="space-y-1 text-sm">
                    {preview.restaurantName && (
                      <p>
                        <span className="text-muted-foreground">Restaurant:</span>{' '}
                        <span className="font-medium">{preview.restaurantName}</span>
                      </p>
                    )}
                    {preview.phone && (
                      <p>
                        <span className="text-muted-foreground">Phone:</span>{' '}
                        <span className="font-medium">{preview.phone}</span>
                      </p>
                    )}
                    {preview.address && (
                      <p>
                        <span className="text-muted-foreground">Address:</span>{' '}
                        <span className="font-medium">{preview.address}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Info boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-info/10 border border-info/30">
                  <p className="text-sm text-info-foreground font-medium mb-1">
                    ✅ Recommended
                  </p>
                  <p className="text-xs text-info-foreground/80">
                    Migrate your settings to continue where you left off
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border">
                  <p className="text-sm font-medium mb-1">Start Fresh</p>
                  <p className="text-xs text-muted-foreground">
                    Skip migration and set up from scratch
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleMigrate}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-paprika to-saffron shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <span>Migrate Settings</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSkip}
                  className="flex-1 px-6 py-3 rounded-xl font-medium text-muted-foreground border-2 border-border hover:border-border-strong hover:text-foreground transition-all flex items-center justify-center gap-2"
                >
                  <span>Start Fresh</span>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Migrating */}
          {step === 'migrating' && (
            <motion.div
              key="migrating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border text-center"
            >
              <Loader2 className="w-16 h-16 mx-auto mb-6 text-saffron animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Migrating Settings...</h2>
              <p className="text-muted-foreground mb-6">{progressMessage}</p>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-paprika to-saffron"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">{progress}%</p>
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
              <h2 className="text-2xl font-bold mb-2">Migration Complete!</h2>
              <p className="text-muted-foreground">Your settings have been successfully migrated to the new database.</p>
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
              <p className="text-muted-foreground mb-6">{error}</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-paprika to-saffron"
                >
                  Retry
                </button>
                <button
                  onClick={handleSkip}
                  className="flex-1 px-6 py-3 rounded-xl font-medium border-2 border-border hover:border-border-strong"
                >
                  Skip & Start Fresh
                </button>
              </div>
            </motion.div>
          )}

          {/* Skipped */}
          {step === 'skipped' && (
            <motion.div
              key="skipped"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card rounded-3xl p-8 shadow-2xl border border-border text-center"
            >
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Starting fresh with new setup...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
