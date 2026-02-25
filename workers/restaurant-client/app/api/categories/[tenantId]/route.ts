/**
 * Categories API - Multi-tenant
 * /api/categories/[tenantId]
 *
 * Proxies requests to the dedicated orders worker (handsfree-orders)
 * which has category management endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';

const ORDERS_WORKER_URL = process.env.ORDERS_WORKER_URL || 'https://handsfree-orders.suyesh.workers.dev';

/**
 * GET /api/categories/[tenantId]
 * Get all categories for a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    const searchParams = request.nextUrl.searchParams;

    // Forward query parameters
    const queryString = searchParams.toString();
    const url = `${ORDERS_WORKER_URL}/api/categories/${tenantId}${queryString ? `?${queryString}` : ''}`;

    console.log('[Categories API] Proxying category list to orders worker:', tenantId);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Categories API] Error listing categories:', error);
    return NextResponse.json(
      {
        error: 'Failed to list categories',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories/[tenantId]
 * Create a new category
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    const body = await request.json();

    console.log('[Categories API] Proxying category creation to orders worker:', tenantId);

    const response = await fetch(`${ORDERS_WORKER_URL}/api/categories/${tenantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Categories API] Error creating category:', error);
    return NextResponse.json(
      {
        error: 'Failed to create category',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
