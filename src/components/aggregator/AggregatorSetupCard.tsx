import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Circle,
  ToggleLeft,
  ToggleRight,
  Settings,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAggregatorSettingsStore } from '../../stores/aggregatorSettingsStore';
import { useAggregatorStore } from '../../stores/aggregatorStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { DEFAULT_PLATFORM_CONFIG } from '../../types/aggregatorSettings';

type Platform = 'swiggy' | 'zomato';

interface PlatformMeta {
  id: Platform;
  label: string;
  color: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  inactiveBg: string;
  partnerUrl: string;
  tauriOpen: string;
  tauriClose: string;
  emoji: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: 'swiggy',
    label: 'Swiggy',
    emoji: '🟠',
    color: 'orange',
    activeBg: 'bg-orange-500/20',
    activeBorder: 'border-orange-500/50',
    activeText: 'text-orange-300',
    inactiveBg: 'bg-white/5',
    partnerUrl: 'https://partner.swiggy.com/orders',
    tauriOpen: 'open_swiggy_dashboard',
    tauriClose: 'close_swiggy_dashboard',
  },
  {
    id: 'zomato',
    label: 'Zomato',
    emoji: '🔴',
    color: 'red',
    activeBg: 'bg-red-500/20',
    activeBorder: 'border-red-500/50',
    activeText: 'text-red-300',
    inactiveBg: 'bg-white/5',
    partnerUrl: 'https://www.zomato.com/partners/orders',
    tauriOpen: 'open_zomato_dashboard',
    tauriClose: 'close_zomato_dashboard',
  },
];

function PlatformRow({
  meta,
  orderCount,
  extractionActive,
}: {
  meta: PlatformMeta;
  orderCount: number;
  extractionActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [opening, setOpening] = useState(false);

  const { platforms, setPlatformConfig, markPlatformConfigured, autoAcceptEnabled } =
    useAggregatorSettingsStore();
  const config = platforms?.[meta.id] ?? DEFAULT_PLATFORM_CONFIG;

  const handleOpenDashboard = async () => {
    setOpening(true);
    try {
      await invoke(meta.tauriOpen);
    } catch (err) {
      console.error(`[AggregatorSetupCard] Failed to open ${meta.id}:`, err);
    } finally {
      setOpening(false);
    }
  };

  const handleToggleEnabled = () => {
    setPlatformConfig(meta.id, { enabled: !config.enabled });
  };

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        config.enabled ? `${meta.activeBg} ${meta.activeBorder}` : 'bg-white/5 border-white/10'
      )}
    >
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Platform emoji + name */}
        <span className="text-xl leading-none select-none">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-warm-white text-sm">{meta.label}</span>
            {config.isConfigured && config.enabled && (
              <span className="flex items-center gap-1 text-[11px] text-green-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            )}
            {extractionActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </div>
          {config.restaurantName ? (
            <p className="text-xs text-gray-400 truncate">{config.restaurantName}</p>
          ) : config.email ? (
            <p className="text-xs text-gray-500 truncate">{config.email}</p>
          ) : (
            <p className="text-xs text-gray-600">Not configured</p>
          )}
        </div>

        {/* Order count */}
        {orderCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
            {orderCount}
          </span>
        )}

        {/* Enable toggle */}
        <button
          onClick={handleToggleEnabled}
          className="flex-shrink-0 transition-colors"
          title={config.enabled ? 'Disable' : 'Enable'}
        >
          {config.enabled ? (
            <ToggleRight className={cn('w-6 h-6', meta.activeText)} />
          ) : (
            <ToggleLeft className="w-6 h-6 text-gray-500" />
          )}
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 text-gray-400 hover:text-warm-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable config panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
              {/* Restaurant name */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Restaurant name on {meta.label}
                </label>
                <input
                  type="text"
                  value={config.restaurantName}
                  onChange={(e) =>
                    setPlatformConfig(meta.id, { restaurantName: e.target.value })
                  }
                  placeholder={`Your restaurant name on ${meta.label}`}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-warm-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Account email */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Partner account email / phone
                </label>
                <input
                  type="text"
                  value={config.email}
                  onChange={(e) => setPlatformConfig(meta.id, { email: e.target.value })}
                  placeholder="email@example.com or 9XXXXXXXXX"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-warm-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Login instructions */}
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300 leading-relaxed">
                  Click <strong>Open Dashboard</strong> to log in to the {meta.label} partner
                  portal. Orders will be extracted automatically once you're logged in.
                </p>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenDashboard}
                  disabled={opening}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 justify-center',
                    config.enabled
                      ? 'bg-saffron hover:bg-saffron/90 text-warm-charcoal'
                      : 'bg-white/10 hover:bg-white/15 text-gray-300'
                  )}
                >
                  <ExternalLink className="w-4 h-4" />
                  {opening ? 'Opening…' : `Open ${meta.label} Dashboard`}
                </button>

                {/* Configured toggle */}
                <button
                  onClick={() => markPlatformConfigured(meta.id, !config.isConfigured)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                    config.isConfigured
                      ? 'bg-green-500/20 border-green-500/40 text-green-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  )}
                  title={config.isConfigured ? 'Mark as not logged in' : 'Mark as logged in'}
                >
                  {config.isConfigured ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  {config.isConfigured ? 'Logged in' : 'Mark logged in'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AggregatorSetupCardProps {
  swiggyActive: boolean;
  zomatoActive: boolean;
  pendingOrderCount: number;
  extractedCount: number;
  onOpenBoth: () => void;
  onCloseBoth: () => void;
}

export function AggregatorSetupCard({
  swiggyActive,
  zomatoActive,
  pendingOrderCount,
  extractedCount,
  onOpenBoth,
  onCloseBoth,
}: AggregatorSetupCardProps) {
  const navigate = useNavigate();
  const { autoAcceptEnabled, setAutoAcceptEnabled, platforms } = useAggregatorSettingsStore();
  const { orders } = useAggregatorStore();

  const swiggyOrders = orders.filter(
    (o) =>
      o.aggregator === 'swiggy' &&
      !['delivered', 'completed', 'cancelled'].includes(o.status)
  ).length;
  const zomatoOrders = orders.filter(
    (o) =>
      o.aggregator === 'zomato' &&
      !['delivered', 'completed', 'cancelled'].includes(o.status)
  ).length;

  const swiggyConfig = platforms?.swiggy ?? DEFAULT_PLATFORM_CONFIG;
  const zomatoConfig = platforms?.zomato ?? DEFAULT_PLATFORM_CONFIG;
  const anyConfigured = swiggyConfig.isConfigured || zomatoConfig.isConfigured;
  const anyEnabled = swiggyConfig.enabled || zomatoConfig.enabled;

  return (
    <motion.div
      className="mb-6 glass-panel-dark rounded-xl overflow-hidden relative z-10"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-saffron/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-saffron" />
          </div>
          <div>
            <h3 className="font-bold text-warm-white text-sm">Online Orders</h3>
            <p className="text-xs text-gray-400">
              {anyConfigured
                ? anyEnabled
                  ? 'Extracting orders automatically'
                  : 'Configured — enable to start'
                : 'Set up Swiggy & Zomato integration'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pending badge */}
          {pendingOrderCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              {pendingOrderCount} pending
            </span>
          )}

          {/* Auto-accept pill */}
          <button
            onClick={() => setAutoAcceptEnabled(!autoAcceptEnabled)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              autoAcceptEnabled
                ? 'bg-green-500/20 border-green-500/40 text-green-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
            )}
            title="Toggle auto-accept"
          >
            {autoAcceptEnabled ? (
              <ToggleRight className="w-3.5 h-3.5" />
            ) : (
              <ToggleLeft className="w-3.5 h-3.5" />
            )}
            Auto-accept
          </button>

          {/* Settings link */}
          <button
            onClick={() => navigate('/aggregator/settings')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-warm-white hover:bg-white/10 transition-all"
            title="Aggregator Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Platform rows */}
      <div className="p-4 space-y-3">
        {PLATFORMS.map((meta) => (
          <PlatformRow
            key={meta.id}
            meta={meta}
            orderCount={meta.id === 'swiggy' ? swiggyOrders : zomatoOrders}
            extractionActive={meta.id === 'swiggy' ? swiggyActive : zomatoActive}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <button
          onClick={onOpenBoth}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-warm text-white rounded-lg text-sm font-bold shadow-warm-glow hover:shadow-2xl hover:scale-105 transition-all flex-1 justify-center"
        >
          <ExternalLink className="w-4 h-4" />
          Open Both Dashboards
        </button>

        {(swiggyActive || zomatoActive) && (
          <button
            onClick={onCloseBoth}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-sm font-medium transition-all"
          >
            Close All
          </button>
        )}
      </div>

      {/* Extraction activity */}
      {extractedCount > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {extractedCount} orders extracted this session
        </div>
      )}
    </motion.div>
  );
}
