/**
 * Popular Items Admin API — Multi-tenant
 * /api/tenants/[tenantId]/popular
 *
 * Full CRUD via KV (TENANT_METADATA namespace).
 * Called by PopularManager in the POS settings UI.
 * KV key: popular:${tenantId}  →  PopularItem[]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

interface PopularItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  tags?: string[];
  menuItemId?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

type Params = { params: { tenantId: string } };

const kvKey = (tenantId: string) => `popular:${tenantId}`;

async function getItems(tenantId: string): Promise<PopularItem[]> {
  const { env } = getCloudflareContext();
  return ((await env.TENANT_METADATA.get(kvKey(tenantId), 'json')) as PopularItem[]) ?? [];
}

async function putItems(tenantId: string, items: PopularItem[]): Promise<void> {
  const { env } = getCloudflareContext();
  await env.TENANT_METADATA.put(kvKey(tenantId), JSON.stringify(items));
}

/**
 * GET /api/tenants/[tenantId]/popular?includeInactive=true
 * List all popular items for admin (includes inactive by default with flag)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = params;
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    let items = await getItems(tenantId);
    if (!includeInactive) items = items.filter(i => i.isActive);
    items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return NextResponse.json({ success: true, items, count: items.length });
  } catch (err) {
    console.error('[popular admin] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tenants/[tenantId]/popular
 * Create a new popular item
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = params;
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });

    const body = await request.json() as Partial<PopularItem>;
    if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const items = await getItems(tenantId);
    const newItem: PopularItem = {
      id: crypto.randomUUID(),
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      price: body.price ?? 0,
      image: body.image?.trim() || undefined,
      tags: body.tags ?? [],
      menuItemId: body.menuItemId || undefined,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? items.length,
      createdAt: new Date().toISOString(),
    };

    items.push(newItem);
    await putItems(tenantId, items);
    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (err) {
    console.error('[popular admin] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/tenants/[tenantId]/popular
 * Update an existing popular item (body must include id)
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = params;
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });

    const body = await request.json() as Partial<PopularItem> & { id: string };
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const items = await getItems(tenantId);
    const idx = items.findIndex(i => i.id === body.id);
    if (idx === -1) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    items[idx] = {
      ...items[idx],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    await putItems(tenantId, items);
    return NextResponse.json({ success: true, item: items[idx] });
  } catch (err) {
    console.error('[popular admin] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tenants/[tenantId]/popular?id=:itemId
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = params;
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 });

    const items = await getItems(tenantId);
    const filtered = items.filter(i => i.id !== id);
    if (filtered.length === items.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    await putItems(tenantId, filtered);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[popular admin] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
