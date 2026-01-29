/**
 * Migration Diagnostics
 * Shows migration status and allows manual migration triggers
 */

import { useState, useEffect } from 'react';
import { Database, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { checkMigrationStatus, resetMigrationStatus } from '../../services/settingsMigration';
import { runPendingMigrations } from '../../lib/databaseMigration';

export function MigrationDiagnostics() {
  const [settingsMigrationStatus, setSettingsMigrationStatus] = useState<any>(null);
  const [databaseMigrationStatus, setDatabaseMigrationStatus] = useState<string>('unknown');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      // Check settings migration status
      const settingsStatus = await checkMigrationStatus();
      setSettingsMigrationStatus(settingsStatus);

      // Check database migration status from sessionStorage
      const dbComplete = sessionStorage.getItem('db-migration-v3.1-complete');
      setDatabaseMigrationStatus(dbComplete === 'true' ? 'complete' : 'not-run');
    } catch (error) {
      console.error('[MigrationDiagnostics] Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDatabaseMigration = async () => {
    if (!confirm('Run database schema migrations? This will apply any pending SQL migrations.')) {
      return;
    }

    setRunning(true);
    try {
      const result = await runPendingMigrations();
      if (result.success) {
        alert(`Database migration complete!\n\nApplied:\n${result.migrations.join('\n')}`);
        sessionStorage.setItem('db-migration-v3.1-complete', 'true');
        await loadStatus();
      } else {
        alert(`Database migration failed!\n\nErrors:\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      alert(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  const handleResetSettingsMigration = () => {
    if (!confirm('Reset settings migration status? This will allow the migration prompt to appear again on next app restart.')) {
      return;
    }

    resetMigrationStatus();
    alert('Settings migration status reset. The migration prompt will appear on next app restart.');
    loadStatus();
  };

  const handleResetDatabaseMigration = () => {
    if (!confirm('Reset database migration status? This will allow database migrations to run again.')) {
      return;
    }

    sessionStorage.removeItem('db-migration-v3.1-complete');
    alert('Database migration status reset. Migrations will run on next app restart.');
    loadStatus();
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Loading migration status...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black uppercase tracking-wider mb-2">Migration Diagnostics</h2>
        <p className="text-muted-foreground">
          View and manage database and settings migrations
        </p>
      </div>

      {/* Database Migration Status */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Database className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2">Database Schema Migration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              SQL schema updates for v3.1+ (sales sync, new columns)
            </p>

            {/* Status */}
            <div className="flex items-center gap-2 mb-4">
              {databaseMigrationStatus === 'complete' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="text-sm font-medium text-success">Completed this session</span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-warning" />
                  <span className="text-sm font-medium text-warning">Not run this session</span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleRunDatabaseMigration}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 font-bold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
                {running ? 'Running...' : 'Run Migrations'}
              </button>
              <button
                onClick={handleResetDatabaseMigration}
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-muted-foreground font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Reset Status
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Migration Status */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2">Settings Migration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              localStorage → SQLite migration (v3.0 → v3.1+)
            </p>

            {/* Status Details */}
            {settingsMigrationStatus && (
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center justify-between p-2 bg-surface-2">
                  <span className="text-muted-foreground">Migration Complete:</span>
                  <span className={`font-bold ${settingsMigrationStatus.migrationComplete ? 'text-success' : 'text-warning'}`}>
                    {settingsMigrationStatus.migrationComplete ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-surface-2">
                  <span className="text-muted-foreground">Has Old Settings:</span>
                  <span className={`font-bold ${settingsMigrationStatus.hasOldSettings ? 'text-warning' : 'text-muted-foreground'}`}>
                    {settingsMigrationStatus.hasOldSettings ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-surface-2">
                  <span className="text-muted-foreground">Has SQLite Settings:</span>
                  <span className={`font-bold ${settingsMigrationStatus.hasSQLiteSettings ? 'text-success' : 'text-muted-foreground'}`}>
                    {settingsMigrationStatus.hasSQLiteSettings ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-surface-2">
                  <span className="text-muted-foreground">Needs Migration:</span>
                  <span className={`font-bold ${settingsMigrationStatus.needsMigration ? 'text-warning' : 'text-success'}`}>
                    {settingsMigrationStatus.needsMigration ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleResetSettingsMigration}
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-muted-foreground font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Reset Migration Flag
              </button>
              <button
                onClick={loadStatus}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="card-flat bg-info/10 border border-info/30 p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div className="text-sm text-info-foreground">
            <p className="font-bold mb-1">About Migrations</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Database migrations update SQL schema (add columns, indexes)</li>
              <li>Settings migration moves data from browser storage to SQLite</li>
              <li>Migrations automatically run on app startup when needed</li>
              <li>Use these tools for debugging or manual migration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
