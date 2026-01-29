/**
 * TaxBillingCard Component
 * Configures tax calculations and invoice settings
 */

import { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { SetupCardBase } from '../SetupCardBase';
import { useRestaurantSettingsStore } from '../../../stores/restaurantSettingsStore';
import { useHasTaxBillingSetup } from '../../../stores/setupWizardStore';
import { cn } from '../../../lib/utils';

export function TaxBillingCard() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const completed = useHasTaxBillingSetup();

  const [taxMode, setTaxMode] = useState<'simple' | 'gst'>(
    settings.taxEnabled ? 'gst' : 'simple'
  );
  const [cgstRate, setCgstRate] = useState(settings.cgstRate || 2.5);
  const [sgstRate, setSgstRate] = useState(settings.sgstRate || 2.5);
  const [gstNumber, setGstNumber] = useState(settings.gstNumber || '');
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix || 'INV');
  const [invoiceStartNumber, setInvoiceStartNumber] = useState(
    settings.invoiceStartNumber || 1
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    // GST number is now optional (not an error, just a warning)
    // Many small restaurants don't have GST registration (threshold: ₹40 lakh turnover)

    if (!invoicePrefix.trim()) {
      newErrors.invoicePrefix = 'Invoice prefix is required';
    } else if (invoicePrefix.length < 2) {
      newErrors.invoicePrefix = 'Invoice prefix must be at least 2 characters';
    }

    if (!invoiceStartNumber || invoiceStartNumber < 1) {
      newErrors.invoiceStartNumber = 'Start number must be at least 1';
    }

    setErrors(newErrors);
  }, [taxMode, gstNumber, invoicePrefix, invoiceStartNumber]);

  const handleComplete = async () => {
    console.log('[TaxBillingCard] ===== handleComplete called =====');
    console.log('[TaxBillingCard] taxMode:', taxMode);
    console.log('[TaxBillingCard] invoicePrefix:', invoicePrefix);
    console.log('[TaxBillingCard] invoiceStartNumber:', invoiceStartNumber);
    console.log('[TaxBillingCard] errors:', errors);

    if (Object.keys(errors).length > 0) {
      alert('Please fix all errors before completing');
      return;
    }

    const dataToSave = {
      taxEnabled: taxMode === 'gst',
      cgstRate: taxMode === 'gst' ? cgstRate : 0,
      sgstRate: taxMode === 'gst' ? sgstRate : 0,
      gstNumber: taxMode === 'gst' ? gstNumber : '',
      invoicePrefix,
      invoiceStartNumber,
      currentInvoiceNumber: invoiceStartNumber,
    };

    console.log('[TaxBillingCard] Data to save:', dataToSave);

    try {
      console.log('[TaxBillingCard] 📝 Calling updateSettings...');
      await updateSettings(dataToSave);
      console.log('[TaxBillingCard] ✅ updateSettings completed');

      // Verify data was actually saved
      console.log('[TaxBillingCard] 🔍 Verifying save - reading back from store...');

      // Wait a moment for stores to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentSettings = useRestaurantSettingsStore.getState().settings;
      console.log('[TaxBillingCard] 🔍 Current settings in store:', {
        taxEnabled: currentSettings.taxEnabled,
        invoicePrefix: currentSettings.invoicePrefix,
        currentInvoiceNumber: currentSettings.currentInvoiceNumber,
        invoiceStartNumber: currentSettings.invoiceStartNumber,
      });

      // Manual validation check (without using hook in async context)
      const hasTaxConfig = Boolean(
        currentSettings.taxEnabled !== undefined &&
        (currentSettings.taxEnabled === false || (currentSettings.cgstRate !== undefined && currentSettings.sgstRate !== undefined))
      );

      const hasInvoiceConfig = Boolean(
        currentSettings.invoicePrefix?.trim() &&
        currentSettings.invoicePrefix.length >= 2 &&
        currentSettings.currentInvoiceNumber !== undefined &&
        currentSettings.currentInvoiceNumber !== null &&
        currentSettings.invoiceStartNumber !== undefined
      );

      const isValid = hasTaxConfig && hasInvoiceConfig;
      console.log('[TaxBillingCard] 🔍 Validation result:', isValid, { hasTaxConfig, hasInvoiceConfig });

      if (!isValid) {
        console.error('[TaxBillingCard] ⚠️ WARNING: Data saved but validation still failing!');
      }
    } catch (error) {
      console.error('[TaxBillingCard] ❌ Failed to save:', error);
      alert('Failed to save tax & billing settings. Please try again.');
    }
  };

  const isValid = Object.keys(errors).length === 0;

  // Generate example invoice number
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const exampleNumber = invoiceStartNumber.toString().padStart(6, '0');
  const exampleInvoice = `${invoicePrefix}-${year}${month}-${exampleNumber}`;

  return (
    <SetupCardBase
      id="tax-billing"
      title="Configure Tax & Billing"
      description="Set up tax calculations and invoice settings"
      icon={Calculator}
      completed={completed}
      required={true}
      onComplete={isValid ? handleComplete : undefined}
      completionMessage="Tax & billing configured ✓"
    >
      <div className="space-y-6">
        {/* Help Text */}
        <p className="text-sm text-gray-400">
          💡 Configure how taxes are calculated on bills and how invoice numbers are generated.
        </p>

        {/* Tax Mode Selection */}
        <div>
          <label className="block text-sm font-bold mb-3 text-warm-white">
            Tax Mode <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTaxMode('simple')}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                taxMode === 'simple'
                  ? 'border-saffron bg-saffron/10 ring-2 ring-saffron/20'
                  : 'border-border hover:border-border-strong hover:bg-white/5'
              )}
            >
              <div className="font-bold mb-1 text-warm-white">Simple Mode</div>
              <div className="text-xs text-gray-400">No tax calculations applied to bills</div>
            </button>

            <button
              type="button"
              onClick={() => setTaxMode('gst')}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                taxMode === 'gst'
                  ? 'border-saffron bg-saffron/10 ring-2 ring-saffron/20'
                  : 'border-border hover:border-border-strong hover:bg-white/5'
              )}
            >
              <div className="font-bold mb-1 text-warm-white">GST Mode</div>
              <div className="text-xs text-gray-400">Apply CGST + SGST to bills</div>
            </button>
          </div>
        </div>

        {/* GST Settings (conditional) */}
        {taxMode === 'gst' && (
          <div className="space-y-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h4 className="font-bold text-sm text-blue-300">GST Configuration</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold mb-2 text-warm-white">
                  CGST Rate (%)
                </label>
                <input
                  type="number"
                  value={cgstRate}
                  onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)}
                  step="0.5"
                  min="0"
                  max="28"
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-warm-white">
                  SGST Rate (%)
                </label>
                <input
                  type="number"
                  value={sgstRate}
                  onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)}
                  step="0.5"
                  min="0"
                  max="28"
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-warm-white">
                GST Number <span className="text-yellow-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="Enter your GST registration number (if registered)"
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
              />
              {!gstNumber.trim() && taxMode === 'gst' && (
                <p className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                  ⚠️ GST number recommended for registered businesses
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Optional - required only if your business is GST registered (turnover &gt; ₹40 lakh)
              </p>
            </div>

            <div className="text-xs text-blue-300 bg-blue-500/10 p-3 rounded-lg">
              <strong>Total Tax:</strong> {cgstRate + sgstRate}% (CGST {cgstRate}% + SGST {sgstRate}%)
            </div>
          </div>
        )}

        {/* Invoice Settings */}
        <div className="pt-4 border-t border-white/10">
          <h4 className="font-bold text-sm mb-3 text-warm-white">Invoice Settings</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-warm-white">
                Invoice Prefix <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g., INV"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none"
              />
              {errors.invoicePrefix && <p className="text-red-400 text-xs mt-1">{errors.invoicePrefix}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-warm-white">
                Start Number <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={invoiceStartNumber}
                onChange={(e) => setInvoiceStartNumber(parseInt(e.target.value) || 1)}
                min="1"
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground outline-none"
              />
              {errors.invoiceStartNumber && <p className="text-red-400 text-xs mt-1">{errors.invoiceStartNumber}</p>}
            </div>
          </div>

          {/* Invoice Preview */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-saffron/10 to-paprika/10 border border-saffron/20">
            <div className="text-xs text-gray-400 mb-1">Invoice Format Preview:</div>
            <div className="font-mono text-lg font-bold text-saffron">{exampleInvoice}</div>
            <div className="text-xs text-gray-400 mt-2">
              Invoice numbers auto-increment for each order
            </div>
          </div>
        </div>
      </div>
    </SetupCardBase>
  );
}
