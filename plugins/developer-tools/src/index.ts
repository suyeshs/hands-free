/**
 * Developer Tools Plugin
 * Debug utilities, telemetry, and diagnostic tools
 */

import { kdsDebugUtils } from './utils/kdsDebugUtils';
import { kotDiagnostic } from './utils/kotDiagnostic';
import { getActivationCode } from './utils/getActivationCode';
import { mockOrders } from './utils/mockOrders';
import { telemetryCollector } from './telemetry/collector';

interface PluginContext {
  enabled: boolean;
  settings: Record<string, any>;
}

let initialized = false;

/**
 * Plugin initialization
 * Called when plugin is loaded
 */
export function init(context: PluginContext) {
  if (initialized) {
    console.warn('[DeveloperTools] Already initialized');
    return;
  }

  console.log('[DeveloperTools] 🔧 Initializing developer tools plugin');

  // Only attach to window if console debug is enabled
  if (context.settings?.enable_console_debug !== false) {
    // Attach debug utilities to window
    (window as any).kdsDebug = kdsDebugUtils;
    (window as any).kotDiag = kotDiagnostic;
    (window as any).getActivationCode = getActivationCode;

    if (context.settings?.mock_orders_enabled !== false) {
      (window as any).mockOrders = mockOrders;
    }

    console.log('[DeveloperTools] ✅ Debug utilities available:');
    console.log('  - window.kdsDebug: KDS debugging tools');
    console.log('  - window.kotDiag(): KOT diagnostic');
    console.log('  - window.getActivationCode(): View activation code');
    if (context.settings?.mock_orders_enabled !== false) {
      console.log('  - window.mockOrders: Mock order generation');
    }
  }

  // Initialize telemetry if enabled
  if (context.settings?.enable_telemetry !== false) {
    telemetryCollector.init({
      collectErrors: true,
      collectPerformance: context.settings?.performance_monitoring === true,
      retentionDays: 30,
    });
    console.log('[DeveloperTools] 📊 Telemetry collection enabled');
  }

  initialized = true;
}

/**
 * Plugin cleanup
 * Called when plugin is disabled or unloaded
 */
export function cleanup() {
  if (!initialized) return;

  console.log('[DeveloperTools] Cleaning up debug utilities');

  // Remove window globals
  delete (window as any).kdsDebug;
  delete (window as any).kotDiag;
  delete (window as any).getActivationCode;
  delete (window as any).mockOrders;

  // Stop telemetry
  telemetryCollector.stop();

  initialized = false;
}

// Export utilities for direct import if needed
export { kdsDebugUtils, kotDiagnostic, getActivationCode, mockOrders, telemetryCollector };
