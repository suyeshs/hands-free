import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';
import {
  whatsappApi,
  WhatsAppApiError,
  type WhatsAppTemplate,
} from '../../lib/whatsappApi';

function StatusBadge({ status }: { status: WhatsAppTemplate['status'] }) {
  if (status === 'APPROVED') {
    return (
      <Badge className="bg-green-600">
        <CheckCircle className="w-3 h-3 mr-1" /> Approved
      </Badge>
    );
  }
  if (status === 'REJECTED') {
    return (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Clock className="w-3 h-3 mr-1" /> Pending
    </Badge>
  );
}

function CategoryBadge({ category }: { category: WhatsAppTemplate['category'] }) {
  const palette: Record<WhatsAppTemplate['category'], string> = {
    UTILITY: 'bg-blue-500/10 text-blue-700',
    MARKETING: 'bg-purple-500/10 text-purple-700',
    AUTHENTICATION: 'bg-amber-500/10 text-amber-700',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${palette[category]}`}>
      {category}
    </span>
  );
}

export function WhatsAppTemplates() {
  const tenantId = useTenantStore((s) => s.getTenantId()) || '';

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await whatsappApi.listTemplates(tenantId);
      setTemplates(rows);
    } catch (err) {
      setError(
        err instanceof WhatsAppApiError
          ? `Failed to load templates (HTTP ${err.status}).`
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
  }, [tenantId]);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">Message Templates</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Templates are created and approved in Meta Business Suite. This view
                mirrors what's available on your WhatsApp Business Account.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                )}
                Refresh
              </Button>
              <Button asChild size="sm">
                <a
                  href="https://business.facebook.com/wa/manage/message-templates/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Manage in Meta <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-3 text-xs text-red-600 bg-red-500/10">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && templates.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No templates synced yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {t.language}
                    </span>
                  </div>
                  <div className="mt-1">
                    <CategoryBadge category={t.category} />
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap font-sans">
                {t.body}
              </pre>
              {t.variables.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">Variables:</span>
                  {t.variables.map((v) => (
                    <code
                      key={v}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono"
                    >
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default WhatsAppTemplates;
