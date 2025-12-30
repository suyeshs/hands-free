/**
 * Bill Scan Page
 * Dedicated page for scanning vendor bills and updating inventory
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../stores/inventoryStore';
import { useTenantStore } from '../stores/tenantStore';
import { BillScanner } from '../components/inventory/BillScanner';
import { ScanResultsReview } from '../components/inventory/ScanResultsReview';

type ScanStep = 'capture' | 'review' | 'complete';

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

  const [step, setStep] = useState<ScanStep>('capture');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedItemsCount, setAddedItemsCount] = useState(0);

  // Load existing data for matching
  useEffect(() => {
    if (tenantId) {
      loadInventory(tenantId);
      loadSuppliers(tenantId);
    }
  }, [tenantId]);

  // Handle file scan
  const handleScanFile = async (file: File) => {
    if (!tenantId) return;

    setScanError(null);
    try {
      const result = await scanBill(file, tenantId);
      if (result?.status === 'completed' && result.extractedData) {
        setStep('review');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan bill');
    }
  };

  // Handle camera scan
  const handleScanCamera = async (base64: string) => {
    if (!tenantId) return;

    setScanError(null);
    try {
      const result = await scanBillFromCamera(base64, tenantId);
      if (result?.status === 'completed' && result.extractedData) {
        setStep('review');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to process image');
    }
  };

  // Check if scan completed
  useEffect(() => {
    if (pendingScan?.status === 'completed' && pendingScan.extractedData && step === 'capture') {
      setStep('review');
    }
  }, [pendingScan, step]);

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
    _newSupplier?: { name: string; phone?: string; address?: string }
  ) => {
    if (!tenantId || !pendingScan?.extractedData) return;

    setIsSubmitting(true);
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

      // If creating a new supplier, we'd need to add that first
      // For now, pass the supplier ID directly
      await confirmScanResults(extractedItems, supplierId || null, tenantId);
      setAddedItemsCount(editedItems.length);
      setStep('complete');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to save inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    clearPendingScan();
    setStep('capture');
    setScanError(null);
  };

  // Handle scan another
  const handleScanAnother = () => {
    clearPendingScan();
    setStep('capture');
    setScanError(null);
    setAddedItemsCount(0);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/inventory')}
            className="text-slate-400 hover:text-white mb-2 flex items-center gap-2"
          >
            <span>←</span>
            Back to Inventory
          </button>
          <h1 className="text-2xl font-bold">Scan Vendor Bill</h1>
          <p className="text-slate-400">
            Upload or capture a bill to automatically update inventory
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'capture' ? 'bg-blue-600' : 'bg-green-600'
            }`}
          >
            {step === 'capture' ? '1' : '✓'}
          </div>
          <div className={`w-12 h-1 ${step !== 'capture' ? 'bg-green-600' : 'bg-slate-600'}`} />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'review'
                ? 'bg-blue-600'
                : step === 'complete'
                ? 'bg-green-600'
                : 'bg-slate-600'
            }`}
          >
            {step === 'complete' ? '✓' : '2'}
          </div>
          <div className={`w-12 h-1 ${step === 'complete' ? 'bg-green-600' : 'bg-slate-600'}`} />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'complete' ? 'bg-green-600' : 'bg-slate-600'
            }`}
          >
            3
          </div>
        </div>
      </div>

      {/* Error Display */}
      {(scanError || error) && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400">
          {scanError || error}
        </div>
      )}

      {/* Step: Capture */}
      {step === 'capture' && (
        <div className="max-w-2xl mx-auto">
          <BillScanner
            onScanFile={handleScanFile}
            onScanCamera={handleScanCamera}
            isProcessing={scanProcessing}
            error={scanError}
          />

          {/* Processing Info */}
          {scanProcessing && (
            <div className="mt-6 bg-slate-800 rounded-xl p-4">
              <h4 className="font-bold mb-2">AI Processing</h4>
              <p className="text-sm text-slate-400">
                Our AI is analyzing your document to extract items, quantities, and prices. This
                usually takes 3-10 seconds depending on document complexity.
              </p>
              <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
                <span>Provider: {pendingScan?.provider || 'Analyzing...'}</span>
                {pendingScan?.processingTimeMs && (
                  <span>Time: {pendingScan.processingTimeMs}ms</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && pendingScan?.extractedData && (
        <div className="max-w-4xl mx-auto">
          {/* Scan info */}
          <div className="mb-4 flex items-center gap-4 text-sm text-slate-400">
            <span>Provider: {pendingScan.provider}</span>
            <span>Processing: {pendingScan.processingTimeMs}ms</span>
            {pendingScan.confidenceScore && (
              <span>Confidence: {Math.round(pendingScan.confidenceScore * 100)}%</span>
            )}
          </div>

          <ScanResultsReview
            extractedData={pendingScan.extractedData}
            existingItems={items}
            suppliers={suppliers}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-2xl font-bold mb-2">Inventory Updated!</h2>
          <p className="text-slate-400 mb-6">
            Successfully added {addedItemsCount} item{addedItemsCount !== 1 ? 's' : ''} to your
            inventory.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleScanAnother}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
            >
              Scan Another Bill
            </button>
            <button
              onClick={() => navigate('/inventory')}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors"
            >
              View Inventory
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {step === 'capture' && !scanProcessing && (
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-slate-800/50 rounded-xl p-6">
            <h3 className="font-bold mb-4">How it works</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-4xl mb-2">📸</div>
                <h4 className="font-medium mb-1">1. Capture</h4>
                <p className="text-sm text-slate-400">
                  Take a photo or upload a vendor bill/invoice
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🤖</div>
                <h4 className="font-medium mb-1">2. AI Extraction</h4>
                <p className="text-sm text-slate-400">
                  Our AI reads and extracts all items and prices
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <h4 className="font-medium mb-1">3. Review & Save</h4>
                <p className="text-sm text-slate-400">
                  Verify the data and update your inventory
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-slate-800/50 rounded-xl p-6">
            <h3 className="font-bold mb-3">Supported Documents</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-slate-700 rounded-lg text-sm">Printed Invoices</span>
              <span className="px-3 py-1 bg-slate-700 rounded-lg text-sm">Bills/Receipts</span>
              <span className="px-3 py-1 bg-slate-700 rounded-lg text-sm">Handwritten Notes</span>
              <span className="px-3 py-1 bg-slate-700 rounded-lg text-sm">Delivery Challans</span>
              <span className="px-3 py-1 bg-slate-700 rounded-lg text-sm">PDF Documents</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
