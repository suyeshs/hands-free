/**
 * KDS Station Column Component - Industrial V2
 * Displays items for a specific station group with explicit START/DONE buttons
 * Supports light and dark themes
 */

import { Play, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { KitchenItemStatus } from '../../types/kds';
import type { GroupedItems } from '../../utils/kdsGrouping';
import {
  getStationColorClasses,
} from '../../utils/kdsGrouping';

interface KDSStationColumnProps {
  groupedItems: GroupedItems;
  onItemClick?: (itemId: string, currentStatus: KitchenItemStatus) => void;
  isCompact?: boolean; // For mobile/tablet view
  maxVisibleItems?: number; // Max items before scroll
  isReadOnly?: boolean; // For history view
  isItemOutOfStock?: (itemName: string) => boolean;
  theme?: 'light' | 'dark'; // Theme support
}

export function KDSStationColumn({
  groupedItems,
  onItemClick,
  isCompact = false,
  maxVisibleItems = 6,
  isReadOnly = false,
  isItemOutOfStock,
  theme = 'dark',
}: KDSStationColumnProps) {
  const { group, items, pendingCount, inProgressCount, readyCount } = groupedItems;
  const colors = getStationColorClasses(group.color);

  const allReady = pendingCount === 0 && inProgressCount === 0;
  const hasOverflow = items.length > maxVisibleItems;

  // Theme-aware classes
  const themeClasses = {
    bg: theme === 'dark' ? 'bg-slate-900/50' : 'bg-white',
    border: theme === 'dark' ? 'border-slate-700' : 'border-gray-300',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-slate-400' : 'text-gray-600',
    itemBg: theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-50',
    itemHover: theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gray-100',
  };

  // Handle button clicks
  const handleStart = (itemId: string) => {
    if (!isReadOnly && onItemClick) {
      onItemClick(itemId, 'pending');
    }
  };

  const handleDone = (itemId: string) => {
    if (!isReadOnly && onItemClick) {
      onItemClick(itemId, 'in_progress');
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border-3 overflow-hidden shadow-lg',
        themeClasses.bg,
        themeClasses.border,
        isCompact ? 'min-w-[160px] max-w-[200px]' : 'flex-1 min-w-[200px]'
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between border-b-2',
          colors.border,
          colors.bgSolid
        )}
      >
        <span className="font-black text-white text-base tracking-wider uppercase">
          {group.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-white/90 text-sm font-black px-2 py-0.5 bg-black/20 rounded">
            {readyCount}/{items.length}
          </span>
        </div>
      </div>

      {/* Items List */}
      <div
        className={cn(
          'flex-1 p-3 space-y-2',
          hasOverflow && 'overflow-y-auto',
          isCompact ? 'max-h-[220px]' : 'max-h-[280px]'
        )}
      >
        {items.map((item) => {
          const isOOS = isItemOutOfStock?.(item.name);
          const isPending = item.status === 'pending';
          const isInProgress = item.status === 'in_progress';
          const isReady = item.status === 'ready' || item.status === 'served';

          return (
            <div
              key={item.id}
              className={cn(
                'p-2.5 rounded-lg border-2 transition-all',
                themeClasses.itemBg,
                isPending && (theme === 'dark' ? 'border-slate-600' : 'border-gray-300'),
                isInProgress && 'border-blue-500 bg-blue-950/30',
                isReady && 'border-green-500 bg-green-950/20 opacity-70',
                isOOS && 'border-red-500 bg-red-950/20'
              )}
            >
              {/* Main Row: Item Info + Action Button */}
              <div className="flex items-start gap-2">
                {/* Left: Item Content */}
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-bold leading-tight', themeClasses.text)}>
                    {isOOS && (
                      <span className="text-[10px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded mr-1.5">
                        86
                      </span>
                    )}
                    <span className="text-amber-500 font-black mr-1.5 text-base">
                      {item.quantity}×
                    </span>
                    <span className={isReady ? 'line-through decoration-2' : ''}>
                      {item.name}
                    </span>
                  </div>

                  {/* Modifiers */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className={cn('text-[10px] mt-1', themeClasses.textMuted)}>
                      + {item.modifiers.map(m => typeof m === 'string' ? m : m.name).join(', ')}
                    </div>
                  )}

                  {/* Special Instructions */}
                  {item.specialInstructions && (
                    <div className="text-[10px] text-red-500 font-bold mt-1 bg-red-100 dark:bg-red-950/30 px-2 py-0.5 rounded inline-block">
                      ⚠ {item.specialInstructions}
                    </div>
                  )}
                </div>

                {/* Right: Action Button or Status Badge */}
                <div className="flex-shrink-0">
                  {/* Action Buttons - Inline with item name */}
                  {!isReadOnly && isPending && (
                    <button
                      onClick={() => handleStart(item.id)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-colors touch-target shadow-md"
                    >
                      <Play size={12} fill="white" />
                      Start
                    </button>
                  )}
                  {!isReadOnly && isInProgress && (
                    <button
                      onClick={() => handleDone(item.id)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-colors touch-target shadow-md animate-pulse"
                    >
                      <Check size={12} strokeWidth={3} />
                      Done
                    </button>
                  )}
                  {/* Status Badge - Only show when readonly or ready */}
                  {(isReadOnly || isReady) && (
                    <>
                      {isPending && (
                        <div className="px-2 py-1 text-[10px] font-black uppercase bg-slate-700 text-slate-300 rounded">
                          New
                        </div>
                      )}
                      {isInProgress && (
                        <div className="px-2 py-1 text-[10px] font-black uppercase bg-blue-600 text-white rounded animate-pulse">
                          Cooking
                        </div>
                      )}
                      {isReady && (
                        <div className="px-2 py-1 text-[10px] font-black uppercase bg-green-600 text-white rounded flex items-center gap-1">
                          <Check size={10} />
                          Done
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Footer - shows progress */}
      {!allReady && (
        <div
          className={cn(
            'px-3 py-2 border-t-2 text-xs font-bold flex gap-3 justify-center',
            colors.border,
            theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'
          )}
        >
          {pendingCount > 0 && (
            <span className={cn('flex items-center gap-1', themeClasses.textMuted)}>
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              {pendingCount} new
            </span>
          )}
          {inProgressCount > 0 && (
            <span className="flex items-center gap-1 text-blue-500">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {inProgressCount} cooking
            </span>
          )}
        </div>
      )}

      {/* All Ready Indicator */}
      {allReady && items.length > 0 && (
        <div
          className={cn(
            'px-3 py-2 border-t-2 text-xs font-black text-center uppercase tracking-wider',
            colors.border,
            'bg-green-600 text-white'
          )}
        >
          ✓ All Items Ready
        </div>
      )}
    </div>
  );
}
