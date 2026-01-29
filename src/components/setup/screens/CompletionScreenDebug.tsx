/**
 * Debug version of CompletionScreen that shows visible API status
 * Use this to debug when dev console is inaccessible
 */

import { useState, useEffect } from 'react';

export function CompletionScreenDebug() {
  const [apiStatus, setApiStatus] = useState<{
    url: string;
    status: 'checking' | 'online' | 'offline' | 'error';
    message: string;
    timestamp: string;
  }>({
    url: '',
    status: 'checking',
    message: 'Checking API...',
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    const checkAPI = async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://handsfree-admin.stonepottech.workers.dev';

      setApiStatus({
        url: apiUrl,
        status: 'checking',
        message: 'Attempting to connect...',
        timestamp: new Date().toISOString()
      });

      try {
        // Try to fetch with short timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${apiUrl}/health`, {
          signal: controller.signal,
          method: 'GET',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setApiStatus({
            url: apiUrl,
            status: 'online',
            message: `API is online! Response: ${JSON.stringify(data)}`,
            timestamp: new Date().toISOString()
          });
        } else {
          setApiStatus({
            url: apiUrl,
            status: 'error',
            message: `API returned ${response.status}: ${response.statusText}`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          setApiStatus({
            url: apiUrl,
            status: 'offline',
            message: 'API connection timed out after 5 seconds',
            timestamp: new Date().toISOString()
          });
        } else {
          setApiStatus({
            url: apiUrl,
            status: 'offline',
            message: `API connection failed: ${error.message}`,
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    checkAPI();
  }, []);

  const statusColor = {
    checking: '#fbbf24',
    online: '#10b981',
    offline: '#ef4444',
    error: '#f97316'
  }[apiStatus.status];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#1a1a1a',
      color: 'white',
      padding: '40px',
      overflowY: 'auto',
      fontFamily: 'monospace',
      zIndex: 9999
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h1 style={{ marginBottom: '30px', fontSize: '32px' }}>
          🔍 API Diagnostic Tool
        </h1>

        <div style={{
          background: '#2a2a2a',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          borderLeft: `4px solid ${statusColor}`
        }}>
          <div style={{ marginBottom: '10px', fontSize: '14px', opacity: 0.7 }}>
            Status: <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '16px' }}>
              {apiStatus.status.toUpperCase()}
            </span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>API URL:</strong><br/>
            <code style={{ background: '#1a1a1a', padding: '5px 10px', borderRadius: '4px', display: 'inline-block', marginTop: '5px' }}>
              {apiStatus.url}
            </code>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>Message:</strong><br/>
            <div style={{ marginTop: '5px', padding: '10px', background: '#1a1a1a', borderRadius: '4px' }}>
              {apiStatus.message}
            </div>
          </div>

          <div style={{ fontSize: '12px', opacity: 0.5 }}>
            Last checked: {apiStatus.timestamp}
          </div>
        </div>

        <div style={{
          background: '#2a2a2a',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2 style={{ marginBottom: '15px', fontSize: '20px' }}>Environment Variables</h2>
          <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
            <div>VITE_API_URL: <code>{import.meta.env.VITE_API_URL || '(not set)'}</code></div>
            <div>MODE: <code>{import.meta.env.MODE}</code></div>
            <div>DEV: <code>{String(import.meta.env.DEV)}</code></div>
          </div>
        </div>

        <div style={{
          background: '#2a2a2a',
          padding: '20px',
          borderRadius: '8px'
        }}>
          <h2 style={{ marginBottom: '15px', fontSize: '20px' }}>Network Status</h2>
          <div>
            <div>Navigator Online: <code style={{ color: navigator.onLine ? '#10b981' : '#ef4444' }}>
              {navigator.onLine ? 'ONLINE' : 'OFFLINE'}
            </code></div>
          </div>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '15px 40px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
