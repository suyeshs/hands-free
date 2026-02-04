/**
 * D1 Sync Test Page
 * Quick testing utility for D1 synchronization without going through full POS flow
 * Generates mock data and triggers sync manually
 */

import { useState } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { createD1SyncService } from '../services/sync/D1SyncService';
import { useTenantStore } from '../stores/tenantStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, Database as DatabaseIcon, RefreshCw } from 'lucide-react';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

interface TestResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
}

export default function D1SyncTestPage() {
  const { tenant } = useTenantStore();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (step: string, status: TestResult['status'], message?: string, data?: any) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.step === step);
      if (existing) {
        return prev.map(r => r.step === step ? { step, status, message, data } : r);
      }
      return [...prev, { step, status, message, data }];
    });
  };

  const generateMockSales = async (count: number = 5) => {
    if (!tenant?.tenantId) {
      throw new Error('No tenant ID found');
    }

    updateResult('mock_sales', 'running', `Generating ${count} mock sales...`);

    const db = await Database.load(DB_NAME);
    const sales = [];

    for (let i = 0; i < count; i++) {
      const id = `test-sale-${Date.now()}-${i}`;
      const invoiceNumber = `TEST-INV-${Date.now()}-${i}`;
      const orderNumber = `ORD-${Date.now()}-${i}`;
      const subtotal = Math.floor(Math.random() * 1000) + 200;
      const tax = subtotal * 0.05;
      const grandTotal = subtotal + tax;

      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO sales_transactions (
          id, tenant_id, invoice_number, order_number, order_type, table_number,
          source, subtotal, service_charge, cgst, sgst, discount, round_off,
          grand_total, payment_method, payment_status, items_json, cashier_name,
          staff_id, created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          id,
          tenant.tenantId,
          invoiceNumber,
          orderNumber,
          'dine-in',
          Math.floor(Math.random() * 20) + 1,
          'pos',
          subtotal,
          0,
          tax / 2,
          tax / 2,
          0,
          0,
          grandTotal,
          ['cash', 'card', 'upi'][Math.floor(Math.random() * 3)],
          'completed',
          JSON.stringify([
            {
              id: `item-${i}`,
              menuItem: { name: `Test Item ${i}`, price: subtotal, category: 'Test' },
              quantity: 1,
              subtotal: subtotal,
            }
          ]),
          'Test Cashier',
          'test-staff-001',
          now,
          now,
        ]
      );

      sales.push({ id, invoiceNumber, grandTotal });
    }

    updateResult('mock_sales', 'success', `Created ${count} mock sales`, sales);
    return sales;
  };

  const generateMockAggregatorOrders = async (count: number = 3) => {
    if (!tenant?.tenantId) {
      throw new Error('No tenant ID found');
    }

    updateResult('mock_aggregator', 'running', `Generating ${count} mock aggregator orders...`);

    const db = await Database.load(DB_NAME);
    const orders = [];
    const aggregators = ['swiggy', 'zomato'];

    for (let i = 0; i < count; i++) {
      const id = `test-agg-${Date.now()}-${i}`;
      const orderNumber = `AGG-${Date.now()}-${i}`;
      const aggregator = aggregators[Math.floor(Math.random() * aggregators.length)];
      const subtotal = Math.floor(Math.random() * 800) + 300;
      const tax = subtotal * 0.05;
      const total = subtotal + tax;

      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO aggregator_orders (
          id, order_id, order_number, aggregator, status, order_type,
          customer_name, customer_phone, items_json, subtotal, tax, discount,
          total, payment_method, payment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          id,
          `ext-${Date.now()}-${i}`,
          orderNumber,
          aggregator,
          'delivered',
          'delivery',
          `Test Customer ${i}`,
          `9876543${String(i).padStart(3, '0')}`,
          JSON.stringify([
            {
              id: `agg-item-${i}`,
              name: `Aggregator Item ${i}`,
              quantity: Math.floor(Math.random() * 3) + 1,
              price: Math.floor(subtotal / 2),
            }
          ]),
          subtotal,
          tax,
          0,
          total,
          'online',
          'paid',
          now,
          now,
        ]
      );

      orders.push({ id, orderNumber, aggregator, total });
    }

    updateResult('mock_aggregator', 'success', `Created ${count} aggregator orders`, orders);
    return orders;
  };

  const testSalesSync = async () => {
    if (!tenant?.tenantId) {
      throw new Error('No tenant ID found');
    }

    updateResult('sync_sales', 'running', 'Syncing sales to D1...');

    const d1Sync = createD1SyncService(tenant.tenantId);
    const result = await d1Sync.syncSalesToD1();

    if (result.errors.length > 0) {
      updateResult('sync_sales', 'error', `Sync completed with errors`, result);
    } else {
      updateResult('sync_sales', 'success', `Synced ${result.synced} sales`, result);
    }

    return result;
  };

  const checkSyncStatus = async () => {
    if (!tenant?.tenantId) {
      throw new Error('No tenant ID found');
    }

    updateResult('sync_status', 'running', 'Checking D1 sync status...');

    const d1Sync = createD1SyncService(tenant.tenantId);
    const statuses = await d1Sync.getSyncStatus();

    updateResult('sync_status', 'success', 'Retrieved sync status', statuses);
    return statuses;
  };

  const checkLocalData = async () => {
    updateResult('local_data', 'running', 'Checking local database...');

    const db = await Database.load(DB_NAME);

    const salesCount = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM sales_transactions WHERE tenant_id = $1`,
      [tenant?.tenantId]
    );

    const aggCount = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM aggregator_orders`
    );

    const recentSales = await db.select(
      `SELECT invoice_number, grand_total, completed_at
       FROM sales_transactions
       WHERE tenant_id = $1
       ORDER BY completed_at DESC
       LIMIT 5`,
      [tenant?.tenantId]
    );

    const data = {
      salesCount: salesCount[0]?.count || 0,
      aggregatorCount: aggCount[0]?.count || 0,
      recentSales,
    };

    updateResult('local_data', 'success', 'Local data retrieved', data);
    return data;
  };

  const runFullTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Step 1: Check local data
      await checkLocalData();

      // Step 2: Generate mock sales
      await generateMockSales(5);

      // Step 3: Generate mock aggregator orders
      await generateMockAggregatorOrders(3);

      // Step 4: Test sales sync
      await testSalesSync();

      // Step 5: Check sync status
      await checkSyncStatus();

      // Step 6: Check local data again
      await checkLocalData();

    } catch (error) {
      updateResult('error', 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunning(false);
    }
  };

  const clearTestData = async () => {
    if (!confirm('Clear all test data (sales with TEST- prefix and test-* IDs)?')) {
      return;
    }

    try {
      const db = await Database.load(DB_NAME);

      await db.execute(
        `DELETE FROM sales_transactions WHERE id LIKE 'test-sale-%' OR invoice_number LIKE 'TEST-INV-%'`
      );

      await db.execute(
        `DELETE FROM aggregator_orders WHERE id LIKE 'test-agg-%'`
      );

      alert('Test data cleared!');
      setTestResults([]);

    } catch (error) {
      alert(`Error clearing test data: ${error}`);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  if (!tenant?.tenantId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>D1 Sync Test</CardTitle>
            <CardDescription>No tenant found. Please complete setup first.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseIcon className="w-6 h-6" />
            D1 Sync Test Utility
          </CardTitle>
          <CardDescription>
            Test D1 synchronization with mock data. Tenant: {tenant.tenantId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={runFullTest}
              disabled={isRunning}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Run Full Test
                </>
              )}
            </Button>

            <Button
              onClick={() => generateMockSales(5)}
              disabled={isRunning}
              variant="outline"
            >
              Generate Mock Sales
            </Button>

            <Button
              onClick={() => generateMockAggregatorOrders(3)}
              disabled={isRunning}
              variant="outline"
            >
              Generate Mock Aggregator Orders
            </Button>

            <Button
              onClick={testSalesSync}
              disabled={isRunning}
              variant="outline"
            >
              Test Sync
            </Button>

            <Button
              onClick={checkLocalData}
              disabled={isRunning}
              variant="outline"
            >
              Check Local Data
            </Button>

            <Button
              onClick={checkSyncStatus}
              disabled={isRunning}
              variant="outline"
            >
              Check Sync Status
            </Button>

            <Button
              onClick={clearTestData}
              disabled={isRunning}
              variant="destructive"
            >
              Clear Test Data
            </Button>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            <strong>Quick Test:</strong> Click "Run Full Test" to generate mock data and test the sync pipeline.
            This creates test sales/orders, syncs to D1, and verifies the results.
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded border"
                >
                  <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">
                      {result.step.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    {result.message && (
                      <div className="text-sm text-gray-600 mt-1">
                        {result.message}
                      </div>
                    )}
                    {result.data && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer">
                          View Details
                        </summary>
                        <pre className="text-xs bg-white p-2 rounded mt-2 overflow-auto max-h-64">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>1. Run Full Test:</strong> Generates mock sales and aggregator orders,
            then syncs to D1 and shows results.
          </div>
          <div>
            <strong>2. Individual Tests:</strong> Use individual buttons to test specific
            parts of the sync pipeline.
          </div>
          <div>
            <strong>3. Verify Results:</strong> Check the test results card for detailed
            information about each step.
          </div>
          <div>
            <strong>4. Clean Up:</strong> Use "Clear Test Data" to remove all test records
            from the local database.
          </div>
          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
            <strong>Note:</strong> Test data is prefixed with "TEST-" or "test-" to distinguish
            it from real data. All test records can be safely deleted.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
