import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Get KV namespace from Cloudflare context
    const { env } = getCloudflareContext();
    const TENANT_METADATA = env.TENANT_METADATA as KVNamespace;

    if (!TENANT_METADATA) {
      console.error('[Theme API] TENANT_METADATA KV namespace not available');
      return NextResponse.json({ error: 'KV namespace not configured' }, { status: 500 });
    }

    // Fetch theme config from KV
    const themeConfigKey = `config:${tenantId}:theme`;
    const themeConfigData = await TENANT_METADATA.get(themeConfigKey, { type: 'json' });

    if (!themeConfigData) {
      console.warn(`[Theme API] No theme config found for tenant: ${tenantId}`);
      return NextResponse.json({ error: 'Theme config not found' }, { status: 404 });
    }

    return NextResponse.json(themeConfigData);
  } catch (error) {
    console.error('[Theme API] Error fetching theme config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
