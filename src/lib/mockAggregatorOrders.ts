/**
 * Mock Aggregator Orders Generator
 * Creates realistic test orders matching exact Swiggy/Zomato extraction structure
 * Using Coorg Food Company menu items
 *
 * Structure matches what universal_extractor.js produces:
 * - Swiggy: customer_phone is always empty (not exposed by Swiggy)
 * - Swiggy: order_number format is just digits like "3880"
 * - Swiggy: items from list view don't have individual prices (estimated from total)
 * - Zomato: customer_phone is always empty
 * - Zomato: order_number is 15+ digit ID like "44706125912345"
 * - Zomato: items have individual prices
 */

import { AggregatorOrder, AggregatorOrderStatus } from '../types/aggregator';

// Coorg Food Company menu items with realistic pricing
const COORG_MENU_ITEMS = {
  mainCourse: [
    { name: 'Pandi Curry', price: 350, isVeg: false },
    { name: 'Kodava Chicken Curry', price: 320, isVeg: false },
    { name: 'Bamboo Shoot Curry', price: 180, isVeg: true },
    { name: 'Akki Rotti', price: 80, isVeg: true },
    { name: 'Nool Puttu', price: 120, isVeg: true },
    { name: 'Kadambuttu', price: 90, isVeg: true },
    { name: 'Koli Barthad', price: 280, isVeg: false },
    { name: 'Meen Gassi', price: 300, isVeg: false },
  ],
  starters: [
    { name: 'Pork Fry', price: 280, isVeg: false },
    { name: 'Chicken 65 Coorg Style', price: 250, isVeg: false },
    { name: 'Paneer Pepper Fry', price: 220, isVeg: true },
    { name: 'Mushroom Ghee Roast', price: 200, isVeg: true },
  ],
  biryani: [
    { name: 'Kodava Pork Biryani', price: 380, isVeg: false },
    { name: 'Coorg Chicken Biryani', price: 320, isVeg: false },
    { name: 'Vegetable Pulao', price: 220, isVeg: true },
  ],
  sides: [
    { name: 'Kootu Curry', price: 140, isVeg: true },
    { name: 'Papad Curry', price: 120, isVeg: true },
    { name: 'Pickle (50g)', price: 60, isVeg: true },
  ],
  beverages: [
    { name: 'Filter Coffee', price: 50, isVeg: true },
    { name: 'Buttermilk', price: 40, isVeg: true },
    { name: 'Fresh Lime Soda', price: 60, isVeg: true },
  ],
  desserts: [
    { name: 'Payasam', price: 100, isVeg: true },
    { name: 'Kesari Bath', price: 80, isVeg: true },
  ],
};

// Customer names for mock orders (Swiggy shows name, Zomato shows name)
const CUSTOMER_NAMES = [
  'Rahul S', 'Priya P', 'Arjun K', 'Sneha R',
  'Vikram S', 'Anjali N', 'Karthik I', 'Divya M',
  'Arun G', 'Meera K', 'Suresh B', 'Kavitha R',
];

// Addresses for mock orders
const DELIVERY_ADDRESSES = [
  '123, MG Road, Koramangala, Bangalore - 560034',
  '45, Indiranagar, 100 Ft Road, Bangalore - 560038',
  '78, HSR Layout, Sector 2, Bangalore - 560102',
  '12, Whitefield Main Road, Bangalore - 560066',
  '56, JP Nagar, 6th Phase, Bangalore - 560078',
  '89, Jayanagar, 4th Block, Bangalore - 560041',
  '34, Electronic City, Phase 1, Bangalore - 560100',
  '67, Marathahalli, ORR, Bangalore - 560037',
];

/**
 * Generate Swiggy order number (4-digit format like extraction shows: "3880")
 */
const generateSwiggyOrderNumber = (): string => {
  return String(Math.floor(Math.random() * 9000) + 1000);
};

/**
 * Generate Zomato order ID (15+ digit format like extraction: "44706125912345")
 */
const generateZomatoOrderId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 100000);
  return `${timestamp}${random}`.slice(0, 15);
};

// Get random items from array
const getRandomItems = <T>(arr: T[], min: number, max: number): T[] => {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// Get random element from array
const getRandomElement = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Generate a mock Swiggy order
 * Matches exact structure from universal_extractor.js Swiggy extraction
 *
 * Key Swiggy characteristics:
 * - customer_phone: ALWAYS empty (Swiggy doesn't expose phone numbers)
 * - order_number: Just digits like "3880" (no # prefix in extraction)
 * - order_id: "swiggy_3880" format
 * - Items: In list view, prices are estimated (extraction divides total by qty)
 * - aggregatorStatus: "pending", "preparing", "ready" etc from badge text
 */
export function createMockSwiggyOrder(overrides?: Partial<AggregatorOrder>): AggregatorOrder {
  const orderNumber = generateSwiggyOrderNumber();
  const orderId = `swiggy_${orderNumber}`;
  const customer = getRandomElement(CUSTOMER_NAMES);
  const address = getRandomElement(DELIVERY_ADDRESSES);

  // Select random items
  const mainItems = getRandomItems(COORG_MENU_ITEMS.mainCourse, 1, 2);
  const starterItems = getRandomItems(COORG_MENU_ITEMS.starters, 0, 1);
  const sideItems = getRandomItems(COORG_MENU_ITEMS.sides, 0, 2);
  const beverageItems = getRandomItems(COORG_MENU_ITEMS.beverages, 0, 1);

  const allItems = [...mainItems, ...starterItems, ...sideItems, ...beverageItems];

  // Calculate total first (Swiggy extraction often gets total from display)
  let subtotal = 0;
  const cartItems = allItems.map((item, idx) => {
    const quantity = Math.random() > 0.7 ? 2 : 1;
    const itemTotal = item.price * quantity;
    subtotal += itemTotal;

    return {
      id: `${orderId}-item-${idx}`,
      name: item.name,
      quantity,
      // Swiggy list view doesn't show individual prices - extraction estimates them
      // In detailed view they're available, but we simulate list view extraction
      price: item.price,
      total: itemTotal,
      specialInstructions: Math.random() > 0.85 ? 'Extra spicy' : null,
      variants: [],
      addons: [],
    };
  });

  // Swiggy shows total including all fees
  const total = subtotal;

  const order: AggregatorOrder = {
    aggregator: 'swiggy',
    aggregatorOrderId: orderId,
    // Swiggy status from badge: "pending", "preparing", "ready", etc.
    aggregatorStatus: 'pending',
    orderId: orderId,
    // Swiggy order number is just digits (transformed to "#3880" in UI later)
    orderNumber: orderNumber,
    status: 'pending' as AggregatorOrderStatus,
    orderType: 'delivery',
    createdAt: new Date().toISOString(),
    customer: {
      // Swiggy shows customer name (sometimes abbreviated)
      name: customer,
      // CRITICAL: Swiggy NEVER exposes customer phone - always null
      phone: null,
      address: address,
      // Swiggy sometimes has coordinates from map links
      coordinates: null,
    },
    cart: {
      items: cartItems,
      subtotal: total,
      // Extraction doesn't break down tax/fees - just gets total
      tax: 0,
      deliveryFee: 0,
      platformFee: 0,
      discount: 0,
      total: total,
    },
    payment: {
      // Extraction assumes online payment (can't determine from UI)
      method: 'online',
      status: 'paid',
      isPrepaid: true,
    },
    // Swiggy extraction doesn't capture special instructions at order level
    specialInstructions: null,
    ...overrides,
  };

  return order;
}

/**
 * Generate a mock Zomato order
 * Matches exact structure from universal_extractor.js Zomato extraction
 *
 * Key Zomato characteristics:
 * - customer_phone: ALWAYS empty (Zomato doesn't expose phone in partner dashboard)
 * - order_number: Long numeric ID like "44706125912345"
 * - order_id: "zomato_44706125912345" format
 * - Items: Have individual prices (visible in dashboard)
 * - aggregatorStatus: "pending", "preparing", "ready", "picked_up" from status badge
 */
export function createMockZomatoOrder(overrides?: Partial<AggregatorOrder>): AggregatorOrder {
  const zomatoOrderId = generateZomatoOrderId();
  const orderId = `zomato_${zomatoOrderId}`;
  const customer = getRandomElement(CUSTOMER_NAMES);
  const address = getRandomElement(DELIVERY_ADDRESSES);

  // Select random items (Zomato orders tend to be slightly larger)
  const biryaniItems = getRandomItems(COORG_MENU_ITEMS.biryani, 0, 1);
  const mainItems = getRandomItems(COORG_MENU_ITEMS.mainCourse, 1, 2);
  const starterItems = getRandomItems(COORG_MENU_ITEMS.starters, 0, 2);
  const dessertItems = getRandomItems(COORG_MENU_ITEMS.desserts, 0, 1);
  const beverageItems = getRandomItems(COORG_MENU_ITEMS.beverages, 0, 1);

  const allItems = [...biryaniItems, ...mainItems, ...starterItems, ...dessertItems, ...beverageItems];

  // Zomato shows individual item prices
  let total = 0;
  const cartItems = allItems.map((item, idx) => {
    const quantity = Math.random() > 0.6 ? 2 : 1;
    const itemTotal = item.price * quantity;
    total += itemTotal;

    return {
      id: `${orderId}-item-${idx}`,
      name: item.name,
      quantity,
      // Zomato extraction gets individual prices from UI
      price: item.price,
      total: itemTotal,
      specialInstructions: Math.random() > 0.9 ? 'Less oil' : null,
      variants: [],
      addons: [],
    };
  });

  const order: AggregatorOrder = {
    aggregator: 'zomato',
    aggregatorOrderId: zomatoOrderId,
    // Zomato status from header: "pending", "preparing", "ready", "picked_up"
    aggregatorStatus: 'pending',
    orderId: orderId,
    // Zomato order number is the long order ID
    orderNumber: zomatoOrderId,
    status: 'pending' as AggregatorOrderStatus,
    orderType: 'delivery',
    createdAt: new Date().toISOString(),
    customer: {
      // Zomato shows customer name
      name: customer,
      // CRITICAL: Zomato NEVER exposes customer phone - always empty string then null
      phone: null,
      // Zomato shows delivery address
      address: address,
      // Zomato sometimes has coordinates
      coordinates: null,
    },
    cart: {
      items: cartItems,
      subtotal: total,
      // Zomato extraction gets total from ₹XXX display
      tax: 0,
      deliveryFee: 0,
      platformFee: 0,
      discount: 0,
      total: total,
    },
    payment: {
      // Extraction assumes online payment
      method: 'online',
      status: 'paid',
      isPrepaid: true,
    },
    specialInstructions: null,
    ...overrides,
  };

  return order;
}

/**
 * Add a mock Swiggy order to the store
 */
export async function addMockSwiggyOrder(): Promise<AggregatorOrder> {
  const { useAggregatorStore } = await import('../stores/aggregatorStore');
  const order = createMockSwiggyOrder();
  useAggregatorStore.getState().addOrder(order);
  console.log('[MockOrders] Added Swiggy order:', order.orderNumber);
  return order;
}

/**
 * Add a mock Zomato order to the store
 */
export async function addMockZomatoOrder(): Promise<AggregatorOrder> {
  const { useAggregatorStore } = await import('../stores/aggregatorStore');
  const order = createMockZomatoOrder();
  useAggregatorStore.getState().addOrder(order);
  console.log('[MockOrders] Added Zomato order:', order.orderNumber);
  return order;
}

/**
 * Add both Swiggy and Zomato mock orders
 */
export async function addMockOrders(): Promise<{ swiggy: AggregatorOrder; zomato: AggregatorOrder }> {
  const swiggy = await addMockSwiggyOrder();
  const zomato = await addMockZomatoOrder();
  return { swiggy, zomato };
}

// Expose to window for console testing
if (typeof window !== 'undefined') {
  (window as any).mockOrders = {
    addSwiggy: addMockSwiggyOrder,
    addZomato: addMockZomatoOrder,
    addBoth: addMockOrders,
    createSwiggy: createMockSwiggyOrder,
    createZomato: createMockZomatoOrder,
  };
  console.log('[MockOrders] Available: window.mockOrders.addSwiggy(), .addZomato(), .addBoth()');
}
