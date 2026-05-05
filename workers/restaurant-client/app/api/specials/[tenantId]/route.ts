/**
 * Today's Specials API - Multi-tenant
 * /api/specials/[tenantId]
 *
 * Fetches specials from KV namespace (TENANT_METADATA)
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

/**
 * GET /api/specials/[tenantId]?channel=web|dine-in|all
 * List today's specials for a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { env } = getCloudflareContext();
    const { tenantId } = params;
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel') || 'web'; // Default to web for client

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get specials from KV
    const specialsKey = `specials:${tenantId}`;
    const specialsData = await env.TENANT_METADATA.get(specialsKey, 'json') as SpecialItem[] | null;

    let specials = specialsData || [];

    // Filter by active status
    specials = specials.filter(s => s.isActive);

    // Filter by channel/visibility
    if (channel === 'web') {
      specials = specials.filter(s =>
        s.visibility === 'web' || s.visibility === 'both' || !s.visibility
      );
    } else if (channel === 'dine-in') {
      specials = specials.filter(s =>
        s.visibility === 'dine-in' || s.visibility === 'both' || !s.visibility
      );
    }
    // 'all' returns everything

    // Sort by sortOrder
    specials.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    return NextResponse.json({
      success: true,
      specials,
      count: specials.length,
    });

  } catch (error) {
    console.error('Error fetching specials:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
