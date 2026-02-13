/**
 * Activation Code Utility
 * Wrapper for core activation code helper
 */

// Import core activation code helper
// TODO: Move core implementation here when refactoring
import * as coreActivation from '../../../../src/lib/getActivationCode';

export const getActivationCode = {
  ...coreActivation,

  version: '1.0.0',

  help() {
    console.log('Activation Code Helper:');
    console.log('  - Run getActivationCode() to view current code');
  }
};
