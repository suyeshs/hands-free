/**
 * Example: Using the Tauri Sync System in React
 *
 * This file demonstrates how to integrate the Rust sync engine
 * into your React POS application.
 */

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SyncStatus {
  is_running: boolean;
  active_intervals: number;
}

interface QueueStats {
  total_items: number;
  failed_items: number;
  oldest_item_age_ms: number;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  duration_ms: number;
}

export function SyncManagerComponent() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize sync system on component mount
  useEffect(() => {
    initializeSync();

    // Refresh status every 5 seconds
    const statusInterval = setInterval(refreshStatus, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
      stopSync();
    };
  }, []);

  const initializeSync = async () => {
    try {
      // Get tenant ID and API URL from your app config
      const tenantId = localStorage.getItem('tenantId') || 'coorg-food-company-6163';
      const apiBaseUrl = `https://${tenantId}.handsfree-tenants.workers.dev`;

      // Initialize sync system
      await invoke('init_sync', {
        tenantId,
        apiBaseUrl,
      });

      // Start automatic tiered sync
      await invoke('start_auto_sync');

      setIsInitialized(true);
      setError(null);

      // Initial status refresh
      await refreshStatus();
    } catch (err) {
      console.error('Failed to initialize sync:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshStatus = async () => {
    try {
      const [status, stats] = await Promise.all([
        invoke<SyncStatus>('get_sync_status'),
        invoke<QueueStats>('get_queue_stats'),
      ]);

      setSyncStatus(status);
      setQueueStats(stats);
    } catch (err) {
      console.error('Failed to get sync status:', err);
    }
  };

  const stopSync = async () => {
    try {
      await invoke('stop_auto_sync');
      setIsInitialized(false);
    } catch (err) {
      console.error('Failed to stop sync:', err);
    }
  };

  const triggerManualSync = async (dataType: string) => {
    try {
      const result = await invoke<SyncResult>('trigger_sync', { dataType });

      if (result.success) {
        alert(`Successfully synced ${result.synced} ${dataType} records in ${result.duration_ms}ms`);
      } else {
        alert(`Sync failed: ${result.failed} records failed`);
      }

      await refreshStatus();
    } catch (err) {
      alert(`Sync error: ${err}`);
    }
  };

  const processOfflineQueue = async () => {
    try {
      const result = await invoke<{ total: number; synced: number; failed: number }>('process_offline_queue');

      alert(`Offline Queue Processed:\n${result.synced}/${result.total} items synced\n${result.failed} failed`);

      await refreshStatus();
    } catch (err) {
      alert(`Failed to process offline queue: ${err}`);
    }
  };

  const clearFailedQueue = async () => {
    if (!window.confirm('Clear all failed queue items? This cannot be undone.')) {
      return;
    }

    try {
      await invoke('clear_failed_queue');
      alert('Failed queue items cleared');
      await refreshStatus();
    } catch (err) {
      alert(`Failed to clear queue: ${err}`);
    }
  };

  if (!isInitialized) {
    return (
      <div className="sync-manager">
        <h2>Sync Manager</h2>
        {error ? (
          <div className="error">
            <p>Failed to initialize sync: {error}</p>
            <button onClick={initializeSync}>Retry</button>
          </div>
        ) : (
          <p>Initializing sync system...</p>
        )}
      </div>
    );
  }

  return (
    <div className="sync-manager">
      <h2>Sync Manager</h2>

      {/* Status Section */}
      <div className="status-section">
        <h3>Status</h3>
        {syncStatus && (
          <div>
            <p>
              <strong>Running:</strong>{' '}
              <span className={syncStatus.is_running ? 'status-active' : 'status-inactive'}>
                {syncStatus.is_running ? '✅ Active' : '❌ Stopped'}
              </span>
            </p>
            <p>
              <strong>Active Intervals:</strong> {syncStatus.active_intervals}
            </p>
          </div>
        )}
      </div>

      {/* Offline Queue Section */}
      <div className="queue-section">
        <h3>Offline Queue</h3>
        {queueStats && (
          <div>
            <p>
              <strong>Pending Items:</strong> {queueStats.total_items}
            </p>
            <p>
              <strong>Failed Items:</strong>{' '}
              <span className={queueStats.failed_items > 0 ? 'warning' : ''}>
                {queueStats.failed_items}
              </span>
            </p>
            {queueStats.total_items > 0 && (
              <p>
                <strong>Oldest Item:</strong> {Math.round(queueStats.oldest_item_age_ms / 1000 / 60)} minutes ago
              </p>
            )}
          </div>
        )}
        <div className="queue-actions">
          <button onClick={processOfflineQueue} disabled={!queueStats || queueStats.total_items === 0}>
            Process Queue ({queueStats?.total_items || 0})
          </button>
          <button onClick={clearFailedQueue} disabled={!queueStats || queueStats.failed_items === 0}>
            Clear Failed ({queueStats?.failed_items || 0})
          </button>
        </div>
      </div>

      {/* Manual Sync Section */}
      <div className="manual-sync-section">
        <h3>Manual Sync</h3>
        <p>Trigger immediate sync for specific data types:</p>
        <div className="sync-buttons">
          <button onClick={() => triggerManualSync('orders')}>Sync Orders</button>
          <button onClick={() => triggerManualSync('tips')}>Sync Tips</button>
          <button onClick={() => triggerManualSync('sales')}>Sync Sales</button>
          <button onClick={() => triggerManualSync('menu_items')}>Sync Menu</button>
          <button onClick={() => triggerManualSync('staff')}>Sync Staff</button>
          <button onClick={() => triggerManualSync('inventory_items')}>Sync Inventory</button>
        </div>
      </div>

      {/* Control Section */}
      <div className="control-section">
        <button onClick={stopSync} className="danger">
          Stop Sync
        </button>
        <button onClick={refreshStatus}>
          Refresh Status
        </button>
      </div>
    </div>
  );
}

// Example CSS
const styles = `
.sync-manager {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.status-section,
.queue-section,
.manual-sync-section,
.control-section {
  background: #f5f5f5;
  padding: 15px;
  margin: 15px 0;
  border-radius: 8px;
}

.status-active {
  color: #22c55e;
  font-weight: bold;
}

.status-inactive {
  color: #ef4444;
  font-weight: bold;
}

.warning {
  color: #f59e0b;
  font-weight: bold;
}

.error {
  background: #fee2e2;
  color: #dc2626;
  padding: 15px;
  border-radius: 8px;
  margin: 15px 0;
}

.sync-buttons,
.queue-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}

button {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

button:hover:not(:disabled) {
  background: #2563eb;
}

button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

button.danger {
  background: #ef4444;
}

button.danger:hover {
  background: #dc2626;
}
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// Usage in your main app:
/*

import { SyncManagerComponent } from './SyncManagerComponent';

function App() {
  return (
    <div>
      <h1>Restaurant POS</h1>

      {/* Your existing POS UI *\/}

      {/* Sync Manager (can be in a settings/admin panel) *\/}
      <SyncManagerComponent />
    </div>
  );
}

*/

// Alternative: Use sync in the background without UI

export function useBackgroundSync() {
  useEffect(() => {
    const initSync = async () => {
      try {
        const tenantId = localStorage.getItem('tenantId') || 'coorg-food-company-6163';
        const apiBaseUrl = `https://${tenantId}.handsfree-tenants.workers.dev`;

        await invoke('init_sync', { tenantId, apiBaseUrl });
        await invoke('start_auto_sync');

        console.log('[Sync] Background sync started');
      } catch (err) {
        console.error('[Sync] Failed to start background sync:', err);
      }
    };

    initSync();

    return () => {
      invoke('stop_auto_sync').catch(console.error);
    };
  }, []);
}

// Usage in main app:
/*

function App() {
  useBackgroundSync(); // Starts sync automatically in background

  return (
    <div>
      {/* Your POS UI *\/}
    </div>
  );
}

*/
