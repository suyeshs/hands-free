/**
 * Customer Handlers for Tenant Worker
 *
 * Phone numbers are one-way HMAC-hashed (irreversible lookup index).
 * Name/email are stored as plaintext — D1 is encrypted at rest by Cloudflare.
 * No external dependencies required.
 */

import { createHmac } from 'crypto';

interface Env {
  DB: D1Database;
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

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------

// Returns just the 10-digit number, no country code prefix.
// Handles: "+919990002426", "09990002426", "9990002426", "+91 99900 02426"
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Strip Indian country code: 91 + 10 digits = 12 digits
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
  // Strip STD leading 0: 0 + 10 digits = 11 digits
  if (digits.startsWith('0') && digits.length === 11) return digits.slice(1);
  return digits;
}

function hashPhone(phone: string, tenantId: string): string {
  const hmac = createHmac('sha256', `customer-phone-salt:${tenantId}`);
  hmac.update(phone);
  return hmac.digest('base64');
}

// Existing records were hashed with the "+91XXXXXXXXXX" format.
// This lets lookups find them until they're re-saved with the new format.
function hashPhoneLegacy(phone10: string, tenantId: string): string {
  return hashPhone(`+91${phone10}`, tenantId);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /customers — upsert by phone hash
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
    const phoneHash = hashPhone(phone, tenantId);
    const phoneHashLegacy = hashPhoneLegacy(phone, tenantId);

    const existing = await env.DB.prepare(
      'SELECT id, phone_number_encrypted AS phone, name_encrypted AS name, email_encrypted AS email, created_at FROM customers WHERE tenant_id = ? AND (phone_hash = ? OR phone_hash = ?)'
    ).bind(tenantId, phoneHash, phoneHashLegacy).first<any>();

    if (existing) {
      return Response.json({
        id: existing.id,
        phone: existing.phone,
        name: existing.name,
        email: existing.email,
        createdAt: existing.created_at,
      });
    }

    const customerId = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO customers (
        id, tenant_id, phone_number_encrypted, name_encrypted, email_encrypted,
        phone_hash, encryption_key_version, total_orders, total_spent, average_order_value,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?, ?)
    `).bind(
      customerId, tenantId,
      phone,                      // phone_number_encrypted — stored as plaintext
      body.name || null,          // name_encrypted — stored as plaintext
      body.email || null,         // email_encrypted — stored as plaintext
      phoneHash, now, now
    ).run();

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
 * GET /customers/phone/:phone — lookup by phone hash
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
    const phoneHash = hashPhone(phone, tenantId);
    const phoneHashLegacy = hashPhoneLegacy(phone, tenantId);

    const customer = await env.DB.prepare(
      'SELECT id, phone_number_encrypted AS phone, name_encrypted AS name, email_encrypted AS email, created_at FROM customers WHERE tenant_id = ? AND (phone_hash = ? OR phone_hash = ?)'
    ).bind(tenantId, phoneHash, phoneHashLegacy).first<any>();

    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    return Response.json({
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      createdAt: customer.created_at,
    });
  } catch (error: any) {
    console.error('[CustomerHandler] handleGetCustomerByPhone error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /customers/phone/:phone/addresses — list saved addresses
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
    const phoneHash = hashPhone(phone, tenantId);
    const phoneHashLegacy = hashPhoneLegacy(phone, tenantId);

    const customer = await env.DB.prepare(
      'SELECT id FROM customers WHERE tenant_id = ? AND (phone_hash = ? OR phone_hash = ?)'
    ).bind(tenantId, phoneHash, phoneHashLegacy).first<{ id: string }>();

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
 * GET /customers — list customers with pagination and optional search
 */
export async function handleListCustomers(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    const source = url.searchParams.get('source') || '';
    const sortByParam = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

    const allowedSortCols: Record<string, string> = {
      name: 'name_encrypted',
      total_orders: 'total_orders',
      total_spent: 'total_spent',
      last_order_date: 'last_order_date',
      created_at: 'created_at',
    };
    const sortCol = allowedSortCols[sortByParam] || 'created_at';

    let countQuery = 'SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?';
    let listQuery = `SELECT id, phone_number_encrypted AS phone, name_encrypted AS name,
      email_encrypted AS email, total_orders, total_spent, average_order_value,
      created_at, updated_at
      FROM customers WHERE tenant_id = ?`;
    const baseParams: any[] = [tenantId];

    if (search) {
      const likePattern = `%${search}%`;
      const searchClause = ' AND (name_encrypted LIKE ? OR phone_number_encrypted LIKE ?)';
      countQuery += searchClause;
      listQuery += searchClause;
      baseParams.push(likePattern, likePattern);
    }

    if (source && source !== 'all') {
      if (source === 'direct') {
        // Direct customers have a real 10-digit phone; aggregators store short stubs like "911"
        const clause = " AND phone_number_encrypted IS NOT NULL AND LENGTH(TRIM(phone_number_encrypted)) >= 10";
        countQuery += clause;
        listQuery += clause;
      } else if (source === 'swiggy') {
        // Swiggy customers: no phone or a short stub (< 10 chars) — name only
        const clause = " AND (phone_number_encrypted IS NULL OR LENGTH(TRIM(phone_number_encrypted)) < 10)";
        countQuery += clause;
        listQuery += clause;
      } else if (source === 'zomato') {
        // Zomato customers: name-only AND appear in zomato orders (by customer_id or customer_name)
        const clause = " AND (phone_number_encrypted IS NULL OR LENGTH(TRIM(phone_number_encrypted)) < 10)" +
          " AND (id IN (SELECT DISTINCT customer_id FROM orders WHERE tenant_id = ? AND LOWER(source) = 'zomato' AND customer_id IS NOT NULL AND customer_id != 'guest')" +
          " OR (name_encrypted IS NOT NULL AND name_encrypted IN (SELECT DISTINCT customer_name FROM orders WHERE tenant_id = ? AND LOWER(source) = 'zomato' AND customer_name IS NOT NULL)))";
        countQuery += clause;
        listQuery += clause;
        baseParams.push(tenantId, tenantId);
      }
    }

    listQuery += ` ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;

    const [countResult, listResult] = await Promise.all([
      env.DB.prepare(countQuery).bind(...baseParams).first<{ count: number }>(),
      env.DB.prepare(listQuery).bind(...baseParams, limit, offset).all<any>(),
    ]);

    const total = countResult?.count || 0;
    const customers = (listResult.results || []).map((r: any) => ({
      id: r.id,
      tenantId,
      phone: normalizePhone(r.phone || ''),
      name: r.name || undefined,
      email: r.email || undefined,
      totalOrders: r.total_orders || 0,
      totalSpent: r.total_spent || 0,
      averageOrderValue: r.average_order_value || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return Response.json({
      success: true,
      customers,
      total,
      pagination: { page, limit, hasMore: total > page * limit },
    });
  } catch (error: any) {
    console.error('[CustomerHandler] handleListCustomers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /customers/phone/:phone/addresses — save a delivery address
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
    const phoneHash = hashPhone(phone, tenantId);
    const phoneHashLegacy = hashPhoneLegacy(phone, tenantId);
    const now = new Date().toISOString();

    let customer = await env.DB.prepare(
      'SELECT id FROM customers WHERE tenant_id = ? AND (phone_hash = ? OR phone_hash = ?)'
    ).bind(tenantId, phoneHash, phoneHashLegacy).first<{ id: string }>();

    if (!customer) {
      const customerId = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      await env.DB.prepare(`
        INSERT INTO customers (
          id, tenant_id, phone_number_encrypted, phone_hash, encryption_key_version,
          total_orders, total_spent, average_order_value, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, 0, 0, 0, ?, ?)
      `).bind(customerId, tenantId, phone, phoneHash, now, now).run();
      customer = { id: customerId };
    }

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
