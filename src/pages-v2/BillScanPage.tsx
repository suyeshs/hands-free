/**
 * Bill Scan Page
 * Single-page layout: Scanner on left, Results on right
 * Shows results inline after scanning for better UX
 * Supports supplier pre-selection and manual entry fallback
 * Optional: Delivery verification mode for barcode scanning
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../stores/inventoryStore';
import { useTenantStore } from '../stores/tenantStore';
import { useDeliveryVerificationStore } from '../stores/deliveryVerificationStore';
import { BillScanner } from '../components/inventory/BillScanner';
import { ScanResultsReview } from '../components/inventory/ScanResultsReview';
import { DeliveryVerification } from '../components/inventory/DeliveryVerification';
import { ExtractedDocumentData } from '../types/inventory';
import { cn } from '../lib/utils';
import { isMobileDevice } from '../lib/nativeDocumentScanner';

export function BillScanPage() {
  const navigate = useNavigate();
  const { tenant } = useTenantStore();
  const tenantId = tenant?.tenantId;
  const {
    items,
    suppliers,
    pendingScan,
    scanProcessing,
    error,
    loadInventory,
    loadSuppliers,
    scanBill,
    scanBillFromCamera,
    confirmScanResults,
    clearPendingScan,
  } = useInventoryStore();

  // Delivery verification store
  const {
    isEnabled: isVerificationEnabled,
    setEnabled: setVerificationEnabled,
    currentSession: verificationSession,
    startVerificationFromExtractedItems,
    cancelVerification,
  } = useDeliveryVerificationStore();

  const [scanError, setScanError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Supplier pre-selection for better OCR context
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Manual entry mode - for when OCR fails or user prefers manual input
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [manualData, setManualData] = useState<ExtractedDocumentData | null>(null);

  // Verification mode - for scanning barcodes to match delivery
  const [verificationMode, setVerificationMode] = useState(false);

  // Determine if we have valid scan results to show
  const hasResults = (pendingScan?.extractedData && pendingScan.extractedData.items?.length > 0) || manualEntryMode;
  const hasPendingScan = !!pendingScan || manualEntryMode;
  const isMobile = isMobileDevice();

  // Get current extracted data (from scan or manual entry)
  const currentExtractedData = manualEntryMode ? manualData : pendingScan?.extractedData;

  // Load existing data for matching
  useEffect(() => {
    if (tenantId) {
      loadInventory(tenantId);
      loadSuppliers(tenantId);
    }
  }, [tenantId]);

  // Get selected supplier for context
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // Handle file scan
  const handleScanFile = async (file: File) => {
    if (!tenantId) return;

    setScanError(null);
    setSuccessMessage(null);
    setDebugInfo(null);
    setManualEntryMode(false);

    try {
      console.log('[BillScanPage] Starting file scan...', selectedSupplierId ? `with supplier: ${selectedSupplierId}` : '');
      // TODO: Pass selectedSupplierId to API when backend supports it
      const result = await scanBill(file, tenantId);
      console.log('[BillScanPage] Scan result:', result);

      // Debug: Log the result structure
      setDebugInfo(`Status: ${result?.status}, Items: ${result?.extractedData?.items?.length || 0}`);

      if (result?.status === 'completed') {
        if (result.extractedData && result.extractedData.items?.length > 0) {
          console.log('[BillScanPage] Scan successful with items');
        } else {
          setScanError('No items were extracted from the document. Try manual entry instead.');
        }
      } else if (result?.status === 'failed') {
        setScanError(result.error || 'Failed to process the document. Try manual entry instead.');
      } else if (result?.status === 'processing') {
        // Still processing - handled by scanProcessing state
        console.log('[BillScanPage] Still processing...');
      }
    } catch (err) {
      console.error('[BillScanPage] Scan error:', err);
      setScanError(err instanceof Error ? err.message : 'Failed to scan bill. Try manual entry instead.');
    }
  };

  // Handle camera scan
  const handleScanCamera = async (base64: string) => {
    if (!tenantId) return;

    setScanError(null);
    setSuccessMessage(null);
    setDebugInfo(null);
    setManualEntryMode(false);

    try {
      console.log('[BillScanPage] Starting camera scan...');
      const result = await scanBillFromCamera(base64, tenantId);
      console.log('[BillScanPage] Camera scan result:', result);

      // Debug: Log the result structure
      setDebugInfo(`Status: ${result?.status}, Items: ${result?.extractedData?.items?.length || 0}`);

      if (result?.status === 'completed') {
        if (result.extractedData && result.extractedData.items?.length > 0) {
          console.log('[BillScanPage] Camera scan successful with items');
        } else {
          setScanError('No items were extracted from the image. Try manual entry instead.');
        }
      } else if (result?.status === 'failed') {
        setScanError(result.error || 'Failed to process the image. Try manual entry instead.');
      }
    } catch (err) {
      console.error('[BillScanPage] Camera scan error:', err);
      setScanError(err instanceof Error ? err.message : 'Failed to process image. Try manual entry instead.');
    }
  };

  // Start manual entry mode
  const handleStartManualEntry = () => {
    const supplierInfo = selectedSupplier ? {
      name: selectedSupplier.name,
      phone: selectedSupplier.phone,
      address: selectedSupplier.address,
    } : undefined;

    setManualData({
      items: [
        {
          name: '',
          quantity: 1,
          unit: 'pcs',
          unitPrice: 0,
          totalPrice: 0,
          confidence: 1,
          isNewItem: true,
        }
      ],
      supplier: supplierInfo,
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      total: 0,
    });
    setManualEntryMode(true);
    setScanError(null);
    setDebugInfo(null);
  };

  // Handle confirm scan results
  const handleConfirm = async (
    editedItems: Array<{
      name: string;
      quantity: number;
      unitPrice?: number;
      category: string;
      selectedUnit: string;
      matchedInventoryItemId?: string;
    }>,
    supplierId?: string,
    newSupplier?: { name: string; phone?: string; address?: string },
    invoiceDetails?: { invoiceNumber?: string; invoiceDate?: string }
  ) => {
    // Allow confirmation for both scanned and manual entry
    if (!tenantId || (!pendingScan?.extractedData && !manualEntryMode)) return;

    setIsSubmitting(true);
    setScanError(null);

    try {
      // Build the extracted items for confirmation
      const extractedItems = editedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.selectedUnit,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * (item.unitPrice || 0),
        confidence: 1, // User confirmed
        matchedInventoryItemId: item.matchedInventoryItemId,
        isNewItem: !item.matchedInventoryItemId,
      }));

      console.log('[BillScanPage] Invoice details:', invoiceDetails);
      console.log('[BillScanPage] Manual entry mode:', manualEntryMode);
      console.log('[BillScanPage] New supplier:', newSupplier);

      // Pass document info for invoice tracking
      const documentInfo = {
        invoiceNumber: invoiceDetails?.invoiceNumber,
        invoiceDate: invoiceDetails?.invoiceDate,
        extractedData: currentExtractedData,
      };

      await confirmScanResults(extractedItems, supplierId || null, tenantId, undefined, newSupplier, documentInfo);

      const dateStr = invoiceDetails?.invoiceDate
        ? ` (Invoice: ${invoiceDetails.invoiceDate})`
        : '';
      const modeStr = manualEntryMode ? ' (Manual entry)' : '';
      setSuccessMessage(`Successfully updated ${editedItems.length} item${editedItems.length !== 1 ? 's' : ''} in inventory!${dateStr}${modeStr}`);
      clearPendingScan();
      setManualEntryMode(false);
      setManualData(null);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to save inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel/clear results
  const handleCancel = () => {
    clearPendingScan();
    setManualEntryMode(false);
    setManualData(null);
    setScanError(null);
    setDebugInfo(null);
  };

  // Handle scan another
  const handleScanAnother = () => {
    clearPendingScan();
    setManualEntryMode(false);
    setManualData(null);
    setScanError(null);
    setSuccessMessage(null);
    setDebugInfo(null);
  };

  // Start verification mode from extracted items
  const handleStartVerification = () => {
    if (!tenantId || !currentExtractedData?.items) return;

    const supplierInfo = selectedSupplier
      ? {
          id: selectedSupplier.id,
          name: selectedSupplier.name,
          invoiceNumber: currentExtractedData.invoiceNumber,
          invoiceDate: currentExtractedData.invoiceDate,
        }
      : {
          name: currentExtractedData.supplier?.name,
          invoiceNumber: currentExtractedData.invoiceNumber,
          invoiceDate: currentExtractedData.invoiceDate,
        };

    startVerificationFromExtractedItems(tenantId, currentExtractedData.items, supplierInfo);
    setVerificationMode(true);
  };

  // Handle verification complete
  const handleVerificationComplete = () => {
    setVerificationMode(false);
    setSuccessMessage('Delivery verification completed!');
  };

  // Handle verification cancel
  const handleVerificationCancel = () => {
    cancelVerification();
    setVerificationMode(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between p-6 pb-4 border-b border-slate-700">
        <div>
          <button
            onClick={() => navigate('/inventory')}
            className="text-slate-400 hover:text-white mb-1 flex items-center gap-2 text-sm"
          >
            <span>←</span>
            Back to Inventory
          </button>
          <h1 className="text-xl font-bold">
            {verificationMode ? 'Verify Delivery' : 'Scan Vendor Bill'}
          </h1>
        </div>

        {/* Status indicator and settings */}
        <div className="flex items-center gap-3">
          {/* Verification toggle (mobile only) */}
          {isMobile && !verificationMode && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isVerificationEnabled}
                onChange={(e) => setVerificationEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600"
              />
              <span className="text-slate-400">Verify Mode</span>
            </label>
          )}

          {scanProcessing && (
            <div className="flex items-center gap-2 text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Processing...</span>
            </div>
          )}
          {hasResults && !scanProcessing && !verificationMode && (
            <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg text-sm">
              {pendingScan?.extractedData?.items?.length} items extracted
            </span>
          )}
          {verificationMode && verificationSession && (
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-sm">
              Verifying: {verificationSession.scannedItems.length} scanned
            </span>
          )}
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <main className="flex-1 overflow-hidden flex">
        {/* Left Column: Scanner */}
        <div className={cn(
          "flex-shrink-0 border-r border-slate-700 overflow-y-auto p-6",
          hasResults ? "w-1/3 min-w-[350px]" : "w-full max-w-2xl mx-auto"
        )}>
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-4 text-green-400">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium">{successMessage}</p>
                  <button
                    onClick={handleScanAnother}
                    className="text-sm text-green-300 hover:text-green-200 underline mt-1"
                  >
                    Scan another bill
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error/Warning Display with Manual Entry Option */}
          {(scanError || error) && !successMessage && (() => {
            const message = scanError || error || '';
            const isLocalSaveInfo = message.includes('saved locally');
            const isPartialSuccess = message.includes('Saved') && message.includes('failed');

            // Show as warning (yellow) for local save info, red for errors
            if (isLocalSaveInfo) {
              return (
                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
                  <p className="text-yellow-400">{message}</p>
                  <p className="text-xs text-yellow-300/70 mt-1">
                    Items will sync to cloud when connection is restored.
                  </p>
                </div>
              );
            }

            if (isPartialSuccess) {
              return (
                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
                  <p className="text-yellow-400">{message}</p>
                </div>
              );
            }

            return (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-4">
                <p className="text-red-400">{message}</p>
                {debugInfo && (
                  <p className="text-xs mt-2 text-red-300/70">Debug: {debugInfo}</p>
                )}
                <button
                  onClick={handleStartManualEntry}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors text-white"
                >
                  Enter Manually Instead
                </button>
              </div>
            );
          })()}

          {/* Supplier Pre-selection */}
          {!hasResults && !scanProcessing && !successMessage && (
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2">
                Select Supplier (Optional - helps with OCR accuracy)
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select supplier --</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {selectedSupplier?.ocrTemplate && (
                <p className="text-xs text-green-400 mt-1">
                  This supplier has a saved template for better extraction
                </p>
              )}
            </div>
          )}

          <BillScanner
            onScanFile={handleScanFile}
            onScanCamera={handleScanCamera}
            isProcessing={scanProcessing}
            error={null} // We handle errors above
          />

          {/* Processing Info */}
          {scanProcessing && (
            <div className="mt-4 bg-slate-800 rounded-xl p-4">
              <h4 className="font-bold mb-2 text-sm">AI Processing</h4>
              <p className="text-xs text-slate-400">
                Extracting items, quantities, and prices from your document...
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                <span>Provider: {pendingScan?.provider || 'Analyzing...'}</span>
                {pendingScan?.processingTimeMs && (
                  <span>Time: {pendingScan.processingTimeMs}ms</span>
                )}
              </div>
            </div>
          )}

          {/* Instructions - Only show when no results */}
          {!hasResults && !scanProcessing && !successMessage && (
            <div className="mt-6 space-y-4">
              {/* Manual Entry Option */}
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
                <h3 className="font-bold mb-2 text-sm">Prefer Manual Entry?</h3>
                <p className="text-xs text-slate-400 mb-3">
                  Skip scanning and enter invoice details directly
                </p>
                <button
                  onClick={handleStartManualEntry}
                  className="w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Enter Invoice Manually
                </button>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <h3 className="font-bold mb-3 text-sm">How scanning works</h3>
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="flex items-start gap-2">
                    <span>1.</span>
                    <span>Upload or capture a vendor bill/invoice</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>2.</span>
                    <span>AI extracts items, quantities & prices</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>3.</span>
                    <span>Review and save to your inventory</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <h3 className="font-bold mb-2 text-sm">Supported Documents</h3>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">Invoices</span>
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">Bills</span>
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">Receipts</span>
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">Challans</span>
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">PDFs</span>
                </div>
              </div>
            </div>
          )}

          {/* Show pending scan info when we have results */}
          {hasPendingScan && hasResults && !manualEntryMode && (
            <div className="mt-4 bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">Scan Complete</h4>
                <button
                  onClick={handleCancel}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear & Rescan
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span>Provider: {pendingScan?.provider}</span>
                {pendingScan?.processingTimeMs && (
                  <span>• {pendingScan.processingTimeMs}ms</span>
                )}
                {pendingScan?.confidenceScore && (
                  <span>• {Math.round(pendingScan.confidenceScore * 100)}% confidence</span>
                )}
              </div>
            </div>
          )}

          {/* Show manual entry info */}
          {manualEntryMode && (
            <div className="mt-4 bg-blue-800/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">Manual Entry</h4>
                <button
                  onClick={handleCancel}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Enter invoice details manually in the form on the right
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Results Review or Verification */}
        {verificationMode && verificationSession ? (
          <div className="flex-1 overflow-y-auto p-6">
            <DeliveryVerification
              expectedItems={verificationSession.expectedItems}
              tenantId={tenantId || ''}
              supplierInfo={{
                id: verificationSession.supplierId,
                name: verificationSession.supplierName,
                invoiceNumber: verificationSession.invoiceNumber,
                invoiceDate: verificationSession.invoiceDate,
              }}
              existingInventoryItems={items}
              onComplete={handleVerificationComplete}
              onCancel={handleVerificationCancel}
            />
          </div>
        ) : hasResults && currentExtractedData ? (
          <div className="flex-1 overflow-y-auto p-6">
            {manualEntryMode && (
              <div className="mb-4 bg-blue-500/20 border border-blue-500/30 rounded-xl p-3 text-blue-400 text-sm">
                Manual Entry Mode - Add items below
              </div>
            )}

            {/* Verify Delivery Button - Show when verification is enabled */}
            {isVerificationEnabled && isMobile && !manualEntryMode && (
              <button
                onClick={handleStartVerification}
                className="w-full mb-4 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <span>📦</span>
                Verify Delivery with Barcode Scanner
              </button>
            )}

            <ScanResultsReview
              extractedData={currentExtractedData}
              existingItems={items}
              suppliers={suppliers}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
            />
          </div>
        ) : null}

        {/* Empty state for right column when no results */}
        {!hasResults && !scanProcessing && (
          <div className="hidden lg:flex flex-1 items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-50">📋</div>
              <p>Scan results will appear here</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
