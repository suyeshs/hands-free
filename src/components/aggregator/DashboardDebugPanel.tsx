/**
 * DashboardDebugPanel Component
 * Debug UI for testing aggregator dashboard button selectors and interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { GlassModal } from '../ui-v2/GlassModal';
import { NeoButton } from '../ui-v2/NeoButton';
import { NeoCard } from '../ui-v2/NeoCard';
import { cn } from '../../lib/utils';

// Types for debug results
interface IdentifiedButton {
  type: string;
  selector: string;
  index: number;
  found: boolean;
  visible: boolean;
  text: string | null;
  orderId: string | null;
  rect: { x: number; y: number; width: number; height: number } | null;
  tagName: string;
  className: string;
}

interface TabInfo {
  type: string;
  name: string;
  selectorKey: string;
  selector: string;
  found: boolean;
  text: string | null;
  isActive: boolean;
}

interface ButtonIdentificationResult {
  platform: string;
  timestamp: number;
  buttons: {
    accept: IdentifiedButton[];
    reject: IdentifiedButton[];
    ready: IdentifiedButton[];
    tabs: TabInfo[];
  };
  summary: {
    totalFound: number;
    acceptCount: number;
    rejectCount: number;
    readyCount: number;
    tabCount: number;
  };
  selectorStatus: Record<string, { configured: boolean; selector: string | null; found: boolean }>;
}

interface PageState {
  platform: string;
  timestamp: number;
  currentUrl: string;
  activeTab: string | null;
  visibleOrders: number;
  detectedTabs: string[];
  orderIds: string[];
  buttonCounts: {
    accept: number;
    reject: number;
    ready: number;
  };
  pageReady: boolean;
  loginRequired: boolean;
}

interface ClickTestResult {
  success: boolean;
  buttonType: string;
  orderId: string | null;
  dryRun: boolean;
  message: string;
  timestamp: number;
  elementInfo: {
    tagName: string;
    text: string;
    className: string;
    visible: boolean;
    rect: { x: number; y: number; width: number; height: number };
  } | null;
}

interface SelectorVerificationResult {
  platform: string;
  timestamp: number;
  selectors: Record<string, {
    configured: string;
    found: boolean;
    matchedSelector: string | null;
    elementCount: number;
    status: 'ok' | 'missing';
  }>;
  summary: {
    total: number;
    found: number;
    missing: number;
  };
}

interface DebugResult {
  resultType: string;
  platform: string;
  data: ButtonIdentificationResult | PageState | ClickTestResult | SelectorVerificationResult;
  timestamp: number;
}

interface LogEntry {
  time: string;
  type: 'info' | 'action' | 'success' | 'error';
  message: string;
}

export interface DashboardDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DashboardDebugPanel({ isOpen, onClose }: DashboardDebugPanelProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<'swiggy' | 'zomato'>('swiggy');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results state
  const [buttonResults, setButtonResults] = useState<ButtonIdentificationResult | null>(null);
  const [pageState, setPageState] = useState<PageState | null>(null);
  const [clickResults, setClickResults] = useState<ClickTestResult[]>([]);
  const [selectorResults, setSelectorResults] = useState<SelectorVerificationResult | null>(null);

  // Console log
  const [consoleLog, setConsoleLog] = useState<LogEntry[]>([]);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString();
    setConsoleLog(prev => [...prev.slice(-50), { time, type, message }]);
  }, []);

  // Listen for debug results
  useEffect(() => {
    if (!isOpen) return;

    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      unlisten = await listen<DebugResult>('dashboard-debug-result', (event) => {
        const { resultType, platform, data } = event.payload;
        addLog('info', `Received ${resultType} from ${platform}`);

        switch (resultType) {
          case 'identifyButtons':
            setButtonResults(data as ButtonIdentificationResult);
            break;
          case 'pageState':
            setPageState(data as PageState);
            break;
          case 'testClick':
            setClickResults(prev => [...prev.slice(-10), data as ClickTestResult]);
            break;
          case 'verifySelectors':
            setSelectorResults(data as SelectorVerificationResult);
            break;
          case 'navigateToTab':
            addLog('success', `Tab navigation: ${JSON.stringify(data)}`);
            break;
        }
      });
    };

    setup();
    return () => { unlisten?.(); };
  }, [isOpen, addLog]);

  // Action handlers
  const handleIdentifyButtons = async () => {
    setIsLoading(true);
    setError(null);
    addLog('action', `Identifying buttons in ${selectedPlatform}...`);

    try {
      await invoke('identify_dashboard_buttons', { platform: selectedPlatform });
    } catch (err) {
      setError(err as string);
      addLog('error', `Failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPageState = async () => {
    setIsLoading(true);
    setError(null);
    addLog('action', `Getting page state from ${selectedPlatform}...`);

    try {
      await invoke('get_dashboard_page_state', { platform: selectedPlatform });
    } catch (err) {
      setError(err as string);
      addLog('error', `Failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestClick = async (buttonType: string, orderId?: string, dryRun = true) => {
    setIsLoading(true);
    setError(null);
    addLog('action', `Testing ${dryRun ? '(dry run)' : ''} click: ${buttonType} ${orderId ? `for order ${orderId}` : ''}`);

    try {
      await invoke('test_dashboard_click', {
        platform: selectedPlatform,
        buttonType,
        orderId: orderId || null,
        dryRun
      });
    } catch (err) {
      setError(err as string);
      addLog('error', `Failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateTab = async (tabName: string) => {
    setIsLoading(true);
    setError(null);
    addLog('action', `Navigating to ${tabName} tab...`);

    try {
      await invoke('navigate_dashboard_tab', { platform: selectedPlatform, tabName });
    } catch (err) {
      setError(err as string);
      addLog('error', `Failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySelectors = async () => {
    setIsLoading(true);
    setError(null);
    addLog('action', `Verifying selectors for ${selectedPlatform}...`);

    try {
      await invoke('verify_dashboard_selectors', { platform: selectedPlatform });
    } catch (err) {
      setError(err as string);
      addLog('error', `Failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setButtonResults(null);
    setPageState(null);
    setClickResults([]);
    setSelectorResults(null);
    setConsoleLog([]);
    setError(null);
  };

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title="Dashboard Debug Panel"
      size="xl"
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
        {/* Platform Selector */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Platform:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPlatform('swiggy')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-all',
                selectedPlatform === 'swiggy'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              )}
            >
              Swiggy
            </button>
            <button
              onClick={() => setSelectedPlatform('zomato')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-all',
                selectedPlatform === 'zomato'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              )}
            >
              Zomato
            </button>
          </div>
          <NeoButton variant="ghost" size="sm" onClick={clearResults}>
            Clear All
          </NeoButton>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <NeoCard className="p-4">
          <h3 className="font-semibold text-foreground mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <NeoButton
              onClick={handleIdentifyButtons}
              disabled={isLoading}
              variant="primary"
              size="sm"
            >
              {isLoading ? 'Loading...' : 'Identify Buttons'}
            </NeoButton>
            <NeoButton
              onClick={handleGetPageState}
              disabled={isLoading}
              size="sm"
            >
              Get Page State
            </NeoButton>
            <NeoButton
              onClick={handleVerifySelectors}
              disabled={isLoading}
              size="sm"
            >
              Verify Selectors
            </NeoButton>
          </div>
        </NeoCard>

        {/* Page State Display */}
        {pageState && (
          <NeoCard className="p-4">
            <h3 className="font-semibold text-foreground mb-3">Page State</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Active Tab:</div>
              <div className="text-foreground">{pageState.activeTab || 'Unknown'}</div>
              <div className="text-muted-foreground">Visible Orders:</div>
              <div className="text-foreground">{pageState.visibleOrders}</div>
              <div className="text-muted-foreground">Login Required:</div>
              <div className={pageState.loginRequired ? 'text-yellow-400' : 'text-emerald-400'}>
                {pageState.loginRequired ? 'Yes' : 'No'}
              </div>
              <div className="text-muted-foreground">Page Ready:</div>
              <div className={pageState.pageReady ? 'text-emerald-400' : 'text-yellow-400'}>
                {pageState.pageReady ? 'Yes' : 'No'}
              </div>
            </div>
            {pageState.orderIds.length > 0 && (
              <div className="mt-2">
                <div className="text-muted-foreground text-sm">Order IDs:</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {pageState.orderIds.slice(0, 10).join(', ')}
                  {pageState.orderIds.length > 10 && ` (+${pageState.orderIds.length - 10} more)`}
                </div>
              </div>
            )}
          </NeoCard>
        )}

        {/* Button Results */}
        {buttonResults && (
          <NeoCard className="p-4">
            <h3 className="font-semibold text-foreground mb-3">
              Detected Buttons
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Total: {buttonResults.summary.totalFound})
              </span>
            </h3>

            {/* Summary */}
            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                Accept: {buttonResults.summary.acceptCount}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                Reject: {buttonResults.summary.rejectCount}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Ready: {buttonResults.summary.readyCount}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                Tabs: {buttonResults.summary.tabCount}
              </div>
            </div>

            {/* Button Groups */}
            {(['accept', 'reject', 'ready'] as const).map(type => (
              <div key={type} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium capitalize text-foreground">{type} Buttons</h4>
                  <NeoButton
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTestClick(type, undefined, true)}
                    disabled={buttonResults.buttons[type].length === 0}
                  >
                    Test (Dry)
                  </NeoButton>
                </div>
                {buttonResults.buttons[type].length === 0 ? (
                  <div className="text-xs text-yellow-500 p-2 bg-yellow-900/20 rounded">
                    No {type} buttons found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {buttonResults.buttons[type].map((btn, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'text-xs p-2 rounded flex items-center justify-between',
                          btn.visible ? 'bg-emerald-900/20' : 'bg-zinc-800'
                        )}
                      >
                        <div>
                          <span className={btn.visible ? 'text-emerald-400' : 'text-zinc-500'}>
                            {btn.visible ? 'Visible' : 'Hidden'}
                          </span>
                          <span className="text-muted-foreground ml-2">{btn.text || btn.tagName}</span>
                          {btn.orderId && (
                            <span className="text-purple-400 ml-2">Order: {btn.orderId}</span>
                          )}
                        </div>
                        <NeoButton
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTestClick(type, btn.orderId || undefined, false)}
                          className="text-xs"
                        >
                          Click
                        </NeoButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Tabs */}
            <div className="mb-3">
              <h4 className="text-sm font-medium text-foreground mb-2">Tabs</h4>
              <div className="flex flex-wrap gap-2">
                {buttonResults.buttons.tabs.map((tab, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleNavigateTab(tab.name)}
                    className={cn(
                      'px-3 py-1 rounded text-xs transition-all',
                      tab.found
                        ? tab.isActive
                          ? 'bg-primary text-white'
                          : 'bg-zinc-700 text-foreground hover:bg-zinc-600'
                        : 'bg-red-900/30 text-red-400'
                    )}
                  >
                    {tab.name}
                    {!tab.found && ' (missing)'}
                  </button>
                ))}
              </div>
            </div>
          </NeoCard>
        )}

        {/* Selector Verification Results */}
        {selectorResults && (
          <NeoCard className="p-4">
            <h3 className="font-semibold text-foreground mb-3">
              Selector Verification
              <span className="text-sm font-normal ml-2">
                <span className="text-emerald-400">{selectorResults.summary.found} found</span>
                {' / '}
                <span className="text-red-400">{selectorResults.summary.missing} missing</span>
              </span>
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {Object.entries(selectorResults.selectors).map(([key, value]) => (
                <div
                  key={key}
                  className={cn(
                    'text-xs p-2 rounded flex items-center justify-between',
                    value.found ? 'bg-emerald-900/20' : 'bg-red-900/20'
                  )}
                >
                  <div>
                    <span className={value.found ? 'text-emerald-400' : 'text-red-400'}>
                      {value.found ? 'OK' : 'MISSING'}
                    </span>
                    <span className="text-foreground ml-2 font-medium">{key}</span>
                    {value.elementCount > 0 && (
                      <span className="text-muted-foreground ml-2">({value.elementCount} elements)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </NeoCard>
        )}

        {/* Click Test Results */}
        {clickResults.length > 0 && (
          <NeoCard className="p-4">
            <h3 className="font-semibold text-foreground mb-3">Click Test Results</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {clickResults.slice().reverse().map((result, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'text-xs p-2 rounded',
                    result.success ? 'bg-emerald-900/20' : 'bg-red-900/20'
                  )}
                >
                  <span className={result.success ? 'text-emerald-400' : 'text-red-400'}>
                    {result.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                  <span className="text-foreground ml-2">{result.buttonType}</span>
                  {result.dryRun && <span className="text-yellow-400 ml-2">(dry run)</span>}
                  <span className="text-muted-foreground ml-2">{result.message}</span>
                </div>
              ))}
            </div>
          </NeoCard>
        )}

        {/* Console Log */}
        <NeoCard className="p-4">
          <h3 className="font-semibold text-foreground mb-2">Console</h3>
          <div className="bg-zinc-900 rounded p-2 h-32 overflow-y-auto font-mono text-xs">
            {consoleLog.length === 0 ? (
              <div className="text-zinc-600">No logs yet...</div>
            ) : (
              consoleLog.map((log, idx) => (
                <div key={idx} className={cn(
                  log.type === 'error' && 'text-red-400',
                  log.type === 'success' && 'text-emerald-400',
                  log.type === 'action' && 'text-blue-400',
                  log.type === 'info' && 'text-zinc-400'
                )}>
                  <span className="text-zinc-600">[{log.time}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </NeoCard>

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <NeoButton variant="primary" onClick={onClose}>
            Close
          </NeoButton>
        </div>
      </div>
    </GlassModal>
  );
}
