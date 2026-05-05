/**
 * KDS Debug Utilities
 * Wrapper for core KDS debugging functionality
 */

// Import core KDS debug utils
// TODO: Move core implementation here when refactoring
import * as coreKdsDebug from '../../../../src/lib/kdsDebugUtils';

export const kdsDebugUtils = {
  ...coreKdsDebug,

  // Additional plugin-specific utilities can be added here
  version: '1.0.0',

  help() {
    console.log('KDS Debug Utilities:');
    console.log('  - Use window.kdsDebug in console');
    console.log('  - Available methods: getOrders, getStats, simulateOrder, clearOrders');
  }
};
