/**
 * Inventory Management Types
 * Supports suppliers, inventory items, recipe linking, and AI-powered bill scanning
 */

// Category types for inventory items
export type InventoryCategory =
  | 'produce'
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'dry_goods'
  | 'beverages'
  | 'supplies'
  | 'other';

// Unit types for measurements
export type InventoryUnit =
  | 'kg'
  | 'g'
  | 'l'
  | 'ml'
  | 'pcs'
  | 'box'
  | 'dozen'
  | 'pack'
  | 'bottle'
  | 'can'
  | 'bag'
  | 'bunch'
  | 'unit';

// Document types for scanned bills
export type DocumentType =
  | 'invoice'
  | 'bill'
  | 'receipt'
  | 'handwritten_note'
  | 'camera_capture';

// OCR processing status
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';

// OCR provider used
export type OcrProvider = 'gemini' | 'deepseek' | 'cloudflare-ai';

// Transaction types for audit trail
export type TransactionType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'waste'
  | 'transfer'
  | 'return';

// OCR Template for supplier-specific document parsing
export interface SupplierOcrTemplate {
  // Field name mappings (common column headers used by this supplier)
  fieldMappings?: {
    itemName?: string[];      // e.g., ["Item", "Description", "Product Name"]
    quantity?: string[];      // e.g., ["Qty", "Quantity", "Units"]
    unitPrice?: string[];     // e.g., ["Rate", "Price", "Unit Price"]
    total?: string[];         // e.g., ["Amount", "Total", "Line Total"]
    invoiceNumber?: string[]; // e.g., ["Invoice No", "Bill No", "Ref"]
    invoiceDate?: string[];   // e.g., ["Date", "Invoice Date", "Bill Date"]
  };

  // Parsing rules specific to this supplier
  parsingRules?: {
    dateFormat?: string;        // e.g., "DD/MM/YYYY", "DD-MMM-YYYY"
    currencySymbol?: string;    // e.g., "Rs.", "INR", "₹"
    decimalSeparator?: '.' | ',';
    thousandSeparator?: ',' | '.';
  };

  // Item name aliases (supplier name -> standard name)
  itemAliases?: Record<string, string>;  // e.g., {"Tom 1kg": "Tomatoes", "Aloo": "Potato"}

  // Expected categories for this supplier (helps with item categorization)
  expectedCategories?: InventoryCategory[];

  // Sample invoice number format (for validation/extraction hints)
  invoiceNumberFormat?: string;  // e.g., "INV-####" or "BILL/YY/####"

  // Notes about document layout
  layoutNotes?: string;
}

// Supplier interface
export interface Supplier {
  id: string;
  tenantId?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  // Enhanced vendor fields from API
  gstin?: string;
  taxId?: string;
  businessType?: string;
  paymentTerms?: string;
  currency?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  upiId?: string;
  category?: string;
  rating?: number;
  isVerified?: boolean;
  website?: string;
  totalOrders?: number;
  totalSpent?: number;
  createdAt?: string;
  updatedAt?: string;
  // OCR template for document scanning
  ocrTemplate?: SupplierOcrTemplate;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  gstin?: string;
  taxId?: string;
  businessType?: string;
  paymentTerms?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  upiId?: string;
  category?: string;
  website?: string;
}

// Inventory Item interface
export interface InventoryItem {
  id: string;
  tenantId?: string;
  name: string;
  sku?: string;
  category: InventoryCategory;
  currentStock: number;
  unit: InventoryUnit | string;
  pricePerUnit?: number;
  reorderLevel: number;
  supplierId?: string;
  storageLocation?: string;
  expiryDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  // Joined data
  supplier?: Supplier;
}

export interface CreateInventoryItemInput {
  name: string;
  sku?: string;
  category: InventoryCategory;
  currentStock?: number;
  unit: InventoryUnit | string;
  pricePerUnit?: number;
  reorderLevel?: number;
  supplierId?: string;
  storageLocation?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdateInventoryItemInput {
  name?: string;
  sku?: string;
  category?: InventoryCategory;
  currentStock?: number;
  unit?: InventoryUnit | string;
  pricePerUnit?: number;
  reorderLevel?: number;
  supplierId?: string;
  storageLocation?: string;
  expiryDate?: string;
  notes?: string;
}

// Recipe Ingredient (links menu items to inventory)
export interface RecipeIngredient {
  id: string;
  tenantId?: string;
  recipeId?: string;
  menuItemId?: string;
  inventoryItemId: string;
  quantity: number;
  quantityRequired?: number;
  unit: InventoryUnit | string;
  wastePercentage?: number;
  createdAt?: string;
  // Joined data
  inventoryItem?: InventoryItem;
}

export interface CreateRecipeIngredientInput {
  menuItemId: string;
  inventoryItemId: string;
  quantityRequired: number;
  unit: InventoryUnit;
}

// Inventory Document (scanned bills/invoices)
export interface InventoryDocument {
  id: string;
  tenantId: string;
  documentType: DocumentType;
  supplierId?: string;
  filePath?: string;
  ocrStatus: OcrStatus;
  ocrProvider?: OcrProvider;
  extractedData?: ExtractedDocumentData;
  totalAmount?: number;
  taxAmount?: number;
  documentDate?: string;
  invoiceNumber?: string;
  processingTimeMs?: number;
  confidenceScore?: number;
  createdAt: string;
  updatedAt: string;
  // Joined data
  supplier?: Supplier;
}

// Extracted data from OCR
export interface ExtractedDocumentData {
  items: ExtractedItem[];
  supplier?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  invoiceNumber?: string;
  invoiceDate?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  rawText?: string;
}

export interface ExtractedItem {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  confidence: number; // 0-1 confidence score
  // Matching info
  matchedInventoryItemId?: string;
  isNewItem?: boolean;
}

// Inventory Transaction (audit trail)
export interface InventoryTransaction {
  id: string;
  tenantId: string;
  itemId: string;
  documentId?: string;
  transactionType: TransactionType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  unitPrice?: number;
  reason?: string;
  recordedBy?: string;
  createdAt: string;
  // Joined data
  item?: InventoryItem;
  document?: InventoryDocument;
}

// Stock adjustment input
export interface StockAdjustmentInput {
  itemId: string;
  quantityChange: number;
  transactionType: TransactionType;
  reason?: string;
  unitPrice?: number;
  documentId?: string;
}

// Bill scan result from Vision API
export interface BillScanResult {
  documentId: string;
  status: OcrStatus;
  provider?: OcrProvider;
  processingTimeMs?: number;
  extractedData?: ExtractedDocumentData;
  confidenceScore?: number;
  error?: string;
}

// Inventory alerts
export interface LowStockAlert {
  itemId: string;
  itemName: string;
  currentStock: number;
  reorderLevel: number;
  unit: InventoryUnit | string;
  deficit?: number;
  item?: InventoryItem;
}

export interface ExpiryAlert {
  itemId: string;
  itemName: string;
  expiryDate: string;
  currentStock: number;
  unit: InventoryUnit | string;
  daysUntilExpiry: number;
  item?: InventoryItem;
}

// Inventory summary stats
export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  expiringSoonCount: number;
  byCategory?: Record<InventoryCategory, { count: number; value: number }>;
  categoryBreakdown?: Record<string, { count: number; value: number }>;
}

// Database row types (for SQLite mapping)
export interface SupplierRow {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemRow {
  id: string;
  tenant_id: string;
  name: string;
  sku: string | null;
  category: string;
  current_stock: number;
  unit: string;
  price_per_unit: number | null;
  reorder_level: number;
  supplier_id: string | null;
  storage_location: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryDocumentRow {
  id: string;
  tenant_id: string;
  document_type: string;
  supplier_id: string | null;
  file_path: string | null;
  ocr_status: string;
  ocr_provider: string | null;
  extracted_data: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  document_date: string | null;
  invoice_number: string | null;
  processing_time_ms: number | null;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransactionRow {
  id: string;
  tenant_id: string;
  item_id: string;
  document_id: string | null;
  transaction_type: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  unit_price: number | null;
  reason: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface RecipeIngredientRow {
  id: string;
  tenant_id: string;
  menu_item_id: string;
  inventory_item_id: string;
  quantity_required: number;
  unit: string;
  created_at: string;
}

// Category display info
export const INVENTORY_CATEGORIES: Record<InventoryCategory, { label: string; icon: string }> = {
  produce: { label: 'Produce', icon: '🥬' },
  meat: { label: 'Meat', icon: '🥩' },
  seafood: { label: 'Seafood', icon: '🐟' },
  dairy: { label: 'Dairy', icon: '🧀' },
  dry_goods: { label: 'Dry Goods', icon: '🌾' },
  beverages: { label: 'Beverages', icon: '🥤' },
  supplies: { label: 'Supplies', icon: '📦' },
  other: { label: 'Other', icon: '📋' },
};

// Unit display info
export const INVENTORY_UNITS: Record<InventoryUnit, { label: string; abbreviation: string }> = {
  kg: { label: 'Kilogram', abbreviation: 'kg' },
  g: { label: 'Gram', abbreviation: 'g' },
  l: { label: 'Liter', abbreviation: 'L' },
  ml: { label: 'Milliliter', abbreviation: 'mL' },
  pcs: { label: 'Pieces', abbreviation: 'pcs' },
  box: { label: 'Box', abbreviation: 'box' },
  dozen: { label: 'Dozen', abbreviation: 'dz' },
  pack: { label: 'Pack', abbreviation: 'pk' },
  bottle: { label: 'Bottle', abbreviation: 'btl' },
  can: { label: 'Can', abbreviation: 'can' },
  bag: { label: 'Bag', abbreviation: 'bag' },
  bunch: { label: 'Bunch', abbreviation: 'bch' },
  unit: { label: 'Unit', abbreviation: 'unit' },
};

// ==================== DELIVERY VERIFICATION ====================

/**
 * Status of a delivery verification session
 */
export type DeliveryVerificationStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Status of an individual item in delivery verification
 */
export type DeliveryItemStatus = 'pending' | 'matched' | 'missing' | 'extra' | 'quantity_mismatch';

/**
 * Expected item in a purchase order/delivery
 */
export interface ExpectedDeliveryItem {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  expectedQuantity: number;
  unit: string;
  unitPrice?: number;
  inventoryItemId?: string;
}

/**
 * Scanned/received item during verification
 */
export interface ScannedDeliveryItem {
  id: string;
  barcode: string;
  barcodeFormat: string;
  scannedAt: string;
  matchedExpectedItemId?: string;
  inventoryItemId?: string;
  name?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
}

/**
 * Verification result for a single item
 */
export interface DeliveryItemVerification {
  expectedItemId?: string;
  scannedItemId?: string;
  status: DeliveryItemStatus;
  expectedQuantity: number;
  receivedQuantity: number;
  quantityDifference: number;
  name: string;
  barcode?: string;
  notes?: string;
}

/**
 * Complete delivery verification session
 */
export interface DeliveryVerificationSession {
  id: string;
  tenantId: string;
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  status: DeliveryVerificationStatus;
  expectedItems: ExpectedDeliveryItem[];
  scannedItems: ScannedDeliveryItem[];
  verificationResults: DeliveryItemVerification[];
  // Summary stats
  totalExpected: number;
  totalReceived: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  mismatchCount: number;
  // Timestamps
  startedAt: string;
  completedAt?: string;
  createdBy?: string;
}

/**
 * Barcode-to-inventory mapping for quick lookups
 */
export interface BarcodeMapping {
  barcode: string;
  inventoryItemId: string;
  itemName: string;
  defaultUnit?: string;
  defaultPrice?: number;
}
