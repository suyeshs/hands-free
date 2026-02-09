/**
 * Database Setup Component
 * Provides manual migration control to prevent automatic memory usage on startup
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Database, Play, CheckCircle, AlertCircle } from 'lucide-react';

interface MigrationStatus {
  is_fresh_install: boolean;
  migrations_applied: number;
  migrations_pending: number;
  needs_migration: boolean;
}

export function DatabaseSetup() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<MigrationStatus>('check_migration_status');
      setStatus(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const runMigrations = async () => {
    setRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await invoke<string>('run_core_migrations');
      setSuccess(result);
      // Refresh status
      await checkStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Failed to check database status</h3>
            {error && <p className="text-xs text-muted-foreground mt-1">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Database is ready
  if (!status.needs_migration) {
    return (
      <div className="p-6">
        <div className="bg-success/10 border border-success/30 rounded-lg p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Database Ready</h3>
            <p className="text-xs text-muted-foreground mt-1">
              All {status.migrations_applied} migrations applied. No action needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Needs migration
  return (
    <div className="p-6 space-y-4">
      {/* Status Info */}
      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3">
        <Database className="w-5 h-5 text-warning flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Database Setup Required</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {status.is_fresh_install
              ? 'This is a fresh installation. Click "Run Migrations" to set up the database.'
              : `${status.migrations_pending} migration(s) pending. ${status.migrations_applied} already applied.`}
          </p>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runMigrations}
        disabled={running}
        className="w-full px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {running ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Running Migrations...
          </>
        ) : (
          <>
            <Play size={18} />
            Run Migrations ({status.migrations_pending} pending)
          </>
        )}
      </button>

      {/* Success Message */}
      {success && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3">
          <p className="text-sm text-success">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-info/10 border border-info/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-foreground mb-2">What are migrations?</h4>
        <p className="text-xs text-muted-foreground">
          Migrations set up database tables and structures needed for the app to function. By making them manual,
          we prevent unnecessary memory usage on startup, especially for fresh installs.
        </p>
      </div>
    </div>
  );
}
