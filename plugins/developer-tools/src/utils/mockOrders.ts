/**
 * Mock Orders Utility
 * Wrapper for core mock order generation
 */

// Import core mock orders
// TODO: Move core implementation here when refactoring
import * as coreMockOrders from '../../../../src/lib/mockAggregatorOrders';

export const mockOrders = {
  ...coreMockOrders,

  version: '1.0.0',

  help() {
    console.log('Mock Orders:');
    console.log('  - mockOrders.addSwiggy() - Generate Swiggy order');
    console.log('  - mockOrders.addZomato() - Generate Zomato order');
    console.log('  - mockOrders.addBoth() - Generate both');
    console.log('  - mockOrders.clearAll() - Clear all mock orders');
  }
};
