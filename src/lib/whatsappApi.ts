/**
 * WhatsApp Business plugin — API client.
 *
 * Endpoints map 1:1 to the `backend.endpoints` block in
 * plugins/whatsapp-business/manifest.json. They are served by the
 * handsfree-whatsapp-business Cloudflare Worker (Phase 1: credentials save/get
 * + webhook verify only; sending, conversations, templates and analytics return
 * 501 until later phases).
 */

const API_BASE =
  import.meta.env.VITE_WHATSAPP_ENDPOINT ||
  'https://handsfree-whatsapp-business.suyesh.workers.dev';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  webhookVerifyToken: string;
  webhookSecret?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
}

export interface WhatsAppCredentialsRow extends WhatsAppCredentials {
  tenantId: string;
  status: 'unverified' | 'verified' | 'error';
  lastVerifiedAt?: string;
  errorMessage?: string;
}

export interface WhatsAppConversation {
  id: string;
  contactPhone: string;
  contactName: string | null;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: 'open' | 'closed' | 'archived';
}

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  messageType: 'text' | 'image' | 'document' | 'template';
  mediaId?: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  body: string;
  variables: string[];
}

export interface WhatsAppAnalytics {
  windowStart: string;
  windowEnd: string;
  messagesSent: number;
  messagesReceived: number;
  conversationsOpened: number;
  uniqueContacts: number;
  avgResponseSeconds: number | null;
  byDay: Array<{ date: string; sent: number; received: number }>;
}

class WhatsAppApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'WhatsAppApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new WhatsAppApiError(res.status, text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const whatsappApi = {
  async getCredentials(tenantId: string): Promise<WhatsAppCredentialsRow | null> {
    try {
      return await request<WhatsAppCredentialsRow>(
        `/api/whatsapp/credentials/${tenantId}`
      );
    } catch (err) {
      if (err instanceof WhatsAppApiError && err.status === 404) return null;
      throw err;
    }
  },

  async saveCredentials(
    tenantId: string,
    creds: WhatsAppCredentials
  ): Promise<WhatsAppCredentialsRow> {
    return request<WhatsAppCredentialsRow>('/api/whatsapp/credentials', {
      method: 'POST',
      body: JSON.stringify({ tenantId, ...creds }),
    });
  },

  async listConversations(tenantId: string): Promise<WhatsAppConversation[]> {
    return request<WhatsAppConversation[]>(
      `/api/whatsapp/conversations/${tenantId}`
    );
  },

  async listMessages(conversationId: string): Promise<WhatsAppMessage[]> {
    return request<WhatsAppMessage[]>(
      `/api/whatsapp/messages/${conversationId}`
    );
  },

  async sendMessage(input: {
    tenantId: string;
    conversationId: string;
    body: string;
  }): Promise<WhatsAppMessage> {
    return request<WhatsAppMessage>('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async listTemplates(tenantId: string): Promise<WhatsAppTemplate[]> {
    return request<WhatsAppTemplate[]>(
      `/api/whatsapp/templates/${tenantId}`
    );
  },

  async getAnalytics(tenantId: string, days = 30): Promise<WhatsAppAnalytics> {
    return request<WhatsAppAnalytics>(
      `/api/whatsapp/analytics/${tenantId}?days=${days}`
    );
  },
};

export { WhatsAppApiError };
