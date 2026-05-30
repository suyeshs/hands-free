import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  MessageCircle,
  Send,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';
import {
  whatsappApi,
  WhatsAppApiError,
  type WhatsAppConversation,
  type WhatsAppMessage,
} from '../../lib/whatsappApi';

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function WhatsAppInbox() {
  const tenantId = useTenantStore((s) => s.getTenantId()) || '';

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const loadConversations = async () => {
    if (!tenantId) return;
    setConvLoading(true);
    setConvError(null);
    try {
      const rows = await whatsappApi.listConversations(tenantId);
      setConversations(rows);
      if (rows.length > 0 && !activeId) setActiveId(rows[0].id);
    } catch (err) {
      setConvError(
        err instanceof WhatsAppApiError
          ? `Failed to load conversations (HTTP ${err.status}).`
          : err instanceof Error
            ? err.message
            : String(err)
      );
    } finally {
      setConvLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMsgLoading(true);
    setMsgError(null);
    whatsappApi
      .listMessages(activeId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setMsgError(
          err instanceof WhatsAppApiError
            ? `Failed to load messages (HTTP ${err.status}).`
            : err instanceof Error
              ? err.message
              : String(err)
        );
      })
      .finally(() => {
        if (!cancelled) setMsgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.contactPhone.toLowerCase().includes(q) ||
        (c.contactName || '').toLowerCase().includes(q) ||
        (c.lastMessageBody || '').toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const active = conversations.find((c) => c.id === activeId) || null;

  const handleSend = async () => {
    if (!activeId || !draft.trim() || !tenantId) return;
    setSending(true);
    try {
      const msg = await whatsappApi.sendMessage({
        tenantId,
        conversationId: activeId,
        body: draft.trim(),
      });
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch (err) {
      setMsgError(
        err instanceof WhatsAppApiError
          ? `Send failed (HTTP ${err.status}). Backend may not be deployed yet.`
          : err instanceof Error
            ? err.message
            : String(err)
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 h-[640px]">
      {/* Conversations sidebar */}
      <Card className="overflow-hidden flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Conversations</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadConversations}
              disabled={convLoading}
            >
              {convLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search…"
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convError && (
            <div className="m-3 p-2 rounded-md bg-red-500/10 text-red-600 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{convError}</span>
            </div>
          )}
          {!convLoading && !convError && filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No conversations yet
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left p-3 border-b hover:bg-accent transition-colors ${
                c.id === activeId ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {c.contactName || c.contactPhone}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.lastMessageBody || '—'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(c.lastMessageAt)}
                  </span>
                  {c.unreadCount > 0 && (
                    <Badge className="bg-green-600 px-1.5 py-0 text-[10px]">
                      {c.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Thread */}
      <Card className="overflow-hidden flex flex-col">
        {!active ? (
          <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation to view messages.
          </CardContent>
        ) : (
          <>
            <div className="p-3 border-b">
              <div className="font-medium text-sm">
                {active.contactName || active.contactPhone}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {active.contactPhone}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
              {msgLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {msgError && (
                <div className="p-2 rounded-md bg-red-500/10 text-red-600 text-xs">
                  {msgError}
                </div>
              )}
              {!msgLoading && messages.length === 0 && !msgError && (
                <div className="text-center text-xs text-muted-foreground py-6">
                  No messages.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      m.direction === 'outbound'
                        ? 'bg-green-600 text-white'
                        : 'bg-background border'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div
                      className={`text-[10px] mt-1 ${
                        m.direction === 'outbound' ? 'text-white/70' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {m.direction === 'outbound' && ` · ${m.status}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                disabled={sending}
              />
              <Button onClick={handleSend} disabled={sending || !draft.trim()}>
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default WhatsAppInbox;
