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
        return 'text-green-400';
      case 'offline':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Discovery Section */}
          <div className="bg-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Find Printers</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleQuickScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 text-sm font-medium bg-slate-700 hover:bg-slate-600 rounded-lg disabled:opacity-50"
                >
                  {isScanning ? 'SCANNING...' : 'QUICK SCAN'}
                </button>
                <button
                  onClick={handleFullScan}
                  disabled={isScanning}
                  className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50"
                >
                  FULL SCAN
                </button>
              </div>
            </div>

            {/* Scan Progress */}
            {scanProgress && isScanning && (
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="uppercase font-bold text-slate-400">
                    {scanProgress.phase === 'system' && 'Checking system printers...'}
                    {scanProgress.phase === 'network' && 'Scanning network...'}
                    {scanProgress.phase === 'done' && 'Scan complete'}
                  </span>
                  <span className="font-mono text-white">{scanProgress.progress}%</span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress.progress}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
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
                        ? 'bg-blue-600/20 border border-blue-500'
                        : 'bg-slate-700 hover:bg-slate-600'
                    )}
                  >
                    <span className="text-xl">{getPrinterIcon(printer.connection_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{printer.name}</div>
                      <div className="text-xs text-slate-400">
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
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {isTesting ? 'TESTING...' : 'TEST PRINT'}
                </button>
                {testResult && (
                  <span className={testResult.success ? 'text-green-400' : 'text-red-400'}>
                    {testResult.message}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bill Printer Settings */}
          <div className="bg-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="font-bold text-white">Bill Printer</h3>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Printer Type</label>
              <select
                value={printerType}
                onChange={(e) => setPrinterType(e.target.value as any)}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white"
              >
                <option value="browser">Browser Print Dialog</option>
                <option value="network">Network Printer (IP)</option>
                <option value="system">System Printer</option>
              </select>
            </div>

            {printerType === 'network' && (
              <div>
                <label className="block text-sm text-slate-400 mb-2">Network Address (IP:Port)</label>
                <input
                  type="text"
                  value={networkUrl}
                  onChange={(e) => setNetworkUrl(e.target.value)}
                  placeholder="192.168.1.100:9100"
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
            )}

            {printerType === 'system' && (
              <div>
                <label className="block text-sm text-slate-400 mb-2">System Printer Name</label>
                <input
                  type="text"
                  value={selectedSystemPrinter}
                  onChange={(e) => setSelectedSystemPrinter(e.target.value)}
                  placeholder="Printer name"
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
            )}
          </div>

          {/* KOT Printer Settings */}
          <div className="bg-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">KOT (Kitchen) Printer</h3>
              <button
                onClick={() => setKotPrinterEnabled(!kotPrinterEnabled)}
                className={cn(
                  'relative w-14 h-7 rounded-full transition-colors',
                  kotPrinterEnabled ? 'bg-blue-600' : 'bg-slate-600'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                    kotPrinterEnabled ? 'translate-x-8' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {kotPrinterEnabled && (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Printer Type</label>
                  <select
                    value={kotPrinterType}
                    onChange={(e) => setKotPrinterType(e.target.value as any)}
                    className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white"
                  >
                    <option value="browser">Browser Print Dialog</option>
                    <option value="network">Network Printer (IP)</option>
                    <option value="system">System Printer</option>
                  </select>
                </div>

                {kotPrinterType === 'network' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Network Address</label>
                    <input
                      type="text"
                      value={kotNetworkUrl}
                      onChange={(e) => setKotNetworkUrl(e.target.value)}
                      placeholder="192.168.1.101:9100"
                      className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white"
                    />
                  </div>
                )}

                {kotPrinterType === 'system' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">System Printer Name</label>
                    <input
                      type="text"
                      value={kotSystemPrinter}
                      onChange={(e) => setKotSystemPrinter(e.target.value)}
                      placeholder="Kitchen printer name"
                      className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-slate-700 bg-slate-800 px-6 py-4">
        <div className="max-w-2xl">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
