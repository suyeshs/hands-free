/**
 * KDS Station Column Component
 * Displays items for a specific station group in a compact column format
 */

import { cn } from '../../lib/utils';
import type { KitchenItemStatus } from '../../types/kds';
import type { GroupedItems } from '../../utils/kdsGrouping';
import {
  getStationColorClasses,
  getItemStatusIndicator,
} from '../../utils/kdsGrouping';

interface KDSStationColumnProps {
  groupedItems: GroupedItems;
  onItemClick?: (itemId: string, currentStatus: KitchenItemStatus) => void;
  isCompact?: boolean; // For mobile/tablet view
  maxVisibleItems?: number; // Max items before scroll
  isReadOnly?: boolean; // For history view
  isItemOutOfStock?: (itemName: string) => boolean;
}

export function KDSStationColumn({
  groupedItems,
  onItemClick,
  isCompact = false,
  maxVisibleItems = 6,
  isReadOnly = false,
  isItemOutOfStock,
}: KDSStationColumnProps) {
  const { group, items, pendingCount, inProgressCount, readyCount } = groupedItems;
  const colors = getStationColorClasses(group.color);

  const allReady = pendingCount === 0 && inProgressCount === 0;
  const hasOverflow = items.length > maxVisibleItems;

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border-2 overflow-hidden',
        colors.border,
        colors.bg,
        isCompact ? 'min-w-[140px] max-w-[180px]' : 'flex-1 min-w-[160px]'
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          'px-3 py-2 flex items-center justify-between border-b',
          colors.border,
          colors.bgSolid
        )}
      >
        <span className="font-black text-white text-sm tracking-wider">
          {group.label}
        </span>
        <span className="text-white/80 text-xs font-bold">
          {readyCount}/{items.length}
        </span>
      </div>

      {/* Items List */}
      <div
        className={cn(
          'flex-1 p-2 space-y-1',
          hasOverflow && 'overflow-y-auto',
          isCompact ? 'max-h-[180px]' : 'max-h-[240px]'
        )}
      >
        {items.map((item) => {
          const isOOS = isItemOutOfStock?.(item.name);
          const isReady = item.status === 'ready' || item.status === 'served';

          return (
            <button
              key={item.id}
              onClick={() => !isReadOnly && onItemClick?.(item.id, item.status)}
              disabled={isReadOnly || isReady}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded transition-all',
                'flex items-start gap-2',
                !isReadOnly && !isReady && 'hover:bg-white/10 active:bg-white/20 cursor-pointer',
                isReady && 'opacity-50',
                isReadOnly && 'cursor-default'
              )}
            >
              {/* Status Indicator */}
              <span
                className={cn(
                  'flex-shrink-0 text-sm mt-0.5',
                  item.status === 'pending' && 'text-slate-500',
                  item.status === 'in_progress' && 'text-blue-400 animate-pulse',
                  (item.status === 'ready' || item.status === 'served') && 'text-green-500'
                )}
              >
                {getItemStatusIndicator(item.status)}
              </span>

              {/* Item Content */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm font-semibold leading-tight',
                    isReady && 'line-through decoration-1',
                    isOOS && 'text-red-400'
                  )}
                >
                  {isOOS && (
                    <span className="text-[10px] font-black bg-red-900/50 px-1 rounded mr-1">
                      86
                    </span>
                  )}
                  <span className="text-yellow-400 mr-1">{item.quantity}x</span>
                  <span className="text-white">{item.name}</span>
                </div>

                {/* Modifiers */}
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    + {item.modifiers.map(m => typeof m === 'string' ? m : m.name).join(', ')}
                  </div>
                )}

                {/* Special Instructions */}
                {item.specialInstructions && (
                  <div className="text-[10px] text-red-400 font-semibold mt-0.5 truncate">
                    {item.specialInstructions}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Status Footer - shows progress */}
      {!allReady && (
        <div
          className={cn(
            'px-2 py-1 border-t text-[10px] font-semibold flex gap-2 justify-center',
            colors.border
          )}
        >
          {pendingCount > 0 && (
            <span className="text-slate-400">{pendingCount} pending</span>
          )}
          {inProgressCount > 0 && (
            <span className="text-blue-400">{inProgressCount} cooking</span>
          )}
        </div>
      )}

      {/* All Ready Indicator */}
      {allReady && items.length > 0 && (
        <div
          className={cn(
            'px-2 py-1 border-t text-[10px] font-black text-center text-green-400 uppercase tracking-wider',
            colors.border
          )}
        >
          Ready
        </div>
      )}
    </div>
  );
}
