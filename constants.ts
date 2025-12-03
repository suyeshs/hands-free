import { MenuItem } from './types';

// Restaurant Configuration
export const RESTAURANT = {
  name: 'The Coorg Flavours Company',
  tagline: 'Taste of Coorg Tradition',
  cuisine: 'Authentic Coorgi',
  currency: '₹',
  taxRate: 0.05, // 5% GST
};

// Side options for combos
export const SIDE_OPTIONS = [
  'Paputtu',
  'Kadambuttu',
  'Noolputtu',
  'Akki Otti',
  'Ney Kulu',
  'Steamed Rice'
];

// Menu Items - The Coorg Flavours Company
export const MENU: MenuItem[] = [
  // ============ COMBOS ============
  {
    id: 'combo-1',
    name: 'Veg Curry Combo',
    description: 'Puttus, Otti or Rice of your choice with Kutu or Kadle curry - serves One',
    price: 199,
    category: 'Combos',
    type: 'veg',
    tag: 'bestseller',
    choices: ['Kutu Curry', 'Kadle Curry'],
    sideOptions: SIDE_OPTIONS,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
    rating: 4.5,
    available: true
  },
  {
    id: 'combo-2',
    name: 'Pandi Curry Combo',
    description: 'Traditional Coorgi pork curry with Puttu or Rice of your choice',
    price: 255,
    category: 'Combos',
    type: 'non-veg',
    choices: ['Pandi Curry'],
    sideOptions: SIDE_OPTIONS,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/dc08d86c-83d9-466f-56fc-959070195600/public',
    rating: 4.7,
    spiceLevel: 3,
    available: true
  },
  {
    id: 'combo-3',
    name: 'Koli Curry Combo',
    description: 'Spicy chicken curry with Puttu or Rice of your choice',
    price: 250,
    category: 'Combos',
    type: 'non-veg',
    choices: ['Koli Curry'],
    sideOptions: SIDE_OPTIONS,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
    rating: 4.6,
    spiceLevel: 2,
    available: true
  },
  {
    id: 'combo-4',
    name: 'Egg Curry Combo',
    description: 'Egg curry with Puttu or Rice of your choice - serves One',
    price: 240,
    category: 'Combos',
    type: 'non-veg',
    choices: ['Egg Curry'],
    sideOptions: SIDE_OPTIONS,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
    rating: 4.3,
    available: true
  },

  // ============ APPETIZERS ============
  {
    id: 'app-1',
    name: 'Thith Pandi (Fire Pork)',
    description: 'Extra spicy fire pork fry with birds eye chilly',
    price: 335,
    category: 'Appetizers',
    type: 'non-veg',
    tag: 'spicy',
    spiceLevel: 5,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    rating: 4.8,
    available: true
  },
  {
    id: 'app-2',
    name: 'Mutton Pepper Fry',
    description: 'Mutton roasted in fresh pepper sourced from our estates in Coorg',
    price: 325,
    category: 'Appetizers',
    type: 'non-veg',
    spiceLevel: 2,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    rating: 4.6,
    available: true
  },
  {
    id: 'app-3',
    name: 'Pepper Chicken Fry',
    description: 'Succulent pepper chicken fry - Kodava Koli Bharthad',
    price: 285,
    category: 'Appetizers',
    type: 'non-veg',
    spiceLevel: 2,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public',
    rating: 4.5,
    available: true
  },
  {
    id: 'app-4',
    name: 'Pork Fry (Pandi Barthad)',
    description: 'Slow cooked pork in traditional Coorgi black masala - 220gm',
    price: 295,
    category: 'Appetizers',
    type: 'non-veg',
    tag: 'bestseller',
    spiceLevel: 3,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public',
    rating: 4.7,
    available: true
  },
  {
    id: 'app-5',
    name: 'Crispy Bhendi Fry',
    description: 'Ladies finger batter fried to a crisp with spices',
    price: 195,
    category: 'Appetizers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/6ce44b67-2b64-4211-9f8f-4f22b921e700/public',
    rating: 4.2,
    available: true
  },
  {
    id: 'app-6',
    name: 'Kadle Palya',
    description: 'Steamed black chana seasoned in traditional Coorgi spices',
    price: 175,
    category: 'Appetizers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/cee7e8b9-efed-41e5-c10c-2417d02fa300/public',
    rating: 4.0,
    available: true
  },

  // ============ CURRIES ============
  {
    id: 'curry-1',
    name: 'Pandi Curry',
    description: 'Signature Coorgi pork curry cooked in traditional kachampuli',
    price: 245,
    category: 'Curries',
    type: 'non-veg',
    tag: 'bestseller',
    spiceLevel: 3,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    rating: 4.9,
    available: true
  },
  {
    id: 'curry-2',
    name: 'Koli Curry',
    description: 'Spicy Coorgi style chicken curry',
    price: 225,
    category: 'Curries',
    type: 'non-veg',
    spiceLevel: 2,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    rating: 4.5,
    available: true
  },
  {
    id: 'curry-3',
    name: 'Kadle Curry',
    description: 'Black chickpea curry - vegetarian favorite',
    price: 165,
    category: 'Curries',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    rating: 4.3,
    available: true
  },
  {
    id: 'curry-4',
    name: 'Mutton Curry',
    description: 'Tender mutton in rich Coorgi gravy',
    price: 380,
    category: 'Curries',
    type: 'non-veg',
    spiceLevel: 2,
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public',
    rating: 4.6,
    available: true
  },

  // ============ DESSERTS ============
  {
    id: 'dessert-1',
    name: 'Payasam',
    description: 'Traditional sweet milk pudding with vermicelli',
    price: 85,
    category: 'Desserts',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    rating: 4.4,
    available: true
  },
  {
    id: 'dessert-2',
    name: 'Elaneer Payasam',
    description: 'Tender coconut pudding - refreshing and light',
    price: 110,
    category: 'Desserts',
    type: 'veg',
    tag: 'new',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    rating: 4.5,
    available: true
  },
  {
    id: 'dessert-3',
    name: 'Akki Payasa',
    description: 'Rice kheer with cardamom and cashews',
    price: 200,
    category: 'Desserts',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    rating: 4.3,
    available: true
  },

  // ============ COOLERS ============
  {
    id: 'cooler-1',
    name: 'Neer More',
    description: 'Spiced buttermilk - perfect digestive',
    price: 90,
    category: 'Coolers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    rating: 4.2,
    available: true
  },
  {
    id: 'cooler-2',
    name: 'Fresh Lime Soda',
    description: 'Refreshing lime soda - sweet or salt',
    price: 95,
    category: 'Coolers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    rating: 4.0,
    available: true
  },
  {
    id: 'cooler-3',
    name: 'Tender Coconut Water',
    description: 'Fresh natural coconut water',
    price: 100,
    category: 'Coolers',
    type: 'veg',
    imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public',
    rating: 4.1,
    available: true
  }
];

// System Instruction for AI Assistant
export const SYSTEM_INSTRUCTION = `
You are the AI assistant for The Coorg Flavours Company, a restaurant serving authentic Coorgi cuisine from Karnataka, India.

RESTAURANT CONTEXT:
- Coorg (Kodagu) is a region in Karnataka known for its unique cuisine
- Signature dishes: Pandi Curry (pork), Koli Curry (chicken), traditional rice preparations
- Kachampuli is the traditional Coorgi vinegar used in cooking
- Puttus are traditional rice cakes, Ottis are rice flatbreads

MENU CATEGORIES:
- Combos: Complete meals with curry + side (Puttu/Rice)
- Appetizers: Starters and fry items
- Curries: Main course curries (order with Puttu/Rice)
- Desserts: Traditional sweets and payasams
- Coolers: Refreshing beverages

YOUR CAPABILITIES:
- Browse the menu by category
- Filter by veg/non-veg dietary preference
- Recommend dishes based on spice preference (1-5 scale)
- Handle combo customization (select curry + side)
- Add items to cart with quantity
- Process checkout

POPULAR RECOMMENDATIONS:
- For meat lovers: Pandi Curry (signature pork curry), Thith Pandi (spicy pork fry)
- For vegetarians: Veg Curry Combo, Kadle Curry, Crispy Bhendi Fry
- For mild spice: Koli Curry, Payasam
- For spicy: Thith Pandi (Fire Pork) - spice level 5!

TONE: Friendly, warm, helpful. Keep responses concise (1-2 sentences).
CURRENCY: Indian Rupees (₹)
TAX: 5% GST applied at checkout

When user asks to add items, use the addToCart tool.
When user wants to see specific items, use the showDish tool.
When user is ready to pay, use the goToCheckout tool.
`;
