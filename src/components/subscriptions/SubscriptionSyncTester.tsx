/**
 * Subscription Sync Tester Component
 * Tests and displays sync status for subscription data
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import { testSubscriptionSync, displaySyncTestResults } from '../../scripts/testSubscriptionSync';
import { cn } from '../../lib/utils';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

export function SubscriptionSyncTester() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [showDetails, setShowDetails] = useState<Record<number, boolean>>({});

  async function runSyncTest() {
    setIsRunning(true);
    setResults([]);
    setShowDetails({});

    try {
      const testResults = await testSubscriptionSync();
      setResults(testResults);
      displaySyncTestResults(testResults); // Also log to console
    } catch (error) {
      console.error('Sync test failed:', error);
      setResults([
        {
          step: 'Fatal Error',
          success: false,
          message: `Test failed: ${error}`,
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  }

  const allSuccess = results.length > 0 && results.every((r) => r.success);
  const anyFailures = results.some((r) => !r.success);

  return (
    <div className="glass-panel p-6 rounded-lg max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
            results.length === 0 && 'bg-gradient-to-br from-primary to-primary',
            allSuccess && 'bg-gradient-to-br from-green-600 to-green-700',
            anyFailures && 'bg-gradient-to-br from-red-600 to-red-700'
          )}
        >
          {isRunning ? (
            <Loader className="w-8 h-8 text-white animate-spin" />
          ) : allSuccess ? (
            <CheckCircle className="w-8 h-8 text-white" />
          ) : anyFailures ? (
            <XCircle className="w-8 h-8 text-white" />
          ) : (
            <RefreshCw className="w-8 h-8 text-white" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Subscription Sync Test</h2>
        <p className="text-muted-foreground">
          Verify that subscription data syncs from local database to cloud D1
        </p>
      </div>

      {/* Run Test Button */}
      {results.length === 0 && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={runSyncTest}
          disabled={isRunning}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-lg mb-6',
            'bg-gradient-to-br from-primary to-primary',
            'text-white shadow-lg shadow-primary/30',
            'hover:shadow-primary/50 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-3'
          )}
        >
          {isRunning ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Run Sync Test
            </>
          )}
        </motion.button>
      )}

      {/* Test Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Overall Status */}
          <div
            className={cn(
              'glass-panel p-4 rounded-lg border',
              allSuccess && 'border-green-500/30 bg-green-500/5',
              anyFailures && 'border-red-500/30 bg-red-500/5'
            )}
          >
            <div className="flex items-center gap-3">
              {allSuccess ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-green-400">All Tests Passed!</div>
                    <div className="text-sm text-foreground">
                      Subscription sync is working correctly
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-red-400">Some Tests Failed</div>
                    <div className="text-sm text-foreground">
                      Review the errors below and check console for details
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Individual Test Results */}
          <div className="space-y-3">
            {results.map((result, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-panel p-4 rounded-lg border border-border"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium text-foreground">
                        Step {index + 1}: {result.step}
                      </div>
                      {result.data && (
                        <button
                          onClick={() =>
                            setShowDetails((prev) => ({ ...prev, [index]: !prev[index] }))
                          }
                          className="text-xs text-primary hover:text-primary/80"
                        >
                          {showDetails[index] ? 'Hide' : 'Show'} Details
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{result.message}</div>

                    {/* Details */}
                    {showDetails[index] && result.data && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/30 overflow-x-auto">
                        <pre className="text-xs text-foreground">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setResults([]);
                setShowDetails({});
              }}
              className="flex-1 px-4 py-2 rounded-lg glass-panel hover:bg-muted text-foreground"
            >
              Clear Results
            </button>
            <button
              onClick={runSyncTest}
              disabled={isRunning}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isRunning ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Run Again
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 glass-panel p-4 rounded-lg border border-blue-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <p className="font-semibold text-blue-400 mb-2">What This Test Does:</p>
            <ol className="space-y-1 list-decimal ml-4">
              <li>Checks if subscription data exists in local database</li>
              <li>Fetches local subscription plans from SQLite</li>
              <li>Tests connectivity to cloud API (restaurant.guanix.com)</li>
              <li>Syncs subscription plans to cloud D1 database</li>
              <li>Verifies data was successfully written to D1</li>
              <li>Tests cuisine types sync</li>
            </ol>
            <p className="mt-3 text-muted-foreground">
              ℹ️ Make sure you've imported the subscription menu before running this test.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
