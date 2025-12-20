/**
 * Printer Settings Component
 * Manage printer configuration with auto-discovery
 */

import { useState, useEffect } from 'react';
import { usePrinterStore } from '../../stores/printerStore';
import { printerDiscoveryService, DiscoveredPrinter, PrinterScanProgress } from '../../lib/printerDiscoveryService';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';

interface PrinterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrinterSettings({ isOpen, onClose }: PrinterSettingsProps) {
  const { config, updateConfig } = usePrinterStore();

  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<PrinterScanProgress | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<DiscoveredPrinter | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

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
    if (isOpen) {
      // Quick scan on open
      handleQuickScan();
    }
  }, [isOpen]);

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

  const handleSave = () => {
    const updates: Parameters<typeof updateConfig>[0] = {
      printerType: printerType as 'browser' | 'thermal' | 'network' | 'system',
    };

    // Bill printer settings
    if (printerType === 'network') {
      updates.networkPrinterUrl = networkUrl.includes(':') ? networkUrl : `${networkUrl}:9100`;
    }
    if (printerType === 'system') {
      updates.systemPrinterName = selectedSystemPrinter;
    }

    // KOT printer settings
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
    onClose();
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
        return 'text-green-500';
      case 'offline':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  return (
    <IndustrialModal
      open={isOpen}
      onClose={onClose}
      title="PRINTER SETTINGS"
      size="lg"
    >
      <div className="space-y-6">
        {/* Discovery Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-wider">Find Printers</h3>
            <div className="flex gap-2">
              <IndustrialButton
                variant="secondary"
                size="sm"
                onClick={handleQuickScan}
                disabled={isScanning}
              >
                {isScanning ? 'SCANNING...' : 'QUICK SCAN'}
              </IndustrialButton>
              <IndustrialButton
                variant="primary"
                size="sm"
                onClick={handleFullScan}
                disabled={isScanning}
              >
                FULL NETWORK SCAN
              </IndustrialButton>
            </div>
          </div>

          {/* Scan Progress */}
          {scanProgress && isScanning && (
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="uppercase font-bold text-muted-foreground">
                  {scanProgress.phase === 'system' && 'Checking system printers...'}
                  {scanProgress.phase === 'network' && 'Scanning network...'}
                  {scanProgress.phase === 'done' && 'Scan complete'}
                </span>
                <span className="font-mono">{scanProgress.progress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
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
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {discoveredPrinters.map((printer) => (
                <div
                  key={printer.id}
                  onClick={() => handleSelectPrinter(printer)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedPrinter?.id === printer.id
                      ? 'bg-accent/20 border-accent'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getPrinterIcon(printer.connection_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{printer.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="uppercase">{printer.connection_type}</span>
                        {printer.address && (
                          <>
                            <span>•</span>
                            <span className="font-mono">
                              {printer.address}
                              {printer.port ? `:${printer.port}` : ''}
                            </span>
                          </>
                        )}
                        {printer.model && (
                          <>
                            <span>•</span>
                            <span>{printer.model}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase ${getStatusColor(printer.status)}`}>
                        {printer.status}
                      </span>
                      {printer.is_default && (
                        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                          DEFAULT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {discoveredPrinters.length === 0 && !isScanning && (
            <div className="text-center py-8 text-muted-foreground">
              <span className="text-4xl block mb-2">🖨️</span>
              <p className="text-sm">No printers found. Click scan to search.</p>
            </div>
          )}
        </div>

        {/* Test Selected Printer */}
        {selectedPrinter && (
          <div className="bg-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">Selected: {selectedPrinter.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedPrinter.address}
                  {selectedPrinter.port ? `:${selectedPrinter.port}` : ''}
                </div>
              </div>
              <IndustrialButton
                variant="secondary"
                size="sm"
                onClick={handleTestPrinter}
                disabled={isTesting}
              >
                {isTesting ? 'TESTING...' : 'PRINT TEST PAGE'}
              </IndustrialButton>
            </div>

            {testResult && (
              <div
                className={`p-2 rounded text-sm ${
                  testResult.success
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {testResult.success ? '✓' : '✕'} {testResult.message}
              </div>
            )}
          </div>
        )}

        {/* Manual Configuration */}
        <div className="space-y-4 border-t border-white/10 pt-4">
          <h3 className="font-bold text-sm uppercase tracking-wider">Manual Configuration</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                Printer Type
              </label>
              <select
                value={printerType}
                onChange={(e) => setPrinterType(e.target.value as typeof printerType)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                <option value="browser">Browser Print Dialog</option>
                <option value="system">System Printer</option>
                <option value="network">Network Thermal Printer (ESC/POS)</option>
              </select>
            </div>

            {printerType === 'network' && (
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                  Printer Address (IP:Port)
                </label>
                <input
                  type="text"
                  value={networkUrl}
                  onChange={(e) => setNetworkUrl(e.target.value)}
                  placeholder="192.168.1.100:9100"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Common ports: 9100 (RAW), 515 (LPD), 631 (IPP)
                </p>
              </div>
            )}

            {printerType === 'system' && discoveredPrinters.filter((p) => p.connection_type === 'system').length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                  System Printer
                </label>
                <select
                  value={selectedSystemPrinter}
                  onChange={(e) => setSelectedSystemPrinter(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select a printer...</option>
                  {discoveredPrinters
                    .filter((p) => p.connection_type === 'system')
                    .map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} {p.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* KOT Printer Configuration */}
        <div className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-wider">KOT Printer</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={kotPrinterEnabled}
                onChange={(e) => setKotPrinterEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent focus:ring-accent"
              />
              <span className="text-xs text-muted-foreground">Use separate printer</span>
            </label>
          </div>

          {kotPrinterEnabled ? (
            <div className="space-y-3 bg-white/5 p-4 rounded-lg">
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                  KOT Printer Type
                </label>
                <select
                  value={kotPrinterType}
                  onChange={(e) => setKotPrinterType(e.target.value as typeof kotPrinterType)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="browser">Browser Print Dialog</option>
                  <option value="system">System Printer</option>
                  <option value="network">Network Thermal Printer (ESC/POS)</option>
                </select>
              </div>

              {kotPrinterType === 'network' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                    KOT Printer Address (IP:Port)
                  </label>
                  <input
                    type="text"
                    value={kotNetworkUrl}
                    onChange={(e) => setKotNetworkUrl(e.target.value)}
                    placeholder="192.168.1.100:9100"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none font-mono"
                  />
                </div>
              )}

              {kotPrinterType === 'system' && discoveredPrinters.filter((p) => p.connection_type === 'system').length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                    KOT System Printer
                  </label>
                  <select
                    value={kotSystemPrinter}
                    onChange={(e) => setKotSystemPrinter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="">Select a printer...</option>
                    {discoveredPrinters
                      .filter((p) => p.connection_type === 'system')
                      .map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} {p.is_default ? '(Default)' : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-white/5 p-3 rounded-lg">
              KOT will be printed to the same printer as bills (configured above)
            </div>
          )}
        </div>

        {/* Print Settings */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <h3 className="font-bold text-sm uppercase tracking-wider">Print Settings</h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoPrintOnAccept}
              onChange={(e) => updateConfig({ autoPrintOnAccept: e.target.checked })}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-accent focus:ring-accent"
            />
            <div>
              <div className="font-bold text-sm">Auto-print KOT on Accept</div>
              <div className="text-xs text-muted-foreground">
                Automatically print Kitchen Order Ticket when order is accepted
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.printByStation}
              onChange={(e) => updateConfig({ printByStation: e.target.checked })}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-accent focus:ring-accent"
            />
            <div>
              <div className="font-bold text-sm">Print by Station</div>
              <div className="text-xs text-muted-foreground">
                Print separate tickets for each kitchen station
              </div>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <IndustrialButton variant="secondary" onClick={onClose}>
            CANCEL
          </IndustrialButton>
          <IndustrialButton variant="success" onClick={handleSave}>
            SAVE SETTINGS
          </IndustrialButton>
        </div>
      </div>
    </IndustrialModal>
  );
}
