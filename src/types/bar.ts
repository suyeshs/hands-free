/**
 * Bar Management System Types
 * Comprehensive type definitions for bar operations, inventory, and closing
 * Created: 2026-01-23
 */

// ============================================
// Bar Order Types (mirroring KDS structure)
// ============================================

export type BarOrderStatus = 'pending' | 'in_progress' | 'ready' | 'completed';
export type BarItemStatus = 'pending' | 'in_progress' | 'ready' | 'served';

export interface DrinkModifier {
  name: string;
  value: string;
}

export interface IngredientUsage {
  inventoryItemId: string;
  itemName: string;
  quantityMl: number;
  costPerMl: number;
  totalCost: number;
}

export interface BarOrderItem {
  id: string;
  name: string;
  quantity: number;
  status: BarItemStatus;
  specialInstructions?: string | null;
  modifiers: DrinkModifier[];
  station?: string;

  // Drink-specific fields
  servingSize?: 'shot' | 'peg' | 'glass' | 'bottle' | 'pitcher';
  strength?: 'single' | 'double' | 'triple';
  ice?: 'regular' | 'no-ice' | 'extra-ice' | 'crushed';

  // Inventory tracking
  recipeId?: string;
  ingredientUsage?: IngredientUsage[];
}

export interface BarOrder {
  id: string;
  orderNumber: string;
  orderType: 'dine-in' | 'delivery' | 'pickup' | 'aggregator';
  source?: 'pos' | 'bar-pos' | 'zomato' | 'swiggy' | 'online';
  status: BarOrderStatus;

  // Versioning for conflict resolution
  version: number;
  updatedAt: string;

  // Timestamps
  createdAt: string;
  acceptedAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;

  // Items
  items: BarOrderItem[];

  // Table info (for dine-in)
  tableNumber?: number | null;

  // Priority/urgency
  isUrgent: boolean;
  elapsedMinutes: number;
  priority?: number;

  // Running order (additional BOT for existing table session)
  isRunningOrder?: boolean;
  botSequence?: number;

  // Aggregator specific
  aggregator?: 'zomato' | 'swiggy';
  estimatedPrepTime?: number;
}

export type BarStation =
  | 'all'
  | 'bar'
  | 'cocktails'
  | 'wine'
  | 'beer'
  | 'coffee';

export interface BarStats {
  activeOrders: number;
  pendingItems: number;
  averagePrepTime: number;
  oldestOrderMinutes: number;
}

// ============================================
// Bar Inventory Types
// ============================================

export type BarInventoryCategory =
  | 'spirits'
  | 'wine'
  | 'beer'
  | 'mixers'
  | 'garnishes'
  | 'glassware';

export type SpiritSubcategory =
  | 'whiskey'
  | 'vodka'
  | 'gin'
  | 'rum'
  | 'tequila'
  | 'brandy'
  | 'liqueur'
  | 'other';

export interface BarInventoryItem {
  id: string;
  tenantId: string;
  inventoryItemId?: string; // FK to main inventory_items (optional integration)
  name: string;
  category: BarInventoryCategory;
  subcategory?: string;

  // Container details
  containerType?: 'bottle' | 'keg' | 'can' | 'jar';
  containerSizeMl: number;
  costPerContainer: number;

  // Current stock
  fullContainers: number;
  partialContainerMl: number;

  // Par levels
  parLevel: number;
  reorderPoint: number;

  // Tracking
  lastRestockedAt?: string;
  lastCountedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarRecipe {
  id: string;
  tenantId: string;
  menuItemId: string;
  drinkName: string;
  category?: 'cocktail' | 'shot' | 'mixed' | 'beer' | 'wine';
  glassware?: string;
  iceType?: string;
  ingredients: BarRecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export interface BarRecipeIngredient {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantityMl: number;
  quantityUnit: string;
  isOptional: boolean;
  sortOrder: number;
  inventoryItem?: BarInventoryItem;
}

export type TransactionType = 'sale' | 'waste' | 'restock' | 'adjustment' | 'count';

export interface BarInventoryTransaction {
  id: string;
  tenantId: string;
  inventoryItemId: string;
  transactionType: TransactionType;
  quantityMl: number;
  barOrderId?: string;
  barOrderItemId?: string;
  staffId?: string;
  staffName?: string;
  costPerMl?: number;
  totalCost?: number;
  reason?: string;
  notes?: string;
  createdAt: string;
}

// ============================================
// Bar Closing Types
// ============================================

export interface BarClosingSession {
  id: string;
  tenantId: string;
  sessionDate: string; // YYYY-MM-DD
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'counting' | 'closed';
  openedByStaffId?: string;
  closedByStaffId?: string;

  // Cash reconciliation
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  varianceCash?: number;

  // Sales summary
  totalOrders: number;
  totalItemsSold: number;
  grossRevenue: number;

  // Inventory summary
  itemsCounted: number;
  totalVarianceMl: number;
  totalWasteMl: number;

  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Related data
  counts?: BarClosingCount[];
}

export interface BarClosingCount {
  id: string;
  closingSessionId: string;
  inventoryItemId: string;

  // Expected vs Actual
  expectedFullBottles: number;
  expectedPartialMl: number;
  actualFullBottles: number;
  actualPartialMl: number;

  // Variance
  varianceBottles: number;
  varianceMl: number;
  varianceCost: number;

  notes?: string;
  countedAt: string;

  // Related data
  inventoryItem?: BarInventoryItem;
}

// ============================================
// Bar Reporting Types
// ============================================

export interface UsageSummary {
  itemId: string;
  itemName: string;
  category: BarInventoryCategory;
  totalUsageMl: number;
  totalCost: number;
  drinksSold: number;
  averagePourMl: number;
}

export interface DailySalesSummary {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
  averageTicket: number;

  // By category
  salesByCategory: {
    category: BarInventoryCategory;
    revenue: number;
    itemsSold: number;
  }[];

  // Hourly breakdown
  hourlyBreakdown: {
    hour: number;
    revenue: number;
    orders: number;
  }[];

  // Payment methods
  paymentMethodBreakdown: {
    method: string;
    amount: number;
    percentage: number;
  }[];
}

export interface VarianceReport {
  sessionId: string;
  sessionDate: string;
  totalVarianceMl: number;
  totalVarianceCost: number;
  variancePercentage: number;

  // By item
  itemVariances: {
    itemId: string;
    itemName: string;
    category: BarInventoryCategory;
    expectedMl: number;
    actualMl: number;
    varianceMl: number;
    varianceCost: number;
  }[];
}

export interface PourCostAnalysis {
  drinkId: string;
  drinkName: string;
  category: string;

  // Sales data
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;

  // Cost data
  totalCost: number;
  averageCost: number;

  // Analysis
  pourCostPercentage: number; // (cost / revenue) * 100
  profitMargin: number; // (revenue - cost) / revenue
  profitPerDrink: number; // revenue - cost
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;

  // Sales metrics
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  averageTicket: number;

  // Efficiency
  drinksPerHour: number;
  averageOrderTime: number; // minutes

  // Hours worked
  hoursWorked: number;
  revenuePerHour: number;
}

// ============================================
// Bar Settings Types
// ============================================

export interface BarInventorySettings {
  trackingMode: 'bottle' | 'pour';
  autoDeductOnOrder: boolean; // Auto-deduct on order completion vs manual entry
  requirePourConfirmation: boolean; // Bartender confirms each pour
  lowStockThreshold: number; // Percentage of par level
  enableAutoReorder: boolean;
}

export interface BarPOSSettings {
  showFavorites: boolean;
  favoritesCount: number;
  enableQuickModifiers: boolean;
  defaultIce: string;
  defaultStrength: string;
  requireTableSelection: boolean;
  enableTabManagement: boolean;
}

// ============================================
// Bar POS Cart Types
// ============================================

export interface BarCartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: DrinkModifier[];
  specialInstructions?: string;

  // Drink options
  servingSize?: string;
  strength?: string;
  ice?: string;

  // Recipe/inventory
  recipeId?: string;
  estimatedCost?: number;
}

export interface BarTab {
  id: string;
  tableNumber?: number;
  tabName: string;
  openedAt: string;
  openedBy: string;
  items: BarCartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  status: 'open' | 'closed' | 'pending-payment';
}
