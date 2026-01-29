/**
 * TaxConfigScreen Component
 * Configure tax settings - Simple mode vs GST mode (REQUIRED)
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Info, Check } from 'lucide-react';
import { useSetupWizardStore, type TaxMode } from '../../../stores/setupWizardStore';
import { cn } from '../../../lib/utils';

export function TaxConfigScreen() {
  const { wizardData, updateWizardData } = useSetupWizardStore();

  const [mode, setMode] = useState<TaxMode>(wizardData.taxSettings?.mode || 'simple');
  const [cgstRate, setCgstRate] = useState(wizardData.taxSettings?.cgstRate || 2.5);
  const [sgstRate, setSgstRate] = useState(wizardData.taxSettings?.sgstRate || 2.5);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(
    wizardData.taxSettings?.serviceChargeEnabled || false
  );
  const [serviceChargeRate, setServiceChargeRate] = useState(
    wizardData.taxSettings?.serviceChargeRate || 5
  );
  const [taxIncludedInPrice, setTaxIncludedInPrice] = useState(
    wizardData.taxSettings?.taxIncludedInPrice || false
  );

  // Update wizard store whenever settings change
  useEffect(() => {
    updateWizardData({
      taxSettings: {
        mode,
        cgstRate,
        sgstRate,
        serviceChargeEnabled,
        serviceChargeRate,
        taxIncludedInPrice,
      },
    });
  }, [mode, cgstRate, sgstRate, serviceChargeEnabled, serviceChargeRate, taxIncludedInPrice, updateWizardData]);

  // Calculate example bill
  const exampleSubtotal = 1000;
  const exampleBill = (() => {
    if (mode === 'simple') {
      const sc = serviceChargeEnabled ? (exampleSubtotal * serviceChargeRate) / 100 : 0;
      return {
        subtotal: exampleSubtotal,
        cgst: 0,
        sgst: 0,
        serviceCharge: sc,
        total: exampleSubtotal + sc,
      };
    }

    // GST mode
    const sc = serviceChargeEnabled ? (exampleSubtotal * serviceChargeRate) / 100 : 0;
    const taxableAmount = exampleSubtotal + sc;
    const cgst = (taxableAmount * cgstRate) / 100;
    const sgst = (taxableAmount * sgstRate) / 100;

    return {
      subtotal: exampleSubtotal,
      cgst,
      sgst,
      serviceCharge: sc,
      total: exampleSubtotal + sc + cgst + sgst,
    };
  })();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-paprika/20 to-saffron/10 flex items-center justify-center">
          <Calculator className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Tax Configuration</h2>
        <p className="text-muted-foreground">How do you want to handle taxes?</p>
      </motion.div>

      {/* Tax Mode Selection */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Simple Mode */}
        <button
          onClick={() => setMode('simple')}
          className={cn(
            'relative p-6 rounded-2xl border-2 text-left transition-all',
            mode === 'simple'
              ? 'border-saffron bg-gradient-to-br from-saffron/10 to-paprika/5 shadow-lg'
              : 'border-border hover:border-border-strong bg-card'
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Simple Mode</h3>
              <p className="text-xs text-muted-foreground">Recommended for small eateries</p>
            </div>
            {mode === 'simple' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-paprika to-saffron flex items-center justify-center">
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            No tax calculations. Menu prices = Billing prices.
          </p>
          <div className="text-xs text-muted-foreground">
            Perfect if you're not registered for GST or prefer all-inclusive pricing.
          </div>
        </button>

        {/* GST Mode */}
        <button
          onClick={() => setMode('gst')}
          className={cn(
            'relative p-6 rounded-2xl border-2 text-left transition-all',
            mode === 'gst'
              ? 'border-saffron bg-gradient-to-br from-saffron/10 to-paprika/5 shadow-lg'
              : 'border-border hover:border-border-strong bg-card'
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">GST Mode</h3>
              <p className="text-xs text-muted-foreground">For GST-registered businesses</p>
            </div>
            {mode === 'gst' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-paprika to-saffron flex items-center justify-center">
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Calculate and display CGST/SGST on bills.
          </p>
          <div className="text-xs text-muted-foreground">
            Required for GST-compliant invoicing and tax filing.
          </div>
        </button>
      </motion.div>

      {/* GST Settings (only if GST mode) */}
      {mode === 'gst' && (
        <motion.div
          className="space-y-6 mb-8 p-6 rounded-2xl bg-card/50 border border-border"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-saffron" />
            <h3 className="font-bold">GST Rate Settings</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">CGST Rate (%)</label>
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
              <label className="block text-sm font-bold mb-2">SGST Rate (%)</label>
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

          <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-2">
            <input
              type="checkbox"
              id="taxIncluded"
              checked={taxIncludedInPrice}
              onChange={(e) => setTaxIncludedInPrice(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-border text-saffron focus:ring-saffron"
            />
            <label htmlFor="taxIncluded" className="text-sm font-medium cursor-pointer">
              Tax is already included in menu prices
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Common rates: 5% (2.5% CGST + 2.5% SGST) for non-AC, 18% (9% + 9%) for AC restaurants
          </p>
        </motion.div>
      )}

      {/* Service Charge */}
      <motion.div
        className="mb-8 p-6 rounded-2xl bg-card/50 border border-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold mb-1">Service Charge</h3>
            <p className="text-sm text-muted-foreground">Add a percentage service charge to bills</p>
          </div>
          <button
            onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)}
            className={cn(
              'relative w-14 h-8 rounded-full transition-all',
              serviceChargeEnabled ? 'bg-gradient-to-r from-paprika to-saffron' : 'bg-surface-3'
            )}
          >
            <motion.div
              className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
              animate={{ x: serviceChargeEnabled ? 24 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {serviceChargeEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <label className="block text-sm font-bold mb-2">Service Charge Rate (%)</label>
            <input
              type="number"
              value={serviceChargeRate}
              onChange={(e) => setServiceChargeRate(parseFloat(e.target.value) || 0)}
              step="0.5"
              min="0"
              max="20"
              className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground outline-none"
            />
          </motion.div>
        )}
      </motion.div>

      {/* Example Bill Preview */}
      <motion.div
        className="p-6 rounded-2xl bg-gradient-to-br from-surface-1 to-surface-2 border border-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-saffron" />
          Example Bill Preview
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">₹{exampleBill.subtotal.toFixed(2)}</span>
          </div>
          {exampleBill.serviceCharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Charge ({serviceChargeRate}%)</span>
              <span className="font-mono">₹{exampleBill.serviceCharge.toFixed(2)}</span>
            </div>
          )}
          {mode === 'gst' && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST ({cgstRate}%)</span>
                <span className="font-mono">₹{exampleBill.cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST ({sgstRate}%)</span>
                <span className="font-mono">₹{exampleBill.sgst.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="font-mono">₹{Math.round(exampleBill.total)}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
