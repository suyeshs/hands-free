/// <reference types="@cloudflare/workers-types" />

interface Env {
    DB: D1Database;
}

// Handle OPTIONS request for CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
    try {
        const { request, env } = context;
        const body = await request.json() as any;

        const { name, phone, osDetected } = body;

        if (!name || !phone) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }

        // Get IP address from request
        const ipAddress = request.headers.get('CF-Connecting-IP') ||
                         request.headers.get('X-Forwarded-For') ||
                         'unknown';

        // Insert lead into database
        const result = await env.DB.prepare(
            'INSERT INTO download_leads (name, phone, os_detected, ip_address) VALUES (?, ?, ?, ?)'
        ).bind(name, phone, osDetected || null, ipAddress).run();

        if (result.success) {
            // Generate access token (UUID)
            const accessToken = crypto.randomUUID();

            return new Response(JSON.stringify({
                success: true,
                accessToken
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        } else {
            throw new Error('Database insertion failed');
        }
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
}
