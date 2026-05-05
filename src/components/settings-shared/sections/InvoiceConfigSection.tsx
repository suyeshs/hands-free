/**
 * Invoice Configuration Section
 * Invoice prefix, terms, and footer notes
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, FormField } from '../shared';

export function InvoiceConfigSection() {
  const { formData, updateField } = useRestaurantSettings();

  return (
    <SectionCard
      title="Invoice Configuration"
      description="Customize your invoice branding and legal terms"
    >
      <div className="space-y-4">
        <FormField label="Invoice Prefix" description="Prefix for invoice numbers (e.g., INV-001)">
          <input
            type="text"
            value={formData.invoicePrefix || 'INV'}
            onChange={(e) => updateField('invoicePrefix', e.target.value.toUpperCase())}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="INV"
            maxLength={5}
          />
        </FormField>

        <FormField label="Invoice Terms" description="Terms and conditions printed on receipts">
          <textarea
            value={formData.invoiceTerms || ''}
            onChange={(e) => updateField('invoiceTerms', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            rows={3}
            placeholder="Terms and conditions"
          />
        </FormField>

        <FormField label="Footer Note" description="Thank you message or promotional text">
          <textarea
            value={formData.footerNote || ''}
            onChange={(e) => updateField('footerNote', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            rows={2}
            placeholder="Thank you for dining with us!"
          />
        </FormField>
      </div>
    </SectionCard>
  );
}
