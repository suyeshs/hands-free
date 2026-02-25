/**
 * Mock Watch Handoff Service
 * Simulates sending notifications and order summaries to a wearable device
 */

export class WatchHandoffService {
    /**
     * Send a notification to the watch
     */
    static async sendNotification(title: string, body: string) {
        console.log(`[WatchHandoff] Sending to Watch: ${title} - ${body}`);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // In a real app, this would use Web Push or a specialized wearable API
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('watch-notification', {
                detail: { title, body, timestamp: Date.now() }
            });
            window.dispatchEvent(event);
        }

        return { success: true, deviceId: 'apple-watch-ultra-2' };
    }

    /**
     * Handoff the entire cart to the watch for payment/confirmation
     */
    static async handoffOrder(orderTotal: number, itemCount: number) {
        return this.sendNotification(
            '🛒 Checkout Ready',
            `Pay ₹${orderTotal} for ${itemCount} items on your watch.`
        );
    }
}
