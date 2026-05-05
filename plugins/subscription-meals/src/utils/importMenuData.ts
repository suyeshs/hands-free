/**
 * Menu Data Import Utility
 *
 * Imports subscription plans, cuisine types, and menu items
 * from the subscription_menu_import.json file into the database.
 */

import { initDatabase } from '../../../../src/lib/database';

interface ImportData {
  subscription_plans: Array<{
    name: string;
    description: string;
    pricePerWeek: number;
    mealsPerWeek: number;
    deliveryDays: string[];
    cuisineTypes: string[];
    mealSelectionLimit: number;
    active: boolean;
  }>;
  cuisine_types: Array<{
    name: string;
    description: string;
    icon: string;
    active: boolean;
  }>;
  tower_configuration: {
    towers: Array<{
      towerNumber: string;
      name: string;
      distanceFromKitchen: number;
      floors: number;
      apartmentsPerFloor: number;
    }>;
  };
}

/**
 * Generate unique ID
 */
function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Import subscription plans
 */
export async function importSubscriptionPlans(
  tenantId: string,
  plans: ImportData['subscription_plans']
): Promise<void> {
  const db = await initDatabase();

  console.log(`📦 Importing ${plans.length} subscription plans...`);

  for (const plan of plans) {
    const now = new Date().toISOString();
    const id = generateId('plan-');

    await db.execute(
      `INSERT INTO subscription_plans (
        id, tenant_id, name, description, price_per_week, meals_per_week,
        delivery_days, active, cuisine_types, meal_selection_limit,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        plan.name,
        plan.description,
        plan.pricePerWeek,
        plan.mealsPerWeek,
        JSON.stringify(plan.deliveryDays),
        plan.active ? 1 : 0,
        JSON.stringify(plan.cuisineTypes),
        plan.mealSelectionLimit,
        now,
        now,
      ]
    );

    console.log(`  ✅ ${plan.name}`);
  }

  console.log('✅ Subscription plans imported successfully');
}

/**
 * Import cuisine types
 */
export async function importCuisineTypes(
  tenantId: string,
  cuisineTypes: ImportData['cuisine_types']
): Promise<void> {
  const db = await initDatabase();

  console.log(`🍽️  Importing ${cuisineTypes.length} cuisine types...`);

  for (const cuisine of cuisineTypes) {
    const now = new Date().toISOString();
    const id = generateId('cuisine-');

    await db.execute(
      `INSERT INTO subscription_cuisine_types (
        id, tenant_id, name, description, icon, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        cuisine.name,
        cuisine.description,
        cuisine.icon,
        cuisine.active ? 1 : 0,
        now,
      ]
    );

    console.log(`  ✅ ${cuisine.icon} ${cuisine.name}`);
  }

  console.log('✅ Cuisine types imported successfully');
}

/**
 * Import complete menu data
 */
export async function importMenuData(
  tenantId: string,
  importDataPath: string = '/Users/stonepot-tech/projects/restaurant-pos-ai/subscription_menu_import.json'
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('📥 Starting menu data import...');
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Data file: ${importDataPath}`);

    // In a real implementation, you would fetch this data
    // For now, this is a placeholder that expects the data to be loaded
    const response = await fetch(importDataPath);
    const data: ImportData = await response.json();

    // Import plans
    await importSubscriptionPlans(tenantId, data.subscription_plans);

    // Import cuisine types
    await importCuisineTypes(tenantId, data.cuisine_types);

    console.log('✅ All data imported successfully!');

    return {
      success: true,
      message: `Imported ${data.subscription_plans.length} plans and ${data.cuisine_types.length} cuisine types`,
    };
  } catch (error) {
    console.error('❌ Import failed:', error);
    return {
      success: false,
      message: `Import failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Get tower distance for delivery planning
 */
export function getTowerDistance(towerNumber: string): number {
  const towerDistances: Record<string, number> = {
    'A': 50,
    'B': 120,
    'C': 200,
    'D': 180,
    'E': 250,
    'F': 300,
    'G': 280,
    'H': 350,
  };

  return towerDistances[towerNumber.toUpperCase()] || 200; // Default 200m
}

/**
 * Calculate delivery time based on distance
 */
export function estimateDeliveryTime(distanceInMeters: number): number {
  // Assume 2 minutes per 100 meters + 5 minutes prep time
  const travelTime = Math.ceil(distanceInMeters / 100) * 2;
  return travelTime + 5; // minutes
}

/**
 * Validate tower and apartment number
 */
export function validateAddress(
  towerNumber: string,
  apartmentNumber: string
): { valid: boolean; error?: string } {
  // Tower must be A-H
  if (!['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(towerNumber.toUpperCase())) {
    return {
      valid: false,
      error: 'Tower must be between A and H',
    };
  }

  // Apartment number should be numeric
  const aptNum = parseInt(apartmentNumber);
  if (isNaN(aptNum) || aptNum < 1 || aptNum > 2000) {
    return {
      valid: false,
      error: 'Apartment number must be between 1 and 2000',
    };
  }

  return { valid: true };
}

/**
 * Get floor number from apartment number
 * Assuming 10 apartments per floor, format: Floor + Unit (e.g., 101, 205)
 */
export function getFloorFromApartment(apartmentNumber: string): string {
  const aptNum = parseInt(apartmentNumber);
  if (isNaN(aptNum)) return '';

  // If 3 digits (e.g., 101), first digit is floor
  if (apartmentNumber.length === 3) {
    return apartmentNumber[0];
  }

  // If 4 digits (e.g., 1501), first two digits are floor
  if (apartmentNumber.length === 4) {
    return apartmentNumber.substring(0, 2);
  }

  // Default: divide by 100 and floor
  return Math.floor(aptNum / 100).toString();
}
