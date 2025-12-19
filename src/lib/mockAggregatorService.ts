/**
 * Mock Aggregator Service
 * Simulates Swiggy/Zomato orders for testing without real API keys
 */

import type { AggregatorOrder } from '../types/aggregator';

// Mock menu items pool
const MOCK_MENU_ITEMS = [
  { name: 'Margherita Pizza', price: 299, category: 'Pizza' },
  { name: 'Pepperoni Pizza', price: 349, category: 'Pizza' },
  { name: 'Chicken Tikka Pizza', price: 399, category: 'Pizza' },
  { name: 'Grilled Chicken', price: 450, category: 'Main Course' },
  { name: 'Butter Chicken', price: 380, category: 'Main Course' },
  { name: 'Paneer Tikka Masala', price: 320, category: 'Main Course' },
  { name: 'Chicken Biryani', price: 280, category: 'Biryani' },
  { name: 'Veg Biryani', price: 220, category: 'Biryani' },
  { name: 'Mutton Biryani', price: 350, category: 'Biryani' },
  { name: 'Caesar Salad', price: 180, category: 'Salads' },
  { name: 'Greek Salad', price: 200, category: 'Salads' },
  { name: 'Chicken Wings (6pc)', price: 240, category: 'Appetizers' },
  { name: 'French Fries', price: 120, category: 'Appetizers' },
  { name: 'Garlic Bread', price: 140, category: 'Appetizers' },
  { name: 'Chocolate Brownie', price: 150, category: 'Desserts' },
  { name: 'Ice Cream Sundae', price: 160, category: 'Desserts' },
  { name: 'Coca Cola', price: 50, category: 'Beverages' },
  { name: 'Fresh Lime Soda', price: 60, category: 'Beverages' },
  { name: 'Mango Lassi', price: 80, category: 'Beverages' },
  { name: 'Masala Dosa', price: 140, category: 'South Indian' },
  { name: 'Idli Sambar', price: 100, category: 'South Indian' },
  { name: 'Chicken Fried Rice', price: 200, category: 'Chinese' },
  { name: 'Veg Hakka Noodles', price: 180, category: 'Chinese' },
  { name: 'Chilli Chicken', price: 280, category: 'Chinese' },
  { name: 'Dal Tadka', price: 180, category: 'Main Course' },
  { name: 'Naan (2pc)', price: 50, category: 'Bread' },
  { name: 'Garlic Naan (2pc)', price: 70, category: 'Bread' },
];

// Mock customer names
const FIRST_NAMES = ['Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anita', 'Rahul', 'Pooja', 'Sanjay', 'Kavita', 'Arjun', 'Neha', 'Kiran', 'Deepak', 'Meera'];
const LAST_NAMES = ['Kumar', 'Sharma', 'Singh', 'Patel', 'Verma', 'Reddy', 'Gupta', 'Rao', 'Nair', 'Mehta', 'Joshi', 'Kapoor', 'Shah', 'Desai', 'Iyer'];

// Mock delivery areas
const AREAS = ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'Jayanagar', 'Marathahalli', 'BTM Layout', 'Electronic City', 'JP Nagar', 'Malleshwaram'];
const STREETS = ['Main Road', '1st Cross', '2nd Cross', '3rd Main', 'Ring Road', 'Outer Ring Road'];

// Order ID counters
let zomatoOrderCounter = 1000;
let swiggyOrderCounter = 2000;

/**
 * Generate a random number within range
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick random item from array
 */
function randomItem<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

/**
 * Generate a random phone number
 */
function generatePhoneNumber(): string {
  return `+91 ${randomInt(70000, 99999)} ${randomInt(10000, 99999)}`;
}

/**
 * Generate random customer name
 */
function generateCustomerName(): string {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

/**
 * Generate random delivery address
 */
function generateAddress(): string {
  const houseNo = randomInt(1, 999);
  const area = randomItem(AREAS);
  const street = randomItem(STREETS);
  return `${houseNo}, ${street}, ${area}, Bangalore - ${randomInt(560001, 560100)}`;
}

/**
 * Generate random order items (1-5 items)
 */
function generateOrderItems() {
  const itemCount = randomInt(1, 5);
  const selectedItems = new Set<number>();
  const items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
    specialInstructions?: string;
  }> = [];

  // Select unique items
  while (selectedItems.size < itemCount) {
    selectedItems.add(randomInt(0, MOCK_MENU_ITEMS.length - 1));
  }

  let subtotal = 0;

  Array.from(selectedItems).forEach((index) => {
    const menuItem = MOCK_MENU_ITEMS[index];
    const quantity = randomInt(1, 3);
    const itemTotal = menuItem.price * quantity;
    subtotal += itemTotal;

    items.push({
      id: `item-${Date.now()}-${index}`,
      name: menuItem.name,
      quantity,
      price: menuItem.price,
      total: itemTotal,
      specialInstructions: Math.random() > 0.7 ? randomItem([
        'Extra spicy',
        'Less oil',
        'No onions',
        'Extra cheese',
        'Medium spice',
        'Well done',
        'No garlic',
        'Extra sauce'
      ]) : undefined,
    });
  });

  return { items, subtotal };
}

/**
 * Generate a mock Zomato order
 */
export function generateMockZomatoOrder(): AggregatorOrder {
  const orderNum = zomatoOrderCounter++;
  const orderId = `zomato_${orderNum}`;
  const aggregatorOrderId = `ZOM-${Date.now()}-${randomInt(1000, 9999)}`;

  const { items, subtotal } = generateOrderItems();
  const deliveryFee = randomInt(20, 50);
  const tax = Math.round(subtotal * 0.05); // 5% tax
  const platformFee = 5;
  const discount = 0;
  const total = subtotal + deliveryFee + tax + platformFee - discount;

  const preparationTime = randomInt(15, 35);
  const now = new Date();
  const estimatedDelivery = new Date(now.getTime() + preparationTime * 60000);

  // Convert items to proper format
  const aggregatorItems = items.map(item => ({
    ...item,
    variants: [],
    addons: [],
  }));

  return {
    aggregator: 'zomato',
    aggregatorOrderId,
    aggregatorStatus: 'PENDING',

    orderId,
    orderNumber: `ZOM${orderNum}`,
    status: 'pending',
    orderType: 'delivery',

    createdAt: now.toISOString(),
    acceptedAt: null,
    readyAt: null,
    deliveredAt: null,

    customer: {
      name: generateCustomerName(),
      phone: generatePhoneNumber(),
      address: generateAddress(),
    },

    cart: {
      items: aggregatorItems,
      subtotal,
      tax,
      deliveryFee,
      platformFee,
      discount,
      total,
    },

    payment: {
      method: randomItem(['online', 'cash']),
      status: Math.random() > 0.3 ? 'paid' : 'pending',
      isPrepaid: Math.random() > 0.3,
    },

    delivery: {
      type: 'aggregator',
      estimatedTime: estimatedDelivery.toISOString(),
      instructions: Math.random() > 0.6 ? randomItem([
        'Please call before arriving',
        'Ring the bell twice',
        'Leave at door',
        'Contactless delivery',
        'Call on arrival',
        'Deliver to security'
      ]) : null,
      driverName: null,
      driverPhone: null,
    },

    specialInstructions: Math.random() > 0.7 ? randomItem([
      'Handle with care',
      'Extra packaging required',
      'No onions',
      'Less spicy'
    ]) : null,
  };
}

/**
 * Generate a mock Swiggy order
 */
export function generateMockSwiggyOrder(): AggregatorOrder {
  const orderNum = swiggyOrderCounter++;
  const orderId = `swiggy_${orderNum}`;
  const aggregatorOrderId = `SWG-${Date.now()}-${randomInt(1000, 9999)}`;

  const { items, subtotal } = generateOrderItems();
  const deliveryFee = randomInt(15, 45);
  const tax = Math.round(subtotal * 0.05); // 5% tax
  const platformFee = 3;
  const discount = 0;
  const total = subtotal + deliveryFee + tax + platformFee - discount;

  const preparationTime = randomInt(15, 35);
  const now = new Date();
  const estimatedDelivery = new Date(now.getTime() + preparationTime * 60000);

  // Convert items to proper format
  const aggregatorItems = items.map(item => ({
    ...item,
    variants: [],
    addons: [],
  }));

  return {
    aggregator: 'swiggy',
    aggregatorOrderId,
    aggregatorStatus: 'PLACED',

    orderId,
    orderNumber: `SWG${orderNum}`,
    status: 'pending',
    orderType: 'delivery',

    createdAt: now.toISOString(),
    acceptedAt: null,
    readyAt: null,
    deliveredAt: null,

    customer: {
      name: generateCustomerName(),
      phone: generatePhoneNumber(),
      address: generateAddress(),
    },

    cart: {
      items: aggregatorItems,
      subtotal,
      tax,
      deliveryFee,
      platformFee,
      discount,
      total,
    },

    payment: {
      method: randomItem(['online', 'cash']),
      status: Math.random() > 0.2 ? 'paid' : 'pending',
      isPrepaid: Math.random() > 0.2,
    },

    delivery: {
      type: 'aggregator',
      estimatedTime: estimatedDelivery.toISOString(),
      instructions: Math.random() > 0.6 ? randomItem([
        'Extra packaging required',
        'Delivery partner to call before arriving',
        'Gate code: 1234',
        'Please handle with care',
        'Leave at reception',
        'Ring doorbell'
      ]) : null,
      driverName: null,
      driverPhone: null,
    },

    specialInstructions: Math.random() > 0.7 ? randomItem([
      'No plastic cutlery',
      'Add extra napkins',
      'Pack separately',
      'Extra sauce packets'
    ]) : null,
  };
}

/**
 * Generate a random order from either platform
 */
export function generateRandomOrder(): AggregatorOrder {
  return Math.random() > 0.5 ? generateMockZomatoOrder() : generateMockSwiggyOrder();
}

/**
 * Mock Aggregator Service Class
 */
export class MockAggregatorService {
  private intervalId: number | null = null;
  private onOrderCallback: ((order: AggregatorOrder) => void) | null = null;

  /**
   * Set callback for when new orders are generated
   */
  setOrderCallback(callback: (order: AggregatorOrder) => void) {
    this.onOrderCallback = callback;
  }

  /**
   * Generate a single mock order
   */
  generateOrder(platform?: 'zomato' | 'swiggy'): AggregatorOrder {
    const order = platform === 'zomato'
      ? generateMockZomatoOrder()
      : platform === 'swiggy'
      ? generateMockSwiggyOrder()
      : generateRandomOrder();

    if (this.onOrderCallback) {
      this.onOrderCallback(order);
    }

    console.log(`[MockAggregator] Generated ${order.aggregator} order:`, order.orderId);
    return order;
  }

  /**
   * Start auto-generating orders at intervals
   */
  startAutoGenerate(intervalSeconds: number = 30) {
    if (this.intervalId) {
      console.warn('[MockAggregator] Auto-generate already running');
      return;
    }

    console.log(`[MockAggregator] Starting auto-generate (every ${intervalSeconds}s)`);

    this.intervalId = window.setInterval(() => {
      this.generateOrder();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop auto-generating orders
   */
  stopAutoGenerate() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MockAggregator] Stopped auto-generate');
    }
  }

  /**
   * Check if auto-generate is running
   */
  isAutoGenerating(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Generate bulk orders (for testing)
   */
  generateBulk(count: number): AggregatorOrder[] {
    const orders: AggregatorOrder[] = [];
    for (let i = 0; i < count; i++) {
      orders.push(this.generateOrder());
    }
    return orders;
  }
}

// Export singleton instance
export const mockAggregatorService = new MockAggregatorService();
