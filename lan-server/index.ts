import { serve } from "bun";
import { join } from "path";
import { initDb, dbService } from "./database";

const PORT = 3000;

// Initialize Database
initDb();

const server = serve({
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url);

        // Upgrade to WebSocket
        if (url.pathname === "/ws") {
            const success = server.upgrade(req);
            if (success) return undefined;
            return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // Health check
        if (url.pathname === "/health") return new Response("OK");

        // API: Get Floor Plan
        if (url.pathname === "/api/floor-plan" && req.method === "GET") {
            return Response.json({
                sections: dbService.getSections(),
                tables: dbService.getTables(),
            });
        }

        // API: Submit Order (Customer -> POS)
        if (url.pathname === "/api/order" && req.method === "POST") {
            try {
                const body = await req.json();
                console.log("New Order Received:", body);

                // Persist to SQLite
                dbService.addOrder(body);

                // Broadcast to POS
                server.publish("pos-updates", JSON.stringify({ type: "NEW_ORDER", payload: body }));
                return Response.json({ success: true, message: "Order placed" });
            } catch (e) {
                console.error("Error saving order:", e);
                return new Response("Invalid Request", { status: 400 });
            }
        }

        // API: Sync Menu (POS -> Server)
        if (url.pathname === "/api/menu" && req.method === "POST") {
            const body = await req.json();
            console.log("Menu Synced:", body.length, "items");
            return Response.json({ success: true });
        }

        // Serve Static Files
        let filePath = url.pathname;
        if (filePath === "/" || filePath === "") filePath = "/index.html";

        const publicDir = join(process.cwd(), "public");
        const file = Bun.file(join(publicDir, filePath));

        if (await file.exists()) {
            return new Response(file);
        }

        return new Response("Not Found", { status: 404 });
    },
    websocket: {
        open(ws) {
            console.log("Client connected");
            ws.subscribe("pos-updates");
        },
        message(ws, message) {
            console.log("Relaying:", message);
            ws.publish("pos-updates", message);
        },
        close(ws) {
            console.log("Client disconnected");
        },
    },
});

console.log(`🦊 persistent LAN Server running at http://${server.hostname}:${server.port}`);