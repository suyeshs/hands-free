/**
 * Popular Items API — Multi-tenant (public read)
 * GET /api/popular/[tenantId]?channel=web|dine-in|all
 *
 * Read-only. Returns active popular items from KV.
 * Consumed by HeroSpotlight in the restaurant-client.
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

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { env } = getCloudflareContext();
    const { tenantId } = params;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID is required' }, { status: 400 });
    }

    const raw = await env.TENANT_METADATA.get(`popular:${tenantId}`, 'json') as PopularItem[] | null;
    let items = (raw ?? []).filter(i => i.isActive);
    items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return NextResponse.json({ success: true, items, count: items.length });
  } catch (err) {
    console.error('[popular] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
