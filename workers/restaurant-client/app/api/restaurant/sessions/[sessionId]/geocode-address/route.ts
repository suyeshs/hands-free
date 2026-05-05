import { NextRequest, NextResponse } from 'next/server';

const CLOUD_RUN_URL = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-265169210248.us-central1.run.app';

/**
 * Server-side proxy for session-based geocode-address to avoid CORS issues on custom domains.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const body = await request.json();
    const response = await fetch(
      `${CLOUD_RUN_URL}/api/restaurant/sessions/${params.sessionId}/geocode-address`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[session geocode-address proxy] Error:', error);
    return NextResponse.json({ error: 'Geocode request failed' }, { status: 500 });
  }
}
