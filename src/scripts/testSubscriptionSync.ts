/**
 * Test Subscription Sync
 * Verify that data syncs from local SQLite to cloud D1
 */

import { invoke } from '@tauri-apps/api/core';

interface SyncTestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const WORKER_URL = 'https://restaurant.guanix.com/api';

/**
 * Get tenant ID from settings
 */
async function getTenantId(): Promise<string> {
  const settingsPath = await invoke<string>('get_settings_path');
  const settings = await invoke<any>('read_json_file', { path: settingsPath });
  return settings.tenantId || 'test-tenant';
}

/**
 * Get database path
 */
async function getDatabaseFilePath(): Promise<string> {
  return await invoke<string>('get_database_path');
}

/**
 * Test subscription sync end-to-end
 */
export async function testSubscriptionSync(): Promise<SyncTestResult[]> {
  const results: SyncTestResult[] = [];

  try {
    const tenantId = await getTenantId();
    const dbPath = await getDatabaseFilePath();

    console.log('🧪 Starting Subscription Sync Test');
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Database: ${dbPath}\n`);

    // Step 1: Check local data exists
    console.log('Step 1: Checking local data...');
    try {
      const plans = await invoke<any[]>('query_sqlite', {
        dbPath,
        query: 'SELECT COUNT(*) as count FROM subscription_plans WHERE tenant_id = ?',
        params: [tenantId],
      });

      const planCount = plans[0]?.count || 0;

      if (planCount === 0) {
        results.push({
          step: 'Local Data Check',
          success: false,
          message: 'No subscription plans found in local database. Import menu first.',
        });
        return results;
      }

      results.push({
        step: 'Local Data Check',
        success: true,
        message: `Found ${planCount} subscription plans in local database`,
        data: { planCount },
      });
    } catch (err) {
      results.push({
        step: 'Local Data Check',
        success: false,
        message: `Failed to query local database: ${err}`,
      });
      return results;
    }

    // Step 2: Fetch local subscription plans
    console.log('\nStep 2: Fetching local subscription plans...');
    let localPlans: any[] = [];
    try {
      localPlans = await invoke<any[]>('query_sqlite', {
        dbPath,
        query: 'SELECT * FROM subscription_plans WHERE tenant_id = ?',
        params: [tenantId],
      });

      results.push({
        step: 'Fetch Local Plans',
        success: true,
        message: `Retrieved ${localPlans.length} plans from local database`,
        data: { plans: localPlans.map(p => ({ id: p.id, name: p.name })) },
      });
    } catch (err) {
      results.push({
        step: 'Fetch Local Plans',
        success: false,
        message: `Failed to fetch local plans: ${err}`,
      });
      return results;
    }

    // Step 3: Test cloud API connectivity
    console.log('\nStep 3: Testing cloud API connectivity...');
    try {
      const response = await fetch(`${WORKER_URL}/subscriptions/plans`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          step: 'Cloud API Connectivity',
          success: true,
          message: `Cloud API is reachable. Found ${data.plans?.length || 0} plans in cloud`,
          data: { cloudPlans: data.plans?.length || 0 },
        });
      } else {
        const error = await response.text();
        results.push({
          step: 'Cloud API Connectivity',
          success: false,
          message: `Cloud API returned ${response.status}: ${error}`,
        });
      }
    } catch (err) {
      results.push({
        step: 'Cloud API Connectivity',
        success: false,
        message: `Failed to connect to cloud API: ${err}`,
      });
      return results;
    }

    // Step 4: Sync subscription plans to cloud
    console.log('\nStep 4: Syncing subscription plans to cloud...');
    try {
      // Transform to camelCase for API
      const plansData = localPlans.map((plan) => ({
        id: plan.id,
        tenantId: plan.tenant_id,
        name: plan.name,
        description: plan.description,
        pricePerWeek: plan.price_per_week,
        mealsPerWeek: plan.meals_per_week,
        deliveryDays: plan.delivery_days,
        active: plan.active,
        cuisineTypes: plan.cuisine_types,
        mealSelectionLimit: plan.meal_selection_limit,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      }));

      const response = await fetch(`${WORKER_URL}/subscriptions/plans/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({ plans: plansData }),
      });

      if (response.ok) {
        const result = await response.json();
        results.push({
          step: 'Sync Plans to Cloud',
          success: result.success,
          message: `Synced ${result.synced} plans, ${result.failed} failed`,
          data: { synced: result.synced, failed: result.failed, errors: result.errors },
        });
      } else {
        const error = await response.text();
        results.push({
          step: 'Sync Plans to Cloud',
          success: false,
          message: `Sync failed with ${response.status}: ${error}`,
        });
        return results;
      }
    } catch (err) {
      results.push({
        step: 'Sync Plans to Cloud',
        success: false,
        message: `Failed to sync plans: ${err}`,
      });
      return results;
    }

    // Step 5: Verify data in cloud D1
    console.log('\nStep 5: Verifying data in cloud D1...');
    try {
      const response = await fetch(`${WORKER_URL}/subscriptions/plans`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const cloudPlans = data.plans || [];

        // Compare with local data
        const localIds = new Set(localPlans.map(p => p.id));
        const cloudIds = new Set(cloudPlans.map((p: any) => p.id));

        const allSynced = localPlans.every(p => cloudIds.has(p.id));

        results.push({
          step: 'Verify Cloud D1 Data',
          success: allSynced,
          message: allSynced
            ? `✅ All ${localPlans.length} local plans are synced to cloud D1`
            : `⚠️ Some plans missing in cloud. Local: ${localIds.size}, Cloud: ${cloudIds.size}`,
          data: {
            localCount: localIds.size,
            cloudCount: cloudIds.size,
            cloudPlans: cloudPlans.map((p: any) => ({ id: p.id, name: p.name })),
          },
        });
      } else {
        results.push({
          step: 'Verify Cloud D1 Data',
          success: false,
          message: `Failed to verify cloud data: ${response.status}`,
        });
      }
    } catch (err) {
      results.push({
        step: 'Verify Cloud D1 Data',
        success: false,
        message: `Failed to verify cloud data: ${err}`,
      });
    }

    // Step 6: Test cuisine types sync
    console.log('\nStep 6: Testing cuisine types sync...');
    try {
      const cuisineTypes = await invoke<any[]>('query_sqlite', {
        dbPath,
        query: 'SELECT * FROM subscription_cuisine_types WHERE tenant_id = ?',
        params: [tenantId],
      });

      if (cuisineTypes.length > 0) {
        const cuisineTypesData = cuisineTypes.map((ct) => ({
          id: ct.id,
          tenantId: ct.tenant_id,
          name: ct.name,
          description: ct.description,
          icon: ct.icon,
          active: ct.active,
          createdAt: ct.created_at,
        }));

        const response = await fetch(`${WORKER_URL}/subscriptions/cuisine-types/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId,
          },
          body: JSON.stringify({ cuisineTypes: cuisineTypesData }),
        });

        if (response.ok) {
          const result = await response.json();
          results.push({
            step: 'Sync Cuisine Types',
            success: result.success,
            message: `Synced ${result.synced} cuisine types`,
            data: { synced: result.synced },
          });
        } else {
          results.push({
            step: 'Sync Cuisine Types',
            success: false,
            message: `Failed to sync cuisine types: ${response.status}`,
          });
        }
      } else {
        results.push({
          step: 'Sync Cuisine Types',
          success: true,
          message: 'No cuisine types to sync',
        });
      }
    } catch (err) {
      results.push({
        step: 'Sync Cuisine Types',
        success: false,
        message: `Failed to sync cuisine types: ${err}`,
      });
    }

    console.log('\n✅ Sync test complete!');
    return results;

  } catch (error) {
    console.error('Fatal error during sync test:', error);
    results.push({
      step: 'Fatal Error',
      success: false,
      message: `Fatal error: ${error}`,
    });
    return results;
  }
}

/**
 * Display test results in console
 */
export function displaySyncTestResults(results: SyncTestResult[]) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('         SUBSCRIPTION SYNC TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');

  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} Step ${index + 1}: ${result.step}`);
    console.log(`   ${result.message}`);
    if (result.data) {
      console.log(`   Data:`, result.data);
    }
    console.log('');
  });

  const allSuccess = results.every(r => r.success);
  console.log('═══════════════════════════════════════════════════════');
  if (allSuccess) {
    console.log('✅✅✅ ALL TESTS PASSED ✅✅✅');
  } else {
    console.log('❌ SOME TESTS FAILED - Review errors above');
  }
  console.log('═══════════════════════════════════════════════════════\n');
}
