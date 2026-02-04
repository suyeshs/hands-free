/**
 * Store Synchronization Utility
 * Syncs state between setupWizardStore and provisioningStore
 * Fixes issue where floor plan shows as "pending" on reload even when complete
 */

import { useSetupWizardStore } from '../stores/setupWizardStore';
import { useProvisioningStore } from '../stores/provisioningStore';
import { useFloorPlanStore } from '../stores/floorPlanStore';
import { useStaffStore } from '../stores/staffStore';
import { useMenuStore } from '../stores/menuStore';

/**
 * Sync setup wizard state to provisioning store
 * Call this on app initialization to ensure both stores are in sync
 */
export async function syncSetupWizardToProvisioning(): Promise<void> {
  const setupWizard = useSetupWizardStore.getState();
  const provisioning = useProvisioningStore.getState();

  console.log('[StoreSync] Syncing setup wizard to provisioning store...');

  // Check if setup wizard has completed floor plan
  const floorPlanCompleted = setupWizard.completedScreens.has('floor_plan');
  const floorPlanSelected = setupWizard.selectedOptionalItems.includes('floor_plan');

  // Validate that floor plan actually has data (at least one section and one table)
  const floorPlanStore = useFloorPlanStore.getState();
  const hasFloorPlanData = floorPlanStore.sections.length > 0 && floorPlanStore.tables.length > 0;

  // Check if provisioning store shows floor plan as incomplete
  const provisioningFloorIncomplete = !provisioning.optionalConfigCompleted.floor_plan;

  // Sync floor plan status - but only if there's actual data
  if (hasFloorPlanData && floorPlanSelected) {
    // Data exists and item is selected - mark as complete in both stores
    if (!floorPlanCompleted) {
      console.log('[StoreSync] Floor plan has data but not marked complete in wizard - marking now');
      await setupWizard.markScreenComplete('floor_plan');
    }
    if (provisioningFloorIncomplete) {
      console.log('[StoreSync] Floor plan has data but not marked complete in provisioning - marking now');
      provisioning.markOptionalComplete('floor_plan');
    }
  } else if (floorPlanCompleted && !hasFloorPlanData) {
    console.warn('[StoreSync] Floor plan marked complete but has no data - un-marking');
    setupWizard.completedScreens.delete('floor_plan');
    await setupWizard.saveToSQLite();
  }

  // Sync other optional items
  const staffCompleted = setupWizard.completedScreens.has('staff_setup');
  const staffSelected = setupWizard.selectedOptionalItems.includes('staff_setup');

  // Validate that staff data actually exists
  const staffStore = useStaffStore.getState();
  const hasStaffData = staffStore.staff.length > 0;

  if (hasStaffData && staffSelected) {
    // Data exists and item is selected - mark as complete in both stores
    if (!staffCompleted) {
      console.log('[StoreSync] Staff has data but not marked complete in wizard - marking now');
      await setupWizard.markScreenComplete('staff_setup');
    }
    if (!provisioning.optionalConfigCompleted.staff) {
      console.log('[StoreSync] Staff has data but not marked complete in provisioning - marking now');
      provisioning.markOptionalComplete('staff');
    }
  } else if (staffCompleted && !hasStaffData) {
    console.warn('[StoreSync] Staff marked complete but has no data - un-marking');
    setupWizard.completedScreens.delete('staff_setup');
    await setupWizard.saveToSQLite();
  }

  const printerCompleted = setupWizard.completedScreens.has('printer_setup');
  const printerSelected = setupWizard.selectedOptionalItems.includes('printer_setup');
  if (printerCompleted && printerSelected && !provisioning.optionalConfigCompleted.printer_settings) {
    console.log('[StoreSync] Printer setup completed in wizard but pending in provisioning - syncing');
    provisioning.markOptionalComplete('printer_settings');
  }

  // Sync menu status
  const menuCompleted = setupWizard.completedScreens.has('menu_setup');
  const menuSelected = setupWizard.selectedOptionalItems.includes('menu_setup');

  // Validate that menu data actually exists
  const menuStore = useMenuStore.getState();
  const hasMenuData = menuStore.items.length > 0;

  if (hasMenuData && menuSelected) {
    // Data exists and item is selected - mark as complete in both stores
    if (!menuCompleted) {
      console.log('[StoreSync] Menu has data but not marked complete in wizard - marking now');
      await setupWizard.markScreenComplete('menu_setup');
    }
    if (!provisioning.optionalConfigCompleted.menu) {
      console.log('[StoreSync] Menu has data but not marked complete in provisioning - marking now');
      provisioning.markOptionalComplete('menu');
    }
  } else if (menuCompleted && !hasMenuData) {
    console.warn('[StoreSync] Menu marked complete but has no data - un-marking');
    setupWizard.completedScreens.delete('menu_setup');
    await setupWizard.saveToSQLite();
  }

  console.log('[StoreSync] Synchronization complete');
}

/**
 * Sync provisioning store to setup wizard (reverse sync)
 * Use if provisioning store is the source of truth
 */
export async function syncProvisioningToSetupWizard(): Promise<void> {
  const setupWizard = useSetupWizardStore.getState();
  const provisioning = useProvisioningStore.getState();

  console.log('[StoreSync] Syncing provisioning to setup wizard...');

  // Sync floor plan - but only if there's actual data
  const floorPlanStore = useFloorPlanStore.getState();
  const hasFloorPlanData = floorPlanStore.sections.length > 0 && floorPlanStore.tables.length > 0;

  if (provisioning.optionalConfigCompleted.floor_plan && hasFloorPlanData && !setupWizard.completedScreens.has('floor_plan')) {
    console.log('[StoreSync] Floor plan completed in provisioning with data - syncing to wizard');
    await setupWizard.markScreenComplete('floor_plan');
  } else if (provisioning.optionalConfigCompleted.floor_plan && !hasFloorPlanData) {
    console.warn('[StoreSync] Floor plan marked complete in provisioning but has no data - un-marking');
    provisioning.markOptionalIncomplete('floor_plan');
  }

  // Sync staff - but only if there's actual data
  const staffStore = useStaffStore.getState();
  const hasStaffData = staffStore.staff.length > 0;

  if (provisioning.optionalConfigCompleted.staff && hasStaffData && !setupWizard.completedScreens.has('staff_setup')) {
    console.log('[StoreSync] Staff completed in provisioning with data - syncing to wizard');
    await setupWizard.markScreenComplete('staff_setup');
  } else if (provisioning.optionalConfigCompleted.staff && !hasStaffData) {
    console.warn('[StoreSync] Staff marked complete in provisioning but has no data - un-marking');
    provisioning.markOptionalIncomplete('staff');
  }

  // Sync printer
  if (provisioning.optionalConfigCompleted.printer_settings && !setupWizard.completedScreens.has('printer_setup')) {
    console.log('[StoreSync] Printer completed in provisioning but pending in wizard - syncing');
    await setupWizard.markScreenComplete('printer_setup');
  }

  // Sync menu - but only if there's actual data
  const menuStore = useMenuStore.getState();
  const hasMenuData = menuStore.items.length > 0;

  if (provisioning.optionalConfigCompleted.menu && hasMenuData && !setupWizard.completedScreens.has('menu_setup')) {
    console.log('[StoreSync] Menu completed in provisioning with data - syncing to wizard');
    await setupWizard.markScreenComplete('menu_setup');
  } else if (provisioning.optionalConfigCompleted.menu && !hasMenuData) {
    console.warn('[StoreSync] Menu marked complete in provisioning but has no data - un-marking');
    provisioning.markOptionalIncomplete('menu');
  }

  console.log('[StoreSync] Reverse synchronization complete');
}

/**
 * Bidirectional sync - syncs both ways
 * Use this on app startup to ensure consistency
 */
export async function syncStoresBidirectional(): Promise<void> {
  console.log('[StoreSync] Starting bidirectional store sync...');

  // First sync wizard to provisioning
  await syncSetupWizardToProvisioning();

  // Then sync provisioning to wizard (in case provisioning has newer data)
  await syncProvisioningToSetupWizard();

  console.log('[StoreSync] Bidirectional sync complete');
}
