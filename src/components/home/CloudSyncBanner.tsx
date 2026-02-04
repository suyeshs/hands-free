/**
 * Cloud Sync Banner
 * Contextual banner promoting cloud sync based on multilocation workflow
 * Shows only if tenant is activated but cloud sync is not yet enabled
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, X, CheckCircle2 } from 'lucide-react';
import { useTenantStore } from '../../stores/tenantStore';

const BANNER_SNOOZE_KEY = 'cloud-sync-banner-snoozed-until';
const SNOOZE_DAYS = 14;

export function CloudSyncBanner() {
  const navigate = useNavigate();
  const getTenantId = useTenantStore((state) => state.getTenantId);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkVisibility();
  }, []);

  const checkVisibility = async () => {
    try {
      // Only show if tenant is activated
      const tenantId = getTenantId();
      if (!tenantId) {
        setIsVisible(false);
        setIsLoading(false);
        return;
      }

      // Check if online features are already enabled
      const activateOnline = localStorage.getItem('activate_online');
      if (activateOnline === 'true') {
        setIsVisible(false);
        setIsLoading(false);
        return;
      }

      // Check if banner is snoozed
      const snoozedUntil = localStorage.getItem(BANNER_SNOOZE_KEY);
      if (snoozedUntil) {
        const snoozedDate = new Date(snoozedUntil);
        if (snoozedDate > new Date()) {
          setIsVisible(false);
          setIsLoading(false);
          return;
        }
      }

      // Show banner - tenant is active but cloud sync not enabled
      setIsVisible(true);
      setIsLoading(false);
    } catch (error) {
      console.error('[CloudSyncBanner] Error checking visibility:', error);
      setIsVisible(false);
      setIsLoading(false);
    }
  };

  const handleEnableNow = () => {
    navigate('/settings?category=cloud-sync');
  };

  const handleRemindLater = () => {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + SNOOZE_DAYS);
    localStorage.setItem(BANNER_SNOOZE_KEY, snoozeUntil.toISOString());
    setIsVisible(false);
  };

  const handleDismiss = () => {
    handleRemindLater();
  };

  if (isLoading || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
        className="mb-6 relative z-10"
      >
        <div className="glass-panel-dark border-l-4 border-saffron p-5 relative">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-warm-white transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="flex items-start gap-4 pr-8">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-saffron/10 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-saffron" />
            </div>

            {/* Text content */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-warm-white mb-2">
                Sync Your Data to the Cloud
              </h3>
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                Enable cloud sync to back up your orders, menu, and sales data automatically. Access your data from any device and keep multiple locations in sync.
              </p>

              {/* Benefits */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-400">Automatic backup</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-400">Multi-device access</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-400">Real-time sync</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEnableNow}
                  className="px-4 py-2 bg-saffron text-warm-charcoal rounded-lg font-medium text-sm hover:bg-saffron/90 transition-colors"
                >
                  Enable Now
                </button>
                <button
                  onClick={handleRemindLater}
                  className="px-4 py-2 text-gray-400 hover:text-warm-white text-sm font-medium transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
