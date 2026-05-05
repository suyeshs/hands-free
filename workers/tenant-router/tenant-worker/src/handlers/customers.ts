/**
 * Customer Handlers for Tenant Worker
 *
 * Handles customer creation, lookup, and address management.
 * Uses the same AES-256-GCM encryption and HMAC-SHA256 phone hashing
 * as the main restaurant worker (customer-encryption.ts).
 */

import { createHmac, randomBytes } from 'crypto';

interface Env {
  DB: D1Database;
  TOKEN_MANAGER: Fetcher;
}

interface CustomerInput {
  phone: string;
  name?: string;
  email?: string;
}

interface AddressInput {
  label?: string;
  placeId?: string;
  coordinates: { lat: number; lng: number } | string;
  formatted: string;
  apartment?: string;
  instructions?: string;
  isDefault?: boolean;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Encryption helpers (mirrors workers/restaurant/src/lib/customer-encryption.ts)
// ---------------------------------------------------------------------------

/**
 * Fetch the per-tenant encryption key from Token Manager.
 * Key name convention: customer-encryption-key:<tenantId>
 */
async function getTenantEncryptionKey(
  tenantId: string,
  tokenManager: Fetcher
): Promise<{ key: string; version: number }> {
  const keyName = `customer-encryption-key:${tenantId}`;

  const response = await tokenManager.fetch(
    new Request(`https://token-manager/api/tokens/${encodeURIComponent(keyName)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Name': 'handsfree-restaurant', // Uses same access policy as restaurant worker
      },
    })
  );

  if (!response.ok) {
    throw new Error(`Token Manager error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { success: boolean; data: { value: string } };

  if (!data.success || !data.data?.value) {
    throw new Error('Invalid response from Token Manager');
  }

  return { key: data.data.value, version: 1 };
}

/**
 * AES-256-GCM encrypt a plaintext string.
 * Returns a JSON string stored in the TEXT column.
 */
async function encryptField(
  plaintext: string,
  encryptionKey: string,
  keyVersion: number = 1
): Promise<string> {
  const keyBuffer = Buffer.from(encryptionKey, 'base64');
  const iv = randomBytes(12);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );

  const encArr = new Uint8Array(encrypted);
  const ciphertext = encArr.slice(0, encArr.length - 16);
  const authTag = encArr.slice(encArr.length - 16);

  const result: EncryptedData = {
    encrypted: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    authTag: Buffer.from(authTag).toString('base64'),
    version: keyVersion,
  };

  return JSON.stringify(result);
}

/**
 * AES-256-GCM decrypt a field stored as JSON.
 */
async function decryptField(encryptedJson: string, encryptionKey: string): Promise<string> {
  // Legacy plaintext fallback
  if (!encryptedJson.startsWith('{')) {
    return encryptedJson;
  }

  const data: EncryptedData = JSON.parse(encryptedJson);
  const keyBuffer = Buffer.from(encryptionKey, 'base64');
  const iv = Buffer.from(data.iv, 'base64');
  const ciphertext = Buffer.from(data.encrypted, 'base64');
  const authTag = Buffer.from(data.authTag, 'base64');

  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * HMAC-SHA256 phone hash — same salt convention as the main restaurant worker.
 */
function hashPhoneNumber(phoneNumber: string, tenantId: string): string {
  const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
  const hmac = createHmac('sha256', `customer-phone-salt:${tenantId}`);
  hmac.update(normalized);
  return hmac.digest('base64');
}

/** Normalize to E.164 — strip leading zero, prepend +91 if bare digits. */
function normalizePhone(phone: string): string {
  if (phone.startsWith('+')) return phone;
  const digits = phone.replace(/\D/g, '');
  return `+91${digits.startsWith('0') ? digits.slice(1) : digits}`;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /customers  — create or find customer (upsert by phone)
 */
export async function handleCreateCustomer(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as CustomerInput;

    if (!body.phone) {
      return Response.json({ error: 'Phone number required' }, { status: 400 });
    }

    const phone = normalizePhone(body.phone);
    const phoneHash = hashPhoneNumber(phone, tenantId);

    // Check for existing customer first (upsert)
    const existing = await env.DB.prepare(
      'SELECT id, phone_number_encrypted, name_encrypted, email_encrypted, created_at FROM customers WHERE tenant_id = ? AND phone_hash = ?'
    ).bind(tenantId, phoneHash).first<any>();

    const { key, version } = await getTenantEncryptionKey(tenantId, env.TOKEN_MANAGER);

    if (existing) {
      const decPhone = await decryptField(existing.phone_number_encrypted, key);
      const decName = existing.name_encrypted ? await decryptField(existing.name_encrypted, key) : null;
      const decEmail = existing.email_encrypted ? await decryptField(existing.email_encrypted, key) : null;

      return Response.json({
        id: existing.id,
        phone: decPhone,
        name: decName,
        email: decEmail,
        createdAt: existing.created_at,
      });
    }

    // New customer — encrypt all PII
    const customerId = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    const encPhone = await encryptField(phone, key, version);
    const encName = body.name ? await encryptField(body.name, key, version) : null;
    const encEmail = body.email ? await encryptField(body.email, key, version) : null;

    await env.DB.prepare(`
      INSERT INTO customers (
        id, tenant_id, phone_number_encrypted, name_encrypted, email_encrypted,
        phone_hash, encryption_key_version, total_orders, total_spent, average_order_value,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
    `).bind(customerId, tenantId, encPhone, encName, encEmail, phoneHash, version, now, now).run();

    console.log(`[CustomerHandler] Created customer ${customerId} for ${tenantId}`);

    return Response.json(
      { id: customerId, phone, name: body.name || null, email: body.email || null, createdAt: now },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('[CustomerHandler] handleCreateCustomer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /customers/phone/:phone  — lookup customer by phone number
 */
export async function handleGetCustomerByPhone(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const rawPhone = decodeURIComponent(parts[parts.indexOf('phone') + 1] || '');

    if (!rawPhone) {
      return Response.json({ error: 'Phone number required' }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    const phoneHash = hashPhoneNumber(phone, tenantId);

    const customer = await env.DB.prepare(
      'SELECT id, phone_number_encrypted, name_encrypted, email_encrypted, created_at FROM customers WHERE tenant_id = ? AND phone_hash = ?'
    ).bind(tenantId, phoneHash).first<any>();

    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { key } = await getTenantEncryptionKey(tenantId, env.TOKEN_MANAGER);
    const decPhone = await decryptField(customer.phone_number_encrypted, key);
    const decName = customer.name_encrypted ? await decryptField(customer.name_encrypted, key) : null;
    const decEmail = customer.email_encrypted ? await decryptField(customer.email_encrypted, key) : null;

    return Response.json({
      id: customer.id,
      phone: decPhone,
      name: decName,
      email: decEmail,
      createdAt: customer.created_at,
    });

  } catch (error: any) {
    console.error('[CustomerHandler] handleGetCustomerByPhone error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /customers/phone/:phone/addresses  — list saved addresses
 */
export async function handleGetCustomerAddresses(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const rawPhone = decodeURIComponent(parts[parts.indexOf('phone') + 1] || '');

    if (!rawPhone) {
      return Response.json({ error: 'Phone number required' }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    const phoneHash = hashPhoneNumber(phone, tenantId);

    const customer = await env.DB.prepare(
      'SELECT id FROM customers WHERE tenant_id = ? AND phone_hash = ?'
    ).bind(tenantId, phoneHash).first<{ id: string }>();

    if (!customer) {
      return Response.json({ success: true, customerId: null, addresses: [] });
    }

    const result = await env.DB.prepare(
      'SELECT id, label, place_id, coordinates, formatted_address, apartment, instructions, is_default, created_at FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC'
    ).bind(customer.id).all();

    const addresses = (result.results || []).map((a: any) => ({
      id: a.id,
      label: a.label,
      placeId: a.place_id,
      coordinates: typeof a.coordinates === 'string' ? JSON.parse(a.coordinates) : a.coordinates,
      formatted: a.formatted_address,
      apartment: a.apartment,
      instructions: a.instructions,
      isDefault: !!a.is_default,
      createdAt: a.created_at,
    }));

    return Response.json({ success: true, customerId: customer.id, addresses });

  } catch (error: any) {
    console.error('[CustomerHandler] handleGetCustomerAddresses error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /customers/phone/:phone/addresses  — save a delivery address
 */
export async function handleSaveCustomerAddress(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const rawPhone = decodeURIComponent(parts[parts.indexOf('phone') + 1] || '');

    if (!rawPhone) {
      return Response.json({ error: 'Phone number required' }, { status: 400 });
    }

    const body = await request.json() as AddressInput;
    if (!body.formatted || !body.coordinates) {
      return Response.json({ error: 'Address and coordinates required' }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    const phoneHash = hashPhoneNumber(phone, tenantId);
    const now = new Date().toISOString();

    // Find or create customer
    let customer = await env.DB.prepare(
      'SELECT id FROM customers WHERE tenant_id = ? AND phone_hash = ?'
    ).bind(tenantId, phoneHash).first<{ id: string }>();

    if (!customer) {
      const { key, version } = await getTenantEncryptionKey(tenantId, env.TOKEN_MANAGER);
      const customerId = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const encPhone = await encryptField(phone, key, version);

      await env.DB.prepare(`
        INSERT INTO customers (
          id, tenant_id, phone_number_encrypted, phone_hash, encryption_key_version,
          total_orders, total_spent, average_order_value, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
      `).bind(customerId, tenantId, encPhone, phoneHash, version, now, now).run();

      customer = { id: customerId };
    }

    // Unset existing defaults if this will be the new default
    if (body.isDefault) {
      await env.DB.prepare(
        'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?'
      ).bind(customer.id).run();
    }

    const addressId = `addr-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const coordsStr = typeof body.coordinates === 'string'
      ? body.coordinates
      : JSON.stringify(body.coordinates);

    await env.DB.prepare(`
      INSERT INTO customer_addresses (
        id, customer_id, label, place_id, coordinates, formatted_address,
        apartment, instructions, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      addressId, customer.id, body.label || null, body.placeId || null,
      coordsStr, body.formatted, body.apartment || null,
      body.instructions || null, body.isDefault ? 1 : 0, now, now
    ).run();

    console.log(`[CustomerHandler] Saved address ${addressId} for customer ${customer.id}`);

    return Response.json({
      success: true,
      customerId: customer.id,
      address: {
        id: addressId,
        label: body.label,
        placeId: body.placeId,
        coordinates: typeof body.coordinates === 'string' ? JSON.parse(body.coordinates) : body.coordinates,
        formatted: body.formatted,
        apartment: body.apartment,
        instructions: body.instructions,
        isDefault: body.isDefault || false,
        createdAt: now,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('[CustomerHandler] handleSaveCustomerAddress error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
