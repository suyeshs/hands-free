import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';
import {
  whatsappApi,
  WhatsAppApiError,
  type WhatsAppCredentialsRow,
} from '../../lib/whatsappApi';

type Status = 'idle' | 'loading' | 'saving' | 'verifying' | 'success' | 'error';

const WHATSAPP_WORKER_URL =
  import.meta.env.VITE_WHATSAPP_ENDPOINT ||
  'https://handsfree-whatsapp-business.suyesh.workers.dev';

export function WhatsAppSettings() {
  const tenantId = useTenantStore((s) => s.getTenantId()) || '';

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [existing, setExisting] = useState<WhatsAppCredentialsRow | null>(null);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const webhookUrl = tenantId
    ? `${WHATSAPP_WORKER_URL}/api/whatsapp/webhook/${tenantId}`
    : '';

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setStatus('loading');
    whatsappApi
      .getCredentials(tenantId)
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setExisting(row);
          setPhoneNumberId(row.phoneNumberId);
          setWabaId(row.wabaId);
          setWebhookVerifyToken(row.webhookVerifyToken);
          setWebhookSecret(row.webhookSecret || '');
        }
        setStatus('idle');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof WhatsAppApiError && err.status === 404) {
          setStatus('error');
          setMessage(
            'WhatsApp backend not deployed yet. Save & verify will not work until the whatsapp-business worker is live.'
          );
        } else {
          setStatus('error');
          setMessage(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const handleSave = async () => {
    if (!tenantId) {
      setStatus('error');
      setMessage('No tenant configured. Please activate your POS first.');
      return;
    }
    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim() || !webhookVerifyToken.trim()) {
      setStatus('error');
      setMessage('Phone Number ID, WABA ID, Access Token and Webhook Verify Token are required.');
      return;
    }

    setStatus('saving');
    setMessage('Saving credentials…');
    try {
      const saved = await whatsappApi.saveCredentials(tenantId, {
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        accessToken: accessToken.trim(),
        webhookVerifyToken: webhookVerifyToken.trim(),
        webhookSecret: webhookSecret.trim() || undefined,
      });
      setExisting(saved);
      setAccessToken('');
      setStatus('success');
      setMessage(
        saved.status === 'verified'
          ? `Connected to ${saved.verifiedName || saved.displayPhoneNumber || 'WhatsApp Business'}.`
          : 'Credentials saved. Verify the webhook in Meta Business Suite to complete setup.'
      );
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof WhatsAppApiError
          ? `Save failed (HTTP ${err.status}): ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      );
    }
  };

  const isConnected = existing?.status === 'verified';
  const busy = status === 'loading' || status === 'saving' || status === 'verifying';

  return (
    <div className="space-y-4">
      {existing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Account Status</CardTitle>
              {isConnected ? (
                <Badge className="bg-green-600">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" /> Unverified
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone number</span>
              <span className="font-mono">
                {existing.displayPhoneNumber || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verified name</span>
              <span>{existing.verifiedName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last verified</span>
              <span>
                {existing.lastVerifiedAt
                  ? new Date(existing.lastVerifiedAt).toLocaleString()
                  : '—'}
              </span>
            </div>
            {existing.errorMessage && (
              <div className="mt-2 p-2 rounded bg-red-500/10 text-red-600 text-xs">
                {existing.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            In Meta Business Suite, set the callback URL to the value below and use
            the verify token you provide.
          </p>
          <div>
            <label className="text-xs font-medium">Callback URL</label>
            <div className="flex gap-2 mt-1">
              <input
                readOnly
                className="flex-1 px-3 py-2 text-xs font-mono rounded-md border bg-muted"
                value={webhookUrl}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy('webhook', webhookUrl)}
                disabled={!webhookUrl}
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                {copiedField === 'webhook' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <a
            href="https://business.facebook.com/wa/manage/phone-numbers/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-primary hover:underline"
          >
            Open Meta Business Suite <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {existing ? 'Update Credentials' : 'Connect WhatsApp Business Account'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium">Phone Number ID</label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2 text-sm rounded-md border bg-background"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 123456789012345"
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-xs font-medium">
              WhatsApp Business Account (WABA) ID
            </label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2 text-sm rounded-md border bg-background"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="e.g. 987654321098765"
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-xs font-medium">
              Permanent Access Token {existing && '(leave blank to keep existing)'}
            </label>
            <div className="flex gap-2 mt-1">
              <input
                type={showToken ? 'text' : 'password'}
                className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={existing ? '••••••••••••••••' : 'EAAG...'}
                disabled={busy}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowToken((v) => !v)}
                type="button"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Webhook Verify Token</label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2 text-sm rounded-md border bg-background"
              value={webhookVerifyToken}
              onChange={(e) => setWebhookVerifyToken(e.target.value)}
              placeholder="A random string you choose"
              disabled={busy}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Must match the verify token entered in Meta Business Suite.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium">
              Webhook Signing Secret <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2 text-sm rounded-md border bg-background"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="App Secret from Meta App Dashboard"
              disabled={busy}
            />
          </div>

          {message && (
            <div
              className={`text-xs px-3 py-2 rounded-md ${
                status === 'error'
                  ? 'bg-red-500/10 text-red-600'
                  : status === 'success'
                    ? 'bg-green-500/10 text-green-700'
                    : 'bg-blue-500/10 text-blue-700'
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {existing ? 'Update' : 'Connect Account'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WhatsAppSettings;
