/**
 * Demo Data Templates for Different Restaurant Types
 * Provides sample data for quick onboarding and testing
 */

import { MenuItem, MenuCategory, Table, User, UserRole } from '../types';

export type RestaurantType = 'indian' | 'italian' | 'cafe' | 'fast-food' | 'fine-dining';

export interface DemoDataTemplate {
  type: RestaurantType;
  label: string;
  description: string;
  icon: string;
  restaurantInfo: {
    name: string;
    tagline: string;
  };
  categories: MenuCategory[];
  menuItems: MenuItem[];
  staff: Omit<User, 'id'>[];
  floorPlan: {
    sections: string[];
    tables: Omit<Table, 'id' | 'status' | 'current_order_id'>[];
  };
}

/**
 * Indian Restaurant Demo Data
 */
const indianRestaurantTemplate: DemoDataTemplate = {
  type: 'indian',
  label: 'Indian Restaurant',
  description: 'Traditional Indian cuisine with curries, tandoor, and biryanis',
  icon: '🍛',
  restaurantInfo: {
    name: 'Spice Haven',
    tagline: 'Authentic Indian Flavors',
  },
  categories: [
    { id: 'cat-appetizers', name: 'Appetizers', sort_order: 1, active: true },
    { id: 'cat-tandoor', name: 'Tandoor Specials', sort_order: 2, active: true },
    { id: 'cat-curries', name: 'Curries', sort_order: 3, active: true },
    { id: 'cat-biryani', name: 'Biryani & Rice', sort_order: 4, active: true },
    { id: 'cat-breads', name: 'Indian Breads', sort_order: 5, active: true },
    { id: 'cat-desserts', name: 'Desserts', sort_order: 6, active: true },
    { id: 'cat-beverages', name: 'Beverages', sort_order: 7, active: true },
  ],
  menuItems: [
    // Appetizers
    {
      id: 'item-samosa',
      category_id: 'cat-appetizers',
      name: 'Vegetable Samosa',
      description: 'Crispy pastry filled with spiced potatoes and peas',
      price: 120,
      active: true,
      preparation_time: 5,
      is_veg: true,
      is_popular: true,
      spice_level: 2,
    },
    {
      id: 'item-paneer-tikka',
      category_id: 'cat-appetizers',
      name: 'Paneer Tikka',
      description: 'Cottage cheese marinated in spices and grilled',
      price: 280,
      active: true,
      preparation_time: 15,
      is_veg: true,
      contains_dairy: true,
      spice_level: 3,
    },
    {
      id: 'item-chicken-65',
      category_id: 'cat-appetizers',
      name: 'Chicken 65',
      description: 'Spicy deep-fried chicken with curry leaves',
      price: 320,
      active: true,
      preparation_time: 12,
      is_veg: false,
      spice_level: 4,
    },
    // Tandoor
    {
      id: 'item-tandoori-chicken',
      category_id: 'cat-tandoor',
      name: 'Tandoori Chicken',
      description: 'Chicken marinated in yogurt and spices, cooked in clay oven',
      price: 450,
      active: true,
      preparation_time: 20,
      is_veg: false,
      is_chef_special: true,
      contains_dairy: true,
      spice_level: 3,
    },
    {
      id: 'item-malai-kebab',
      category_id: 'cat-tandoor',
      name: 'Malai Chicken Kebab',
      description: 'Creamy chicken kebabs with cashew and cream',
      price: 380,
      active: true,
      preparation_time: 18,
      is_veg: false,
      contains_dairy: true,
      contains_nuts: true,
      spice_level: 2,
    },
    // Curries
    {
      id: 'item-butter-chicken',
      category_id: 'cat-curries',
      name: 'Butter Chicken',
      description: 'Tender chicken in rich tomato and butter gravy',
      price: 420,
      active: true,
      preparation_time: 15,
      is_veg: false,
      is_popular: true,
      contains_dairy: true,
      spice_level: 2,
    },
    {
      id: 'item-dal-makhani',
      category_id: 'cat-curries',
      name: 'Dal Makhani',
      description: 'Black lentils slow-cooked with butter and cream',
      price: 280,
      active: true,
      preparation_time: 10,
      is_veg: true,
      contains_dairy: true,
      spice_level: 1,
    },
    {
      id: 'item-paneer-tikka-masala',
      category_id: 'cat-curries',
      name: 'Paneer Tikka Masala',
      description: 'Grilled cottage cheese in spicy tomato gravy',
      price: 340,
      active: true,
      preparation_time: 12,
      is_veg: true,
      contains_dairy: true,
      spice_level: 3,
    },
    // Biryani
    {
      id: 'item-veg-biryani',
      category_id: 'cat-biryani',
      name: 'Vegetable Biryani',
      description: 'Fragrant basmati rice with mixed vegetables and spices',
      price: 320,
      active: true,
      preparation_time: 20,
      is_veg: true,
      spice_level: 2,
    },
    {
      id: 'item-chicken-biryani',
      category_id: 'cat-biryani',
      name: 'Chicken Biryani',
      description: 'Aromatic basmati rice layered with spiced chicken',
      price: 380,
      active: true,
      preparation_time: 25,
      is_veg: false,
      is_popular: true,
      spice_level: 3,
    },
    // Breads
    {
      id: 'item-naan',
      category_id: 'cat-breads',
      name: 'Butter Naan',
      description: 'Soft leavened bread brushed with butter',
      price: 60,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    {
      id: 'item-garlic-naan',
      category_id: 'cat-breads',
      name: 'Garlic Naan',
      description: 'Naan bread topped with garlic and coriander',
      price: 80,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    // Desserts
    {
      id: 'item-gulab-jamun',
      category_id: 'cat-desserts',
      name: 'Gulab Jamun',
      description: 'Deep-fried dough balls soaked in sugar syrup',
      price: 120,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
    {
      id: 'item-kulfi',
      category_id: 'cat-desserts',
      name: 'Malai Kulfi',
      description: 'Traditional Indian ice cream with cardamom',
      price: 100,
      active: true,
      preparation_time: 3,
      is_veg: true,
      contains_dairy: true,
    },
    // Beverages
    {
      id: 'item-lassi',
      category_id: 'cat-beverages',
      name: 'Sweet Lassi',
      description: 'Chilled yogurt drink sweetened with sugar',
      price: 80,
      active: true,
      preparation_time: 3,
      is_veg: true,
      contains_dairy: true,
    },
    {
      id: 'item-masala-chai',
      category_id: 'cat-beverages',
      name: 'Masala Chai',
      description: 'Spiced Indian tea with milk',
      price: 50,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
  ],
  staff: [
    { name: 'Rajesh Kumar', role: UserRole.Manager, pin_code: '1234', active: true },
    { name: 'Priya Sharma', role: UserRole.Server, pin_code: '2345', active: true },
    { name: 'Amit Singh', role: UserRole.Server, pin_code: '3456', active: true },
    { name: 'Sandeep Patel', role: UserRole.Kitchen, pin_code: '4567', active: true },
  ],
  floorPlan: {
    sections: ['Main Hall', 'Private Dining', 'Outdoor'],
    tables: [
      // Main Hall
      { number: 1, capacity: 2, section: 'Main Hall', position_x: 100, position_y: 100 },
      { number: 2, capacity: 2, section: 'Main Hall', position_x: 300, position_y: 100 },
      { number: 3, capacity: 4, section: 'Main Hall', position_x: 100, position_y: 250 },
      { number: 4, capacity: 4, section: 'Main Hall', position_x: 300, position_y: 250 },
      { number: 5, capacity: 6, section: 'Main Hall', position_x: 500, position_y: 100 },
      { number: 6, capacity: 6, section: 'Main Hall', position_x: 500, position_y: 250 },
      // Private Dining
      { number: 7, capacity: 8, section: 'Private Dining', position_x: 100, position_y: 100 },
      { number: 8, capacity: 10, section: 'Private Dining', position_x: 400, position_y: 100 },
      // Outdoor
      { number: 9, capacity: 4, section: 'Outdoor', position_x: 100, position_y: 100 },
      { number: 10, capacity: 4, section: 'Outdoor', position_x: 300, position_y: 100 },
    ],
  },
};

/**
 * Italian Restaurant Demo Data
 */
const italianRestaurantTemplate: DemoDataTemplate = {
  type: 'italian',
  label: 'Italian Restaurant',
  description: 'Pasta, pizza, and Mediterranean classics',
  icon: '🍝',
  restaurantInfo: {
    name: 'La Bella Cucina',
    tagline: 'Authentic Italian Cuisine',
  },
  categories: [
    { id: 'cat-antipasti', name: 'Antipasti', sort_order: 1, active: true },
    { id: 'cat-pasta', name: 'Pasta', sort_order: 2, active: true },
    { id: 'cat-pizza', name: 'Pizza', sort_order: 3, active: true },
    { id: 'cat-mains', name: 'Main Course', sort_order: 4, active: true },
    { id: 'cat-desserts', name: 'Dolci', sort_order: 5, active: true },
    { id: 'cat-beverages', name: 'Beverages', sort_order: 6, active: true },
  ],
  menuItems: [
    // Antipasti
    {
      id: 'item-bruschetta',
      category_id: 'cat-antipasti',
      name: 'Bruschetta',
      description: 'Toasted bread with tomatoes, basil, and olive oil',
      price: 250,
      active: true,
      preparation_time: 5,
      is_veg: true,
      is_vegan: true,
      contains_gluten: true,
    },
    {
      id: 'item-caprese',
      category_id: 'cat-antipasti',
      name: 'Caprese Salad',
      description: 'Fresh mozzarella, tomatoes, and basil',
      price: 320,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
    // Pasta
    {
      id: 'item-carbonara',
      category_id: 'cat-pasta',
      name: 'Spaghetti Carbonara',
      description: 'Classic Roman pasta with eggs, cheese, and pancetta',
      price: 420,
      active: true,
      preparation_time: 15,
      is_veg: false,
      is_popular: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    {
      id: 'item-aglio-olio',
      category_id: 'cat-pasta',
      name: 'Aglio e Olio',
      description: 'Spaghetti with garlic, olive oil, and chili flakes',
      price: 350,
      active: true,
      preparation_time: 12,
      is_veg: true,
      is_vegan: true,
      contains_gluten: true,
      spice_level: 2,
    },
    {
      id: 'item-lasagna',
      category_id: 'cat-pasta',
      name: 'Lasagna Bolognese',
      description: 'Layered pasta with meat sauce and béchamel',
      price: 480,
      active: true,
      preparation_time: 20,
      is_veg: false,
      is_chef_special: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    // Pizza
    {
      id: 'item-margherita',
      category_id: 'cat-pizza',
      name: 'Pizza Margherita',
      description: 'Tomato sauce, mozzarella, and fresh basil',
      price: 380,
      active: true,
      preparation_time: 15,
      is_veg: true,
      is_popular: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    {
      id: 'item-pepperoni',
      category_id: 'cat-pizza',
      name: 'Pepperoni Pizza',
      description: 'Classic pizza with pepperoni and mozzarella',
      price: 450,
      active: true,
      preparation_time: 15,
      is_veg: false,
      contains_dairy: true,
      contains_gluten: true,
    },
    {
      id: 'item-quattro-formaggi',
      category_id: 'cat-pizza',
      name: 'Quattro Formaggi',
      description: 'Four cheese pizza with mozzarella, gorgonzola, fontina, and parmesan',
      price: 480,
      active: true,
      preparation_time: 15,
      is_veg: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    // Mains
    {
      id: 'item-chicken-parmigiana',
      category_id: 'cat-mains',
      name: 'Chicken Parmigiana',
      description: 'Breaded chicken with marinara and mozzarella',
      price: 520,
      active: true,
      preparation_time: 20,
      is_veg: false,
      contains_dairy: true,
      contains_gluten: true,
    },
    // Desserts
    {
      id: 'item-tiramisu',
      category_id: 'cat-desserts',
      name: 'Tiramisu',
      description: 'Classic Italian dessert with coffee and mascarpone',
      price: 280,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
    {
      id: 'item-panna-cotta',
      category_id: 'cat-desserts',
      name: 'Panna Cotta',
      description: 'Silky vanilla cream with berry compote',
      price: 260,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
    // Beverages
    {
      id: 'item-espresso',
      category_id: 'cat-beverages',
      name: 'Espresso',
      description: 'Strong Italian coffee',
      price: 100,
      active: true,
      preparation_time: 3,
      is_veg: true,
      is_vegan: true,
    },
    {
      id: 'item-cappuccino',
      category_id: 'cat-beverages',
      name: 'Cappuccino',
      description: 'Espresso with steamed milk and foam',
      price: 150,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
  ],
  staff: [
    { name: 'Marco Rossi', role: UserRole.Manager, pin_code: '1234', active: true },
    { name: 'Sofia Romano', role: UserRole.Server, pin_code: '2345', active: true },
    { name: 'Luca Ferrari', role: UserRole.Server, pin_code: '3456', active: true },
    { name: 'Giovanni Costa', role: UserRole.Kitchen, pin_code: '4567', active: true },
  ],
  floorPlan: {
    sections: ['Dining Room', 'Terrace'],
    tables: [
      // Dining Room
      { number: 1, capacity: 2, section: 'Dining Room', position_x: 100, position_y: 100 },
      { number: 2, capacity: 2, section: 'Dining Room', position_x: 300, position_y: 100 },
      { number: 3, capacity: 4, section: 'Dining Room', position_x: 100, position_y: 250 },
      { number: 4, capacity: 4, section: 'Dining Room', position_x: 300, position_y: 250 },
      { number: 5, capacity: 6, section: 'Dining Room', position_x: 500, position_y: 150 },
      // Terrace
      { number: 6, capacity: 4, section: 'Terrace', position_x: 100, position_y: 100 },
      { number: 7, capacity: 4, section: 'Terrace', position_x: 300, position_y: 100 },
      { number: 8, capacity: 2, section: 'Terrace', position_x: 500, position_y: 100 },
    ],
  },
};

/**
 * Cafe Demo Data
 */
const cafeTemplate: DemoDataTemplate = {
  type: 'cafe',
  label: 'Cafe',
  description: 'Coffee shop with pastries, sandwiches, and beverages',
  icon: '☕',
  restaurantInfo: {
    name: 'Cozy Corner Cafe',
    tagline: 'Your Daily Brew',
  },
  categories: [
    { id: 'cat-coffee', name: 'Coffee', sort_order: 1, active: true },
    { id: 'cat-tea', name: 'Tea', sort_order: 2, active: true },
    { id: 'cat-pastries', name: 'Pastries', sort_order: 3, active: true },
    { id: 'cat-sandwiches', name: 'Sandwiches', sort_order: 4, active: true },
    { id: 'cat-beverages', name: 'Cold Beverages', sort_order: 5, active: true },
  ],
  menuItems: [
    // Coffee
    {
      id: 'item-americano',
      category_id: 'cat-coffee',
      name: 'Americano',
      description: 'Espresso with hot water',
      price: 120,
      active: true,
      preparation_time: 3,
      is_veg: true,
      is_vegan: true,
    },
    {
      id: 'item-latte',
      category_id: 'cat-coffee',
      name: 'Caffe Latte',
      description: 'Espresso with steamed milk',
      price: 160,
      active: true,
      preparation_time: 5,
      is_veg: true,
      is_popular: true,
      contains_dairy: true,
    },
    {
      id: 'item-cappuccino-cafe',
      category_id: 'cat-coffee',
      name: 'Cappuccino',
      description: 'Espresso with equal parts steamed milk and foam',
      price: 150,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
    {
      id: 'item-mocha',
      category_id: 'cat-coffee',
      name: 'Mocha',
      description: 'Chocolate-flavored coffee with steamed milk',
      price: 180,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
    // Tea
    {
      id: 'item-english-breakfast',
      category_id: 'cat-tea',
      name: 'English Breakfast Tea',
      description: 'Classic black tea blend',
      price: 100,
      active: true,
      preparation_time: 5,
      is_veg: true,
      is_vegan: true,
    },
    {
      id: 'item-green-tea',
      category_id: 'cat-tea',
      name: 'Green Tea',
      description: 'Light and refreshing green tea',
      price: 110,
      active: true,
      preparation_time: 5,
      is_veg: true,
      is_vegan: true,
    },
    // Pastries
    {
      id: 'item-croissant',
      category_id: 'cat-pastries',
      name: 'Butter Croissant',
      description: 'Flaky French pastry',
      price: 120,
      active: true,
      preparation_time: 2,
      is_veg: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    {
      id: 'item-muffin',
      category_id: 'cat-pastries',
      name: 'Blueberry Muffin',
      description: 'Freshly baked muffin with blueberries',
      price: 140,
      active: true,
      preparation_time: 2,
      is_veg: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    {
      id: 'item-brownie',
      category_id: 'cat-pastries',
      name: 'Chocolate Brownie',
      description: 'Rich chocolate brownie',
      price: 150,
      active: true,
      preparation_time: 2,
      is_veg: true,
      is_popular: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    // Sandwiches
    {
      id: 'item-club-sandwich',
      category_id: 'cat-sandwiches',
      name: 'Club Sandwich',
      description: 'Triple-decker sandwich with chicken, bacon, and veggies',
      price: 280,
      active: true,
      preparation_time: 10,
      is_veg: false,
      contains_gluten: true,
    },
    {
      id: 'item-veg-sandwich',
      category_id: 'cat-sandwiches',
      name: 'Grilled Veggie Sandwich',
      description: 'Grilled vegetables with pesto and cheese',
      price: 220,
      active: true,
      preparation_time: 8,
      is_veg: true,
      contains_dairy: true,
      contains_gluten: true,
    },
    // Cold Beverages
    {
      id: 'item-iced-latte',
      category_id: 'cat-beverages',
      name: 'Iced Latte',
      description: 'Chilled espresso with cold milk',
      price: 180,
      active: true,
      preparation_time: 5,
      is_veg: true,
      contains_dairy: true,
    },
    {
      id: 'item-fresh-juice',
      category_id: 'cat-beverages',
      name: 'Fresh Orange Juice',
      description: 'Freshly squeezed orange juice',
      price: 150,
      active: true,
      preparation_time: 5,
      is_veg: true,
      is_vegan: true,
    },
  ],
  staff: [
    { name: 'Emma Wilson', role: UserRole.Manager, pin_code: '1234', active: true },
    { name: 'James Brown', role: UserRole.Server, pin_code: '2345', active: true },
    { name: 'Sarah Davis', role: UserRole.Kitchen, pin_code: '3456', active: true },
  ],
  floorPlan: {
    sections: ['Indoor', 'Outdoor Patio'],
    tables: [
      // Indoor
      { number: 1, capacity: 2, section: 'Indoor', position_x: 100, position_y: 100 },
      { number: 2, capacity: 2, section: 'Indoor', position_x: 300, position_y: 100 },
      { number: 3, capacity: 4, section: 'Indoor', position_x: 100, position_y: 250 },
      { number: 4, capacity: 4, section: 'Indoor', position_x: 300, position_y: 250 },
      // Outdoor Patio
      { number: 5, capacity: 2, section: 'Outdoor Patio', position_x: 100, position_y: 100 },
      { number: 6, capacity: 2, section: 'Outdoor Patio', position_x: 300, position_y: 100 },
    ],
  },
};

/**
 * All available demo templates
 */
export const DEMO_TEMPLATES: Record<RestaurantType, DemoDataTemplate> = {
  indian: indianRestaurantTemplate,
  italian: italianRestaurantTemplate,
  cafe: cafeTemplate,
  'fast-food': cafeTemplate, // Reuse cafe for now
  'fine-dining': italianRestaurantTemplate, // Reuse italian for now
};

/**
 * Get demo template by type
 */
export function getDemoTemplate(type: RestaurantType): DemoDataTemplate {
  return DEMO_TEMPLATES[type];
}

/**
 * Get all available demo types
 */
export function getAllDemoTypes(): RestaurantType[] {
  return Object.keys(DEMO_TEMPLATES) as RestaurantType[];
}
