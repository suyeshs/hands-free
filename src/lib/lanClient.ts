import { usePOSStore } from '../stores/posStore';

class LANClient {
    private ws: WebSocket | null = null;
    private url: string = 'ws://localhost:3000/ws'; // In prod, this would be configurable
    private reconnectInterval: number = 5000;

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('[LANClient] Connected to LAN Server');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[LANClient] Received:', data);

                if (data.type === 'NEW_ORDER') {
                    this.handleNewOrder(data.payload);
                }
            } catch (e) {
                console.error('[LANClient] Failed to parse message', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[LANClient] Disconnected. Reconnecting in 5s...');
            setTimeout(() => this.connect(), this.reconnectInterval);
        };

        this.ws.onerror = (err) => {
            console.error('[LANClient] Error:', err);
            // ws.close() will trigger onclose which handles reconnect
        };
    }

    broadcastOrder(payload: any) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[LANClient] WebSocket not connected');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'NEW_ORDER',
            payload
        }));
        console.log('[LANClient] Order broadcasted successfully');
    }

    private handleNewOrder(payload: any) {
        if (!payload.items || !payload.tableId) return;

        // Convert payload to simple cart items for POS notification
        // Real implementation would be more robust
        const { tableId, items, total } = payload;

        // For now, just show a notification or alert since we need approval flow
        // Ideally, this adds to a "Incoming Orders" queue in POS
        alert(`New Order from Table ${tableId}! Total: $${total}`);

        // We could auto-inject into POS store if we wanted
        // usePOSStore.getState().importOrder(payload);
    }
}

export const lanClient = new LANClient();
