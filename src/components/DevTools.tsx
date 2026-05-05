/**
 * Developer Tools Panel
 * Accessible via Cmd+Shift+D (or Ctrl+Shift+D)
 * Provides quick access to reset and debug functions
 */

import { useState, useEffect } from 'react';
import { X, Trash2, Database, HardDrive, Loader2, Terminal } from 'lucide-react';
import { resetEverything, quickResetDev } from '../lib/resetEverything';
import { useNavigate } from 'react-router-dom';

interface DevToolsProps {
  onClose: () => void;
}

export function DevTools({ onClose }: DevToolsProps) {
  const navigate = useNavigate();
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState<string[]>([]);
  const [dbInfo, setDbInfo] = useState<{
    path: string;
    size: string;
    exists: boolean;
  } | null>(null);

  useEffect(() => {
    loadDbInfo();
  }, []);

  const loadDbInfo = async () => {
    try {
      const { appDataDir } = await import('@tauri-apps/api/path');
      const { exists, stat, remove } = await import('@tauri-apps/plugin-fs');

      const appData = await appDataDir();
      const dbPath = `${appData}pos-dev.db`;
      const fileExists = await exists(dbPath);

      if (fileExists) {
        const fileStat = await stat(dbPath);
        const sizeInMB = (fileStat.size / (1024 * 1024)).toFixed(2);

        setDbInfo({
          path: dbPath,
          size: `${sizeInMB} MB`,
          exists: true,
        });
      } else {
        setDbInfo({
          path: dbPath,
          size: 'N/A',
          exists: false,
        });
      }
    } catch (error) {
      console.error('Failed to load DB info:', error);
    }
  };

  const handleQuickReset = async () => {
    if (!confirm('Quick reset? This will delete everything immediately (no further confirmation).')) {
      return;
    }

    setIsResetting(true);
    setResetProgress(['Starting quick reset...']);

    try {
      await quickResetDev();
    } catch (error) {
      console.error('Quick reset failed:', error);
      alert('Reset failed: ' + error);
      setIsResetting(false);
    }
  };

  const handleFullReset = async () => {
    setIsResetting(true);

    try {
      await resetEverything((steps) => {
        const messages = steps.map(s => `${s.status === 'complete' ? '✅' : s.status === 'in-progress' ? '⏳' : '⭕'} ${s.message}`);
        setResetProgress(messages);
      });
    } catch (error) {
      console.error('Full reset failed:', error);
      setIsResetting(false);
    }
  };

  const handleClearStorage = () => {
    if (confirm('Clear localStorage and sessionStorage?')) {
      localStorage.clear();
      sessionStorage.clear();
      alert('Storage cleared! Reloading...');
      window.location.reload();
    }
  };

  const handleOpenDbLocation = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-opener');
      const { appDataDir } = await import('@tauri-apps/api/path');
      const path = await appDataDir();
      await open(path);
    } catch (error) {
      alert('Failed to open location: ' + error);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border-2 border-primary rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-white font-bold text-lg">Developer Tools</h2>
              <p className="text-white/80 text-xs">DEV MODE ONLY</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Database Info */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Database Info</h3>
            </div>

            {dbInfo ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-semibold ${dbInfo.exists ? 'text-green-500' : 'text-red-500'}`}>
                    {dbInfo.exists ? '✅ Exists' : '❌ Not Found'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-mono">{dbInfo.size}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground">Path:</span>
                  <span className="font-mono text-xs text-right break-all flex-1">
                    {dbInfo.path}
                  </span>
                </div>
                <button
                  onClick={handleOpenDbLocation}
                  className="w-full mt-2 py-2 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded text-sm font-medium transition-colors"
                >
                  Open Location
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Reset Progress */}
          {isResetting && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-3">Reset Progress</h3>
              <div className="space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
                {resetProgress.map((msg, i) => (
                  <div key={i} className="text-muted-foreground">
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Storage Actions</h3>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleClearStorage}
                disabled={isResetting}
                className="w-full py-3 px-4 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4" />
                Clear Browser Storage
              </button>

              <button
                onClick={() => navigate('/complete-reset')}
                disabled={isResetting}
                className="w-full py-3 px-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Complete Reset UI
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-500/5 border-2 border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleQuickReset}
                disabled={isResetting || !import.meta.env.DEV}
                className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Quick Reset (No Confirm)
                  </>
                )}
              </button>

              <button
                onClick={handleFullReset}
                disabled={isResetting}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Full Reset (With Confirm)
                  </>
                )}
              </button>

              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-2">
                ⚠️ These actions permanently delete all data and cannot be undone!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dev Tools Toggle Button (Floating)
 * Shows only in development mode
 */
export function DevToolsButton() {
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    // Keyboard shortcut: Cmd+Shift+D or Ctrl+Shift+D
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDevTools(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Only show in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setShowDevTools(true)}
        className="fixed bottom-4 right-4 z-[9998] p-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-lg transition-all hover:scale-110"
        title="Dev Tools (Cmd+Shift+D)"
      >
        <Terminal className="w-5 h-5" />
      </button>

      {/* Dev Tools Panel */}
      {showDevTools && <DevTools onClose={() => setShowDevTools(false)} />}
    </>
  );
}
