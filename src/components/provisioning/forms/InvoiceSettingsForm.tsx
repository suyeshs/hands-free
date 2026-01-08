/**
 * Invoice Settings Form for Provisioning
 * Invoice prefix, numbering, and footer messages
 */

import { useRestaurantSettingsStore } from '../../../stores/restaurantSettingsStore';
import { useProvisioningStore } from '../../../stores/provisioningStore';
import { WizardNavigation } from '../WizardNavigation';
import { useState } from 'react';

export function InvoiceSettingsForm() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const { markStepComplete, nextStep } = useProvisioningStore();

  const [formData, setFormData] = useState({
    invoicePrefix: settings.invoicePrefix || 'INV',
    invoiceStartNumber: settings.invoiceStartNumber || 1,
    currentInvoiceNumber: settings.currentInvoiceNumber || 1,
    invoiceTerms: settings.invoiceTerms || 'Thank you for dining with us!',
    footerNote: settings.footerNote || 'This is a computer generated invoice.',
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNext = () => {
    // Update the settings store
    updateSettings({
      ...settings,
      invoicePrefix: formData.invoicePrefix,
      invoiceStartNumber: formData.invoiceStartNumber,
      currentInvoiceNumber: formData.currentInvoiceNumber,
      invoiceTerms: formData.invoiceTerms,
      footerNote: formData.footerNote,
    });

    markStepComplete('business_invoice');
    nextStep();
  };

  // Generate invoice preview
  const getInvoicePreview = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const number = formData.currentInvoiceNumber.toString().padStart(6, '0');
    return `${formData.invoicePrefix}-${year}${month}-${number}`;
  };

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🧾</span>
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          Invoice Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Configure how your invoices are numbered and displayed
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invoice Prefix */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Invoice Prefix
            </label>
            <input
              type="text"
              value={formData.invoicePrefix}
              onChange={(e) => handleInputChange('invoicePrefix', e.target.value.toUpperCase())}
              placeholder="INV"
              maxLength={5}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">e.g., INV, BILL, RCP</p>
          </div>

          {/* Starting Number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Starting Invoice Number
            </label>
            <input
              type="number"
              value={formData.invoiceStartNumber}
              onChange={(e) =>
                handleInputChange('invoiceStartNumber', parseInt(e.target.value) || 1)
              }
              min={1}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">First invoice will start from this</p>
          </div>

          {/* Current Number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Current Invoice Number
            </label>
            <input
              type="number"
              value={formData.currentInvoiceNumber}
              onChange={(e) =>
                handleInputChange('currentInvoiceNumber', parseInt(e.target.value) || 1)
              }
              min={1}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">Next invoice will use this number</p>
          </div>

          {/* Invoice Preview */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Invoice Format Preview
            </label>
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 font-mono text-accent text-lg">
              {getInvoicePreview()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Format: PREFIX-YYMM-NUMBER
            </p>
          </div>
        </div>

        {/* Footer Messages */}
        <div className="pt-6 border-t border-border space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Invoice Messages</h3>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Thank You Message
            </label>
            <textarea
              value={formData.invoiceTerms}
              onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
              placeholder="Thank you for dining with us!"
              rows={2}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Footer Note
            </label>
            <textarea
              value={formData.footerNote}
              onChange={(e) => handleInputChange('footerNote', e.target.value)}
              placeholder="This is a computer generated invoice."
              rows={2}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <WizardNavigation onNext={handleNext} canGoNext={true} />
    </div>
  );
}

export default InvoiceSettingsForm;
