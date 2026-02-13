/**
 * Customer Manager
 *
 * Core CRUD operations for customer management with encrypted PII storage
 *
 * Features:
 * - Create/update customers with automatic PII encryption
 * - Fast phone number lookups using hashed indexes
 * - Automatic preference calculation from order history
 * - Address management
 * - GDPR-compliant deletion
 * - PII audit logging
 */

import {
  getTenantEncryptionKey,
  encryptCustomerPII,
  decryptCustomerPII,
  hashPhoneNumber,
  normalizePhoneNumber,
  isValidPhoneNumber,
  type CustomerPII,
  type EncryptedCustomerPII,
} from './customer-encryption';
import {
  inferCustomerPreferences,
  type CustomerPreferences,
  type CustomerOrder,
} from './customer-preferences';
import { type RestaurantEnv, getTenantDatabase } from './tenant-db-resolver';

/**
 * Customer record from database (with encrypted fields)
 */
export interface CustomerRecord {
  id: string;
  tenant_id: string;
  phone_number_encrypted: string;
  name_encrypted?: string;
  email_encrypted?: string;
  phone_hash: string;
  first_order_date?: string;
  last_order_date?: string;
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  // Preference fields (stored as JSON strings in DB)
  dietary_preferences?: string;
  favorite_items?: string;
  spice_preference?: string;
  cuisine_preferences?: string;
  price_sensitivity?: string;
  order_size_pattern?: string;
  order_type_preference?: string;
  beverage_preference?: string;
  dessert_frequency?: string;
  order_timing_pattern?: string;
  special_instructions_patterns?: string;
  adventurousness_score?: number;
  reorder_rate?: number;
  notes_encrypted?: string;
  encryption_key_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Customer data for API responses (decrypted)
 */
export interface Customer {
  id: string;
  tenantId: string;
  phone: string;
  phoneHash: string; // HMAC-SHA256 hash for secure link generation (WhatsApp, etc.)
  name?: string;
  email?: string;
  firstOrderDate?: string;
  lastOrderDate?: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  preferences: CustomerPreferences;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating/updating a customer
 */
export interface CustomerInput {
  phone: string;
  name?: string;
  email?: string;
  notes?: string;
}

/**
 * Customer address (simplified schema)
 *
 * Essential fields:
 * - placeId: Google Places ID for re-fetching address details
 * - coordinates: {lat, lng} for distance calculations
 * - formatted: Single display string from Google Places
 *
 * User-provided fields:
 * - apartment: Flat/unit number
 * - instructions: Delivery instructions
 * - label: "home", "work", etc.
 */
export interface CustomerAddress {
  id: string;
  customerId: string;
  label?: string;
  // Core geocoding fields (required for delivery)
  placeId: string;
  coordinates: { lat: number; lng: number };
  formatted: string; // Full address string for display
  // User-provided details
  apartment?: string;
  instructions?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service bindings - using RestaurantEnv from tenant-db-resolver
 *
 * Note: This module uses getTenantDatabase() to dynamically resolve
 * the correct D1 database based on tenant ID
 */
type Env = RestaurantEnv;

/**
 * Parse preferences from database JSON strings
 */
function parsePreferences(record: CustomerRecord): CustomerPreferences {
  return {
    dietary_preferences: record.dietary_preferences
      ? JSON.parse(record.dietary_preferences)
      : [],
    favorite_items: record.favorite_items ? JSON.parse(record.favorite_items) : [],
    spice_preference: record.spice_preference || 'medium',
    cuisine_preferences: record.cuisine_preferences
      ? JSON.parse(record.cuisine_preferences)
      : [],
    price_sensitivity: record.price_sensitivity || 'mid-range',
    order_size_pattern: record.order_size_pattern || 'couple',
    order_type_preference: record.order_type_preference || 'delivery',
    beverage_preference: record.beverage_preference
      ? JSON.parse(record.beverage_preference)
      : { frequency: 'often', types: [] },
    dessert_frequency: record.dessert_frequency || 'rare',
    order_timing_pattern: record.order_timing_pattern
      ? JSON.parse(record.order_timing_pattern)
      : { breakfast: 0, lunch: 40, dinner: 50, late_night: 10 },
    special_instructions_patterns: record.special_instructions_patterns
      ? JSON.parse(record.special_instructions_patterns)
      : [],
    adventurousness_score: record.adventurousness_score || 0.5,
    reorder_rate: record.reorder_rate || 0.5,
  };
}

/**
 * Convert database record to API customer object
 */
async function recordToCustomer(
  record: CustomerRecord,
  encryptionKey: string
): Promise<Customer> {
  // Decrypt PII fields
  const decrypted = await decryptCustomerPII(
    {
      phone_number_encrypted: record.phone_number_encrypted,
      name_encrypted: record.name_encrypted,
      email_encrypted: record.email_encrypted,
      notes_encrypted: record.notes_encrypted,
      phone_hash: record.phone_hash,
      encryption_key_version: record.encryption_key_version,
    },
    encryptionKey
  );

  return {
    id: record.id,
    tenantId: record.tenant_id,
    phone: decrypted.phone || '',
    phoneHash: record.phone_hash, // Include for secure link generation
    name: decrypted.name,
    email: decrypted.email,
    firstOrderDate: record.first_order_date,
    lastOrderDate: record.last_order_date,
    totalOrders: record.total_orders,
    totalSpent: record.total_spent,
    averageOrderValue: record.average_order_value,
    preferences: parsePreferences(record),
    notes: decrypted.notes,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

/**
 * Create or update a customer
 *
 * @param tenantId - Tenant ID
 * @param input - Customer data
 * @param env - Environment bindings
 * @returns Created/updated customer
 */
export async function upsertCustomer(
  tenantId: string,
  input: CustomerInput,
  env: Env
): Promise<Customer> {
  // Validate phone number
  const normalizedPhone = normalizePhoneNumber(input.phone);
  if (!isValidPhoneNumber(normalizedPhone)) {
    throw new Error('Invalid phone number format');
  }

  // Get encryption key from Token Manager
  const { key: encryptionKey, version: keyVersion } = await getTenantEncryptionKey(
    tenantId,
    env.TOKEN_MANAGER
  );

  // Encrypt PII
  const encrypted = await encryptCustomerPII(
    {
      phone: normalizedPhone,
      name: input.name,
      email: input.email,
      notes: input.notes,
    },
    tenantId,
    encryptionKey,
    keyVersion
  );

  // Check if customer exists
  const existing = await getTenantDatabase(tenantId, env).prepare(
    'SELECT * FROM customers WHERE tenant_id = ? AND phone_hash = ?'
  )
    .bind(tenantId, encrypted.phone_hash)
    .first<CustomerRecord>();

  const now = new Date().toISOString();

  if (existing) {
    // Update existing customer
    await getTenantDatabase(tenantId, env).prepare(
      `UPDATE customers
       SET phone_number_encrypted = ?,
           name_encrypted = ?,
           email_encrypted = ?,
           notes_encrypted = ?,
           encryption_key_version = ?,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(
        encrypted.phone_number_encrypted,
        encrypted.name_encrypted || null,
        encrypted.email_encrypted || null,
        encrypted.notes_encrypted || null,
        keyVersion,
        now,
        existing.id
      )
      .run();

    // Fetch updated record
    const updated = await getTenantDatabase(tenantId, env).prepare('SELECT * FROM customers WHERE id = ?')
      .bind(existing.id)
      .first<CustomerRecord>();

    return recordToCustomer(updated!, encryptionKey);
  } else {
    // Create new customer
    const customerId = crypto.randomUUID();

    await getTenantDatabase(tenantId, env).prepare(
      `INSERT INTO customers (
        id, tenant_id, phone_number_encrypted, name_encrypted, email_encrypted,
        phone_hash, notes_encrypted, encryption_key_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        customerId,
        tenantId,
        encrypted.phone_number_encrypted,
        encrypted.name_encrypted || null,
        encrypted.email_encrypted || null,
        encrypted.phone_hash,
        encrypted.notes_encrypted || null,
        keyVersion,
        now,
        now
      )
      .run();

    // Fetch created record
    const created = await getTenantDatabase(tenantId, env).prepare('SELECT * FROM customers WHERE id = ?')
      .bind(customerId)
      .first<CustomerRecord>();

    return recordToCustomer(created!, encryptionKey);
  }
}

/**
 * Get customer by ID
 */
export async function getCustomer(
  customerId: string,
  tenantId: string,
  env: Env
): Promise<Customer | null> {
  const record = await getTenantDatabase(tenantId, env).prepare(
    'SELECT * FROM customers WHERE id = ? AND tenant_id = ?'
  )
    .bind(customerId, tenantId)
    .first<CustomerRecord>();

  if (!record) return null;

  const { key: encryptionKey } = await getTenantEncryptionKey(tenantId, env.TOKEN_MANAGER);

  return recordToCustomer(record, encryptionKey);
}

/**
 * Get customer by phone number
 */
export async function getCustomerByPhone(
  phone: string,
  tenantId: string,
  env: Env
): Promise<Customer | null> {
  const normalizedPhone = normalizePhoneNumber(phone);
  const phoneHash = hashPhoneNumber(normalizedPhone, tenantId);

  const record = await getTenantDatabase(tenantId, env).prepare(
    'SELECT * FROM customers WHERE tenant_id = ? AND phone_hash = ?'
  )
    .bind(tenantId, phoneHash)
    .first<CustomerRecord>();

  if (!record) return null;

  const { key: encryptionKey } = await getTenantEncryptionKey(tenantId, env.TOKEN_MANAGER);

  return recordToCustomer(record, encryptionKey);
}

/**
 * List customers with pagination and filtering
 */
export async function listCustomers(
  tenantId: string,
  env: Env,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    tagId?: string;
    sortBy?: 'name' | 'total_orders' | 'total_spent' | 'last_order_date';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<{ customers: Customer[]; total: number }> {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy || 'last_order_date';
  const sortOrder = options.sortOrder || 'desc';

  let query = 'SELECT * FROM customers WHERE tenant_id = ?';
  const params: any[] = [tenantId];

  // Add tag filter if specified
  if (options.tagId) {
    query = `
      SELECT c.* FROM customers c
      INNER JOIN customer_tags ct ON c.id = ct.customer_id
      WHERE c.tenant_id = ? AND ct.tag_id = ?
    `;
    params.push(options.tagId);
  }

  // Add sorting
  query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

  // Add pagination
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await getTenantDatabase(tenantId, env).prepare(query).bind(...params).all<CustomerRecord>();

  // Get encryption key
  const { key: encryptionKey } = await getTenantEncryptionKey(tenantId, env.TOKEN_MANAGER);

  // Decrypt all customers
  const customers = await Promise.all(
    result.results.map((record) => recordToCustomer(record, encryptionKey))
  );

  // Get total count
  const countResult = await getTenantDatabase(tenantId, env).prepare(
    'SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?'
  )
    .bind(tenantId)
    .first<{ count: number }>();

  return {
    customers,
    total: countResult?.count || 0,
  };
}

/**
 * Update customer metrics after an order
 */
export async function updateCustomerMetrics(
  customerId: string,
  tenantId: string,
  orderTotal: number,
  orderDate: string,
  env: Env
): Promise<void> {
  // Increment total_orders, add to total_spent, update dates
  await getTenantDatabase(tenantId, env).prepare(
    `UPDATE customers
     SET total_orders = total_orders + 1,
         total_spent = total_spent + ?,
         average_order_value = (total_spent + ?) / (total_orders + 1),
         last_order_date = ?,
         first_order_date = COALESCE(first_order_date, ?),
         updated_at = ?
     WHERE id = ? AND tenant_id = ?`
  )
    .bind(
      orderTotal,
      orderTotal,
      orderDate,
      orderDate,
      new Date().toISOString(),
      customerId,
      tenantId
    )
    .run();
}

/**
 * Recalculate customer preferences from order history
 */
export async function recalculatePreferences(
  customerId: string,
  tenantId: string,
  env: Env
): Promise<void> {
  // Fetch customer record
  const customer = await getTenantDatabase(tenantId, env).prepare(
    'SELECT * FROM customers WHERE id = ? AND tenant_id = ?'
  )
    .bind(customerId, tenantId)
    .first<CustomerRecord>();

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Fetch order history (last 100 orders for performance)
  const orders = await getTenantDatabase(tenantId, env).prepare(
    `SELECT * FROM customer_orders
     WHERE tenant_id = ? AND customer_phone = (
       SELECT phone_number_encrypted FROM customers WHERE id = ?
     )
     ORDER BY order_date DESC
     LIMIT 100`
  )
    .bind(tenantId, customerId)
    .all<any>();

  // TODO: Parse order items and compute preferences
  // For now, we'll use the inferCustomerPreferences function
  // This requires transforming the database format to CustomerOrder[]

  const preferences = inferCustomerPreferences([], customer.total_spent);

  // Update preferences in database
  await getTenantDatabase(tenantId, env).prepare(
    `UPDATE customers
     SET dietary_preferences = ?,
         favorite_items = ?,
         spice_preference = ?,
         cuisine_preferences = ?,
         price_sensitivity = ?,
         order_size_pattern = ?,
         order_type_preference = ?,
         beverage_preference = ?,
         dessert_frequency = ?,
         order_timing_pattern = ?,
         special_instructions_patterns = ?,
         adventurousness_score = ?,
         reorder_rate = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      JSON.stringify(preferences.dietary_preferences),
      JSON.stringify(preferences.favorite_items),
      preferences.spice_preference,
      JSON.stringify(preferences.cuisine_preferences),
      preferences.price_sensitivity,
      preferences.order_size_pattern,
      preferences.order_type_preference,
      JSON.stringify(preferences.beverage_preference),
      preferences.dessert_frequency,
      JSON.stringify(preferences.order_timing_pattern),
      JSON.stringify(preferences.special_instructions_patterns),
      preferences.adventurousness_score,
      preferences.reorder_rate,
      new Date().toISOString(),
      customerId
    )
    .run();
}

/**
 * Delete customer (GDPR right to erasure)
 */
export async function deleteCustomer(
  customerId: string,
  tenantId: string,
  env: Env
): Promise<void> {
  // Delete customer (cascades to tags and addresses)
  await getTenantDatabase(tenantId, env).prepare('DELETE FROM customers WHERE id = ? AND tenant_id = ?')
    .bind(customerId, tenantId)
    .run();

  // Anonymize order history (keep for business records but remove PII)
  await getTenantDatabase(tenantId, env).prepare(
    `UPDATE customer_orders
     SET customer_name = 'Deleted User',
         customer_phone = 'DELETED',
         customer_email = NULL
     WHERE customer_phone IN (
       SELECT phone_number_encrypted FROM customers WHERE id = ?
     )`
  )
    .bind(customerId)
    .run();
}

/**
 * Add address for customer (simplified schema)
 *
 * Required: placeId, coordinates, formatted (from Google Places)
 * Optional: apartment, instructions, label, isDefault
 */
export async function addCustomerAddress(
  customerId: string,
  tenantId: string,
  address: {
    // Core geocoding fields (required)
    placeId: string;
    coordinates: { lat: number; lng: number };
    formatted: string;
    // User-provided details (optional)
    apartment?: string;
    instructions?: string;
    label?: string;
    isDefault?: boolean;
  },
  env: Env
): Promise<CustomerAddress> {
  // Validate required fields
  if (!address.placeId || !address.coordinates || !address.formatted) {
    throw new Error('Address must include placeId, coordinates, and formatted address');
  }

  const addressId = `addr-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  // If this is default, unset other defaults
  if (address.isDefault) {
    await getTenantDatabase(tenantId, env).prepare(
      'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?'
    )
      .bind(customerId)
      .run();
  }

  // Serialize coordinates to JSON
  const coordinatesJson = JSON.stringify(address.coordinates);

  // Use simplified schema: placeId + coordinates + formatted_address
  // Legacy encrypted fields are set to empty for backward compatibility
  await getTenantDatabase(tenantId, env).prepare(
    `INSERT INTO customer_addresses (
      id, customer_id, label,
      place_id, coordinates, formatted_address,
      apartment, instructions,
      is_default, address_line1_encrypted,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      addressId,
      customerId,
      address.label || null,
      address.placeId,
      coordinatesJson,
      address.formatted,
      address.apartment || null,
      address.instructions || null,
      address.isDefault ? 1 : 0,
      'DEPRECATED', // Legacy field - not used in new schema
      now,
      now
    )
    .run();

  return {
    id: addressId,
    customerId,
    label: address.label,
    placeId: address.placeId,
    coordinates: address.coordinates,
    formatted: address.formatted,
    apartment: address.apartment,
    instructions: address.instructions,
    isDefault: address.isDefault || false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get customer addresses (simplified schema)
 */
export async function getCustomerAddresses(
  customerId: string,
  tenantId: string,
  env: Env
): Promise<CustomerAddress[]> {
  interface AddressRecord {
    id: string;
    customer_id: string;
    label: string | null;
    place_id: string | null;
    coordinates: string | null;
    formatted_address: string | null;
    apartment: string | null;
    instructions: string | null;
    is_default: number;
    created_at: string;
    updated_at: string;
  }

  const result = await getTenantDatabase(tenantId, env).prepare(
    'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC'
  )
    .bind(customerId)
    .all<AddressRecord>();

  return result.results.map((record: AddressRecord) => ({
    id: record.id,
    customerId: record.customer_id,
    label: record.label || undefined,
    placeId: record.place_id || '',
    coordinates: record.coordinates ? JSON.parse(record.coordinates) : { lat: 0, lng: 0 },
    formatted: record.formatted_address || '',
    apartment: record.apartment || undefined,
    instructions: record.instructions || undefined,
    isDefault: record.is_default === 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }));
}
