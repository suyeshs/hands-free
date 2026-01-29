/**
 * CompletionScreen Component
 * Celebration and completion screen
 */

import { useEffect, useState, useRef, useCallback } from 'react';
// import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// import { CelebrationAnimation } from '../CelebrationAnimation';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
// import { UserRole } from '../../../types/auth';

// Error categorization for structured error handling
enum ErrorType {
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  DATABASE_LOCKED = 'DATABASE_LOCKED',
  DATABASE_MISSING_TABLE = 'DATABASE_MISSING_TABLE',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Categorize error message into specific error types
 * This helps provide targeted recovery guidance
 */
const categorizeError = (errorMessage: string): ErrorType => {
  const msg = errorMessage.toLowerCase();

  if (msg.includes('timed out') && (msg.includes('database') || msg.includes('command'))) {
    return ErrorType.DATABASE_TIMEOUT;
  }
  if (msg.includes('locked') || msg.includes('busy')) {
    return ErrorType.DATABASE_LOCKED;
  }
  if (msg.includes('no such table') || msg.includes('migration')) {
    return ErrorType.DATABASE_MISSING_TABLE;
  }
  if (msg.includes('validation failed')) {
    return ErrorType.VALIDATION_FAILED;
  }
  if (msg.includes('timed out') && msg.includes('provisioning')) {
    return ErrorType.NETWORK_TIMEOUT;
  }
  if (msg.includes('fetch failed') || msg.includes('networkerror') || msg.includes('network')) {
    return ErrorType.NETWORK_ERROR;
  }
  if (msg.includes('provisioning failed')) {
    return ErrorType.API_ERROR;
  }
  return ErrorType.UNKNOWN;
};

/**
 * Get user-friendly guidance for each error type
 * Provides actionable steps for recovery
 */
const getErrorGuidance = (errorType: ErrorType): string => {
  switch (errorType) {
    case ErrorType.DATABASE_TIMEOUT:
      return 'The database took too long to respond. Try closing other instances of the app and retry.';
    case ErrorType.DATABASE_LOCKED:
      return 'The database is locked by another process. Close all other instances and retry.';
    case ErrorType.DATABASE_MISSING_TABLE:
      return 'Database migrations incomplete. Please restart with: bun tauri dev';
    case ErrorType.VALIDATION_FAILED:
      return 'Settings were not saved correctly. This may be a database issue. Try retry or force reset.';
    case ErrorType.NETWORK_TIMEOUT:
      return 'Network request timed out. Check your internet connection and retry.';
    case ErrorType.NETWORK_ERROR:
      return 'Cannot reach provisioning server. Check internet connection and retry.';
    case ErrorType.API_ERROR:
      return 'Provisioning server returned an error. This may be temporary, please retry.';
    case ErrorType.UNKNOWN:
      return 'An unexpected error occurred. Try retry first, then force reset if needed.';
  }
};

export function CompletionScreen() {
  const navigate = useNavigate();
  const { wizardData, hasIncompleteSetup } = useSetupWizardStore();
  // const { setUser, setTokens, switchRole } = useAuthStore();
  const [_countdown, _setCountdown] = useState(3);
  const [showResetButton, setShowResetButton] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [canRetry, setCanRetry] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [offlineMode, setOfflineMode] = useState(false);
  const hasNavigated = useRef(false);

  const addLog = useCallback((message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  // Copy activation code to clipboard
  const copyToClipboard = async () => {
    if (!activationCode) return;
    try {
      await navigator.clipboard.writeText(activationCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      addLog('Activation code copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
      addLog('Failed to copy activation code');
    }
  };

  // Provision restaurant and get activation code
  const provisionRestaurant = useCallback(async () => {
    try {
      addLog('Starting restaurant provisioning...');
      setIsProvisioning(true);

      // Add timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        addLog('⏱️  Request taking longer than 30 seconds...');
        controller.abort();
      }, 30000); // 30 second timeout

      let response: Response;
      try {
        // Use the new dedicated provisioning worker
        const provisioningUrl = import.meta.env.VITE_PROVISIONING_URL ||
          'https://handsfree-restaurant-provisioning.suyesh.workers.dev';

        const requestData = {
          companyName: wizardData.restaurantInfo?.name || 'Restaurant',
          email: wizardData.restaurantInfo?.email || 'owner@restaurant.local',
          phone: wizardData.restaurantInfo?.phone || '',
          tenantId: wizardData.restaurantInfo?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'restaurant',
          businessCategory: 'RESTAURANT',
        };

        addLog(`Making request to: ${provisioningUrl}/api/provision`);
        addLog(`Request data: ${JSON.stringify(requestData, null, 2)}`);

        response = await fetch(`${provisioningUrl}/api/provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          throw new Error('Provisioning timed out after 30 seconds. Please check your internet connection and retry.');
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }

      if (!response.ok) {
        throw new Error(`Provisioning failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success || !result.activationCode) {
        throw new Error(result?.error || 'Failed to get activation code');
      }

      const code = result.activationCode;
      addLog(`✅ Restaurant provisioned successfully!`);
      addLog(`Activation code: ${code}`);
      setActivationCode(code);

      // Store activation code, mark as owner, and mark setup as awaiting activation in SQLite
      const { setAwaitingActivation, setActivationCode: saveActivationCode, setIsRestaurantOwner } = useSetupWizardStore.getState();
      await saveActivationCode(code);
      await setIsRestaurantOwner(true);
      await setAwaitingActivation(true);

      setIsProvisioning(false);
      return code;
    } catch (error: any) {
      addLog(`❌ Provisioning failed: ${error.message}`);
      setErrorMessage(error.message);
      setIsProvisioning(false);
      throw error;
    }
  }, [addLog, wizardData]);

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasNavigated.current) {
      addLog('Already processed, skipping');
      return;
    }

    addLog('===== COMPONENT MOUNTED =====');
    addLog(`Current timestamp: ${Date.now()}`);

    // Mark as processed
    hasNavigated.current = true;

    // Show reset button after 5 seconds if still frozen
    const resetTimeout = setTimeout(() => {
      addLog('Still on completion screen after 5s, showing reset button');
      setShowResetButton(true);
    }, 5000);

    // Complete setup on mount
    const completeSetupAsync = async () => {
      try {
        addLog('===== SETUP COMPLETION ATTEMPT =====');
        addLog(`Attempt: ${retryCount + 1}`);
        addLog(`Timestamp: ${new Date().toISOString()}`);

        // Step 1: Save settings to local SQLite
        addLog('📋 Step 1/3: Saving settings to local SQLite...');
        const wizardState = useSetupWizardStore.getState();
        addLog(`Restaurant: ${wizardData.restaurantInfo?.name}`);
        addLog(`Training mode: ${wizardData.trainingMode}`);

        await wizardState.completeSetup();

        // Set session flag to skip unnecessary migration checks
        sessionStorage.setItem('setup-just-completed', 'true');
        addLog('✅ Local setup completed and validated successfully');

        // Step 2: Check online status before provisioning
        addLog('📋 Step 2/3: Checking network status...');
        if (!navigator.onLine) {
          addLog('⚠️  Offline mode detected');
          addLog('Skipping cloud provisioning - you can provision later from Settings');

          setErrorMessage('Setup completed in offline mode. Cloud provisioning skipped.\n\nYou can provision later from Settings when online.');
          setShowResetButton(false);
          setOfflineMode(true);
          clearTimeout(resetTimeout);
          return;
        }

        // Step 3: Provision restaurant on cloud and get activation code
        addLog('📋 Step 3/3: Provisioning restaurant on cloud...');
        await provisionRestaurant();

        addLog('✅ All setup steps completed!');
        addLog('Copy your activation code and proceed to activation');

        // Don't auto-navigate - let user copy code first
        clearTimeout(resetTimeout);
        setRetryCount(0); // Reset on success
      } catch (error: any) {
        const errorMsg = error?.message || 'Unknown error';
        addLog(`❌ ERROR: ${errorMsg}`);
        console.error('[CompletionScreen] Full error:', error);
        console.error('[CompletionScreen] Error stack:', error?.stack);

        // Categorize error and get guidance
        const errorType = categorizeError(errorMsg);
        const guidance = getErrorGuidance(errorType);

        addLog(`💡 Error type: ${errorType}`);
        addLog(`💡 Guidance: ${guidance}`);

        // Determine if error is retryable
        const isRetryable =
          errorMsg.includes('timeout') ||
          errorMsg.includes('timed out') ||
          errorMsg.includes('network') ||
          errorMsg.includes('fetch failed') ||
          errorMsg.includes('locked') ||
          errorMsg.includes('BUSY');

        if (isRetryable && retryCount < 3) {
          setCanRetry(true);
          addLog(`✅ Error appears retryable. Retry available (${3 - retryCount} attempts left)`);
        } else {
          setCanRetry(false);
          if (retryCount >= 3) {
            addLog('❌ Max retries reached. Please use Force Reset.');
          } else {
            addLog('❌ Error not retryable. Please use Force Reset.');
          }
        }

        // Show error in UI with guidance
        setErrorMessage(`${errorMsg}\n\n${guidance}`);
        setShowResetButton(true); // Show reset button immediately on error
      }
    };

    completeSetupAsync();

    return () => {
      clearTimeout(resetTimeout);
    };
  }, [addLog, provisionRestaurant]);

  const handleProceedToActivation = () => {
    addLog('Proceeding to tenant activation...');

    // Navigate to root - App.tsx will check awaitingActivation flag and show TenantActivation screen
    navigate('/');
  };

  const handleForceReset = () => {
    console.log('[CompletionScreen] ===== FORCE RESET TRIGGERED =====');
    if (confirm('This will clear all data and restart the setup wizard. Continue?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.hash = '#/';
      window.location.reload();
    }
  };

  const handleRetry = useCallback(async () => {
    if (!canRetry) return;

    addLog('===== USER INITIATED RETRY =====');
    setRetryCount(prev => prev + 1);
    setErrorMessage('');
    setShowResetButton(false);
    setCanRetry(false); // Disable during retry

    // Re-run setup
    try {
      addLog('===== RETRY SETUP ATTEMPT =====');
      addLog(`Retry count: ${retryCount + 1}`);

      // Step 1: Save settings to local SQLite
      addLog('📋 Step 1/3: Saving settings to local SQLite...');
      const wizardState = useSetupWizardStore.getState();

      await wizardState.completeSetup();
      sessionStorage.setItem('setup-just-completed', 'true');
      addLog('✅ Local setup completed and validated successfully');

      // Step 2: Check online status
      addLog('📋 Step 2/3: Checking network status...');
      if (!navigator.onLine) {
        addLog('⚠️  Offline mode detected');
        setErrorMessage('Setup completed in offline mode. Cloud provisioning skipped.');
        setOfflineMode(true);
        return;
      }

      // Step 3: Provision
      addLog('📋 Step 3/3: Provisioning restaurant on cloud...');
      await provisionRestaurant();

      addLog('✅ All setup steps completed!');
      setRetryCount(0);
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      addLog(`❌ RETRY ERROR: ${errorMsg}`);

      const errorType = categorizeError(errorMsg);
      const guidance = getErrorGuidance(errorType);

      const isRetryable =
        errorMsg.includes('timeout') ||
        errorMsg.includes('network') ||
        errorMsg.includes('locked');

      if (isRetryable && retryCount + 1 < 3) {
        setCanRetry(true);
        addLog(`Retry available (${3 - (retryCount + 1)} attempts left)`);
      } else {
        setCanRetry(false);
      }

      setErrorMessage(`${errorMsg}\n\n${guidance}`);
      setShowResetButton(true);
    }
  }, [canRetry, retryCount, addLog, provisionRestaurant, wizardData]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      textAlign: 'center',
      position: 'relative',
    }}>
      {/* On-Screen Diagnostic Logs */}
      <div style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        right: '10px',
        maxHeight: '200px',
        overflowY: 'auto',
        background: 'rgba(0, 0, 0, 0.9)',
        border: '2px solid #4ade80',
        borderRadius: '8px',
        padding: '15px',
        fontFamily: 'monospace',
        fontSize: '12px',
        textAlign: 'left',
        zIndex: 99999,
        color: '#4ade80',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#fff' }}>
          🔍 Setup Diagnostic Log {errorMessage && '- ERROR DETECTED'}
        </div>
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '10px',
            color: '#fca5a5',
          }}>
            <strong>❌ ERROR:</strong> {errorMessage}
          </div>
        )}
        {logs.length === 0 ? (
          <div style={{ color: '#888' }}>Waiting for logs...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{
              marginBottom: '4px',
              color: log.includes('❌') ? '#fca5a5' : log.includes('✅') ? '#86efac' : '#4ade80'
            }}>
              {log}
            </div>
          ))
        )}
        <div style={{ marginTop: '10px', fontSize: '10px', color: '#888' }}>
          {errorMessage ?
            'You may need to restart Tauri dev server: bun tauri dev' :
            'Logs updating in real-time...'
          }
        </div>
      </div>

      {/* Success Icon */}
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '30px',
        boxShadow: '0 10px 40px rgba(16, 185, 129, 0.3)',
      }}>
        <CheckCircle
          style={{
            width: '64px',
            height: '64px',
            color: 'white',
            strokeWidth: 2.5,
          }}
        />
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: '56px',
        fontWeight: 900,
        color: 'white',
        marginBottom: '20px',
        textTransform: 'uppercase',
        letterSpacing: '2px',
      }}>
        🎉 You're All Set!
      </h1>

      <p style={{
        fontSize: '24px',
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: '40px',
      }}>
        {wizardData.restaurantInfo?.name || 'Your restaurant'} is ready to go
      </p>

      {/* Summary Card */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        marginBottom: '40px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#666' }}>Restaurant</span>
            <span style={{ fontWeight: 'bold', color: '#111' }}>{wizardData.restaurantInfo?.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#666' }}>Mode</span>
            <span style={{
              fontWeight: 'bold',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              background: wizardData.trainingMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: wizardData.trainingMode ? '#3b82f6' : '#10b981',
            }}>
              {wizardData.trainingMode ? 'Training Mode' : 'Live Mode'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Tax Mode</span>
            <span style={{ fontWeight: 'bold', color: '#111' }}>
              {wizardData.taxSettings?.mode === 'gst' ? 'GST Enabled' : 'Simple (No Tax)'}
            </span>
          </div>
        </div>
      </div>

      {/* Incomplete Setup Warning */}
      {hasIncompleteSetup() && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '40px',
          maxWidth: '600px',
          width: '100%',
        }}>
          <p style={{ fontSize: '14px', color: 'white', margin: 0 }}>
            You can complete the remaining setup steps anytime from{' '}
            <strong>Settings → Setup Checklist</strong>
          </p>
        </div>
      )}

      {/* Activation Code Display */}
      {isProvisioning ? (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '30px 60px',
          borderRadius: '20px',
          marginBottom: '30px',
          border: '4px solid white',
        }}>
          <div style={{
            fontSize: '24px',
            color: 'white',
            fontWeight: 'bold',
            marginBottom: '15px',
          }}>
            Provisioning restaurant...
          </div>
          <div style={{
            width: '60px',
            height: '60px',
            margin: '0 auto',
            border: '6px solid rgba(255, 255, 255, 0.3)',
            borderTop: '6px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
        </div>
      ) : activationCode ? (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '40px',
          borderRadius: '20px',
          marginBottom: '30px',
          border: '4px solid #4ade80',
          maxWidth: '700px',
          width: '100%',
        }}>
          <div style={{
            fontSize: '20px',
            color: '#4ade80',
            fontWeight: 'bold',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            🎉 Your Activation Code
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px',
            marginBottom: '20px',
          }}>
            <div style={{
              fontSize: '32px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '4px',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '20px 30px',
              borderRadius: '12px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
            }}>
              {activationCode}
            </div>
            <button
              onClick={copyToClipboard}
              style={{
                padding: '15px',
                background: isCopied ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: '2px solid',
                borderColor: isCopied ? '#4ade80' : 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isCopied) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                if (!isCopied) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              {isCopied ? (
                <Check style={{ width: '24px', height: '24px', color: '#4ade80' }} />
              ) : (
                <Copy style={{ width: '24px', height: '24px', color: 'white' }} />
              )}
            </button>
          </div>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            margin: 0,
          }}>
            Copy this code and click below to activate your POS
          </p>
        </div>
      ) : null}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Action Button */}
      {activationCode && !isProvisioning && (
        <button
          onClick={handleProceedToActivation}
          style={{
            padding: '20px 50px',
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'white',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(249, 115, 22, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            transition: 'transform 0.2s',
            position: 'relative',
            zIndex: 10,
            marginBottom: showResetButton ? '20px' : '0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 15px 40px rgba(249, 115, 22, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(249, 115, 22, 0.4)';
          }}
        >
          <span>Proceed to Activation</span>
          <ArrowRight style={{ width: '24px', height: '24px' }} />
        </button>
      )}

      {/* Reset Button - Shows if frozen */}
      {showResetButton && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '2px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
        }}>
          <p style={{
            color: 'white',
            fontSize: '16px',
            marginBottom: '15px',
            fontWeight: 'bold',
          }}>
            ⚠️ Setup appears to be stuck
          </p>
          <p style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            marginBottom: '20px',
          }}>
            {errorMessage || 'This may be due to the database path issue. Please restart the Tauri dev server with bun tauri dev to compile the Rust fixes.'}
          </p>

          {/* Retry Button - Shows if error is retryable */}
          {canRetry && errorMessage && (
            <div style={{ marginBottom: '15px', textAlign: 'center' }}>
              <button
                onClick={handleRetry}
                style={{
                  padding: '15px 40px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                }}
              >
                🔄 Retry Setup (Attempt {retryCount + 2}/4)
              </button>
              <p style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: '10px',
              }}>
                {3 - retryCount} retry attempts remaining
              </p>
            </div>
          )}

          {/* Offline Mode - Show "Proceed Anyway" button */}
          {offlineMode && !activationCode && (
            <div style={{ marginBottom: '15px', textAlign: 'center' }}>
              <button
                onClick={() => navigate('/hub')}
                style={{
                  padding: '15px 40px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ➡️ Proceed to App (Offline Mode)
              </button>
              <p style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: '10px',
              }}>
                You can provision later from Settings when online
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleForceReset}
              style={{
                padding: '12px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              🔄 Force Reset & Restart
            </button>
            <button
              onClick={() => window.location.hash = '#/diagnostic'}
              style={{
                padding: '12px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              🔍 Open Diagnostics
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
