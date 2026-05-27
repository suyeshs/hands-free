/**
 * Today's Specials API - Multi-tenant
 * /api/specials/[tenantId]
 *
 * Full CRUD for specials backed by KV (TENANT_METADATA key: specials:<tenantId>)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

interface SpecialItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  tags?: string[];
  menuItemId?: string;
  isActive: boolean;
  visibility: 'both' | 'web' | 'dine-in';
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

async function getSpecials(env: any, tenantId: string): Promise<SpecialItem[]> {
  const data = await env.TENANT_METADATA.get(`specials:${tenantId}`, 'json') as SpecialItem[] | null;
  return data || [];
}

async function putSpecials(env: any, tenantId: string, specials: SpecialItem[]): Promise<void> {
  await env.TENANT_METADATA.put(`specials:${tenantId}`, JSON.stringify(specials));
}

/**
 * GET /api/specials/[tenantId]?channel=web|dine-in|all&includeInactive=true
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { env } = getCloudflareContext();
    const { tenantId } = params;
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel') || 'web';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID is required' }, { status: 400 });
    }

    let specials = await getSpecials(env, tenantId);

    if (!includeInactive) {
      specials = specials.filter(s => s.isActive);
    }

    if (channel === 'web') {
      specials = specials.filter(s => s.visibility === 'web' || s.visibility === 'both' || !s.visibility);
    } else if (channel === 'dine-in') {
      specials = specials.filter(s => s.visibility === 'dine-in' || s.visibility === 'both' || !s.visibility);
    }

    specials.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return NextResponse.json({ success: true, specials, count: specials.length });
  } catch (error) {
    console.error('Error fetching specials:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/specials/[tenantId]
 * Create a new special
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { env } = getCloudflareContext();
    const { tenantId } = params;
    const body = await request.json() as Partial<SpecialItem>;

    if (!body.name || body.price === undefined) {
      return NextResponse.json({ success: false, error: 'name and price are required' }, { status: 400 });
    }

    const specials = await getSpecials(env, tenantId);

    const newSpecial: SpecialItem = {
      id: crypto.randomUUID(),
      name: body.name,
      description: body.description,
      price: Number(body.price),
      image: body.image,
      tags: body.tags || [],
      menuItemId: body.menuItemId,
      isActive: body.isActive ?? true,
      visibility: body.visibility || 'both',
      sortOrder: body.sortOrder ?? specials.length,
      createdAt: new Date().toISOString(),
    };

    specials.push(newSpecial);
    await putSpecials(env, tenantId, specials);

    return NextResponse.json({ success: true, special: newSpecial }, { status: 201 });
  } catch (error) {
    console.error('Error creating special:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/specials/[tenantId]
 * Update an existing special (requires id in body)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { env } = getCloudflareContext();
    const { tenantId } = params;
    const body = await request.json() as Partial<SpecialItem>;

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const specials = await getSpecials(env, tenantId);
    const idx = specials.findIndex(s => s.id === body.id);

    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Special not found' }, { status: 404 });
    }

    specials[idx] = {
      ...specials[idx],
      ...body,
      id: specials[idx].id,
      createdAt: specials[idx].createdAt,
      updatedAt: new Date().toISOString(),
      price: body.price !== undefined ? Number(body.price) : specials[idx].price,
    };

    await putSpecials(env, tenantId, specials);

    return NextResponse.json({ success: true, special: specials[idx] });
  } catch (error) {
    console.error('Error updating special:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/specials/[tenantId]?id=<specialId>
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { env } = getCloudflareContext();
    const { tenantId } = params;
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id query param is required' }, { status: 400 });
    }

    const specials = await getSpecials(env, tenantId);
    const filtered = specials.filter(s => s.id !== id);

    if (filtered.length === specials.length) {
      return NextResponse.json({ success: false, error: 'Special not found' }, { status: 404 });
    }

    await putSpecials(env, tenantId, filtered);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting special:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
