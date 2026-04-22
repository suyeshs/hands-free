import { NextRequest, NextResponse } from 'next/server';

const CLOUD_RUN_URL = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-265169210248.us-central1.run.app';

/**
 * Server-side proxy for geocode-address to avoid CORS issues on custom domains.
 * Browser calls /api/restaurant/geocode-address (same-origin),
 * this route forwards to Cloud Run server-side (no CORS restriction).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(`${CLOUD_RUN_URL}/api/restaurant/geocode-address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[geocode-address proxy] Error:', error);
    return NextResponse.json({ error: 'Geocode request failed' }, { status: 500 });
  }
}
