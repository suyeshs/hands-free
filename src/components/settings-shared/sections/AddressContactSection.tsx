/**
 * Address & Contact Section
 * Handles restaurant address, phone, email, and website
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, FormField, FormGrid } from '../shared';

export function AddressContactSection() {
  const { formData, updateField } = useRestaurantSettings();

  return (
    <SectionCard title="Address & Contact" description="Location and contact information">
      <FormGrid columns={2} breakpoint="lg">
        {/* Address Line 1 - Full width */}
        <div className="lg:col-span-2">
          <FormField label="Address Line 1" required>
            <input
              type="text"
              value={formData.address?.line1 || ''}
              onChange={(e) => updateField('address.line1', e.target.value)}
              className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Street address"
            />
          </FormField>
        </div>

        {/* Address Line 2 - Full width */}
        <div className="lg:col-span-2">
          <FormField label="Address Line 2">
            <input
              type="text"
              value={formData.address?.line2 || ''}
              onChange={(e) => updateField('address.line2', e.target.value)}
              className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Apartment, suite, etc."
            />
          </FormField>
        </div>

        {/* City */}
        <FormField label="City" required>
          <input
            type="text"
            value={formData.address?.city || ''}
            onChange={(e) => updateField('address.city', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="City"
          />
        </FormField>

        {/* State */}
        <FormField label="State / Province" required>
          <input
            type="text"
            value={formData.address?.state || ''}
            onChange={(e) => updateField('address.state', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="State"
          />
        </FormField>

        {/* Pincode */}
        <FormField label="Postal Code" required>
          <input
            type="text"
            value={formData.address?.pincode || ''}
            onChange={(e) => updateField('address.pincode', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Postal code"
            maxLength={10}
          />
        </FormField>

        {/* Phone */}
        <FormField label="Phone Number" required>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="+1 (555) 123-4567"
          />
        </FormField>

        {/* Email */}
        <FormField label="Email Address">
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="contact@restaurant.com"
          />
        </FormField>

        {/* Website */}
        <FormField label="Website">
          <input
            type="url"
            value={formData.website || ''}
            onChange={(e) => updateField('website', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="https://restaurant.com"
          />
        </FormField>
      </FormGrid>
    </SectionCard>
  );
}
