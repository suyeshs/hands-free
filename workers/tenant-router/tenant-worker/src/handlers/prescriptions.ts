/**
 * Prescription Handlers for Pharmacy Tenants
 *
 * Provides prescription management for pharmacy business type
 */

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /prescriptions - List prescriptions
 */
export async function handleListPrescriptions(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    const status = url.searchParams.get('status') || 'all';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `
      SELECT
        p.*,
        COUNT(pi.id) as item_count
      FROM prescriptions p
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ` AND p.patient_id = ?`;
      params.push(patientId);
    }

    if (status !== 'all') {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      prescriptions: result.results || [],
      pagination: {
        limit,
        offset,
        total: result.results?.length || 0,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Prescriptions] List error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list prescriptions',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /prescriptions/:id - Get prescription details with items
 */
export async function handleGetPrescription(
  request: Request,
  env: Env,
  tenantId: string,
  prescriptionId: string
): Promise<Response> {
  try {
    // Get prescription
    const prescription = await env.DB.prepare(`
      SELECT * FROM prescriptions WHERE id = ?
    `).bind(prescriptionId).first();

    if (!prescription) {
      return Response.json({
        success: false,
        error: 'Prescription not found',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Get prescription items with product details
    const items = await env.DB.prepare(`
      SELECT
        pi.*,
        pr.drug_name,
        pr.generic_name,
        pr.strength,
        pr.form,
        pr.price
      FROM prescription_items pi
      JOIN products pr ON pi.product_id = pr.id
      WHERE pi.prescription_id = ?
    `).bind(prescriptionId).all();

    return Response.json({
      success: true,
      prescription: {
        ...prescription,
        items: items.results || [],
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Prescriptions] Get error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to get prescription',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * POST /prescriptions - Create new prescription
 */
export async function handleCreatePrescription(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Validate required fields
    if (!body.patientId || !body.doctorName || !body.items || body.items.length === 0) {
      return Response.json({
        success: false,
        error: 'Missing required fields: patientId, doctorName, items',
      }, { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const prescriptionId = `rx-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    // Insert prescription
    await env.DB.prepare(`
      INSERT INTO prescriptions (
        id, patient_id, doctor_name, prescription_date,
        status, created_at, notes
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      prescriptionId,
      body.patientId,
      body.doctorName,
      body.prescriptionDate || now,
      now,
      body.notes || null
    ).run();

    // Insert prescription items
    for (const item of body.items) {
      const itemId = `rxi-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      await env.DB.prepare(`
        INSERT INTO prescription_items (
          id, prescription_id, product_id, quantity, dosage_instructions
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        itemId,
        prescriptionId,
        item.productId,
        item.quantity,
        item.dosageInstructions || null
      ).run();
    }

    return Response.json({
      success: true,
      prescriptionId,
      message: 'Prescription created successfully',
    }, { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Prescriptions] Create error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to create prescription',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * POST /prescriptions/:id/fill - Fill/dispense prescription
 */
export async function handleFillPrescription(
  request: Request,
  env: Env,
  tenantId: string,
  prescriptionId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Check prescription exists and is not already filled
    const prescription = await env.DB.prepare(`
      SELECT * FROM prescriptions WHERE id = ? AND status = 'pending'
    `).bind(prescriptionId).first();

    if (!prescription) {
      return Response.json({
        success: false,
        error: 'Prescription not found or already filled',
      }, { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Update prescription status
    await env.DB.prepare(`
      UPDATE prescriptions
      SET status = 'filled',
          filled_at = datetime('now'),
          filled_by = ?,
          notes = COALESCE(notes, '') || ? || ?
      WHERE id = ?
    `).bind(
      body.filledBy || 'System',
      body.notes ? '\n\nFill Notes: ' : '',
      body.notes || '',
      prescriptionId
    ).run();

    // TODO: Reduce inventory for dispensed items
    // TODO: Create billing/invoice for patient

    return Response.json({
      success: true,
      message: 'Prescription filled successfully',
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Prescriptions] Fill error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to fill prescription',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /drugs - List drug inventory (for pharmacy)
 */
export async function handleListDrugs(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const requiresPrescription = url.searchParams.get('requiresPrescription');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `
      SELECT * FROM products WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (drug_name LIKE ? OR generic_name LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    if (requiresPrescription === 'true') {
      query += ` AND requires_prescription = 1`;
    } else if (requiresPrescription === 'false') {
      query += ` AND requires_prescription = 0`;
    }

    query += ` ORDER BY drug_name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      drugs: result.results || [],
      pagination: {
        limit,
        offset,
        total: result.results?.length || 0,
      },
    }, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Drugs] List error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list drugs',
    }, { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}
