/**
 * Legal Info Form for Provisioning
 * GST, FSSAI, PAN, and CIN numbers
 */

import { useRestaurantSettingsStore } from '../../../stores/restaurantSettingsStore';
import { useProvisioningStore } from '../../../stores/provisioningStore';
import { WizardNavigation } from '../WizardNavigation';
import { useState } from 'react';

export function LegalInfoForm() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const { markStepComplete, nextStep } = useProvisioningStore();

  const [formData, setFormData] = useState({
    gstNumber: settings.gstNumber || '',
    fssaiNumber: settings.fssaiNumber || '',
    panNumber: settings.panNumber || '',
    cinNumber: settings.cinNumber || '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNext = () => {
    // Update the settings store
    updateSettings({
      ...settings,
      gstNumber: formData.gstNumber || undefined,
      fssaiNumber: formData.fssaiNumber || undefined,
      panNumber: formData.panNumber || undefined,
      cinNumber: formData.cinNumber || undefined,
    });

    markStepComplete('business_legal');
    nextStep();
  };

  // Validation helpers
  const isValidGST = (gst: string) => !gst || gst.length === 15;
  const isValidFSSAI = (fssai: string) => !fssai || fssai.length === 14;
  const isValidPAN = (pan: string) => !pan || pan.length === 10;

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📋</span>
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          Legal & Tax IDs
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your business registration numbers for tax invoices
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
        <p className="text-sm text-amber-200">
          <span className="font-semibold">Important:</span> These details will appear on your tax
          invoices. Ensure they match your official registration documents.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GSTIN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              GSTIN (GST Number)
            </label>
            <input
              type="text"
              value={formData.gstNumber}
              onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
              placeholder="29AABCU9603R1ZM"
              maxLength={15}
              className={`w-full p-4 rounded-xl bg-white/5 border ${
                formData.gstNumber && !isValidGST(formData.gstNumber)
                  ? 'border-red-500'
                  : 'border-white/10'
              } text-foreground font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              15-character GST Identification Number
            </p>
          </div>

          {/* FSSAI */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              FSSAI License Number
            </label>
            <input
              type="text"
              value={formData.fssaiNumber}
              onChange={(e) => handleInputChange('fssaiNumber', e.target.value)}
              placeholder="12345678901234"
              maxLength={14}
              className={`w-full p-4 rounded-xl bg-white/5 border ${
                formData.fssaiNumber && !isValidFSSAI(formData.fssaiNumber)
                  ? 'border-red-500'
                  : 'border-white/10'
              } text-foreground font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
            />
            <p className="text-xs text-muted-foreground mt-1">14-digit FSSAI license number</p>
          </div>

          {/* PAN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              PAN Number
            </label>
            <input
              type="text"
              value={formData.panNumber}
              onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              className={`w-full p-4 rounded-xl bg-white/5 border ${
                formData.panNumber && !isValidPAN(formData.panNumber)
                  ? 'border-red-500'
                  : 'border-white/10'
              } text-foreground font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
            />
            <p className="text-xs text-muted-foreground mt-1">10-character PAN</p>
          </div>

          {/* CIN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              CIN Number (if applicable)
            </label>
            <input
              type="text"
              value={formData.cinNumber}
              onChange={(e) => handleInputChange('cinNumber', e.target.value.toUpperCase())}
              placeholder="U12345KA2020PTC123456"
              maxLength={21}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Corporate Identification Number (for companies)
            </p>
          </div>
        </div>

        {/* Optional note */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-sm text-blue-200">
            <span className="font-semibold">Note:</span> All fields are optional. You can add these
            details later from Settings if you don't have them ready now.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <WizardNavigation
        onNext={handleNext}
        canGoNext={true} // All fields are optional
        canSkip={true}
        skipLabel="Skip for now"
      />
    </div>
  );
}

export default LegalInfoForm;
