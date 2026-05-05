/**
 * Hook to detect if app needs company registration (fresh install)
 * Returns true for fresh installs that haven't registered a company yet
 */

import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { useTenantStore } from '../stores/tenantStore';

export function useNeedsCompanySetup(): boolean {
  const { settings } = useRestaurantSettingsStore();
  const { tenant } = useTenantStore();

  // If tenant already exists and is activated, no company setup needed
  if (tenant?.tenantId) {
    return false;
  }

  // Check if this is a fresh install (no company_name and no name)
  const hasCompanyName = Boolean(settings.companyName?.trim());
  const hasName = Boolean(settings.name?.trim() && settings.name !== 'Restaurant Name');

  // Fresh install: needs company setup
  if (!hasCompanyName && !hasName) {
    return true;
  }

  // Has name but no company_name: existing installation (pre-migration)
  // Should NOT show company setup - use legacy flow
  if (!hasCompanyName && hasName) {
    return false;
  }

  // Has company_name: company setup already done
  return false;
}
