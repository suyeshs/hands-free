/**
 * Restaurant Details Section
 * Handles restaurant name, owner name, and tagline
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, FormField, FormGrid } from '../shared';

export function RestaurantDetailsSection() {
  const { formData, updateField } = useRestaurantSettings();

  return (
    <SectionCard title="Restaurant Details" description="Basic information about your restaurant">
      <FormGrid columns={2} breakpoint="lg">
        {/* Restaurant Name - Full width */}
        <div className="lg:col-span-2">
          <FormField label="Restaurant Name" required>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full neo-inset px-4 py-4 text-foreground text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Enter restaurant name"
            />
          </FormField>
        </div>

        {/* Owner Name */}
        <FormField label="Owner Name">
          <input
            type="text"
            value={formData.ownerName || ''}
            onChange={(e) => updateField('ownerName', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Owner's full name"
          />
        </FormField>

        {/* Tagline */}
        <FormField label="Tagline" description="Short description or motto">
          <input
            type="text"
            value={formData.tagline || ''}
            onChange={(e) => updateField('tagline', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Authentic Indian Cuisine"
          />
        </FormField>
      </FormGrid>
    </SectionCard>
  );
}
