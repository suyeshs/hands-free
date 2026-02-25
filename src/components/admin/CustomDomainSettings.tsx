import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Globe,
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';

const TENANT_ROUTER_URL =
  import.meta.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-tenant-router.suyesh.workers.dev';

type VerifyStatus = 'idle' | 'verifying' | 'verified' | 'error';

export function CustomDomainSettings() {
  const getTenantId = useTenantStore((state) => state.getTenantId);
  const tenant = useTenantStore((state) => state.tenant);
  const { settings, updateOnlinePresence } = useRestaurantSettingsStore();

  const tenantId = getTenantId() || '';
  // The tenant's handsfree.tech subdomain is the required CNAME target
  const cnameTarget = tenant?.subdomain
    ? `${tenant.subdomain}`
    : tenantId
    ? `${tenantId}.handsfree.tech`
    : '';

  const [inputDomain, setInputDomain] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [foundCname, setFoundCname] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentDomain = settings.onlinePresence?.customDomain ?? null;

  // Pre-fill input if a domain is already active
  useEffect(() => {
    if (currentDomain) setInputDomain(currentDomain);
  }, [currentDomain]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cnameTarget).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleVerifyAndActivate = async () => {
    const domain = inputDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain) {
      setVerifyStatus('error');
      setVerifyMessage('Please enter a domain name.');
      return;
    }
    if (!tenantId) {
      setVerifyStatus('error');
      setVerifyMessage('No tenant configured. Please activate your POS first.');
      return;
    }

    setVerifyStatus('verifying');
    setVerifyMessage('Checking DNS records…');
    setFoundCname(null);

    try {
      // Step 1: DNS-only check for live feedback
      const verifyRes = await fetch(`${TENANT_ROUTER_URL}/api/custom-domain/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, tenantId }),
      });
      const verifyData = await verifyRes.json() as { valid: boolean; cnameTarget: string | null };
      setFoundCname(verifyData.cnameTarget);

      if (!verifyData.valid) {
        setVerifyStatus('error');
        setVerifyMessage(
          verifyData.cnameTarget
            ? `CNAME points to "${verifyData.cnameTarget}" instead of "${cnameTarget}".`
            : `No CNAME record found for "${domain}". Make sure you've added the DNS record.`,
        );
        return;
      }

      // Step 2: Persist the mapping
      const registerRes = await fetch(`${TENANT_ROUTER_URL}/api/custom-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, tenantId }),
      });
      const registerData = await registerRes.json() as { success: boolean; error?: string };

      if (!registerRes.ok || !registerData.success) {
        setVerifyStatus('error');
        setVerifyMessage(registerData.error || 'Failed to save domain mapping. Please try again.');
        return;
      }

      // Step 3: Persist in local store
      await updateOnlinePresence({ customDomain: domain.startsWith('www.') ? domain.slice(4) : domain });
      setVerifyStatus('verified');
      setVerifyMessage('Domain activated successfully!');
    } catch (err) {
      setVerifyStatus('error');
      setVerifyMessage('Network error. Please check your connection and try again.');
    }
  };

  const handleRemove = async () => {
    if (!currentDomain || !tenantId) return;
    setIsRemoving(true);
    try {
      await fetch(`${TENANT_ROUTER_URL}/api/custom-domain`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: currentDomain, tenantId }),
      });
      await updateOnlinePresence({ customDomain: null });
      setInputDomain('');
      setVerifyStatus('idle');
      setVerifyMessage('');
    } catch (err) {
      setVerifyStatus('error');
      setVerifyMessage('Failed to remove domain. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current handsfree.tech address */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Your Handsfree Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-1">
            Your restaurant is always accessible at:
          </p>
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
            https://{cnameTarget || `${tenantId}.handsfree.tech`}
          </code>
        </CardContent>
      </Card>

      {/* Active custom domain */}
      {currentDomain && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Custom Domain
              <Badge className="bg-green-600 ml-auto">Active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono">{currentDomain}</code>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={handleRemove}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="ml-1">{isRemoving ? 'Removing…' : 'Remove'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup instructions (collapsible) */}
      <Card>
        <CardHeader
          className="pb-2 cursor-pointer select-none"
          onClick={() => setShowInstructions((v) => !v)}
        >
          <CardTitle className="flex items-center justify-between text-base">
            <span>How to set up a custom domain</span>
            {showInstructions ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        {showInstructions && (
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              In your domain registrar's DNS settings, add the following record:
            </p>
            <div className="rounded-md bg-muted p-3 text-sm space-y-1 font-mono">
              <div className="flex gap-4">
                <span className="text-muted-foreground w-16">Type</span>
                <span>CNAME</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-16">Name</span>
                <span>@ (or www)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-16">Target</span>
                <span className="flex-1 break-all">{cnameTarget || `${tenantId}.handsfree.tech`}</span>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
                  <Copy className="h-3 w-3 mr-1" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              DNS changes can take up to 48 hours to propagate, though they usually apply within minutes.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Domain input + verify */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {currentDomain ? 'Change Domain' : 'Add Custom Domain'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="yourdomain.com"
              value={inputDomain}
              onChange={(e) => {
                setInputDomain(e.target.value);
                setVerifyStatus('idle');
                setVerifyMessage('');
              }}
              disabled={verifyStatus === 'verifying'}
            />
            <Button
              onClick={handleVerifyAndActivate}
              disabled={!inputDomain.trim() || verifyStatus === 'verifying'}
            >
              {verifyStatus === 'verifying' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying…
                </>
              ) : (
                'Verify & Activate'
              )}
            </Button>
          </div>

          {/* Status feedback */}
          {verifyStatus !== 'idle' && (
            <div
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                verifyStatus === 'verified'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : verifyStatus === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {verifyStatus === 'verified' && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              {verifyStatus === 'error' && <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              {verifyStatus === 'verifying' && <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />}
              <div>
                <p>{verifyMessage}</p>
                {verifyStatus === 'error' && foundCname && (
                  <p className="text-xs mt-1 opacity-75">
                    Found CNAME: <code>{foundCname}</code>
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
