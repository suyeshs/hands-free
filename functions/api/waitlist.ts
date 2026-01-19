interface Env {
    DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { request, env } = context;
        const body = await request.json() as any;

        const { restaurantName, ownerName, email, phone, city } = body;

        if (!restaurantName || !ownerName || !email || !phone) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await env.DB.prepare(
            'INSERT INTO waitlist (restaurant_name, owner_name, email, phone, city) VALUES (?, ?, ?, ?, ?)'
        ).bind(restaurantName, ownerName, email, phone, city || null).run();

        if (result.success) {
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error('Database insertion failed');
        }
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
