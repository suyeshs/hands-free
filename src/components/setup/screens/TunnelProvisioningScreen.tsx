/**
 * TunnelProvisioningScreen Component
 * Provision named Cloudflare tunnel for persistent restaurant URL
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useSetupWizardStore } from '../../../stores/setupWizardStore';
import {
  provisionTunnel,
  checkTunnelStatus,
  generateRestaurantSlug,
} from '../../../services/tunnelProvisioningService';

type ProvisioningState = 'idle' | 'checking' | 'provisioning' | 'success' | 'error';

export function TunnelProvisioningScreen() {
  const { wizardData, updateWizardData } = useSetupWizardStore();
  const restaurantName = wizardData.restaurantInfo?.name || '';

  const [slug, setSlug] = useState(
    wizardData.tunnelInfo?.slug || generateRestaurantSlug(restaurantName)
  );
  const [state, setState] = useState<ProvisioningState>('idle');
  const [error, setError] = useState<string>('');
  const [tunnelUrl, setTunnelUrl] = useState<string>(wizardData.tunnelInfo?.url || '');

  // Check if tunnel is already provisioned on mount
  useEffect(() => {
    async function checkStatus() {
      setState('checking');
      try {
        const status = await checkTunnelStatus();
        if (status.provisioned && status.url) {
          setTunnelUrl(status.url);
          setSlug(status.tunnelName || slug);
          setState('success');
          updateWizardData({
            tunnelInfo: {
              slug: status.tunnelName || slug,
              url: status.url,
              provisioned: true,
            },
          });
        } else {
          setState('idle');
        }
      } catch (err) {
        console.error('[Tunnel] Status check failed:', err);
        setState('idle');
      }
    }

    if (!wizardData.tunnelInfo?.provisioned) {
      checkStatus();
    } else {
      setState('success');
    }
  }, []);

  // Auto-generate slug when restaurant name changes
  useEffect(() => {
    if (restaurantName && !wizardData.tunnelInfo?.provisioned) {
      setSlug(generateRestaurantSlug(restaurantName));
    }
  }, [restaurantName, wizardData.tunnelInfo?.provisioned]);

  const handleProvision = async () => {
    if (!slug.trim()) {
      setError('Please enter a restaurant slug');
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    setError('');
    setState('provisioning');

    try {
      const result = await provisionTunnel(slug);
      setTunnelUrl(result.url);
      setState('success');

      // Update wizard data
      updateWizardData({
        tunnelInfo: {
          slug: result.tunnelName,
          url: result.url,
          provisioned: true,
        },
      });
    } catch (err: any) {
      console.error('[Tunnel] Provisioning failed:', err);
      setError(err.message || 'Failed to provision tunnel. Please try again.');
      setState('error');
    }
  };

  const handleSlugChange = (value: string) => {
    // Only allow lowercase, numbers, and hyphens
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
  };

  const isLoading = state === 'checking' || state === 'provisioning';
  const isSuccess = state === 'success';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-paprika/20 to-saffron/10 flex items-center justify-center">
          <Globe className="w-8 h-8 text-saffron" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-wider mb-3">Online Presence</h2>
        <p className="text-muted-foreground">
          Get a permanent URL for your restaurant's online ordering
        </p>
      </motion.div>

      {/* Main content */}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Info card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-saffron/10 to-paprika/5 border-2 border-saffron/20">
          <h3 className="font-bold text-lg mb-2">What's This?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            We'll create a permanent web address for your restaurant where customers can place
            orders online. This URL is yours forever and never changes.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Example:</strong> mahesh-dhaba.menu.handsfree.com
          </p>
        </div>

        {/* Slug input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Choose Your URL</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={isSuccess || isLoading}
              placeholder="restaurant-name"
              className={`
                flex-1 px-4 py-3 rounded-xl border-2 bg-background
                focus:outline-none focus:ring-2 focus:ring-saffron/20
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  error
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-white/10 focus:border-saffron'
                }
              `}
            />
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              .menu.handsfree.com
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Full URL preview */}
        {slug && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-muted-foreground mb-1">Your permanent URL:</div>
            <div className="text-lg font-mono font-bold text-saffron break-all">
              https://{slug}.menu.handsfree.com
            </div>
          </div>
        )}

        {/* Success message */}
        {isSuccess && tunnelUrl && (
          <motion.div
            className="p-6 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-2 border-green-500/30"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-500 mb-1">Tunnel Provisioned!</h3>
                <p className="text-sm text-muted-foreground">
                  Your restaurant's permanent URL is ready. Customers can now access your menu and
                  place orders at this address.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Provision button */}
        {!isSuccess && (
          <button
            onClick={handleProvision}
            disabled={isLoading || !slug.trim()}
            className={`
              w-full px-6 py-4 rounded-xl font-bold
              transition-all duration-200
              ${
                isLoading || !slug.trim()
                  ? 'bg-white/5 text-muted-foreground cursor-not-allowed'
                  : 'bg-gradient-to-r from-paprika to-saffron text-white hover:shadow-lg hover:scale-105'
              }
            `}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{state === 'checking' ? 'Checking...' : 'Provisioning...'}</span>
              </div>
            ) : (
              'Create My URL'
            )}
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default TunnelProvisioningScreen;
