/**
 * WebSocket Integration for WhatsApp Webhook Worker
 * Provides real-time bidirectional communication using Durable Objects
 */

import type { DurableObjectNamespace } from '@cloudflare/workers-types';

export interface Env {
  CONVERSATION_ROOMS: DurableObjectNamespace;
}

/**
 * Get or create a conversation room for a user
 * @param userId WhatsApp user ID or phone number
 * @param env Environment with Durable Object bindings
 * @returns Durable Object stub for the conversation room
 */
export function getConversationRoom(userId: string, env: any) {
  // Create a unique ID for this conversation
  // You can customize this based on your needs (e.g., tenant + user)
  const roomId = env.CONVERSATION_ROOMS.idFromName(userId);
  return env.CONVERSATION_ROOMS.get(roomId);
}

/**
 * Get a conversation room by tenant and user
 * Useful for multi-tenant setups
 */
export function getTenantConversationRoom(tenantId: string, userId: string, env: any) {
  const roomId = env.CONVERSATION_ROOMS.idFromName(`${tenantId}:${userId}`);
  return env.CONVERSATION_ROOMS.get(roomId);
}

/**
 * Send a message to a user's conversation room via WebSocket
 * This will instantly push the message to any connected WebSocket clients
 */
export async function sendRealtimeMessage(
  userId: string,
  message: {
    from: string;
    content: string;
    type?: 'text' | 'image' | 'notification' | 'status';
    metadata?: Record<string, any>;
  },
  env: any
): Promise<void> {
  const room = getConversationRoom(userId, env);

  // Broadcast message to all WebSocket clients in this room
  await room.fetch('https://fake-host/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message.content,
      from: message.from,
      type: message.type || 'text',
      timestamp: Date.now(),
      metadata: message.metadata,
    }),
  });
}

/**
 * Notify WhatsApp user in real-time when something happens in the POS
 * Examples:
 * - Order status changed
 * - Payment received
 * - Table ready
 * - Staff responded to inquiry
 */
export async function notifyUserRealtime(
  userId: string,
  notification: {
    title: string;
    body: string;
    action?: string;
    actionUrl?: string;
  },
  env: any
): Promise<void> {
  const room = getConversationRoom(userId, env);

  await room.fetch('https://fake-host/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'notification',
      notification,
      timestamp: Date.now(),
    }),
  });
}

/**
 * Get conversation history from Durable Object storage
 */
export async function getConversationHistory(userId: string, env: any): Promise<any> {
  const room = getConversationRoom(userId, env);

  const response = await room.fetch('https://fake-host/messages');
  return await response.json();
}

/**
 * Get active WebSocket connections for a user
 */
export async function getActiveConnections(userId: string, env: any): Promise<any> {
  const room = getConversationRoom(userId, env);

  const response = await room.fetch('https://fake-host/clients');
  return await response.json();
}

/**
 * Handle WebSocket upgrade request from client
 * This allows external clients (admin panel, staff app) to connect via WebSocket
 */
export async function handleWebSocketConnection(
  request: Request,
  env: any
): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const tenantId = url.searchParams.get('tenantId');

  if (!userId) {
    return new Response('Missing userId parameter', { status: 400 });
  }

  // Get the conversation room for this user
  const room = tenantId
    ? getTenantConversationRoom(tenantId, userId, env)
    : getConversationRoom(userId, env);

  // Forward the WebSocket upgrade request to the Durable Object
  return room.fetch(request);
}

/**
 * Example: Integration with WhatsApp message handler
 *
 * When a WhatsApp message is received, also push it to WebSocket clients
 */
export async function broadcastWhatsAppMessageToWebSocket(
  userId: string,
  message: {
    id: string;
    from: string;
    content: string;
    timestamp: number;
  },
  env: any
): Promise<void> {
  await sendRealtimeMessage(
    userId,
    {
      from: message.from,
      content: message.content,
      type: 'text',
      metadata: {
        messageId: message.id,
        timestamp: message.timestamp,
        source: 'whatsapp',
      },
    },
    env
  );
}

/**
 * Example: Send order status update to customer via WebSocket + WhatsApp
 */
export async function notifyOrderStatus(
  userId: string,
  orderId: string,
  status: string,
  env: any
): Promise<void> {
  const message = {
    title: 'Order Update',
    body: `Your order #${orderId} is now ${status}`,
    action: 'view_order',
    actionUrl: `/orders/${orderId}`,
  };

  // Send to WebSocket clients
  await notifyUserRealtime(userId, message, env);

  // Also send via WhatsApp (you'd call your WhatsApp API here)
  // await sendWhatsAppMessage(userId, message.body, env);
}
