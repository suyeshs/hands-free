/**
 * Single Order API - Multi-tenant
 * /api/orders/[tenantId]/[orderId]
 *
 * Proxies requests to the dedicated orders worker (handsfree-orders)
 * which has direct D1 bindings for atomic transactions.
 */

import { NextRequest, NextResponse } from 'next/server';

const ORDERS_WORKER_URL = process.env.ORDERS_WORKER_URL || 'https://handsfree-orders.suyesh.workers.dev';

interface OrderUpdatePayload {
  status?: string;
  notes?: string;
  completedAt?: string;
}

/**
 * GET /api/orders/[tenantId]/[orderId]
 * Get order details - proxies to orders worker
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { tenantId: string; orderId: string } }
) {
  try {
    const { tenantId, orderId } = params;

    console.log('[Orders API] Proxying get order to orders worker:', { tenantId, orderId });

    const response = await fetch(`${ORDERS_WORKER_URL}/api/orders/${tenantId}/${orderId}`, {
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
    console.error('[Orders API] Error fetching order:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orders/[tenantId]/[orderId]
 * Update order (typically status) - proxies to orders worker
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string; orderId: string } }
) {
  try {
    const { tenantId, orderId } = params;
    const body = await request.json() as OrderUpdatePayload;

    console.log('[Orders API] Proxying update order to orders worker:', { tenantId, orderId });

    // The orders worker expects status updates at /orders/:orderId/status
    // But we can also support general PATCH at /orders/:orderId
    const url = body.status && Object.keys(body).length === 1
      ? `${ORDERS_WORKER_URL}/api/orders/${tenantId}/${orderId}/status`
      : `${ORDERS_WORKER_URL}/api/orders/${tenantId}/${orderId}`;

    const response = await fetch(url, {
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
    console.error('[Orders API] Error updating order:', error);
    return NextResponse.json(
      {
        error: 'Failed to update order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[tenantId]/[orderId]
 * Delete order (cancel) - proxies status update to orders worker
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { tenantId: string; orderId: string } }
) {
  try {
    const { tenantId, orderId } = params;

    console.log('[Orders API] Proxying cancel order to orders worker:', { tenantId, orderId });

    // Cancel is implemented as a status update to 'cancelled'
    const response = await fetch(`${ORDERS_WORKER_URL}/api/orders/${tenantId}/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled',
    });
  } catch (error) {
    console.error('[Orders API] Error deleting order:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
