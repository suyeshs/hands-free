/**
 * Bill Preview Modal
 * Shows generated bill on screen with options to print/download PDF
 * Records sales transaction with selected payment method
 */

import { useState } from 'react';
import { BillData, generateBillPDF, generateBillHTML, generateBillEscPos } from '../print/BillPrint';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { usePrinterStore } from '../../stores/printerStore';
import { printerDiscoveryService } from '../../lib/printerDiscoveryService';
import { hasTauriAPI } from '../../lib/platform';

interface BillPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  billData: BillData | null;
  invoiceNumber: string;
  onBillPrinted?: (invoiceNumber: string) => void;  // Called when bill is printed (to mark table as billed)
}

export function BillPreviewModal({
  isOpen,
  onClose,
  billData,
  invoiceNumber,
  onBillPrinted,
}: BillPreviewModalProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; message: string } | null>(null);
  const [billPrintedCalled, setBillPrintedCalled] = useState(false);
  const { config } = usePrinterStore();

  if (!billData) return null;

  const { order, restaurantSettings: settings, taxes, printedAt, cashierName } = billData;
  const is80mm = settings.paperWidth === '80mm';

  // Format helpers
  const formatCurrency = (amount: number) => `Rs. ${amount.toFixed(2)}`;
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const doc = await generateBillPDF(billData);
      const filename = `Bill_${invoiceNumber}_${formatDate(printedAt).replace(/\//g, '-')}.pdf`;
      doc.save(filename);
      // PDF download is just for preview - don't mark as printed
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleOpenPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const doc = await generateBillPDF(billData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Create an anchor and trigger download for both Tauri and Web
      // (window.open doesn't work reliably in Tauri)
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      // For Tauri, download the file; for web, try to open in new tab
      if (hasTauriAPI()) {
        // In Tauri: download the PDF
        const filename = `Bill_${invoiceNumber}_${formatDate(printedAt).replace(/\//g, '-')}.pdf`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // In web: try window.open first, fallback to anchor click
        const newWindow = window.open(pdfUrl, '_blank');
        if (!newWindow) {
          // Popup blocked, fallback to anchor
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }

      URL.revokeObjectURL(pdfUrl);
      // PDF open is just for preview - don't mark as printed
    } catch (error) {
      console.error('Failed to open PDF:', error);
      alert('Failed to open PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrintToPrinter = async () => {
    setIsPrinting(true);
    setPrintResult(null);

    try {
      const html = generateBillHTML(billData);
      let printSuccess = false;

      if (config.printerType === 'network' && config.networkPrinterUrl) {
        // Direct network print using proper ESC/POS formatting
        const [address, portStr] = config.networkPrinterUrl.replace(/^https?:\/\//, '').split(':');
        const port = parseInt(portStr) || 9100;
        // Use the new generateBillEscPos for proper TM-T82 formatting with correct width and darker print
        const escPosContent = generateBillEscPos(billData);
        printSuccess = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);
        setPrintResult({
          success: printSuccess,
          message: printSuccess ? 'Bill sent to printer!' : 'Failed to send to printer',
        });
      } else if (config.printerType === 'system' && config.systemPrinterName) {
        // System printer - use ESC/POS for thermal printers (most common via CUPS)
        const escPosContent = generateBillEscPos(billData);
        printSuccess = await printerDiscoveryService.printToSystemPrinter(
          config.systemPrinterName,
          escPosContent,
          'raw' // Send as raw data for thermal printers
        );
        setPrintResult({
          success: printSuccess,
          message: printSuccess ? 'Bill sent to printer!' : 'Failed to send to printer',
        });
      } else {
        // Use native Tauri print or fallback to iframe
        printSuccess = await printerDiscoveryService.printHtmlContent(html);
        setPrintResult({
          success: printSuccess,
          message: printSuccess ? 'Print dialog opened' : 'Failed to open print dialog',
        });
      }

      // Mark table as bill printed (for dine-in orders)
      console.log('[BillPreviewModal] Print result:', { printSuccess, billPrintedCalled, hasCallback: !!onBillPrinted, invoiceNumber });
      if (printSuccess && !billPrintedCalled && onBillPrinted) {
        console.log('[BillPreviewModal] Calling onBillPrinted with invoice:', invoiceNumber);
        onBillPrinted(invoiceNumber);
        setBillPrintedCalled(true);
        console.log('[BillPreviewModal] Bill printed callback completed');
      } else if (!printSuccess) {
        console.warn('[BillPreviewModal] Print was not successful, not marking as billed');
      }
    } catch (error) {
      console.error('Failed to print:', error);
      setPrintResult({
        success: false,
        message: error instanceof Error ? error.message : 'Print failed',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const getPrinterLabel = (): string => {
    switch (config.printerType) {
      case 'network':
        return config.networkPrinterUrl ? `Network: ${config.networkPrinterUrl}` : 'Network Printer';
      case 'system':
        return config.systemPrinterName || 'System Printer';
      default:
        return 'Browser Print';
    }
  };

  const handleClose = () => {
    // Reset state
    setPrintResult(null);
    setBillPrintedCalled(false);
    onClose();
  };

  return (
    <IndustrialModal
      open={isOpen}
      onClose={onClose}
      title="BILL GENERATED"
      size="lg"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Bill Preview */}
        <div className="flex-1 flex justify-center">
          <div
            className="bg-white text-black font-mono text-xs overflow-auto max-h-[60vh] shadow-lg border"
            style={{ width: is80mm ? '320px' : '240px', minHeight: '400px' }}
          >
            {/* Receipt Content */}
            <div className="p-4">
              {/* Header */}
              <div className="text-center mb-3">
                <div className="font-bold text-base">{settings.name}</div>
                {settings.tagline && (
                  <div className="text-[10px] italic text-gray-600">{settings.tagline}</div>
                )}
                <div className="text-[10px] text-gray-600">
                  {settings.address.line1 && <div>{settings.address.line1}</div>}
                  {settings.address.line2 && <div>{settings.address.line2}</div>}
                  <div>
                    {settings.address.city}, {settings.address.state} - {settings.address.pincode}
                  </div>
                </div>
                {settings.phone && (
                  <div className="text-[10px] text-gray-600">Ph: {settings.phone}</div>
                )}
              </div>

              {/* Tax Invoice Title */}
              <div className="text-center font-bold border-t border-b border-dashed border-gray-400 py-1 my-2">
                TAX INVOICE
              </div>

              {/* Legal Info */}
              {(settings.gstNumber || settings.fssaiNumber) && (
                <div className="text-[9px] text-center text-gray-500 mb-2">
                  {settings.gstNumber && `GSTIN: ${settings.gstNumber}`}
                  {settings.gstNumber && settings.fssaiNumber && ' | '}
                  {settings.fssaiNumber && `FSSAI: ${settings.fssaiNumber}`}
                </div>
              )}

              {/* Invoice Details */}
              <div className="text-[10px] space-y-0.5 mb-2">
                <div className="flex justify-between">
                  <span>Invoice No:</span>
                  <span className="font-bold">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{formatDate(printedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span>{formatTime(printedAt)}</span>
                </div>
                {order.tableNumber && (
                  <div className="flex justify-between">
                    <span>Table No:</span>
                    <span>{order.tableNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Order Type:</span>
                  <span>{order.orderType.toUpperCase()}</span>
                </div>
                {order.orderNumber && (
                  <div className="flex justify-between">
                    <span>Order No:</span>
                    <span>{order.orderNumber}</span>
                  </div>
                )}
                {cashierName && (
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{cashierName}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-gray-400 my-2" />

              {/* Items Header */}
              <div className="flex text-[10px] font-bold border-b border-gray-400 pb-1 mb-1">
                <span className="flex-1">Item</span>
                <span className="w-8 text-center">Qty</span>
                <span className="w-12 text-right">Rate</span>
                <span className="w-14 text-right">Amt</span>
              </div>

              {/* Items */}
              <div className="space-y-1 mb-2">
                {order.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex text-[10px]">
                      <span className="flex-1 truncate" title={item.menuItem.name}>
                        {item.menuItem.name.length > (is80mm ? 20 : 14)
                          ? item.menuItem.name.substring(0, is80mm ? 18 : 12) + '..'
                          : item.menuItem.name}
                      </span>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <span className="w-12 text-right">{item.menuItem.price.toFixed(0)}</span>
                      <span className="w-14 text-right">{item.subtotal.toFixed(2)}</span>
                    </div>
                    {item.modifiers.length > 0 && (
                      <div className="text-[8px] text-gray-500 pl-2">
                        {item.modifiers.map((m, i) => (
                          <div key={i}>+ {m.name}</div>
                        ))}
                      </div>
                    )}
                    {item.specialInstructions && (
                      <div className="text-[8px] text-gray-500 italic pl-2">
                        * {item.specialInstructions.substring(0, 25)}
                        {item.specialInstructions.length > 25 ? '...' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-400 my-2" />

              <div className="text-[10px] text-center text-gray-600 mb-2">
                Total Items: {totalItems}
              </div>

              {/* Totals */}
              <div className="text-[10px] space-y-0.5">
                {!settings.taxEnabled ? (
                  // Tax Disabled - just show subtotal
                  <>
                    <div className="flex justify-between">
                      <span>Sub Total:</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {taxes.serviceCharge > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Service Charge ({settings.serviceChargeRate}%):</span>
                        <span>{formatCurrency(taxes.serviceCharge)}</span>
                      </div>
                    )}
                  </>
                ) : settings.taxIncludedInPrice ? (
                  // Tax Included in Price display
                  <>
                    <div className="flex justify-between">
                      <span>Total (incl. tax):</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[9px]">
                      <span>├─ CGST ({settings.cgstRate}%):</span>
                      <span>{formatCurrency(taxes.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[9px]">
                      <span>└─ SGST ({settings.sgstRate}%):</span>
                      <span>{formatCurrency(taxes.sgst)}</span>
                    </div>
                    {taxes.serviceCharge > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Service Charge ({settings.serviceChargeRate}%):</span>
                        <span>{formatCurrency(taxes.serviceCharge)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  // Tax Added to Price display
                  <>
                    <div className="flex justify-between">
                      <span>Sub Total:</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    {taxes.serviceCharge > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Service Charge ({settings.serviceChargeRate}%):</span>
                        <span>{formatCurrency(taxes.serviceCharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>CGST ({settings.cgstRate}%):</span>
                      <span>{formatCurrency(taxes.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>SGST ({settings.sgstRate}%):</span>
                      <span>{formatCurrency(taxes.sgst)}</span>
                    </div>
                  </>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>- {formatCurrency(order.discount)}</span>
                  </div>
                )}
                {(taxes.packingCharges || order.packingCharges) && (taxes.packingCharges || order.packingCharges || 0) > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Packing Charges:</span>
                    <span>+ {formatCurrency(taxes.packingCharges || order.packingCharges || 0)}</span>
                  </div>
                )}
                {taxes.roundOff !== 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Round Off:</span>
                    <span>
                      {taxes.roundOff >= 0 ? '+' : ''}
                      {formatCurrency(Math.abs(taxes.roundOff))}
                    </span>
                  </div>
                )}
              </div>

              {/* Grand Total */}
              <div className="flex justify-between font-bold text-sm border-t-2 border-b-2 border-black py-1 my-2">
                <span>GRAND TOTAL:</span>
                <span>{formatCurrency(taxes.grandTotal)}</span>
              </div>

              {/* Payment Info */}
              <div className="text-center text-[11px] font-bold bg-gray-100 py-1 my-2">
                PAYMENT: {(order.paymentMethod || 'PENDING').toUpperCase()}
              </div>

              {/* Footer */}
              <div className="text-center text-[9px] border-t border-dashed border-gray-400 pt-2 mt-2">
                <div className="font-bold">
                  {settings.invoiceTerms || 'Thank you for dining with us!'}
                </div>
                {settings.website && (
                  <div className="text-gray-500">Visit: {settings.website}</div>
                )}
                <div className="text-gray-400 italic mt-1">
                  {settings.footerNote || 'This is a computer generated invoice.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="lg:w-72 space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="text-green-500 text-4xl mb-2">✓</div>
            <div className="text-green-500 font-bold text-sm uppercase tracking-wide">
              Bill Generated
            </div>
            <div className="text-green-400 text-xs mt-1">Invoice #{invoiceNumber}</div>
          </div>

          <div className="space-y-3">
            {/* Print to Printer */}
            <IndustrialButton
              variant="success"
              onClick={handlePrintToPrinter}
              disabled={isPrinting}
              size="lg"
              className="w-full"
            >
              {isPrinting ? 'PRINTING...' : '🖨️ PRINT BILL'}
            </IndustrialButton>

            <div className="text-[10px] text-muted-foreground text-center -mt-2">
              {getPrinterLabel()}
            </div>

            {printResult && (
              <div
                className={`p-2 rounded text-xs text-center ${
                  printResult.success
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {printResult.success ? '✓' : '✕'} {printResult.message}
              </div>
            )}

            <div className="border-t border-white/10 pt-3 space-y-2">
              <IndustrialButton
                variant="primary"
                onClick={handleOpenPDF}
                disabled={isGeneratingPDF}
                size="lg"
                className="w-full"
              >
                {isGeneratingPDF ? 'GENERATING...' : 'OPEN PDF'}
              </IndustrialButton>

              <IndustrialButton
                variant="secondary"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                size="lg"
                className="w-full"
              >
                {isGeneratingPDF ? 'GENERATING...' : 'DOWNLOAD PDF'}
              </IndustrialButton>
            </div>

            <IndustrialButton
              variant="secondary"
              onClick={handleClose}
              size="lg"
              className="w-full"
            >
              CLOSE
            </IndustrialButton>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {billPrintedCalled
              ? 'Bill printed. Close to select payment method.'
              : 'Print the bill, then select payment method.'}
          </div>
        </div>
      </div>
    </IndustrialModal>
  );
}
