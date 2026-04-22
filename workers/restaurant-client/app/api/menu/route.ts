import { NextRequest, NextResponse } from 'next/server';

const RESTAURANT_WORKER_URL = process.env.NEXT_PUBLIC_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';

/**
 * Proxy /api/menu to the restaurant worker.
 * Required for custom domains (e.g. thecoorgfoodco.com) where the restaurant
 * worker is not co-located at the same origin as the client.
 */
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  const url = new URL(request.url);
  const targetUrl = `${RESTAURANT_WORKER_URL}/api/menu${url.search}`;

  const response = await fetch(targetUrl, {
    headers: {
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
