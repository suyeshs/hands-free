/**
 * Delivery Verification Component
 * Scan barcodes to verify delivered items match the purchase order/invoice
 * Optional feature - must be enabled in settings
 */

import { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { useDeliveryVerificationStore } from '../../stores/deliveryVerificationStore';
import {
  ExpectedDeliveryItem,
  DeliveryItemVerification,
  ScannedDeliveryItem,
  BarcodeMapping,
  InventoryItem,
} from '../../types/inventory';
import { isMobileDevice } from '../../lib/nativeDocumentScanner';

interface DeliveryVerificationProps {
  expectedItems: ExpectedDeliveryItem[];
  tenantId: string;
  supplierInfo?: {
    id?: string;
    name?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
  };
  existingInventoryItems?: InventoryItem[];
  onComplete?: (session: ReturnType<typeof useDeliveryVerificationStore.getState>['currentSession']) => void;
  onCancel?: () => void;
}

export function DeliveryVerification({
  expectedItems,
  tenantId,
  supplierInfo,
  existingInventoryItems = [],
  onComplete,
  onCancel,
}: DeliveryVerificationProps) {
  const {
    currentSession,
    startVerificationSession,
    scanBarcode,
    updateScannedQuantity,
    removeScannedItem,
    completeVerification,
    cancelVerification,
    addBarcodeMapping,
    getBarcodeMapping,
  } = useDeliveryVerificationStore();

  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [unmappedBarcode, setUnmappedBarcode] = useState<string | null>(null);
  const [selectedItemForMapping, setSelectedItemForMapping] = useState<string>('');

  // Start session on mount
  useEffect(() => {
    if (!currentSession && expectedItems.length > 0) {
      startVerificationSession(tenantId, expectedItems, supplierInfo);
    }
  }, []);

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setLastScanResult(null);

    try {
      const { scan, Format } = await import('@tauri-apps/plugin-barcode-scanner');

      const result = await scan({
        formats: [
          Format.EAN13,
          Format.EAN8,
          Format.UPC_A,
          Format.UPC_E,
          Format.Code128,
          Format.Code39,
          Format.QRCode,
          Format.DataMatrix,
        ],
        windowed: false,
      });

      if (result?.content) {
        const barcode = result.content;
        setLastScanResult(barcode);

        // Check if barcode is mapped
        const mapping = getBarcodeMapping(barcode);

        if (!mapping) {
          // Check if barcode matches any expected item directly
          const directMatch = expectedItems.find(e => e.barcode === barcode);

          if (!directMatch) {
            // Show mapping modal
            setUnmappedBarcode(barcode);
            setShowMappingModal(true);
            return;
          }
        }

        // Scan the barcode
        scanBarcode(barcode, result.format || 'unknown', 1);
      }
    } catch (err) {
      console.error('Barcode scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, scanBarcode, getBarcodeMapping, expectedItems]);

  // Manual barcode entry
  const [manualBarcode, setManualBarcode] = useState('');
  const handleManualEntry = () => {
    if (!manualBarcode.trim()) return;

    const mapping = getBarcodeMapping(manualBarcode);
    if (!mapping) {
      const directMatch = expectedItems.find(e => e.barcode === manualBarcode);
      if (!directMatch) {
        setUnmappedBarcode(manualBarcode);
        setShowMappingModal(true);
        setManualBarcode('');
        return;
      }
    }

    scanBarcode(manualBarcode, 'manual', 1);
    setManualBarcode('');
  };

  // Handle barcode mapping
  const handleSaveMapping = () => {
    if (!unmappedBarcode || !selectedItemForMapping) return;

    const item = existingInventoryItems.find(i => i.id === selectedItemForMapping);
    if (item) {
      const mapping: BarcodeMapping = {
        barcode: unmappedBarcode,
        inventoryItemId: item.id,
        itemName: item.name,
        defaultUnit: item.unit,
        defaultPrice: item.pricePerUnit,
      };
      addBarcodeMapping(mapping);

      // Now scan the barcode
      scanBarcode(unmappedBarcode, 'mapped', 1);
    }

    setShowMappingModal(false);
    setUnmappedBarcode(null);
    setSelectedItemForMapping('');
  };

  // Handle completion
  const handleComplete = () => {
    const session = completeVerification();
    onComplete?.(session);
  };

  // Handle cancel
  const handleCancel = () => {
    cancelVerification();
    onCancel?.();
  };

  if (!currentSession) {
    return (
      <div className="p-4 text-center text-slate-400">
        <p>No verification session active</p>
      </div>
    );
  }

  const { verificationResults, scannedItems, matchedCount, missingCount, extraCount, mismatchCount } = currentSession;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">Delivery Verification</h3>
          {supplierInfo?.invoiceNumber && (
            <span className="text-sm text-slate-400">Invoice: {supplierInfo.invoiceNumber}</span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-green-500/20 rounded-lg p-2">
            <div className="text-2xl font-bold text-green-400">{matchedCount}</div>
            <div className="text-xs text-green-300">Matched</div>
          </div>
          <div className="bg-red-500/20 rounded-lg p-2">
            <div className="text-2xl font-bold text-red-400">{missingCount}</div>
            <div className="text-xs text-red-300">Missing</div>
          </div>
          <div className="bg-yellow-500/20 rounded-lg p-2">
            <div className="text-2xl font-bold text-yellow-400">{mismatchCount}</div>
            <div className="text-xs text-yellow-300">Qty Diff</div>
          </div>
          <div className="bg-orange-500/20 rounded-lg p-2">
            <div className="text-2xl font-bold text-orange-400">{extraCount}</div>
            <div className="text-xs text-orange-300">Extra</div>
          </div>
        </div>
      </div>

      {/* Scan Button */}
      {isMobileDevice() && (
        <button
          onClick={handleBarcodeScan}
          disabled={isScanning}
          className={cn(
            'w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors',
            isScanning
              ? 'bg-slate-600 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-500'
          )}
        >
          {isScanning ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <span className="text-2xl">📦</span>
              Scan Product Barcode
            </>
          )}
        </button>
      )}

      {/* Manual Entry */}
      <div className="flex gap-2">
        <input
          type="text"
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
          placeholder="Enter barcode manually..."
          className="flex-1 bg-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleManualEntry}
          disabled={!manualBarcode.trim()}
          className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </div>

      {/* Last scan result */}
      {lastScanResult && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-sm">
          Last scanned: <span className="font-mono font-bold">{lastScanResult}</span>
        </div>
      )}

      {/* Verification Results */}
      <div className="space-y-2">
        <h4 className="font-bold text-sm text-slate-400">Verification Status</h4>

        {verificationResults.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <p className="text-4xl mb-2">📦</p>
            <p>Scan barcodes to verify delivery</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {verificationResults.map((result, index) => (
              <VerificationResultRow
                key={`${result.expectedItemId || result.scannedItemId}-${index}`}
                result={result}
                scannedItems={scannedItems}
                onUpdateQuantity={updateScannedQuantity}
                onRemove={removeScannedItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-slate-700">
        <button
          onClick={handleCancel}
          className="flex-1 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleComplete}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
        >
          Complete Verification
        </button>
      </div>

      {/* Barcode Mapping Modal */}
      {showMappingModal && unmappedBarcode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Map Barcode to Item</h3>

            <div className="bg-slate-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-slate-400">Barcode:</p>
              <p className="font-mono text-lg">{unmappedBarcode}</p>
            </div>

            <p className="text-sm text-slate-400 mb-2">Select inventory item:</p>
            <select
              value={selectedItemForMapping}
              onChange={(e) => setSelectedItemForMapping(e.target.value)}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select item --</option>
              {existingInventoryItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMappingModal(false);
                  setUnmappedBarcode(null);
                }}
                className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={!selectedItemForMapping}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual result row
function VerificationResultRow({
  result,
  scannedItems,
  onUpdateQuantity,
  onRemove,
}: {
  result: DeliveryItemVerification;
  scannedItems: ScannedDeliveryItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const statusConfig = {
    matched: { bg: 'bg-green-500/20', border: 'border-green-500/30', icon: '✓', color: 'text-green-400' },
    missing: { bg: 'bg-red-500/20', border: 'border-red-500/30', icon: '✗', color: 'text-red-400' },
    extra: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', icon: '+', color: 'text-orange-400' },
    quantity_mismatch: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', icon: '≠', color: 'text-yellow-400' },
    pending: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', icon: '?', color: 'text-slate-400' },
  };

  const config = statusConfig[result.status];
  const scannedItem = scannedItems.find(s => s.id === result.scannedItemId);

  return (
    <div className={cn('rounded-lg p-3 border', config.bg, config.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-lg font-bold', config.color)}>{config.icon}</span>
            <span className="font-medium">{result.name}</span>
          </div>
          {result.barcode && (
            <p className="text-xs text-slate-500 font-mono mt-1">{result.barcode}</p>
          )}
        </div>

        <div className="text-right">
          <div className="text-sm">
            <span className={config.color}>{result.receivedQuantity}</span>
            <span className="text-slate-500"> / </span>
            <span>{result.expectedQuantity}</span>
          </div>
          {result.quantityDifference !== 0 && (
            <div className={cn('text-xs', result.quantityDifference > 0 ? 'text-orange-400' : 'text-red-400')}>
              {result.quantityDifference > 0 ? '+' : ''}{result.quantityDifference}
            </div>
          )}
        </div>
      </div>

      {/* Edit quantity for scanned items */}
      {scannedItem && result.status !== 'missing' && (
        <div className="mt-2 flex items-center gap-2 pt-2 border-t border-slate-600/50">
          <button
            onClick={() => onUpdateQuantity(scannedItem.id, Math.max(0, scannedItem.quantity - 1))}
            className="w-8 h-8 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold"
          >
            -
          </button>
          <span className="w-12 text-center font-mono">{scannedItem.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(scannedItem.id, scannedItem.quantity + 1)}
            className="w-8 h-8 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold"
          >
            +
          </button>
          <button
            onClick={() => onRemove(scannedItem.id)}
            className="ml-auto text-red-400 hover:text-red-300 text-sm"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
