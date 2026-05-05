/**
 * Subscription Menu Import Script - From Menu Structure MD
 * Imports comprehensive menu (150+ items) from subscription_menu_structure.md
 * Handles BOTH subscription and a la carte menus
 */

import { invoke } from '@tauri-apps/api/core';
import { getDatabaseFilePath } from '../lib/database';

// Generate UUID v4
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get current timestamp
function getTimestamp(): string {
  return new Date().toISOString();
}

// Get tenant ID
async function getTenantId(): Promise<string> {
  try {
    const settings = await invoke('get_app_settings');
    return (settings as any).tenant_id || 'default-tenant';
  } catch {
    return 'default-tenant';
  }
}

/**
 * Complete menu data structure from MD file
 */
const MENU_DATA = {
  // Subscription plans
  plans: [
    {
      name: '5-Day Weekday Plan',
      description: 'Monday to Friday lunch and/or dinner subscription for 1 week',
      pricePerWeek: 2000,
      mealsPerWeek: 5,
      deliveryDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      cuisineTypes: ['north_indian', 'south_indian', 'chinese', 'continental', 'childrens_menu'],
      mealSelectionLimit: 5,
      active: true,
    },
    {
      name: '10-Day Weekday Plan',
      description: 'Monday to Friday lunch and/or dinner subscription for 2 weeks',
      pricePerWeek: 1900,
      mealsPerWeek: 10,
      deliveryDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      cuisineTypes: ['north_indian', 'south_indian', 'chinese', 'continental', 'childrens_menu'],
      mealSelectionLimit: 10,
      active: true,
    },
    {
      name: '20-Day Weekday Plan',
      description: 'Monday to Friday lunch and/or dinner subscription for 4 weeks',
      pricePerWeek: 1800,
      mealsPerWeek: 20,
      deliveryDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      cuisineTypes: ['north_indian', 'south_indian', 'chinese', 'continental', 'childrens_menu'],
      mealSelectionLimit: 20,
      active: true,
    },
  ],

  // Cuisine types
  cuisineTypes: [
    { name: 'North Indian', description: 'Traditional North Indian cuisine with biryani, curries, and breads', icon: '🍛', active: true },
    { name: 'South Indian', description: 'Authentic South Indian breakfast and meals', icon: '🥘', active: true },
    { name: 'Chinese', description: 'Indo-Chinese fusion with noodles, rice, and stir-fry', icon: '🥢', active: true },
    { name: 'Continental', description: 'Western cuisine with pasta, steaks, and sizzlers', icon: '🍝', active: true },
    { name: "Children's Menu", description: 'Kid-friendly pizzas, burgers, and desserts', icon: '🍕', active: true },
  ],

  // All menu items organized by category
  menuItems: [
    // BREAKFAST - DAILY (6:30 AM - 11:00 AM)
    { name: 'French Toast', category: 'Breakfast', price: 100, isVeg: true },
    { name: 'Pancakes', category: 'Breakfast', price: 100, isVeg: true },
    { name: 'Waffles', category: 'Breakfast', price: 200, isVeg: true },
    { name: 'Veggie Club Sandwich', category: 'Breakfast', price: 125, isVeg: true },
    { name: 'Chicken Club Sandwich', category: 'Breakfast', price: 150, isVeg: false },
    { name: 'Simple Breakfast', category: 'Breakfast', price: 180, isVeg: false, description: '2 Chicken patties, 4 Eggs, Toast & Coffee' },
    { name: 'Simple Veggie Breakfast', category: 'Breakfast', price: 180, isVeg: true, description: 'Baked Beans, Veggie Fritters, Toast & Coffee' },
    { name: 'Chicken English Breakfast', category: 'Breakfast', price: 250, isVeg: false, description: '4 Eggs, Chicken Salami, Ham, Sausages, Toast & Coffee' },
    { name: 'Full English Breakfast', category: 'Breakfast', price: 350, isVeg: false, description: '4 Eggs, Chicken Salami, Ham, Sausages, Chicken Bacon, Toast & Coffee' },
    { name: 'Toast & Coffee', category: 'Breakfast', price: 350, isVeg: true },
    { name: 'Museli & Dry Fruits', category: 'Breakfast', price: 140, isVeg: true },
    { name: 'Banana Fritters and Honey', category: 'Breakfast', price: 100, isVeg: true },
    { name: 'Morning Porridge', category: 'Breakfast', price: 50, isVeg: true },

    // BREAKFAST - SOUTH INDIAN
    { name: 'Idly & Vada', category: 'Breakfast', price: 80, isVeg: true },
    { name: 'Masala Dosa', category: 'Breakfast', price: 120, isVeg: true },
    { name: 'Upma', category: 'Breakfast', price: 75, isVeg: true },
    { name: 'Set Dosa', category: 'Breakfast', price: 120, isVeg: true },
    { name: 'Kesari', category: 'Breakfast', price: 60, isVeg: true },
    { name: 'Sambar Vada', category: 'Breakfast', price: 80, isVeg: true },
    { name: 'Vada', category: 'Breakfast', price: 30, isVeg: true },
    { name: 'Payasam', category: 'Breakfast', price: 50, isVeg: true },

    // BREAKFAST - WEEKEND SPECIAL
    { name: 'Appam & Kadala Curry', category: 'Breakfast', price: 150, isVeg: true },
    { name: 'Appam & Veg Stew', category: 'Breakfast', price: 150, isVeg: true },
    { name: 'Idiappam Chicken Stew', category: 'Breakfast', price: 200, isVeg: false },
    { name: 'Dosa & Fish Curry', category: 'Breakfast', price: 200, isVeg: false },
    { name: 'Idiappam & Paya', category: 'Breakfast', price: 250, isVeg: false },

    // CHINESE - VEG STARTERS
    { name: 'Steamed Momos (Veg)', category: 'Chinese Starters', price: 80, isVeg: true },
    { name: 'Steamed Momos (Non-Veg)', category: 'Chinese Starters', price: 100, isVeg: false },
    { name: 'Fried Momos (Veg)', category: 'Chinese Starters', price: 90, isVeg: true },
    { name: 'Fried Momos (Non-Veg)', category: 'Chinese Starters', price: 110, isVeg: false },
    { name: 'Crispy Fries Veggie', category: 'Chinese Starters', price: 125, isVeg: true },
    { name: 'Veg Spring Rolls', category: 'Chinese Starters', price: 120, isVeg: true },

    // CHINESE - NON-VEG STARTERS
    { name: 'Crumb Fried Chicken Strips', category: 'Chinese Starters', price: 140, isVeg: false },
    { name: 'Chicken Spring Rolls', category: 'Chinese Starters', price: 140, isVeg: false },
    { name: 'Chilli Chicken', category: 'Chinese Starters', price: 160, isVeg: false },
    { name: 'Chilli Grilled Prawns', category: 'Chinese Starters', price: 250, isVeg: false },
    { name: 'Golden Fried Prawns', category: 'Chinese Starters', price: 250, isVeg: false },
    { name: 'Chilli Grilled Fish', category: 'Chinese Starters', price: 250, isVeg: false },
    { name: 'Fish in Garlic Sauce', category: 'Chinese Starters', price: 250, isVeg: false },

    // CHINESE - MAIN COURSE
    { name: 'Fried Rice (Veg)', category: 'Chinese Main', price: 140, isVeg: true },
    { name: 'Fried Rice (Non-Veg)', category: 'Chinese Main', price: 160, isVeg: false },
    { name: 'Noodles (Veg)', category: 'Chinese Main', price: 140, isVeg: true },
    { name: 'Noodles (Non-Veg)', category: 'Chinese Main', price: 160, isVeg: false },
    { name: 'Chopsuey (Veg)', category: 'Chinese Main', price: 150, isVeg: true },
    { name: 'Chopsuey (Non-Veg)', category: 'Chinese Main', price: 170, isVeg: false },

    // CHINESE - SOUPS
    { name: 'Manchow Soup (Veg)', category: 'Soups', price: 90, isVeg: true },
    { name: 'Manchow Soup (Chicken)', category: 'Soups', price: 120, isVeg: false },
    { name: 'Tom Yum Soup (Veg)', category: 'Soups', price: 90, isVeg: true },
    { name: 'Tom Yum Soup (Chicken)', category: 'Soups', price: 120, isVeg: false },
    { name: 'Sweet Corn Soup (Veg)', category: 'Soups', price: 90, isVeg: true },
    { name: 'Sweet Corn Soup (Chicken)', category: 'Soups', price: 120, isVeg: false },

    // INDIAN - BIRYANI
    { name: 'Chicken Biryani', category: 'Indian Main', price: 180, isVeg: false },
    { name: 'Mutton Biryani', category: 'Indian Main', price: 280, isVeg: false },
    { name: 'Fish Biryani', category: 'Indian Main', price: 280, isVeg: false },
    { name: 'Prawn Biryani', category: 'Indian Main', price: 280, isVeg: false },

    // INDIAN - RICE ITEMS
    { name: 'Ghee Rice', category: 'Indian Main', price: 120, isVeg: true },
    { name: 'Peas Pulav', category: 'Indian Main', price: 120, isVeg: true },
    { name: 'Veg Pulav', category: 'Indian Main', price: 200, isVeg: true },
    { name: 'Chicken Pulav', category: 'Indian Main', price: 140, isVeg: false },
    { name: 'Mutton Pulav', category: 'Indian Main', price: 350, isVeg: false },

    // INDIAN - BREAD
    { name: 'Chapati (3 Pcs)', category: 'Indian Bread', price: 90, isVeg: true },
    { name: 'Parotta (3 Pcs)', category: 'Indian Bread', price: 90, isVeg: true },
    { name: 'Naan (4 Pcs)', category: 'Indian Bread', price: 90, isVeg: true },
    { name: 'Phulkas', category: 'Indian Bread', price: 90, isVeg: true },

    // INDIAN - GRAVYS
    { name: 'Dal Fry', category: 'Indian Gravys', price: 100, isVeg: true },
    { name: 'Mix Veg Curry', category: 'Indian Gravys', price: 120, isVeg: true },
    { name: 'Kadai Paneer', category: 'Indian Gravys', price: 180, isVeg: true },
    { name: 'Aloo Gobi', category: 'Indian Gravys', price: 140, isVeg: true },
    { name: 'Paneer Kofta', category: 'Indian Gravys', price: 180, isVeg: true },
    { name: 'Paneer Butter Masala', category: 'Indian Gravys', price: 180, isVeg: true },
    { name: 'Chicken Kebabs', category: 'Indian Gravys', price: 180, isVeg: false },
    { name: 'Chicken Butter Masala', category: 'Indian Gravys', price: 220, isVeg: false },
    { name: 'Chicken Chettinad', category: 'Indian Gravys', price: 220, isVeg: false },
    { name: 'Chicken Pepper Dry', category: 'Indian Gravys', price: 240, isVeg: false },
    { name: 'Chicken Tikka Masala', category: 'Indian Gravys', price: 240, isVeg: false },
    { name: 'Chicken Bell Pepper', category: 'Indian Gravys', price: 240, isVeg: false },

    // INDIAN - SEAFOOD SPECIALS
    { name: 'Crab Curry', category: 'Seafood', price: 400, isVeg: false },
    { name: 'Squid Fry', category: 'Seafood', price: 250, isVeg: false },
    { name: 'Fish Curry', category: 'Seafood', price: 300, isVeg: false },
    { name: 'Fish Fry', category: 'Seafood', price: 300, isVeg: false },

    // CONTINENTAL - STARTERS
    { name: 'Garden Salad', category: 'Continental Starters', price: 175, isVeg: true },
    { name: 'Garlic Bread', category: 'Continental Starters', price: 120, isVeg: true },
    { name: 'Cheese Garlic Bread', category: 'Continental Starters', price: 200, isVeg: true },
    { name: 'Veggie Cannon Balls', category: 'Continental Starters', price: 200, isVeg: true },
    { name: 'Crispy Paneer', category: 'Continental Starters', price: 250, isVeg: true },
    { name: 'Chicken Wings', category: 'Continental Starters', price: 200, isVeg: false },
    { name: 'Crispy Fried Chicken', category: 'Continental Starters', price: 250, isVeg: false },
    { name: 'Chicken Cannon Balls', category: 'Continental Starters', price: 250, isVeg: false },
    { name: 'Chicken Sausages', category: 'Continental Starters', price: 150, isVeg: false },
    { name: 'Fish Fingers', category: 'Continental Starters', price: 350, isVeg: false },
    { name: 'Garlic Butter Prawns', category: 'Continental Starters', price: 400, isVeg: false },
    { name: 'Prawn Cocktail', category: 'Continental Starters', price: 150, isVeg: false },

    // CONTINENTAL - STEAKS
    { name: 'Chicken Steak', category: 'Steaks', price: 350, isVeg: false },
    { name: 'Lamb Steak', category: 'Steaks', price: 400, isVeg: false },
    { name: 'Fish Steak', category: 'Steaks', price: 450, isVeg: false },
    { name: 'Prawn & Squid Steak', category: 'Steaks', price: 450, isVeg: false },

    // CONTINENTAL - PASTA
    { name: 'Alfredo Pasta (White Sauce)', category: 'Pasta', price: 180, isVeg: true },
    { name: 'Pesto Pasta (Green Sauce)', category: 'Pasta', price: 180, isVeg: true },
    { name: 'Arrabiatta Pasta (Red Sauce)', category: 'Pasta', price: 220, isVeg: true },

    // CONTINENTAL - SIZZLERS (Clubhouse only)
    { name: 'Chicken Sizzler', category: 'Sizzlers', price: 330, isVeg: false },
    { name: 'Lamb Sizzler', category: 'Sizzlers', price: 450, isVeg: false },
    { name: 'Fish Sizzler', category: 'Sizzlers', price: 450, isVeg: false },
    { name: 'Prawn & Squid Sizzler', category: 'Sizzlers', price: 500, isVeg: false },

    // EVENING SNACKS / CHILDREN'S MENU - PIZZA
    { name: 'Margarita Pizza', category: 'Pizza', price: 180, isVeg: true },
    { name: 'Veggie Pizza', category: 'Pizza', price: 180, isVeg: true },
    { name: 'Cottage Pizza', category: 'Pizza', price: 220, isVeg: true },
    { name: 'Fully Loaded Veg Pizza', category: 'Pizza', price: 250, isVeg: true },
    { name: "B'fast Chicken Pizza", category: 'Pizza', price: 200, isVeg: false },
    { name: 'Chicken Tikka Pizza', category: 'Pizza', price: 240, isVeg: false },
    { name: 'Alfredo Chicken Pizza', category: 'Pizza', price: 280, isVeg: false },
    { name: 'Fully Loaded Meat Pizza', category: 'Pizza', price: 400, isVeg: false },

    // EVENING SNACKS - BURGERS
    { name: 'BBQ Chicken Burger', category: 'Burgers', price: 150, isVeg: false },
    { name: 'BBQ Lamb Burger', category: 'Burgers', price: 250, isVeg: false },
    { name: 'BBQ Veggie Burger', category: 'Burgers', price: 100, isVeg: true },
    { name: 'Grilled Seafood Burger', category: 'Burgers', price: 250, isVeg: false },

    // EVENING SNACKS - HOT DOGS
    { name: 'Chicken Hotdog', category: 'Hot Dogs', price: 200, isVeg: false },
    { name: 'Loaded Chicken Dog', category: 'Hot Dogs', price: 250, isVeg: false },

    // EVENING SNACKS - DESSERTS
    { name: 'Chocolate Tart', category: 'Desserts', price: 100, isVeg: true },
    { name: 'Fruit Tart', category: 'Desserts', price: 100, isVeg: true },
    { name: 'Chocolate Pie', category: 'Desserts', price: 100, isVeg: true },
    { name: 'Apple Pie', category: 'Desserts', price: 120, isVeg: true },
    { name: 'Cashew Pie', category: 'Desserts', price: 140, isVeg: true },
    { name: 'Chocolate Cake', category: 'Desserts', price: 150, isVeg: true },
    { name: 'Blueberry Cake', category: 'Desserts', price: 150, isVeg: true },
    { name: 'Butterscotch Cake', category: 'Desserts', price: 150, isVeg: true },
    { name: 'Chocolate Brownie', category: 'Desserts', price: 150, isVeg: true },
    { name: 'Blondie Brownie', category: 'Desserts', price: 150, isVeg: true },

    // ALA CARTE - DAILY LUNCH COMBOS (RICE)
    { name: 'Ghee Rice, Dal, Roti, Aloo Gobi', category: 'Lunch Combos', price: 450, isVeg: true },
    { name: 'Veg Pulav, Kadai Paneer', category: 'Lunch Combos', price: 300, isVeg: true },
    { name: 'Ghee rice, Butter Chicken, Kebabs', category: 'Lunch Combos', price: 550, isVeg: false },
    { name: 'Mutton Pulav, Chicken Masala, Chicken Pepper', category: 'Lunch Combos', price: 750, isVeg: false },
    { name: 'Chicken Pulav, Chicken Pepper', category: 'Lunch Combos', price: 400, isVeg: false },

    // ALA CARTE - DAILY LUNCH COMBOS (ROTI)
    { name: 'Chappati, Dal, Roti, Aloo Gobi', category: 'Lunch Combos', price: 450, isVeg: true },
    { name: 'Chappati, Kadai Paneer', category: 'Lunch Combos', price: 250, isVeg: true },
    { name: 'Naan, Butter Chicken, Kebabs', category: 'Lunch Combos', price: 500, isVeg: false },
    { name: 'Parota, Chicken Masala, Chicken Pepper', category: 'Lunch Combos', price: 550, isVeg: false },
    { name: 'Parota, Chicken Tikka Masala', category: 'Lunch Combos', price: 300, isVeg: false },
  ],
};

/**
 * Import all data to database
 */
export async function importCompleteSubscriptionMenu() {
  console.log('=== Starting Complete Subscription Menu Import ===\n');

  const tenantId = await getTenantId();
  const dbPath = await getDatabaseFilePath();
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Database Path: ${dbPath}\n`);

  let totalImported = 0;
  const errors: string[] = [];

  try {
    // 0. Ensure ALL required tables exist (create if missing)
    console.log('📋 Ensuring all required tables exist...');

    // Base menu tables
    try {
      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS menu_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `,
        params: [],
      });
      console.log('  ✓ menu_categories table verified');

      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category_id TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0,
            description TEXT,
            image_url TEXT,
            active INTEGER DEFAULT 1,
            preparation_time INTEGER DEFAULT 15,
            allergens TEXT DEFAULT '[]',
            dietary_tags TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT
          )
        `,
        params: [],
      });
      console.log('  ✓ menu_items table verified');

      // Subscription tables
      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS subscription_cuisine_types (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
          )
        `,
        params: [],
      });
      console.log('  ✓ subscription_cuisine_types table verified');

      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS subscription_plans (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price_per_week REAL NOT NULL,
            meals_per_week INTEGER NOT NULL,
            delivery_days TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            cuisine_types TEXT,
            meal_selection_limit INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `,
        params: [],
      });
      console.log('  ✓ subscription_plans table verified');

      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS subscription_menu_weeks (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            week_number INTEGER NOT NULL,
            year INTEGER NOT NULL,
            cuisine_type TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            published INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(tenant_id, week_number, year, cuisine_type)
          )
        `,
        params: [],
      });
      console.log('  ✓ subscription_menu_weeks table verified');

      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS subscription_menu_items (
            id TEXT PRIMARY KEY,
            menu_week_id TEXT NOT NULL,
            menu_item_id TEXT NOT NULL,
            available INTEGER DEFAULT 1,
            max_orders_per_week INTEGER,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (menu_week_id) REFERENCES subscription_menu_weeks(id) ON DELETE CASCADE,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
          )
        `,
        params: [],
      });
      console.log('  ✓ subscription_menu_items table verified');

      console.log('  ✅ All required tables are ready\n');
    } catch (err) {
      console.error('  ✗ Failed to create required tables:', err);
      errors.push(`Failed to create required tables: ${err}`);
      return { success: false, totalImported, errors };
    }

    // 1. Import cuisine types
    console.log('📋 Importing cuisine types...');
    for (const cuisine of MENU_DATA.cuisineTypes) {
      try {
        await invoke('execute_sqlite', {
          dbPath,
          query: `
            INSERT INTO subscription_cuisine_types
            (id, tenant_id, name, description, icon, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            generateId(),
            tenantId,
            cuisine.name,
            cuisine.description,
            cuisine.icon,
            String(cuisine.active ? 1 : 0),
            getTimestamp(),
          ],
        });
        console.log(`  ✓ ${cuisine.name}`);
        totalImported++;
      } catch (err) {
        errors.push(`Cuisine type ${cuisine.name}: ${err}`);
      }
    }

    // 2. Import subscription plans
    console.log('\n📋 Importing subscription plans...');
    for (const plan of MENU_DATA.plans) {
      try {
        const timestamp = getTimestamp();
        await invoke('execute_sqlite', {
          dbPath,
          query: `
            INSERT INTO subscription_plans
            (id, tenant_id, name, description, price_per_week, meals_per_week,
             delivery_days, active, cuisine_types, meal_selection_limit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            generateId(),
            tenantId,
            plan.name,
            plan.description,
            String(plan.pricePerWeek),
            String(plan.mealsPerWeek),
            JSON.stringify(plan.deliveryDays),
            String(plan.active ? 1 : 0),
            JSON.stringify(plan.cuisineTypes),
            String(plan.mealSelectionLimit),
            timestamp,
            timestamp,
          ],
        });
        console.log(`  ✓ ${plan.name}`);
        totalImported++;
      } catch (err) {
        errors.push(`Plan ${plan.name}: ${err}`);
      }
    }

    // 3. First, get existing categories from database
    console.log('\n📋 Checking existing categories...');
    const categoryMap = new Map<string, string>();
    const existingCategories = new Map<string, string>();

    try {
      const result = await invoke('query_sqlite', {
        dbPath,
        query: 'SELECT id, name FROM menu_categories',
      });
      // query_sqlite returns an array directly, no JSON parsing needed
      const categories = result as any[];
      categories.forEach((cat: any) => {
        existingCategories.set(cat.name, cat.id);
      });
      console.log(`  Found ${existingCategories.size} existing categories`);
    } catch (err) {
      console.log('  No existing categories found');
    }

    // 4. Create menu categories (use existing IDs if available)
    console.log('\n📋 Creating menu categories...');
    const uniqueCategories = [...new Set(MENU_DATA.menuItems.map(item => item.category))];

    for (const categoryName of uniqueCategories) {
      try {
        // Check if category already exists
        if (existingCategories.has(categoryName)) {
          const existingId = existingCategories.get(categoryName)!;
          categoryMap.set(categoryName, existingId);
          console.log(`  ↻ ${categoryName} (using existing: ${existingId})`);
          continue;
        }

        // Create new category
        const categoryId = `cat-${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
        categoryMap.set(categoryName, categoryId);

        try {
          await invoke('execute_sqlite', {
            dbPath,
            query: `
              INSERT OR IGNORE INTO menu_categories
              (id, name, sort_order, active)
              VALUES (?, ?, ?, ?)
            `,
            params: [
              categoryId,
              categoryName,
              '0',
              '1',
            ],
          });
          console.log(`  ✓ ${categoryName} (${categoryId})`);
        } catch (err) {
          // Log actual error for debugging
          console.error(`  ✗ ${categoryName}: ${err}`);
          errors.push(`Category ${categoryName}: ${err}`);
        }
      } catch (err) {
        errors.push(`Category ${categoryName}: ${err}`);
      }
    }

    // 4. Verify categories were created
    console.log('\n🔍 Verifying categories...');
    try {
      const result = await invoke('query_sqlite', {
        dbPath,
        query: 'SELECT id, name FROM menu_categories ORDER BY name',
      });
      // query_sqlite returns an array directly, no JSON parsing needed
      const categories = result as any[];
      console.log(`  Found ${categories.length} categories in database`);
      categories.forEach((cat: any) => console.log(`    - ${cat.name} (${cat.id})`));
    } catch (err) {
      console.error('  ✗ Could not verify categories:', err);
    }

    // 5. Import all menu items (150+ items)
    console.log('\n📋 Importing menu items (150+ items)...');
    console.log('This may take a minute...\n');

    for (const item of MENU_DATA.menuItems) {
      try {
        const categoryId = categoryMap.get(item.category);

        if (!categoryId) {
          console.error(`  ✗ ${item.name}: Category "${item.category}" not found in map`);
          errors.push(`Menu item ${item.name}: Category "${item.category}" not found`);
          continue;
        }

        // Build dietary_tags JSON array
        const dietaryTags = item.isVeg ? ['vegetarian'] : [];

        await invoke('execute_sqlite', {
          dbPath,
          query: `
            INSERT INTO menu_items
            (id, name, category_id, price, description, active, preparation_time, allergens, dietary_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            generateId(),
            item.name,
            categoryId,
            String(item.price),
            item.description || '',
            '1', // active by default
            '15', // default preparation time
            '[]', // empty allergens array
            JSON.stringify(dietaryTags),
          ],
        });
        totalImported++;

        // Progress indicator
        if (totalImported % 20 === 0) {
          console.log(`  ... ${totalImported} items imported`);
        }
      } catch (err) {
        errors.push(`Menu item ${item.name}: ${err}`);
        console.error(`  ✗ ${item.name}: ${err}`);
      }
    }

    console.log(`\n✓ Total menu items imported: ${MENU_DATA.menuItems.length}`);

    // Summary
    console.log('\n=== Import Complete ===');
    console.log(`Total items imported: ${totalImported}`);
    console.log(`Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach((err) => console.log(`  - ${err}`));
    }

    return {
      success: errors.length === 0,
      totalImported,
      errors,
    };
  } catch (err) {
    console.error('Fatal error during import:', err);
    return {
      success: false,
      totalImported,
      errors: [...errors, `Fatal: ${err}`],
    };
  }
}

/**
 * Import menu from Excel data
 * Takes parsed Excel data and imports it to the database
 */
export async function importFromExcelData(
  menuItems: Array<{
    name: string;
    category: string;
    price: number;
    description?: string;
    isVeg: boolean;
  }>
): Promise<{ success: boolean; totalImported: number; errors: string[] }> {
  console.log('=== Starting Excel Menu Import ===');
  console.log(`Found ${menuItems.length} items in Excel file\n`);

  let totalImported = 0;
  const errors: string[] = [];

  try {
    const tenantId = await getTenantId();
    const dbPath = await getDatabaseFilePath();

    // 0. Ensure menu tables exist (create if missing)
    console.log('\n📋 Ensuring menu tables exist...');
    try {
      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS menu_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `,
        params: [],
      });
      console.log('  ✓ menu_categories table verified');

      await invoke('execute_sqlite', {
        dbPath,
        query: `
          CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category_id TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0,
            description TEXT,
            image_url TEXT,
            active INTEGER DEFAULT 1,
            preparation_time INTEGER DEFAULT 15,
            allergens TEXT DEFAULT '[]',
            dietary_tags TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT
          )
        `,
        params: [],
      });
      console.log('  ✓ menu_items table verified\n');
    } catch (err) {
      console.error('  ✗ Failed to create menu tables:', err);
      errors.push(`Failed to create menu tables: ${err}`);
      return { success: false, totalImported, errors };
    }

    // 1. First, get existing categories from database
    console.log('\n📋 Checking existing categories...');
    const categoryMap = new Map<string, string>();
    const existingCategories = new Map<string, string>();

    try {
      const result = await invoke('query_sqlite', {
        dbPath,
        query: 'SELECT id, name FROM menu_categories',
      });
      // query_sqlite returns an array directly, no JSON parsing needed
      const categories = result as any[];
      categories.forEach((cat: any) => {
        existingCategories.set(cat.name, cat.id);
      });
      console.log(`  Found ${existingCategories.size} existing categories`);
    } catch (err) {
      console.log('  No existing categories found');
    }

    // 2. Create menu categories from Excel data (use existing IDs if available)
    console.log('\n📋 Creating menu categories from Excel...');
    const uniqueCategories = [...new Set(menuItems.map((item) => item.category))];

    for (const categoryName of uniqueCategories) {
      if (!categoryName) continue; // Skip empty categories

      try {
        // Check if category already exists
        if (existingCategories.has(categoryName)) {
          const existingId = existingCategories.get(categoryName)!;
          categoryMap.set(categoryName, existingId);
          console.log(`  ↻ ${categoryName} (using existing: ${existingId})`);
          continue;
        }

        // Create new category
        const categoryId = `cat-${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
        categoryMap.set(categoryName, categoryId);

        try {
          await invoke('execute_sqlite', {
            dbPath,
            query: `
              INSERT OR IGNORE INTO menu_categories
              (id, name, sort_order, active)
              VALUES (?, ?, ?, ?)
            `,
            params: [categoryId, categoryName, '0', '1'],
          });
          console.log(`  ✓ ${categoryName} (${categoryId})`);
        } catch (err) {
          console.error(`  ✗ ${categoryName}: ${err}`);
          errors.push(`Category ${categoryName}: ${err}`);
        }
      } catch (err) {
        errors.push(`Category ${categoryName}: ${err}`);
      }
    }

    // 2. Verify categories
    console.log('\n🔍 Verifying categories...');
    try {
      const result = await invoke('query_sqlite', {
        dbPath,
        query: 'SELECT id, name FROM menu_categories ORDER BY name',
      });
      // query_sqlite returns an array directly, no JSON parsing needed
      const categories = result as any[];
      console.log(`  Found ${categories.length} categories in database`);
    } catch (err) {
      console.error('  ✗ Could not verify categories:', err);
    }

    // 3. Import menu items from Excel
    console.log(`\n📋 Importing ${menuItems.length} menu items from Excel...\n`);

    for (const item of menuItems) {
      if (!item.name || !item.category) {
        console.error(`  ✗ Skipping item with missing name or category`);
        continue;
      }

      try {
        const categoryId = categoryMap.get(item.category);

        if (!categoryId) {
          console.error(`  ✗ ${item.name}: Category "${item.category}" not found`);
          errors.push(`Menu item ${item.name}: Category "${item.category}" not found`);
          continue;
        }

        const dietaryTags = item.isVeg ? ['vegetarian'] : [];

        await invoke('execute_sqlite', {
          dbPath,
          query: `
            INSERT INTO menu_items
            (id, name, category_id, price, description, active, preparation_time, allergens, dietary_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            generateId(),
            item.name,
            categoryId,
            String(item.price),
            item.description || '',
            '1',
            '15',
            '[]',
            JSON.stringify(dietaryTags),
          ],
        });
        totalImported++;

        if (totalImported % 20 === 0) {
          console.log(`  ... ${totalImported} items imported`);
        }
      } catch (err) {
        errors.push(`Menu item ${item.name}: ${err}`);
        console.error(`  ✗ ${item.name}: ${err}`);
      }
    }

    console.log(`\n✓ Total menu items imported: ${totalImported}`);

    // Summary
    console.log('\n=== Import Complete ===');
    console.log(`Total items imported: ${totalImported}`);
    console.log(`Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach((err) => console.log(`  - ${err}`));
    }

    return {
      success: errors.length === 0,
      totalImported,
      errors,
    };
  } catch (err) {
    console.error('Fatal error during Excel import:', err);
    return {
      success: false,
      totalImported,
      errors: [...errors, `Fatal: ${err}`],
    };
  }
}

// Export for use in components
export { MENU_DATA, getTenantId, generateId, getTimestamp };
