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

// Supplier interface
export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

// Inventory Item interface
export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  sku?: string;
  category: InventoryCategory;
  currentStock: number;
  unit: InventoryUnit;
  pricePerUnit?: number;
  reorderLevel: number;
  supplierId?: string;
  storageLocation?: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  supplier?: Supplier;
}

export interface CreateInventoryItemInput {
  name: string;
  sku?: string;
  category: InventoryCategory;
  currentStock?: number;
  unit: InventoryUnit;
  pricePerUnit?: number;
  reorderLevel?: number;
  supplierId?: string;
  storageLocation?: string;
  expiryDate?: string;
}

export interface UpdateInventoryItemInput {
  name?: string;
  sku?: string;
  category?: InventoryCategory;
  unit?: InventoryUnit;
  pricePerUnit?: number;
  reorderLevel?: number;
  supplierId?: string;
  storageLocation?: string;
  expiryDate?: string;
}

// Recipe Ingredient (links menu items to inventory)
export interface RecipeIngredient {
  id: string;
  tenantId: string;
  menuItemId: string;
  inventoryItemId: string;
  quantityRequired: number;
  unit: InventoryUnit;
  createdAt: string;
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
  item: InventoryItem;
  currentStock: number;
  reorderLevel: number;
  deficit: number;
}

export interface ExpiryAlert {
  item: InventoryItem;
  expiryDate: string;
  daysUntilExpiry: number;
}

// Inventory summary stats
export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  expiringSoonCount: number;
  byCategory: Record<InventoryCategory, { count: number; value: number }>;
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
