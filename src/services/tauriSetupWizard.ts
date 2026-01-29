/**
 * Tauri Setup Wizard Service
 * Calls Rust commands to save/load setup wizard state from SQLite
 * This replaces localStorage to eliminate race conditions with page reloads
 */

import { invoke } from '@tauri-apps/api/core';
import type { SetupScreen, OptionalSetupItem } from '../stores/setupWizardStore';

/**
 * Interface matching the Rust struct (camelCase from serde)
 */
interface SetupWizardStateDb {
  currentScreen: string;
  completedScreens: string; // JSON array
  skippedScreens: string;   // JSON array
  selectedOptionalItems: string; // JSON array
  wizardData: string;       // JSON object
  isComplete: boolean;
  startedAt: string | null;
  completedAt: string | null;
  awaitingActivation: boolean;
  activationCode: string | null;
  provisioningWebSocketUrl: string | null;
  isRestaurantOwner: boolean;
  checklistDismissed: boolean;
}

/**
 * TypeScript representation of wizard state (structured)
 */
export interface SetupWizardState {
  currentScreen: SetupScreen;
  completedScreens: Set<SetupScreen>;
  skippedScreens: Set<SetupScreen>;
  selectedOptionalItems: OptionalSetupItem[];
  wizardData: any; // Keep as any to match store
  isComplete: boolean;
  startedAt: string | null;
  completedAt: string | null;
  awaitingActivation: boolean;
  activationCode: string | null;
  provisioningWebSocketUrl: string | null;
  isRestaurantOwner: boolean;
  checklistDismissed: boolean;
}

/**
 * Get setup wizard state from SQLite (Tauri backend)
 */
export async function getSetupWizardState(): Promise<SetupWizardState> {
  try {
    console.log('[TauriSetupWizard] Getting wizard state from SQLite...');
    const dbState = await invoke<SetupWizardStateDb>('get_setup_wizard_state');

    // Parse JSON strings to structured data
    const state: SetupWizardState = {
      currentScreen: dbState.currentScreen as SetupScreen,
      completedScreens: new Set(JSON.parse(dbState.completedScreens)),
      skippedScreens: new Set(JSON.parse(dbState.skippedScreens)),
      selectedOptionalItems: JSON.parse(dbState.selectedOptionalItems),
      wizardData: JSON.parse(dbState.wizardData),
      isComplete: dbState.isComplete,
      startedAt: dbState.startedAt,
      completedAt: dbState.completedAt,
      awaitingActivation: dbState.awaitingActivation,
      activationCode: dbState.activationCode,
      provisioningWebSocketUrl: dbState.provisioningWebSocketUrl,
      isRestaurantOwner: dbState.isRestaurantOwner,
      checklistDismissed: dbState.checklistDismissed,
    };

    console.log('[TauriSetupWizard] ✅ Wizard state loaded from SQLite');
    return state;
  } catch (error) {
    console.error('[TauriSetupWizard] Failed to get wizard state from SQLite:', error);
    throw error;
  }
}

/**
 * Save setup wizard state to SQLite (Tauri backend)
 */
export async function saveSetupWizardState(state: SetupWizardState): Promise<void> {
  try {
    console.log('[TauriSetupWizard] ===== SAVING WIZARD STATE TO SQLITE =====');
    console.log('[TauriSetupWizard] Current screen:', state.currentScreen);
    console.log('[TauriSetupWizard] Is complete:', state.isComplete);
    console.log('[TauriSetupWizard] Awaiting activation:', state.awaitingActivation);

    // Convert structured data to JSON strings for database
    const dbState: SetupWizardStateDb = {
      currentScreen: state.currentScreen,
      completedScreens: JSON.stringify(Array.from(state.completedScreens)),
      skippedScreens: JSON.stringify(Array.from(state.skippedScreens)),
      selectedOptionalItems: JSON.stringify(state.selectedOptionalItems),
      wizardData: JSON.stringify(state.wizardData),
      isComplete: state.isComplete,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      awaitingActivation: state.awaitingActivation,
      activationCode: state.activationCode,
      provisioningWebSocketUrl: state.provisioningWebSocketUrl,
      isRestaurantOwner: state.isRestaurantOwner,
      checklistDismissed: state.checklistDismissed,
    };

    console.log('[TauriSetupWizard] Calling Rust command save_setup_wizard_state...');
    await invoke('save_setup_wizard_state', { state: dbState });
    console.log('[TauriSetupWizard] ✅ Wizard state saved to SQLite successfully');
  } catch (error: any) {
    console.error('[TauriSetupWizard] ❌ Failed to save wizard state to SQLite:', error);
    console.error('[TauriSetupWizard] Error message:', error?.message || 'Unknown error');
    console.error('[TauriSetupWizard] Error details:', error);
    throw error;
  }
}

/**
 * Reset wizard state to defaults (for testing or re-setup)
 */
export async function resetSetupWizardState(): Promise<void> {
  try {
    console.log('[TauriSetupWizard] Resetting wizard state...');
    await invoke('reset_setup_wizard_state');
    console.log('[TauriSetupWizard] ✅ Wizard state reset successfully');
  } catch (error) {
    console.error('[TauriSetupWizard] Failed to reset wizard state:', error);
    throw error;
  }
}

/**
 * Clean up stale provisioning WebSocket URL if provisioning is complete
 * Returns true if cleanup was performed, false if nothing to clean
 */
export async function cleanupProvisioningWebSocket(): Promise<boolean> {
  try {
    const cleaned = await invoke<boolean>('cleanup_provisioning_websocket');
    if (cleaned) {
      console.log('[TauriSetupWizard] ✅ Cleaned up stale provisioning WebSocket URL');
    }
    return cleaned;
  } catch (error) {
    console.error('[TauriSetupWizard] Failed to cleanup provisioning WebSocket:', error);
    throw error;
  }
}
