import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  BarChart3,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';
import {
  whatsappApi,
  WhatsAppApiError,
  type WhatsAppAnalytics as Analytics,
} from '../../lib/whatsappApi';

const WINDOWS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

function formatSeconds(sec: number | null): string {
  if (sec == null) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function WhatsAppAnalytics() {
  const tenantId = useTenantStore((s) => s.getTenantId()) || '';

  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await whatsappApi.getAnalytics(tenantId, days));
    } catch (err) {
      setError(
        err instanceof WhatsAppApiError
          ? `Failed to load analytics (HTTP ${err.status}).`
          : err instanceof Error
            ? err.message
            : String(err)
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, days]);

  const maxDay = useMemo(() => {
    if (!data) return 0;
    return data.byDay.reduce(
      (max, d) => Math.max(max, d.sent + d.received),
      0
    );
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <Button
              key={w.value}
              variant={days === w.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(w.value)}
              disabled={loading}
            >
              {w.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="p-3 text-xs text-red-600 bg-red-500/10">
            {error}
          </CardContent>
        </Card>
      )}

      {!data && !error && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No analytics data available yet.
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              icon={ArrowUpCircle}
              label="Sent"
              value={data.messagesSent.toLocaleString()}
            />
            <Stat
              icon={ArrowDownCircle}
              label="Received"
              value={data.messagesReceived.toLocaleString()}
            />
            <Stat
              icon={Users}
              label="Unique contacts"
              value={data.uniqueContacts.toLocaleString()}
              hint={`${data.conversationsOpened} conversations opened`}
            />
            <Stat
              icon={Clock}
              label="Avg response"
              value={formatSeconds(data.avgResponseSeconds)}
            />
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Daily volume ({data.windowStart.slice(0, 10)} →{' '}
                  {data.windowEnd.slice(0, 10)})
                </span>
              </div>
              {data.byDay.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6">
                  No traffic in this window.
                </div>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {data.byDay.map((d) => {
                    const total = d.sent + d.received;
                    const h = maxDay > 0 ? (total / maxDay) * 100 : 0;
                    const sentH = total > 0 ? (d.sent / total) * h : 0;
                    const recvH = total > 0 ? (d.received / total) * h : 0;
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col justify-end items-center gap-px"
                        title={`${d.date}: ${d.sent} sent · ${d.received} received`}
                      >
                        <div
                          className="w-full bg-green-600/80 rounded-t-sm"
                          style={{ height: `${sentH}%` }}
                        />
                        <div
                          className="w-full bg-blue-500/80"
                          style={{ height: `${recvH}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-green-600/80" /> Sent
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-blue-500/80" /> Received
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default WhatsAppAnalytics;
