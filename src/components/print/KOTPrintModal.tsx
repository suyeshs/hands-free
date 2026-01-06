/**
 * KOT Print Modal
 * In-app print preview and direct printing for Kitchen Order Tickets
 * Avoids browser print dialog by sending directly to configured printers
 */

import { useState, useEffect } from 'react';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { usePrinterStore } from '../../stores/printerStore';
import { printerDiscoveryService } from '../../lib/printerDiscoveryService';
import { generateKOTEscPos, generateKOTHTML } from './KOTPrint';
import { KitchenOrder } from '../../types/kds';
import { Printer, Check, X, AlertCircle } from 'lucide-react';

interface KOTPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: KitchenOrder;
  restaurantName?: string;
  stationFilter?: string;
  onPrintComplete?: (success: boolean) => void;
}

type PrintStatus = 'idle' | 'printing' | 'success' | 'error';

export function KOTPrintModal({
  isOpen,
  onClose,
  order,
  restaurantName = 'Restaurant',
  stationFilter,
  onPrintComplete,
}: KOTPrintModalProps) {
  const [printStatus, setPrintStatus] = useState<PrintStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { config } = usePrinterStore();

  // Filter items by station if specified
  const itemsToPrint = stationFilter
    ? order.items.filter((item) => item.station?.toLowerCase() === stationFilter.toLowerCase())
    : order.items;

  const printDate = new Date();
  const dateStr = printDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = printDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Reset status when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrintStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Get printer info for display
  const getPrinterInfo = () => {
    // Check KOT-specific printer first
    if (config.kotPrinterEnabled && config.kotPrinterType) {
      if (config.kotPrinterType === 'network' && config.kotNetworkPrinterUrl) {
        return { type: 'Network', name: config.kotNetworkPrinterUrl };
      }
      if (config.kotPrinterType === 'system' && config.kotSystemPrinterName) {
        return { type: 'System', name: config.kotSystemPrinterName };
      }
    }
    // Fall back to main printer
    if (config.printerType === 'network' && config.networkPrinterUrl) {
      return { type: 'Network', name: config.networkPrinterUrl };
    }
    if (config.printerType === 'system' && config.systemPrinterName) {
      return { type: 'System', name: config.systemPrinterName };
    }
    return { type: 'Browser', name: 'System Print Dialog' };
  };

  const printerInfo = getPrinterInfo();
  const hasDirectPrinter = printerInfo.type !== 'Browser';

  const handlePrint = async () => {
    setPrintStatus('printing');
    setErrorMessage('');

    try {
      // Generate ESC/POS content for thermal printers
      const escPosContent = generateKOTEscPos(order, restaurantName, stationFilter);

      let success = false;

      // Try KOT-specific printer first
      if (config.kotPrinterEnabled && config.kotPrinterType) {
        if (config.kotPrinterType === 'network' && config.kotNetworkPrinterUrl) {
          const [address, portStr] = config.kotNetworkPrinterUrl.replace(/^https?:\/\//, '').split(':');
          const port = parseInt(portStr) || 9100;
          success = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);
        } else if (config.kotPrinterType === 'system' && config.kotSystemPrinterName) {
          success = await printerDiscoveryService.printToSystemPrinter(
            config.kotSystemPrinterName,
            escPosContent,
            'text'
          );
        }
      }
      // Fall back to main printer
      else if (config.printerType === 'network' && config.networkPrinterUrl) {
        const [address, portStr] = config.networkPrinterUrl.replace(/^https?:\/\//, '').split(':');
        const port = parseInt(portStr) || 9100;
        success = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);
      } else if (config.printerType === 'system' && config.systemPrinterName) {
        success = await printerDiscoveryService.printToSystemPrinter(
          config.systemPrinterName,
          escPosContent,
          'text'
        );
      }
      // No direct printer - this shouldn't happen if hasDirectPrinter check is used
      else {
        throw new Error('No printer configured. Please configure a network or system printer in Settings.');
      }

      if (success) {
        setPrintStatus('success');
        onPrintComplete?.(true);
        // Auto-close after success
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error('Failed to send to printer');
      }
    } catch (error) {
      console.error('[KOTPrintModal] Print failed:', error);
      setPrintStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Print failed');
      onPrintComplete?.(false);
    }
  };

  const handleClose = () => {
    if (printStatus !== 'printing') {
      onClose();
    }
  };

  return (
    <IndustrialModal
      open={isOpen}
      onClose={handleClose}
      title="PRINT KOT"
      size="md"
    >
      <div className="space-y-4">
        {/* KOT Preview */}
        <div className="bg-white text-black font-mono text-xs p-4 rounded-lg max-h-[50vh] overflow-y-auto">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-gray-400 pb-2 mb-2">
            <div className="text-base font-bold">{restaurantName}</div>
            <div className="text-sm font-bold mt-1">KITCHEN ORDER TICKET</div>
            {stationFilter && (
              <div className="text-sm font-bold mt-1 uppercase">{stationFilter} STATION</div>
            )}
          </div>

          {/* Order Info */}
          <div className="mb-2 space-y-1">
            <div className="flex justify-between font-bold text-sm">
              <span>Order #:</span>
              <span>{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="capitalize">{order.orderType}</span>
            </div>
            {order.tableNumber && (
              <div className="flex justify-between font-bold">
                <span>Table:</span>
                <span>{order.tableNumber}</span>
              </div>
            )}
            {order.source && (
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="uppercase">{order.source}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>{dateStr}</span>
              <span>{timeStr}</span>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t-2 border-dashed border-gray-400 my-2" />

          {/* Items */}
          <div className="space-y-2">
            {itemsToPrint.map((item) => (
              <div key={item.id} className="border-b border-gray-200 pb-2 last:border-b-0">
                <div className="font-bold text-sm">
                  {item.quantity}x {item.name}
                </div>
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="ml-4 text-[10px] text-gray-600">
                    {item.modifiers.map((mod, i) => (
                      <div key={i}>+ {mod.name}: {mod.value}</div>
                    ))}
                  </div>
                )}
                {item.specialInstructions && (
                  <div className="ml-4 text-[10px] font-bold text-red-600">
                    *** {item.specialInstructions} ***
                  </div>
                )}
                {!stationFilter && item.station && (
                  <div className="ml-4 text-[10px] text-gray-500 uppercase">
                    [{item.station}]
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t-2 border-dashed border-gray-400 mt-2 pt-2 text-center">
            <div className="text-[10px]">
              Total Items: {itemsToPrint.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          </div>
        </div>

        {/* Printer Info */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
          hasDirectPrinter
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <Printer size={20} className={hasDirectPrinter ? 'text-emerald-400' : 'text-amber-400'} />
          <div className="flex-1">
            <div className="text-xs text-slate-400 uppercase">Printer</div>
            <div className="text-sm font-bold">{printerInfo.type}: {printerInfo.name}</div>
          </div>
          {!hasDirectPrinter && (
            <div className="text-xs text-amber-400">
              Configure printer in Settings for direct printing
            </div>
          )}
        </div>

        {/* Status Message */}
        {printStatus === 'success' && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
            <Check size={20} className="text-emerald-400" />
            <span className="text-emerald-400 font-bold">KOT sent to printer!</span>
          </div>
        )}

        {printStatus === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <AlertCircle size={20} className="text-red-400" />
            <span className="text-red-400">{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <IndustrialButton
            variant="secondary"
            onClick={handleClose}
            disabled={printStatus === 'printing'}
            className="flex-1"
          >
            {printStatus === 'success' ? 'CLOSE' : 'CANCEL'}
          </IndustrialButton>

          {hasDirectPrinter ? (
            <IndustrialButton
              variant="success"
              onClick={handlePrint}
              disabled={printStatus === 'printing' || printStatus === 'success'}
              className="flex-1"
            >
              {printStatus === 'printing' ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  PRINTING...
                </>
              ) : printStatus === 'success' ? (
                <>
                  <Check size={16} className="mr-2" />
                  PRINTED
                </>
              ) : (
                <>
                  <Printer size={16} className="mr-2" />
                  PRINT KOT
                </>
              )}
            </IndustrialButton>
          ) : (
            <IndustrialButton
              variant="warning"
              onClick={() => {
                // For browser print, open in new window
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(generateKOTHTML(order, restaurantName, stationFilter));
                  printWindow.document.close();
                }
                onClose();
              }}
              className="flex-1"
            >
              <X size={16} className="mr-2" />
              BROWSER PRINT
            </IndustrialButton>
          )}
        </div>
      </div>
    </IndustrialModal>
  );
}

export default KOTPrintModal;
