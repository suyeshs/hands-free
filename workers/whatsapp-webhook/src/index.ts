/**
 * WhatsApp Webhook Worker
 * Handles incoming WhatsApp messages and integrates with restaurant POS system
 * Supports AI-powered responses via OpenClaw/Claude integration
 *
 * @version 2.0.0
 * @compatible Cloudflare Workers 2024+
 */

import type { ExecutionContext } from '@cloudflare/workers-types';

/**
 * Environment bindings and variables
 * Configure via wrangler.jsonc and secrets
 */
export interface Env {
  // WhatsApp Business API Configuration
  readonly WHATSAPP_VERIFY_TOKEN: string;
  readonly WHATSAPP_ACCESS_TOKEN: string;
  readonly WHATSAPP_PHONE_NUMBER_ID: string;
  readonly WHATSAPP_BUSINESS_ACCOUNT_ID: string;

  // AI Integration
  readonly ANTHROPIC_API_KEY?: string; // For Claude AI
  readonly OPENCLAW_API_URL?: string; // Your OpenClaw agent service URL
  readonly OPENCLAW_API_KEY?: string;

  // Cloudflare Bindings
  readonly RESTAURANT_DB: D1Database; // Your D1 database
  readonly WHATSAPP_SESSIONS: KVNamespace; // Session storage
  readonly MEDIA_STORAGE?: R2Bucket; // Optional media storage

  // Environment variables
  readonly ENVIRONMENT: 'development' | 'staging' | 'production';
}

// ============================================================================
// Type Definitions
// ============================================================================

interface WhatsAppWebhookBody {
  object: string;
  entry: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

interface WhatsAppChange {
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: WhatsAppContact[];
    messages?: WhatsAppMessage[];
    statuses?: WhatsAppStatus[];
  };
  field: string;
}

interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'interactive';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  interactive?: {
    type: string;
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description: string;
    };
  };
  context?: {
    from: string;
    id: string;
  };
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

interface UserSession {
  userId: string;
  tenantId?: string;
  conversationContext: ConversationMessage[];
  lastActive: number;
  userRole?: 'customer' | 'staff' | 'manager';
  metadata?: Record<string, any>;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIResponse {
  message: string;
  intent?: string;
  entities?: Record<string, any>;
  actions?: Action[];
  confidence?: number;
}

interface Action {
  type: 'query_database' | 'send_notification' | 'create_order' | 'book_table' | 'check_inventory';
  params: Record<string, any>;
}

// ============================================================================
// Main Request Handler (Latest Workers API)
// ============================================================================

/**
 * Worker class with fetch handler
 * Modern Cloudflare Workers pattern with TypeScript support
 */
export default {
  /**
   * Main fetch handler for all incoming requests
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const method = request.method;

    try {
      // Router pattern
      const route = `${method} ${pathname}`;

      switch (route) {
        // Webhook verification (GET /webhook)
        case 'GET /webhook':
          return handleWebhookVerification(searchParams, env);

        // Webhook message handling (POST /webhook)
        case 'POST /webhook':
          return await handleWebhookMessage(request, env, ctx);

        // Health check (GET /health)
        case 'GET /health':
          return Response.json({
            status: 'ok',
            environment: env.ENVIRONMENT,
            timestamp: new Date().toISOString(),
            version: '2.0.0',
          });

        // Send message API (POST /send)
        case 'POST /send':
          return await handleSendMessage(request, env);

        // Metrics endpoint (GET /metrics)
        case 'GET /metrics':
          return await handleMetrics(env);

        // 404 for unknown routes
        default:
          return Response.json(
            {
              error: 'Not found',
              path: pathname,
              method
            },
            { status: 404 }
          );
      }
    } catch (error) {
      console.error('[Worker Error]', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        path: pathname,
        method,
      });

      return Response.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
          requestId: crypto.randomUUID(),
        },
        { status: 500 }
      );
    }
  },

  /**
   * Scheduled handler for cron jobs (optional)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[Scheduled Event]', event.cron);

    // Example: Clean up old sessions daily
    ctx.waitUntil(cleanupOldSessions(env));

    // Example: Send daily reports
    // ctx.waitUntil(sendDailyReports(env));
  },
};

// ============================================================================
// Webhook Verification
// ============================================================================

/**
 * Handle WhatsApp webhook verification
 * Required when setting up the webhook in Meta Business Suite
 */
function handleWebhookVerification(searchParams: URLSearchParams, env: Env): Response {
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[Webhook Verification]', {
    mode,
    tokenMatch: token === env.WHATSAPP_VERIFY_TOKEN,
    hasChallenge: !!challenge,
  });

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook Verification] ✓ Success');
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.error('[Webhook Verification] ✗ Failed - Invalid token or mode');
  return new Response('Forbidden', { status: 403 });
}

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Handle incoming WhatsApp messages
 */
async function handleWebhookMessage(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as WhatsAppWebhookBody;

    // Validate webhook payload
    if (body.object !== 'whatsapp_business_account') {
      console.warn('Invalid webhook object:', body.object);
      return new Response(JSON.stringify({ error: 'Invalid webhook object' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Process all entries
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          const messages = change.value.messages;
          const contacts = change.value.contacts;

          if (messages && messages.length > 0) {
            // Process messages asynchronously (don't block webhook response)
            ctx.waitUntil(
              processMessages(messages, contacts, env)
            );
          }

          // Handle status updates
          const statuses = change.value.statuses;
          if (statuses && statuses.length > 0) {
            ctx.waitUntil(
              processStatusUpdates(statuses, env)
            );
          }
        }
      }
    }

    // Always respond quickly to WhatsApp (within 20 seconds)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error handling webhook message:', error);
    return new Response(JSON.stringify({ error: 'Failed to process message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Process incoming messages
 */
async function processMessages(
  messages: WhatsAppMessage[],
  contacts: WhatsAppContact[] | undefined,
  env: Env
): Promise<void> {
  for (const message of messages) {
    try {
      const userId = message.from;
      const contact = contacts?.find(c => c.wa_id === userId);
      const userName = contact?.profile.name || 'User';

      console.log(`Processing message from ${userName} (${userId})`);

      // Get or create user session
      const session = await getUserSession(userId, env);
      session.lastActive = Date.now();

      // Extract message content
      let messageText = '';
      let messageType = message.type;

      if (message.type === 'text' && message.text) {
        messageText = message.text.body;
      } else if (message.type === 'interactive' && message.interactive) {
        // Handle button/list responses
        if (message.interactive.button_reply) {
          messageText = message.interactive.button_reply.title;
        } else if (message.interactive.list_reply) {
          messageText = message.interactive.list_reply.title;
        }
      } else if (message.type === 'location' && message.location) {
        messageText = `User shared location: ${message.location.name || 'Unknown'} (${message.location.latitude}, ${message.location.longitude})`;
      }

      // Add message to conversation context
      session.conversationContext.push({
        role: 'user',
        content: messageText,
        timestamp: parseInt(message.timestamp) * 1000,
      });

      // Keep only last 10 messages for context
      if (session.conversationContext.length > 10) {
        session.conversationContext = session.conversationContext.slice(-10);
      }

      // Process with AI
      const aiResponse = await processWithAI(messageText, session, env);

      // Execute any database actions
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        for (const action of aiResponse.actions) {
          await executeAction(action, session, env);
        }
      }

      // Add assistant response to context
      session.conversationContext.push({
        role: 'assistant',
        content: aiResponse.message,
        timestamp: Date.now(),
      });

      // Save session
      await saveUserSession(userId, session, env);

      // Send response via WhatsApp
      await sendWhatsAppMessage(userId, aiResponse.message, env);

      // Mark message as read
      await markMessageAsRead(message.id, env);

    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);

      // Send error message to user
      try {
        await sendWhatsAppMessage(
          message.from,
          "Sorry, I encountered an error processing your request. Please try again or contact support.",
          env
        );
      } catch (sendError) {
        console.error('Failed to send error message:', sendError);
      }
    }
  }
}

/**
 * Process status updates (delivery receipts, read receipts)
 */
async function processStatusUpdates(
  statuses: WhatsAppStatus[],
  env: Env
): Promise<void> {
  for (const status of statuses) {
    console.log(`Message ${status.id} status: ${status.status}`);

    // You can store these in KV or D1 for tracking
    // Example: Track message delivery rates, read rates, etc.
  }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get user session from KV
 */
async function getUserSession(userId: string, env: Env): Promise<UserSession> {
  const sessionKey = `session:${userId}`;
  const sessionData = await env.WHATSAPP_SESSIONS.get(sessionKey, 'json') as UserSession | null;

  if (sessionData) {
    return sessionData;
  }

  // Create new session
  return {
    userId,
    conversationContext: [],
    lastActive: Date.now(),
  };
}

/**
 * Save user session to KV
 */
async function saveUserSession(userId: string, session: UserSession, env: Env): Promise<void> {
  const sessionKey = `session:${userId}`;

  // Expire session after 24 hours of inactivity
  const expirationTtl = 24 * 60 * 60;

  await env.WHATSAPP_SESSIONS.put(
    sessionKey,
    JSON.stringify(session),
    { expirationTtl }
  );
}

// ============================================================================
// AI Processing
// ============================================================================

/**
 * Process message with AI (Claude via Anthropic API or OpenClaw)
 */
async function processWithAI(
  message: string,
  session: UserSession,
  env: Env
): Promise<AIResponse> {
  try {
    // Option 1: Use Anthropic Claude directly
    if (env.ANTHROPIC_API_KEY) {
      return await processWithClaude(message, session, env);
    }

    // Option 2: Use OpenClaw agent service
    if (env.OPENCLAW_API_URL && env.OPENCLAW_API_KEY) {
      return await processWithOpenClaw(message, session, env);
    }

    // Fallback: Simple rule-based responses
    return await processWithRules(message, session, env);

  } catch (error) {
    console.error('AI processing error:', error);
    return {
      message: "I'm having trouble understanding that. Could you rephrase your question?",
      confidence: 0,
    };
  }
}

/**
 * Process with Claude AI
 */
async function processWithClaude(
  message: string,
  session: UserSession,
  env: Env
): Promise<AIResponse> {
  const systemPrompt = `You are a helpful restaurant assistant. You help with:
- Answering menu questions
- Taking orders
- Managing reservations
- Checking order status
- Staff inquiries (schedules, payroll)
- Inventory questions

Keep responses brief and friendly (suitable for WhatsApp). Use emojis when appropriate.
If you need to query the database, include an action in your response.`;

  const messages = [
    ...session.conversationContext.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json() as any;
  const assistantMessage = data.content[0].text;

  // Parse actions from response (you can use structured output or parse text)
  const actions = parseActionsFromMessage(assistantMessage);

  return {
    message: assistantMessage,
    actions,
    confidence: 0.9,
  };
}

/**
 * Process with OpenClaw agent service
 */
async function processWithOpenClaw(
  message: string,
  session: UserSession,
  env: Env
): Promise<AIResponse> {
  const response = await fetch(`${env.OPENCLAW_API_URL}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENCLAW_API_KEY}`,
    },
    body: JSON.stringify({
      message,
      context: session.conversationContext,
      userId: session.userId,
      tenantId: session.tenantId,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenClaw API error: ${response.statusText}`);
  }

  const data = await response.json() as AIResponse;
  return data;
}

/**
 * Simple rule-based processing (fallback)
 */
async function processWithRules(
  message: string,
  session: UserSession,
  env: Env
): Promise<AIResponse> {
  const lowerMessage = message.toLowerCase();

  // Menu inquiry
  if (lowerMessage.includes('menu') || lowerMessage.includes('dishes')) {
    return {
      message: "I can help you with our menu! What type of dish are you looking for? 🍽️",
      intent: 'menu_inquiry',
      actions: [{
        type: 'query_database',
        params: { query: 'SELECT name, price FROM menu_items LIMIT 10' },
      }],
    };
  }

  // Order status
  if (lowerMessage.includes('order') && (lowerMessage.includes('status') || lowerMessage.includes('where'))) {
    return {
      message: "Let me check your order status. Can you provide your order number? 📦",
      intent: 'order_status',
    };
  }

  // Reservation
  if (lowerMessage.includes('book') || lowerMessage.includes('table') || lowerMessage.includes('reservation')) {
    return {
      message: "I'd be happy to help you book a table! 🪑\n\nPlease tell me:\n1. Date and time\n2. Number of guests\n3. Any special requests",
      intent: 'reservation',
      actions: [{
        type: 'book_table',
        params: {},
      }],
    };
  }

  // Staff schedule
  if (lowerMessage.includes('shift') || lowerMessage.includes('schedule')) {
    return {
      message: "Let me check your schedule. Please provide your employee ID or name. 📅",
      intent: 'staff_schedule',
      actions: [{
        type: 'query_database',
        params: { query: 'staff_schedule' },
      }],
    };
  }

  // Default response
  return {
    message: "Hello! 👋 I'm your restaurant assistant.\n\nI can help you with:\n• Menu & dishes\n• Orders & reservations\n• Staff schedules\n• Inventory checks\n\nWhat would you like to know?",
    intent: 'greeting',
  };
}

/**
 * Parse actions from AI message (simple implementation)
 */
function parseActionsFromMessage(message: string): Action[] {
  const actions: Action[] = [];

  // Look for action markers in the message
  // You can implement more sophisticated parsing based on your needs

  if (message.includes('[CHECK_INVENTORY]')) {
    actions.push({
      type: 'check_inventory',
      params: {},
    });
  }

  if (message.includes('[QUERY_DB:')) {
    const match = message.match(/\[QUERY_DB:(.*?)\]/);
    if (match) {
      actions.push({
        type: 'query_database',
        params: { query: match[1] },
      });
    }
  }

  return actions;
}

// ============================================================================
// Action Execution
// ============================================================================

/**
 * Execute database actions
 */
async function executeAction(
  action: Action,
  session: UserSession,
  env: Env
): Promise<any> {
  try {
    switch (action.type) {
      case 'query_database':
        return await queryDatabase(action.params.query, session, env);

      case 'check_inventory':
        return await checkInventory(action.params, session, env);

      case 'create_order':
        return await createOrder(action.params, session, env);

      case 'book_table':
        return await bookTable(action.params, session, env);

      default:
        console.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  } catch (error) {
    console.error(`Error executing action ${action.type}:`, error);
    return null;
  }
}

/**
 * Query restaurant database
 */
async function queryDatabase(
  query: string,
  session: UserSession,
  env: Env
): Promise<any> {
  // Add tenant isolation if needed
  const tenantId = session.tenantId;

  // Execute safe, read-only queries
  // Add validation to prevent SQL injection

  if (!query || query.trim().toUpperCase().startsWith('DROP') || query.trim().toUpperCase().startsWith('DELETE')) {
    throw new Error('Invalid query');
  }

  const result = await env.RESTAURANT_DB.prepare(query).all();
  return result.results;
}

/**
 * Check inventory levels
 */
async function checkInventory(
  params: Record<string, any>,
  session: UserSession,
  env: Env
): Promise<any> {
  const result = await env.RESTAURANT_DB
    .prepare(`
      SELECT item_name, current_stock, unit, low_stock_threshold
      FROM inventory
      WHERE tenant_id = ?
      AND current_stock < low_stock_threshold
      ORDER BY current_stock ASC
      LIMIT 10
    `)
    .bind(session.tenantId)
    .all();

  return result.results;
}

/**
 * Create order
 */
async function createOrder(
  params: Record<string, any>,
  session: UserSession,
  env: Env
): Promise<any> {
  // Implement order creation logic
  // This would integrate with your existing order system
  return { orderId: crypto.randomUUID(), status: 'pending' };
}

/**
 * Book table
 */
async function bookTable(
  params: Record<string, any>,
  session: UserSession,
  env: Env
): Promise<any> {
  // Implement table booking logic
  return { reservationId: crypto.randomUUID(), status: 'confirmed' };
}

// ============================================================================
// WhatsApp API Integration
// ============================================================================

/**
 * Send WhatsApp message
 */
async function sendWhatsAppMessage(
  to: string,
  message: string,
  env: Env,
  options?: {
    preview_url?: boolean;
    buttons?: Array<{ id: string; title: string }>;
  }
): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: options?.preview_url || false,
      body: message,
    },
  };

  // Add interactive buttons if provided
  if (options?.buttons && options.buttons.length > 0) {
    body.type = 'interactive';
    body.interactive = {
      type: 'button',
      body: {
        text: message,
      },
      action: {
        buttons: options.buttons.map(btn => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
    };
    delete body.text;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to send WhatsApp message:', error);
    throw new Error(`WhatsApp API error: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Message sent:', data);
}

/**
 * Mark message as read
 */
async function markMessageAsRead(messageId: string, env: Env): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });
}

/**
 * Handle send message API (internal use)
 */
async function handleSendMessage(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { to, message, buttons } = body;

    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await sendWhatsAppMessage(to, message, env, { buttons });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send message:', error);
    return new Response(JSON.stringify({
      error: 'Failed to send message',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
