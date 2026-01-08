/**
 * KDS Grouped Order Card Component
 * Displays an order with items grouped by station in a compact, multi-column layout
 */

import { useState } from 'react';
import { Ban, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { KitchenOrder, KitchenOrderItem, KitchenItemStatus } from '../../types/kds';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';
import { IndustrialBadge } from '../ui-industrial/IndustrialBadge';
import { KDSStationColumn } from './KDSStationColumn';
import { groupItemsByStation } from '../../utils/kdsGrouping';

interface KDSGroupedOrderCardProps {
  order: KitchenOrder;
  orderAge: number; // Minutes since order was placed
  urgency: 'normal' | 'warning' | 'urgent';
  onItemStatusChange?: (orderId: string, itemId: string, newStatus: KitchenItemStatus) => void;
  onBumpOrder?: (orderId: string) => void;
  onMarkOutOfStock?: (order: KitchenOrder, item: KitchenOrderItem) => void;
  isItemOutOfStock?: (itemName: string) => boolean;
  isCompact?: boolean; // Mobile view
  isReadOnly?: boolean; // History view
}

export function KDSGroupedOrderCard({
  order,
  orderAge,
  urgency,
  onItemStatusChange,
  onBumpOrder,
  onMarkOutOfStock,
  isItemOutOfStock,
  isCompact = false,
  isReadOnly = false,
}: KDSGroupedOrderCardProps) {
  // 86 selection modal state
  const [show86Modal, setShow86Modal] = useState(false);

  // Group items by station
  const groupedItems = groupItemsByStation(order.items);

  // Check if all items are ready
  const allItemsReady = order.items.every(
    (item) => item.status === 'ready' || item.status === 'served'
  );

  // Get items that can be marked 86 (not ready, not already OOS)
  const markableItems = order.items.filter(
    (item) =>
      item.status !== 'ready' &&
      item.status !== 'served' &&
      !isItemOutOfStock?.(item.name)
  );

  // Handle item click - cycle through statuses
  const handleItemClick = (itemId: string, currentStatus: KitchenItemStatus) => {
    if (isReadOnly || !onItemStatusChange) return;

    let newStatus: KitchenItemStatus;
    switch (currentStatus) {
      case 'pending':
        newStatus = 'in_progress';
        break;
      case 'in_progress':
        newStatus = 'ready';
        break;
      default:
        return; // Don't change if already ready/served
    }

    onItemStatusChange(order.id, itemId, newStatus);
  };

  // Handle 86 item selection
  const handleSelect86Item = (item: KitchenOrderItem) => {
    setShow86Modal(false);
    onMarkOutOfStock?.(order, item);
  };

  return (
    <>
      <IndustrialCard
        variant="dark"
        padding="none"
        className={cn(
          'flex flex-col border-4 overflow-hidden',
          // Running orders get orange border and animation
          order.isRunningOrder && 'border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse',
          // Non-running orders use urgency-based styling
          !order.isRunningOrder && urgency === 'urgent' && 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]',
          !order.isRunningOrder && urgency === 'warning' && 'border-yellow-500',
          !order.isRunningOrder && urgency === 'normal' && 'border-slate-700',
          // History view styling
          isReadOnly && 'opacity-80 border-slate-600'
        )}
      >
        {/* Order Header */}
        <div
          className={cn(
            'px-4 py-3 flex items-center justify-between border-b-4',
            // Running orders get orange header
            order.isRunningOrder
              ? 'bg-orange-600 border-orange-700'
              : urgency === 'urgent'
              ? 'bg-red-700 border-red-800'
              : urgency === 'warning'
              ? 'bg-yellow-700 border-yellow-800'
              : 'bg-slate-800 border-slate-900',
            isReadOnly && 'bg-slate-700 border-slate-800'
          )}
        >
          {/* Left: Order Number + Table */}
          <div className="flex items-center gap-3">
            <div className={cn('font-black', isCompact ? 'text-2xl' : 'text-3xl')}>
              #{order.orderNumber}
            </div>
            {order.tableNumber && (
              <IndustrialBadge size="sm" className="bg-slate-900/50 border-slate-600 text-white">
                T{order.tableNumber}
              </IndustrialBadge>
            )}
          </div>

          {/* Right: 86 Button + Badges + Timer */}
          <div className="flex items-center gap-2">
            {/* 86 Button - only show if not readonly and has markable items */}
            {!isReadOnly && markableItems.length > 0 && onMarkOutOfStock && (
              <button
                onClick={() => setShow86Modal(true)}
                className={cn(
                  'px-2 py-1 rounded font-black text-xs uppercase border-2 transition-all',
                  'bg-red-900/50 border-red-600 text-red-300 hover:bg-red-800 hover:text-white'
                )}
              >
                86
              </button>
            )}
            {order.isRunningOrder && (
              <IndustrialBadge size="sm" className="bg-orange-900 border-orange-400 text-orange-100 font-black">
                RUN
              </IndustrialBadge>
            )}
            {order.source && order.source !== 'pos' && !order.isRunningOrder && (
              <IndustrialBadge size="sm" className="bg-black border-black text-white uppercase">
                {order.source}
              </IndustrialBadge>
            )}
            {isReadOnly && order.completedAt && (
              <IndustrialBadge size="sm" className="bg-green-900 border-green-600 text-green-300">
                DONE
              </IndustrialBadge>
            )}
            <div className={cn('font-black', isCompact ? 'text-xl' : 'text-2xl')}>
              {orderAge}m
            </div>
          </div>
        </div>

        {/* Station Columns */}
        <div
          className={cn(
            'flex-1 p-3 bg-slate-900/50',
            isCompact ? 'overflow-x-auto' : ''
          )}
        >
          <div
            className={cn(
              'flex gap-2',
              isCompact ? 'flex-nowrap' : 'flex-wrap',
              // On desktop with few groups, distribute evenly
              !isCompact && groupedItems.length <= 3 && 'justify-center'
            )}
          >
            {groupedItems.map((grouped) => (
              <KDSStationColumn
                key={grouped.group.id}
                groupedItems={grouped}
                onItemClick={(itemId, status) => handleItemClick(itemId, status)}
                isCompact={isCompact}
                maxVisibleItems={isCompact ? 4 : 6}
                isReadOnly={isReadOnly}
                isItemOutOfStock={isItemOutOfStock}
              />
            ))}
          </div>
        </div>

        {/* Bump Button - only show when all ready and not in history */}
        {allItemsReady && !isReadOnly && onBumpOrder && (
          <button
            onClick={() => onBumpOrder(order.id)}
            className={cn(
              'w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest transition-colors animate-pulse touch-target',
              isCompact ? 'py-4 text-lg' : 'py-5 text-xl'
            )}
          >
            BUMP ORDER
          </button>
        )}

        {/* History: Completed timestamp */}
        {isReadOnly && order.completedAt && (
          <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 text-center">
            <span className="text-xs text-slate-400">
              Completed at{' '}
              {new Date(order.completedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </IndustrialCard>

      {/* 86 Item Selection Modal */}
      {show86Modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShow86Modal(false)}
        >
          <div
            className="bg-slate-900 border-4 border-red-600 rounded-lg max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-red-700 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban size={20} />
                <span className="font-black uppercase tracking-wider">
                  Mark 86'd - #{order.orderNumber}
                </span>
              </div>
              <button
                onClick={() => setShow86Modal(false)}
                className="p-1 hover:bg-red-600 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Item List */}
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-400 mb-3">
                Select an item to mark as out of stock:
              </p>
              {markableItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect86Item(item)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border-2 transition-all',
                    'bg-slate-800 border-slate-700 hover:border-red-500 hover:bg-red-900/20',
                    'flex items-center justify-between gap-3'
                  )}
                >
                  <div className="flex-1">
                    <div className="font-bold text-white">
                      <span className="text-yellow-400 mr-2">{item.quantity}x</span>
                      {item.name}
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-xs text-slate-400 mt-1">
                        + {item.modifiers.map(m => typeof m === 'string' ? m : m.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      'text-xs font-semibold px-2 py-1 rounded uppercase',
                      item.status === 'pending' && 'bg-slate-700 text-slate-300',
                      item.status === 'in_progress' && 'bg-blue-900 text-blue-300'
                    )}
                  >
                    {item.status === 'pending' ? 'Pending' : 'Cooking'}
                  </div>
                </button>
              ))}

              {markableItems.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Ban size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No items available to mark as 86'd</p>
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
              <button
                onClick={() => setShow86Modal(false)}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold uppercase rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
