/**
 * Orders API - Multi-tenant
 * /api/orders/[tenantId]
 *
 * Proxies requests to the dedicated orders worker (handsfree-orders)
 * which has direct D1 bindings for atomic transactions.
 */

import { NextRequest, NextResponse } from 'next/server';

const ORDERS_WORKER_URL = process.env.ORDERS_WORKER_URL || 'https://handsfree-orders.suyesh.workers.dev';

/**
 * POST /api/orders/[tenantId]
 * Create a new order - proxies to orders worker
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    const body = await request.json();

    console.log('[Orders API] Proxying order creation to orders worker:', tenantId);

    const response = await fetch(`${ORDERS_WORKER_URL}/api/orders/${tenantId}`, {
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
    console.error('[Orders API] Error creating order:', error);
    return NextResponse.json(
      {
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[tenantId]?status=xxx&limit=50&offset=0
 * List orders for tenant - proxies to orders worker
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
    const url = `${ORDERS_WORKER_URL}/api/orders/${tenantId}${queryString ? `?${queryString}` : ''}`;

    console.log('[Orders API] Proxying order list to orders worker:', tenantId);

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
    console.error('[Orders API] Error listing orders:', error);
    return NextResponse.json(
      {
        error: 'Failed to list orders',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
