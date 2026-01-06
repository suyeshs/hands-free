/**
 * Printer Settings Inline Component
 * Same as PrinterSettings but without the modal wrapper - for use in full-page views
 */

import { useState, useEffect } from 'react';
import { usePrinterStore } from '../../stores/printerStore';
import { printerDiscoveryService, DiscoveredPrinter, PrinterScanProgress } from '../../lib/printerDiscoveryService';
import { cn } from '../../lib/utils';

export function PrinterSettingsInline() {
  const { config, updateConfig } = usePrinterStore();

  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<PrinterScanProgress | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<DiscoveredPrinter | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state - Bill Printer
  const [printerType, setPrinterType] = useState<'browser' | 'thermal' | 'network' | 'system'>(
    config.printerType || 'browser'
  );
  const [networkUrl, setNetworkUrl] = useState(config.networkPrinterUrl || '');
  const [selectedSystemPrinter, setSelectedSystemPrinter] = useState(config.systemPrinterName || '');

  // Form state - KOT Printer
  const [kotPrinterEnabled, setKotPrinterEnabled] = useState(config.kotPrinterEnabled || false);
  const [kotPrinterType, setKotPrinterType] = useState<'browser' | 'thermal' | 'network' | 'system'>(
    config.kotPrinterType || 'browser'
  );
  const [kotNetworkUrl, setKotNetworkUrl] = useState(config.kotNetworkPrinterUrl || '');
  const [kotSystemPrinter, setKotSystemPrinter] = useState(config.kotSystemPrinterName || '');

  useEffect(() => {
    handleQuickScan();
  }, []);

  const handleQuickScan = async () => {
    setIsScanning(true);
    setScanProgress({ phase: 'system', progress: 0, foundCount: 0 });
    try {
      const printers = await printerDiscoveryService.quickScan();
      setDiscoveredPrinters(printers);
      setScanProgress({ phase: 'done', progress: 100, foundCount: printers.length });
    } catch (error) {
      console.error('Quick scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFullScan = async () => {
    setIsScanning(true);
    setDiscoveredPrinters([]);
    setScanProgress({ phase: 'system', progress: 0, foundCount: 0 });
    try {
      const printers = await printerDiscoveryService.discoverAll((progress) => {
        setScanProgress(progress);
      });
      setDiscoveredPrinters(printers);
    } catch (error) {
      console.error('Full scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectPrinter = (printer: DiscoveredPrinter) => {
    setSelectedPrinter(printer);
    setTestResult(null);

    if (printer.connection_type === 'network' && printer.address && printer.port) {
      setPrinterType('network');
      setNetworkUrl(`${printer.address}:${printer.port}`);
    } else if (printer.connection_type === 'system') {
      setPrinterType('system');
      setSelectedSystemPrinter(printer.name);
    }
  };

  const handleTestPrinter = async () => {
    if (!selectedPrinter) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const success = await printerDiscoveryService.printTestPage(selectedPrinter);
      setTestResult({
        success,
        message: success ? 'Test page sent successfully!' : 'Failed to send test page',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Parameters<typeof updateConfig>[0] = {
        printerType: printerType as 'browser' | 'thermal' | 'network' | 'system',
      };

      if (printerType === 'network') {
        updates.networkPrinterUrl = networkUrl.includes(':') ? networkUrl : `${networkUrl}:9100`;
      }
      if (printerType === 'system') {
        updates.systemPrinterName = selectedSystemPrinter;
      }

      updates.kotPrinterEnabled = kotPrinterEnabled;
      if (kotPrinterEnabled) {
        updates.kotPrinterType = kotPrinterType;
        if (kotPrinterType === 'network') {
          updates.kotNetworkPrinterUrl = kotNetworkUrl.includes(':') ? kotNetworkUrl : `${kotNetworkUrl}:9100`;
        }
        if (kotPrinterType === 'system') {
          updates.kotSystemPrinterName = kotSystemPrinter;
        }
      }

      updateConfig(updates);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      setIsSaving(false);
    }
  };

  const getPrinterIcon = (type: string): string => {
    switch (type) {
      case 'network':
      case 'wifi':
        return '📡';
      case 'usb':
        return '🔌';
      case 'system':
        return '🖨️';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online':
        return 'text-success';
      case 'offline':
        return 'text-destructive';
      default:
        return 'text-warning';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Discovery Section */}
          <div className="settings-section space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-lg">Find Printers</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleQuickScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 text-sm font-medium bg-surface-3 hover:bg-surface-2 text-foreground rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isScanning ? 'SCANNING...' : 'QUICK SCAN'}
                </button>
                <button
                  onClick={handleFullScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 text-sm font-medium bg-accent hover:opacity-90 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  FULL SCAN
                </button>
              </div>
            </div>

            {/* Scan Progress */}
            {scanProgress && isScanning && (
              <div className="bg-surface-2 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="uppercase font-bold text-muted-foreground">
                    {scanProgress.phase === 'system' && 'Checking system printers...'}
                    {scanProgress.phase === 'network' && 'Scanning network...'}
                    {scanProgress.phase === 'done' && 'Scan complete'}
                  </span>
                  <span className="font-mono text-foreground">{scanProgress.progress}%</span>
                </div>
                <div className="w-full bg-surface-3 rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress.progress}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Found {scanProgress.foundCount} printer(s)
                </div>
              </div>
            )}

            {/* Discovered Printers */}
            {discoveredPrinters.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {discoveredPrinters.map((printer) => (
                  <div
                    key={printer.id}
                    onClick={() => handleSelectPrinter(printer)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                      selectedPrinter?.id === printer.id
                        ? 'bg-accent/20 border border-accent'
                        : 'bg-surface-2 hover:bg-surface-3'
                    )}
                  >
                    <span className="text-xl">{getPrinterIcon(printer.connection_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{printer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {printer.connection_type} {printer.address && `• ${printer.address}`}
                      </div>
                    </div>
                    <span className={cn('text-xs font-medium', getStatusColor(printer.status))}>
                      {printer.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Test Button */}
            {selectedPrinter && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestPrinter}
                  disabled={isTesting}
                  className="px-4 py-2 bg-success hover:opacity-90 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isTesting ? 'TESTING...' : 'TEST PRINT'}
                </button>
                {testResult && (
                  <span className={testResult.success ? 'text-success' : 'text-destructive'}>
                    {testResult.message}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bill Printer Settings */}
          <div className="settings-section space-y-4">
            <h3 className="font-bold text-foreground text-lg">Bill Printer</h3>

            <div>
              <label className="settings-label">Printer Type</label>
              <select
                value={printerType}
                onChange={(e) => setPrinterType(e.target.value as any)}
                className="settings-select"
              >
                <option value="browser">Browser Print Dialog</option>
                <option value="network">Network Printer (IP)</option>
                <option value="system">System Printer</option>
              </select>
            </div>

            {printerType === 'network' && (
              <div>
                <label className="settings-label">Network Address (IP:Port)</label>
                <input
                  type="text"
                  value={networkUrl}
                  onChange={(e) => setNetworkUrl(e.target.value)}
                  placeholder="192.168.1.100:9100"
                  className="settings-input"
                />
              </div>
            )}

            {printerType === 'system' && (
              <div>
                <label className="settings-label">System Printer Name</label>
                <input
                  type="text"
                  value={selectedSystemPrinter}
                  onChange={(e) => setSelectedSystemPrinter(e.target.value)}
                  placeholder="Printer name"
                  className="settings-input"
                />
              </div>
            )}
          </div>

          {/* KOT Printer Settings */}
          <div className="settings-section space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-lg">KOT (Kitchen) Printer</h3>
              <button
                onClick={() => setKotPrinterEnabled(!kotPrinterEnabled)}
                className={cn(
                  'relative w-14 h-8 rounded-full transition-colors',
                  kotPrinterEnabled ? 'bg-accent' : 'bg-surface-3'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform',
                    kotPrinterEnabled ? 'translate-x-7' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {kotPrinterEnabled && (
              <>
                <div>
                  <label className="settings-label">Printer Type</label>
                  <select
                    value={kotPrinterType}
                    onChange={(e) => setKotPrinterType(e.target.value as any)}
                    className="settings-select"
                  >
                    <option value="browser">Browser Print Dialog</option>
                    <option value="network">Network Printer (IP)</option>
                    <option value="system">System Printer</option>
                  </select>
                </div>

                {kotPrinterType === 'network' && (
                  <div>
                    <label className="settings-label">Network Address</label>
                    <input
                      type="text"
                      value={kotNetworkUrl}
                      onChange={(e) => setKotNetworkUrl(e.target.value)}
                      placeholder="192.168.1.101:9100"
                      className="settings-input"
                    />
                  </div>
                )}

                {kotPrinterType === 'system' && (
                  <div>
                    <label className="settings-label">System Printer Name</label>
                    <input
                      type="text"
                      value={kotSystemPrinter}
                      onChange={(e) => setKotSystemPrinter(e.target.value)}
                      placeholder="Kitchen printer name"
                      className="settings-input"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="settings-footer">
        <div className="max-w-2xl">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
