import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DetectionResult, ValidationResult, MigrationState } from './types';

interface MigrationProgressEvent {
  step: string;
  progress: number;
  message: string;
}

function App() {
  const [state, setState] = useState<MigrationState>('idle');
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Detect v1.0 database on startup
    detectDatabase();

    // Listen for progress events
    const unlisten = listen<MigrationProgressEvent>('migration_progress', (event) => {
      setProgress(event.payload.progress);
      setMessage(event.payload.message);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const detectDatabase = async () => {
    try {
      const result = await invoke<DetectionResult>('detect_database');
      setDetection(result);
    } catch (err) {
      setError(err as string);
    }
  };

  const startMigration = async () => {
    setState('running');
    setError(null);
    setProgress(0);
    setMessage('Starting migration...');

    try {
      // Call Rust backend to run migration
      const result: any = await invoke('start_migration');
      setValidation(result.validation);
      setState('success');
    } catch (err) {
      setError(err as string);
      setState('error');
    }
  };

  if (state === 'idle') {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>Coorg Food Company Migration</h1>
        <p>Migrate your v1.0 database to the latest system</p>

        {detection && (
          <div style={{ margin: '20px 0', padding: '20px', background: '#f0f0f0', borderRadius: '8px' }}>
            <h3>Database Found</h3>
            <p>Path: {detection.path}</p>
            <p>Sales Records: {detection.sales_count}</p>
            <p>Staff Users: {detection.staff_count}</p>
          </div>
        )}

        {error && (
          <div style={{ color: 'red', margin: '20px 0' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {detection && !error && (
          <button onClick={startMigration} style={{ padding: '12px 24px', fontSize: '16px' }}>
            Start Migration
          </button>
        )}
      </div>
    );
  }

  if (state === 'running') {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2>Migrating Data...</h2>
        <div style={{ margin: '20px 0' }}>
          <div style={{ width: '100%', height: '20px', background: '#f0f0f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#4CAF50', transition: 'width 0.3s' }} />
          </div>
          <p style={{ marginTop: '10px' }}>{progress}%</p>
        </div>
        <p>{message}</p>
      </div>
    );
  }

  if (state === 'success' && validation) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: 'green' }}>✅ Migration Complete!</h2>
        <div style={{ margin: '20px 0', padding: '20px', background: '#f0f0f0', borderRadius: '8px' }}>
          <h3>Migration Summary</h3>
          <p>Staff: {validation.staff.actual} {validation.staff.match ? '✅' : '❌'}</p>
          <p>Sales: {validation.sales.actual} {validation.sales.match ? '✅' : '❌'}</p>
          <p>Revenue: ₹{validation.revenue.toFixed(2)}</p>
          <p>Date Range: {validation.date_range.oldest} to {validation.date_range.newest}</p>
        </div>
        <div style={{ margin: '20px 0', padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
          <h3>Next Steps</h3>
          <ol style={{ textAlign: 'left' }}>
            <li>Close this migration tool</li>
            <li>Install the new POS version</li>
            <li>Launch the new POS app</li>
            <li>Login with your existing credentials</li>
            <li>Verify that your data is present</li>
          </ol>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: 'red' }}>❌ Migration Failed</h2>
        <div style={{ margin: '20px 0', padding: '20px', background: '#ffebee', borderRadius: '8px' }}>
          <p><strong>Error:</strong> {error}</p>
        </div>
        <div style={{ margin: '20px 0', padding: '20px', background: '#f0f0f0', borderRadius: '8px' }}>
          <p>Your original database has not been modified. All backup files were created for safety.</p>
        </div>
        <button onClick={() => { setState('idle'); setError(null); }}>
          Go Back
        </button>
      </div>
    );
  }

  return null;
}

export default App;
