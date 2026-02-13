/**
 * Subscription Menu Import Script
 * Imports subscription plans, cuisine types, and weekly menus from JSON
 */

import { invoke } from '@tauri-apps/api/core';
import subscriptionMenuData from '../../subscription_menu_import.json';

interface ImportResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Generate a unique ID (UUID v4 format)
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current ISO timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current tenant ID from settings
 */
async function getTenantId(): Promise<string> {
  try {
    const settings = await invoke('get_app_settings');
    return (settings as any).tenant_id || 'default-tenant';
  } catch (error) {
    console.error('Failed to get tenant ID:', error);
    return 'default-tenant';
  }
}

/**
 * Import cuisine types
 */
async function importCuisineTypes(tenantId: string): Promise<ImportResult> {
  console.log('Importing cuisine types...');

  try {
    const cuisineTypes = subscriptionMenuData.cuisine_types;
    let imported = 0;

    for (const cuisine of cuisineTypes) {
      const id = generateId();
      const timestamp = getTimestamp();

      await invoke('execute_sql', {
        query: `
          INSERT INTO subscription_cuisine_types
          (id, tenant_id, name, description, icon, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          id,
          tenantId,
          cuisine.name,
          cuisine.description || '',
          cuisine.icon || '',
          cuisine.active ? 1 : 0,
          timestamp,
        ],
      });

      imported++;
      console.log(`✓ Imported cuisine type: ${cuisine.name}`);
    }

    return {
      success: true,
      message: `Imported ${imported} cuisine types`,
      data: { count: imported },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to import cuisine types: ${error}`,
    };
  }
}

/**
 * Import subscription plans
 */
async function importSubscriptionPlans(tenantId: string): Promise<ImportResult> {
  console.log('Importing subscription plans...');

  try {
    const plans = subscriptionMenuData.subscription_plans;
    let imported = 0;

    for (const plan of plans) {
      const id = generateId();
      const timestamp = getTimestamp();

      await invoke('execute_sql', {
        query: `
          INSERT INTO subscription_plans
          (id, tenant_id, name, description, price_per_week, meals_per_week,
           delivery_days, active, cuisine_types, meal_selection_limit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          id,
          tenantId,
          plan.name,
          plan.description || '',
          plan.pricePerWeek,
          plan.mealsPerWeek,
          JSON.stringify(plan.deliveryDays),
          plan.active ? 1 : 0,
          JSON.stringify(plan.cuisineTypes),
          plan.mealSelectionLimit,
          timestamp,
          timestamp,
        ],
      });

      imported++;
      console.log(`✓ Imported plan: ${plan.name}`);
    }

    return {
      success: true,
      message: `Imported ${imported} subscription plans`,
      data: { count: imported },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to import subscription plans: ${error}`,
    };
  }
}

/**
 * Import menu items to standard menu_items table if they don't exist
 */
async function importMenuItems(tenantId: string): Promise<string[]> {
  console.log('Checking and importing menu items...');

  const items = subscriptionMenuData.sample_weekly_menu.items;
  const itemIds: string[] = [];

  for (const item of items) {
    // Check if item already exists by name
    const existing = await invoke('query_sql', {
      query: `SELECT id FROM menu_items WHERE tenant_id = ? AND name = ?`,
      params: [tenantId, item.name],
    });

    let itemId: string;

    if ((existing as any[]).length > 0) {
      itemId = (existing as any[])[0].id;
      console.log(`✓ Menu item already exists: ${item.name}`);
    } else {
      // Create new menu item
      itemId = generateId();
      const timestamp = getTimestamp();

      await invoke('execute_sql', {
        query: `
          INSERT INTO menu_items
          (id, tenant_id, name, category, price, is_vegetarian, is_available, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          itemId,
          tenantId,
          item.name,
          item.category,
          item.price,
          item.isVeg ? 1 : 0,
          1, // available by default
          timestamp,
          timestamp,
        ],
      });

      console.log(`✓ Created menu item: ${item.name}`);
    }

    itemIds.push(itemId);
  }

  return itemIds;
}

/**
 * Import weekly menu
 */
async function importWeeklyMenu(tenantId: string): Promise<ImportResult> {
  console.log('Importing weekly menu...');

  try {
    const weeklyMenu = subscriptionMenuData.sample_weekly_menu;
    const menuWeekId = generateId();
    const timestamp = getTimestamp();

    // Get Monday of the specified week
    const year = weeklyMenu.year;
    const weekNumber = weeklyMenu.weekNumber;
    const startDate = getMonday(year, weekNumber);
    const endDate = getSunday(year, weekNumber);

    // Create weekly menu
    await invoke('execute_sql', {
      query: `
        INSERT INTO subscription_menu_weeks
        (id, tenant_id, week_number, year, cuisine_type, start_date, end_date,
         active, published, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        menuWeekId,
        tenantId,
        weekNumber,
        year,
        weeklyMenu.cuisineType,
        startDate,
        endDate,
        1, // active
        1, // published
        timestamp,
        timestamp,
      ],
    });

    console.log(`✓ Created weekly menu: Week ${weekNumber}, ${year}`);

    // Import menu items
    const menuItemIds = await importMenuItems(tenantId);

    // Link menu items to weekly menu
    for (let i = 0; i < menuItemIds.length; i++) {
      const menuItemId = menuItemIds[i];
      const subscriptionMenuItemId = generateId();

      await invoke('execute_sql', {
        query: `
          INSERT INTO subscription_menu_items
          (id, menu_week_id, menu_item_id, available, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        params: [
          subscriptionMenuItemId,
          menuWeekId,
          menuItemId,
          1, // available
          i + 1, // sort order
          timestamp,
        ],
      });
    }

    console.log(`✓ Linked ${menuItemIds.length} items to weekly menu`);

    return {
      success: true,
      message: `Imported weekly menu with ${menuItemIds.length} items`,
      data: { weekId: menuWeekId, itemCount: menuItemIds.length },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to import weekly menu: ${error}`,
    };
  }
}

/**
 * Get Monday of a specific ISO week
 */
function getMonday(year: number, week: number): string {
  const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
  const days = (week - 1) * 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4.getDay() + 1 + days); // Monday
  return monday.toISOString().split('T')[0];
}

/**
 * Get Sunday of a specific ISO week
 */
function getSunday(year: number, week: number): string {
  const monday = getMonday(year, week);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return sunday.toISOString().split('T')[0];
}

/**
 * Main import function
 */
export async function importSubscriptionMenuData(): Promise<{
  success: boolean;
  results: ImportResult[];
}> {
  console.log('=== Starting Subscription Menu Import ===\n');

  const tenantId = await getTenantId();
  console.log(`Tenant ID: ${tenantId}\n`);

  const results: ImportResult[] = [];

  // Import cuisine types
  const cuisineResult = await importCuisineTypes(tenantId);
  results.push(cuisineResult);
  console.log(`${cuisineResult.message}\n`);

  // Import subscription plans
  const plansResult = await importSubscriptionPlans(tenantId);
  results.push(plansResult);
  console.log(`${plansResult.message}\n`);

  // Import weekly menu
  const menuResult = await importWeeklyMenu(tenantId);
  results.push(menuResult);
  console.log(`${menuResult.message}\n`);

  const allSuccess = results.every((r) => r.success);

  console.log('=== Import Complete ===');
  console.log(`Success: ${allSuccess ? 'YES' : 'NO'}`);
  console.log(`Total operations: ${results.length}`);
  console.log(
    `Successful: ${results.filter((r) => r.success).length}`
  );
  console.log(`Failed: ${results.filter((r) => !r.success).length}`);

  return {
    success: allSuccess,
    results,
  };
}

// Export individual functions for use in components
export {
  importCuisineTypes,
  importSubscriptionPlans,
  importWeeklyMenu,
  getTenantId,
};
