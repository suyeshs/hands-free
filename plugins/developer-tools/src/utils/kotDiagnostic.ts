/**
 * KOT Diagnostic Utility
 * Wrapper for core KOT diagnostic functionality
 */

// Import core KOT diagnostic
// TODO: Move core implementation here when refactoring
import * as coreKotDiag from '../../../../src/lib/kotDiagnostic';

export const kotDiagnostic = {
  ...coreKotDiag,

  version: '1.0.0',

  help() {
    console.log('KOT Diagnostic:');
    console.log('  - Run kotDiag() in console for quick check');
    console.log('  - Methods: checkStatus, testPrint, viewQueue');
  }
};
