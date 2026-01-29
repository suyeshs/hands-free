/**
 * LegalInfoScreen Component
 * Collect legal and tax IDs (RECOMMENDED, skippable)
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, AlertCircle } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';

export function LegalInfoScreen() {
  const { wizardData, updateWizardData } = useSetupWizardStore();

  const [formData, setFormData] = useState({
    gstNumber: wizardData.legalInfo?.gstNumber || '',
    fssaiNumber: wizardData.legalInfo?.fssaiNumber || '',
    panNumber: wizardData.legalInfo?.panNumber || '',
    cinNumber: wizardData.legalInfo?.cinNumber || '',
  });

  useEffect(() => {
    updateWizardData({
      legalInfo: {
        gstNumber: formData.gstNumber || undefined,
        fssaiNumber: formData.fssaiNumber || undefined,
        panNumber: formData.panNumber || undefined,
        cinNumber: formData.cinNumber || undefined,
      },
    });
  }, [formData, updateWizardData]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-paprika/20 to-saffron/10 flex items-center justify-center">
          <FileText className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Legal & Tax IDs</h2>
        <p className="text-muted-foreground">Add your registration details for GST-compliant invoicing</p>
      </motion.div>

      {/* Info Alert */}
      <motion.div
        className="p-4 rounded-xl bg-info/10 border border-info/30 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div className="text-sm text-info-foreground">
            <p className="font-medium mb-1">These are optional but recommended</p>
            <p>You'll need these for GST-compliant invoices and tax filing. You can add them later in Settings.</p>
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div>
          <label className="block text-sm font-bold mb-2">
            GSTIN <span className="text-muted-foreground text-xs">(15 characters)</span>
          </label>
          <input
            type="text"
            value={formData.gstNumber}
            onChange={(e) => handleChange('gstNumber', e.target.value)}
            placeholder="e.g., 29ABCDE1234F1Z5"
            maxLength={15}
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">
            FSSAI License <span className="text-muted-foreground text-xs">(14 digits)</span>
          </label>
          <input
            type="text"
            value={formData.fssaiNumber}
            onChange={(e) => handleChange('fssaiNumber', e.target.value)}
            placeholder="e.g., 12345678901234"
            maxLength={14}
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">
            PAN Number <span className="text-muted-foreground text-xs">(10 characters)</span>
          </label>
          <input
            type="text"
            value={formData.panNumber}
            onChange={(e) => handleChange('panNumber', e.target.value)}
            placeholder="e.g., ABCDE1234F"
            maxLength={10}
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">
            CIN Number <span className="text-muted-foreground text-xs">(21 characters, for companies)</span>
          </label>
          <input
            type="text"
            value={formData.cinNumber}
            onChange={(e) => handleChange('cinNumber', e.target.value)}
            placeholder="e.g., U12345KA2020PTC123456"
            maxLength={21}
            className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-saffron focus:ring-2 focus:ring-saffron/20 bg-card text-foreground placeholder:text-muted-foreground transition-all outline-none font-mono"
          />
        </div>
      </motion.div>
    </div>
  );
}
