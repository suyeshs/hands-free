/**
 * AggregatorExtractionMonitor Component
 * Displays extracted DOM elements from aggregator dashboards
 * Shows order states, available buttons, customer details, and allows action execution
 */

import { useState, useEffect } from 'react';
import { NeoCard } from '../ui-v2/NeoCard';
import { NeoButton } from '../ui-v2/NeoButton';
import { GlassModal } from '../ui-v2/GlassModal';
import { cn } from '../../lib/utils';
import {
  useAggregatorExtractionStore,
  ExtractedButton,
  useInitializeExtractionService,
} from '../../stores/aggregatorExtractionStore';
import { isTauri } from '../../lib/platform';

interface ExtractionMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AggregatorExtractionMonitor({ isOpen, onClose }: ExtractionMonitorProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<'swiggy' | 'zomato' | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showButtonDetails, setShowButtonDetails] = useState(false);

  const {
    extractionEnabled,
    setExtractionEnabled,
    extractionInterval,
    setExtractionInterval,
    serviceStatus,
    orderStates,
    actionResults,
    lastError,
    isLoading,
    startExtractionService,
    stopExtractionService,
    executeAction,
    getOrdersByPlatform,
  } = useAggregatorExtractionStore();

  const { initialize } = useInitializeExtractionService();

  // Initialize listeners when modal opens
  useEffect(() => {
    if (isOpen && isTauri()) {
      initialize();
    }
  }, [isOpen]);

  // Filter orders by platform
  const filteredOrders = selectedPlatform === 'all'
    ? Array.from(orderStates.values())
    : getOrdersByPlatform(selectedPlatform);

  const selectedOrderState = selectedOrder ? orderStates.get(selectedOrder) : null;

  // Handle action execution
  const handleExecuteAction = async (button: ExtractedButton) => {
    if (!selectedOrderState) return;

    await executeAction(
      selectedOrderState.platform,
      selectedOrderState.orderId,
      button.type
    );
  };

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title="Aggregator Extraction Monitor"
      size="xl"
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
        {/* Service Control */}
        <NeoCard className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Extraction Service</h3>
              <p className="text-sm text-muted-foreground">
                Continuously monitor aggregator orders and actions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractionEnabled}
                  onChange={(e) => setExtractionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-primary focus:ring-primary"
                />
                <span className={cn(
                  'font-medium',
                  extractionEnabled ? 'text-emerald-400' : 'text-zinc-400'
                )}>
                  {extractionEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          {/* Interval Setting */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm text-muted-foreground">Interval (ms):</label>
            <input
              type="number"
              value={extractionInterval}
              onChange={(e) => setExtractionInterval(Number(e.target.value))}
              min={1000}
              max={10000}
              step={500}
              className="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground text-sm"
            />
          </div>

          {/* Platform Status */}
          <div className="grid grid-cols-2 gap-4">
            {(['swiggy', 'zomato'] as const).map((platform) => (
              <div
                key={platform}
                className={cn(
                  'p-3 rounded-lg border',
                  serviceStatus[platform].active
                    ? 'bg-emerald-900/20 border-emerald-500/30'
                    : 'bg-zinc-800/50 border-zinc-700'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    'font-medium capitalize',
                    platform === 'swiggy' ? 'text-orange-400' : 'text-red-400'
                  )}>
                    {platform}
                  </span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    serviceStatus[platform].active
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-zinc-700 text-zinc-400'
                  )}>
                    {serviceStatus[platform].active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Orders: {serviceStatus[platform].orderCount}</div>
                  <div>
                    Last: {serviceStatus[platform].lastExtraction
                      ? new Date(serviceStatus[platform].lastExtraction).toLocaleTimeString()
                      : 'Never'}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <NeoButton
                    size="sm"
                    variant={serviceStatus[platform].active ? 'destructive' : 'primary'}
                    onClick={() => serviceStatus[platform].active
                      ? stopExtractionService(platform)
                      : startExtractionService(platform)
                    }
                    disabled={!extractionEnabled}
                    className="flex-1 text-xs"
                  >
                    {serviceStatus[platform].active ? 'Stop' : 'Start'}
                  </NeoButton>
                </div>
              </div>
            ))}
          </div>
        </NeoCard>

        {/* Error Display */}
        {lastError && (
          <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {lastError}
          </div>
        )}

        {/* Platform Filter */}
        <div className="flex gap-2">
          {(['all', 'swiggy', 'zomato'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPlatform(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                selectedPlatform === p
                  ? p === 'swiggy'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : p === 'zomato'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-primary/20 text-primary border border-primary/50'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              )}
            >
              {p} ({p === 'all' ? orderStates.size : getOrdersByPlatform(p).length})
            </button>
          ))}
        </div>

        {/* Extracted Orders */}
        <NeoCard className="p-4">
          <h3 className="font-semibold text-foreground mb-3">
            Extracted Orders ({filteredOrders.length})
          </h3>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No orders extracted yet.</p>
              <p className="text-sm mt-2">
                {extractionEnabled
                  ? 'Waiting for data from aggregator dashboards...'
                  : 'Enable extraction service to start monitoring.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredOrders.map((order) => (
                <div
                  key={order.orderId}
                  onClick={() => setSelectedOrder(order.orderId)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-all',
                    selectedOrder === order.orderId
                      ? 'bg-primary/20 border border-primary/50'
                      : 'bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-medium',
                        order.platform === 'swiggy' ? 'text-orange-400' : 'text-red-400'
                      )}>
                        #{order.orderNumber}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                        {order.dashboardStatus}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.buttons.filter(b => b.visible).length} buttons
                    </div>
                  </div>

                  {/* Customer Preview */}
                  {order.customer.name && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {order.customer.name}
                      {order.customer.phone && (
                        <span className="text-emerald-400 ml-2">{order.customer.phone}</span>
                      )}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {order.buttons
                      .filter(b => b.visible && b.enabled && ['accept', 'reject', 'ready'].includes(b.type))
                      .map((btn, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            btn.type === 'accept' && 'bg-emerald-900/30 text-emerald-400',
                            btn.type === 'reject' && 'bg-red-900/30 text-red-400',
                            btn.type === 'ready' && 'bg-blue-900/30 text-blue-400'
                          )}
                        >
                          {btn.type}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </NeoCard>

        {/* Selected Order Details */}
        {selectedOrderState && (
          <NeoCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">
                Order #{selectedOrderState.orderNumber} Details
              </h3>
              <NeoButton
                size="sm"
                variant="ghost"
                onClick={() => setShowButtonDetails(!showButtonDetails)}
              >
                {showButtonDetails ? 'Hide' : 'Show'} Raw Data
              </NeoButton>
            </div>

            {/* Customer Details */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Customer</h4>
              <div className="bg-zinc-800/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="text-foreground">{selectedOrderState.customer.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className={cn(
                    selectedOrderState.customer.phone ? 'text-emerald-400 font-medium' : 'text-foreground'
                  )}>
                    {selectedOrderState.customer.phone || 'N/A'}
                  </span>
                </div>
                {selectedOrderState.customer.address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="text-foreground text-right max-w-[60%]">
                      {selectedOrderState.customer.address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Partner */}
            {selectedOrderState.deliveryPartner && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Delivery Partner</h4>
                <div className="bg-zinc-800/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="text-foreground">{selectedOrderState.deliveryPartner.name || 'N/A'}</span>
                  </div>
                  {selectedOrderState.deliveryPartner.phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="text-foreground">{selectedOrderState.deliveryPartner.phone}</span>
                    </div>
                  )}
                  {selectedOrderState.deliveryPartner.status && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="text-foreground">{selectedOrderState.deliveryPartner.status}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Available Actions */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Available Actions ({selectedOrderState.buttons.filter(b => b.visible && b.enabled).length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedOrderState.buttons
                  .filter(b => b.visible && b.enabled)
                  .map((btn, idx) => (
                    <NeoButton
                      key={idx}
                      size="sm"
                      variant={
                        btn.type === 'accept' ? 'primary' :
                        btn.type === 'reject' ? 'destructive' :
                        btn.type === 'ready' ? 'default' : 'ghost'
                      }
                      onClick={() => handleExecuteAction(btn)}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      {btn.text || btn.type}
                    </NeoButton>
                  ))}
              </div>
            </div>

            {/* All Buttons (Debug) */}
            {showButtonDetails && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  All Detected Buttons ({selectedOrderState.buttons.length})
                </h4>
                <div className="bg-zinc-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left p-1">Type</th>
                        <th className="text-left p-1">Text</th>
                        <th className="text-left p-1">Visible</th>
                        <th className="text-left p-1">Enabled</th>
                        <th className="text-left p-1">Selector</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderState.buttons.map((btn, idx) => (
                        <tr key={idx} className={cn(
                          !btn.visible && 'opacity-50'
                        )}>
                          <td className="p-1 text-foreground">{btn.type}</td>
                          <td className="p-1 text-muted-foreground max-w-[100px] truncate">
                            {btn.text || '-'}
                          </td>
                          <td className="p-1">
                            <span className={btn.visible ? 'text-emerald-400' : 'text-red-400'}>
                              {btn.visible ? 'Y' : 'N'}
                            </span>
                          </td>
                          <td className="p-1">
                            <span className={btn.enabled ? 'text-emerald-400' : 'text-red-400'}>
                              {btn.enabled ? 'Y' : 'N'}
                            </span>
                          </td>
                          <td className="p-1 text-muted-foreground max-w-[150px] truncate font-mono">
                            {btn.selector}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Raw JSON (Debug) */}
            {showButtonDetails && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Raw State</h4>
                <div className="bg-zinc-900 rounded-lg p-3 max-h-32 overflow-auto">
                  <pre className="text-xs text-muted-foreground">
                    {JSON.stringify(selectedOrderState, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </NeoCard>
        )}

        {/* Action Results Log */}
        {actionResults.length > 0 && (
          <NeoCard className="p-4">
            <h3 className="font-semibold text-foreground mb-3">Action Results</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {actionResults.slice().reverse().map((result, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'text-xs p-2 rounded',
                    result.success ? 'bg-emerald-900/20' : 'bg-red-900/20'
                  )}
                >
                  <span className={result.success ? 'text-emerald-400' : 'text-red-400'}>
                    {result.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                  <span className="text-foreground ml-2">{result.actionType}</span>
                  <span className="text-muted-foreground ml-2">on {result.orderId}</span>
                  <span className="text-zinc-500 ml-2">{result.message}</span>
                </div>
              ))}
            </div>
          </NeoCard>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <NeoButton variant="primary" onClick={onClose}>
            Close
          </NeoButton>
        </div>
      </div>
    </GlassModal>
  );
}
