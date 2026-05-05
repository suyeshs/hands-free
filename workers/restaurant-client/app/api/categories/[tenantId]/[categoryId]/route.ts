/**
 * Individual Category API - Multi-tenant
 * /api/categories/[tenantId]/[categoryId]
 *
 * Proxies requests to the dedicated orders worker (handsfree-orders)
 * for individual category operations.
 */

import { NextRequest, NextResponse } from 'next/server';

const ORDERS_WORKER_URL = process.env.ORDERS_WORKER_URL || 'https://handsfree-orders.suyesh.workers.dev';

/**
 * GET /api/categories/[tenantId]/[categoryId]
 * Get a specific category
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; categoryId: string } }
) {
  try {
    const { tenantId, categoryId } = params;

    console.log('[Categories API] Proxying get category to orders worker:', tenantId, categoryId);

    const response = await fetch(`${ORDERS_WORKER_URL}/api/categories/${tenantId}/${categoryId}`, {
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
    console.error('[Categories API] Error getting category:', error);
    return NextResponse.json(
      {
        error: 'Failed to get category',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/categories/[tenantId]/[categoryId]
 * Update a category
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string; categoryId: string } }
) {
  try {
    const { tenantId, categoryId } = params;
    const body = await request.json();

    console.log('[Categories API] Proxying category update to orders worker:', tenantId, categoryId);

    const response = await fetch(`${ORDERS_WORKER_URL}/api/categories/${tenantId}/${categoryId}`, {
      method: 'PATCH',
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
    console.error('[Categories API] Error updating category:', error);
    return NextResponse.json(
      {
        error: 'Failed to update category',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[tenantId]/[categoryId]
 * Delete a category
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tenantId: string; categoryId: string } }
) {
  try {
    const { tenantId, categoryId } = params;

    console.log('[Categories API] Proxying category deletion to orders worker:', tenantId, categoryId);

    const response = await fetch(`${ORDERS_WORKER_URL}/api/categories/${tenantId}/${categoryId}`, {
      method: 'DELETE',
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
    console.error('[Categories API] Error deleting category:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete category',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
