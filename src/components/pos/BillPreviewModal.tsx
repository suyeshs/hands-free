/**
 * Bill Preview Modal
 * Shows generated bill on screen with options to print/download PDF
 * Records sales transaction with selected payment method
 */

import { useState } from 'react';
import { BillData, generateBillPDF, generateBillHTML } from '../print/BillPrint';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { usePrinterStore } from '../../stores/printerStore';
import { printerDiscoveryService } from '../../lib/printerDiscoveryService';
import { PaymentMethod } from '../../types/pos';
import { GeneratedBill } from '../../lib/billService';
import { salesTransactionService } from '../../lib/salesTransactionService';
import { useAuthStore } from '../../stores/authStore';
import { usePOSSessionStore } from '../../stores/posSessionStore';

interface BillPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  billData: BillData | null;
  invoiceNumber: string;
  generatedBill?: GeneratedBill;
  onPaymentComplete?: (paymentMethod: PaymentMethod) => void;
}

export function BillPreviewModal({
  isOpen,
  onClose,
  billData,
  invoiceNumber,
  generatedBill,
  onPaymentComplete,
}: BillPreviewModalProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [isRecordingSale, setIsRecordingSale] = useState(false);
  const [saleRecorded, setSaleRecorded] = useState(false);
  const { config } = usePrinterStore();
  const { user } = useAuthStore();
  const { activeStaff } = usePOSSessionStore();

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
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Failed to open PDF:', error);
      alert('Failed to open PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrintToPrinter = async () => {
    setIsPrinting(true);
    setPrintResult(null);

    try {
      const html = generateBillHTML(billData);

      if (config.printerType === 'network' && config.networkPrinterUrl) {
        // Direct network print
        const [address, portStr] = config.networkPrinterUrl.replace(/^https?:\/\//, '').split(':');
        const port = parseInt(portStr) || 9100;
        const escPosContent = printerDiscoveryService.getBillEscPosCommands(html);
        const success = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);
        setPrintResult({
          success,
          message: success ? 'Bill sent to printer!' : 'Failed to send to printer',
        });
      } else if (config.printerType === 'system' && config.systemPrinterName) {
        // System printer
        const plainText = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim();
        const success = await printerDiscoveryService.printToSystemPrinter(
          config.systemPrinterName,
          plainText,
          'text'
        );
        setPrintResult({
          success,
          message: success ? 'Bill sent to printer!' : 'Failed to send to printer',
        });
      } else {
        // Browser print
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          setPrintResult({ success: true, message: 'Print dialog opened' });
        } else {
          setPrintResult({ success: false, message: 'Failed to open print dialog' });
        }
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

  const handlePaymentSelect = async (method: PaymentMethod) => {
    setSelectedPayment(method);

    // Record the sale if we have a generated bill
    if (generatedBill && user?.tenantId && !saleRecorded) {
      setIsRecordingSale(true);
      try {
        await salesTransactionService.recordSale(
          user.tenantId,
          generatedBill,
          method,
          activeStaff?.id
        );
        setSaleRecorded(true);
        console.log(`[BillPreviewModal] Sale recorded: ${invoiceNumber} - ${method}`);
        onPaymentComplete?.(method);
      } catch (error) {
        console.error('[BillPreviewModal] Failed to record sale:', error);
      } finally {
        setIsRecordingSale(false);
      }
    }
  };

  const handleClose = () => {
    // Reset state
    setSelectedPayment(null);
    setSaleRecorded(false);
    setPrintResult(null);
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
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>- {formatCurrency(order.discount)}</span>
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
                PAYMENT: {(selectedPayment || order.paymentMethod || 'pending').toUpperCase()}
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

          {/* Payment Method Selection */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <div className="text-xs font-bold text-slate-400 uppercase mb-3">
              Select Payment Method
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handlePaymentSelect('cash')}
                disabled={isRecordingSale || saleRecorded}
                className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                  selectedPayment === 'cash'
                    ? 'bg-green-600 border-green-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-green-500'
                } ${(isRecordingSale || saleRecorded) && selectedPayment !== 'cash' ? 'opacity-50' : ''}`}
              >
                <span className="text-2xl">💵</span>
                <span className="text-xs font-bold">CASH</span>
              </button>
              <button
                onClick={() => handlePaymentSelect('card')}
                disabled={isRecordingSale || saleRecorded}
                className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                  selectedPayment === 'card'
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-blue-500'
                } ${(isRecordingSale || saleRecorded) && selectedPayment !== 'card' ? 'opacity-50' : ''}`}
              >
                <span className="text-2xl">💳</span>
                <span className="text-xs font-bold">CARD</span>
              </button>
              <button
                onClick={() => handlePaymentSelect('upi')}
                disabled={isRecordingSale || saleRecorded}
                className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                  selectedPayment === 'upi'
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-purple-500'
                } ${(isRecordingSale || saleRecorded) && selectedPayment !== 'upi' ? 'opacity-50' : ''}`}
              >
                <span className="text-2xl">📱</span>
                <span className="text-xs font-bold">UPI</span>
              </button>
              <button
                onClick={() => handlePaymentSelect('wallet')}
                disabled={isRecordingSale || saleRecorded}
                className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                  selectedPayment === 'wallet'
                    ? 'bg-orange-600 border-orange-400 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-orange-500'
                } ${(isRecordingSale || saleRecorded) && selectedPayment !== 'wallet' ? 'opacity-50' : ''}`}
              >
                <span className="text-2xl">👛</span>
                <span className="text-xs font-bold">WALLET</span>
              </button>
            </div>
            {saleRecorded && (
              <div className="mt-2 p-2 bg-green-500/20 text-green-400 rounded text-xs text-center">
                ✓ Sale recorded as {selectedPayment?.toUpperCase()}
              </div>
            )}
            {isRecordingSale && (
              <div className="mt-2 p-2 bg-blue-500/20 text-blue-400 rounded text-xs text-center animate-pulse">
                Recording sale...
              </div>
            )}
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
            {saleRecorded
              ? 'Sale has been recorded. You can now close this window.'
              : 'Select payment method to record sale.'}
          </div>
        </div>
      </div>
    </IndustrialModal>
  );
}
