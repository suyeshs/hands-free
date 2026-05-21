import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { TableSession } from '../../types/pos';

interface ActiveTablesBarProps {
  activeTables: Record<number, TableSession>;
  currentTableNumber: number | null;
  onSelectTable: (tableNumber: number) => void;
  onOpenNewTable: () => void;
  isDark?: boolean;
}

export function ActiveTablesBar({
  activeTables,
  currentTableNumber,
  onSelectTable,
  onOpenNewTable,
  isDark = false,
}: ActiveTablesBarProps) {
  // Sort table numbers for consistent display
  const sortedTableNumbers = useMemo(() => {
    return Object.keys(activeTables)
      .map(Number)
      .sort((a, b) => a - b);
  }, [activeTables]);

  if (sortedTableNumbers.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 border-b overflow-x-auto',
        isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-gray-200'
      )}
    >
      {/* Label */}
      <div
        className={cn(
          'text-[10px] font-black uppercase tracking-widest whitespace-nowrap',
          isDark ? 'text-zinc-500' : 'text-gray-500'
        )}
      >
        Active Tables:
      </div>

      {/* Table Tabs */}
      <div className="flex items-center gap-2 flex-1 overflow-x-auto">
        {sortedTableNumbers.map((tableNum) => {
          const session = activeTables[tableNum];
          const isSelected = currentTableNumber === tableNum;
          const hasSentItems = session.order && session.order.items.length > 0;
          const isBillPrinted = session.billPrinted;
          const hasKot = session.kotRecords && session.kotRecords.length > 0;
          const total = session.order?.total || 0;

          // Determine status color
          let statusColor = 'green'; // Active with sent items
          if (isBillPrinted) {
            statusColor = 'blue'; // Bill printed, awaiting payment
          } else if (!hasKot) {
            statusColor = 'yellow'; // New table, no KOT sent yet
          }

          return (
            <button
              key={tableNum}
              onClick={() => onSelectTable(tableNum)}
              className={cn(
                'relative flex flex-col items-center justify-center px-3 py-2 border-2 transition-all min-w-[60px] group',
                isSelected
                  ? isDark
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                    : 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                  : isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:border-emerald-500/50'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-emerald-500/50'
              )}
              title={`Table ${tableNum} • ${session.guestCount} guest${session.guestCount !== 1 ? 's' : ''} • ₹${total.toFixed(0)}`}
            >
              {/* Status Indicator Dot */}
              {!isSelected && (
                <div
                  className={cn(
                    'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2',
                    isDark ? 'border-zinc-900' : 'border-white',
                    statusColor === 'green' && 'bg-green-500',
                    statusColor === 'yellow' && 'bg-yellow-500 animate-pulse',
                    statusColor === 'blue' && 'bg-blue-500 animate-pulse'
                  )}
                />
              )}

              {/* Table Number */}
              <span className="text-xs font-black uppercase">
                T{tableNum}
              </span>

              {/* Total Amount */}
              {total > 0 && (
                <span
                  className={cn(
                    'text-[9px] font-bold mt-0.5',
                    isSelected
                      ? 'text-white/90'
                      : isDark
                        ? 'text-zinc-500 group-hover:text-emerald-400'
                        : 'text-gray-500 group-hover:text-emerald-600'
                  )}
                >
                  ₹{total.toFixed(0)}
                </span>
              )}

              {/* Item Count Badge */}
              {hasSentItems && !isSelected && (
                <div
                  className={cn(
                    'absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-black',
                    isDark
                      ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
                      : 'bg-gray-200 text-gray-700 border border-gray-300'
                  )}
                >
                  {session.order.items.length}
                </div>
              )}
            </button>
          );
        })}

        {/* Add New Table Button */}
        <button
          onClick={onOpenNewTable}
          className={cn(
            'flex items-center justify-center px-3 py-2 border-2 border-dashed transition-all min-w-[60px] h-full',
            isDark
              ? 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400'
              : 'bg-gray-50/50 border-gray-300 text-gray-400 hover:bg-gray-100 hover:border-emerald-500/50 hover:text-emerald-600'
          )}
          title="Open new table"
        >
          <span className="text-xl font-bold">+</span>
        </button>
      </div>

      {/* Legend (optional, can be hidden on small screens) */}
      <div className="hidden lg:flex items-center gap-3 ml-4 pl-4 border-l border-current/10">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className={cn('text-[9px] font-bold', isDark ? 'text-zinc-500' : 'text-gray-500')}>
            Active
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className={cn('text-[9px] font-bold', isDark ? 'text-zinc-500' : 'text-gray-500')}>
            Pending
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className={cn('text-[9px] font-bold', isDark ? 'text-zinc-500' : 'text-gray-500')}>
            Billed
          </span>
        </div>
      </div>
    </div>
  );
}
